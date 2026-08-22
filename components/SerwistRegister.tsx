'use client';

import { SerwistProvider } from '@serwist/turbopack/react';

// Registers the service worker served by app/serwist/[path]/route.ts — the
// explicit half of the @serwist/turbopack architecture that replaced
// @serwist/next's implicit webpack-injected registration. Rendered (self-closed,
// no children) once per root layout; the flags mirror the old withSerwistInit
// config exactly. Dev stays disabled: that was the old behavior, and a
// localhost SW serves months-stale chunks (session-26 landmine 0).
export function SerwistRegister() {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV === 'development'}
      // Explicitly FALSE, and it has to be explicit: the prop defaults to true
      // inside the package (`cacheOnNavigation = t3 === void 0 ? true : t3` in
      // dist/index.react.mjs), so deleting this line would leave the behaviour
      // switched on and fix nothing.
      //
      // Why it is off: with it on, the provider monkey-patches history.pushState
      // and passes the THIRD argument straight into messageSW → postMessage
      // (`cacheUrls(args[2])`). Next's App Router sometimes passes a `URL` there,
      // which is not structured-cloneable, so every /calendar visit threw
      // `DataCloneError: Failed to execute 'postMessage' on 'ServiceWorker'`
      // (re-confirmed on prod 2026-08-23 at 665 ms; the page's Best-Practices-92
      // finding in the PSI sweep).
      //
      // Nothing is lost by turning it off. Navigation caching only exists to
      // serve pages offline, and offline was removed deliberately in 0.268.0 —
      // so this has been throwing in exchange for a capability the site does not
      // have. `reloadOnOnline` is a separate flag and stays.
      cacheOnNavigation={false}
      reloadOnOnline
    />
  );
}
