import { beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
let result: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: () => {
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

import { CODE_PAGES, loadPagesForEditing, pageFromRow, pagesFromRows } from './pages';

const STAMP = '2026-09-08T15:40:00.505502+00:00';
const homeRow = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  path: '/',
  name: 'Home',
  kind: 'code',
  group_key: 'home',
  template: 'paddock-standard',
  authz_key: 'public',
  title: null,
  rendering: 'cached',
  indexable: true,
  comments: null,
  updated_at: STAMP,
};
const rowPage = {
  id: 'a1b2c3d4-0000-4000-8000-000000000002',
  path: '/history/monza',
  name: 'Monza, a history',
  kind: 'row',
  group_key: 'editorial',
  template: 'paddock-standard',
  authz_key: 'public',
  title: 'Monza',
  rendering: 'cached',
  indexable: false,
  comments: null,
  updated_at: STAMP,
};

describe('pagesFromRows', () => {
  it('lists every code page from the code when there are no rows, unstamped, in group order', () => {
    const pages = pagesFromRows([]);
    expect(pages).toHaveLength(CODE_PAGES.length);
    expect(pages[0]).toMatchObject({ path: '/', kind: 'code', group: 'home', updatedAt: null });
    expect(pages.every(p => p.updatedAt === null)).toBe(true);
    const groups = pages.map(p => p.group);
    expect(groups.indexOf('site')).toBeGreaterThan(groups.lastIndexOf('account'));
  });

  it('overlays a code page with its row and stamp, and appends a row page', () => {
    const pages = pagesFromRows([homeRow, rowPage]);
    expect(pages).toHaveLength(CODE_PAGES.length + 1);
    expect(pages.find(p => p.path === '/')).toMatchObject({ id: homeRow.id, updatedAt: STAMP, kind: 'code' });
    expect(pages.find(p => p.path === '/history/monza')).toMatchObject({ kind: 'row', title: 'Monza', indexable: false, group: 'editorial' });
  });

  it('leaves out a row it cannot use', () => {
    expect(pageFromRow({ ...homeRow, path: 'no-slash' })).toBeNull();
    expect(pageFromRow({ ...homeRow, kind: 'thing' })).toBeNull();
    expect(pageFromRow({ ...homeRow, name: '  ' })).toBeNull();
    expect(pageFromRow(null)).toBeNull();
    expect(pageFromRow({ ...homeRow, group_key: 'nope', rendering: 'odd', indexable: 'yes' })).toMatchObject({ group: null, rendering: 'cached', indexable: false });
  });
});

describe('loadPagesForEditing', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
  });

  it('is null when unconfigured or on an error, and the code list when there are no rows', async () => {
    configured = false;
    expect(await loadPagesForEditing()).toBeNull();
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadPagesForEditing()).toBeNull();
    result = { data: [], error: null };
    expect((await loadPagesForEditing())?.length).toBe(CODE_PAGES.length);
  });

  it('returns the rows merged over the code', async () => {
    result = { data: [homeRow], error: null };
    const pages = await loadPagesForEditing();
    expect(pages?.find(p => p.path === '/')?.updatedAt).toBe(STAMP);
  });
});
