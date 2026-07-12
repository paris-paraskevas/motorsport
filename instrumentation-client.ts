import * as Sentry from '@sentry/nextjs';

// Browser-runtime Sentry init. The DSN is public by design (it ships in the
// client bundle), hence the NEXT_PUBLIC_ var; when it's unset (local dev without
// it) the SDK initialises to a no-op. Scope is errors + tracing only — Session
// Replay is intentionally NOT enabled (it records user sessions, a privacy /
// consent decision the app's Consent Mode governs) and neither is log capture
// (avoid PII from console output). Both are easy follow-ups.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
});

// App Router client-navigation instrumentation (Next 16 / @sentry/nextjs v10).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
