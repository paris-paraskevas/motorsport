import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

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

export default clerkMiddleware(async (auth, req) => {
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
