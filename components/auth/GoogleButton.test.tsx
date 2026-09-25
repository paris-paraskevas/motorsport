// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

vi.mock('next/script', () => ({ default: () => null }));

import { GoogleButton } from './GoogleButton';

// Google's button (PA A3): the nonce comes from the site's route (its hash to Google), the ID token goes back to the
// site's route without a nonce in the body, and a success is a full navigation.
const fetchMock = vi.fn();
const assign = vi.fn();
const answer = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body });
const google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } };

describe('GoogleButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { ...window.location, assign });
    window.google = google;
  });
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    assign.mockClear();
    google.accounts.id.initialize.mockClear();
    google.accounts.id.renderButton.mockClear();
    vi.unstubAllGlobals();
    delete window.google;
  });

  it('asks the route for a nonce, draws the button with its hash, and posts the credential alone', async () => {
    fetchMock.mockResolvedValueOnce(answer({ ok: true, hashed: 'abc123' }));
    const onError = vi.fn();
    render(<GoogleButton clientId="client-1" next="/f1" onError={onError} />);
    await waitFor(() => expect(google.accounts.id.initialize).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/nonce', expect.objectContaining({ method: 'POST' }));
    const options = google.accounts.id.initialize.mock.calls[0][0] as { client_id: string; nonce: string; callback: (r: { credential?: string }) => Promise<void> };
    expect(options.client_id).toBe('client-1');
    expect(options.nonce).toBe('abc123');
    expect(google.accounts.id.renderButton).toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(answer({ ok: true, next: '/f1' }));
    await options.callback({ credential: 'jwt' });
    const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(path).toBe('/api/auth/google');
    expect(JSON.parse(init.body as string)).toEqual({ credential: 'jwt', next: '/f1' });
    expect(assign).toHaveBeenCalledWith('/f1');
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a refused nonce or a refused token, and draws nothing without a client id', async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: 'no' }, false));
    const onError = vi.fn();
    render(<GoogleButton clientId="client-1" next="/" onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalledWith('no'));
    expect(google.accounts.id.initialize).not.toHaveBeenCalled();
    cleanup();
    const { container } = render(<GoogleButton clientId={null} next="/" onError={onError} />);
    expect(container.innerHTML).toBe('');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
