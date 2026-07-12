import * as Sentry from '@sentry/nextjs';

// Next.js server registration hook — loads the per-runtime Sentry init once at
// startup (stable since Next 14.0.4; we're on 16).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Captures unhandled server-side request errors (App Router). Requires
// @sentry/nextjs >= 8.28; we're on v10.
export const onRequestError = Sentry.captureRequestError;
