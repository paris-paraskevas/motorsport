import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// A fake `saved_view` table: `rows` answers the reads; `update` and `remove` record their payload and filters and answer
// with `touched` (the rows the conditional statement reached).
const update = vi.fn();
const remove = vi.fn();
const filters = vi.fn();
let touched: unknown[] = [];
let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: () => {
      const read = {
        select: () => read,
        eq: () => read,
        is: () => read,
        order: () => read,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
      };
      const chain = {
        eq: (col: string, val: unknown) => {
          filters(col, val);
          return chain;
        },
        select: async () => ({ data: touched, error: null }),
      };
      return {
        select: () => read,
        update: (payload: unknown) => {
          update(payload);
          return chain;
        },
        delete: () => {
          remove();
          return chain;
        },
      };
    },
  }),
}));
vi.mock('@/lib/design/pages', () => ({ loadPagesForEditing: async () => [{ id: 'p1', path: '/history/monza', name: 'Monza' }] }));
const REGION = { id: 't', kind: 'component', component: 'data.region', title: '', settings: { preset: 'drivers', view: 'table', rows: 10, heading: '' }, source: 'standings?series=f1&season=2026' };
vi.mock('@/lib/design/live-page', () => ({
  loadLivePage: async (path: string) =>
    path === '/history/monza' ? { page: { id: 'p1', path }, revisionId: 'r', publishedAt: '2026-09-23T10:00:00Z', document: { version: 1, actions: [], regions: [REGION] } } : null,
}));

import { DELETE, PUT } from './route';

const admin = { id: 'user_admin', role: 'admin' };
const STAMP = '2026-09-23T21:30:00.505502+00:00';
const NEXT = '2026-09-23T21:45:00.000001+00:00';
const stored = { key: 'top-five', page_id: 'p1', region_id: 't', name: 'Top five', definition: { sort: { column: 'points', desc: true }, filters: [] }, seq: 10, updated_at: STAMP };

const params = (key: string) => ({ params: Promise.resolve({ key }) });
const call = (method: 'PUT' | 'DELETE', key: string, body: unknown) => {
  const req = new Request(`https://paddock-tracker.com/api/admin/design/views/${key}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return method === 'PUT' ? PUT(req, params(key)) : DELETE(req, params(key));
};

describe('/api/admin/design/views/[key]', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    update.mockReset();
    remove.mockReset();
    filters.mockReset();
    revalidatePath.mockReset();
    touched = [{ updated_at: NEXT, key: 'top-five' }];
    rows = { data: [stored], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin, for a key outside the rule and for a key not stored; 403 off production', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await call('PUT', 'top-five', { name: 'x', updatedAt: STAMP })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    expect((await call('PUT', 'Not A Key', { name: 'x', updatedAt: STAMP })).status).toBe(404);
    expect((await call('PUT', 'unknown', { name: 'x', updatedAt: STAMP })).status).toBe(404);
    delete process.env.PADDOCK_ENV;
    expect((await call('PUT', 'top-five', { name: 'x', updatedAt: STAMP })).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a missing stamp, an empty name, a bad definition and a seq out of range before the database, then writes one conditional update with the definition re-bound and revalidates the page', async () => {
    expect((await call('PUT', 'top-five', { name: 'x' })).status).toBe(400);
    expect((await call('PUT', 'top-five', { name: '  ', updatedAt: STAMP })).status).toBe(400);
    expect((await call('PUT', 'top-five', { definition: 'filter=nope', updatedAt: STAMP })).status).toBe(400);
    expect((await call('PUT', 'top-five', { seq: 0, updatedAt: STAMP })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
    const res = await call('PUT', 'top-five', { name: ' Top 5 ', definition: 'sort=name&cols=name,points&filter=team.eq:Mercedes&filter=name.gt:2', seq: 20, updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      name: 'Top 5',
      definition: { sort: { column: 'name', desc: false }, cols: ['name', 'points'], filters: [{ column: 'team', op: 'eq', value: 'Mercedes' }] },
      seq: 20,
      updated_by: 'user_admin',
    });
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['key', 'top-five'],
      ['updated_at', STAMP],
    ]);
    const json = (await res.json()) as { view: { name: string; seq: number; updatedAt: string; pageId: string } };
    expect(json.view).toMatchObject({ name: 'Top 5', seq: 20, updatedAt: NEXT, pageId: 'p1' });
    expect(revalidatePath).toHaveBeenCalledWith('/history/monza');
  });

  it('answers 409 with the current list when no row matched the stamp', async () => {
    touched = [];
    const res = await call('PUT', 'top-five', { name: 'x', updatedAt: 'old' });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { current: { key: string }[] | null }).current?.map(v => v.key)).toEqual(['top-five']);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('DELETE removes a row on its stamp, revalidates the page, and answers 409 when it moved and 400 without a stamp', async () => {
    const res = await call('DELETE', 'top-five', { updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(filters.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['key', 'top-five'],
      ['updated_at', STAMP],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/history/monza');
    touched = [];
    expect((await call('DELETE', 'top-five', { updatedAt: 'old' })).status).toBe(409);
    expect((await call('DELETE', 'top-five', {})).status).toBe(400);
    expect((await call('DELETE', 'unknown', { updatedAt: STAMP })).status).toBe(404);
  });
});
