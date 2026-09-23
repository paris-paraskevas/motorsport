import { beforeEach, describe, expect, it, vi } from 'vitest';

// A fake `saved_view` table (and the pages and revisions the targets scan reads): `tables` answers every read by table name.
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
      return { select: () => read };
    },
  }),
}));
vi.mock('@/lib/design/pages', () => ({ loadPagesForEditing: async () => [{ id: 'p1', path: '/history/monza', name: 'Monza' }] }));
const livePage = vi.fn();
vi.mock('@/lib/design/live-page', () => ({ loadLivePage: (path: string) => livePage(path) }));

import { loadRegionShape, loadViewTargets, loadViewsFor, loadViewsForEditing, resetViewsMemo, targetsFromRows, viewsFromRows } from './views';

const STAMP = '2026-09-23T21:30:00.505502+00:00';
const row = (over: Record<string, unknown> = {}) => ({ key: 'top-five', page_id: 'p1', region_id: 't', name: 'Top five', definition: { sort: { column: 'points', desc: true }, cols: ['name', 'points'], filters: [] }, seq: 10, updated_at: STAMP, ...over });
const region = (id: string, over: Record<string, unknown> = {}) => ({ id, kind: 'component', component: 'data.region', title: '', settings: { preset: 'drivers', view: 'table', rows: 10, heading: '' }, source: 'standings?series=f1&season=2026', ...over });

describe('the saved views', () => {
  beforeEach(() => {
    resetViewsMemo();
    livePage.mockReset();
    tables = { saved_view: { data: [row(), row({ key: 'mercedes', name: 'Mercedes', seq: 5, region_id: 'other' }), row({ key: 'Bad Key' }), row({ key: 'nodef', definition: { sort: { column: 'points' } } })], error: null } };
  });

  it('reads rows into views by seq then name, leaving out a key outside the rule or a definition the vocabulary does not say; the editor’s loader keeps the stamps', async () => {
    const views = viewsFromRows(tables.saved_view.data);
    expect(views.map(v => v.key)).toEqual(['mercedes', 'top-five']);
    expect(views[1]).toEqual({ key: 'top-five', pageId: 'p1', regionId: 't', name: 'Top five', definition: { sort: { column: 'points', desc: true }, cols: ['name', 'points'], filters: [] }, seq: 10, updatedAt: STAMP });
    expect(viewsFromRows(null)).toEqual([]);
    expect((await loadViewsForEditing())?.map(v => v.key)).toEqual(['mercedes', 'top-five']);
    tables.saved_view = { data: null, error: { message: 'down' } };
    expect(await loadViewsForEditing()).toBeNull();
  });

  it('answers one region’s views from one memoised read, and nothing after a failure', async () => {
    expect((await loadViewsFor('p1', 't')).map(v => v.key)).toEqual(['top-five']);
    expect((await loadViewsFor('p1', 'other')).map(v => v.key)).toEqual(['mercedes']);
    expect(await loadViewsFor('p2', 't')).toEqual([]);
    tables.saved_view = { data: null, error: { message: 'down' } };
    expect((await loadViewsFor('p1', 't')).map(v => v.key)).toEqual(['top-five']);
    resetViewsMemo();
    expect(await loadViewsFor('p1', 't')).toEqual([]);
  });

  it('lists the pages with Data regions on their newest or live revision as targets, a region live only when the live revision holds it', async () => {
    const pages = [{ id: 'p1', path: '/history/monza', name: 'Monza' }, { id: 'p2', path: '/about-us', name: 'About' }];
    const doc = (regions: unknown[]) => ({ version: 1, actions: [], regions });
    const revisions = [
      { page_id: 'p1', created_at: '2026-09-23T12:00:00Z', published_at: null, document: doc([region('t', { title: 'Drivers' }), region('u')]) },
      { page_id: 'p1', created_at: '2026-09-23T10:00:00Z', published_at: '2026-09-23T10:00:00Z', document: doc([region('t')]) },
      { page_id: 'p2', created_at: '2026-09-23T09:00:00Z', published_at: '2026-09-23T09:00:00Z', document: doc([{ id: 's', kind: 'static', text: 'x' }]) },
    ];
    expect(targetsFromRows(pages, revisions)).toEqual([{ pageId: 'p1', path: '/history/monza', name: 'Monza', regions: [{ id: 't', label: 'Data region t', live: true }, { id: 'u', label: 'Data region u', live: false }] }]);
    tables.page = { data: pages, error: null };
    tables.page_revision = { data: revisions, error: null };
    expect((await loadViewTargets())?.map(t => t.pageId)).toEqual(['p1']);
  });

  it('finds the shape a definition binds to from the page’s live Data region, null when the page, the revision, the region or its preset is missing', async () => {
    livePage.mockResolvedValue({ page: { id: 'p1', path: '/history/monza' }, revisionId: 'r', publishedAt: STAMP, document: { version: 1, actions: [], regions: [region('t'), region('bad', { settings: { preset: 'nope' } })] } });
    expect((await loadRegionShape('p1', 't'))?.shape.key).toBe('driver-rows');
    expect((await loadRegionShape('p1', 't'))?.path).toBe('/history/monza');
    expect(await loadRegionShape('p1', 'gone')).toBeNull();
    expect(await loadRegionShape('p1', 'bad')).toBeNull();
    expect(await loadRegionShape('p9', 't')).toBeNull();
    livePage.mockResolvedValue(null);
    expect(await loadRegionShape('p1', 't')).toBeNull();
  });
});
