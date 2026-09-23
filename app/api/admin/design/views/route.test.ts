import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

// A fake database by table: `tables` answers the reads (the saved_view rows; the pages and revisions the targets scan reads);
// `insert` records its payload and answers with `inserted` or `insertError`.
const insert = vi.fn();
let inserted: unknown = { updated_at: '2026-09-23T21:40:00.000001+00:00', seq: 10 };
let insertError: { code?: string; message: string } | null = null;
let tables: Record<string, { data: unknown; error: { message: string } | null }> = {};
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: (table: string) => {
      const read = {
        select: () => read,
        eq: () => read,
        is: () => read,
        order: () => read,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(resolve, reject),
      };
      return {
        select: () => read,
        insert: (payload: unknown) => {
          insert(payload);
          return { select: () => ({ single: async () => ({ data: inserted, error: insertError }) }) };
        },
      };
    },
  }),
}));
vi.mock('@/lib/design/pages', () => ({ loadPagesForEditing: async () => [{ id: 'p1', path: '/history/monza', name: 'Monza' }] }));
// The live Monza page holds one Data region, a Drivers table.
const REGION = { id: 't', kind: 'component', component: 'data.region', title: '', settings: { preset: 'drivers', view: 'table', rows: 10, heading: '' }, source: 'standings?series=f1&season=2026' };
vi.mock('@/lib/design/live-page', () => ({
  loadLivePage: async (path: string) =>
    path === '/history/monza' ? { page: { id: 'p1', path }, revisionId: 'r', publishedAt: '2026-09-23T10:00:00Z', document: { version: 1, actions: [], regions: [REGION] } } : null,
}));

import { GET, POST } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const STAMP = '2026-09-23T21:30:00.505502+00:00';
const stored = { key: 'mercedes', page_id: 'p1', region_id: 't', name: 'Mercedes', definition: { filters: [{ column: 'team', op: 'eq', value: 'Mercedes' }] }, seq: 10, updated_at: STAMP };
const post = (body: unknown) =>
  POST(new Request('https://paddock-tracker.com/api/admin/design/views', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const fresh = { key: 'top-five', name: ' Top five ', pageId: 'p1', regionId: 't', definition: 'sort=-points&cols=points,name&filter=name.gt:3' };

describe('/api/admin/design/views', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    insert.mockReset();
    revalidatePath.mockReset();
    inserted = { updated_at: '2026-09-23T21:40:00.000001+00:00', seq: 10 };
    insertError = null;
    tables = {
      saved_view: { data: [stored, { ...stored, key: 'alpha', name: 'Alpha', seq: 5 }], error: null },
      page: { data: [{ id: 'p1', path: '/history/monza', name: 'Monza' }], error: null },
      page_revision: { data: [{ page_id: 'p1', created_at: '2026-09-23T10:00:00Z', published_at: '2026-09-23T10:00:00Z', document: { version: 1, actions: [], regions: [REGION] } }], error: null },
    };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin and lists the views by seq then name with their stamps, and the pages with Data regions as targets', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await GET()).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { views: { key: string; updatedAt: string }[]; targets: unknown };
    expect(json.views.map(v => v.key)).toEqual(['alpha', 'mercedes']);
    expect(json.views[0].updatedAt).toBe(STAMP);
    expect(json.targets).toEqual([{ pageId: 'p1', path: '/history/monza', name: 'Monza', regions: [{ id: 't', label: 'Data region t', live: true }] }]);
  });

  it('POST is 404 for a non-admin and 403 off production, before anything is written', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await post(fresh)).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await post(fresh)).status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it('refuses a bad key, an empty name, a definition the vocabulary does not read, or a region that is not live, with the reason and before the database', async () => {
    const reason = async (body: unknown) => ((await (await post(body)).json()) as { error: string }).error;
    expect(await reason({ ...fresh, key: 'Top Five' })).toMatch(/^key: /);
    expect(await reason({ ...fresh, name: ' ' })).toBe('name: needs a name');
    expect(await reason({ ...fresh, definition: 'sort=-&view=Not A Slug' })).toBe('definition: sort names no column: -; view is not a key: Not A Slug');
    expect(await reason({ ...fresh, regionId: 'gone' })).toMatch(/no live Data region “gone”/);
    expect(await reason({ ...fresh, pageId: 'p9' })).toMatch(/no live Data region/);
    expect(await reason({ ...fresh, regionId: '' })).toMatch(/^page and region: /);
    expect(insert).not.toHaveBeenCalled();
  });

  it('creates a view with the definition bound to the region’s shape (a filter its column cannot take is dropped), answers 201 with the row and revalidates the page', async () => {
    const res = await post(fresh);
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({
      application_key: 'paddock',
      key: 'top-five',
      page_id: 'p1',
      region_id: 't',
      name: 'Top five',
      definition: { sort: { column: 'points', desc: true }, cols: ['points', 'name'], filters: [] },
      updated_by: 'user_admin',
    });
    const json = (await res.json()) as { view: { key: string; seq: number; updatedAt: string; name: string } };
    expect(json.view).toMatchObject({ key: 'top-five', name: 'Top five', seq: 10, updatedAt: '2026-09-23T21:40:00.000001+00:00' });
    expect(revalidatePath).toHaveBeenCalledWith('/history/monza');
  });

  it('answers 409 with the current list for a key that exists, before and from the database', async () => {
    const res = await post({ ...fresh, key: 'mercedes' });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { current: unknown[] }).current).toHaveLength(2);
    expect(insert).not.toHaveBeenCalled();
    insertError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    expect((await post(fresh)).status).toBe(409);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
