import { describe, expect, it } from 'vitest';
import { ANONYMOUS, allowedKeys, mayShow, passes, visitorFromAccount, type Visitor } from './authz-check';
import { DEFAULT_AUTHZ_SCHEMES } from './authz-defaults';

const reader: Visitor = { signedIn: true, role: null, author: false, emails: ['fan@example.com'] };
const writer: Visitor = { signedIn: true, role: 'contributor', author: true, emails: ['w@paddock-tracker.com'] };
const admin: Visitor = { signedIn: true, role: 'admin', author: true, emails: ['ops@paddock-tracker.com'] };
const scheme = (key: string) => DEFAULT_AUTHZ_SCHEMES.find(s => s.key === key);

describe('passes', () => {
  it('lets everyone through public, needs a session for signed_in, the ladder for author, the exact role for role', () => {
    expect(passes(scheme('public'), ANONYMOUS)).toBe(true);
    expect(passes(scheme('signed_in'), ANONYMOUS)).toBe(false);
    expect(passes(scheme('signed_in'), reader)).toBe(true);
    expect(passes(scheme('contributor'), reader)).toBe(false);
    expect(passes(scheme('contributor'), writer)).toBe(true);
    expect(passes(scheme('administrator'), writer)).toBe(false);
    expect(passes(scheme('administrator'), admin)).toBe(true);
  });

  it('fails closed on no scheme, a role scheme without a value, and matches an email domain case-insensitively', () => {
    expect(passes(undefined, admin)).toBe(false);
    expect(passes({ key: 'x', label: 'x', type: 'role', value: null, message: null }, admin)).toBe(false);
    const staff = { key: 'staff', label: 'Staff', type: 'email_domain' as const, value: '@Paddock-Tracker.com', message: null };
    expect(passes(staff, writer)).toBe(true);
    expect(passes(staff, reader)).toBe(false);
    expect(passes(staff, ANONYMOUS)).toBe(false);
    expect(passes({ ...staff, value: null }, writer)).toBe(false);
  });
});

describe('allowedKeys and mayShow', () => {
  it('keeps public without a row, the schemes the visitor passes, and drops unknown keys', () => {
    expect([...allowedKeys(['public', 'signed_in', 'contributor', 'administrator', 'nope'], DEFAULT_AUTHZ_SCHEMES, reader)]).toEqual(['public', 'signed_in']);
    expect([...allowedKeys(['signed_in', 'administrator'], DEFAULT_AUTHZ_SCHEMES, ANONYMOUS)]).toEqual([]);
    expect([...allowedKeys(['administrator'], DEFAULT_AUTHZ_SCHEMES, admin)]).toEqual(['administrator']);
  });

  it('shows an entry for everyone when it asks for nothing or public, otherwise only to a visitor who passes', () => {
    expect(mayShow(undefined, DEFAULT_AUTHZ_SCHEMES, ANONYMOUS)).toBe(true);
    expect(mayShow(null, DEFAULT_AUTHZ_SCHEMES, ANONYMOUS)).toBe(true);
    expect(mayShow('public', DEFAULT_AUTHZ_SCHEMES, ANONYMOUS)).toBe(true);
    expect(mayShow('signed_in', DEFAULT_AUTHZ_SCHEMES, ANONYMOUS)).toBe(false);
    expect(mayShow('signed_in', DEFAULT_AUTHZ_SCHEMES, reader)).toBe(true);
    expect(mayShow('nope', DEFAULT_AUTHZ_SCHEMES, admin)).toBe(false);
  });
});

describe('visitorFromAccount (PA A1a)', () => {
  it('is anonymous without an account and reads the role, the ladder and the one address from one', () => {
    const account = { id: 'user_1', email: 'W@Example.com', name: 'W', username: null, imageUrl: null, role: 'writer', donor: false };
    expect(visitorFromAccount(null)).toEqual(ANONYMOUS);
    expect(visitorFromAccount(undefined)).toEqual(ANONYMOUS);
    expect(visitorFromAccount(account)).toEqual({ signedIn: true, role: 'writer', author: true, emails: ['W@Example.com'] });
    expect(visitorFromAccount({ ...account, role: null, email: null })).toEqual({ signedIn: true, role: null, author: false, emails: [] });
    expect(visitorFromAccount({ ...account, role: 'reader' })).toMatchObject({ role: 'reader', author: false });
  });
});

