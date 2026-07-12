import * as Sentry from '@sentry/nextjs';

// Edge-runtime Sentry init (middleware / edge routes). Same DSN resolution as
// the server config; errors + tracing.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
});
