import { describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

import { ANONYMOUS, allowedKeys, currentVisitor, passes, type Visitor } from './authz-evaluate';
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

describe('allowedKeys', () => {
  it('keeps public without a row, the schemes the visitor passes, and drops unknown keys', () => {
    expect([...allowedKeys(['public', 'signed_in', 'contributor', 'administrator', 'nope'], DEFAULT_AUTHZ_SCHEMES, reader)]).toEqual(['public', 'signed_in']);
    expect([...allowedKeys(['signed_in', 'administrator'], DEFAULT_AUTHZ_SCHEMES, ANONYMOUS)]).toEqual([]);
    expect([...allowedKeys(['administrator'], DEFAULT_AUTHZ_SCHEMES, admin)]).toEqual(['administrator']);
  });
});

describe('currentVisitor', () => {
  it('is anonymous without a session and reads role, ladder and emails from a Clerk user', async () => {
    currentUser.mockResolvedValueOnce(null);
    expect(await currentVisitor()).toEqual(ANONYMOUS);
    currentUser.mockResolvedValueOnce({
      id: 'user_1',
      publicMetadata: { role: 'writer' },
      emailAddresses: [{ emailAddress: 'W@Example.com' }],
    });
    expect(await currentVisitor()).toEqual({ signedIn: true, role: 'writer', author: true, emails: ['W@Example.com'] });
    currentUser.mockResolvedValueOnce({ id: 'user_2', publicMetadata: {}, emailAddresses: [] });
    expect(await currentVisitor()).toEqual({ signedIn: true, role: null, author: false, emails: [] });
  });
});
