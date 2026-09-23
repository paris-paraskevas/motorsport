import { beforeEach, describe, expect, it, vi } from 'vitest';

// GET /api/admin/design/data/sources (P2.1): the catalogue's Utilization and
// the loader's work behind each source, placed by describeLoaderKey: the rows
// tier's runs and the snapshot tier's fetches. Admin-only. The catalogue
// itself is client-safe, so the route answers only what needs the database.

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

let tables: Record<string, { data: unknown; error: { message: string } | null }> = {};
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(resolve, reject),
      };
      return chain;
    },
  }),
}));
const runsLog = {
  fetchedAt: '2026-09-17T12:30:00.000Z',
  periodMinutes: 20,
  staleAfterMinutes: 65,
  sources: [
    { key: 'standings:f1', label: 'Formula 1', state: 'fine', newest: { id: 'r2', source: 'standings:f1', status: 'ok', rows: 44, started: '2026-09-17T12:20:00Z', finished: '2026-09-17T12:20:04Z', runner: 'warm-live-data#77', error: null }, lastOk: '2026-09-17T12:20:04Z' },
    { key: 'standings:wec', label: 'WEC', state: 'stale', newest: null, lastOk: null },
    { key: 'odd:key', label: 'odd', state: 'never', newest: null, lastOk: null },
  ],
  runs: [],
  last24h: { runs: 2, failed: 0 },
};
const loadRunsLog = vi.fn(async () => runsLog);
vi.mock('@/lib/design/data', () => ({ loadRunsLog: () => loadRunsLog() }));
vi.mock('@/lib/source-snapshot', () => ({
  getSourceHealth: async () => [
    { key: 'f1:standings', fetchedAt: '2026-09-17T12:20:00Z', ok: true, ageMinutes: 10, httpStatus: 200, stale: false },
    { key: 'results:wrc-chart', fetchedAt: '2026-09-16T12:20:00Z', ok: false, ageMinutes: 1450, httpStatus: 503, stale: true },
    { key: 'paddock:odd', fetchedAt: null, ok: true, ageMinutes: null, httpStatus: null, stale: false },
  ],
  readSnapshotMeta: async () => ({ 'f1:standings': { run: 'warm-live-data#77', at: '2026-09-17T12:20:00.000Z', F: 812, W: 40 } }),
}));

import { GET } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const MONZA = 'a1b2c3d4-0000-4000-8000-000000000002';
const region = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({ id, kind, title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, ...extra });

describe('GET /api/admin/design/data/sources', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    tables = {
      page: { data: [{ id: MONZA, path: '/history/monza', name: 'Monza, a history' }], error: null },
      page_revision: {
        data: [{ page_id: MONZA, created_at: '2026-09-17T12:00:00Z', published_at: null, document: { version: 2, actions: [], regions: [region('changed', 'component', { component: 'home.changed', settings: { rows: 5 }, source: 'standings?series=f1&season=2026' })] } }],
        error: null,
      },
    };
  });

  it('is not found for anyone but an administrator', async () => {
    currentUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });

  it('lists the fourteen with Utilization and the loader’s work behind each, in the catalogue’s words; a key the vocabulary lacks is left out', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sources: { key: string; usedOn: unknown[]; runs: { key: string; label: string; state: string }[]; snapshots: { key: string; label: string; ok: boolean; stale: boolean; meta: unknown }[] }[] };
    expect(body.sources.map(s => s.key)).toEqual(['series', 'season', 'standings', 'results', 'rounds', 'sessions', 'drivers', 'teams', 'posts', 'news', 'authors', 'releases', 'tracks', 'weekends']);
    const standings = body.sources.find(s => s.key === 'standings')!;
    expect(standings.usedOn).toEqual([{ id: MONZA, path: '/history/monza', name: 'Monza, a history', refs: ['standings?series=f1&season=2026'] }]);
    expect(standings.runs.map(r => [r.key, r.label, r.state])).toEqual([
      ['standings:f1', 'Standings · Formula 1 · 2026', 'fine'],
      ['standings:wec', 'Standings · FIA WEC · 2026', 'stale'],
    ]);
    expect(standings.snapshots).toEqual([{ key: 'f1:standings', label: 'Standings · Formula 1 · 2026', fetchedAt: '2026-09-17T12:20:00Z', ok: true, stale: false, meta: { run: 'warm-live-data#77', at: '2026-09-17T12:20:00.000Z', F: 812, W: 40 } }]);
    const results = body.sources.find(s => s.key === 'results')!;
    expect(results.runs).toEqual([]);
    expect(results.snapshots).toEqual([{ key: 'results:wrc-chart', label: 'Results · WRC · 2026 · chart', fetchedAt: '2026-09-16T12:20:00Z', ok: false, stale: true, meta: null }]);
    expect(body.sources.find(s => s.key === 'authors')).toEqual({ key: 'authors', usedOn: [], runs: [], snapshots: [] });
  });

  it('answers the list when the runs cannot be read, answered null or thrown: the loader’s work is empty, Utilization stands', async () => {
    loadRunsLog.mockResolvedValueOnce(null as unknown as typeof runsLog);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sources: { key: string; usedOn: unknown[]; runs: unknown[] }[] };
    expect(body.sources.find(s => s.key === 'standings')!.runs).toEqual([]);
    expect(body.sources.find(s => s.key === 'standings')!.usedOn).toHaveLength(1);
    loadRunsLog.mockRejectedValueOnce(new Error('down'));
    const thrown = await GET();
    expect(thrown.status).toBe(200);
    const again = (await thrown.json()) as { sources: { key: string; runs: unknown[]; snapshots: unknown[] }[] };
    expect(again.sources.find(s => s.key === 'standings')!.runs).toEqual([]);
    expect(again.sources.find(s => s.key === 'standings')!.snapshots).toHaveLength(1);
  });
});
