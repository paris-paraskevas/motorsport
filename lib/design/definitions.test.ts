import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The definitions loader (P2.0, PR B): the code's definitions with the
// overlay rows merged over them, the component kinds for the parser, and the
// editable list with Utilization (the live pages and the newest revisions'
// regions) and History (the row's stamp); a failing read is the code's list.

type Answer = { data: unknown; error: { message: string } | null };
let tables: Record<string, Answer> = {};
let throwOn: string | null = null;
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: (table: string) => {
      if (throwOn === table) throw new Error(`boom on ${table}`);
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(resolve, reject),
      };
      return chain;
    },
  }),
}));

import { loadComponents, loadDefinitions, loadDefinitionsForEditing, loadSourceUsage, overlaysFromRows, resetDefinitionsMemo, sourceUsageFromRows, usageFromRows } from './definitions';
import { DEFINITIONS } from './component-definitions';
import { COMPONENTS } from './components';

const STAMP = '2026-09-17T11:00:00.000001+00:00';
const CAL = 'a1b2c3d4-0000-4000-8000-000000000001';
const MONZA = 'a1b2c3d4-0000-4000-8000-000000000002';
const overlayRow = { key: 'page.heading', overlay: { attributes: [{ key: 'accent', label: 'Accent', kind: 'colour', default: '#8c1c13', group: 'colours' }], groups: [{ key: 'colours', title: 'Colours', seq: 10 }] }, updated_at: STAMP, updated_by: 'user_admin' };
const pages = [
  { id: CAL, path: '/calendar', name: 'Calendar' },
  { id: MONZA, path: '/history/monza', name: 'Monza, a history' },
];
const region = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({ id, kind, title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, ...extra });
const revisions = [
  // The Calendar: a newer draft with the heading carrying accent, over a live revision without it.
  { page_id: CAL, created_at: '2026-09-17T10:00:00Z', published_at: null, document: { version: 1, actions: [], regions: [region('heading', 'component', { component: 'page.heading', settings: { text: '', accent: '#123456' } }), region('cal', 'component', { component: 'calendar.month', settings: {} })] } },
  { page_id: CAL, created_at: '2026-09-16T10:00:00Z', published_at: '2026-09-16T10:00:00Z', document: { version: 1, actions: [], regions: [region('heading', 'component', { component: 'page.heading', settings: { text: '' } }), region('cal', 'component', { component: 'calendar.month', settings: {} })] } },
  // Monza: live, a static and a list, and a second static.
  { page_id: MONZA, created_at: '2026-09-15T10:00:00Z', published_at: '2026-09-15T10:00:00Z', document: { version: 1, actions: [], regions: [region('intro', 'static', { text: 'x' }), region('more', 'list', { listKey: 'footer-site', style: 'links' }), region('story', 'static', { text: 'y' })] } },
];

beforeEach(() => {
  resetDefinitionsMemo();
  throwOn = null;
  tables = {
    component_definition: { data: [overlayRow], error: null },
    page: { data: pages, error: null },
    page_revision: { data: revisions, error: null },
  };
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('the definitions loader', () => {
  it('reads the overlay rows against their shipped definitions, leaving out a row it cannot use', () => {
    const out = overlaysFromRows([overlayRow, { key: 'nope.x', overlay: {} }, { key: 'data.region', overlay: { attributes: [{ key: 'rows', label: 'Rows', kind: 'number', default: 1 }] } }, 'junk']);
    expect(Object.keys(out)).toEqual(['page.heading']);
    expect(out['page.heading'].attributes[0].key).toBe('accent');
  });

  it('merges the rows over the code: the heading gains its attribute, the wire stays the code’s; the component kinds are what the parser takes', async () => {
    const all = await loadDefinitions();
    expect(all).toHaveLength(DEFINITIONS.length);
    expect(all.find(d => d.key === 'page.heading')?.settings.map(s => s.key)).toEqual(['text', 'accent']);
    expect(all.find(d => d.key === 'series.live')).toBe(COMPONENTS.find(c => c.key === 'series.live'));
    const components = await loadComponents();
    expect(components.map(d => d.key)).toEqual(COMPONENTS.map(c => c.key));
    expect(components.find(d => d.key === 'page.heading')?.settings).toHaveLength(2);
  });

  it('counts Utilization from the pages’ newest revisions, the attribute keys from the newest and the live one', () => {
    const usage = usageFromRows(pages, revisions);
    expect(usage['page.heading']).toEqual({ usedOn: [{ id: CAL, path: '/calendar', name: 'Calendar', attributes: ['accent', 'text'] }], regions: 1 });
    expect(usage['calendar.month']).toEqual({ usedOn: [{ id: CAL, path: '/calendar', name: 'Calendar', attributes: [] }], regions: 1 });
    expect(usage['region.static']).toEqual({ usedOn: [{ id: MONZA, path: '/history/monza', name: 'Monza, a history', attributes: [] }], regions: 2 });
    expect(usage['region.list']?.regions).toBe(1);
    expect(usage['data.region']).toBeUndefined();
    // P2.24 C: a stored region naming one of Home's retired components counts under the component it upgrades to on read.
    const old = usageFromRows(pages, [
      { page_id: MONZA, created_at: '2026-09-18T12:00:00Z', published_at: null, document: { version: 2, actions: [], regions: [region('wire', 'component', { component: 'home.wire', settings: { items: 5 } }), region('band', 'component', { component: 'home.live', settings: {} })] } },
    ]);
    expect(old['data.region']).toMatchObject({ usedOn: [{ id: MONZA, path: '/history/monza', name: 'Monza, a history' }], regions: 1 });
    expect(old['series.live']).toMatchObject({ usedOn: [{ id: MONZA }], regions: 1 });
    expect(old['home.wire']).toBeUndefined();
    expect(old['home.live']).toBeUndefined();
  });

  it('P2.1: Utilization of a source: the pages whose newest or live revision carries a Source of it, with the refs; a bad ref and a region without one are ignored; the same newest-and-live rule as the definitions’', async () => {
    const revs = [
      ...revisions,
      {
        page_id: MONZA,
        created_at: '2026-09-17T12:00:00Z',
        published_at: null,
        document: {
          version: 2,
          actions: [],
          regions: [
            region('changed', 'component', { component: 'data.region', settings: { preset: 'what-it-changed', view: 'leader', rows: 5, heading: '' }, source: 'standings?series=f1&season=2026' }),
            region('bad', 'component', { component: 'data.region', settings: { preset: 'what-it-changed', view: 'leader', rows: 5, heading: '' }, source: 'nope?x=1' }),
            region('wire', 'component', { component: 'series.live', settings: { series: '', also: true } }),
          ],
        },
      },
      // The Calendar's LIVE revision (the newest published one, 12:00 on the 16th) carries a source its newer draft dropped: the live one still counts (the guard's rule).
      { page_id: CAL, created_at: '2026-09-16T12:00:00Z', published_at: '2026-09-16T12:00:00Z', document: { version: 2, actions: [], regions: [region('changed', 'component', { component: 'data.region', settings: { preset: 'wec-hypercar-drivers', view: 'table', rows: 10, heading: '' }, source: 'standings?series=wec&season=2026' })] } },
    ];
    const usage = sourceUsageFromRows(pages, revs);
    expect(usage).toEqual({
      standings: [
        { id: CAL, path: '/calendar', name: 'Calendar', refs: ['standings?series=wec&season=2026'] },
        { id: MONZA, path: '/history/monza', name: 'Monza, a history', refs: ['standings?series=f1&season=2026'] },
      ],
    });
    tables.page_revision = { data: revs, error: null };
    expect(await loadSourceUsage()).toEqual(usage);
    throwOn = 'page';
    expect(await loadSourceUsage()).toEqual({});
    throwOn = null;
  });

  it('the editable list: every definition in the code’s order, the merged definition, its overlay, the stamp or null, Utilization', async () => {
    const list = await loadDefinitionsForEditing();
    expect(list).not.toBeNull();
    expect(list!.map(d => d.key)).toEqual(DEFINITIONS.map(d => d.key));
    const heading = list!.find(d => d.key === 'page.heading')!;
    expect(heading.updatedAt).toBe(STAMP);
    expect(heading.updatedBy).toBe('user_admin');
    expect(heading.overlay.attributes).toHaveLength(1);
    expect(heading.definition.settings).toHaveLength(2);
    expect(heading.usedOn.map(p => p.name)).toEqual(['Calendar']);
    expect(heading.regions).toBe(1);
    const band = list!.find(d => d.key === 'series.live')!;
    expect(band.updatedAt).toBeNull();
    expect(band.overlay).toEqual({ attributes: [], groups: [] });
    expect(band.usedOn).toEqual([]);
  });

  it('never throws: a failing read is the code’s definitions, and the editable list is null', async () => {
    throwOn = 'component_definition';
    expect((await loadDefinitions()).find(d => d.key === 'page.heading')?.settings).toHaveLength(1);
    expect(await loadDefinitionsForEditing()).toBeNull();
  });

  it('remembers the rows for a minute, and forgets them on reset', async () => {
    await loadDefinitions();
    tables.component_definition = { data: [], error: null };
    expect((await loadDefinitions()).find(d => d.key === 'page.heading')?.settings).toHaveLength(2);
    resetDefinitionsMemo();
    expect((await loadDefinitions()).find(d => d.key === 'page.heading')?.settings).toHaveLength(1);
  });
});
