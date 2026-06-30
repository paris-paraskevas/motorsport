import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

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
  "frame-ancestors 'none'",
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
  // Frames: Clerk (auth widgets) + AdSense/DoubleClick.
  "frame-src 'self' https://*.clerk.accounts.dev https://clerk.paddock-tracker.com https://*.clerk.com https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.google.com",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // node-ical references BigInt in a way webpack can't statically analyze
  // (mangles it during RSC bundling -> TypeError: g.BigInt is not a function).
  // Marking it external keeps the package as a runtime require, and the build
  // ships it inside the function bundle via outputFileTracingIncludes below.
  serverExternalPackages: ["node-ical"],
  // Force node-ical's transitive deps that Next.js can't statically trace
  // (because node-ical is external) into every function bundle. Without this,
  // Vercel's runtime errors with "Cannot find module 'temporal-polyfill'".
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/node-ical/**/*",
      "./node_modules/temporal-polyfill/**/*",
      "./node_modules/rrule/**/*",
      "./node_modules/luxon/**/*",
      "./node_modules/moment-timezone/**/*",
      "./node_modules/moment/**/*",
    ],
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
          { key: "X-Frame-Options", value: "DENY" },
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

export default withSerwist(nextConfig);
