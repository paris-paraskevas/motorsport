import { canAuthor } from '@/lib/threads';
import type { AuthzScheme } from './authz-defaults';

// The check behind every authorization scheme, client-safe (Phase 3 step 4).
// A scheme is a row (or one of the shipped four) with a type and a value; a
// visitor is what Clerk says about the session, on the server (authz-evaluate.ts
// reads it) or in the browser (visitorFromClerkUser from useUser()). Every check
// fails closed: a key that names no scheme, a role scheme with no value, an
// anonymous visitor asked for anything but public, all refuse. One rule for a
// page, its regions and the navigation lists.

export interface Visitor {
  signedIn: boolean;
  /** Clerk publicMetadata.role, when a string. */
  role: string | null;
  /** canAuthor's ladder: contributor, writer or admin. */
  author: boolean;
  emails: string[];
}

export const ANONYMOUS: Visitor = { signedIn: false, role: null, author: false, emails: [] };

/** The shape of a Clerk user this needs, the same on the server and in the browser. */
export interface ClerkUserLike {
  publicMetadata?: { role?: unknown } | null;
  emailAddresses?: { emailAddress: string }[];
}

/** A visitor from a Clerk user; anonymous when there is none. */
export function visitorFromClerkUser(user: ClerkUserLike | null | undefined): Visitor {
  if (!user) return ANONYMOUS;
  const role = user.publicMetadata && typeof user.publicMetadata.role === 'string' ? user.publicMetadata.role : null;
  return {
    signedIn: true,
    role,
    author: canAuthor({ publicMetadata: user.publicMetadata ?? undefined }),
    emails: (user.emailAddresses ?? []).map(e => e.emailAddress),
  };
}

/** Whether a visitor passes one scheme. Undefined (no such scheme) fails. */
export function passes(scheme: AuthzScheme | undefined, visitor: Visitor): boolean {
  if (!scheme) return false;
  switch (scheme.type) {
    case 'public':
      return true;
    case 'signed_in':
      return visitor.signedIn;
    case 'role':
      return visitor.signedIn && scheme.value !== null && visitor.role === scheme.value;
    case 'author':
      return visitor.signedIn && visitor.author;
    case 'email_domain': {
      if (!visitor.signedIn || scheme.value === null) return false;
      const suffix = scheme.value.toLowerCase();
      return visitor.emails.some(e => e.toLowerCase().endsWith(suffix));
    }
  }
}

/** The scheme keys, among those asked for, that the visitor passes. `public`
 *  passes without a row, so a page or region asking for it is never refused. */
export function allowedKeys(asked: Iterable<string>, schemes: readonly AuthzScheme[], visitor: Visitor): Set<string> {
  const out = new Set<string>();
  for (const key of asked) {
    if (key === 'public' || passes(schemes.find(s => s.key === key), visitor)) out.add(key);
  }
  return out;
}

/** Whether an entry, region or page asking for `authz` may be shown: unset or
 *  public always, otherwise the scheme's check. */
export function mayShow(authz: string | null | undefined, schemes: readonly AuthzScheme[], visitor: Visitor): boolean {
  if (!authz || authz === 'public') return true;
  return passes(schemes.find(s => s.key === authz), visitor);
}
