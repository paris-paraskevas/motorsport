import { canAuthor } from '@/lib/threads';
import type { Account } from '@/lib/auth/client';
import type { AuthzScheme } from './authz-defaults';

// The check behind every authorization scheme, client-safe (Phase 3 step 4).
// A scheme is a row (or one of the shipped four) with a type and a value; a
// visitor is what the account says about the session, on the server (authz-evaluate.ts
// reads it through lib/auth) or in the browser (useVisitor, through useAccount). Every check
// fails closed: a key that names no scheme, a role scheme with no value, an
// anonymous visitor asked for anything but public, all refuse. One rule for a
// page, its regions and the navigation lists.

export interface Visitor {
  signedIn: boolean;
  /** The account's role, when set. */
  role: string | null;
  /** canAuthor's ladder: contributor, writer or admin. */
  author: boolean;
  emails: string[];
}

export const ANONYMOUS: Visitor = { signedIn: false, role: null, author: false, emails: [] };

/** A visitor from an account (lib/auth; PA A1a); anonymous when there is none. */
export function visitorFromAccount(account: Account | null | undefined): Visitor {
  if (!account) return ANONYMOUS;
  return { signedIn: true, role: account.role, author: canAuthor(account), emails: account.email ? [account.email] : [] };
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
