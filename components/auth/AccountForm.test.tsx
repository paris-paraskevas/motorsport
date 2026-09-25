// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const routerRefresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: routerRefresh, push: vi.fn() }) }));

import { AccountContext, type Account } from '@/lib/auth/client';
import { AccountForm, DELETE_WORDS } from './AccountForm';

// The Account page's rows (PA A3): each edit through /api/account, the page and the header refreshed after, the words
// before a deletion.
const alex: Account = { id: 'user_1', email: 'alex@example.com', name: 'Alex Driver', username: 'alexd', imageUrl: null, role: null, donor: false };
const fetchMock = vi.fn();
const assign = vi.fn();
const refresh = vi.fn(async () => undefined);
const answer = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body });
const lastCall = () => {
  const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { path, method: init.method, body: typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : init.body };
};
const draw = (over: Partial<{ providers: string[]; resetPassword: boolean }> = {}) =>
  render(
    <AccountContext.Provider value={{ account: alex, flags: {}, isLoaded: true, refresh, setFlag: async () => undefined }}>
      <AccountForm account={alex} providers={over.providers ?? ['email']} resetPassword={over.resetPassword ?? false} />
    </AccountContext.Provider>,
  );

describe('AccountForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { ...window.location, assign });
  });
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    assign.mockClear();
    refresh.mockClear();
    routerRefresh.mockClear();
    vi.unstubAllGlobals();
  });

  it('shows the rows, edits the name through PATCH and refreshes the page and the header', async () => {
    draw();
    expect(screen.getByText('Alex Driver')).toBeTruthy();
    expect(screen.getByText('alex@example.com')).toBeTruthy();
    expect(screen.getByText('email and password')).toBeTruthy();
    expect(screen.getByText('AD')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alex D' } });
    fetchMock.mockResolvedValueOnce(answer({ ok: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Name saved.')).toBeTruthy());
    expect(lastCall()).toEqual({ path: '/api/account', method: 'PATCH', body: { name: 'Alex D' } });
    expect(refresh).toHaveBeenCalled();
    expect(routerRefresh).toHaveBeenCalled();
  });

  it('a new address needs the code the route sends; a reset opens the password row; the deletion needs the words', async () => {
    draw({ resetPassword: true });
    expect(screen.getByText('Set a new password to finish.')).toBeTruthy();
    // The Email row's Change comes before the Password row's.
    fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[0]);
    fireEvent.change(screen.getByLabelText('New email'), { target: { value: 'new@example.com' } });
    fetchMock.mockResolvedValueOnce(answer({ ok: true, confirm: 'email_change', email: 'new@example.com' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByLabelText('Code')).toBeTruthy());
    expect(lastCall()).toEqual({ path: '/api/account', method: 'PATCH', body: { email: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '123456' } });
    fetchMock.mockResolvedValueOnce(answer({ ok: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(screen.getByText('Email changed.')).toBeTruthy());
    expect(lastCall()).toEqual({ path: '/api/auth/verify', method: 'POST', body: { email: 'new@example.com', token: '123456', type: 'email_change' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    const remove = screen.getByRole('button', { name: 'Delete my account' }) as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: DELETE_WORDS } });
    expect(remove.disabled).toBe(false);
    fetchMock.mockResolvedValueOnce(answer({ ok: true }));
    fireEvent.click(remove);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
    expect(lastCall()).toEqual({ path: '/api/account', method: 'DELETE', body: { confirm: DELETE_WORDS } });
  });
});
