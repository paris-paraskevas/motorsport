import { createSerwistRoute } from "@serwist/turbopack";

// Bundles app/sw.ts with esbuild and serves it (plus its sourcemap) at
// /serwist/<file>, with `Service-Worker-Allowed: /` so the worker controls the
// whole origin despite the nested URL. force-static: built once per deploy; in
// dev it rebuilds when app/sw.ts changes (registration stays dev-disabled in
// SerwistRegister regardless — the localhost stale-SW landmine). This replaces
// @serwist/next's webpack injection, the piece that forced `--webpack` builds
// since 80f8ed7 (2026-05-13).
export const { GET, dynamic, dynamicParams, revalidate, generateStaticParams } =
  createSerwistRoute({
    // Output naming derives from the entry basename: app/sw.ts → sw.js at the
    // project root → served as /serwist/sw.js (what SerwistRegister registers).
    swSrc: "app/sw.ts",
  });
