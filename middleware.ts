import { NextResponse, type NextRequest } from 'next/server';
import { TABS } from '@/lib/tabs';
import { topicForSeries, aboutGuideForSeries } from '@/lib/information/topics';
import { calendarLegacySearch, rewriteTarget } from '@/lib/design/view-state';
import { authClient, clientIp, hasSessionCookie, requestJar, type SessionClaims } from '@/lib/auth/supabase';

// Public-with-account: everything is public by default. Only user-scoped API routes require a signed-in person. The
// /settings PAGE went public in 0.24.0 (it's the Account surface — guests get device-local followed-series prefs and a
// sign-in CTA; every write that needs identity goes through the protected APIs below, so nothing user-scoped is
// reachable anonymously). Since PA A3 the session is Supabase Auth's, read here first: a request carrying the session
// cookie gets its token verified (locally, once the project signs with an asymmetric key) and refreshed when expired,
// and the refreshed cookies ride on the request downstream and on whichever response leaves; a request without the
// cookie never reaches Supabase.
const PROTECTED = [/^\/api\/user\//, /^\/api\/push\/(subscribe|unsubscribe|test|inspect)$/];
const isProtected = (pathname: string) => PROTECTED.some(re => re.test(pathname));

// B11: legacy query-param series tabs (/series/[slug]?tab=X) → path-based tabs
// (/series/[slug]/X), 308. The query is stripped so there's no stray param and
// no redirect loop; the calendar tab + any unknown tab collapse to the bare
// series path. Only fires on the one-segment /series/[slug] with a ?tab=
// present — internal links now use the path form, so this serves old / indexed
// / externally-shared URLs.
const SERIES_TAB_KEYS = new Set<string>(TABS.map(t => t.key).filter(k => k !== 'calendar'));
const SERIES_BARE_RE = /^\/series\/[^/]+$/;
// IA restructure: the series History tab moved to the /information hub as a
// guide page; 308-redirect the old /series/<slug>/history URL to it.
const SERIES_HISTORY_RE = /^\/series\/([^/]+)\/history$/;
// IA restructure Phase C: the series About tab moved to the /information "what
// is <series>?" guide; 308-redirect the old /series/<slug>/about URL to it.
// aboutGuideForSeries returns null for any series without a guide (tab stays).
const SERIES_ABOUT_RE = /^\/series\/([^/]+)\/about$/;

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  // The prod hosts answer on one address over https (R13, the SEO check of 2026-09-27: plain http and www both answered 200):
  // a 301 to the apex over https, the path and the query kept, before the session is read. The host by exact equality alone:
  // the dev and testing hosts run this middleware on Workers of their own and are never redirected, nor is localhost.
  if (url.hostname === 'www.paddock-tracker.com' || (url.hostname === 'paddock-tracker.com' && url.protocol === 'http:')) {
    const dest = url.clone();
    dest.protocol = 'https:';
    dest.hostname = 'paddock-tracker.com';
    dest.port = '';
    return NextResponse.redirect(dest, 301);
  }
  const jar = requestJar(req);
  let claims: SessionClaims | null = null;
  if (hasSessionCookie(req)) {
    try {
      const { data } = await authClient({ cookies: jar, ip: clientIp(req) }).auth.getClaims();
      claims = data?.claims ?? null;
    } catch {
      claims = null;
    }
  }
  // The request's headers carry the refreshed cookie (requestJar wrote it there) into a rewrite or a pass-through, and
  // finish() puts each cookie in its own Set-Cookie on every response kind that leaves here.
  const forward = { request: { headers: req.headers } };
  const finish = <T extends NextResponse>(res: T): T => jar.finish(res);

  const legacyTab = url.searchParams.get('tab');
  if (legacyTab && SERIES_BARE_RE.test(url.pathname)) {
    const dest = url.clone();
    dest.searchParams.delete('tab');
    if (SERIES_TAB_KEYS.has(legacyTab)) dest.pathname = `${url.pathname}/${legacyTab}`;
    return finish(NextResponse.redirect(dest, 308));
  }
  const histMatch = SERIES_HISTORY_RE.exec(url.pathname);
  if (histMatch) {
    const slug = histMatch[1];
    const dest = url.clone();
    dest.pathname = `/information/${topicForSeries(slug)}/the-history-of-${slug}`;
    dest.search = '';
    return finish(NextResponse.redirect(dest, 308));
  }
  const aboutMatch = SERIES_ABOUT_RE.exec(url.pathname);
  if (aboutMatch) {
    const guide = aboutGuideForSeries(aboutMatch[1]);
    if (guide) {
      const dest = url.clone();
      dest.pathname = guide;
      dest.search = '';
      return finish(NextResponse.redirect(dest, 308));
    }
  }
  // dev.paddock-tracker.com is the admin/dev surface — auth-locked. Anonymous visitors are sent to sign in; a signed-in
  // person whose role is not admin gets 403 (the role rides in app_metadata, which the service role alone writes, so the
  // lock fails closed: no claim, no entry); the root serves the designer (the console it used to serve was retired on
  // 2026-09-09; the designer is the admin area). Auth pages are exempt (no redirect loop).
  const host = req.headers.get('host') ?? '';
  // The sign-in pages and the routes they post to (R10: with the site's own sign-in the routes live on this host too, and
  // the lock redirected the sign-in itself), and the account's own routes, which answer by session.
  const signInPath =
    url.pathname.startsWith('/sign-in') ||
    url.pathname.startsWith('/sign-up') ||
    url.pathname.startsWith('/api/auth/') ||
    url.pathname === '/api/account' ||
    url.pathname.startsWith('/api/account/');
  if (host.startsWith('dev.') && !signInPath) {
    if (!claims) {
      const signIn = url.clone();
      signIn.pathname = '/sign-in';
      signIn.search = `next=${encodeURIComponent(url.pathname + url.search)}`;
      return finish(NextResponse.redirect(signIn));
    }
    if (claims.app_metadata?.role !== 'admin') {
      return finish(new NextResponse('Admins only.', { status: 403 }));
    }
    if (url.pathname === '/') {
      const dest = url.clone();
      dest.pathname = '/admin/designer';
      return finish(NextResponse.rewrite(dest, forward));
    }
    // dev.* is the ADMIN surface only: anything that is not an /admin route, an
    // API (admin endpoints + the data the heatmap-framed pages fetch), or a
    // heatmap overlay frame (?hm=1, which iframes real site pages same-origin)
    // 404s — e.g. dev.paddock-tracker.com/app must NOT serve the public app.
    if (
      !url.pathname.startsWith('/admin') &&
      !url.pathname.startsWith('/api/') &&
      url.searchParams.get('hm') !== '1'
    ) {
      return finish(new NextResponse('Not found', { status: 404 }));
    }
  }

  // REMOVED in 0.334.42, and removing it was mandatory rather than tidy. This
  // block existed to skip the marketing landing for signed-in visitors: `/` ->
  // `/app`. The landing is gone and `/` IS the home page now, while `/app` 301s
  // to `/` (next.config.ts) — so leaving this in place would have sent every
  // signed-in visitor round an infinite redirect: / -> /app -> / -> /app.
  //
  // Nothing replaces it. One home page for everyone, signed in or not, which is
  // also what keeps that page ISR-cacheable.

  // P2.3: a page carrying a table's state (sort, cols, filter, view) is served from its cached variant under
  // /__view/<state>/<path>; the address bar keeps the plain form. A route the code serves and the reserved parts of the site
  // keep their own query strings (lib/design/view-state.ts rewriteTarget).
  // P2.5 PR B: the calendar's old addresses (?s=<slugs>&races=1, its filter box's deep links) become the Filters region's
  // state, so a bookmarked or shared link keeps narrowing and is served from the same variant the new address would be.
  const target = rewriteTarget(url.pathname, url.pathname === '/calendar' ? calendarLegacySearch(url.searchParams) : url.search);
  if (target) {
    const dest = url.clone();
    dest.pathname = target;
    return finish(NextResponse.rewrite(dest, forward));
  }

  // A user-scoped API without a session answers 404, as the provider's protect() did before the switch.
  if (isProtected(url.pathname) && !claims) {
    return finish(new NextResponse('Not found', { status: 404 }));
  }
  return finish(NextResponse.next(forward));
}

export const config = {
  matcher: [
    // Skip Next.js internals, the .well-known namespace (Digital Asset Links —
    // the matcher's js(?!on) deliberately lets .json through, so without this
    // skip the session read would run on /.well-known/assetlinks.json), and all static files
    '/((?!_next|\\.well-known|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
