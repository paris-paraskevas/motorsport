import { describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => auth(), currentUser: () => currentUser() }));

import { accountFromClerkUser, accountId, currentAccount } from './server';

// The account seam's server half over Clerk (PA A1a): what every server file reads instead of Clerk's user, so that A3 can
// put Supabase Auth behind the same two calls with no caller changing.
const clerk = (over: Record<string, unknown> = {}) => ({
  id: 'user_1',
  fullName: 'Alex Driver',
  firstName: 'Alex',
  lastName: 'Driver',
  username: 'alexd',
  imageUrl: 'https://img.clerk.com/x',
  hasImage: true,
  primaryEmailAddress: { emailAddress: 'alex@example.com' },
  emailAddresses: [{ emailAddress: 'alex@example.com' }],
  publicMetadata: { role: 'admin', donor: true },
  ...over,
});

describe('the account seam over Clerk (PA A1a)', () => {
  it('maps a Clerk user to an Account: the id, the one address, the full name else first and last, a photo only when uploaded, the role when a string, donor only when true', () => {
    expect(accountFromClerkUser(clerk())).toEqual({ id: 'user_1', email: 'alex@example.com', name: 'Alex Driver', username: 'alexd', imageUrl: 'https://img.clerk.com/x', role: 'admin', donor: true });
    expect(accountFromClerkUser(clerk({ fullName: null, firstName: 'Alex', lastName: null }))).toMatchObject({ name: 'Alex' });
    expect(accountFromClerkUser(clerk({ fullName: null, firstName: null, lastName: null, username: null }))).toMatchObject({ name: null, username: null });
    // Clerk's imageUrl is always populated (a generated placeholder without a photo): only hasImage tells a photo apart (lib/author-identity's rule).
    expect(accountFromClerkUser(clerk({ hasImage: false }))).toMatchObject({ imageUrl: null });
    expect(accountFromClerkUser(clerk({ primaryEmailAddress: null, emailAddresses: [{ emailAddress: 'second@example.com' }] }))).toMatchObject({ email: 'second@example.com' });
    expect(accountFromClerkUser(clerk({ primaryEmailAddress: null, emailAddresses: [] }))).toMatchObject({ email: null });
    expect(accountFromClerkUser(clerk({ publicMetadata: { role: 7, donor: 'yes' } }))).toMatchObject({ role: null, donor: false });
    expect(accountFromClerkUser(clerk({ publicMetadata: null }))).toMatchObject({ role: null, donor: false });
    expect(accountFromClerkUser(null)).toBeNull();
  });

  it('currentAccount reads Clerk’s current user and accountId the session’s id; both null when nobody is signed in', async () => {
    currentUser.mockResolvedValueOnce(clerk());
    expect(await currentAccount()).toMatchObject({ id: 'user_1', role: 'admin', email: 'alex@example.com' });
    currentUser.mockResolvedValueOnce(null);
    expect(await currentAccount()).toBeNull();
    auth.mockResolvedValueOnce({ userId: 'user_1' });
    expect(await accountId()).toBe('user_1');
    auth.mockResolvedValueOnce({ userId: null });
    expect(await accountId()).toBeNull();
  });
});
