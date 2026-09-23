import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { SITE_URL } from '@/lib/site';
import { loadAssetsById } from '@/lib/design/live-page';
import { loadShortcuts } from '@/lib/design/shortcuts';
import { loadDocumentLists, loadNavLists } from '@/lib/design/lists';
import { loadAuthzSchemes } from '@/lib/design/authz';
import { allowedKeys, currentVisitor } from '@/lib/design/authz-evaluate';
import { applyBuildOptions, applyConditions, conditionAsks, documentRefs, schemesAsked, substituteShortcuts } from '@/lib/design/page-document';
import { loadNamedPages } from '@/lib/design/pages';
import { loadComponents } from '@/lib/design/definitions';
import { loadBuildOptions } from '@/lib/design/build-options';
import { loadAppearance } from '@/lib/design/appearance';
import { raceWeekendNow, renderComponents } from '@/lib/design/component-render';
import { resolvePage } from '@/lib/design/resolve-page';
import { VIEW_PREFIX, decodeSegment } from '@/lib/design/view-state';
import { familyExtras, familyMetadata } from '@/lib/design/page-families';
import { applyFrame } from '@/lib/design/page-frame';
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

const VIEW_SEGMENT = VIEW_PREFIX.slice(1);

/** The address the router matched: a plain path, or a cached variant `/__view/<state>/<path>` the middleware rewrote a page
 *  carrying a table's state to (P2.3). The state segment is base64url (the router hands a segment percent-encoded, so no
 *  escaped form is safe); decoded, it travels to the renderer as the canonical query, each region reading its own keys. ''
 *  for a plain address: a state may arrive here, so the controls draw. */
function addressOf(parts: string[]): { path: string; view: string; variant: boolean } {
  if (parts[0] === VIEW_SEGMENT) return { path: `/${parts.slice(2).join('/')}`, view: decodeSegment(parts[1] ?? '') ?? '', variant: true };
  return { path: `/${parts.join('/')}`, view: '', variant: false };
}

// The resolver lives in lib/design/resolve-page.ts since P1.9, so the Debug
// trace runs the same one this route runs.

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { catchall } = await params;
  const { path, variant } = addressOf(catchall);
  const r = await resolvePage(path);
  if (!r) return {};
  // A variant is never indexed; the plain address is its canonical.
  if (r.kind === 'composed') {
    // The family's own metadata with the row's title and index rule over it, as the route file had it through pageMetadata.
    const own = await familyMetadata(r.pattern, r.params);
    const meta = applyFrame(own, { name: r.page.name, title: r.page.title, indexable: r.page.indexable, authz: r.page.authz });
    return { ...meta, alternates: meta.alternates ?? { canonical: `${SITE_URL}${path}` }, ...(variant ? { robots: { index: false, follow: true } } : {}) };
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
    robots: r.page.indexable && isPublic && !variant ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function CatchAll({ params }: { params: Params }) {
  const { catchall } = await params;
  const { path, view } = addressOf(catchall);
  const r = await resolvePage(path);
  if (!r) notFound();
  // A page the row says renders per visit opts this request out of the cache.
  if (r.page.rendering === 'dynamic') await connection();

  const asked = schemesAsked(r.page.authz, r.document);
  // A condition that needs the session reads it like a scheme does (R2a); the
  // race-weekend fact is read when a condition asks for it.
  const asks = conditionAsks(r.document);
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
  // The conditions (P2.6) read the visited address and its parts for a composed page (never the pattern); then a region whose
  // Build Option is Excluded leaves the page, before its component is drawn (P1.3).
  const conditions = { signedIn, raceWeekend: asks.calendar ? await raceWeekendNow() : null, params: r.kind === 'composed' ? r.params : {}, path };
  const document = applyBuildOptions(applyConditions(r.document, conditions), await loadBuildOptions());

  const refs = documentRefs(document, await loadComponents());
  const where = r.kind === 'composed' ? { path: r.pattern, params: r.params, page: r.page } : { path, params: {}, page: r.page };
  // The templates' presets (P1.2) ride the appearance the layout already read (memoised).
  // The live row pages the buttons and go effects name (P1.12 B2) ride along; a page not live is drawn as nothing.
  // One read of the pages, shared with the renderer for the cards' zones (P2.2 B3); the render stays parallel with it.
  const namedPages = loadNamedPages(refs.dests);
  const [shortcuts, assets, nav, components, appearance, pages] = await Promise.all([loadShortcuts(), loadAssetsById(refs.assets), loadNavLists(), renderComponents(document, { ...where, pages: namedPages, href: path, view }), loadAppearance(), namedPages]);
  const lists = await loadDocumentLists(refs.lists, nav);
  const d = { page: r.page, document, shortcuts, assets, nav, lists, allowed, messages, components, templates: appearance.templates, pages };
  if (r.kind === 'row') return <RowPageView {...d} />;
  const extras = await familyExtras(r.pattern, r.params);
  return (
    <>
      {extras}
      <CodePageFrame d={d} />
    </>
  );
}
