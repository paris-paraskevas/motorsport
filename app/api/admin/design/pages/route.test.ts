import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const resetPageFrameMemo = vi.fn();
vi.mock('@/lib/design/page-frame', () => ({ resetPageFrameMemo: () => resetPageFrameMemo() }));

// A deleted, reinstated or purged page may be named by the shell's lists (P1.12 B1): the layout is revalidated and this isolate's lists memo dropped.
const resetNavListsMemo = vi.fn();
vi.mock('@/lib/design/lists', () => ({ resetNavListsMemo: () => resetNavListsMemo() }));

// A fake database: `rows` answers the reads of the live `page` rows, `deleted`
// the reads that ask for the deleted ones (a `.not('deleted_at', …)` step,
// P1.12); `rpc` records every function call and answers design_create_page
// with a row built from its arguments, design_purge_page with `purgeAnswers`
// by page id, or with `rpcError`.
const rpc = vi.fn();
let rpcError: { code?: string; message: string } | null = null;
let purgeAnswers: Record<string, { data: unknown; error: { message: string } | null }> = {};
let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let deleted: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const STAMP = '2026-09-08T16:00:00.505502+00:00';
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpc(fn, args);
      if (fn === 'design_purge_page') return purgeAnswers[String(args.p_page_id)] ?? { data: true, error: null };
      if (rpcError) return { data: null, error: rpcError };
      return {
        data: {
          id: 'a1b2c3d4-0000-4000-8000-000000000010',
          application_key: args.p_application,
          path: args.p_path,
          name: args.p_name,
          kind: 'row',
          group_key: args.p_group,
          mode: 'normal',
          template: 'paddock-standard',
          authz_key: 'public',
          title: null,
          rendering: 'cached',
          indexable: false,
          css: {},
          comments: null,
          created_at: STAMP,
          updated_at: STAMP,
          updated_by: args.p_actor,
          deleted_at: null,
          deleted_by: null,
        },
        error: null,
      };
    },
    from: () => {
      let wantsDeleted = false;
      const read = {
        select: () => read,
        eq: () => read,
        is: () => read,
        order: () => read,
        not: (col: string) => {
          if (col === 'deleted_at') wantsDeleted = true;
          return read;
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(wantsDeleted ? deleted : rows).then(resolve, reject),
      };
      return read;
    },
  }),
}));

import { DELETE, GET, POST } from './route';
import { CODE_PAGES } from '@/lib/design/page-registry';
import { pageTemplate } from '@/lib/design/page-templates';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const existingRow = {
  id: 'a1b2c3d4-0000-4000-8000-000000000011',
  path: '/history/spa',
  name: 'Spa, a history',
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
const FRESH = 'a1b2c3d4-0000-4000-8000-000000000021';
const EXPIRED = 'a1b2c3d4-0000-4000-8000-000000000022';
const NOW = Date.parse('2026-09-15T12:00:00.000Z');
const deletedFresh = { ...existingRow, id: FRESH, path: '/history/imola', name: 'Imola', deleted_at: '2026-09-13T10:00:00.000+00:00', deleted_by: 'user_admin' };
const deletedExpired = { ...existingRow, id: EXPIRED, path: '/history/zolder', name: 'Zolder', deleted_at: '2026-08-01T10:00:00.000+00:00', deleted_by: 'user_admin' };
const post = (body: unknown) =>
  POST(
    new Request('https://paddock-tracker.com/api/admin/design/pages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
const del = (q: string) => DELETE(new Request(`https://paddock-tracker.com/api/admin/design/pages${q}`, { method: 'DELETE' }));
const monza = { name: 'Monza, a history', path: '/history/monza', group: 'editorial', template: 'article' };

describe('/api/admin/design/pages', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    rpc.mockReset();
    rpcError = null;
    purgeAnswers = {};
    rows = { data: [existingRow], error: null };
    deleted = { data: [deletedFresh, deletedExpired], error: null };
    revalidatePath.mockClear();
    resetPageFrameMemo.mockClear();
    resetNavListsMemo.mockClear();
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin and lists the registry with the row pages for an admin, the deleted pages apart (P1.12)', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await GET()).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { pages: { path: string; kind: string }[]; deleted: { path: string; deletedAt: string }[] };
    expect(json.pages).toHaveLength(CODE_PAGES.length + 1);
    expect(json.pages.find(p => p.path === '/history/spa')?.kind).toBe('row');
    expect(json.deleted.map(p => p.path)).toEqual(['/history/imola', '/history/zolder']);
    expect(json.deleted[0].deletedAt).toBe(deletedFresh.deleted_at);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('GET is 500 when the rows cannot be read, and lists no deleted pages when those cannot', async () => {
    rows = { data: null, error: { message: 'boom' } };
    expect((await GET()).status).toBe(500);
    rows = { data: [existingRow], error: null };
    deleted = { data: null, error: { message: 'boom' } };
    const json = (await (await GET()).json()) as { deleted: unknown[] };
    expect(json.deleted).toEqual([]);
  });

  it('POST is 404 for a non-admin and 403 off production, before anything is written', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await post(monza)).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await post(monza)).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses a missing name, an unknown group or template, a malformed, reserved or code-owned path, a duplicate and a deleted page’s address, before the database', async () => {
    expect((await post({ ...monza, name: ' ' })).status).toBe(400);
    expect((await post({ ...monza, group: 'nope' })).status).toBe(400);
    expect((await post({ ...monza, template: 'wizard' })).status).toBe(400);
    expect((await post({ ...monza, path: 'history/monza' })).status).toBe(400);
    expect((await post({ ...monza, path: '/api/monza' })).status).toBe(400);
    const owned = await post({ ...monza, path: '/series/monza' });
    expect(owned.status).toBe(400);
    expect(((await owned.json()) as { error: string }).error).toBe('path: the code already serves /series/[slug]');
    expect((await post({ ...monza, path: '/history/spa' })).status).toBe(409);
    const held = await post({ ...monza, path: '/history/imola' });
    expect(held.status).toBe(409);
    expect(((await held.json()) as { error: string }).error).toBe('path: a deleted page holds this address: reinstate it or delete it permanently');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('creates a row page from a template through design_create_page, with the template as its first draft and its projected references', async () => {
    const res = await post({ ...monza, name: ' Monza, a history ' });
    expect(res.status).toBe(201);
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe('design_create_page');
    expect(args).toEqual({
      p_application: 'paddock',
      p_path: '/history/monza',
      p_name: 'Monza, a history',
      p_group: 'editorial',
      p_actor: 'user_admin',
      p_document: pageTemplate('article')!.document,
      p_refs: [{ kind: 'list', key: 'footer-site' }],
    });
    const json = (await res.json()) as { page: { path: string; kind: string; indexable: boolean; updatedAt: string }; template: string };
    expect(json.page).toMatchObject({ path: '/history/monza', kind: 'row', indexable: false, updatedAt: STAMP });
    expect(json.template).toBe('article');
  });

  it('a blank template writes the page alone: no document, no references', async () => {
    const res = await post({ ...monza, template: 'blank' });
    expect(res.status).toBe(201);
    expect((rpc.mock.calls[0] as [string, Record<string, unknown>])[1]).toMatchObject({ p_document: null, p_refs: [] });
  });

  it('answers 409 when the database says the path exists, 400 when a list is missing, and 503 before the migration', async () => {
    rpcError = { code: '23505', message: 'duplicate key value violates unique constraint "page_application_key_path_key"' };
    expect((await post(monza)).status).toBe(409);
    rpcError = { code: '23503', message: 'insert or update on table "page_revision_ref" violates foreign key constraint' };
    expect((await post(monza)).status).toBe(400);
    rpcError = { code: 'PGRST202', message: 'Could not find the function public.design_create_page(...) in the schema cache' };
    const res = await post(monza);
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toMatch(/20260909010000/);
  });

  it('DELETE ?expired=1 removes for good the deleted pages past their thirty days, each through design_purge_page, and reports the ones a live page still names (P1.12)', async () => {
    const res = await del('?expired=1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, purged: [EXPIRED], held: [] });
    expect(rpc.mock.calls).toEqual([['design_purge_page', { p_application: 'paddock', p_page_id: EXPIRED }]]);
    expect(resetPageFrameMemo).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/history/zolder');
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(resetNavListsMemo).toHaveBeenCalledTimes(1);
    rpc.mockClear();
    purgeAnswers = { [EXPIRED]: { data: null, error: { message: 'referenced: Home' } } };
    const held = await del('?expired=1');
    expect(await held.json()).toEqual({ ok: true, purged: [], held: [{ id: EXPIRED, pages: ['Home'] }] });
    expect((await del('')).status).toBe(400);
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await del('?expired=1')).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await del('?expired=1')).status).toBe(403);
  });

  it('DELETE ?expired=1 stops on a failure the function did not name and reports what it had removed so far (the reviewer’s gap)', async () => {
    const OTHER = 'a1b2c3d4-0000-4000-8000-000000000023';
    deleted = { data: [deletedExpired, { ...deletedExpired, id: OTHER, path: '/history/aintree', name: 'Aintree' }], error: null };
    purgeAnswers = { [OTHER]: { data: null, error: { message: 'connection reset' } } };
    const res = await del('?expired=1');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'connection reset', purged: [EXPIRED], held: [] });
    expect(rpc.mock.calls.map(c => (c[1] as { p_page_id: string }).p_page_id)).toEqual([EXPIRED, OTHER]);
    expect(revalidatePath).toHaveBeenCalledWith('/history/zolder');
    expect(revalidatePath).not.toHaveBeenCalledWith('/history/aintree');
  });
});
