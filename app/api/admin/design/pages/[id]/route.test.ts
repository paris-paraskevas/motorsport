import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// /api/admin/design/pages/<id> (P1.12, Delete Page cascade and soft delete):
// DELETE moves a page made in the designer to Deleted (one conditional update,
// the row returned, its path revalidated); DELETE ?purge=1 removes it for good
// through design_purge_page, refused with the names while a live page names it;
// POST { action: 'reinstate' } brings a deleted page back; PUT refuses a deleted
// page; a page the code serves is refused; an unknown id is 404; admin-only and
// production-only.

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const loadPageDetail = vi.fn();
vi.mock('@/lib/design/page-revisions', () => ({ loadPageDetail: (id: string) => loadPageDetail(id) }));

const resetPageFrameMemo = vi.fn();
vi.mock('@/lib/design/page-frame', () => ({ resetPageFrameMemo: () => resetPageFrameMemo() }));

// A fake database that records every step of the chain and answers with `result`;
// `rpc` records the call and answers with `rpcResult`.
const chain = vi.fn();
const rpc = vi.fn();
let result: { data: unknown; error: { message: string; code?: string } | null } = { data: [], error: null };
let rpcResult: { data: unknown; error: { message: string; code?: string } | null } = { data: true, error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    rpc: async (fn: string, args: unknown) => {
      rpc(fn, args);
      return rpcResult;
    },
    from: (table: string) => {
      const q = {
        update: (values: unknown) => {
          chain('update', table, values);
          return q;
        },
        delete: (opts: unknown) => {
          chain('delete', table, opts);
          return q;
        },
        eq: (k: string, v: unknown) => {
          chain('eq', k, v);
          return q;
        },
        is: (k: string, v: unknown) => {
          chain('is', k, v);
          return q;
        },
        not: (k: string, op: string, v: unknown) => {
          chain('not', k, op, v);
          return q;
        },
        select: (cols: string) => {
          chain('select', cols);
          return q;
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import { DELETE, POST, PUT } from './route';
import { PAGE_COLUMNS } from '@/lib/design/pages';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const ROW = 'a1b2c3d4-0000-4000-8000-000000000010';
const GONE = 'a1b2c3d4-0000-4000-8000-000000000011';
const CODE = 'c0de0002-0000-4000-8000-000000000002';
const STAMP = '2026-09-08T16:00:00.505502+00:00';
const DELETED = '2026-09-13T10:00:00.123456+00:00';
const rowStored = {
  id: ROW,
  path: '/history/monza',
  name: 'Monza, a history',
  kind: 'row',
  group_key: 'editorial',
  template: 'paddock-standard',
  authz_key: 'public',
  title: null,
  rendering: 'cached',
  indexable: false,
  comments: null,
  updated_at: STAMP,
  deleted_at: null,
  deleted_by: null,
};
const rowDetail = { page: { id: ROW, path: '/history/monza', name: 'Monza, a history', kind: 'row', updatedAt: STAMP }, live: null, newest: null, revisions: [] };
const goneDetail = { page: { id: GONE, path: '/history/imola', name: 'Imola', kind: 'row', updatedAt: STAMP, deletedAt: DELETED, deletedBy: 'user_admin' }, live: null, newest: null, revisions: [] };
const codeDetail = { page: { id: CODE, path: '/calendar', name: 'Calendar', kind: 'code', updatedAt: STAMP }, live: null, newest: null, revisions: [] };
const url = (id: string, q = '') => `https://paddock-tracker.com/api/admin/design/pages/${id}${q}`;
const del = (id: string, q = '') => DELETE(new Request(url(id, q), { method: 'DELETE' }), { params: Promise.resolve({ id }) });
const post = (id: string, body: unknown) =>
  POST(new Request(url(id), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const attrs = { name: 'Imola', title: null, group: 'editorial', authz: 'public', indexable: false, comments: null, updatedAt: STAMP };
const put = (id: string, body: unknown) =>
  PUT(new Request(url(id), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  currentUser.mockReset();
  currentUser.mockResolvedValue(admin);
  loadPageDetail.mockReset();
  loadPageDetail.mockImplementation(async (id: string) => (id === ROW ? rowDetail : id === GONE ? goneDetail : id === CODE ? codeDetail : null));
  revalidatePath.mockClear();
  resetPageFrameMemo.mockClear();
  chain.mockClear();
  rpc.mockClear();
  result = { data: [], error: null };
  rpcResult = { data: true, error: null };
  process.env.PADDOCK_ENV = 'production';
});
afterEach(() => {
  delete process.env.PADDOCK_ENV;
});

describe('DELETE /api/admin/design/pages/[id]', () => {
  it('is 404 for a non-admin and 403 off production, touching nothing', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await del(ROW)).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await del(ROW)).status).toBe(403);
    expect(chain).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('moves a page made in the designer to Deleted: one conditional update stamped with who and when, the row returned, the frame memo cleared and its path revalidated', async () => {
    result = { data: [{ ...rowStored, deleted_at: DELETED, deleted_by: 'user_admin' }], error: null };
    const res = await del(ROW);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; id: string; path: string; page: { deletedAt: string; deletedBy: string } };
    expect(json).toMatchObject({ ok: true, id: ROW, path: '/history/monza' });
    expect(json.page).toMatchObject({ id: ROW, deletedAt: DELETED, deletedBy: 'user_admin' });
    expect(chain.mock.calls).toEqual([
      ['update', 'page', { deleted_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), deleted_by: 'user_admin' }],
      ['eq', 'application_key', 'paddock'],
      ['eq', 'id', ROW],
      ['eq', 'kind', 'row'],
      ['is', 'deleted_at', null],
      ['select', PAGE_COLUMNS],
    ]);
    expect(resetPageFrameMemo).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/history/monza');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses a page the code serves and says why, answers 409 for a page already deleted, and is 404 for an unknown page or a row gone meanwhile', async () => {
    const refused = await del(CODE);
    expect(refused.status).toBe(400);
    expect(((await refused.json()) as { error: string }).error).toMatch(/still in the code, as a route file or a registry entry/);
    const again = await del(GONE);
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: string }).error).toMatch(/already deleted/);
    expect(chain).not.toHaveBeenCalled();
    expect((await del('00000000-0000-4000-8000-000000000000')).status).toBe(404);
    result = { data: [], error: null };
    expect((await del(ROW)).status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('?purge=1 removes a deleted page for good through design_purge_page and revalidates; 409 with the names while a live page names it; a live page is not purged', async () => {
    const res = await del(GONE, '?purge=1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: GONE, path: '/history/imola', purged: true });
    expect(rpc).toHaveBeenCalledWith('design_purge_page', { p_application: 'paddock', p_page_id: GONE });
    expect(chain).not.toHaveBeenCalled();
    expect(resetPageFrameMemo).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/history/imola');
    // The function separates the names with a middle dot, since a page's name may hold a comma.
    rpcResult = { data: null, error: { message: 'referenced: Monza, a history · Home', code: 'P0001' } };
    const held = await del(GONE, '?purge=1');
    expect(held.status).toBe(409);
    const body = (await held.json()) as { error: string; pages: string[] };
    expect(body.pages).toEqual(['Monza, a history', 'Home']);
    expect(body.error).toMatch(/named by Monza, a history · Home/);
    rpcResult = { data: false, error: null };
    expect((await del(GONE, '?purge=1')).status).toBe(404);
    const live = await del(ROW, '?purge=1');
    expect(live.status).toBe(409);
    expect(((await live.json()) as { error: string }).error).toMatch(/Delete it first/);
  });
});

describe('POST /api/admin/design/pages/[id] (reinstate)', () => {
  it('clears the deletion of a deleted page, clears the frame memo and revalidates its path; refuses a page that is not deleted; refuses another action', async () => {
    result = { data: [{ ...rowStored, id: GONE, path: '/history/imola', name: 'Imola' }], error: null };
    const res = await post(GONE, { action: 'reinstate' });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; page: { id: string; path: string } };
    expect(json.ok).toBe(true);
    expect(json.page).toMatchObject({ id: GONE, path: '/history/imola' });
    expect(json.page).not.toHaveProperty('deletedAt');
    expect(chain.mock.calls).toEqual([
      ['update', 'page', { deleted_at: null, deleted_by: null }],
      ['eq', 'application_key', 'paddock'],
      ['eq', 'id', GONE],
      ['not', 'deleted_at', 'is', null],
      ['select', PAGE_COLUMNS],
    ]);
    expect(resetPageFrameMemo).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/history/imola');
    chain.mockClear();
    const live = await post(ROW, { action: 'reinstate' });
    expect(live.status).toBe(409);
    expect(((await live.json()) as { error: string }).error).toMatch(/not deleted/);
    expect((await post(GONE, { action: 'dance' })).status).toBe(400);
    expect((await post('00000000-0000-4000-8000-000000000000', { action: 'reinstate' })).status).toBe(404);
    expect(chain).not.toHaveBeenCalled();
  });

  it('is 404 for a non-admin and 403 off production', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await post(GONE, { action: 'reinstate' })).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await post(GONE, { action: 'reinstate' })).status).toBe(403);
    expect(chain).not.toHaveBeenCalled();
  });
});

describe('PUT /api/admin/design/pages/[id] on a deleted page', () => {
  it('writes the live rows alone and answers 409 with the reason when the page is deleted', async () => {
    result = { data: [], error: null };
    const res = await put(GONE, attrs);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toMatch(/deleted.*reinstate/i);
    expect(chain.mock.calls).toContainEqual(['is', 'deleted_at', null]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
