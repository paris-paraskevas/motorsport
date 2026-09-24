import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import type { Account } from './client';

// The account seam's server half (PA A1a): the only server code that knows the provider. Every server file reads
// currentAccount() or accountId() here; A3 puts Supabase Auth behind the same two calls and no caller changes.

/** What the mapping reads of a Clerk user: a structural subset of @clerk/nextjs/server's User, so a test needs no class. */
export interface ClerkUserLike {
  id: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: { emailAddress: string }[];
  publicMetadata?: { role?: unknown; donor?: unknown } | null;
}

/** The Account of a Clerk user: the primary address (else the first); the full name, else first and last; a photo only when
 *  uploaded (Clerk's imageUrl is a generated placeholder otherwise, the rule lib/author-identity.ts learned); the role when
 *  a string; donor only when true. Exported for the test. */
export function accountFromClerkUser(u: ClerkUserLike | null | undefined): Account | null {
  if (!u) return null;
  const meta = u.publicMetadata ?? null;
  return {
    id: u.id,
    email: u.primaryEmailAddress?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress ?? null,
    name: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || null,
    username: u.username || null,
    imageUrl: u.hasImage ? u.imageUrl || null : null,
    role: typeof meta?.role === 'string' ? meta.role : null,
    donor: meta?.donor === true,
  };
}

/** The signed-in person, or null. */
export async function currentAccount(): Promise<Account | null> {
  return accountFromClerkUser(await currentUser());
}

/** The signed-in person's id alone, or null: the session's claim, cheaper than the whole account where only the id is read. */
export async function accountId(): Promise<string | null> {
  return (await auth()).userId ?? null;
}
