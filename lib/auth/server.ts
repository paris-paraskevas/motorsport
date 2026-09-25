import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Account } from './client';
import { authClient, isSessionCookie, nextCookieOptions, type SessionClaims } from './supabase';

// The account seam's server half (PA A1a, over Supabase Auth since A3): the only server code that knows the provider.
// Every server file reads currentAccount() or accountId() here; no caller changed at the switch.

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** What the mapping reads: a session's claims, or the provider's user record (the same four fields). */
export interface ClaimsLike {
  sub: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

/** The Account of a session's verified claims. The app id is the legacy id an imported account carries in app_metadata
 *  (Clerk's id, the value every user column holds), else the Supabase id; the name is the full name, else the one a
 *  provider sent; the photo is the one uploaded, else the provider's picture; the role when a string; donor only when true.
 *  app_metadata is written by the service role alone, so the role and the id are the server's word. */
export function accountFromClaims(claims: ClaimsLike | SessionClaims | null | undefined): Account | null {
  if (!claims || typeof claims.sub !== 'string' || claims.sub === '') return null;
  const app = claims.app_metadata ?? {};
  const user = claims.user_metadata ?? {};
  return {
    id: str(app.legacy_id) ?? claims.sub,
    email: str(claims.email),
    name: str(user.full_name) ?? str(user.name),
    username: str(user.username),
    imageUrl: str(user.avatar_url) ?? str(user.picture),
    role: str(app.role),
    donor: app.donor === true,
  };
}

/** The per-person flags the browser writes (user_metadata.flags): the support prompt's opt-out, the announcement seen. */
export function flagsFromClaims(claims: ClaimsLike | SessionClaims | null | undefined): Record<string, unknown> {
  const flags = claims?.user_metadata?.flags;
  return flags && typeof flags === 'object' && !Array.isArray(flags) ? (flags as Record<string, unknown>) : {};
}

/** The request's verified claims, once per render: null without a session cookie (Supabase is never called for an
 *  anonymous request), null when the token neither verifies nor refreshes. A Server Component cannot write cookies, and
 *  need not: the middleware refreshed the session before the render; a route handler's write goes through. */
export const currentClaims = cache(async (): Promise<SessionClaims | null> => {
  const store = await cookies();
  const all = store.getAll();
  if (!all.some(c => isSessionCookie(c.name))) return null;
  const supabase = authClient({
    cookies: {
      getAll: () => all.map(({ name, value }) => ({ name, value })),
      setAll: list => {
        try {
          for (const c of list) store.set(c.name, c.value, nextCookieOptions(c.options));
        } catch {
          /* read-only in a Server Component */
        }
      },
    },
  });
  try {
    const { data } = await supabase.auth.getClaims();
    return data?.claims ?? null;
  } catch {
    return null;
  }
});

/** The signed-in person, or null. */
export async function currentAccount(): Promise<Account | null> {
  return accountFromClaims(await currentClaims());
}

/** The signed-in person's id alone, or null. */
export async function accountId(): Promise<string | null> {
  return (await currentAccount())?.id ?? null;
}
