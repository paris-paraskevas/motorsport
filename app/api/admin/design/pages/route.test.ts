import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

// A fake database: `rows` answers the reads of the `page` table; `rpc` records
// the call to design_create_page and answers with a row built from its
// arguments, or with `rpcError`.
const rpc = vi.fn();
let rpcError: { code?: string; message: string } | null = null;
let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const STAMP = '2026-09-08T16:00:00.505502+00:00';
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpc(fn, args);
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
        },
        error: null,
      };
    },
    from: () => {
      const read = {
        select: () => read,
        eq: () => read,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return read;
    },
  }),
}));

import { GET, POST } from './route';
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
};
const post = (body: unknown) =>
  POST(
    new Request('https://paddock-tracker.com/api/admin/design/pages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
const monza = { name: 'Monza, a history', path: '/history/monza', group: 'editorial', template: 'article' };

describe('/api/admin/design/pages', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    rpc.mockReset();
    rpcError = null;
    rows = { data: [existingRow], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin and lists the registry with the row pages for an admin', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await GET()).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { pages: { path: string; kind: string }[] };
    expect(json.pages).toHaveLength(CODE_PAGES.length + 1);
    expect(json.pages.find(p => p.path === '/history/spa')?.kind).toBe('row');
  });

  it('GET is 500 when the rows cannot be read', async () => {
    rows = { data: null, error: { message: 'boom' } };
    expect((await GET()).status).toBe(500);
  });

  it('POST is 404 for a non-admin and 403 off production, before anything is written', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await post(monza)).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await post(monza)).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses a missing name, an unknown group or template, a malformed, reserved or code-owned path, and a duplicate, before the database', async () => {
    expect((await post({ ...monza, name: ' ' })).status).toBe(400);
    expect((await post({ ...monza, group: 'nope' })).status).toBe(400);
    expect((await post({ ...monza, template: 'wizard' })).status).toBe(400);
    expect((await post({ ...monza, path: 'history/monza' })).status).toBe(400);
    expect((await post({ ...monza, path: '/api/monza' })).status).toBe(400);
    const owned = await post({ ...monza, path: '/series/monza' });
    expect(owned.status).toBe(400);
    expect(((await owned.json()) as { error: string }).error).toBe('path: the code already serves /series/[slug]');
    expect((await post({ ...monza, path: '/history/spa' })).status).toBe(409);
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
});
