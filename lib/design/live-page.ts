import 'server-only';
import { cache } from 'react';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { PAGE_APPLICATION_KEY, PAGE_COLUMNS, pageFromRow, type PageRow } from './pages';
import { ROW_PAGE_PATH, parsePageDocument, type PageDocument } from './page-document';
import { ASSET_APPLICATION_KEY, ASSET_COLUMNS, assetFromRow, type EditableAsset } from './assets';

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
      .eq('kind', 'row');
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
    return { page, revisionId: row.id, publishedAt: String(row.published_at), document: parsePageDocument(row.document).value };
  } catch {
    return null;
  }
}

/** The live row page at a literal path, or null. Memoised per request. */
export const loadLivePage = cache(readLivePage);

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
