import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// In-memory fake of the durable `source_snapshot` table so the last-good wrap on
// `fetchWecStandings` can be exercised. `snapshotConfigured` defaults FALSE so
// the pre-existing fetch/parse tests below behave exactly as before (wrapper runs
// the fetcher uncached, as in a test env with no SUPABASE_URL); the last-good
// block flips it on. Mirrors lib/standings/dtm.test.ts.
const snapshotTable = new Map<string, unknown>();
let snapshotConfigured = false;

vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => snapshotConfigured,
  betDb: () => ({
    from: () => {
      let selectedKey: string | null = null;
      const builder = {
        select: () => builder,
        eq: (_col: string, value: string) => {
          selectedKey = value;
          return builder;
        },
        maybeSingle: async () => {
          const raw = selectedKey != null ? snapshotTable.get(selectedKey) : undefined;
          if (raw === undefined) return { data: null, error: null };
          return { data: { payload: JSON.parse(JSON.stringify(raw)) }, error: null };
        },
        upsert: async (row: { source_key: string; payload: unknown }) => {
          snapshotTable.set(row.source_key, row.payload);
          return { data: null, error: null };
        },
      };
      return builder;
    },
  }),
}));

import {
  fetchWecStandings,
  parseWecStandings,
  WEC_CLASSES,
  WEC_MANUFACTURER_CLASSES,
  WEC_TEAM_CLASSES,
} from './wec';

// All cases drive parseWecStandings() against a real HTML fixture captured
// from fiawec.com/en/page/manufacturers-classification on 2026-05-21
// (post-Spa R2). Synthetic fixtures would have missed the structural
// surprises seen in 0.11.x (FE colspan, WRC mw-heading) — same lesson.
const REAL_FIXTURE = readFileSync(
  resolve(process.cwd(), 'tests/fixtures/wec-standings-2026-05-21.html'),
  'utf-8',
);

describe('parseWecStandings', () => {
  it('returns null for empty HTML', () => {
    expect(parseWecStandings('')).toBeNull();
  });

  it('returns null for HTML with no recognised standings tables', () => {
    expect(parseWecStandings('<html><body>no tables here</body></html>')).toBeNull();
  });

  it('parses the four 2026 WEC standings tables from the real fixture', () => {
    const out = parseWecStandings(REAL_FIXTURE);
    expect(out).not.toBeNull();
    if (!out) return;

    // Hypercar has Drivers + Manufacturers; no Teams.
    expect(out.drivers.Hypercar.length).toBeGreaterThanOrEqual(4);
    expect(out.manufacturers.Hypercar).toBeDefined();
    expect(out.manufacturers.Hypercar!.length).toBeGreaterThanOrEqual(4);
    expect(out.teams.Hypercar).toBeUndefined();

    // LMGT3 has Drivers + Teams; no Manufacturers.
    expect(out.drivers.LMGT3.length).toBeGreaterThanOrEqual(4);
    expect(out.teams.LMGT3).toBeDefined();
    expect(out.teams.LMGT3!.length).toBeGreaterThanOrEqual(4);
    expect(out.manufacturers.LMGT3).toBeUndefined();
  });

  it('parses driver names as space-joined crews', () => {
    const out = parseWecStandings(REAL_FIXTURE)!;
    const p1Hypercar = out.drivers.Hypercar[0];
    // Hypercar entries are 2- or 3-driver crews; the joined name should
    // contain at least one space.
    expect(p1Hypercar.driverName).toMatch(/\s/);
    // The leading driver of the championship at fixture-capture is the BMW #20
    // crew (René Rast + Robin Frijns).
    expect(p1Hypercar.driverName.toUpperCase()).toContain('RAST');
  });

  it('attaches manufacturer + car number to each driver row as team', () => {
    const out = parseWecStandings(REAL_FIXTURE)!;
    const p1 = out.drivers.Hypercar[0];
    expect(p1.team).toMatch(/#/);
    expect(p1.team.toUpperCase()).toContain('BMW');
  });

  it('sorts each table by position ascending', () => {
    const out = parseWecStandings(REAL_FIXTURE)!;
    for (const cls of WEC_CLASSES) {
      const drivers = out.drivers[cls];
      for (let i = 1; i < drivers.length; i++) {
        expect(drivers[i].position).toBeGreaterThan(drivers[i - 1].position);
      }
    }
  });

  it('total points on row 1 is non-zero (championship leader has scored)', () => {
    const out = parseWecStandings(REAL_FIXTURE)!;
    expect(out.drivers.Hypercar[0].points).toBeGreaterThan(0);
    expect(out.manufacturers.Hypercar![0].points).toBeGreaterThan(0);
    expect(out.drivers.LMGT3[0].points).toBeGreaterThan(0);
    expect(out.teams.LMGT3![0].points).toBeGreaterThan(0);
  });

  it('drops tables that fall below the 4-row sanity floor', () => {
    // Construct a synthetic page with just one row in the Hypercar drivers
    // table. The parser should refuse to surface a near-empty table.
    const stub = `<html><body>
      <button data-bs-toggle="collapse" data-bs-target="#x">FIA Hypercar World Endurance Drivers Championship</button>
      <div id="x"><table class="table-standing"><tbody>
        <tr><td>1</td><td><img alt="BMW"/></td><td>#20</td><td><span class="text-body">A B</span></td><td>43</td></tr>
      </tbody></table></div>
    </body></html>`;
    expect(parseWecStandings(stub)).toBeNull();
  });

  it('Hypercar manufacturers list includes Toyota and Ferrari (2026 grid)', () => {
    const out = parseWecStandings(REAL_FIXTURE)!;
    const names = out.manufacturers.Hypercar!.map(m => m.manufacturer.toUpperCase());
    expect(names).toContain('TOYOTA');
    expect(names).toContain('FERRARI');
  });
});

describe('WEC_* class lists', () => {
  it('Hypercar awards Drivers + Manufacturers but not Teams', () => {
    expect(WEC_CLASSES).toContain('Hypercar');
    expect(WEC_MANUFACTURER_CLASSES).toContain('Hypercar');
    expect(WEC_TEAM_CLASSES).not.toContain('Hypercar');
  });

  it('LMGT3 awards Drivers + Teams but not Manufacturers', () => {
    expect(WEC_CLASSES).toContain('LMGT3');
    expect(WEC_TEAM_CLASSES).toContain('LMGT3');
    expect(WEC_MANUFACTURER_CLASSES).not.toContain('LMGT3');
  });
});

describe('fetchWecStandings', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns null on non-2xx response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });
    expect(await fetchWecStandings()).toBeNull();
  });

  it('returns null on fetch throw', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network down'),
    );
    expect(await fetchWecStandings()).toBeNull();
  });

  it('parses live response and returns 4 tables', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => REAL_FIXTURE,
    });
    const out = await fetchWecStandings();
    expect(out).not.toBeNull();
    expect(out!.drivers.Hypercar.length).toBeGreaterThan(0);
    expect(out!.drivers.LMGT3.length).toBeGreaterThan(0);
    expect(out!.manufacturers.Hypercar?.length ?? 0).toBeGreaterThan(0);
    expect(out!.teams.LMGT3?.length ?? 0).toBeGreaterThan(0);
  });
});

// Durable last-good: a fiawec.com outage should serve the previous good
// standings instead of the null that blanks the page. Supabase IS configured
// here (in-memory fake); WecStandings carries no Date fields so no rehydration.
// isEmpty keys off a non-empty per-class drivers map.
describe('fetchWecStandings — durable last-good (source_snapshot)', () => {
  const originalFetch = globalThis.fetch;
  const okFor = (html: string) =>
    ({ ok: true, status: 200, text: async () => html }) as Response;
  const goodFetch = () =>
    vi.fn(async () => okFor(REAL_FIXTURE)) as unknown as typeof fetch;
  const downFetch = () =>
    vi.fn(async () => ({ ok: false, status: 503, text: async () => '' }) as Response) as unknown as typeof fetch;

  beforeEach(() => {
    snapshotTable.clear();
    snapshotConfigured = true;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    snapshotConfigured = false;
    snapshotTable.clear();
    vi.restoreAllMocks();
  });

  it('SUCCESS persists the standings under standings:wec', async () => {
    globalThis.fetch = goodFetch();
    const data = await fetchWecStandings();
    expect(data).not.toBeNull();
    expect(snapshotTable.has('standings:wec')).toBe(true);
  });

  it('FAILURE serves the last-good standings instead of null', async () => {
    globalThis.fetch = goodFetch();
    await fetchWecStandings(); // prime the snapshot
    globalThis.fetch = downFetch(); // fiawec.com 503
    const recovered = await fetchWecStandings();
    expect(recovered).not.toBeNull();
    expect(recovered!.drivers.Hypercar.length).toBeGreaterThan(0);
    expect(recovered!.drivers.LMGT3.length).toBeGreaterThan(0);
  });

  it('a good fetch overwrites the snapshot (self-heal)', async () => {
    // Seed a deliberately-stale snapshot, then a good fetch must replace it.
    snapshotTable.set('standings:wec', {
      drivers: { Hypercar: [{ position: 1, driverName: 'stale', team: 'x', points: 0 }], LMGT3: [] },
      teams: {},
      manufacturers: {},
    });
    globalThis.fetch = goodFetch();
    await fetchWecStandings();
    const stored = snapshotTable.get('standings:wec') as {
      drivers: { Hypercar: unknown[]; LMGT3: unknown[] };
    };
    expect(stored.drivers.Hypercar.length).toBeGreaterThan(1);
  });

  it('FAILURE with no snapshot present returns null (today behaviour)', async () => {
    globalThis.fetch = downFetch();
    expect(await fetchWecStandings()).toBeNull();
  });

  it('FAIL-SOFT: Supabase unconfigured behaves exactly like the live fetch', async () => {
    snapshotConfigured = false;
    globalThis.fetch = downFetch();
    expect(await fetchWecStandings()).toBeNull();
  });
});
