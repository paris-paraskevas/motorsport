// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('next/script', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a> }));

import { SignUpForm } from './SignUpForm';

// The sign-up form (PA A3): the three fields post to the site's route, the code step verifies as type signup, a refusal
// shows the route's words, and a sign-up the provider answers with a session goes straight on.
const fetchMock = vi.fn();
const assign = vi.fn();
const answer = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body });
const lastCall = () => {
  const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { path, body: JSON.parse(init.body as string) as Record<string, unknown> };
};
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('SignUpForm', () => {
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

  it('posts the name, the address and the password, then verifies the emailed code as a sign-up', async () => {
    fetchMock.mockResolvedValueOnce(answer({ ok: true, confirm: true, next: '/f1' }));
    render(<SignUpForm next="/f1" siteKey={null} googleClientId={null} />);
    expect(screen.getByRole('heading', { name: 'Create an account' })).toBeTruthy();
    type('Name', 'Bo Rider');
    type('Email', 'bo@example.com');
    type('Password', 'eight-ch');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Check your email' })).toBeTruthy());
    expect(lastCall()).toEqual({ path: '/api/auth/sign-up', body: { name: 'Bo Rider', email: 'bo@example.com', password: 'eight-ch', next: '/f1' } });
    fetchMock.mockResolvedValueOnce(answer({ error: 'That code did not work. Check it, or send a new one.' }, false));
    type('Code', '123456');
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(lastCall()).toEqual({ path: '/api/auth/verify', body: { email: 'bo@example.com', token: '123456', type: 'signup', next: '/f1' } });
    fetchMock.mockResolvedValueOnce(answer({ ok: true, next: '/f1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/f1'));
  });

  it('shows the route’s words on a refusal, and goes straight on when the provider answers with a session', async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: 'Tell us your name.' }, false));
    render(<SignUpForm next="/" siteKey={null} googleClientId={null} />);
    type('Name', 'Bo');
    type('Email', 'bo@example.com');
    type('Password', 'eight-ch');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Tell us your name.'));
    expect(screen.getByRole('link', { name: /Sign in/ }).getAttribute('href')).toBe('/sign-in');
    fetchMock.mockResolvedValueOnce(answer({ ok: true, confirm: false, next: '/' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
  });
});
