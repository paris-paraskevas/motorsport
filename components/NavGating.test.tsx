// @vitest-environment jsdom
//
// The shell's lists show an entry asking for an authorization scheme only to a
// visitor who passes it (Phase 3 step 4): hidden while Clerk has not loaded
// (the cached render), shown after for a visitor who passes, always shown in
// the designer's previews (no schemes given).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type React from 'react';

let clerk: { account: unknown; isLoaded: boolean; isSignedIn: boolean } = { account: null, isLoaded: false, isSignedIn: false };
vi.mock('@/lib/auth/client', () => ({
  useAccount: () => ({ ...clerk, avatarUrl: null }),
  SignOutButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignInLink: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AccountButton: () => null,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: unknown; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={String(href)} {...(rest as object)}>
      {children}
    </a>
  ),
}));
vi.mock('@/components/landing/InstallApp', () => ({ InstallApp: () => null }));
vi.mock('@/components/ContactModal', () => ({ ContactFooterButton: () => <button type="button">Contact</button> }));
vi.mock('@/components/ManageCookiesButton', () => ({ ManageCookiesButton: () => <button type="button">Cookies</button> }));

import { DoorLinks } from './DoorLinks';
import { SignOutRow } from './AccountIdentity';
import { BottomBar } from './BottomBar';
import { Footer } from './Footer';
import { DEFAULT_AUTHZ_SCHEMES } from '@/lib/design/authz-defaults';
import { TEXT_DEFAULTS, TEXT_KEYS } from '@/lib/design/text-defaults';
import type { ChromeText } from '@/lib/design/text-defaults';
import type { NavEntry } from '@/lib/design/destinations';

const doors: NavEntry[] = [
  { label: 'Calendar', dest: 'calendar' },
  { label: 'Threads', dest: 'threads', authz: 'signed_in' },
  { label: 'Studio', dest: 'about', authz: 'contributor' },
];
const bar: NavEntry[] = [
  { label: 'Home', dest: 'home', icon: 'house' },
  { label: 'Calendar', dest: 'calendar', icon: 'calendar-days' },
  { label: 'Learn', dest: 'learn', icon: 'compass' },
  { label: 'Account', dest: 'account', icon: 'circle-user', authz: 'signed_in' },
];
const text = Object.fromEntries(TEXT_KEYS.map(k => [k, TEXT_DEFAULTS[k].text])) as ChromeText;

afterEach(() => {
  cleanup();
  clerk = { account: null, isLoaded: false, isSignedIn: false };
});

describe('navigation entries and authorization schemes', () => {
  it('hides gated doors before Clerk has loaded and shows the ones a signed-in reader passes', () => {
    render(<DoorLinks entries={doors} schemes={DEFAULT_AUTHZ_SCHEMES} preview />);
    expect(screen.getByText('Calendar')).toBeTruthy();
    expect(screen.queryByText('Threads')).toBeNull();
    expect(screen.queryByText('Studio')).toBeNull();
    cleanup();
    clerk = { account: { id: 'u1', email: null, name: null, username: null, imageUrl: null, role: null, donor: false }, isLoaded: true, isSignedIn: true };
    render(<DoorLinks entries={doors} schemes={DEFAULT_AUTHZ_SCHEMES} preview />);
    expect(screen.getByText('Threads')).toBeTruthy();
    expect(screen.queryByText('Studio')).toBeNull();
    cleanup();
    clerk = { account: { id: 'u1', email: null, name: null, username: null, imageUrl: null, role: 'contributor', donor: false }, isLoaded: true, isSignedIn: true };
    render(<DoorLinks entries={doors} schemes={DEFAULT_AUTHZ_SCHEMES} preview />);
    expect(screen.getByText('Studio')).toBeTruthy();
  });

  it('shows every entry when no schemes are given, as the designer’s preview does', () => {
    render(<DoorLinks entries={doors} preview />);
    expect(screen.getByText('Threads')).toBeTruthy();
    expect(screen.getByText('Studio')).toBeTruthy();
  });

  it('drops a gated phone-bar cell for an anonymous visitor and the footer’s gated links too', () => {
    render(<BottomBar entries={bar} schemes={DEFAULT_AUTHZ_SCHEMES} preview />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.queryByText('Account')).toBeNull();
    cleanup();
    render(<Footer site={[{ label: 'About', dest: 'about' }, { label: 'Threads', dest: 'threads', authz: 'signed_in' }]} legal={[{ label: 'Privacy', dest: 'privacy' }]} text={text} schemes={DEFAULT_AUTHZ_SCHEMES} />);
    expect(screen.getByText('About')).toBeTruthy();
    expect(screen.getByText('Privacy')).toBeTruthy();
    expect(screen.queryByText('Threads')).toBeNull();
  });
});

// R9: the Account page’s Sign out row is created in the browser, so Clerk’s SignOutButton (a Client Component) receives its
// one child from the same runtime; handed across from the page, a Server Component, the child failed Clerk’s single-child
// check and the page answered 500. The mock above renders SignOutButton as its child.
describe('the Account page’s Sign out row (R9)', () => {
  it('draws Clerk’s SignOutButton around one button of the row’s words and heatmap id', () => {
    render(<SignOutRow />);
    const button = screen.getByRole('button', { name: /Sign out/ });
    expect(button.getAttribute('data-heatmap-id')).toBe('account:sign-out');
    expect(button.textContent).toContain('End this session on this device');
  });
});
