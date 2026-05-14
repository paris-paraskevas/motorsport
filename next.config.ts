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
};

export default withSerwist(nextConfig);
