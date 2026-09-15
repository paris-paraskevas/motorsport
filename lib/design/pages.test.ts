import { beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
let result: { data: unknown; error: { message: string } | null } = { data: [], error: null };
// Every step of a query chain is recorded, so a test can say which filters a
// reader applied (P1.12: the readers skip deleted rows).
const chain = vi.fn();
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => {
      const q = {
        select: (cols: string) => {
          chain('select', table, cols);
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
        order: (k: string, opts: unknown) => {
          chain('order', k, opts);
          return q;
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import { CODE_PAGES, PAGE_COLUMNS, loadDeletedPages, loadPagesForEditing, pageFromRow, pagesFromRows } from './pages';

const STAMP = '2026-09-08T15:40:00.505502+00:00';
const DELETED = '2026-09-13T10:00:00.123456+00:00';
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

  it('reads a deleted row with its stamp and who deleted it, and leaves both out of a live row (P1.12)', () => {
    expect(pageFromRow({ ...rowPage, deleted_at: DELETED, deleted_by: 'user_admin' })).toMatchObject({ deletedAt: DELETED, deletedBy: 'user_admin' });
    expect(pageFromRow({ ...rowPage, deleted_at: DELETED, deleted_by: null })).toMatchObject({ deletedAt: DELETED, deletedBy: null });
    expect(pageFromRow(rowPage)).not.toHaveProperty('deletedAt');
    expect(pageFromRow({ ...rowPage, deleted_at: null, deleted_by: null })).not.toHaveProperty('deletedAt');
  });
});

describe('loadPagesForEditing', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
    chain.mockClear();
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

  it('returns the rows merged over the code, reading the live rows alone (P1.12)', async () => {
    result = { data: [homeRow], error: null };
    const pages = await loadPagesForEditing();
    expect(pages?.find(p => p.path === '/')?.updatedAt).toBe(STAMP);
    expect(chain.mock.calls).toEqual([
      ['select', 'page', PAGE_COLUMNS],
      ['eq', 'application_key', 'paddock'],
      ['is', 'deleted_at', null],
    ]);
    expect(PAGE_COLUMNS).toMatch(/deleted_at, deleted_by/);
  });
});

describe('loadDeletedPages (P1.12)', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
    chain.mockClear();
  });

  it('reads the deleted rows alone, newest deletion first, as pages with their deletion; null when unconfigured or on an error', async () => {
    result = { data: [{ ...rowPage, deleted_at: DELETED, deleted_by: 'user_admin' }], error: null };
    const deleted = await loadDeletedPages();
    expect(deleted).toHaveLength(1);
    expect(deleted?.[0]).toMatchObject({ path: '/history/monza', kind: 'row', deletedAt: DELETED, deletedBy: 'user_admin' });
    expect(chain.mock.calls).toEqual([
      ['select', 'page', PAGE_COLUMNS],
      ['eq', 'application_key', 'paddock'],
      ['not', 'deleted_at', 'is', null],
      ['order', 'deleted_at', { ascending: false }],
    ]);
    configured = false;
    expect(await loadDeletedPages()).toBeNull();
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadDeletedPages()).toBeNull();
    result = { data: [{ ...rowPage, path: 'broken', deleted_at: DELETED }], error: null };
    expect(await loadDeletedPages()).toEqual([]);
  });
});
