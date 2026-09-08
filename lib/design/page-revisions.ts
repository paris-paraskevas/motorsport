import 'server-only';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { EMPTY_DOCUMENT, parsePageDocument, type PageDocument } from './page-document';
import { PAGE_APPLICATION_KEY, PAGE_COLUMNS, pageFromRow, type PageRow } from './pages';

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

export interface PageDetail {
  page: PageRow;
  /** The newest published revision, or null when the page has never been published. */
  live: RevisionSummary | null;
  /** The newest revision of any kind, with its document; what the schematic shows. */
  newest: (RevisionSummary & { document: PageDocument; problems: string[] }) | null;
  /** Every revision, newest first. */
  revisions: RevisionSummary[];
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
      const parsed = parsePageDocument(newestRaw.document);
      newest = { ...strip(newestRaw), document: parsed.problems.length > 0 && parsed.value.regions.length === 0 ? EMPTY_DOCUMENT : parsed.value, problems: parsed.problems };
    }
    return {
      page,
      live: published[0] ? strip(published[0]) : null,
      newest,
      revisions: all.map(strip),
    };
  } catch {
    return null;
  }
}
