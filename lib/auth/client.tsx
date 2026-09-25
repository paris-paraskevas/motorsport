'use client';
import { createContext, useContext, useMemo } from 'react';

// The account seam's browser half (PA A1b; over the site's own routes since A3): the hooks every browser file reads.
// The browser never talks to the provider: it learns who is signed in from GET /api/account, and asks only when the
// plain flag cookie (pd_signed_in, no credential in it) says a session exists, so an anonymous visitor makes no request.
// The provider (client-provider.tsx) holds the answer; the pieces (client-pieces.tsx) act on it.

/** A signed-in person as the site reads them, the same on the server (lib/auth/server.ts) and in the browser. */
export interface Account {
  /** The app's id for the person, the value every user column of every table holds: an imported account's Clerk id
   *  (its legacy id), a newer account's Supabase id. Never handed to the provider's admin calls as the provider's own id. */
  id: string;
  /** The primary address; null when the provider holds none. */
  email: string | null;
  /** The full name, else the one a provider sent; null when neither is set. */
  name: string | null;
  username: string | null;
  /** A photo the person uploaded, else the one their provider sent; null otherwise. */
  imageUrl: string | null;
  /** The role when set: admin, moderator, writer or contributor (lib/threads.ts reads the ladders). */
  role: string | null;
  /** The supporter flag an admin sets when a donation arrives. */
  donor: boolean;
}

export interface AccountState {
  /** The signed-in person; null before the answer has come and null signed out. */
  account: Account | null;
  /** Whether /api/account has answered (at once, without a request, when no session flag is set): a cached page's first
   *  render has not, so a piece that depends on the person waits for it rather than flashing the signed-out state. */
  isLoaded: boolean;
  isSignedIn: boolean;
  /** The picture to draw for the person: the photo, else null (the pieces draw initials then). */
  avatarUrl: string | null;
}

/** What the provider holds. */
export interface AccountStore {
  account: Account | null;
  /** The per-person flags the browser writes (the support prompt's opt-out, the announcement seen); null signed out. */
  flags: Record<string, unknown> | null;
  isLoaded: boolean;
  /** Ask /api/account again (after a sign-in or an edit on the same page). */
  refresh: () => Promise<void>;
  /** Merge one key into the flags and write; a failed write rejects and the caller keeps its local fallback. */
  setFlag: (key: string, value: unknown) => Promise<void>;
}

/** The flag cookie's name: the same value as lib/auth/supabase.ts SIGNED_IN_COOKIE (a server module this file cannot
 *  import); the test holds the two equal. */
export const SIGNED_IN_COOKIE = 'pd_signed_in';

/** Whether the flag cookie says a session exists. */
export function hasSignedInCookie(cookie: string = typeof document === 'undefined' ? '' : document.cookie): boolean {
  return cookie.split(';').some(part => {
    const [name, value] = part.trim().split('=');
    return name === SIGNED_IN_COOKIE && Boolean(value);
  });
}

/** One or two letters for a person without a photo: the name's initials, else the username's first, else the address's. */
export function initialsOf(account: Account | null | undefined): string {
  if (!account) return '';
  const words = (account.name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const fallback = account.username || account.email || '';
  return fallback.slice(0, 2).toUpperCase();
}

const NOBODY: AccountStore = {
  account: null,
  flags: null,
  isLoaded: false,
  refresh: async () => undefined,
  setFlag: async () => {
    throw new Error('signed out');
  },
};

/** The store, provided by AuthProvider; outside one nothing has loaded and nobody is signed in. */
export const AccountContext = createContext<AccountStore>(NOBODY);

/** The signed-in person in the browser. */
export function useAccount(): AccountState {
  const { account, isLoaded } = useContext(AccountContext);
  return useMemo(() => ({ account, isLoaded, isSignedIn: isLoaded && account !== null, avatarUrl: account?.imageUrl ?? null }), [account, isLoaded]);
}

/** The per-person flags the browser writes; null signed out. setFlag merges one key and writes through PATCH /api/account;
 *  a failed write rejects and the caller keeps its local fallback. */
export function useAccountFlags(): { flags: Record<string, unknown> | null; setFlag: (key: string, value: unknown) => Promise<void> } {
  const { flags, setFlag } = useContext(AccountContext);
  return { flags, setFlag };
}
