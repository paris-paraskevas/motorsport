import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

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
    // Friends + leagues now live on one /social page; league detail + join keep
    // their own routes. Old links — notably already-shared invite links — keep
    // working. join is two segments, so it doesn't collide with the :id rule.
    // NB: do NOT redirect /social itself — it's a real page now, and the league
    // list route redirects /social/leagues → /social, so a /social → /social/leagues
    // rule here would form an infinite 307 loop (the 0.74.0 regression).
    return [
      { source: "/play/leagues", destination: "/social", permanent: true },
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
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
