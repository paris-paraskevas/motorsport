import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The Data workspace's loader: the state of a card from the credentials'
// presence, one service's figures through the reader the code has, the
// one-minute memo and the Refresh that bypasses it, the plain note when a
// reader answers nothing, the connect card that reads nothing.

let ga4Configured = false;
const fetchGa4 = vi.fn();
vi.mock('@/lib/analytics/ga4', () => ({ isGa4Configured: () => ga4Configured, fetchGa4Traffic: (days: number) => fetchGa4(days) }));
vi.mock('@/lib/analytics/gsc', () => ({ isGscConfigured: () => false, fetchGscSearch: async () => null }));
vi.mock('@/lib/analytics/bing', () => ({ isBingConfigured: () => false, fetchBingSearch: async () => null }));
vi.mock('@/lib/analytics/cloudflare', () => ({
  WORKERS_INCLUDED_REQUESTS: 10_000_000,
  isCloudflareUsageConfigured: () => false,
  isCloudflareBillingConfigured: () => false,
  fetchWorkerUsage: async () => null,
  fetchBillableUsage: async () => null,
}));
vi.mock('@/lib/auth/directory', () => ({ accountCount: async () => 3, latestAccounts: async () => [] }));
vi.mock('@/lib/kv', () => ({ kv: { dbsize: async () => 12 } }));
vi.mock('@/lib/push-store', () => ({ listSubscriptions: async () => [{ endpoint: 'a' }, { endpoint: 'b' }] }));

let configured = true;
const counts: Record<string, number> = { page: 59, page_revision: 4, list: 6, list_entry: 30, asset: 0, shortcut: 3, setting: 8, authz_scheme: 4, theme: 6 };
// Newest first, as the loader's table answers an ordered read: f1 fine now, f2
// last fine two days ago (stale), wrc failed, and wec registered but never run.
const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
const runs = [
  { id: 'r4', source_key: 'standings:f1', status: 'ok', rows_written: 34, started_at: new Date().toISOString(), finished_at: new Date().toISOString(), runner: 'warm-live-data#9', error: null },
  { id: 'r3', source_key: 'standings:f2', status: 'ok', rows_written: 12, started_at: twoDaysAgo, finished_at: twoDaysAgo, runner: 'warm-live-data#7', error: null },
  { id: 'r2', source_key: 'standings:wrc', status: 'failed', rows_written: 0, started_at: '2026-09-01T10:00:00Z', finished_at: '2026-09-01T10:00:05Z', runner: 'local', error: 'upstream 503' },
  { id: 'r1', source_key: 'standings:f1', status: 'ok', rows_written: 30, started_at: '2026-09-01T09:00:00Z', finished_at: '2026-09-01T09:00:05Z', runner: 'local', error: null },
];
const sources = [
  { key: 'standings:f1', label: 'Formula 1' },
  { key: 'standings:f2', label: 'Formula 2' },
  { key: 'standings:wec', label: 'WEC' },
  { key: 'standings:wrc', label: 'WRC' },
];
let reads = 0;
type Filter = { k: string; v: unknown; op: 'eq' | 'gte' };
function answer(table: string, filters: Filter[], head: boolean) {
  reads += 1;
  if (table === 'source') return { data: sources, error: null };
  if (table === 'source_run') {
    const rows = runs.filter(r => filters.every(f => (f.op === 'eq' ? (r as Record<string, unknown>)[f.k] === f.v : String((r as Record<string, unknown>)[f.k]) >= String(f.v))));
    return head ? { count: rows.length, error: null } : { data: rows, error: null };
  }
  return { count: counts[table] ?? 0, error: null };
}
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => {
      const filters: Filter[] = [];
      let head = false;
      const q = {
        select: (_cols?: string, o?: { head?: boolean }) => {
          head = Boolean(o?.head);
          return q;
        },
        order: () => q,
        limit: () => q,
        eq: (k: string, v: unknown) => {
          filters.push({ k, v, op: 'eq' });
          return q;
        },
        gte: (k: string, v: unknown) => {
          filters.push({ k, v, op: 'gte' });
          return q;
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(answer(table, filters, head)).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import { DATA_SERVICES, bandOf, findDataService } from './data-services';
import { STALE_AFTER_MINUTES, loadDataIndex, loadDataOverview, loadRunsLog, resetDataMemo, serviceState, sourceState, type RunRow } from './data';

const traffic = {
  users: 9340,
  sessions: 14120,
  pageViews: 41900,
  topPages: [{ path: '/', views: 6102 }],
  topCountries: [{ country: 'Greece', users: 1640 }],
  trend: [1, 2, 3, 4],
};

beforeEach(() => {
  resetDataMemo();
  ga4Configured = false;
  configured = true;
  fetchGa4.mockReset();
  fetchGa4.mockResolvedValue(traffic);
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});
afterEach(() => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe('serviceState and the index', () => {
  it('reads presence, never values: own is own, a cred service is connect until a reader exists, a live reader follows its guard', () => {
    expect(serviceState(findDataService('push')!)).toBe('own');
    expect(serviceState(findDataService('cfzone')!)).toBe('connect');
    expect(serviceState(findDataService('ga4')!)).toBe('connect');
    ga4Configured = true;
    expect(serviceState(findDataService('ga4')!)).toBe('live');
    expect(serviceState(findDataService('auth')!)).toBe('connect');
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    expect(serviceState(findDataService('auth')!)).toBe('live');
    expect(serviceState(findDataService('sb')!)).toBe('live');
    configured = false;
    expect(serviceState(findDataService('sb')!)).toBe('connect');
  });

  it('lists every service with its state and no read time before a read', () => {
    const index = loadDataIndex();
    expect(index.map(e => e.key)).toEqual(DATA_SERVICES.map(s => s.key));
    expect(index.every(e => e.fetchedAt === null)).toBe(true);
  });
});

describe('loadDataOverview', () => {
  it('is null for an unknown key; a connect card reads nothing and says so; a live card reads through its reader', async () => {
    expect(await loadDataOverview('nope')).toBeNull();
    const zone = (await loadDataOverview('cfzone'))!;
    expect(zone.state).toBe('connect');
    expect(zone.kpis).toEqual([]);
    expect(zone.connection).toEqual([
      { name: 'CLOUDFLARE_ZONE_ID', present: false },
      { name: 'CLOUDFLARE_ZONE_ANALYTICS_TOKEN', present: false },
    ]);
    expect(zone.note).toMatch(/Not connected/);
    ga4Configured = true;
    const ga4 = (await loadDataOverview('ga4'))!;
    expect(ga4.state).toBe('live');
    expect(ga4.kpis.map(k => [k.label, k.value])).toEqual([
      ['Users · 28d', '9,340'],
      ['Sessions', '14,120'],
      ['Page views', '41,900'],
    ]);
    expect(ga4.series?.points).toEqual([1, 2, 3, 4]);
    expect(ga4.breakdowns.map(b => b.rows)).toEqual([[['/', '6,102']], [['Greece', '1,640']]]);
    expect(fetchGa4).toHaveBeenCalledWith(28);
    expect(loadDataIndex().find(e => e.key === 'ga4')?.fetchedAt).toBe(ga4.fetchedAt);
  });

  it('keeps an overview for a minute, reads again on fresh, and turns a reader that answers nothing into a plain note', async () => {
    ga4Configured = true;
    const first = (await loadDataOverview('ga4'))!;
    const again = (await loadDataOverview('ga4'))!;
    expect(again.fetchedAt).toBe(first.fetchedAt);
    expect(fetchGa4).toHaveBeenCalledTimes(1);
    await loadDataOverview('ga4', { fresh: true });
    expect(fetchGa4).toHaveBeenCalledTimes(2);
    fetchGa4.mockResolvedValue(null);
    const gone = (await loadDataOverview('ga4', { fresh: true }))!;
    expect(gone.state).toBe('error');
    expect(gone.note).toMatch(/answered nothing/);
    fetchGa4.mockRejectedValue(new Error('boom'));
    const threw = (await loadDataOverview('ga4', { fresh: true }))!;
    expect(threw.state).toBe('error');
    expect(threw.note).toBe('The reader failed: boom');
  });

  it('counts our own tables and folds the loader’s runs to the newest per source', async () => {
    const sb = (await loadDataOverview('sb'))!;
    expect(sb.state).toBe('live');
    expect(sb.kpis.map(k => [k.label, k.value])).toEqual(
      expect.arrayContaining([
        ['Pages', '59'],
        ['Revisions', '4'],
        ['Loads · 24h', '1'],
        ['Sources ok', '1 / 4'],
      ]),
    );
    const loads = sb.breakdowns.find(b => b.title.startsWith('Loads'))!;
    expect(loads.rows.map(r => [r[0], r[1], r[2]])).toEqual([
      ['Formula 1', 'fine', '34'],
      ['Formula 2', 'stale', '12'],
      ['WEC', 'never ran', '—'],
      ['WRC', 'failed', '0'],
    ]);
    // A failed, a stale and a never-run source colour the card amber; the headline is the loader's.
    expect(sb.tone).toBe('warn');
    expect(sb.headline).toMatchObject({ value: '1 / 4', unit: 'sources fine' });
    expect(sb.headline?.context).toMatch(/^The loader last ran \d\d:\d\dZ$/);
    const up = (await loadDataOverview('upstream'))!;
    expect(up.state).toBe('own');
    expect(up.kpis.map(k => [k.label, k.value])).toEqual([
      ['Sources ok', '1 / 4'],
      ['Failed · 24h', '0'],
      ['Loads · 24h', '1'],
    ]);
    expect(up.headline).toEqual({ value: '1', unit: 'loads · 24 hours', context: '1 of 4 sources fine · 1 failed · 1 stale · 1 never ran' });
    expect(bandOf(up.state, up.tone)).toBe('warn');
  });

  it('gives every card a headline: a connect card says how many credentials to add, a live card its one figure', async () => {
    const zone = (await loadDataOverview('cfzone'))!;
    expect(zone.headline).toEqual({ value: '—', unit: '', context: 'Not connected · 2 credentials to add' });
    expect(bandOf(zone.state)).toBe('off');
    ga4Configured = true;
    const ga4 = (await loadDataOverview('ga4'))!;
    expect(ga4.headline).toEqual({ value: '9,340', unit: 'visitors · 28 days', context: '14,120 sessions' });
    fetchGa4.mockResolvedValue({ ...traffic, trend: [10, 10, 10, 10, 10, 10, 10, 11, 11, 11, 11, 11, 11, 11] });
    const grown = (await loadDataOverview('ga4', { fresh: true }))!;
    expect(grown.headline?.context).toBe('Up 10% on the week before');
    fetchGa4.mockResolvedValue(null);
    const gone = (await loadDataOverview('ga4', { fresh: true }))!;
    expect(bandOf(gone.state, gone.tone)).toBe('bad');
    expect(gone.headline?.value).toBe('—');
  });

  it('reads the key-value store and the push subscriptions only when the store is configured', async () => {
    const push = (await loadDataOverview('push'))!;
    expect(push.kpis[0]).toMatchObject({ label: 'Subscriptions', value: '—' });
    process.env.KV_REST_API_URL = 'https://x';
    process.env.KV_REST_API_TOKEN = 't';
    resetDataMemo();
    const withStore = (await loadDataOverview('push'))!;
    expect(withStore.kpis[0]).toMatchObject({ label: 'Subscriptions', value: '2' });
    const ups = (await loadDataOverview('upstash'))!;
    expect(ups.state).toBe('live');
    expect(ups.kpis.map(k => k.value)).toEqual(['12', '2']);
  });
});

describe('the loader’s runs page', () => {
  const run = (over: Partial<RunRow>): RunRow => ({ id: 'x', source: 's', status: 'ok', rows: 1, started: null, finished: null, runner: null, error: null, ...over });

  it('sourceState: never, running, failed, stale past the cut-off, fine within it', () => {
    const now = Date.parse('2026-09-09T12:00:00Z');
    const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
    expect(sourceState(null, null, now)).toBe('never');
    expect(sourceState(run({ status: 'running' }), at(10), now)).toBe('running');
    expect(sourceState(run({ status: 'failed' }), at(10), now)).toBe('failed');
    expect(sourceState(run({ finished: at(STALE_AFTER_MINUTES + 1) }), at(STALE_AFTER_MINUTES + 1), now)).toBe('stale');
    expect(sourceState(run({ finished: at(STALE_AFTER_MINUTES - 1) }), at(STALE_AFTER_MINUTES - 1), now)).toBe('fine');
    expect(sourceState(run({ finished: at(1) }), null, now)).toBe('stale');
  });

  it('folds every registered source to its state, keeps the newest runs with their errors, counts the last day', async () => {
    const log = (await loadRunsLog())!;
    expect(log.sources.map(s => [s.label, s.state])).toEqual([
      ['Formula 1', 'fine'],
      ['Formula 2', 'stale'],
      ['WEC', 'never'],
      ['WRC', 'failed'],
    ]);
    expect(log.sources[1].lastOk).toBe(twoDaysAgo);
    expect(log.sources[3].newest).toMatchObject({ status: 'failed', error: 'upstream 503', runner: 'local' });
    expect(log.runs.map(r => r.id)).toEqual(['r4', 'r3', 'r2', 'r1']);
    expect(log.last24h).toEqual({ runs: 1, failed: 0 });
    expect(log.periodMinutes).toBe(20);
    expect(log.staleAfterMinutes).toBe(65);
  });

  it('is kept for a minute per limit, reads again on fresh, and is null without the tables', async () => {
    reads = 0;
    const first = (await loadRunsLog())!;
    const again = (await loadRunsLog())!;
    expect(again).toBe(first);
    const before = reads;
    await loadRunsLog({ fresh: true });
    expect(reads).toBeGreaterThan(before);
    await loadRunsLog({ limit: 1000 });
    expect(reads).toBeGreaterThan(before + 1);
    configured = false;
    expect(await loadRunsLog({ fresh: true })).toBeNull();
  });
});
