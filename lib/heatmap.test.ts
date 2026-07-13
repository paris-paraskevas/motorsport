import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// In-memory fake of the service-role Supabase client, standing in for the two call
// chains lib/heatmap.ts uses (mirrors lib/source-snapshot.test.ts):
//   insert: betDb().from('heatmap_event').insert(rows)              → { data, error }
//   read:   betDb().from('heatmap_element_stats').select().eq()...  → thenable { data, error }
// so recordEvents / rankedElements / heatmapAdminOverview can be asserted offline.
// State lives at module scope and is referenced only inside nested arrows in the
// mock factory (lazy), so Vitest's vi.mock hoisting stays happy.

interface ViewRow {
  path: string;
  breakpoint: string;
  element_id: string | null;
  clicks: number;
  impressions: number;
}
type InsertedRow = Record<string, unknown>;
interface QueryResult {
  data: ViewRow[] | null;
  error: { message: string } | null;
}
interface Chain {
  insert: (rows: InsertedRow[]) => Promise<{ data: null; error: { message: string } | null }>;
  select: () => Chain;
  eq: (col: string, val: string) => Chain;
  then: (resolve: (r: QueryResult) => void, reject?: (e: unknown) => void) => void;
}

let configured = true;
let failInsert = false; // insert throws
let insertReturnsError = false; // insert resolves { error } without throwing
let failView = false; // view read throws
let viewReturnsError = false; // view read resolves { error }
let insertCalls = 0;
const insertedRows: InsertedRow[] = [];
let viewRows: ViewRow[] = [];

function makeChain(): Chain {
  const filters: { col: string; val: string }[] = [];
  const chain: Chain = {
    insert(rows) {
      insertCalls++;
      if (failInsert) throw new Error('supabase insert outage');
      if (insertReturnsError) {
        return Promise.resolve({ data: null, error: { message: 'relation "heatmap_event" does not exist' } });
      }
      insertedRows.push(...rows);
      return Promise.resolve({ data: null, error: null });
    },
    select() {
      return chain;
    },
    eq(col, val) {
      filters.push({ col, val });
      return chain;
    },
    then(resolve, reject) {
      try {
        if (failView) throw new Error('supabase view outage');
        const data = viewRows.filter(r =>
          filters.every(f => String((r as unknown as Record<string, unknown>)[f.col]) === f.val),
        );
        resolve({ data, error: viewReturnsError ? { message: 'no relation' } : null });
      } catch (err) {
        if (reject) reject(err);
        else throw err;
      }
    },
  };
  return chain;
}

vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({ from: () => makeChain() }),
}));

import {
  normalizePath,
  sanitizeEvents,
  recordEvents,
  rankedElements,
  heatmapAdminOverview,
  bucketClickPoints,
  type HeatmapEvent,
} from './heatmap';

beforeEach(() => {
  configured = true;
  failInsert = false;
  insertReturnsError = false;
  failView = false;
  viewReturnsError = false;
  insertCalls = 0;
  insertedRows.length = 0;
  viewRows = [];
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizePath', () => {
  it('lowercases, strips query/hash + trailing slash', () => {
    expect(normalizePath('/App/Standings/?x=1#h')).toBe('/app/standings');
  });
  it('keeps the bare root', () => {
    expect(normalizePath('/')).toBe('/');
  });
  it('rejects non-app / garbage / oversized paths', () => {
    expect(normalizePath('not-a-path')).toBeNull();
    expect(normalizePath('https://evil.com/x')).toBeNull();
    expect(normalizePath('/has spaces')).toBeNull();
    expect(normalizePath('/' + 'a'.repeat(200))).toBeNull();
    expect(normalizePath(42)).toBeNull();
  });
});

describe('sanitizeEvents', () => {
  it('normalizes the path, clamps ratios/dims, caps strings, drops junk rows', () => {
    const rows = sanitizeEvents({
      path: '/App/',
      breakpoint: 'desktop',
      viewportW: 1440,
      viewportH: 900,
      pointer: 'mouse',
      events: [
        { kind: 'click', elementId: 'nav:home', relX: 1.5, relY: -0.3 }, // ratios clamp to 1 / 0
        { kind: 'click', selector: 'button.foo' }, // fallback selector, no ratios
        { kind: 'impression', elementId: 'nav:series' },
        { kind: 'bogus', elementId: 'x' }, // dropped: bad kind
        { kind: 'click' }, // dropped: identifies nothing
      ],
    });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      path: '/app',
      kind: 'click',
      elementId: 'nav:home',
      relX: 1,
      relY: 0,
      breakpoint: 'desktop',
      viewportW: 1440,
      viewportH: 900,
      pointer: 'mouse',
    });
    expect(rows[1]).toMatchObject({ kind: 'click', selector: 'button.foo' });
    expect(rows[1].relX).toBeUndefined();
    expect(rows[2]).toMatchObject({ kind: 'impression', elementId: 'nav:series' });
  });

  it('drops the whole batch on a bad breakpoint or bad path', () => {
    expect(sanitizeEvents({ path: '/app', breakpoint: 'wide', events: [{ kind: 'click', elementId: 'x' }] })).toEqual([]);
    expect(sanitizeEvents({ path: 'nope', breakpoint: 'mobile', events: [{ kind: 'click', elementId: 'x' }] })).toEqual([]);
    expect(sanitizeEvents(null)).toEqual([]);
    expect(sanitizeEvents({ path: '/app', breakpoint: 'mobile', events: 'not-array' })).toEqual([]);
  });

  it('caps the batch at 250 events', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ kind: 'click', elementId: `e${i}` }));
    expect(sanitizeEvents({ path: '/app', breakpoint: 'mobile', events: many })).toHaveLength(250);
  });

  it('drops a viewport dim that overflows smallint but keeps a valid one', () => {
    const rows = sanitizeEvents({
      path: '/app',
      breakpoint: 'mobile',
      viewportW: 99999,
      viewportH: 640,
      events: [{ kind: 'click', elementId: 'x' }],
    });
    expect(rows[0].viewportW).toBeUndefined();
    expect(rows[0].viewportH).toBe(640);
  });

  it('caps an over-long element id / selector', () => {
    const rows = sanitizeEvents({
      path: '/app',
      breakpoint: 'mobile',
      events: [{ kind: 'click', selector: 'a'.repeat(500) }],
    });
    expect(rows[0].selector).toHaveLength(200);
  });
});

describe('recordEvents', () => {
  const evs: HeatmapEvent[] = [
    { path: '/app', kind: 'click', elementId: 'nav:home', breakpoint: 'desktop' },
    { path: '/app', kind: 'impression', elementId: 'nav:series', breakpoint: 'desktop' },
  ];

  it('bulk-inserts all rows in a single call, mapped to snake_case with nulls', async () => {
    await recordEvents(evs);
    expect(insertCalls).toBe(1);
    expect(insertedRows).toHaveLength(2);
    expect(insertedRows[0]).toMatchObject({ path: '/app', kind: 'click', element_id: 'nav:home', breakpoint: 'desktop' });
    expect(insertedRows[0].selector).toBeNull();
    expect(insertedRows[0].rel_x).toBeNull();
    expect(insertedRows[0].viewport_w).toBeNull();
  });

  it('no-ops when Supabase is unconfigured', async () => {
    configured = false;
    await recordEvents(evs);
    expect(insertCalls).toBe(0);
    expect(insertedRows).toHaveLength(0);
  });

  it('no-ops on an empty batch', async () => {
    await recordEvents([]);
    expect(insertCalls).toBe(0);
  });

  it('swallows a thrown client (never rejects, nothing lands)', async () => {
    failInsert = true;
    await expect(recordEvents(evs)).resolves.toBeUndefined();
    expect(insertedRows).toHaveLength(0);
  });

  it('swallows a returned { error } (table not applied on prod yet)', async () => {
    insertReturnsError = true;
    await expect(recordEvents(evs)).resolves.toBeUndefined();
    expect(insertCalls).toBe(1);
    expect(insertedRows).toHaveLength(0);
  });
});

describe('rankedElements', () => {
  it('splits hot (clicked, clicks desc) from dead (unclicked, >= min impressions)', async () => {
    viewRows = [
      { path: '/app', breakpoint: 'desktop', element_id: 'nav:home', clicks: 10, impressions: 100 },
      { path: '/app', breakpoint: 'desktop', element_id: 'nav:series', clicks: 3, impressions: 60 },
      { path: '/app', breakpoint: 'desktop', element_id: 'footer:privacy', clicks: 0, impressions: 80 },
      { path: '/app', breakpoint: 'desktop', element_id: 'footer:terms', clicks: 0, impressions: 5 }, // below default 20
    ];
    const { hot, dead } = await rankedElements('/app', { breakpoint: 'desktop' });
    expect(hot.map(h => h.elementId)).toEqual(['nav:home', 'nav:series']);
    expect(hot[0].ctr).toBeCloseTo(0.1);
    expect(dead.map(d => d.elementId)).toEqual(['footer:privacy']);
    expect(dead[0].clicks).toBe(0);
  });

  it('honours a custom deadMinImpressions', async () => {
    viewRows = [{ path: '/app', breakpoint: 'mobile', element_id: 'footer:terms', clicks: 0, impressions: 5 }];
    const { dead } = await rankedElements('/app', { deadMinImpressions: 5 });
    expect(dead.map(d => d.elementId)).toEqual(['footer:terms']);
  });

  it('filters by breakpoint when given', async () => {
    viewRows = [
      { path: '/app', breakpoint: 'mobile', element_id: 'nav:home', clicks: 5, impressions: 50 },
      { path: '/app', breakpoint: 'desktop', element_id: 'nav:series', clicks: 9, impressions: 50 },
    ];
    const { hot } = await rankedElements('/app', { breakpoint: 'mobile' });
    expect(hot.map(h => h.elementId)).toEqual(['nav:home']);
  });

  it('aggregates one element across breakpoints when unfiltered', async () => {
    viewRows = [
      { path: '/app', breakpoint: 'mobile', element_id: 'nav:home', clicks: 5, impressions: 50 },
      { path: '/app', breakpoint: 'desktop', element_id: 'nav:home', clicks: 4, impressions: 30 },
    ];
    const { hot } = await rankedElements('/app');
    expect(hot).toHaveLength(1);
    expect(hot[0]).toMatchObject({ elementId: 'nav:home', clicks: 9, impressions: 80 });
  });

  it('fail-soft: unconfigured / view outage / invalid path all return empty', async () => {
    configured = false;
    expect(await rankedElements('/app', { breakpoint: 'desktop' })).toEqual({ hot: [], dead: [] });
    configured = true;
    failView = true;
    expect(await rankedElements('/app')).toEqual({ hot: [], dead: [] });
    failView = false;
    expect(await rankedElements('not-a-path')).toEqual({ hot: [], dead: [] });
  });
});

describe('bucketClickPoints', () => {
  it('collapses same-anchor same-cell clicks into one weighted point; element_id wins over selector', () => {
    const pts = bucketClickPoints([
      { element_id: 'nav:home', selector: 'ignored', rel_x: 0.5, rel_y: 0.5 },
      { element_id: 'nav:home', selector: null, rel_x: 0.505, rel_y: 0.498 }, // same 1/50 cell → merges
      { element_id: null, selector: 'a:nth-of-type(2)', rel_x: 0.1, rel_y: 0.9 },
    ]);
    const home = pts.find(p => p.elementId === 'nav:home');
    expect(home).toMatchObject({ relX: 0.5, relY: 0.5, weight: 2 });
    expect(home?.selector).toBeUndefined(); // element_id anchor drops the selector
    const sel = pts.find(p => p.selector === 'a:nth-of-type(2)');
    expect(sel).toMatchObject({ weight: 1 });
    expect(sel?.elementId).toBeUndefined();
  });

  it('drops rows with no anchor or a non-numeric ratio', () => {
    expect(
      bucketClickPoints([
        { element_id: null, selector: null, rel_x: 0.5, rel_y: 0.5 }, // no anchor
        { element_id: 'x', selector: null, rel_x: null, rel_y: 0.5 }, // no ratio
      ]),
    ).toEqual([]);
  });

  it('clamps out-of-range ratios into the 0..1 grid', () => {
    const [p] = bucketClickPoints([{ element_id: 'x', selector: null, rel_x: 1.4, rel_y: -0.2 }]);
    expect(p).toMatchObject({ relX: 1, relY: 0, weight: 1 });
  });
});

describe('heatmapAdminOverview', () => {
  it('groups by path then breakpoint, ordered by total clicks', async () => {
    viewRows = [
      { path: '/app', breakpoint: 'desktop', element_id: 'nav:home', clicks: 10, impressions: 100 },
      { path: '/app', breakpoint: 'mobile', element_id: 'nav:home', clicks: 2, impressions: 40 },
      { path: '/calendar', breakpoint: 'desktop', element_id: 'nav:cal', clicks: 1, impressions: 20 },
    ];
    const panels = await heatmapAdminOverview();
    expect(panels.map(p => p.path)).toEqual(['/app', '/calendar']); // /app has more clicks
    const app = panels[0];
    expect(app.total).toBe(12);
    expect(app.breakpoints.map(b => b.breakpoint)).toEqual(['mobile', 'desktop']); // canonical order
    const desktop = app.breakpoints.find(b => b.breakpoint === 'desktop');
    expect(desktop?.hot[0].elementId).toBe('nav:home');
  });

  it('fail-soft to [] when unconfigured', async () => {
    configured = false;
    expect(await heatmapAdminOverview()).toEqual([]);
  });
});
