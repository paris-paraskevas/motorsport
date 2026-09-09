import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { SITE_URL } from '@/lib/site';
import { loadAssetsById, loadLiveComposed, loadLivePage } from '@/lib/design/live-page';
import { loadShortcuts } from '@/lib/design/shortcuts';
import { loadDocumentLists, loadNavLists } from '@/lib/design/lists';
import { loadAuthzSchemes } from '@/lib/design/authz';
import { allowedKeys, currentVisitor } from '@/lib/design/authz-evaluate';
import { applyShow, documentRefs, schemesAsked, showAsks, substituteShortcuts, type PageDocument } from '@/lib/design/page-document';
import { raceWeekendNow, renderComponents } from '@/lib/design/component-render';
import { composedDocument, matchComposedPage } from '@/lib/design/composed-page';
import { familyExtras, familyMetadata } from '@/lib/design/page-families';
import { applyFrame } from '@/lib/design/page-frame';
import { registryPageRow, type PageRow } from '@/lib/design/pages';
import { CodePageFrame, RowPageView } from '@/components/page/RowPageView';
import { RefusedPage } from '@/components/page/RefusedPage';

// With two root layouts there is no shared segment to own a global 404, and
// Next 16's global-not-found.js is still experimental. Unmatched URLs fall
// through to this catch-all, which serves two kinds of page before it renders
// the branded (app) not-found page:
//
//  * a ROW PAGE made in the designer, at a literal path, from its published
//    revision (Phase 3 step 3);
//  * since the components programme (R4.1), a page whose ROUTE FILE HAS LEFT
//    the code: the registry marks it `served: 'rows'`, the address is matched
//    against its pattern (`/calendar`, later `/series/[slug]`), and the page
//    renders from its published revision's components, or from its default
//    composition (the registry's recipe) when nothing is published. Its title,
//    description, card and structured data come from its page family. The
//    row's `rendering` decides whether the page is cached or rendered per visit.
//
// The registry and the create route keep a row page from ever taking a path
// the code serves, so this file never shadows a real route file.
//
// A wholly public page is a cached render, refreshed every five minutes and at
// once when the designer publishes (revalidatePath). A page or a region that
// asks for an authorization scheme, or a show rule that needs the visitor,
// reads the session, which makes that path a per-request render; the
// evaluator fails closed.

export const revalidate = 300;

type Params = Promise<{ catchall: string[] }>;

function pathOf(parts: string[]): string {
  return `/${parts.join('/')}`;
}

/** What an address resolves to. */
type Resolved =
  | { kind: 'row'; page: PageRow; document: PageDocument }
  | { kind: 'composed'; page: PageRow; pattern: string; params: Record<string, string>; document: PageDocument }
  | null;

/** A row page with a live revision wins; then a page served from rows, whose
 *  row may be missing (the registry stands in) and whose revision may be
 *  missing (the default composition stands in); else nothing. Every read is
 *  memoised per request, so the metadata and the page share them. */
async function resolve(path: string): Promise<Resolved> {
  const live = await loadLivePage(path);
  if (live) return { kind: 'row', page: live.page, document: live.document };
  const hit = matchComposedPage(path);
  if (!hit) return null;
  const composed = await loadLiveComposed(hit.page.path);
  const page = composed?.page ?? registryPageRow(hit.page.path);
  if (!page) return null;
  return { kind: 'composed', page, pattern: hit.page.path, params: hit.params, document: composedDocument(composed?.revision?.document ?? null, hit.page.path) };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { catchall } = await params;
  const path = pathOf(catchall);
  const r = await resolve(path);
  if (!r) return {};
  if (r.kind === 'composed') {
    // The family's own metadata with the row's title and index rule over it, as the route file had it through pageMetadata.
    const own = await familyMetadata(r.pattern, r.params);
    const meta = applyFrame(own, { name: r.page.name, title: r.page.title, indexable: r.page.indexable, authz: r.page.authz });
    return { ...meta, alternates: meta.alternates ?? { canonical: `${SITE_URL}${path}` } };
  }
  const shortcuts = await loadShortcuts();
  const first = r.document.regions.find(x => x.kind === 'static' && x.text.trim());
  const description =
    first && first.kind === 'static'
      ? substituteShortcuts(first.text, shortcuts).replace(/\s+/g, ' ').trim().slice(0, 160) || undefined
      : undefined;
  const isPublic = !r.page.authz || r.page.authz === 'public';
  return {
    title: r.page.title ?? r.page.name,
    description,
    alternates: { canonical: `${SITE_URL}${r.page.path}` },
    robots: r.page.indexable && isPublic ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function CatchAll({ params }: { params: Params }) {
  const { catchall } = await params;
  const path = pathOf(catchall);
  const r = await resolve(path);
  if (!r) notFound();
  // A page the row says renders per visit opts this request out of the cache.
  if (r.page.rendering === 'dynamic') await connection();

  const asked = schemesAsked(r.page.authz, r.document);
  // A show rule that needs the session reads it like a scheme does (R2a); the
  // race-weekend fact is read when a rule asks for it.
  const asks = showAsks(r.document);
  let allowed = new Set<string>();
  let signedIn: boolean | null = null;
  const messages: Record<string, string | null> = {};
  if (asked.length > 0 || asks.visitor) {
    const [visitor, schemes] = await Promise.all([currentVisitor(), asked.length > 0 ? loadAuthzSchemes() : Promise.resolve([])]);
    signedIn = visitor.signedIn;
    allowed = asked.length > 0 ? allowedKeys(asked, schemes, visitor) : allowed;
    for (const key of asked) messages[key] = schemes.find(s => s.key === key)?.message ?? null;
    const pageScheme = r.page.authz && r.page.authz !== 'public' ? r.page.authz : null;
    if (pageScheme && !allowed.has(pageScheme)) {
      const message = messages[pageScheme];
      if (!message) notFound();
      const signInHelps = !visitor.signedIn && schemes.find(s => s.key === pageScheme)?.type !== 'public';
      return <RefusedPage title={r.page.title ?? r.page.name} message={message} signInHelps={signInHelps} />;
    }
  }
  const document = applyShow(r.document, { signedIn, raceWeekend: asks.calendar ? await raceWeekendNow() : null });

  const refs = documentRefs(document);
  const where = r.kind === 'composed' ? { path: r.pattern, params: r.params, page: r.page } : { path, params: {}, page: r.page };
  const [shortcuts, assets, nav, components] = await Promise.all([loadShortcuts(), loadAssetsById(refs.assets), loadNavLists(), renderComponents(document, where)]);
  const lists = await loadDocumentLists(refs.lists, nav);
  const d = { page: r.page, document, shortcuts, assets, nav, lists, allowed, messages, components };
  if (r.kind === 'row') return <RowPageView {...d} />;
  const extras = await familyExtras(r.pattern, r.params);
  return (
    <>
      {extras}
      <CodePageFrame d={d} />
    </>
  );
}
