'use client';

import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

// Lightweight client-side auth check for the landing, which is deliberately
// cookieless + Clerk-SDK-free (see the marketing layout). Clerk sets a readable
// `__client_uat` cookie — 0 = signed out, a unix timestamp > 0 = signed in — so
// the static landing can hide signed-out-only CTAs (e.g. "Sign in") without
// pulling in the Clerk SDK or setting any cookie itself.

const subscribe = () => () => {}; // the cookie is stable for the page's life

function readSignedIn(): boolean {
  const m = document.cookie.match(/(?:^|;\s*)__client_uat=(\d+)/);
  return m ? Number(m[1]) > 0 : false;
}

// useSyncExternalStore reads the cookie hydration-safely: the server snapshot is
// signed-OUT (so the static HTML stays stable and signed-out visitors — the vast
// majority on a marketing page — get no flash), and the client snapshot reads
// `__client_uat`. A signed-in visitor flips after hydration. No effect-setState.
export function useSignedIn(): boolean {
  return useSyncExternalStore(subscribe, readSignedIn, () => false);
}

/** Renders children only for signed-OUT visitors. */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  return useSignedIn() ? null : <>{children}</>;
}

/** Renders children only for signed-IN visitors. */
export function SignedInOnly({ children }: { children: ReactNode }) {
  return useSignedIn() ? <>{children}</> : null;
}
