import 'server-only';
import { cache } from 'react';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { PAGE_APPLICATION_KEY, PAGE_COLUMNS, pageFromRow, type PageRow } from './pages';
import { ROW_PAGE_PATH, parsePageDocument, type PageDocument } from './page-document';
import { ASSET_APPLICATION_KEY, ASSET_COLUMNS, assetFromRow, type EditableAsset } from './assets';
import { loadComponents } from './definitions';

// A row page as the site serves it (Phase 3 step 3): the `page` row at a path
// and its live revision, the newest one published. The catch-all reads it for
// the page and again for its metadata, so the read is memoised per request
// with React's cache().
//
// THE RULE THIS FILE ENFORCES: nothing here throws and nothing here guesses. A
// path outside the row-page rule, an unconfigured database, a query error, a
// page that is not a row page, or a page with nothing published all read as
// null, and the catch-all renders its 404 as it always has. A stored document
// the parser cannot use in part renders its usable part (the reader is
// lenient; the writer was strict).

export interface LivePage {
  page: PageRow;
  revisionId: string;
  publishedAt: string;
  document: PageDocument;
}

async function readLivePage(path: string): Promise<LivePage | null> {
  if (!isBettingConfigured() || !ROW_PAGE_PATH.test(path)) return null;
  try {
    const pageRes = await betDb()
      .from('page')
      .select(PAGE_COLUMNS)
      .eq('application_key', PAGE_APPLICATION_KEY)
      .eq('path', path)
      .eq('kind', 'row')
      // A deleted page is not served (P1.12): its address answers 404 until it is reinstated.
      .is('deleted_at', null);
    if (pageRes.error) return null;
    const page = pageFromRow(((pageRes.data ?? []) as unknown[])[0]);
    if (!page || !page.id || page.kind !== 'row') return null;
    const rev = await betDb()
      .from('page_revision')
      .select('id, published_at, document')
      .eq('page_id', page.id)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1);
    if (rev.error) return null;
    const row = ((rev.data ?? []) as unknown[])[0] as { id?: unknown; published_at?: unknown; document?: unknown } | undefined;
    if (!row || typeof row.id !== 'string' || row.published_at == null) return null;
    return { page, revisionId: row.id, publishedAt: String(row.published_at), document: parsePageDocument(row.document, await loadComponents()).value };
  } catch {
    return null;
  }
}

/** The live row page at a literal path, or null. Memoised per request. */
export const loadLivePage = cache(readLivePage);

// A code page's frame (the Page Designer plan, PR 3): the newest published
// revision of a page the code serves, whose regions the site renders around
// the code's body. One query, joined through the revision's page, memoised per
// request only: a cross-request memo here would let an isolate with a warm
// copy regenerate a cached page with the frame just replaced, and that stale
// render would then sit in the page cache until the next publish (seen on the
// development server, 2026-09-09). A cached page pays the query only when it
// is regenerated. Null when the page has nothing published.

export interface LiveFrame {
  revisionId: string;
  publishedAt: string;
  document: PageDocument;
}

async function readLiveFrame(path: string): Promise<LiveFrame | null> {
  if (!isBettingConfigured()) return null;
  try {
    const rev = await betDb()
      .from('page_revision')
      .select('id, published_at, document, page!inner(id)')
      .eq('page.application_key', PAGE_APPLICATION_KEY)
      .eq('page.path', path)
      .eq('page.kind', 'code')
      // No route deletes a code page today; the filter keeps the readers of one mind (P1.12).
      .is('page.deleted_at', null)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1);
    if (rev.error) return null;
    const row = ((rev.data ?? []) as unknown[])[0] as { id?: unknown; published_at?: unknown; document?: unknown } | undefined;
    if (!row || typeof row.id !== 'string' || row.published_at == null) return null;
    return { revisionId: row.id, publishedAt: String(row.published_at), document: parsePageDocument(row.document, await loadComponents()).value };
  } catch {
    return null;
  }
}

/** The live regions of the code page at a registry path (`/series/[slug]`), or null. Memoised per request. */
export const loadLiveFrame = cache(readLiveFrame);

// A page served from rows after its route file left the code (the components
// programme, R4.1): its row at the registry pattern, and its newest published
// revision when it has one. The revision is optional here, unlike a row page's:
// a composed page without a revision renders its default composition, so a
// missing revision is not a 404. Null only when the row cannot be read.

export interface LiveComposed {
  page: PageRow;
  revision: { id: string; publishedAt: string; document: PageDocument } | null;
}

async function readLiveComposed(pattern: string): Promise<LiveComposed | null> {
  if (!isBettingConfigured()) return null;
  try {
    const pageRes = await betDb()
      .from('page')
      .select(PAGE_COLUMNS)
      .eq('application_key', PAGE_APPLICATION_KEY)
      .eq('path', pattern)
      .eq('kind', 'code')
      .is('deleted_at', null);
    if (pageRes.error) return null;
    const page = pageFromRow(((pageRes.data ?? []) as unknown[])[0]);
    if (!page || !page.id) return null;
    const rev = await betDb()
      .from('page_revision')
      .select('id, published_at, document')
      .eq('page_id', page.id)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1);
    if (rev.error) return { page, revision: null };
    const row = ((rev.data ?? []) as unknown[])[0] as { id?: unknown; published_at?: unknown; document?: unknown } | undefined;
    if (!row || typeof row.id !== 'string' || row.published_at == null) return { page, revision: null };
    return { page, revision: { id: row.id, publishedAt: String(row.published_at), document: parsePageDocument(row.document, await loadComponents()).value } };
  } catch {
    return null;
  }
}

/** The row of a page served from rows, with its live revision when it has one. Memoised per request. */
export const loadLiveComposed = cache(readLiveComposed);

export interface RevisionPreview {
  page: PageRow;
  revisionId: string;
  createdAt: string;
  publishedAt: string | null;
  /** Whether this revision is the one visitors see today. */
  isLive: boolean;
  document: PageDocument;
  problems: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** One revision of a row page by its id, draft or published, for Save and Run
 *  (Phase 3 step 6). Null when the id is not one, the revision or its page is
 *  missing, the page is not a row page, or on any failure. Memoised per request. */
export const loadRevisionPreview = cache(async function readRevisionPreview(revisionId: string): Promise<RevisionPreview | null> {
  if (!isBettingConfigured() || !UUID.test(revisionId)) return null;
  try {
    const rev = await betDb().from('page_revision').select('id, page_id, created_at, published_at, document').eq('id', revisionId);
    if (rev.error) return null;
    const row = ((rev.data ?? []) as unknown[])[0] as
      | { id?: unknown; page_id?: unknown; created_at?: unknown; published_at?: unknown; document?: unknown }
      | undefined;
    if (!row || typeof row.page_id !== 'string' || row.created_at == null) return null;
    // A deleted page has no preview either (P1.12); Reinstate brings both back.
    const pageRes = await betDb().from('page').select(PAGE_COLUMNS).eq('application_key', PAGE_APPLICATION_KEY).eq('id', row.page_id).is('deleted_at', null);
    if (pageRes.error) return null;
    const page = pageFromRow(((pageRes.data ?? []) as unknown[])[0]);
    // A row page, or a code page served from rows (R4.1): both render from a
    // revision. A route file's page has no preview; the site serves it.
    if (!page || !page.id || (page.kind !== 'row' && page.served !== 'rows')) return null;
    const live = await betDb()
      .from('page_revision')
      .select('id')
      .eq('page_id', page.id)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1);
    const liveId = live.error ? null : (((live.data ?? []) as { id?: unknown }[])[0]?.id ?? null);
    const parsed = parsePageDocument(row.document, await loadComponents());
    return {
      page,
      revisionId,
      createdAt: String(row.created_at),
      publishedAt: row.published_at != null ? String(row.published_at) : null,
      isLive: liveId === revisionId,
      document: parsed.value,
      problems: parsed.problems,
    };
  } catch {
    return null;
  }
});

/** The photos a document names, by id; one that is missing is left out and its
 *  region renders nothing. Empty on any failure. */
export async function loadAssetsById(ids: readonly string[]): Promise<Map<string, EditableAsset>> {
  const out = new Map<string, EditableAsset>();
  if (!isBettingConfigured() || ids.length === 0) return out;
  try {
    const { data, error } = await betDb()
      .from('asset')
      .select(ASSET_COLUMNS)
      .eq('application_key', ASSET_APPLICATION_KEY)
      .in('id', [...ids]);
    if (error) return out;
    for (const item of (data ?? []) as unknown[]) {
      const a = assetFromRow(item);
      if (a) out.set(a.id, a);
    }
    return out;
  } catch {
    return out;
  }
}
