// @vitest-environment jsdom
//
// Data Sources (P2.1; APEX: REST Data Sources, ours: the code's readers): the
// thirteen in a table with their parameters, columns, how they are kept fresh,
// Utilization and History; one opened below with its Data Profile, how it is
// read, where it is used, and a Preview through the reader. The same browser
// serves the Data workspace's Object Browser with the loader's work in two
// tiers.

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSourcesEditor, SourceBrowser } from './DataSourcesEditor';
import { SOURCES } from '@/lib/design/sources';

const MONZA = 'a1b2c3d4-0000-4000-8000-000000000002';
const fetchMock = vi.fn();
let urls: string[] = [];
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const list = {
  sources: SOURCES.map(s =>
    s.key === 'standings'
      ? {
          key: s.key,
          usedOn: [{ id: MONZA, path: '/history/monza', name: 'Monza, a history', refs: ['standings?series=f1&season=2026'] }],
          runs: [{ key: 'standings:f1', label: 'Standings · Formula 1 · 2026', state: 'fine', newest: { id: 'r2', source: 'standings:f1', status: 'ok', rows: 44, started: '2026-09-17T12:20:00Z', finished: '2026-09-17T12:20:04Z', runner: 'warm-live-data#77', error: null } }],
          snapshots: [{ key: 'f1:standings', label: 'Standings · Formula 1 · 2026', fetchedAt: '2026-09-17T12:20:00Z', ok: true, stale: false, meta: { run: 'warm-live-data#77', at: '2026-09-17T12:20:00.000Z', F: 812, W: 40 } }],
        }
      : { key: s.key, usedOn: [], runs: [], snapshots: [] },
  ),
};
const preview = {
  key: 'standings',
  label: 'Standings · Formula 1 · 2026',
  columns: SOURCES.find(s => s.key === 'standings')!.columns,
  rows: [
    { kind: 'driver', position: 1, name: 'Andrea Kimi Antonelli', code: 'ANT', team: 'Mercedes', points: 267, wins: 7, class: null },
    { kind: 'driver', position: 2, name: 'George Russell', code: 'RUS', team: 'Mercedes', points: 201, wins: 2, class: null },
  ],
  total: 44,
  provenance: { ref: { source: 'standings', params: { series: 'f1', season: 2026 } }, label: 'Standings · Formula 1 · 2026', tier: 'rows', keys: ['standings:f1', 'f1:standings'], rows: 44, ms: 12, run: { id: 'run-1', status: 'ok', finished: '2026-09-17T12:20:04Z', rows: 44, runner: 'warm-live-data#77' } },
};
const series = [
  { slug: 'f1', name: 'Formula 1' },
  { slug: 'wec', name: 'FIA WEC' },
];

beforeEach(() => {
  urls = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    urls.push(url);
    if (url.startsWith('/api/admin/design/data/sources/')) return json(200, preview);
    return json(200, list);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DataSourcesEditor', () => {
  it('lists the fourteen with their parameters, columns, how they are kept fresh, Used on and Changed; opens one with its Data Profile, how it is read, Utilization with Open and History', async () => {
    const onOpenPage = vi.fn();
    render(<DataSourcesEditor series={series} onOpenPage={onOpenPage} />);
    expect(screen.getByRole('heading', { name: 'Data Sources' })).toBeTruthy();
    await waitFor(() => expect(urls).toContain('/api/admin/design/data/sources'));
    await screen.findByText('1 page');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(14);
    const standingsRow = rows.find(r => within(r).queryByText('Standings'))!;
    expect(within(standingsRow).getByText('series · season')).toBeTruthy();
    expect(within(standingsRow).getByText('8')).toBeTruthy();
    expect(within(standingsRow).getByText('the loader, every 20 minutes')).toBeTruthy();
    expect(within(standingsRow).getByText('shipped')).toBeTruthy();
    const authorsRow = rows.find(r => within(r).queryByText('Authors'))!;
    expect(within(authorsRow).getByText('none')).toBeTruthy();
    expect(within(authorsRow).getByText('no page')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Standings' }));
    const open = screen.getByRole('region', { name: 'Data Source: Standings' });
    expect(within(open).getAllByText('Series').length).toBeGreaterThan(0);
    expect(within(open).getAllByText(/^Season/).length).toBeGreaterThan(0);
    for (const key of ['kind', 'position', 'name', 'code', 'team', 'points', 'wins', 'class']) expect(within(open).getAllByText(key).length).toBeGreaterThan(0);
    expect(within(open).getByText(/rows tier/)).toBeTruthy();
    expect(within(open).getByText(/Jolpica API/)).toBeTruthy();
    expect(within(open).getByText('replace')).toBeTruthy();
    fireEvent.click(within(open).getByRole('button', { name: 'Open Monza, a history' }));
    expect(onOpenPage).toHaveBeenCalledWith(MONZA);
    expect(within(open).getByText(/shipped with the code/)).toBeTruthy();
  });

  it('Preview: the parameters as fields with the catalogue’s defaults, Load reads the first rows through the route and says where they came from', async () => {
    render(<DataSourcesEditor series={series} />);
    await screen.findByText('1 page');
    fireEvent.click(screen.getByRole('button', { name: 'Open Standings' }));
    const form = screen.getByRole('form', { name: 'Preview' });
    const seriesField = within(form).getByLabelText('Series') as HTMLSelectElement;
    expect(seriesField.value).toBe('f1');
    expect([...seriesField.options].map(o => o.textContent)).toContain('Formula 1');
    // Only the series the source offers: the picker filters the list given by the catalogue's options.
    expect([...seriesField.options].map(o => o.value)).toEqual(['f1', 'wec']);
    expect((within(form).getByLabelText('Season') as HTMLSelectElement).value).toBe('2026');
    fireEvent.change(seriesField, { target: { value: 'wec' } });
    fireEvent.change(seriesField, { target: { value: 'f1' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Load' }));
    await waitFor(() => expect(urls).toContain('/api/admin/design/data/sources/standings?series=f1&season=2026'));
    await screen.findByText('Andrea Kimi Antonelli');
    expect(screen.getByText('George Russell')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/2 of 44 rows · the rows tier · run warm-live-data#77/);
  });

  it('the Object Browser (the Data workspace) shows the loader’s work in two tiers for a source, in the catalogue’s words', async () => {
    render(<SourceBrowser series={series} mode="data" />);
    await screen.findByRole('button', { name: 'Open Standings' });
    fireEvent.click(screen.getByRole('button', { name: 'Open Standings' }));
    const open = screen.getByRole('region', { name: 'Data Source: Standings' });
    const runs = within(open).getByRole('table', { name: 'The rows tier' });
    expect(within(runs).getByText('Standings · Formula 1 · 2026')).toBeTruthy();
    expect(within(runs).getByText('fine')).toBeTruthy();
    expect(within(runs).getByText('standings:f1')).toBeTruthy();
    const snaps = within(open).getByRole('table', { name: 'The snapshot tier' });
    expect(within(snaps).getByText('f1:standings')).toBeTruthy();
    expect(within(snaps).getByText(/warm-live-data#77/)).toBeTruthy();
    expect(within(snaps).getByText(/F 812ms · W 40ms/)).toBeTruthy();
    // Utilization and History belong to the shared component, not the browser of data.
    expect(within(open).queryByText(/shipped with the code/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Authors' }));
    const authors = screen.getByRole('region', { name: 'Data Source: Authors' });
    expect(within(authors).getByText(/live from the database/)).toBeTruthy();
    expect(within(authors).queryByRole('table', { name: 'The rows tier' })).toBeNull();
  });

  it('says so when the list cannot be read', async () => {
    fetchMock.mockImplementation(async () => json(500, { error: 'down' }));
    render(<DataSourcesEditor series={series} />);
    await screen.findByText(/could not be listed \(HTTP 500\)/);
  });
});
