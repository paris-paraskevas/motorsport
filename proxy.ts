import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { TABS } from '@/lib/tabs';

// Public-with-account: everything is public by default. Only user-scoped
// API routes require a signed-in user. The /settings PAGE went public in
// 0.24.0 (it's the Account surface — guests get device-local followed-series
// prefs and a sign-in CTA; every write that needs identity goes through the
// protected APIs below, so nothing user-scoped is reachable anonymously).
const isProtected = createRouteMatcher([
  '/api/user/(.*)',
  '/api/push/subscribe',
  '/api/push/unsubscribe',
  '/api/push/test',
  '/api/push/inspect',
]);

// B11: legacy query-param series tabs (/series/[slug]?tab=X) → path-based tabs
// (/series/[slug]/X), 308. The query is stripped so there's no stray param and
// no redirect loop; the calendar tab + any unknown tab collapse to the bare
// series path. Only fires on the one-segment /series/[slug] with a ?tab=
// present — internal links now use the path form, so this serves old / indexed
// / externally-shared URLs.
const SERIES_TAB_KEYS = new Set<string>(TABS.map(t => t.key).filter(k => k !== 'calendar'));
const SERIES_BARE_RE = /^\/series\/[^/]+$/;

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl;
  const legacyTab = url.searchParams.get('tab');
  if (legacyTab && SERIES_BARE_RE.test(url.pathname)) {
    const dest = url.clone();
    dest.searchParams.delete('tab');
    if (SERIES_TAB_KEYS.has(legacyTab)) dest.pathname = `${url.pathname}/${legacyTab}`;
    return NextResponse.redirect(dest, 308);
  }
  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals, the .well-known namespace (Digital Asset Links —
    // the matcher's js(?!on) deliberately lets .json through, so without this
    // skip Clerk would run on /.well-known/assetlinks.json), and all static files
    '/((?!_next|\\.well-known|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
