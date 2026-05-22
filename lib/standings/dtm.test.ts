import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
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
