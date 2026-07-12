import * as Sentry from '@sentry/nextjs';

// Node.js server-runtime Sentry init. Reads SENTRY_DSN, falling back to the
// public DSN so a single env var (NEXT_PUBLIC_SENTRY_DSN) lights up all three
// runtimes. Errors + tracing; no log capture (PII). No-op when the DSN is unset.
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
});
