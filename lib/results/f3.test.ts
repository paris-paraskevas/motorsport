import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchF3SeasonResults } from './f3';

// In-memory KV stand-in. Most tests run with KV unconfigured so the cache
// path is a transparent no-op; the dedicated cache tests below opt in.
const kvStore = new Map<string, unknown>();
vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => {
      const raw = kvStore.get(key);
      if (raw === undefined) return null;
      return JSON.parse(JSON.stringify(raw));
    }),
    set: vi.fn(async (key: string, value: unknown) => {
      kvStore.set(key, value);
      return 'OK';
    }),
  },
}));

function html(payload: unknown): string {
  return `<!doctype html><html><head><title>F3</title>` +
    `<script id="__NEXT_DATA__" type="application/json">` +
    `${JSON.stringify(payload)}` +
    `</script></head><body></body></html>`;
}

interface DriverFixture {
  driverID: number;
  tla: string;
  forename: string;
  surname: string;
  team: string;
  totalPoints: number;
  racePoints: Array<Array<number | null>>;
}

function standingsFixture(opts: {
  drivers: DriverFixture[];
  seasonRaces: Array<{
    raceId: number;
    circuitShortName: string;
    startDate: string;
    endDate: string;
    provisional?: boolean;
    sessions?: string[];
  }>;
}) {
  return html({
    props: {
      pageProps: {
        pageData: {
          SeasonRaces: opts.seasonRaces.map(r => ({
            RaceId: r.raceId,
            CircuitShortName: r.circuitShortName,
            Provisional: r.provisional ?? false,
            RaceStartDate: r.startDate,
            RaceEndDate: r.endDate,
            Sessions: (r.sessions ?? ['SR', 'FR']).map(s => ({ SessionShortName: s })),
          })),
          Standings: opts.drivers.map(d => ({
            Position: 1,
            DriverID: d.driverID,
            TLA: d.tla,
            DisplayName: `${d.forename[0]}. ${d.surname}`,
            FullName: `${d.forename} ${d.surname}`,
            CountryCode: 'XX',
            TeamName: d.team,
            TotalPoints: d.totalPoints,
            RacePoints: d.racePoints,
          })),
        },
      },
    },
  });
}

function raceResultRow(opts: {
  driverID: number;
  tla: string;
  forename: string;
  surname: string;
  team: string;
  finishPosition: number | null;
  time?: string;
  gap?: string;
  status?: string;
  displayPos?: string;
}) {
  return {
    DriverId: opts.driverID,
    FinishPosition: opts.finishPosition,
    DriverForename: opts.forename,
    DriverSurname: opts.surname,
    TLA: opts.tla,
    DriverDisplayName: `${opts.forename[0]}. ${opts.surname}`,
    TeamName: opts.team,
    TimeOrFinishReason: opts.time ?? null,
    Gap: opts.gap ?? null,
    ResultStatus: opts.status ?? null,
    DisplayFinishPosition: opts.displayPos ?? null,
  };
}

function raceResultsFixture(opts: {
  raceId: number;
  roundNumber: number;
  countryName: string;
  circuitName: string;
  startDate: string;
  endDate: string;
  sprintRows?: ReturnType<typeof raceResultRow>[];
  featureRows?: ReturnType<typeof raceResultRow>[];
}) {
  const sessions: unknown[] = [];
  // Always emit a Practice session so the parser proves it skips non-races.
  sessions.push({
    SessionShortName: 'Prac 1',
    Results: [],
    SessionResultsAvailable: true,
  });
  sessions.push({
    SessionShortName: 'Qual',
    Results: [],
    SessionResultsAvailable: true,
  });
  if (opts.sprintRows) {
    sessions.push({
      SessionShortName: 'SR',
      SessionResultsAvailable: true,
      Results: opts.sprintRows,
    });
  }
  if (opts.featureRows) {
    sessions.push({
      SessionShortName: 'FR',
      SessionResultsAvailable: true,
      Results: opts.featureRows,
    });
  }
  return html({
    props: {
      pageProps: {
        pageData: {
          RaceId: opts.raceId,
          RoundNumber: opts.roundNumber,
          RaceStartDate: opts.startDate,
          RaceEndDate: opts.endDate,
          CountryName: opts.countryName,
          CircuitInformation: { CircuitName: opts.circuitName },
          SessionResults: sessions,
        },
      },
    },
  });
}

// 12 named drivers, just enough above the F2 sanity floor for comfort.
const DRIVERS = [
  { driverID: 1463, tla: 'UGO', forename: 'Ugo', surname: 'Ugochukwu', team: 'Campos Racing' },
  { driverID: 1462, tla: 'BAD', forename: 'Brando', surname: 'Badoer', team: 'Rodin Motorsport' },
  { driverID: 1461, tla: 'STR', forename: 'Noah', surname: 'Strømsted', team: 'TRIDENT' },
  { driverID: 1460, tla: 'KAT', forename: 'Taito', surname: 'Kato', team: 'ART Grand Prix' },
  { driverID: 1459, tla: 'EDE', forename: 'Enzo', surname: 'Deligny', team: 'Van Amersfoort Racing' },
  { driverID: 1458, tla: 'BDE', forename: 'Bruno', surname: 'Del Pino', team: 'Van Amersfoort Racing' },
  { driverID: 1457, tla: 'NAK', forename: 'Jin', surname: 'Nakamura', team: 'Hitech' },
  { driverID: 1456, tla: 'GLA', forename: 'Maciej', surname: 'Gładysz', team: 'ART Grand Prix' },
  { driverID: 1455, tla: 'LAC', forename: 'Nicola', surname: 'Lacorte', team: 'DAMS Lucas Oil' },
  { driverID: 1454, tla: 'WHA', forename: 'James', surname: 'Wharton', team: 'PREMA Racing' },
  { driverID: 1453, tla: 'NAE', forename: 'Théophile', surname: 'Naël', team: 'Campos Racing' },
  { driverID: 1452, tla: 'BAR', forename: 'Fernando', surname: 'Barrichello', team: 'AIX Racing' },
];

// Melbourne 2026 — operator-reported case. SR was red-flag-reduced; only
// top 5 scored. FR was full distance and Ugochukwu won.
// Standings RacePoints[0] for each driver = [SR, FR].
function melbourneRacePoints(driverIdx: number): Array<Array<number | null>> {
  // Standings RacePoints rows mirror the round-1 SR + FR outcome shown below.
  // round-1 only; rest of the season is null/null (future rounds).
  const SR_BY_DRIVER_IDX: Record<number, number> = {
    // Indices below match the DRIVERS array order. SR P1-P5 = 5,4,3,2,1; P6+ = 0.
    5: 5,  // BDE — finished SR P1
    4: 4,  // EDE — finished SR P2
    1: 3,  // BAD — finished SR P3
    2: 2,  // STR — finished SR P4
    3: 1,  // KAT — finished SR P5
    0: 0,  // UGO — finished SR P8, scored 0 (red-flag-reduced)
  };
  const FR_BY_DRIVER_IDX: Record<number, number> = {
    0: 25, // UGO — won FR
    1: 18, // BAD
    2: 15, // STR
    3: 12, // KAT
    4: 10, // EDE
    5: 8,  // BDE
    6: 6,
    7: 4,
    8: 2,
    9: 1,
  };
  return [
    [SR_BY_DRIVER_IDX[driverIdx] ?? 0, FR_BY_DRIVER_IDX[driverIdx] ?? 0],
    ...Array.from({ length: 8 }, () => [null, null] as Array<number | null>),
  ];
}

const MELBOURNE_STANDINGS = standingsFixture({
  drivers: DRIVERS.map((d, idx) => ({
    ...d,
    totalPoints:
      (melbourneRacePoints(idx)[0][0] ?? 0) + (melbourneRacePoints(idx)[0][1] ?? 0),
    racePoints: melbourneRacePoints(idx),
  })),
  seasonRaces: [
    { raceId: 1069, circuitShortName: 'Melbourne', startDate: '2026-03-06', endDate: '2026-03-08' },
    { raceId: 1071, circuitShortName: 'Monaco', startDate: '2026-06-04', endDate: '2026-06-07' },
  ],
});

const MELBOURNE_RESULTS = raceResultsFixture({
  raceId: 1069,
  roundNumber: 1,
  countryName: 'Australia',
  circuitName: 'Albert Park',
  startDate: '2026-03-06',
  endDate: '2026-03-08',
  sprintRows: [
    // Sprint Race classification (red-flag-reduced). Position 1-12.
    raceResultRow({ ...DRIVERS[5], finishPosition: 1, time: '11:30.000' }),
    raceResultRow({ ...DRIVERS[4], finishPosition: 2, gap: '+1.234' }),
    raceResultRow({ ...DRIVERS[1], finishPosition: 3, gap: '+2.000' }),
    raceResultRow({ ...DRIVERS[2], finishPosition: 4, gap: '+3.000' }),
    raceResultRow({ ...DRIVERS[3], finishPosition: 5, gap: '+4.000' }),
    raceResultRow({ ...DRIVERS[6], finishPosition: 6, gap: '+5.000' }),
    raceResultRow({ ...DRIVERS[7], finishPosition: 7, gap: '+6.000' }),
    raceResultRow({ ...DRIVERS[0], finishPosition: 8, gap: '+9.562' }),
    raceResultRow({ ...DRIVERS[8], finishPosition: 9, gap: '+10.000' }),
    raceResultRow({ ...DRIVERS[9], finishPosition: 10, gap: '+11.000' }),
    raceResultRow({ ...DRIVERS[10], finishPosition: 11, gap: '+12.000' }),
    raceResultRow({ ...DRIVERS[11], finishPosition: 12, gap: '+13.000' }),
  ],
  featureRows: [
    // Feature Race — Ugochukwu wins.
    raceResultRow({ ...DRIVERS[0], finishPosition: 1, time: '42:59.653' }),
    raceResultRow({ ...DRIVERS[1], finishPosition: 2, gap: '+0.500' }),
    raceResultRow({ ...DRIVERS[2], finishPosition: 3, gap: '+1.000' }),
    raceResultRow({ ...DRIVERS[3], finishPosition: 4, gap: '+1.500' }),
    raceResultRow({ ...DRIVERS[4], finishPosition: 5, gap: '+2.000' }),
    raceResultRow({ ...DRIVERS[5], finishPosition: 6, gap: '+2.500' }),
    raceResultRow({ ...DRIVERS[6], finishPosition: 7, gap: '+3.000' }),
    raceResultRow({ ...DRIVERS[7], finishPosition: 8, gap: '+3.500' }),
    raceResultRow({ ...DRIVERS[8], finishPosition: 9, gap: '+4.000' }),
    raceResultRow({ ...DRIVERS[9], finishPosition: 10, gap: '+4.500' }),
    raceResultRow({ ...DRIVERS[10], finishPosition: 11, gap: '+5.000' }),
    raceResultRow({ ...DRIVERS[11], finishPosition: 12, gap: '+5.500' }),
  ],
});

// Monaco — both sessions yet to run (no SessionResults entries for SR/FR).
const MONACO_RESULTS = raceResultsFixture({
  raceId: 1071,
  roundNumber: 2,
  countryName: 'Monaco',
  circuitName: 'Circuit de Monaco',
  startDate: '2026-06-04',
  endDate: '2026-06-07',
});

function setupFetch(routes: Record<string, string | (() => Response | Promise<Response>)>) {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    for (const [pattern, handler] of Object.entries(routes)) {
      if (u.includes(pattern)) {
        if (typeof handler === 'function') return handler();
        return { ok: true, status: 200, text: async () => handler } as Response;
      }
    }
    return { ok: false, status: 404, text: async () => '' } as Response;
  }) as unknown as typeof fetch;
}

describe('fetchF3SeasonResults', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    kvStore.clear();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('emits Feature + Sprint per completed round with canonical FIA points', async () => {
    setupFetch({
      '/Standings/Driver': MELBOURNE_STANDINGS,
      'raceid=1069': MELBOURNE_RESULTS,
      'raceid=1071': MONACO_RESULTS,
    });
    const races = await fetchF3SeasonResults(2026);
    // Two RaceResult entries (FR + SR for Melbourne); Monaco hasn't run yet.
    expect(races).toHaveLength(2);

    const melbourneFR = races.find(r => r.raceName === 'Australia Feature Race');
    const melbourneSR = races.find(r => r.raceName === 'Australia Sprint Race');
    expect(melbourneFR).toBeDefined();
    expect(melbourneSR).toBeDefined();

    // Feature Race ordered before Sprint Race within the same round.
    expect(races[0].raceName).toBe('Australia Feature Race');
    expect(races[1].raceName).toBe('Australia Sprint Race');

    // Ugochukwu's points across the two sessions: 25 (FR P1) + 0 (SR P8).
    // 25 — not 26 — proves we sourced from RacePoints rather than recomputing
    // from position with the pre-migration scale.
    const ugoFR = melbourneFR!.results.find(r => r.driverCode === 'UGO');
    const ugoSR = melbourneSR!.results.find(r => r.driverCode === 'UGO');
    expect(ugoFR!.points).toBe(25);
    expect(ugoSR!.points).toBe(0);
  });

  it('honors red-flag-reduced scoring for the Sprint Race', async () => {
    setupFetch({
      '/Standings/Driver': MELBOURNE_STANDINGS,
      'raceid=1069': MELBOURNE_RESULTS,
      'raceid=1071': MONACO_RESULTS,
    });
    const races = await fetchF3SeasonResults(2026);
    const sr = races.find(r => r.raceName === 'Australia Sprint Race')!;

    // P1 - P5 score 5-4-3-2-1; P6+ score 0. This is the half-distance rule.
    const byPos = (pos: number) => sr.results.find(r => r.position === pos);
    expect(byPos(1)!.points).toBe(5);
    expect(byPos(2)!.points).toBe(4);
    expect(byPos(3)!.points).toBe(3);
    expect(byPos(4)!.points).toBe(2);
    expect(byPos(5)!.points).toBe(1);
    expect(byPos(6)!.points).toBe(0);
    expect(byPos(7)!.points).toBe(0);
    expect(byPos(8)!.points).toBe(0);
  });

  it('drops a round whose Feature + Sprint sessions have not run yet', async () => {
    setupFetch({
      '/Standings/Driver': MELBOURNE_STANDINGS,
      'raceid=1069': MELBOURNE_RESULTS,
      'raceid=1071': MONACO_RESULTS,
    });
    const races = await fetchF3SeasonResults(2026);
    const monaco = races.find(r => r.raceName.startsWith('Monaco'));
    expect(monaco).toBeUndefined();
  });

  it('returns an empty array when the standings page fetch fails', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as Response)) as unknown as typeof fetch;
    const races = await fetchF3SeasonResults(2026);
    expect(races).toEqual([]);
  });

  it('returns an empty array when the fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const races = await fetchF3SeasonResults(2026);
    expect(races).toEqual([]);
  });

  it('returns an empty array when SeasonRaces is missing from the payload', async () => {
    const emptyStandings = html({
      props: { pageProps: { pageData: { Standings: [] } } },
    });
    setupFetch({ '/Standings/Driver': emptyStandings });
    const races = await fetchF3SeasonResults(2026);
    expect(races).toEqual([]);
  });

  it('skips a SeasonRace marked Provisional', async () => {
    const standings = standingsFixture({
      drivers: DRIVERS.map((d, idx) => ({
        ...d,
        totalPoints:
          (melbourneRacePoints(idx)[0][0] ?? 0) + (melbourneRacePoints(idx)[0][1] ?? 0),
        racePoints: melbourneRacePoints(idx),
      })),
      seasonRaces: [
        { raceId: 1069, circuitShortName: 'Melbourne', startDate: '2026-03-06', endDate: '2026-03-08' },
        { raceId: 9999, circuitShortName: 'Bahrain', startDate: '2026-04-01', endDate: '2026-04-03', provisional: true },
      ],
    });
    setupFetch({
      '/Standings/Driver': standings,
      'raceid=1069': MELBOURNE_RESULTS,
      'raceid=9999': raceResultsFixture({
        raceId: 9999, roundNumber: 2, countryName: 'Bahrain', circuitName: 'Sakhir',
        startDate: '2026-04-01', endDate: '2026-04-03',
        featureRows: [], sprintRows: [],
      }),
    });
    const races = await fetchF3SeasonResults(2026);
    // Bahrain provisional → never fetched, never in the output.
    expect(races.every(r => !r.raceName.includes('Bahrain'))).toBe(true);
    expect(races.length).toBe(2); // Just the two Melbourne sessions.
  });

  describe('cache layer', () => {
    beforeEach(() => {
      process.env.KV_REST_API_URL = 'https://kv.test.invalid';
      process.env.KV_REST_API_TOKEN = 'test-token';
    });

    it('returns cached payload on hit without touching upstream', async () => {
      kvStore.set('paddock:results:f3:season:2026', [
        {
          round: 1,
          raceName: 'Cached Feature',
          date: new Date('2026-03-08T00:00:00Z'),
          circuit: 'Cached',
          results: [
            { position: 1, driverName: 'Cached Driver', team: 'Cached Team', status: 'Finished', points: 25 },
          ],
        },
      ]);
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const races = await fetchF3SeasonResults(2026);
      expect(races).toHaveLength(1);
      expect(races[0].raceName).toBe('Cached Feature');
      expect(races[0].date).toBeInstanceOf(Date);
      expect(races[0].date.toISOString()).toBe('2026-03-08T00:00:00.000Z');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('on cache miss writes the fresh payload', async () => {
      setupFetch({
        '/Standings/Driver': MELBOURNE_STANDINGS,
        'raceid=1069': MELBOURNE_RESULTS,
        'raceid=1071': MONACO_RESULTS,
      });
      const races = await fetchF3SeasonResults(2026);
      expect(races.length).toBeGreaterThan(0);
      const stored = kvStore.get('paddock:results:f3:season:2026') as unknown[] | undefined;
      expect(stored).toBeDefined();
      expect(stored!.length).toBeGreaterThan(0);
    });

    it('does not write an empty payload to cache', async () => {
      globalThis.fetch = vi.fn(async () => ({
        ok: false, status: 500, text: async () => '',
      } as Response)) as unknown as typeof fetch;
      const races = await fetchF3SeasonResults(2026);
      expect(races).toEqual([]);
      expect(kvStore.has('paddock:results:f3:season:2026')).toBe(false);
    });
  });
});
