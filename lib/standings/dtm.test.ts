import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// In-memory fake of the durable `source_snapshot` table so the last-good wrap on
// `fetchDTMStandings` can be exercised. `snapshotConfigured` defaults FALSE so
// the pre-existing fetch tests below behave exactly as before (wrapper runs the
// fetcher uncached, as in a test env with no SUPABASE_URL); the last-good block
// flips it on.
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
  parseDriverStandingsFromHtml,
  parseTeamStandingsFromHtml,
  parseConstructorStandingsFromHtml,
  fetchDTMStandings,
} from './dtm';

const FIXTURE_DIR = join(__dirname, '..', '..', 'tests', 'fixtures');

const driversHtml = readFileSync(
  join(FIXTURE_DIR, 'dtm-standings-drivers-2026.html'),
  'utf-8',
);
const teamsHtml = readFileSync(
  join(FIXTURE_DIR, 'dtm-standings-teams-2026.html'),
  'utf-8',
);
const constructorsHtml = readFileSync(
  join(FIXTURE_DIR, 'dtm-standings-constructors-2026.html'),
  'utf-8',
);

describe('parseDriverStandingsFromHtml', () => {
  it('reads the 2026 driver standings after R1', () => {
    const rows = parseDriverStandingsFromHtml(driversHtml);
    expect(rows).not.toBeNull();
    expect(rows!.length).toBeGreaterThanOrEqual(15);
    expect(rows![0]).toMatchObject({
      position: 1,
      driverName: 'M. Engel',
      team: 'Mercedes-AMG Team Ravenol',
      points: 44,
    });
    expect(rows![1]).toMatchObject({
      position: 2,
      driverName: 'L. Auer',
      team: 'Mercedes-AMG Team Landgraf',
      points: 37,
    });
    expect(rows![2]).toMatchObject({
      position: 3,
      driverName: 'M. Wittmann',
      team: 'Schubert Motorsport',
      points: 31,
    });
  });

  it('captures per-round points breakdown per driver', () => {
    const rows = parseDriverStandingsFromHtml(driversHtml);
    expect(rows).not.toBeNull();
    // Engel: R1 = 44 pts, R2-R9 unraced ("-" → 0)
    expect(rows![0].perRoundPoints[0]).toBe(44);
    expect(rows![0].perRoundPoints.slice(1).every(n => n === 0)).toBe(true);
  });

  it('per-round sum reconciles to total points (drivers)', () => {
    const rows = parseDriverStandingsFromHtml(driversHtml);
    expect(rows).not.toBeNull();
    for (const r of rows!) {
      const sum = r.perRoundPoints.reduce((acc, n) => acc + n, 0);
      expect({ driver: r.driverName, sum }).toEqual({
        driver: r.driverName,
        sum: r.points,
      });
    }
  });

  it('handles driver rows without a profile link (info div fallback)', () => {
    // F. Wiebelhaus + T. Kalender ran R1 but have no driver-page link on
    // motorsport.com yet; the cell uses `<div class="info">` instead of `<a>`.
    const rows = parseDriverStandingsFromHtml(driversHtml);
    const wiebelhaus = rows!.find(r => r.driverName === 'F. Wiebelhaus');
    expect(wiebelhaus).toBeDefined();
    expect(wiebelhaus!.team).toBe('HRT Ford Performance');
  });

  it('fails closed below MIN_DRIVER_ROWS', () => {
    expect(parseDriverStandingsFromHtml('<html></html>')).toBeNull();
  });
});

describe('parseTeamStandingsFromHtml', () => {
  it('reads the team standings after R1', () => {
    const rows = parseTeamStandingsFromHtml(teamsHtml);
    expect(rows).not.toBeNull();
    expect(rows!.length).toBeGreaterThanOrEqual(8);
    expect(rows![0]).toMatchObject({
      position: 1,
      name: 'Mercedes-AMG Team Landgraf',
      points: 49,
    });
    expect(rows![1]).toMatchObject({
      position: 2,
      name: 'Mercedes-AMG Team Ravenol',
      points: 41,
    });
  });

  it('per-round sum reconciles to total points (teams)', () => {
    const rows = parseTeamStandingsFromHtml(teamsHtml);
    expect(rows).not.toBeNull();
    for (const r of rows!) {
      const sum = r.perRoundPoints.reduce((acc, n) => acc + n, 0);
      expect({ team: r.name, sum }).toEqual({ team: r.name, sum: r.points });
    }
  });
});

describe('parseConstructorStandingsFromHtml', () => {
  it('reads the constructor standings after R1', () => {
    const rows = parseConstructorStandingsFromHtml(constructorsHtml);
    expect(rows).not.toBeNull();
    expect(rows!.length).toBeGreaterThanOrEqual(4);
    expect(rows![0]).toMatchObject({
      position: 1,
      name: 'Mercedes',
      points: 103,
    });
    expect(rows![1]).toMatchObject({ position: 2, name: 'BMW', points: 41 });
    expect(rows![2]).toMatchObject({ position: 3, name: 'McLaren', points: 20 });
    expect(rows![3]).toMatchObject({
      position: 4,
      name: 'Aston Martin',
      points: 17,
    });
  });
});

describe('fetchDTMStandings', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fans out 3 fetches and merges into a triple-table shape', async () => {
    const urlToHtml = new Map<string, string>([
      ['https://www.motorsport.com/dtm/standings/2026/?type=Driver&class=', driversHtml],
      ['https://www.motorsport.com/dtm/standings/2026/?type=Team&class=', teamsHtml],
      ['https://www.motorsport.com/dtm/standings/2026/?type=Constructor&class=', constructorsHtml],
    ]);
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const html = urlToHtml.get(url);
      return {
        ok: html !== undefined,
        status: html ? 200 : 404,
        text: async () => html ?? '',
      } as Response;
    }) as unknown as typeof fetch;

    const data = await fetchDTMStandings();
    expect(data).not.toBeNull();
    expect(data!.drivers.length).toBeGreaterThanOrEqual(15);
    expect(data!.teams.length).toBeGreaterThanOrEqual(8);
    expect(data!.constructors.length).toBeGreaterThanOrEqual(4);
    expect(data!.driverRoundBreakdown[0].driverName).toBe('M. Engel');
  });

  it('returns null when the drivers fetch fails', async () => {
    globalThis.fetch = vi.fn(async () =>
      ({ ok: false, status: 500, text: async () => '' }) as Response,
    ) as unknown as typeof fetch;
    expect(await fetchDTMStandings()).toBeNull();
  });

  it('keeps drivers when teams/constructors fetches fail (partial success)', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('type=Driver')) {
        return { ok: true, status: 200, text: async () => driversHtml } as Response;
      }
      return { ok: false, status: 503, text: async () => '' } as Response;
    }) as unknown as typeof fetch;
    const data = await fetchDTMStandings();
    expect(data).not.toBeNull();
    expect(data!.drivers.length).toBeGreaterThanOrEqual(15);
    expect(data!.teams).toEqual([]);
    expect(data!.constructors).toEqual([]);
  });
});

// Durable last-good: a motorsport.com outage should serve the previous good
// standings instead of the null that blanks the page. Supabase IS configured
// here (in-memory fake); DTMStandings carries no Date fields so no rehydration.
describe('fetchDTMStandings — durable last-good (source_snapshot)', () => {
  const originalFetch = globalThis.fetch;
  const okFor = (html: string) =>
    ({ ok: true, status: 200, text: async () => html }) as Response;
  const goodFetch = () =>
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('type=Driver')) return okFor(driversHtml);
      if (url.includes('type=Team')) return okFor(teamsHtml);
      if (url.includes('type=Constructor')) return okFor(constructorsHtml);
      return { ok: false, status: 404, text: async () => '' } as Response;
    }) as unknown as typeof fetch;
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

  it('SUCCESS persists the standings under standings:dtm', async () => {
    globalThis.fetch = goodFetch();
    const data = await fetchDTMStandings();
    expect(data).not.toBeNull();
    expect(snapshotTable.has('standings:dtm')).toBe(true);
  });

  it('FAILURE serves the last-good standings instead of null', async () => {
    globalThis.fetch = goodFetch();
    await fetchDTMStandings(); // prime the snapshot
    globalThis.fetch = downFetch(); // motorsport.com 503 everywhere
    const recovered = await fetchDTMStandings();
    expect(recovered).not.toBeNull();
    expect(recovered!.drivers.length).toBeGreaterThanOrEqual(15);
    expect(recovered!.drivers[0].driverName).toBe('M. Engel');
  });

  it('a good fetch overwrites the snapshot (self-heal)', async () => {
    // Seed a deliberately-stale snapshot, then a good fetch must replace it.
    snapshotTable.set('standings:dtm', { drivers: [{ position: 1, driverName: 'stale', team: 'x', points: 0 }] });
    globalThis.fetch = goodFetch();
    await fetchDTMStandings();
    const stored = snapshotTable.get('standings:dtm') as { drivers: unknown[] };
    expect(stored.drivers.length).toBeGreaterThanOrEqual(15);
  });

  it('FAILURE with no snapshot present returns null (today behaviour)', async () => {
    globalThis.fetch = downFetch();
    expect(await fetchDTMStandings()).toBeNull();
  });

  it('FAIL-SOFT: Supabase unconfigured behaves exactly like the live fetch', async () => {
    snapshotConfigured = false;
    globalThis.fetch = downFetch();
    expect(await fetchDTMStandings()).toBeNull();
  });
});
