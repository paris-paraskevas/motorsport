// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('next/script', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a> }));

import { NOTICE_UNTIL, SignInForm } from './SignInForm';

// The sign-in form (PA A3): the password step posts to the site's own route and moves on a full navigation; a refusal
// shows the route's words; a code by email and a reset go through the code step; the notice stays thirty days.
const fetchMock = vi.fn();
const assign = vi.fn();
const answer = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body });
const lastCall = () => {
  const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { path, body: JSON.parse(init.body as string) as Record<string, unknown> };
};
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('SignInForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { ...window.location, assign });
  });
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    assign.mockClear();
    vi.unstubAllGlobals();
  });

  it('signs in with the address and the password, then goes where the route says; a refusal shows its words', async () => {
    fetchMock.mockResolvedValueOnce(answer({ ok: true, next: '/f1' }));
    render(<SignInForm next="/f1" siteKey={null} googleClientId={null} today={new Date('2026-10-01')} />);
    expect(screen.getByRole('heading', { name: 'Sign in to Paddock' })).toBeTruthy();
    expect(screen.getByText(/Paddock has moved sign-in/)).toBeTruthy();
    expect(screen.queryByText('or')).toBeNull();
    type('Email', 'alex@example.com');
    type('Password', 'secret-123');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/f1'));
    expect(lastCall()).toEqual({ path: '/api/auth/password', body: { email: 'alex@example.com', password: 'secret-123', next: '/f1' } });
    // A success leaves the page, so the form stays busy; a refusal is a fresh page.
    cleanup();
    render(<SignInForm next="/f1" siteKey={null} googleClientId={null} today={new Date('2026-10-01')} />);
    type('Email', 'alex@example.com');
    type('Password', 'nope');
    fetchMock.mockResolvedValueOnce(answer({ error: 'Wrong email or password.' }, false));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Wrong email or password.'));
    expect(screen.getByRole('link', { name: /Create an account/ }).getAttribute('href')).toBe('/sign-up?next=%2Ff1');
  });

  it('a code by email: the code step verifies as type email; a reset verifies as recovery and goes to the password row; the notice ends', async () => {
    fetchMock.mockResolvedValueOnce(answer({ ok: true }));
    render(<SignInForm next="/" siteKey={null} googleClientId={null} today={new Date(NOTICE_UNTIL)} />);
    expect(screen.queryByText(/Paddock has moved sign-in/)).toBeNull();
    type('Email', 'alex@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code instead' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Check your email' })).toBeTruthy());
    expect(lastCall()).toEqual({ path: '/api/auth/code', body: { email: 'alex@example.com' } });
    fetchMock.mockResolvedValueOnce(answer({ error: 'That code did not work. Check it, or send a new one.' }, false));
    type('Code', '123456');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(lastCall()).toEqual({ path: '/api/auth/verify', body: { email: 'alex@example.com', token: '123456', type: 'email', next: '/' } });
    fetchMock.mockResolvedValueOnce(answer({ ok: true, next: '/' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
    cleanup();
    render(<SignInForm next="/" siteKey={null} googleClientId={null} today={new Date(NOTICE_UNTIL)} />);
    type('Email', 'alex@example.com');
    fetchMock.mockResolvedValueOnce(answer({ ok: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Forgot it?' }));
    await waitFor(() => expect(screen.getByText(/set a new password/)).toBeTruthy());
    expect(lastCall().path).toBe('/api/auth/reset');
    fetchMock.mockResolvedValueOnce(answer({ ok: true, next: '/' }));
    type('Code', '654321');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(assign).toHaveBeenLastCalledWith('/settings/account?reset=1'));
    expect(lastCall().body.type).toBe('recovery');
  });
});
