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
vi.mock('@clerk/nextjs/server', () => ({ clerkClient: async () => ({ users: { getCount: async () => 3, getUserList: async () => ({ data: [] }) } }) }));
vi.mock('@/lib/kv', () => ({ kv: { dbsize: async () => 12 } }));
vi.mock('@/lib/push-store', () => ({ listSubscriptions: async () => [{ endpoint: 'a' }, { endpoint: 'b' }] }));

let configured = true;
const counts: Record<string, number> = { page: 59, page_revision: 4, list: 6, list_entry: 30, asset: 0, shortcut: 3, setting: 8, authz_scheme: 4, theme: 6 };
const runs = [
  { source_key: 'standings:f1', status: 'ok', rows_written: 34, started_at: new Date().toISOString(), finished_at: new Date().toISOString() },
  { source_key: 'standings:wrc', status: 'failed', rows_written: 0, started_at: '2026-09-01T10:00:00Z', finished_at: '2026-09-01T10:00:05Z' },
  { source_key: 'standings:f1', status: 'ok', rows_written: 30, started_at: '2026-09-01T09:00:00Z', finished_at: '2026-09-01T09:00:05Z' },
];
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => {
      const q = {
        select: () => q,
        order: () => q,
        limit: () => q,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(table === 'source_run' ? { data: runs, error: null } : { count: counts[table] ?? 0, error: null }).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import { DATA_SERVICES, findDataService } from './data-services';
import { loadDataIndex, loadDataOverview, resetDataMemo, serviceState } from './data';

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
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});
afterEach(() => {
  delete process.env.CLERK_SECRET_KEY;
});

describe('serviceState and the index', () => {
  it('reads presence, never values: own is own, a cred service is connect until a reader exists, a live reader follows its guard', () => {
    expect(serviceState(findDataService('push')!)).toBe('own');
    expect(serviceState(findDataService('cfzone')!)).toBe('connect');
    expect(serviceState(findDataService('ga4')!)).toBe('connect');
    ga4Configured = true;
    expect(serviceState(findDataService('ga4')!)).toBe('live');
    expect(serviceState(findDataService('clerk')!)).toBe('connect');
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    expect(serviceState(findDataService('clerk')!)).toBe('live');
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
        ['Sources ok', '1 / 2'],
      ]),
    );
    const loads = sb.breakdowns.find(b => b.title.startsWith('Loads'))!;
    expect(loads.rows.map(r => [r[0], r[1], r[2]])).toEqual([
      ['standings:f1', 'ok', '34'],
      ['standings:wrc', 'failed', '0'],
    ]);
    const up = (await loadDataOverview('upstream'))!;
    expect(up.state).toBe('own');
    expect(up.kpis.map(k => k.value)).toEqual(['1 / 2', '1', '1']);
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
