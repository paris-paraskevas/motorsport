import { beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
let tables: Record<string, { data: unknown; error: { message: string } | null }> = {};
const calls: string[] = [];
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => {
      calls.push(table);
      const q: Record<string, unknown> = {};
      const chain = () => q;
      Object.assign(q, {
        select: chain,
        eq: chain,
        not: chain,
        order: chain,
        limit: chain,
        in: chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(tables[table] ?? { data: [], error: null }).then(resolve, reject),
      });
      return q;
    },
  }),
}));

import { loadAssetsById, loadLivePage } from './live-page';

const ID = 'a1b2c3d4-0000-4000-8000-000000000010';
const ASSET = 'c1b2c3d4-0000-4000-8000-000000000031';
const page = {
  id: ID,
  path: '/history/monza',
  name: 'Monza, a history',
  kind: 'row',
  group_key: 'editorial',
  template: 'paddock-standard',
  authz_key: 'public',
  title: 'Monza',
  rendering: 'cached',
  indexable: true,
  comments: null,
  updated_at: '2026-09-08T16:00:00+00:00',
};
const revision = {
  id: 'b1b2c3d4-0000-4000-8000-000000000001',
  published_at: '2026-09-08T17:10:00+00:00',
  document: {
    version: 1,
    regions: [
      { id: 'intro', kind: 'static', position: 'body', seq: 10, column: 1, span: 12, text: 'Hello {shortcut:times.local}' },
      { id: 'broken', kind: 'image', position: 'body', seq: 20, column: 1, span: 12 },
    ],
  },
};

describe('loadLivePage', () => {
  beforeEach(() => {
    configured = true;
    calls.length = 0;
    tables = { page: { data: [page], error: null }, page_revision: { data: [revision], error: null } };
  });

  it('is null when unconfigured or for a path outside the row-page rule, without touching the database', async () => {
    configured = false;
    expect(await loadLivePage('/history/monza')).toBeNull();
    configured = true;
    expect(await loadLivePage('/History/Monza')).toBeNull();
    expect(await loadLivePage('/series/[slug]')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('is null on an error, when the page does not exist, when it is a code page, or when nothing is published', async () => {
    tables.page = { data: null, error: { message: 'boom' } };
    expect(await loadLivePage('/history/monza')).toBeNull();
    tables.page = { data: [], error: null };
    expect(await loadLivePage('/history/monza')).toBeNull();
    tables.page = { data: [{ ...page, kind: 'code' }], error: null };
    expect(await loadLivePage('/history/monza')).toBeNull();
    tables.page = { data: [page], error: null };
    tables.page_revision = { data: [], error: null };
    expect(await loadLivePage('/history/monza')).toBeNull();
    tables.page_revision = { data: null, error: { message: 'boom' } };
    expect(await loadLivePage('/history/monza')).toBeNull();
  });

  it('returns the page and its live revision with the usable part of the document', async () => {
    const live = await loadLivePage('/history/monza');
    expect(live?.page).toMatchObject({ path: '/history/monza', title: 'Monza', indexable: true });
    expect(live?.revisionId).toBe(revision.id);
    expect(live?.publishedAt).toBe(revision.published_at);
    expect(live?.document.regions.map(r => r.id)).toEqual(['intro']);
  });
});

describe('loadAssetsById', () => {
  beforeEach(() => {
    configured = true;
    tables = {
      asset: {
        data: [
          { id: ASSET, r2_key: '2026/09/a1b2c3d4-0000-4000-8000-000000000001.jpg', caption: 'The banking', credit: 'P.P.', licence: 'CC BY 4.0', width: 600, height: 400, bytes: 1000, content_type: 'image/jpeg', created_at: '2026-09-08T16:00:00+00:00', updated_at: '2026-09-08T16:00:00+00:00' },
          { id: 'not-a-uuid', r2_key: 'x' },
        ],
        error: null,
      },
    };
  });

  it('is empty for no ids, when unconfigured or on an error, and maps the usable rows by id otherwise', async () => {
    expect((await loadAssetsById([])).size).toBe(0);
    configured = false;
    expect((await loadAssetsById([ASSET])).size).toBe(0);
    configured = true;
    const map = await loadAssetsById([ASSET]);
    expect(map.size).toBe(1);
    expect(map.get(ASSET)?.url).toBe('/media/2026/09/a1b2c3d4-0000-4000-8000-000000000001.jpg');
    tables.asset = { data: null, error: { message: 'boom' } };
    expect((await loadAssetsById([ASSET])).size).toBe(0);
  });
});
