import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock('@/lib/search-index', () => ({
  buildSearchIndex: async () => [{ type: 'page', title: 'Calendar', subtitle: 'Every series, one timeline', url: '/calendar', keywords: 'race schedule next' }],
}));

const update = vi.fn();
const del = vi.fn();
let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let updated: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let deleted: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: () => {
      const read = {
        select: () => read,
        eq: () => read,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      const chain = (record: (c: string, v: unknown) => void, answer: () => unknown) => {
        const c: Record<string, unknown> = {};
        Object.assign(c, { eq: (col: string, val: unknown) => (record(col, val), c), select: async () => answer() });
        return c;
      };
      return {
        select: () => read,
        update: (payload: unknown) => {
          update(payload);
          return chain(() => {}, () => updated);
        },
        delete: () => chain((c, v) => del(c, v), () => deleted),
      };
    },
  }),
}));

import { DELETE, PUT } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const STAMP = '2026-09-08T18:00:00.505502+00:00';
const A = 'a1b2c3d4-0000-4000-8000-000000000001';
const stored = { id: A, question: 'Who leads the F1 standings?', seq: 10, leads_to: '/series/f1/standings', leads_title: 'Formula 1 standings', updated_at: STAMP };
const put = (id: string, body: unknown) =>
  PUT(
    new Request(`https://paddock-tracker.com/api/admin/design/search-hints/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) },
  );
const remove = (id: string) => DELETE(new Request(`https://paddock-tracker.com/api/admin/design/search-hints/${id}`, { method: 'DELETE' }), { params: Promise.resolve({ id }) });

describe('/api/admin/design/search-hints/[id]', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    update.mockReset();
    del.mockReset();
    revalidatePath.mockReset();
    rows = { data: [stored], error: null };
    updated = { data: [{ ...stored, seq: 30, updated_at: '2026-09-08T18:10:00+00:00' }], error: null };
    deleted = { data: [{ id: A }], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('PUT and DELETE are 404 for a non-admin and for an id that is not one, 403 off production', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await put(A, { question: 'x', seq: 10, updatedAt: STAMP })).status).toBe(404);
    expect((await remove(A)).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    expect((await put('nope', { question: 'x', seq: 10, updatedAt: STAMP })).status).toBe(404);
    delete process.env.PADDOCK_ENV;
    expect((await put(A, { question: 'x', seq: 10, updatedAt: STAMP })).status).toBe(403);
    expect((await remove(A)).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it('PUT reorders without asking the search, rewords through the search (422 when nowhere), and answers 409 with the rows when the stamp moved', async () => {
    let res = await put(A, { question: 'Who leads the F1 standings?', seq: 30, updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenLastCalledWith({ question: 'Who leads the F1 standings?', seq: 30, leads_to: '/series/f1/standings', leads_title: 'Formula 1 standings', updated_by: 'user_admin' });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    res = await put(A, { question: 'zzzz qqqq', seq: 10, updatedAt: STAMP });
    expect(res.status).toBe(422);
    res = await put(A, { question: 'When is the next race?', seq: 10, updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ question: 'When is the next race?', leads_to: '/calendar', leads_title: 'Calendar' }));
    updated = { data: [], error: null };
    res = await put(A, { question: 'Who leads the F1 standings?', seq: 40, updatedAt: 'old' });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { current: unknown[] }).current).toHaveLength(1);
    rows = { data: [], error: null };
    expect((await put(A, { question: 'x', seq: 1, updatedAt: STAMP })).status).toBe(404);
  });

  it('PUT refuses a bad question, a non-integer seq and a missing stamp before the database', async () => {
    expect((await put(A, { question: ' ', seq: 10, updatedAt: STAMP })).status).toBe(400);
    expect((await put(A, { question: 'x', seq: 1.5, updatedAt: STAMP })).status).toBe(400);
    expect((await put(A, { question: 'x', seq: 10 })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('DELETE removes the row and revalidates the layout, 404 when it is gone', async () => {
    expect((await remove(A)).status).toBe(200);
    expect(del.mock.calls).toEqual([
      ['application_key', 'paddock'],
      ['id', A],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    deleted = { data: [], error: null };
    expect((await remove(A)).status).toBe(404);
  });
});
