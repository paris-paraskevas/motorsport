import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

// Content-Security-Policy — FIRST PASS, REPORT-ONLY (security audit).
// Shipped as Content-Security-Policy-Report-Only so it can NEVER break the
// site: browsers evaluate it and log violations to the console but enforce
// nothing. The intent is to observe real violations in the field, tighten the
// directives until clean, and only THEN promote to the enforcing
// `Content-Security-Policy` header. Until then this is purely diagnostic.
//
// Origins reflect what the app actually loads (app/(app)/layout.tsx +
// components): Clerk (auth SDK + frontend API), Vercel Analytics/Speed-Insights,
// Google AdSense + GA/GTM, three.js/drei web workers (compiled from blob: URLs),
// and self. 'unsafe-inline'/'unsafe-eval' are intentionally permitted for now —
// Next.js injects inline bootstrap scripts and the layout ships inline gtag /
// consent <Script> blocks; nonce-based tightening is a later step once the
// report stream confirms what's in use.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // 'self' (not 'none') so the /admin heatmap overlay can frame our own pages to
  // paint the click overlay; still blocks cross-origin (clickjacking) framing.
  "frame-ancestors 'self'",
  "form-action 'self' https://*.clerk.accounts.dev https://clerk.paddock-tracker.com",
  // Scripts: self + inline/eval (Next bootstrap, inline gtag), Clerk, AdSense,
  // GA/GTM, Vercel scripts, and blob: for worker bootstrapping.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.clerk.accounts.dev https://clerk.paddock-tracker.com https://*.clerk.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://www.googletagmanager.com https://*.google-analytics.com https://www.google.com https://va.vercel-scripts.com",
  // Web workers (three.js/drei, serwist SW) load from self + blob:.
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // Styles: self + inline (Tailwind utilities, inline style attributes).
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Images: self + data/blob + https (Clerk avatars, F1/OpenF1 headshots, ad +
  // analytics pixels). Broad on purpose for a first pass.
  "img-src 'self' data: blob: https:",
  // XHR/fetch/websocket targets: self, Clerk, analytics, ad networks, and the
  // OpenF1 telemetry API. https: kept broad while observing.
  "connect-src 'self' https: wss://*.clerk.accounts.dev wss://clerk.paddock-tracker.com",
  // Frames: Clerk (auth widgets) + AdSense/DoubleClick. pagead2.googlesyndication.com
  // serves the ad-slot iframes; ep2.adtrafficquality.google is Google's ad-traffic
  // quality (spam/fraud) frame that AdSense injects alongside them.
  "frame-src 'self' https://*.clerk.accounts.dev https://clerk.paddock-tracker.com https://*.clerk.com https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.google.com https://pagead2.googlesyndication.com https://ep2.adtrafficquality.google",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Images: the Cloudflare Workers runtime has no built-in Next image optimizer,
  // so serve unoptimized (one component uses next/image). A Cloudflare Images
  // custom loader can be added later if optimization is wanted.
  images: { unoptimized: true },
  webpack(config, { dev }) {
    if (dev) {
      // Next's built-in dev-watch ignore list is ONLY node_modules/.git/.next
      // (next/dist/build/webpack-config.js baseWatchOptions), and the config
      // surface reads nothing but pollIntervalMs — so .open-next (330+ MB /
      // 3k+ files of OpenNext deploy artifacts) gets indexed by the file
      // watcher and every local deploy rewrites it under a running dev server.
      // `ignored` replaces the default wholesale, so restate it, then extend.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/.open-next/**"],
      };
    }
    return config;
  },
  async redirects() {
    // /social is the social hub; leagues have their own page at /social/leagues
    // (0.90.0). League detail + join keep their own routes. Old links — notably
    // already-shared invite links — keep working. join is two segments, so it
    // doesn't collide with the :id rule. NB: never add a /social → /social/leagues
    // (or the reverse) redirect — both are real pages; a cross-redirect would loop.
    return [
      { source: "/play/leagues", destination: "/social/leagues", permanent: true },
      { source: "/play/leagues/join/:token", destination: "/social/leagues/join/:token", permanent: true },
      { source: "/play/leagues/:id", destination: "/social/leagues/:id", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // SAMEORIGIN (not DENY) so the /admin heatmap overlay can frame our own
          // pages for the click overlay; cross-origin framing stays blocked.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()",
          },
          // Report-only first pass — observe violations before enforcing. See
          // the CSP_REPORT_ONLY note above for the promote-to-enforcing plan.
          {
            key: "Content-Security-Policy-Report-Only",
            value: CSP_REPORT_ONLY,
          },
        ],
      },
    ];
  },
};

// Sentry wraps the fully-composed config (Serwist included) so its build plugin
// sees the final webpack config. tunnelRoute is intentionally NOT set — the SDK
// posts directly to the Sentry ingest host, already allowed by the CSP's broad
// `connect-src https:`, so there's no proxy route to exclude from proxy.ts.
// Source-map upload runs only when SENTRY_AUTH_TOKEN is present (CI/operator);
// without it the build still succeeds, just with minified prod stack traces.
export default withSentryConfig(withSerwist(nextConfig), {
  org: "paddocktracker",
  project: "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  silent: !process.env.CI,
});
