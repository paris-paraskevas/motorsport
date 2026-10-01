// @vitest-environment jsdom
//
// The Data workspace: the strip that counts the states, the three tiers of
// banded cards from the index, the figures of the cards that can have some, a
// card opening its service page with the four tabs, Refresh reading again, a
// connect card reading nothing and telling how to connect, and the loader's
// runs page with its filters.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataWorkspace } from './DataWorkspace';
import { DATA_SERVICES } from '@/lib/design/data-services';
import { SOURCES } from '@/lib/design/sources';

const fetchMock = vi.fn();
let urls: string[] = [];
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const index = { services: DATA_SERVICES.map(s => ({ key: s.key, state: s.key === 'ga4' ? 'live' : s.tier === 'own' ? 'own' : 'connect', fetchedAt: null })) };
const ga4 = {
  key: 'ga4',
  state: 'live',
  fetchedAt: '2026-09-09T06:00:00.000Z',
  headline: { value: '9,340', unit: 'visitors · 28 days', context: 'Up 7% on the week before' },
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
const own = (key: string) => ({
  key,
  state: 'own',
  fetchedAt: '2026-09-09T06:00:00.000Z',
  headline: key === 'upstream' ? { value: '219', unit: 'loads · 24 hours', context: '12 of 13 sources fine · 1 never ran' } : { value: '642', unit: 'subscriptions', context: 'Sends are not recorded yet' },
  tone: key === 'upstream' ? 'warn' : undefined,
  kpis: [{ label: 'Subscriptions', value: '642' }],
  series: null,
  breakdowns: [],
  connection: [],
});
const runsLog = {
  fetchedAt: '2026-09-09T08:30:00.000Z',
  periodMinutes: 20,
  staleAfterMinutes: 65,
  sources: [
    { key: 'standings:f1', label: 'Formula 1', state: 'fine', newest: { id: 'r2', source: 'standings:f1', status: 'ok', rows: 34, started: '2026-09-09T08:20:00Z', finished: '2026-09-09T08:20:04Z', runner: 'warm-live-data#9', error: null }, lastOk: '2026-09-09T08:20:04Z' },
    { key: 'standings:gt-world', label: 'GT World Challenge', state: 'never', newest: null, lastOk: null },
    { key: 'standings:wrc', label: 'WRC', state: 'failed', newest: { id: 'r1', source: 'standings:wrc', status: 'failed', rows: 0, started: '2026-09-09T08:20:00Z', finished: '2026-09-09T08:20:02Z', runner: 'warm-live-data#9', error: 'upstream 503 from wrc.com' }, lastOk: '2026-09-09T06:00:00Z' },
  ],
  runs: [
    { id: 'r2', source: 'standings:f1', status: 'ok', rows: 34, started: '2026-09-09T08:20:00Z', finished: '2026-09-09T08:20:04Z', runner: 'warm-live-data#9', error: null },
    { id: 'r1', source: 'standings:wrc', status: 'failed', rows: 0, started: '2026-09-09T08:20:00Z', finished: '2026-09-09T08:20:02Z', runner: 'warm-live-data#9', error: 'upstream 503 from wrc.com' },
  ],
  last24h: { runs: 2, failed: 1 },
};

beforeEach(() => {
  urls = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    urls.push(url);
    if (url === '/api/admin/design/data') return json(200, index);
    if (url.startsWith('/api/admin/design/data/runs')) return json(200, runsLog);
    if (url === '/api/admin/design/data/sources') return json(200, { sources: SOURCES.map(s => ({ key: s.key, usedOn: [], runs: [], snapshots: [] })) });
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

const home = async () => {
  render(<DataWorkspace />);
  await screen.findByRole('heading', { name: 'Data' });
  await waitFor(() => expect(within(screen.getByRole('button', { name: 'Open Google Analytics 4' })).getByText('9,340')).toBeTruthy());
};

describe('DataWorkspace', () => {
  it('draws the strip and the three tiers with a banded card per service, reading figures only for the cards that can have some', async () => {
    await home();
    for (const s of DATA_SERVICES) expect(screen.getByRole('button', { name: `Open ${s.name}` })).toBeTruthy();
    expect(screen.getAllByRole('region')).toHaveLength(3);
    const read = urls.filter(u => u.startsWith('/api/admin/design/data/')).map(u => u.split('/').pop());
    expect(read).toContain('ga4');
    expect(read).toContain('push');
    expect(read).not.toContain('cfzone');
    expect(read).not.toContain('gsc');
    const ga4Card = screen.getByRole('button', { name: 'Open Google Analytics 4' });
    expect(within(ga4Card).getByText('Fine')).toBeTruthy();
    expect(within(ga4Card).getByText('visitors · 28 days')).toBeTruthy();
    expect(within(ga4Card).getByText('Up 7% on the week before')).toBeTruthy();
    const zone = screen.getByRole('button', { name: 'Open Cloudflare · zone' });
    expect(within(zone).getByText('Not connected', { exact: true })).toBeTruthy();
    expect(within(zone).getByText('Not connected · 2 credentials to add')).toBeTruthy();
    await waitFor(() => expect(within(screen.getByRole('button', { name: /Open Upstream feeds/ })).getByText('Attention')).toBeTruthy());
    // one live and two own cards are fine, the upstream card warns, ten are not connected
    const strip = screen.getByRole('group', { name: 'What is up' });
    expect(within(strip).getByText('fine').previousSibling?.textContent).toBe('3');
    expect(within(strip).getByText('need attention').previousSibling?.textContent).toBe('1');
    expect(within(strip).getByText('problems').previousSibling?.textContent).toBe('0');
    expect(within(strip).getByText('not connected').previousSibling?.textContent).toBe('10');
    expect(screen.getByText('219 loads · 24 hours · 12 of 13 sources fine · 1 never ran')).toBeTruthy();
  });

  it('opens a service with its four tabs, the headline, the breakdowns and the connection by name, and Refresh reads again', async () => {
    await home();
    fireEvent.click(screen.getByRole('button', { name: 'Open Google Analytics 4' }));
    expect(screen.getByRole('heading', { name: 'Google Analytics 4' })).toBeTruthy();
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Overview', 'Breakdowns · 1', 'Health', 'Connection']);
    expect(screen.getByRole('img', { name: /Users · daily/ })).toBeTruthy();
    expect(screen.getByText('Up 7% on the week before')).toBeTruthy();
    expect(screen.getByText('Sessions')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Breakdowns/ }));
    expect(screen.getByText('6,102')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Connection' }));
    expect(screen.getByText('GA4_SA_KEY')).toBeTruthy();
    expect(screen.getAllByText('present')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect(urls).toContain('/api/admin/design/data/ga4?fresh=1'));
    fireEvent.click(screen.getByRole('button', { name: /All services/ }));
    expect(screen.getByRole('heading', { name: 'Data' })).toBeTruthy();
  });

  it('a connect card has no Refresh and tells how to connect, naming the credentials it lacks', async () => {
    render(<DataWorkspace />);
    await screen.findByRole('heading', { name: 'Data' });
    fireEvent.click(screen.getByRole('button', { name: 'Open GitHub Actions' }));
    expect(screen.queryByRole('button', { name: /Refresh/ })).toBeNull();
    expect(screen.getByText('Nothing to read until the service is connected.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Connection' }));
    expect(screen.getByText('GITHUB_ACTIONS_TOKEN')).toBeTruthy();
    expect(screen.getByText(/Fine-grained tokens/)).toBeTruthy();
  });

  it('opens the loader’s runs from the Loads bar and from the loader’s services: the strip, every source with its state, the runs with a filter', async () => {
    await home();
    fireEvent.click(screen.getByRole('button', { name: 'Open the runs' }));
    await screen.findByRole('heading', { name: /Loads · the loader/ });
    await waitFor(() => expect(urls).toContain('/api/admin/design/data/runs?limit=200'));
    await screen.findByText('Sources · the newest run of each');
    const strip = screen.getByRole('group', { name: 'The loader now' });
    expect(within(strip).getByText('sources fine').previousSibling?.textContent).toBe('1 / 3');
    expect(within(strip).getByText('failed · 24 hours').previousSibling?.textContent).toBe('1');
    expect(within(strip).getByText('loads · 24 hours').previousSibling?.textContent).toBe('2');
    expect(screen.getByText('never ran')).toBeTruthy();
    // P2.1: the loader's keys read in the catalogue's words, the raw key kept beside them.
    expect(screen.getByText('Standings · GT World Challenge · 2026')).toBeTruthy();
    expect(screen.getAllByText('standings:gt-world').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Standings · Formula 1 · 2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('upstream 503 from wrc.com')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: /^Runs · the newest 2$/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'failed' } });
    expect(screen.getByRole('heading', { name: /^Runs · the newest 2· 1 shown$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show 1000' }));
    await waitFor(() => expect(urls).toContain('/api/admin/design/data/runs?limit=1000'));
    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    expect(screen.getByRole('heading', { name: 'Data' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Supabase · our tables' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open the runs' }));
    await screen.findByRole('heading', { name: /Loads · the loader/ });
  });

  it('P2.1: the Object Browser opens from the Data page, lists the catalogue’s sources with the loader’s work behind them, and Data returns', async () => {
    await home();
    fireEvent.click(screen.getByRole('button', { name: 'Object Browser' }));
    await screen.findByRole('heading', { name: /^Object Browser/ });
    await waitFor(() => expect(urls).toContain('/api/admin/design/data/sources'));
    await screen.findByRole('button', { name: 'Open Standings' });
    // Eighteen since R18 (the Champions source).
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(18);
    fireEvent.click(screen.getByRole('button', { name: 'Open Standings' }));
    expect(screen.getByRole('region', { name: 'Data Source: Standings' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    expect(screen.getByRole('heading', { name: 'Data' })).toBeTruthy();
  });
});
