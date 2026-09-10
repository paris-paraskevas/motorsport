import 'server-only';
import { loadLiveComposed, loadLivePage } from './live-page';
import { composedDocument, matchComposedPage } from './composed-page';
import { registryPageRow, type PageRow } from './pages';
import type { PageDocument } from './page-document';

// What an address resolves to, for the catch-all route and for the Debug trace
// (P1.9), so the two read one resolver: a row page with a live revision wins;
// then a page served from rows (R4.1), whose row may be missing (the registry
// stands in) and whose revision may be missing (the default composition stands
// in); else nothing. Every read is memoised per request, so a page's metadata
// and its body share them.

export type Resolved =
  | { kind: 'row'; page: PageRow; document: PageDocument }
  | { kind: 'composed'; page: PageRow; pattern: string; params: Record<string, string>; document: PageDocument }
  | null;

export async function resolvePage(path: string): Promise<Resolved> {
  const live = await loadLivePage(path);
  if (live) return { kind: 'row', page: live.page, document: live.document };
  const hit = matchComposedPage(path);
  if (!hit) return null;
  const composed = await loadLiveComposed(hit.page.path);
  const page = composed?.page ?? registryPageRow(hit.page.path);
  if (!page) return null;
  return { kind: 'composed', page, pattern: hit.page.path, params: hit.params, document: composedDocument(composed?.revision?.document ?? null, hit.page.path) };
}
