// @vitest-environment jsdom
//
// The Data workspace: the three tiers of cards from the index, the figures of
// the cards that can have some, a card opening its service page with the four
// tabs, Refresh reading again, a connect card reading nothing and telling how
// to connect.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataWorkspace } from './DataWorkspace';
import { DATA_SERVICES } from '@/lib/design/data-services';

const fetchMock = vi.fn();
let urls: string[] = [];
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const index = { services: DATA_SERVICES.map(s => ({ key: s.key, state: s.key === 'ga4' ? 'live' : s.tier === 'own' ? 'own' : 'connect', fetchedAt: null })) };
const ga4 = {
  key: 'ga4',
  state: 'live',
  fetchedAt: '2026-09-09T06:00:00.000Z',
  kpis: [
    { label: 'Users · 28d', value: '9,340' },
    { label: 'Sessions', value: '14,120' },
    { label: 'Page views', value: '41,900' },
  ],
  series: { label: 'Users · daily · last 28 days', points: [3, 5, 4, 8] },
  breakdowns: [{ title: 'Top pages · 28d · page path × views', cols: ['Page', 'Views'], rows: [['/', '6,102']] }],
  connection: [
    { name: 'GA4_SA_KEY', present: true },
    { name: 'GA4_PROPERTY_ID', present: true },
  ],
};
const own = (key: string) => ({ key, state: 'own', fetchedAt: '2026-09-09T06:00:00.000Z', kpis: [{ label: 'Subscriptions', value: '642' }], series: null, breakdowns: [], connection: [] });

beforeEach(() => {
  urls = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    urls.push(url);
    if (url === '/api/admin/design/data') return json(200, index);
    const m = /\/api\/admin\/design\/data\/([a-z0-9]+)/.exec(url);
    if (m?.[1] === 'ga4') return json(200, ga4);
    if (m) return json(200, own(m[1]));
    return json(404, {});
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DataWorkspace', () => {
  it('draws the three tiers with a card per service, reads figures only for the cards that can have some, and shows them', async () => {
    render(<DataWorkspace />);
    await screen.findByRole('heading', { name: 'Data · what the outside world reports' });
    for (const s of DATA_SERVICES) expect(screen.getByRole('button', { name: `Open ${s.name}` })).toBeTruthy();
    expect(screen.getAllByRole('region')).toHaveLength(3);
    await waitFor(() => expect(within(screen.getByRole('button', { name: 'Open Google Analytics 4' })).getByText('9,340')).toBeTruthy());
    const read = urls.filter(u => u.startsWith('/api/admin/design/data/')).map(u => u.split('/').pop());
    expect(read).toContain('ga4');
    expect(read).toContain('push');
    expect(read).not.toContain('cfzone');
    expect(read).not.toContain('gsc');
    expect(within(screen.getByRole('button', { name: 'Open Cloudflare · zone' })).getByText('connect')).toBeTruthy();
  });

  it('opens a service with its four tabs, the breakdowns and the connection by name, and Refresh reads again', async () => {
    render(<DataWorkspace />);
    await screen.findByRole('heading', { name: 'Data · what the outside world reports' });
    await waitFor(() => expect(within(screen.getByRole('button', { name: 'Open Google Analytics 4' })).getByText('9,340')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Open Google Analytics 4' }));
    expect(screen.getByRole('heading', { name: 'Google Analytics 4' })).toBeTruthy();
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Overview', 'Breakdowns · 1', 'Health', 'Connection']);
    expect(screen.getByRole('img', { name: /Users · daily/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Breakdowns/ }));
    expect(screen.getByText('6,102')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Connection' }));
    expect(screen.getByText('GA4_SA_KEY')).toBeTruthy();
    expect(screen.getAllByText('present')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(urls).toContain('/api/admin/design/data/ga4?fresh=1'));
    fireEvent.click(screen.getByRole('button', { name: /All services/ }));
    expect(screen.getByRole('heading', { name: 'Data · what the outside world reports' })).toBeTruthy();
  });

  it('a connect card has no Refresh and tells how to connect, naming the credentials it lacks', async () => {
    render(<DataWorkspace />);
    await screen.findByRole('heading', { name: 'Data · what the outside world reports' });
    fireEvent.click(screen.getByRole('button', { name: 'Open GitHub Actions' }));
    expect(screen.queryByRole('button', { name: /Refresh/ })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Connection' }));
    expect(screen.getByText('GITHUB_ACTIONS_TOKEN')).toBeTruthy();
    expect(screen.getByText(/Fine-grained tokens/)).toBeTruthy();
  });
});
