// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const push = vi.fn();
let pathname = '/settings';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => pathname }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a> }));

import { AccountContext, hasSignedInCookie, initialsOf, SIGNED_IN_COOKIE, useAccount, useAccountFlags, type Account } from './client';
import { AuthProvider } from './client-provider';
import { AccountButton, SignInLink, signInHref, SignOutButton } from './client-pieces';
import { SIGNED_IN_COOKIE as SERVER_FLAG } from './supabase';

// The account seam in the browser over the site's own routes (PA A3): the provider asks /api/account only when the flag
// cookie says a session exists, the hooks read its answer, the pieces act through the routes.
const alex: Account = { id: 'user_1', email: 'alex@example.com', name: 'Alex Driver', username: 'alexd', imageUrl: 'https://x/avatars/k.png', role: 'admin', donor: true };
const fetchMock = vi.fn();
const answer = (body: unknown, ok = true) => ({ ok, json: async () => body });
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('the account seam in the browser (PA A3)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = `${SIGNED_IN_COOKIE}=; Max-Age=0`;
  });
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    push.mockClear();
    vi.unstubAllGlobals();
    pathname = '/settings';
  });

  it('the flag cookie has the same name on both sides, and tells whether to ask', () => {
    expect(SIGNED_IN_COOKIE).toBe(SERVER_FLAG);
    expect(hasSignedInCookie('theme=dark; pd_signed_in=1')).toBe(true);
    expect(hasSignedInCookie('theme=dark')).toBe(false);
    expect(hasSignedInCookie('pd_signed_in=')).toBe(false);
    expect(hasSignedInCookie('')).toBe(false);
  });

  it('without the flag the provider answers signed out at once and asks nothing; with it, it asks /api/account and hands the account and its flags to the hooks', async () => {
    const out = renderHook(() => useAccount(), { wrapper });
    await waitFor(() => expect(out.result.current.isLoaded).toBe(true));
    expect(out.result.current).toEqual({ account: null, isLoaded: true, isSignedIn: false, avatarUrl: null });
    expect(fetchMock).not.toHaveBeenCalled();
    cleanup();
    document.cookie = `${SIGNED_IN_COOKIE}=1`;
    fetchMock.mockResolvedValueOnce(answer({ account: alex, flags: { 'support-prompt': 'never' }, providers: ['email'] }));
    const signedIn = renderHook(() => ({ account: useAccount(), flags: useAccountFlags() }), { wrapper });
    expect(signedIn.result.current.account.isLoaded).toBe(false);
    await waitFor(() => expect(signedIn.result.current.account.isLoaded).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith('/api/account', { cache: 'no-store', credentials: 'same-origin' });
    expect(signedIn.result.current.account).toEqual({ account: alex, isLoaded: true, isSignedIn: true, avatarUrl: 'https://x/avatars/k.png' });
    expect(signedIn.result.current.flags.flags).toEqual({ 'support-prompt': 'never' });
    // setFlag writes one key through PATCH and keeps the answer's flags.
    fetchMock.mockResolvedValueOnce(answer({ ok: true, flags: { 'support-prompt': 'never', 'whats-new': 'v42' } }));
    await act(() => signedIn.result.current.flags.setFlag('whats-new', 'v42'));
    expect(fetchMock).toHaveBeenLastCalledWith('/api/account', { method: 'PATCH', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ flags: { 'whats-new': 'v42' } }) });
    expect(signedIn.result.current.flags.flags).toEqual({ 'support-prompt': 'never', 'whats-new': 'v42' });
    fetchMock.mockResolvedValueOnce(answer({ error: 'no' }, false));
    await expect(signedIn.result.current.flags.setFlag('x', 1)).rejects.toThrow();
  });

  it('a refused or failed answer reads as signed out; outside a provider nothing has loaded and setFlag refuses', async () => {
    document.cookie = `${SIGNED_IN_COOKIE}=1`;
    fetchMock.mockResolvedValueOnce(answer({ error: 'x' }, false));
    const refused = renderHook(() => useAccount(), { wrapper });
    await waitFor(() => expect(refused.result.current.isLoaded).toBe(true));
    expect(refused.result.current.isSignedIn).toBe(false);
    cleanup();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const failed = renderHook(() => useAccountFlags(), { wrapper });
    await waitFor(() => expect(failed.result.current.flags).toBeNull());
    await expect(failed.result.current.setFlag('x', 1)).rejects.toThrow('signed out');
    cleanup();
    const outside = renderHook(() => useAccount()).result.current;
    expect(outside).toEqual({ account: null, isLoaded: false, isSignedIn: false, avatarUrl: null });
  });

  it('the pieces: SignInLink goes to the sign-in page with the way back, SignOutButton ends the session then reloads, AccountButton links to the Account page with the photo or the initials', async () => {
    expect(signInHref('/settings')).toBe('/sign-in?next=%2Fsettings');
    expect(signInHref('/')).toBe('/sign-in');
    expect(signInHref('/sign-up')).toBe('/sign-in');
    expect(signInHref(null)).toBe('/sign-in');
    const onClick = vi.fn();
    render(
      <SignInLink>
        <button type="button" onClick={onClick}>Sign in</button>
      </SignInLink>,
    );
    screen.getByRole('button', { name: 'Sign in' }).click();
    expect(onClick).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/sign-in?next=%2Fsettings');
    cleanup();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    fetchMock.mockResolvedValueOnce(answer({ ok: true }));
    render(
      <SignOutButton redirectUrl="/">
        <button type="button">Sign out</button>
      </SignOutButton>,
    );
    screen.getByRole('button', { name: 'Sign out' }).click();
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/sign-out', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: '{}' });
    cleanup();
    const store = { account: alex, flags: {}, isLoaded: true, refresh: async () => undefined, setFlag: async () => undefined };
    render(
      <AccountContext.Provider value={store}>
        <AccountButton avatarClassName="w-10 h-10" />
      </AccountContext.Provider>,
    );
    const link = screen.getByRole('link', { name: 'Your account' });
    expect(link.getAttribute('href')).toBe('/settings/account');
    expect(link.className).toContain('w-10 h-10');
    expect(link.querySelector('img')?.getAttribute('src')).toBe('https://x/avatars/k.png');
    cleanup();
    render(
      <AccountContext.Provider value={{ ...store, account: { ...alex, imageUrl: null } }}>
        <AccountButton avatarClassName="w-10 h-10" />
      </AccountContext.Provider>,
    );
    expect(screen.getByRole('link', { name: 'Your account' }).textContent).toBe('AD');
    expect(initialsOf({ ...alex, name: 'Alex' })).toBe('AL');
    expect(initialsOf({ ...alex, name: null })).toBe('AL');
    expect(initialsOf({ ...alex, name: null, username: null })).toBe('AL');
    expect(initialsOf(null)).toBe('');
  });
});
