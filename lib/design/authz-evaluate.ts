import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { canAuthor } from '@/lib/threads';
import type { AuthzScheme } from './authz-defaults';

// The one evaluator for authorization schemes on the site (Phase 3 step 3,
// where a row page and its regions first require one). A scheme is a row (or
// one of the shipped four) with a type and a value; a visitor is what Clerk
// says about the session. Every check fails closed: a key that names no scheme,
// a role scheme with no value, an anonymous visitor asked for anything but
// public, all refuse.
//
// Reading the session is a request-time API, so the catch-all calls
// currentVisitor() only when the page or a region asks for a scheme other than
// public; a wholly public page stays a cached render.

export interface Visitor {
  signedIn: boolean;
  /** Clerk publicMetadata.role, when a string. */
  role: string | null;
  /** canAuthor's ladder: contributor, writer or admin. */
  author: boolean;
  emails: string[];
}

export const ANONYMOUS: Visitor = { signedIn: false, role: null, author: false, emails: [] };

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

/** The current visitor from Clerk's session; anonymous when there is none. */
export async function currentVisitor(): Promise<Visitor> {
  const user = await currentUser();
  if (!user) return ANONYMOUS;
  const role = user.publicMetadata && typeof user.publicMetadata.role === 'string' ? user.publicMetadata.role : null;
  return {
    signedIn: true,
    role,
    author: canAuthor(user),
    emails: user.emailAddresses.map(e => e.emailAddress),
  };
}
