import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const rpc = vi.fn();
const STAMP = '2026-09-08T16:00:00.505502+00:00';
const ID = 'a1b2c3d4-0000-4000-8000-000000000010';
const pageRow = {
  id: ID,
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
};
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    rpc: (fn: string, args: unknown) => rpc(fn, args),
    from: (table: string) => {
      const result = table === 'page' ? { data: [pageRow], error: null } : { data: [], error: null };
      const q = {
        select: () => q,
        eq: () => q,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import { POST } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const ASSET = 'a1b2c3d4-0000-4000-8000-000000000001';
const DOC = {
  version: 1,
  regions: [
    { id: 'intro', kind: 'static', title: 'Monza', position: 'body', seq: 10, column: 1, span: 8, text: 'Opened in 1922. {shortcut:times.local}' },
    { id: 'photo', kind: 'image', position: 'body', seq: 20, column: 9, span: 4, assetId: ASSET, alt: 'The grid' },
    { id: 'more', kind: 'list', position: 'right', seq: 10, column: 1, span: 12, listKey: 'footer-site', authz: 'signed_in' },
  ],
};
const call = (id: string, body: unknown) =>
  POST(
    new Request(`https://paddock-tracker.com/api/admin/design/pages/${id}/revisions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

describe('/api/admin/design/pages/[id]/revisions', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    rpc.mockReset();
    revalidatePath.mockReset();
    rpc.mockResolvedValue({ data: [{ id: 'b1b2c3d4-0000-4000-8000-000000000002', created_at: '2026-09-08T16:05:00.000001+00:00', published_at: null }], error: null });
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('is 404 for a non-admin and 403 off production, before the function is called', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await call(ID, { document: DOC, action: 'draft', base: null })).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await call(ID, { document: DOC, action: 'draft', base: null })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses a bad action, a bad base and a document with problems, before the function is called', async () => {
    expect((await call(ID, { document: DOC, action: 'save' })).status).toBe(400);
    expect((await call(ID, { document: DOC, action: 'publish', base: 42 })).status).toBe(400);
    const bad = await call(ID, { document: { version: 1, regions: [{ id: 'x', kind: 'image', position: 'body', seq: 10, column: 1, span: 12 }] }, action: 'draft' });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { problems: string[] }).problems).toEqual(['region x: the image must name one of your photos']);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('saves a draft through the function with the parsed document and the projected references', async () => {
    const res = await call(ID, { document: DOC, action: 'draft', base: null });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe('design_save_page_revision');
    expect(args.p_application).toBe('paddock');
    expect(args.p_page_id).toBe(ID);
    expect(args.p_base).toBeNull();
    expect(args.p_publish).toBe(false);
    expect(args.p_actor).toBe('user_admin');
    expect((args.p_document as { regions: { id: string }[] }).regions.map(r => r.id)).toEqual(['intro', 'photo', 'more']);
    expect(args.p_refs).toEqual([
      { kind: 'list', key: 'footer-site' },
      { kind: 'asset', key: ASSET },
      { kind: 'shortcut', key: 'times.local' },
      { kind: 'authz', key: 'signed_in' },
    ]);
    const json = (await res.json()) as { revision: { id: string; publishedAt: string | null }; refs: { lists: string[] } };
    expect(json.revision.publishedAt).toBeNull();
    expect(json.refs.lists).toEqual(['footer-site']);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('publishes on the base it was given and revalidates the served path, and answers 409 with the current detail when the function says stale', async () => {
    const base = 'b1b2c3d4-0000-4000-8000-000000000001';
    rpc.mockResolvedValueOnce({ data: [{ id: 'b1b2c3d4-0000-4000-8000-000000000003', created_at: '2026-09-08T16:06:00+00:00', published_at: '2026-09-08T16:06:00+00:00' }], error: null });
    expect((await call(ID, { document: DOC, action: 'publish', base })).status).toBe(200);
    expect((rpc.mock.calls[0] as [string, Record<string, unknown>])[1]).toMatchObject({ p_base: base, p_publish: true });
    expect(revalidatePath).toHaveBeenCalledWith('/history/monza');
    rpc.mockResolvedValue({ data: null, error: { message: 'stale', code: 'P0001' } });
    const res = await call(ID, { document: DOC, action: 'publish', base: 'old' });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { current: { page: { path: string } } };
    expect(json.current.page.path).toBe('/history/monza');
  });

  it('answers 404 for a page that is not a row page, and 400 when the layout names a row that does not exist', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'no such row page', code: 'P0002' } });
    expect((await call(ID, { document: DOC, action: 'draft' })).status).toBe(404);
    rpc.mockResolvedValue({ data: null, error: { message: 'insert or update on table "page_revision_ref" violates foreign key constraint', code: '23503' } });
    const res = await call(ID, { document: DOC, action: 'draft' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/does not exist/);
  });
});
