// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import type React from 'react';

// The account seam's browser half (PA A1b): what every browser file reads instead of Clerk's hooks and pieces. Clerk's
// module is mocked whole; the provider's props are captured, the hooks answer the fixture below.
type ClerkUser = Record<string, unknown> | null;
let clerk: { isLoaded: boolean; isSignedIn: boolean | undefined; user: ClerkUser } = { isLoaded: true, isSignedIn: true, user: null };
const providerProps = vi.fn();
const update = vi.fn(async () => undefined);
vi.mock('@clerk/nextjs', () => ({
  useUser: () => clerk,
  ClerkProvider: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => {
    providerProps(props);
    return <>{children}</>;
  },
  SignInButton: ({ children, mode }: { children: React.ReactNode; mode?: string }) => <span data-testid="sign-in" data-mode={mode}>{children}</span>,
  SignOutButton: ({ children, redirectUrl }: { children: React.ReactNode; redirectUrl?: string }) => <span data-testid="sign-out" data-redirect={redirectUrl}>{children}</span>,
  UserButton: (props: { appearance?: { elements?: { avatarBox?: string } } }) => <span data-testid="user-button" data-avatar={props.appearance?.elements?.avatarBox} />,
}));
const auth = vi.fn();
const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: () => auth(), currentUser: () => currentUser() }));

import { accountFromBrowserUser, useAccount, useAccountFlags } from './client';
import { AuthProvider } from './client-provider';
import { AccountButton, SignInLink, SignOutButton } from './client-pieces';
import { accountFromClerkUser } from './server';

const user = () => ({
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
  unsafeMetadata: { 'support-prompt': 'never' },
  update,
});

describe('the account seam in the browser (PA A1b)', () => {
  afterEach(() => {
    cleanup();
    clerk = { isLoaded: true, isSignedIn: true, user: null };
    providerProps.mockClear();
    update.mockClear();
  });

  it('maps Clerk’s browser user exactly as the server maps Clerk’s user', () => {
    const u = user();
    expect(accountFromBrowserUser(u)).toEqual(accountFromClerkUser(u));
    expect(accountFromBrowserUser({ ...u, hasImage: false, publicMetadata: { role: 7 } })).toEqual(accountFromClerkUser({ ...u, hasImage: false, publicMetadata: { role: 7 } }));
    expect(accountFromBrowserUser(null)).toBeNull();
  });

  it('useAccount answers the account, the load and sign-in flags and the avatar the provider shows; nothing before Clerk loads, nothing signed out', () => {
    clerk = { isLoaded: true, isSignedIn: true, user: user() };
    const signedIn = renderHook(() => useAccount()).result.current;
    expect(signedIn).toEqual({ account: { id: 'user_1', email: 'alex@example.com', name: 'Alex Driver', username: 'alexd', imageUrl: 'https://img.clerk.com/x', role: 'admin', donor: true }, isLoaded: true, isSignedIn: true, avatarUrl: 'https://img.clerk.com/x' });
    // Without a photo the account carries no image, but the provider still shows a generated picture, which the header keeps drawing.
    clerk = { isLoaded: true, isSignedIn: true, user: { ...user(), hasImage: false } };
    expect(renderHook(() => useAccount()).result.current).toMatchObject({ account: { imageUrl: null }, avatarUrl: 'https://img.clerk.com/x' });
    clerk = { isLoaded: false, isSignedIn: undefined, user: null };
    expect(renderHook(() => useAccount()).result.current).toEqual({ account: null, isLoaded: false, isSignedIn: false, avatarUrl: null });
    clerk = { isLoaded: true, isSignedIn: false, user: null };
    expect(renderHook(() => useAccount()).result.current).toEqual({ account: null, isLoaded: true, isSignedIn: false, avatarUrl: null });
  });

  it('useAccountFlags reads the person’s browser-written flags and setFlag merges one key into them; null and a refusal signed out', async () => {
    clerk = { isLoaded: true, isSignedIn: true, user: user() };
    const { result } = renderHook(() => useAccountFlags());
    expect(result.current.flags).toEqual({ 'support-prompt': 'never' });
    await result.current.setFlag('whats-new', 'v42');
    expect(update).toHaveBeenCalledWith({ unsafeMetadata: { 'support-prompt': 'never', 'whats-new': 'v42' } });
    clerk = { isLoaded: true, isSignedIn: false, user: null };
    const out = renderHook(() => useAccountFlags()).result.current;
    expect(out.flags).toBeNull();
    await expect(out.setFlag('x', 1)).rejects.toThrow();
  });

  it('AuthProvider renders Clerk’s provider with the site’s or the console’s look; the sign-in, sign-out and account pieces are Clerk’s, created with their child in the browser', () => {
    render(
      <AuthProvider look="site">
        <SignInLink>
          <button type="button">Sign in</button>
        </SignInLink>
        <SignOutButton redirectUrl="/">
          <button type="button">Sign out</button>
        </SignOutButton>
        <AccountButton avatarClassName="w-10 h-10" />
      </AuthProvider>,
    );
    expect(providerProps).toHaveBeenCalledWith({ signInUrl: '/sign-in', signUpUrl: '/sign-up', signInFallbackRedirectUrl: '/', signUpFallbackRedirectUrl: '/', appearance: { variables: { colorPrimary: '#8c1c13' } } });
    expect(screen.getByTestId('sign-in').getAttribute('data-mode')).toBe('modal');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.getByTestId('sign-out').getAttribute('data-redirect')).toBe('/');
    expect(screen.getByTestId('user-button').getAttribute('data-avatar')).toBe('w-10 h-10');
    cleanup();
    render(<AuthProvider look="console">x</AuthProvider>);
    expect(providerProps).toHaveBeenLastCalledWith({ signInUrl: '/sign-in', signUpUrl: '/sign-up', signInFallbackRedirectUrl: '/', signUpFallbackRedirectUrl: '/', appearance: { variables: { colorBackground: '#fffcf2', colorText: '#1e1a13', colorPrimary: '#8c1c13', colorTextOnPrimaryBackground: '#f7f3e8', colorInputBackground: '#fbf7ec', colorInputText: '#1e1a13' } } });
  });
});
