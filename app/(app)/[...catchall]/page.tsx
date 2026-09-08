import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/lib/site';
import { loadAssetsById, loadLivePage } from '@/lib/design/live-page';
import { loadShortcuts } from '@/lib/design/shortcuts';
import { loadNavLists } from '@/lib/design/lists';
import { loadAuthzSchemes } from '@/lib/design/authz';
import { allowedKeys, currentVisitor } from '@/lib/design/authz-evaluate';
import { documentRefs, schemesAsked, substituteShortcuts } from '@/lib/design/page-document';
import { RowPageView } from '@/components/page/RowPageView';
import { RefusedPage } from '@/components/page/RefusedPage';

// With two root layouts there is no shared segment to own a global 404, and
// Next 16's global-not-found.js is still experimental. Unmatched URLs fall
// through to this catch-all, which since Phase 3 step 3 first looks the path up
// among the row pages made in the designer: a page with a published revision is
// served from it, everything else renders the branded (app) not-found page as
// before. The registry (lib/design/page-registry.ts) and the create route keep
// a row page from ever taking a path the code serves, so this file never
// shadows a real route.
//
// A wholly public page is a cached render, refreshed every five minutes and at
// once when the designer publishes (revalidatePath). A page or a region that
// asks for an authorization scheme reads the visitor's session, which makes
// that path a per-request render; the evaluator fails closed.

export const revalidate = 300;

type Params = Promise<{ catchall: string[] }>;

function pathOf(parts: string[]): string {
  return `/${parts.join('/')}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { catchall } = await params;
  const live = await loadLivePage(pathOf(catchall));
  if (!live) return {};
  const shortcuts = await loadShortcuts();
  const first = live.document.regions.find(r => r.kind === 'static' && r.text.trim());
  const description =
    first && first.kind === 'static'
      ? substituteShortcuts(first.text, shortcuts).replace(/\s+/g, ' ').trim().slice(0, 160) || undefined
      : undefined;
  const isPublic = !live.page.authz || live.page.authz === 'public';
  return {
    title: live.page.title ?? live.page.name,
    description,
    alternates: { canonical: `${SITE_URL}${live.page.path}` },
    robots: live.page.indexable && isPublic ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function CatchAll({ params }: { params: Params }) {
  const { catchall } = await params;
  const live = await loadLivePage(pathOf(catchall));
  if (!live) notFound();

  const asked = schemesAsked(live.page.authz, live.document);
  let allowed = new Set<string>();
  const messages: Record<string, string | null> = {};
  if (asked.length > 0) {
    const [visitor, schemes] = await Promise.all([currentVisitor(), loadAuthzSchemes()]);
    allowed = allowedKeys(asked, schemes, visitor);
    for (const key of asked) messages[key] = schemes.find(s => s.key === key)?.message ?? null;
    const pageScheme = live.page.authz && live.page.authz !== 'public' ? live.page.authz : null;
    if (pageScheme && !allowed.has(pageScheme)) {
      const message = messages[pageScheme];
      if (!message) notFound();
      const signInHelps = !visitor.signedIn && schemes.find(s => s.key === pageScheme)?.type !== 'public';
      return <RefusedPage title={live.page.title ?? live.page.name} message={message} signInHelps={signInHelps} />;
    }
  }

  const refs = documentRefs(live.document);
  const [shortcuts, assets, nav] = await Promise.all([loadShortcuts(), loadAssetsById(refs.assets), loadNavLists()]);
  return (
    <RowPageView
      page={live.page}
      document={live.document}
      shortcuts={shortcuts}
      assets={assets}
      nav={nav}
      allowed={allowed}
      messages={messages}
    />
  );
}
