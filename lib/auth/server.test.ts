import { afterEach, describe, expect, it, vi } from 'vitest';

let jar: { name: string; value: string }[] = [];
const set = vi.fn();
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => jar, set: (...args: unknown[]) => set(...args) }) }));
const getClaims = vi.fn();
const authClient = vi.fn(() => ({ auth: { getClaims } }));
vi.mock('./supabase', async importOriginal => ({ ...(await importOriginal<typeof import('./supabase')>()), authClient: (...args: unknown[]) => authClient(...(args as [])) }));

import { accountFromClaims, accountId, currentAccount, flagsFromClaims } from './server';
import { SESSION_COOKIE } from './supabase';

// The account seam's server half over Supabase Auth (PA A3): what every server file reads instead of the provider's user.
const claims = (over: Record<string, unknown> = {}) => ({
  sub: '00000000-0000-4000-8000-000000000001',
  email: 'alex@example.com',
  app_metadata: { legacy_id: 'user_1', role: 'admin', donor: true, provider: 'email' },
  user_metadata: { full_name: 'Alex Driver', username: 'alexd', avatar_url: 'https://x/avatars/k.png', flags: { 'support-prompt': 'never' } },
  ...over,
});

describe('the account seam over Supabase Auth (PA A3)', () => {
  afterEach(() => {
    jar = [];
    set.mockClear();
    getClaims.mockReset();
    authClient.mockClear();
  });

  it('maps a session’s claims to an Account: the legacy id before the Supabase id, the address, the full name else the provider’s, the photo else the provider’s picture, the role when a string, donor only when true', () => {
    expect(accountFromClaims(claims())).toEqual({ id: 'user_1', email: 'alex@example.com', name: 'Alex Driver', username: 'alexd', imageUrl: 'https://x/avatars/k.png', role: 'admin', donor: true });
    expect(accountFromClaims(claims({ app_metadata: { role: 'writer' } }))).toMatchObject({ id: '00000000-0000-4000-8000-000000000001', role: 'writer', donor: false });
    expect(accountFromClaims(claims({ user_metadata: { name: 'Alex', picture: 'https://g/p.jpg' } }))).toMatchObject({ name: 'Alex', username: null, imageUrl: 'https://g/p.jpg' });
    expect(accountFromClaims(claims({ user_metadata: { full_name: '', avatar_url: '' }, email: undefined }))).toMatchObject({ name: null, imageUrl: null, email: null });
    expect(accountFromClaims(claims({ app_metadata: { legacy_id: 7, role: 7, donor: 'yes' } }))).toMatchObject({ id: '00000000-0000-4000-8000-000000000001', role: null, donor: false });
    expect(accountFromClaims(claims({ app_metadata: undefined, user_metadata: undefined }))).toMatchObject({ id: '00000000-0000-4000-8000-000000000001', role: null, name: null });
    expect(accountFromClaims(claims({ sub: '' }))).toBeNull();
    expect(accountFromClaims(null)).toBeNull();
    expect(flagsFromClaims(claims())).toEqual({ 'support-prompt': 'never' });
    expect(flagsFromClaims(claims({ user_metadata: { flags: [1] } }))).toEqual({});
    expect(flagsFromClaims(null)).toEqual({});
  });

  it('currentAccount and accountId read the verified claims once a session cookie is present, and never call Supabase for an anonymous request', async () => {
    jar = [{ name: 'theme', value: 'dark' }];
    expect(await currentAccount()).toBeNull();
    expect(await accountId()).toBeNull();
    expect(authClient).not.toHaveBeenCalled();
    jar = [{ name: SESSION_COOKIE, value: 'tokens' }];
    getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });
    expect(await currentAccount()).toMatchObject({ id: 'user_1', role: 'admin', email: 'alex@example.com' });
    expect(await accountId()).toBe('user_1');
    expect(authClient).toHaveBeenCalled();
    const input = (authClient.mock.calls[0] as unknown as [{ cookies: { getAll: () => unknown; setAll: (l: unknown[]) => void } }])[0];
    expect(input.cookies.getAll()).toEqual([{ name: SESSION_COOKIE, value: 'tokens' }]);
    // A write (a refresh during a render) is attempted on the store and a refusal is swallowed: the middleware wrote first.
    input.cookies.setAll([{ name: SESSION_COOKIE, value: 'fresh', options: { maxAge: 5, encode: String } }]);
    expect(set).toHaveBeenCalledWith(SESSION_COOKIE, 'fresh', { maxAge: 5 });
    set.mockImplementationOnce(() => { throw new Error('read-only'); });
    expect(() => input.cookies.setAll([{ name: SESSION_COOKIE, value: 'x', options: {} }])).not.toThrow();
  });

  it('a token that neither verifies nor refreshes, and a provider that cannot be reached, read as signed out', async () => {
    jar = [{ name: `${SESSION_COOKIE}.0`, value: 'tokens' }];
    getClaims.mockResolvedValueOnce({ data: null, error: { message: 'invalid' } });
    expect(await currentAccount()).toBeNull();
    getClaims.mockRejectedValueOnce(new Error('fetch failed'));
    expect(await currentAccount()).toBeNull();
  });
});
