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
      cacheOnNavigation
      reloadOnOnline
    />
  );
}
