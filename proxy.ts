import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Public-with-account: everything is public by default. Only user-scoped
// routes (prefs, push subscriptions, settings page) require a signed-in user.
const isProtected = createRouteMatcher([
  '/settings(.*)',
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
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
