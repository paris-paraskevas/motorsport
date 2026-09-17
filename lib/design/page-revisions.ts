import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { EMPTY_DOCUMENT, parsePageDocument, type PageDocument } from './page-document';
import { PAGE_APPLICATION_KEY, PAGE_COLUMNS, pageFromRow, type PageRow } from './pages';
import { pageDest } from './destinations';
import { loadComponents } from './definitions';

export {
  EMPTY_DOCUMENT,
  PAGE_DOCUMENT_VERSION,
  PAGE_NAME_MAX,
  POSITIONS,
  POSITION_LABELS,
  REGION_KINDS,
  REGION_KIND_LABELS,
  ROW_PAGE_PATH,
  documentRefs,
  parsePageDocument,
  patternMatches,
  rowPagePathProblem,
  rowsAt,
} from './page-document';
export type { DocumentRefs, PageDocument, Position, Region, RegionKind } from './page-document';

// A page's revisions, for the App Builder. Phase 3 step 2 of the designer plan.
//
// THE RULE THIS FILE ENFORCES: a revision whose document the parser cannot use
// reads as an empty document with its problems named, never as a broken page;
// a revision row without a stamp is left out. Nothing on the site serves a row
// page until step 3, so there is only the designer's view.
//
// Writes go through design_save_page_revision() only (migration 20260909010000),
// called by app/api/admin/design/pages/[id]/revisions.

export interface RevisionSummary {
  id: string;
  createdAt: string;
  publishedAt: string | null;
  author: string | null;
  base: string | null;
}

/** What names a page (rule 10: every shared object shows where it is used; P1.12 B2). */
export interface NamedBy {
  /** The labels of the lists holding an entry to the page. */
  lists: string[];
  /** The names of the live pages whose LIVE revision carries a button or a go effect to the page. */
  pages: string[];
}

export interface PageDetail {
  page: PageRow;
  /** The newest published revision, or null when the page has never been published. */
  live: RevisionSummary | null;
  /** The newest revision of any kind, with its document; what the schematic shows. */
  newest: (RevisionSummary & { document: PageDocument; problems: string[] }) | null;
  /** Every revision, newest first. */
  revisions: RevisionSummary[];
  /** What names the page; both empty for a code page, which nothing can name. */
  namedBy: NamedBy;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function summaryOf(item: unknown): (RevisionSummary & { document: unknown }) | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  if (typeof r.id !== 'string' || !UUID.test(r.id) || r.created_at == null) return null;
  return {
    id: r.id,
    createdAt: String(r.created_at),
    publishedAt: r.published_at != null ? String(r.published_at) : null,
    author: typeof r.author === 'string' ? r.author : null,
    base: typeof r.base_revision_id === 'string' ? r.base_revision_id : null,
    document: r.document,
  };
}

const NAMED_BY_NONE: NamedBy = { lists: [], pages: [] };

/** What names the page (P1.12 B2): the lists holding an entry to it, and the
 *  pages whose LIVE revision carries a button or a go effect to it, the same
 *  scoping as design_purge_page's refusal (a superseded or draft revision does
 *  not count, nor a deleted page's, nor the page itself). A code page cannot be
 *  named, so nothing is asked for one. Both lists empty on any failure: the
 *  detail still loads. */
async function loadNamedBy(page: PageRow): Promise<NamedBy> {
  if (page.kind !== 'row' || page.id === null) return NAMED_BY_NONE;
  const key = pageDest(page.id);
  try {
    const db = betDb();
    const entries = await db.from('list_entry').select('list_key').eq('application_key', PAGE_APPLICATION_KEY).eq('dest_key', key);
    if (entries.error) return NAMED_BY_NONE;
    const listKeys = [...new Set(((entries.data ?? []) as { list_key?: unknown }[]).map(e => e.list_key).filter((k): k is string => typeof k === 'string'))];
    let lists: string[] = [];
    if (listKeys.length > 0) {
      const rows = await db.from('list').select('key, label').in('key', listKeys);
      if (rows.error) return NAMED_BY_NONE;
      lists = ((rows.data ?? []) as { key?: unknown; label?: unknown }[])
        .map(l => (typeof l.label === 'string' && l.label ? l.label : typeof l.key === 'string' ? l.key : ''))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    }
    type RefRow = { page_revision?: { id?: unknown; page_id?: unknown; published_at?: unknown; page?: { id?: unknown; name?: unknown; deleted_at?: unknown } | null } | null };
    const refs = await db
      .from('page_revision_ref')
      .select('revision_id, page_revision(id, page_id, published_at, page(id, name, deleted_at))')
      .eq('kind', 'dest')
      .eq('dest_key', key);
    if (refs.error) return NAMED_BY_NONE;
    const candidates = ((refs.data ?? []) as RefRow[])
      .map(r => r.page_revision)
      .filter(
        (r): r is { id: string; page_id: string; published_at: unknown; page: { id?: unknown; name?: unknown; deleted_at?: unknown } } =>
          !!r && typeof r.id === 'string' && typeof r.page_id === 'string' && r.published_at != null && !!r.page && r.page.deleted_at == null && r.page.id !== page.id,
      );
    let pages: string[] = [];
    if (candidates.length > 0) {
      const ids = [...new Set(candidates.map(c => c.page_id))];
      const published = await db.from('page_revision').select('id, page_id, published_at').in('page_id', ids).not('published_at', 'is', null);
      if (published.error) return NAMED_BY_NONE;
      // The live revision of each page: the newest published one, compared here so the order the rows arrive in does not matter.
      const live = new Map<string, { id: string; at: string }>();
      for (const r of (published.data ?? []) as { id?: unknown; page_id?: unknown; published_at?: unknown }[]) {
        if (typeof r.id !== 'string' || typeof r.page_id !== 'string' || r.published_at == null) continue;
        const at = String(r.published_at);
        const seen = live.get(r.page_id);
        if (!seen || at > seen.at) live.set(r.page_id, { id: r.id, at });
      }
      pages = [...new Set(candidates.filter(c => live.get(c.page_id)?.id === c.id).map(c => String(c.page.name ?? '')).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    }
    return { lists, pages };
  } catch {
    return NAMED_BY_NONE;
  }
}

/** The page and its revisions, newest first. Null when the page does not exist or on any failure. */
export async function loadPageDetail(id: string): Promise<PageDetail | null> {
  if (!isBettingConfigured() || !UUID.test(id)) return null;
  try {
    const pageRes = await betDb().from('page').select(PAGE_COLUMNS).eq('application_key', PAGE_APPLICATION_KEY).eq('id', id);
    if (pageRes.error) return null;
    const page = pageFromRow(((pageRes.data ?? []) as unknown[])[0]);
    if (!page) return null;
    const revRes = await betDb()
      .from('page_revision')
      .select('id, created_at, published_at, author, base_revision_id, document')
      .eq('page_id', id);
    if (revRes.error) return null;
    const all = ((revRes.data ?? []) as unknown[]).map(summaryOf).filter((r): r is NonNullable<typeof r> => r !== null);
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const strip = (r: (typeof all)[number]): RevisionSummary => ({
      id: r.id,
      createdAt: r.createdAt,
      publishedAt: r.publishedAt,
      author: r.author,
      base: r.base,
    });
    const published = all.filter(r => r.publishedAt !== null);
    published.sort((a, b) => (a.publishedAt! < b.publishedAt! ? 1 : a.publishedAt! > b.publishedAt! ? -1 : 0));
    const newestRaw = all[0];
    let newest: PageDetail['newest'] = null;
    if (newestRaw) {
      const parsed = parsePageDocument(newestRaw.document, await loadComponents());
      newest = { ...strip(newestRaw), document: parsed.problems.length > 0 && parsed.value.regions.length === 0 ? EMPTY_DOCUMENT : parsed.value, problems: parsed.problems };
    }
    return {
      page,
      live: published[0] ? strip(published[0]) : null,
      newest,
      revisions: all.map(strip),
      namedBy: await loadNamedBy(page),
    };
  } catch {
    return null;
  }
}
