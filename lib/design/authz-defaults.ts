// Authorization schemes (APEX: Authorization Schemes): the named rules a list
// entry, a box, a button or a page can require before a visitor sees it. The
// four the site ships, with how each check is made, and what the editor and the
// lists' select need to describe them. Client-safe: the designer's editors read
// this, the server loader (authz.ts) falls back to it.
//
// Nothing enforces a scheme yet: the shell shows every navigation entry to
// everyone, and pages and boxes arrive with Phase 3, where one evaluator will
// serve them all. Until then a scheme's label and message change nothing a
// visitor sees, and the editor says so.

export const AUTHZ_TYPES = ['public', 'signed_in', 'role', 'author', 'email_domain'] as const;
export type AuthzType = (typeof AUTHZ_TYPES)[number];

export interface AuthzScheme {
  key: string;
  label: string;
  /** How the check is made: public (no check), signed_in (any Clerk session),
   *  role (Clerk publicMetadata.role equals `value`), author (an approved writer),
   *  email_domain (the session's email ends with `value`). */
  type: AuthzType;
  value: string | null;
  /** What a refused visitor reads; null shows nothing. */
  message: string | null;
}

/** The rows migration 20260908090000 seeded, and the fallback when the table
 *  cannot be read. */
export const DEFAULT_AUTHZ_SCHEMES: readonly AuthzScheme[] = [
  { key: 'public', label: 'Public', type: 'public', value: null, message: null },
  { key: 'signed_in', label: 'Signed in', type: 'signed_in', value: null, message: 'Sign in to see this.' },
  { key: 'contributor', label: 'Contributor', type: 'author', value: null, message: 'For approved writers.' },
  { key: 'administrator', label: 'Administrator', type: 'role', value: 'admin', message: null },
];

/** A label is a name, a message is one sentence to a refused visitor. */
export const AUTHZ_LABEL_MAX = 60;
export const AUTHZ_MESSAGE_MAX = 200;

export function isAuthzType(value: unknown): value is AuthzType {
  return typeof value === 'string' && (AUTHZ_TYPES as readonly string[]).includes(value);
}

/** The check in plain words, for the editor's read-only column. */
export function describeAuthzCheck(scheme: Pick<AuthzScheme, 'type' | 'value'>): string {
  switch (scheme.type) {
    case 'public':
      return 'everyone';
    case 'signed_in':
      return 'any signed-in account';
    case 'role':
      return `account role is “${scheme.value ?? ''}”`;
    case 'author':
      return 'an approved writer';
    case 'email_domain':
      return `email ends with “${scheme.value ?? ''}”`;
  }
}

/** What a navigation entry's authorization select offers: unset (everyone)
 *  first under the public scheme's label, then every scheme that asks for
 *  something. A stored `public` key and an unset entry mean the same thing. */
export function authzOptions(schemes: readonly AuthzScheme[]): { key: string; label: string }[] {
  const everyone = schemes.find(s => s.type === 'public');
  return [
    { key: '', label: everyone?.label ?? 'Public' },
    ...schemes.filter(s => s.type !== 'public').map(s => ({ key: s.key, label: s.label })),
  ];
}
