import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// DELETE /api/admin/design/pages/<id>: admin-only and production-only; a page
// made in the designer goes with its revisions and its path is revalidated; a
// page the code serves is refused; an unknown id is 404.

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const loadPageDetail = vi.fn();
vi.mock('@/lib/design/page-revisions', () => ({ loadPageDetail: (id: string) => loadPageDetail(id) }));

const resetPageFrameMemo = vi.fn();
vi.mock('@/lib/design/page-frame', () => ({ resetPageFrameMemo: () => resetPageFrameMemo() }));

// A fake database that records the delete chain and answers with the count.
const chain = vi.fn();
let deleteResult: { error: { message: string } | null; count: number | null } = { error: null, count: 1 };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: (table: string) => {
      const q = {
        delete: (opts: unknown) => {
          chain('delete', table, opts);
          return q;
        },
        eq: (k: string, v: unknown) => {
          chain('eq', k, v);
          return q;
        },
        update: () => q,
        select: () => q,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(deleteResult).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import { DELETE } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const ROW = 'a1b2c3d4-0000-4000-8000-000000000010';
const CODE = 'c0de0002-0000-4000-8000-000000000002';
const rowDetail = { page: { id: ROW, path: '/history/monza', name: 'Monza, a history', kind: 'row' }, live: null, newest: null, revisions: [] };
const codeDetail = { page: { id: CODE, path: '/calendar', name: 'Calendar', kind: 'code' }, live: null, newest: null, revisions: [] };
const del = (id: string) => DELETE(new Request(`https://paddock-tracker.com/api/admin/design/pages/${id}`, { method: 'DELETE' }), { params: Promise.resolve({ id }) });

describe('DELETE /api/admin/design/pages/[id]', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    loadPageDetail.mockReset();
    loadPageDetail.mockImplementation(async (id: string) => (id === ROW ? rowDetail : id === CODE ? codeDetail : null));
    revalidatePath.mockClear();
    resetPageFrameMemo.mockClear();
    chain.mockClear();
    deleteResult = { error: null, count: 1 };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin and 403 off production, touching nothing', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await del(ROW)).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await del(ROW)).status).toBe(403);
    expect(chain).not.toHaveBeenCalled();
  });

  it('deletes a page made in the designer within the application, clears the frame memo and revalidates its path', async () => {
    const res = await del(ROW);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: ROW, path: '/history/monza' });
    expect(chain.mock.calls).toEqual([
      ['delete', 'page', { count: 'exact' }],
      ['eq', 'application_key', 'paddock'],
      ['eq', 'id', ROW],
      ['eq', 'kind', 'row'],
    ]);
    expect(resetPageFrameMemo).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/history/monza');
  });

  it('refuses a page the code serves and says why, and is 404 for an unknown page or a row already gone', async () => {
    const refused = await del(CODE);
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { error: string }).error).toMatch(/still in the code, as a route file or a registry entry/);
    expect(chain).not.toHaveBeenCalled();
    expect((await del('00000000-0000-4000-8000-000000000000')).status).toBe(404);
    deleteResult = { error: null, count: 0 };
    expect((await del(ROW)).status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
