import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// A fake `page` table: `pageRows` answers the reads; `update` records its
// payload and answers with `updated` rows (empty = the stamp moved).
let pageRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let updated: { data: unknown; error: { code?: string; message: string } | null } = { data: [], error: null };
const update = vi.fn();
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: (table: string) => {
      const result = table === 'page' ? pageRows : { data: [], error: null };
      const read: Record<string, unknown> = {};
      Object.assign(read, {
        select: () => read,
        eq: () => read,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      });
      return {
        select: () => read,
        update: (payload: Record<string, unknown>) => {
          update(payload);
          const w: Record<string, unknown> = {};
          Object.assign(w, { eq: () => w, select: async () => updated });
          return w;
        },
      };
    },
  }),
}));

import { GET, PUT } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const ID = 'a1b2c3d4-0000-4000-8000-000000000010';
const STAMP = '2026-09-08T16:00:00.505502+00:00';
const row = { id: ID, path: '/history/monza', name: 'Monza, a history', kind: 'row', group_key: 'editorial', template: 'paddock-standard', authz_key: 'public', title: null, rendering: 'cached', indexable: false, comments: null, updated_at: STAMP };
const get = (id: string) => GET(new Request(`https://paddock-tracker.com/api/admin/design/pages/${id}`), { params: Promise.resolve({ id }) });
const put = (id: string, body: unknown) =>
  PUT(
    new Request(`https://paddock-tracker.com/api/admin/design/pages/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
const attrs = { name: 'Monza', title: 'Monza, a history of speed', group: 'editorial', authz: 'signed_in', indexable: true, comments: null, updatedAt: STAMP };
const codeRow = { ...row, id: 'c0de0000-0000-4000-8000-000000000008', path: '/series/[slug]/[tab]', name: 'Series tab', kind: 'code', group_key: 'series', indexable: true };

describe('/api/admin/design/pages/[id]', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    revalidatePath.mockReset();
    update.mockReset();
    pageRows = { data: [row], error: null };
    updated = { data: [{ ...row, name: 'Monza', title: 'Monza, a history of speed', authz_key: 'signed_in', indexable: true, updated_at: '2026-09-08T18:00:00+00:00' }], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin and for a page that does not exist, and hands an admin the detail', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await get(ID)).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    pageRows = { data: [], error: null };
    expect((await get(ID)).status).toBe(404);
    pageRows = { data: [row], error: null };
    const res = await get(ID);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { page: { path: string }; live: unknown; newest: unknown; revisions: unknown[] };
    expect(json.page.path).toBe('/history/monza');
    expect(json.live).toBeNull();
    expect(json.newest).toBeNull();
    expect(json.revisions).toEqual([]);
  });

  it('PUT is 404 for a non-admin and 403 off production, before anything is written', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await put(ID, attrs)).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await put(ID, attrs)).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('PUT refuses an empty name, a long title, long comments, an unknown group, a scheme that is not a key, a non-boolean indexable and a missing stamp', async () => {
    expect((await put(ID, { ...attrs, name: ' ' })).status).toBe(400);
    expect((await put(ID, { ...attrs, title: 'x'.repeat(121) })).status).toBe(400);
    expect((await put(ID, { ...attrs, comments: 'x'.repeat(501) })).status).toBe(400);
    expect((await put(ID, { ...attrs, group: 'nope' })).status).toBe(400);
    expect((await put(ID, { ...attrs, authz: 'Not A Key' })).status).toBe(400);
    expect((await put(ID, { ...attrs, indexable: 'yes' })).status).toBe(400);
    expect((await put(ID, { ...attrs, updatedAt: undefined })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('PUT updates the row on its stamp, revalidates the served path and answers the row as stored', async () => {
    const res = await put(ID, attrs);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ name: 'Monza', title: 'Monza, a history of speed', group_key: 'editorial', authz_key: 'signed_in', indexable: true, comments: null, updated_by: 'user_admin' });
    expect(revalidatePath).toHaveBeenCalledWith('/history/monza');
    const json = (await res.json()) as { page: { name: string; authz: string; indexable: boolean; updatedAt: string } };
    expect(json.page).toMatchObject({ name: 'Monza', authz: 'signed_in', indexable: true, updatedAt: '2026-09-08T18:00:00+00:00' });
  });

  it('PUT stores Everyone as the public scheme, an empty title as null and trimmed comments', async () => {
    await put(ID, { ...attrs, authz: '', title: '  ', comments: '  For the Monza weekend.  ' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ authz_key: 'public', title: null, comments: 'For the Monza weekend.' }));
  });

  it("PUT accepts a page the code serves and revalidates a dynamic route as a whole (the Page Designer plan, PR 1)", async () => {
    pageRows = { data: [codeRow], error: null };
    updated = { data: [{ ...codeRow, title: 'Standings and results', updated_at: '2026-09-08T18:00:00+00:00' }], error: null };
    const res = await put(codeRow.id, { ...attrs, name: 'Series tab', title: 'Standings and results', group: 'series', authz: 'public' });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Standings and results', authz_key: 'public' }));
    expect(revalidatePath).toHaveBeenCalledWith('/series/[slug]/[tab]', 'page');
    const json = (await res.json()) as { page: { kind: string; path: string; title: string } };
    expect(json.page).toMatchObject({ kind: 'code', path: '/series/[slug]/[tab]', title: 'Standings and results' });
  });

  it('PUT answers 409 with the detail as stored when the stamp moved, 404 when the page is gone, and 400 when the scheme does not exist', async () => {
    updated = { data: [], error: null };
    const res = await put(ID, attrs);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { current: { page: { path: string } } }).current.page.path).toBe('/history/monza');
    expect(revalidatePath).not.toHaveBeenCalled();
    pageRows = { data: [], error: null };
    expect((await put(ID, attrs)).status).toBe(404);
    updated = { data: null, error: { code: '23503', message: 'violates foreign key constraint "page_authz_key_fkey"' } };
    expect((await put(ID, attrs)).status).toBe(400);
  });
});
