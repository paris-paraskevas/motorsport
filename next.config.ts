import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

// Serwist moved from @serwist/next (webpack-only injection; the reason builds
// were pinned to --webpack since 80f8ed7) to @serwist/turbopack: the SW is
// bundled + served by app/serwist/[path]/route.ts, registered by
// components/SerwistRegister.tsx, and this wrapper only adds esbuild to
// serverExternalPackages. The old swSrc/swDest/flags live on those two files.

// Content-Security-Policy — ENFORCING since 0.334.17 (operator decision,
// 2026-08-24). It rode as Content-Security-Policy-Report-Only from the
// 2026-06-11 security audit until the report stream came back clean, which is
// the promotion this header was always waiting for. Enforcing means a wrong
// directive BREAKS the page rather than logging: anything added below is a
// production change and wants watching, not a drive-by.
//
// Origins reflect what the app actually loads (app/(app)/layout.tsx +
// components): Clerk (auth SDK + frontend API),
// Google AdSense + GA/GTM, three.js/drei web workers (compiled from blob: URLs),
// and self. 'unsafe-inline'/'unsafe-eval' are intentionally permitted for now —
// Next.js injects inline bootstrap scripts and the layout ships inline gtag /
// consent <Script> blocks; nonce-based tightening is a later step once the
// report stream confirms what's in use.
//
// TWO THINGS THE REPORT STREAM FOUND (read off prod 2026-08-23), both now settled:
//
//  1. `static.cloudflareinsights.com` — Cloudflare Web Analytics, injected into
//     the HTML at the edge rather than by our code, which is why no grep of this
//     repo finds it. Cloudflare's own docs say a CSP has to allow it. Added
//     below, because we want it: it is cookieless and it is our traffic data.
//
//  2. `fundingchoicesmessages.google.com` — Google Funding Choices, pulled in by
//     adsbygoogle.js, NOT by us. DELIBERATELY NOT ALLOW-LISTED, and now that the
//     header enforces, it is genuinely blocked. That is the decision, made on
//     purpose rather than inherited: our own consent modal has owned consent
//     since 0.12.6, and a second competing consent UI from Google is not wanted.
//     Do NOT "fix" a Funding Choices console error by adding the origin here —
//     that silently reverses an operator decision. If Google's consent UI is ever
//     wanted, that is a product call first and a CSP edit second.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // 'self' (not 'none') so the /admin heatmap overlay can frame our own pages to
  // paint the click overlay; still blocks cross-origin (clickjacking) framing.
  "frame-ancestors 'self'",
  "form-action 'self' https://*.clerk.accounts.dev https://clerk.paddock-tracker.com",
  // Scripts: self + inline/eval (Next bootstrap, inline gtag), Clerk, AdSense,
  // GA/GTM, Cloudflare Web Analytics, and blob: for worker bootstrapping.
  //
  // `*.adtrafficquality.google` is REQUIRED and was found by enforcing the policy
  // locally before shipping it: AdSense's show_ads_impl loads
  // `ep2.adtrafficquality.google/sodar/sodar2.js`, Google's invalid-traffic
  // detection. The origin was already trusted in `frame-src` but never in
  // `script-src`, so report-only never surfaced it and enforcing blocked the
  // script outright. Wildcarded rather than pinned to ep2 because Google rotates
  // the endpoint number, and a rotation would break ad serving again.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.clerk.accounts.dev https://clerk.paddock-tracker.com https://*.clerk.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://www.googletagmanager.com https://*.google-analytics.com https://www.google.com https://static.cloudflareinsights.com https://*.adtrafficquality.google",
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
  // The `webpack` block below is dev-only (`next dev --webpack`); builds run
  // Turbopack. Next 16 hard-errors on a webpack config with no turbopack one
  // (the Sentry wrapper used to mask this) — an explicit empty turbopack
  // config states the coexistence is intentional.
  turbopack: {},
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
      // Session-27 consolidation: /play folded into the /social hub (its body is
      // the Predictions section there) and the threads LIST moved under it.
      // /threads/:id detail pages stay where they are — deep links must survive.
      { source: "/play", destination: "/social", permanent: true },
      { source: "/threads", destination: "/social/threads", permanent: true },
      // The home page moved from /app to the site root in 0.334.42, when the
      // separate marketing landing was retired (operator: "i have a big issue
      // with the existence of the landing page now the home page is better").
      // Permanent, because /app was in the sitemap, is the PWA's old start_url,
      // and is bookmarked — every one of those has to keep working.
      { source: "/app", destination: "/", permanent: true },
      // The console is retired (operator, 2026-09-09 ~01:45Z, looking at it on
      // dev.paddock-tracker.com: "im confident i only want to keep the
      // designer"). The designer at /admin/designer is the admin area; the old
      // sections and their 0.334.71 predecessors all land there, so the links
      // ALREADY SENT (the author-application and contributor-submission emails
      // carry absolute /admin/... URLs) and every bookmark still open something.
      // Temporary (307), not permanent: the section pages still exist in the
      // tree until the operator approves their deletion, and a 308 would sit in
      // browser caches if a section had to come back.
      { source: "/admin", destination: "/admin/designer", permanent: false },
      { source: "/admin/:section(content|audience|traffic|system|site|users|submissions|behaviour|home)", destination: "/admin/designer", permanent: false },
      { source: "/admin/:section(content|audience|traffic|system|site|users|submissions|behaviour|home)/:path*", destination: "/admin/designer", permanent: false },
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
          // ENFORCING. A wrong directive here takes pages down rather than
          // logging a warning — see the CSP note above before editing it.
          {
            key: "Content-Security-Policy",
            value: CSP,
          },
        ],
      },
    ];
  },
};

// Sentry's build wrapper (and the server SDK) came off in 0.288.0
// (operator-approved worker-size diet): the server runtime alone was ~1.4 MB
// of a bundle Cloudflare rejects above 10 MiB gzipped — every deploy since
// 0.275.0 failed on exactly that. Browser errors still report via
// instrumentation-client.ts (the client SDK ships in the browser bundle, not
// the worker).
export default withSerwist(nextConfig);
