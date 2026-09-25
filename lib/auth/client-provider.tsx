'use client';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccountContext, hasSignedInCookie, type Account, type AccountStore } from './client';

// The account seam's provider (PA A1b; the site's own since A3), a module of its own that the two layouts alone import.
// It asks GET /api/account once after the page loads, and only when the flag cookie says a session exists; the answer
// (the account, its flags) is what useAccount and useAccountFlags read everywhere below.

interface Held {
  account: Account | null;
  flags: Record<string, unknown> | null;
  isLoaded: boolean;
}
const NOT_YET: Held = { account: null, flags: null, isLoaded: false };
const NOBODY: Held = { account: null, flags: null, isLoaded: true };

/** GET /api/account: the account and its flags, or nobody when the answer is a refusal or cannot be had. */
async function fetchAccount(): Promise<Held> {
  try {
    const res = await fetch('/api/account', { cache: 'no-store', credentials: 'same-origin' });
    const body = res.ok ? ((await res.json()) as { account?: Account | null; flags?: Record<string, unknown> | null }) : null;
    const account = body?.account ?? null;
    return { account, flags: account ? (body?.flags ?? {}) : null, isLoaded: true };
  } catch {
    return NOBODY;
  }
}

/** The provider around a host's tree, the same on both hosts. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [held, setHeld] = useState<Held>(NOT_YET);
  const refresh = useCallback(async () => {
    setHeld(await (hasSignedInCookie() ? fetchAccount() : Promise.resolve(NOBODY)));
  }, []);
  // The first answer, once the page has mounted: the state is set when the promise settles, never within the effect's
  // own run, and never after the provider has gone.
  useEffect(() => {
    let mounted = true;
    void (hasSignedInCookie() ? fetchAccount() : Promise.resolve(NOBODY)).then(next => {
      if (mounted) setHeld(next);
    });
    return () => {
      mounted = false;
    };
  }, []);
  const setFlag = useCallback(async (key: string, value: unknown) => {
    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ flags: { [key]: value } }),
    });
    if (!res.ok) throw new Error('The flag was not saved');
    const body = (await res.json()) as { flags?: Record<string, unknown> };
    setHeld(h => ({ ...h, flags: body.flags ?? { ...(h.flags ?? {}), [key]: value } }));
  }, []);
  const store = useMemo<AccountStore>(
    () => ({
      ...held,
      refresh,
      setFlag: held.account
        ? setFlag
        : async () => {
            throw new Error('signed out');
          },
    }),
    [held, refresh, setFlag],
  );
  return <AccountContext.Provider value={store}>{children}</AccountContext.Provider>;
}
