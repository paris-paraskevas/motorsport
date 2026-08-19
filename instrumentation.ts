// Next.js server registration hook. Server-side Sentry was removed in the
// 0.288.0 worker-size diet (operator-approved): its runtime was ~1.4 MB of a
// worker bundle that sat over Cloudflare's hard 10 MiB (gzip) script limit and
// blocked every deploy since 0.275.0. Browser-side Sentry
// (instrumentation-client.ts) still reports client errors. Reinstate server
// capture only alongside a bundle-size budget check.
export async function register() {}
