import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Anything matching `isPublic` skips the auth gate.
// Everything else requires a signed-in user.
const isPublic = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/cron/(.*)',
  '/api/push/status',
  '/api/contact',
  '/manifest.json',
  '/opengraph-image(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
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
