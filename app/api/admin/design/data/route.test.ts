import { beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));
const loadDataOverview = vi.fn();
vi.mock('@/lib/design/data', () => ({
  loadDataIndex: () => [
    { key: 'ga4', state: 'connect', fetchedAt: null },
    { key: 'push', state: 'own', fetchedAt: '2026-09-09T06:00:00.000Z' },
  ],
  loadDataOverview: (key: string, opts: unknown) => loadDataOverview(key, opts),
}));

import { GET as INDEX } from './route';
import { GET as ONE } from './[key]/route';

const admin = { id: 'user_admin', role: 'admin' };
const one = (key: string, query = '') => ONE(new Request(`https://paddock-tracker.com/api/admin/design/data/${key}${query}`), { params: Promise.resolve({ key }) });

describe('/api/admin/design/data', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    loadDataOverview.mockReset();
    loadDataOverview.mockImplementation(async (key: string) => ({ key, state: 'own', fetchedAt: 'now', kpis: [], series: null, breakdowns: [], connection: [] }));
  });

  it('the index is 404 for a non-admin, else every service with its state', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await INDEX()).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    const res = await INDEX();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { services: { key: string }[] }).services.map(s => s.key)).toEqual(['ga4', 'push']);
  });

  it('a service is 404 for a non-admin and for an unknown key, else its overview, with Refresh passed through as fresh', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await one('ga4')).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    expect((await one('nope')).status).toBe(404);
    expect(loadDataOverview).not.toHaveBeenCalled();
    const res = await one('ga4');
    expect(res.status).toBe(200);
    expect(((await res.json()) as { key: string }).key).toBe('ga4');
    expect(loadDataOverview).toHaveBeenLastCalledWith('ga4', { fresh: false });
    await one('ga4', '?fresh=1');
    expect(loadDataOverview).toHaveBeenLastCalledWith('ga4', { fresh: true });
  });
});
