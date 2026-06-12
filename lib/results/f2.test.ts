import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchF2SeasonResults } from './f2';

// In-memory KV stand-in. Most tests run with KV unconfigured (no env vars) so
// the cache path is a transparent no-op; the dedicated cache-hit / cache-miss
// tests below opt into KV by setting env vars + populating the store.
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

function nextDataHtml(payload: unknown): string {
  return `<!doctype html><html><head>` +
    `<script id="__NEXT_DATA__" type="application/json">` +
    `${JSON.stringify(payload)}` +
    `</script></head><body></body></html>`;
}

function manifestPayload(opts: {
  races: Array<{ raceId: number; round?: number; circuit?: string; startDate?: string; endDate?: string; provisional?: boolean; sessions?: Array<'SR' | 'FR' | 'Qual' | 'Prac'> }>;
  // DriverID → per-round [SR, FR] canonical points (the page's RacePoints
  // shape). Tests that assert points provide this; others keep the empty
  // synthetic rows.
  racePoints?: Record<number, Array<[number | null, number | null]>>;
}) {
  const standings = opts.racePoints
    ? Object.entries(opts.racePoints).map(([driverId, points], i) => ({
        Position: i + 1,
        DriverID: Number(driverId),
        FullName: `Driver ${driverId}`,
        TeamName: 'Team A',
        TotalPoints: 0,
        RacePoints: points,
      }))
    : Array.from({ length: 16 }, (_, i) => ({
        Position: i + 1,
        FullName: `Driver ${i + 1}`,
        TeamName: 'Team A',
        TotalPoints: 0,
        RacePoints: Array.from({ length: opts.races.length }, () => [null, null]),
      }));
  return {
    props: {
      pageProps: {
        pageData: {
          Standings: standings,
          SeasonRaces: opts.races.map((r, idx) => ({
            RaceId: r.raceId,
            CircuitShortName: r.circuit ?? `Circuit ${idx + 1}`,
            Provisional: r.provisional ?? false,
            RaceStartDate: r.startDate ?? '2026-03-06',
            RaceEndDate: r.endDate ?? '2026-03-08',
            Sessions: (r.sessions ?? ['SR', 'FR']).map(s => ({ SessionShortName: s })),
          })),
        },
      },
    },
  };
}

function resultsPayload(opts: {
  raceId: number;
  round: number;
  country?: string;
  circuit?: string;
  startDate?: string;
  endDate?: string;
  feature?: Array<ResultRow>;
  sprint?: Array<ResultRow>;
  hideSprint?: boolean;
  hideFeature?: boolean;
}) {
  const session = (shortName: 'SR' | 'FR', results: Array<ResultRow>, hidden: boolean) => ({
    SessionShortName: shortName,
    SessionType: 'RESULT',
    HideSessionResult: hidden,
    SessionResultsAvailable: !hidden,
    Results: results.map(r => ({
      DriverId: r.driverId ?? null,
      FinishPosition: r.finishPosition,
      DriverForename: r.forename,
      DriverSurname: r.surname,
      TLA: r.tla,
      DriverDisplayName: `${r.forename[0]}. ${r.surname}`,
      TeamName: r.team,
      CarNumber: r.carNumber ?? 0,
      LapsCompleted: r.lapsCompleted ?? 25,
      TimeOrFinishReason: r.time ?? null,
      Gap: r.gap ?? null,
      Interval: r.interval ?? null,
      Speed: '143.8',
      Best: '1:56.0',
      BestLap: '22',
      ResultStatus: r.resultStatus ?? null,
      DisplayFinishPosition: r.displayFinishPosition ?? (r.finishPosition != null ? String(r.finishPosition) : 'DNF'),
    })),
  });
  return {
    props: {
      pageProps: {
        pageData: {
          RaceId: opts.raceId,
          SeasonId: 183,
          SeasonName: 'Formula 2 2026',
          CountryName: opts.country ?? 'USA',
          CountryCode: 'US',
          RoundNumber: opts.round,
          Provisional: false,
          RaceStartDate: opts.startDate ?? '2026-05-01',
          RaceEndDate: opts.endDate ?? '2026-05-03',
          CircuitInformation: { CircuitId: 1, CircuitName: opts.circuit ?? 'Miami International Autodrome' },
          SessionResults: [
            // Practice + qualifying interleaved as on the real page — parser
            // must locate FR/SR by SessionShortName rather than relying on
            // array index.
            { SessionShortName: 'Prac', SessionType: 'PRACTICE', Results: [] },
            { SessionShortName: 'Qual', SessionType: 'QUALIFYING', Results: [] },
            session('SR', opts.sprint ?? [], opts.hideSprint ?? false),
            session('FR', opts.feature ?? [], opts.hideFeature ?? false),
          ],
        },
      },
    },
  };
}

interface ResultRow {
  driverId?: number;
  finishPosition: number | null;
  forename: string;
  surname: string;
  tla: string;
  team: string;
  carNumber?: number;
  lapsCompleted?: number;
  time?: string | null;
  gap?: string | null;
  interval?: string | null;
  resultStatus?: string | null;
  displayFinishPosition?: string;
}

const MIAMI_FEATURE: ResultRow[] = [
  { driverId: 101, finishPosition: 1, forename: 'Gabriele', surname: 'Minì', tla: 'MIN', team: 'MP Motorsport', time: '56:22.029' },
  { driverId: 102, finishPosition: 2, forename: 'Dino', surname: 'Beganovic', tla: 'BEG', team: 'DAMS Lucas Oil', time: '56:23.009', gap: '0.980' },
  { driverId: 103, finishPosition: 3, forename: 'Rafael', surname: 'Câmara', tla: 'CAM', team: 'Invicta Racing', time: '56:24.069', gap: '2.040' },
  { driverId: 104, finishPosition: 4, forename: 'Nikola', surname: 'León', tla: 'LEO', team: 'Campos Racing', time: '56:24.429', gap: '2.400' },
  { driverId: 105, finishPosition: 5, forename: 'Kush', surname: 'Maini', tla: 'MAI', team: 'ART Grand Prix', time: '56:25.884', gap: '3.855' },
  { driverId: 106, finishPosition: 6, forename: 'Ritomo', surname: 'Miyata', tla: 'MIY', team: 'Hitech TGR', time: '56:26.476', gap: '4.447' },
  { driverId: 107, finishPosition: 7, forename: 'Marti', surname: 'Boya', tla: 'BOY', team: 'PREMA Racing', time: '56:29.952', gap: '7.923' },
  { driverId: 108, finishPosition: 8, forename: 'Colton', surname: 'Herta', tla: 'HER', team: 'Hitech TGR', time: '56:32.998', gap: '10.969' },
  { driverId: 109, finishPosition: 9, forename: 'Sebastian', surname: 'Montoya', tla: 'MON', team: 'PREMA Racing', time: '56:33.410', gap: '11.381' },
  { driverId: 110, finishPosition: 10, forename: 'Joshua', surname: 'Dürksen', tla: 'DUR', team: 'Invicta Racing', time: '56:34.364', gap: '12.335' },
  { driverId: 111, finishPosition: 11, forename: 'Laurens', surname: 'van Hoepen', tla: 'VAN', team: 'TRIDENT', time: '56:34.635', gap: '12.606' },
  { driverId: 112, finishPosition: null, forename: 'Cian', surname: 'Shields', tla: 'SHI', team: 'AIX Racing', time: '39:19.278', gap: 'DNF', resultStatus: 'Ret', displayFinishPosition: 'DNF' },
  { driverId: 113, finishPosition: null, forename: 'Nikola', surname: 'Tsolov', tla: 'TSO', team: 'Campos Racing', resultStatus: 'Ret', gap: 'DNF', displayFinishPosition: 'DNF' },
];

const MIAMI_SPRINT: ResultRow[] = [
  { driverId: 113, finishPosition: 1, forename: 'Nikola', surname: 'Tsolov', tla: 'TSO', team: 'Campos Racing', time: '39:26.273' },
  { driverId: 111, finishPosition: 2, forename: 'Laurens', surname: 'van Hoepen', tla: 'VAN', team: 'TRIDENT', time: '39:26.443', gap: '0.170' },
  { driverId: 114, finishPosition: 3, forename: 'Alexander', surname: 'Dunne', tla: 'DUN', team: 'Rodin Motorsport', time: '39:27.554', gap: '1.281' },
  { driverId: 115, finishPosition: 4, forename: 'Nico', surname: 'Varrone', tla: 'VAR', team: 'Van Amersfoort Racing', time: '39:30.811', gap: '4.538' },
  { driverId: 110, finishPosition: 5, forename: 'Joshua', surname: 'Dürksen', tla: 'DUR', team: 'Invicta Racing', time: '39:31.485', gap: '5.212' },
  { driverId: 116, finishPosition: 6, forename: 'Martinius', surname: 'Stenshorne', tla: 'STE', team: 'Rodin Motorsport', time: '39:31.900', gap: '5.627' },
  { driverId: 101, finishPosition: 7, forename: 'Gabriele', surname: 'Minì', tla: 'MIN', team: 'MP Motorsport', time: '39:32.043', gap: '5.770' },
  { driverId: 102, finishPosition: 8, forename: 'Dino', surname: 'Beganovic', tla: 'BEG', team: 'DAMS Lucas Oil', time: '39:33.027', gap: '6.754' },
  { driverId: 103, finishPosition: 9, forename: 'Rafael', surname: 'Câmara', tla: 'CAM', team: 'Invicta Racing', time: '39:33.500', gap: '7.227' },
  { driverId: 105, finishPosition: 10, forename: 'Kush', surname: 'Maini', tla: 'MAI', team: 'ART Grand Prix', time: '39:34.022', gap: '7.749' },
];

// Canonical RacePoints per driver, [SR, FR] per round (rounds 1-3). Round-2
// FR pins the reason for the RacePoints migration: Minì won WITH pole + FL,
// so his canonical FR value is 28 — the old position-table code emitted 25.
const RACE_POINTS: Record<number, Array<[number | null, number | null]>> = {
  101: [[8, 25], [2, 28], [null, null]], // Minì
  102: [[null, null], [1, 18], [null, null]], // Beganovic
  103: [[null, null], [0, 15], [null, null]], // Câmara
  104: [[null, null], [null, 12], [null, null]], // León
  105: [[null, null], [0, 10], [null, null]], // Maini
  106: [[null, null], [null, 8], [null, null]], // Miyata
  107: [[null, null], [null, 6], [null, null]], // Boya
  108: [[null, null], [null, 4], [null, null]], // Herta
  109: [[null, null], [null, 2], [null, null]], // Montoya
  110: [[null, null], [4, 1], [null, null]], // Dürksen
  111: [[null, null], [8, 0], [null, null]], // van Hoepen
  112: [[null, null], [null, 0], [null, null]], // Shields
  113: [[10, 18], [10, 0], [null, null]], // Tsolov
  114: [[null, null], [6, null], [null, null]], // Dunne
  115: [[null, null], [5, null], [null, null]], // Varrone
  116: [[null, null], [3, null], [null, null]], // Stenshorne
};

const MANIFEST_HTML = nextDataHtml(manifestPayload({
  races: [
    { raceId: 1092, round: 1, circuit: 'Melbourne', startDate: '2026-03-06', endDate: '2026-03-08' },
    { raceId: 1106, round: 2, circuit: 'Miami', startDate: '2026-05-01', endDate: '2026-05-03' },
    { raceId: 1107, round: 3, circuit: 'Montréal', startDate: '2026-05-22', endDate: '2026-05-24' },
  ],
  racePoints: RACE_POINTS,
}));

const MIAMI_RACE_HTML = nextDataHtml(
  resultsPayload({ raceId: 1106, round: 2, country: 'USA', circuit: 'Miami International Autodrome', startDate: '2026-05-01', endDate: '2026-05-03', feature: MIAMI_FEATURE, sprint: MIAMI_SPRINT }),
);

// Upcoming round — empty results, both sessions present but no Results data.
const MONTREAL_RACE_HTML = nextDataHtml(
  resultsPayload({ raceId: 1107, round: 3, country: 'Canada', circuit: 'Circuit Gilles-Villeneuve', startDate: '2026-05-22', endDate: '2026-05-24', feature: [], sprint: [] }),
);

// Round-1 Melbourne with results — keep small for test brevity.
const MELBOURNE_RACE_HTML = nextDataHtml(
  resultsPayload({ raceId: 1092, round: 1, country: 'Australia', circuit: 'Albert Park Circuit', startDate: '2026-03-06', endDate: '2026-03-08',
    feature: [
      { driverId: 101, finishPosition: 1, forename: 'Gabriele', surname: 'Minì', tla: 'MIN', team: 'MP Motorsport', time: '55:00.000' },
      { driverId: 113, finishPosition: 2, forename: 'Nikola', surname: 'Tsolov', tla: 'TSO', team: 'Campos Racing', time: '55:01.000', gap: '1.000' },
    ],
    sprint: [
      { driverId: 113, finishPosition: 1, forename: 'Nikola', surname: 'Tsolov', tla: 'TSO', team: 'Campos Racing', time: '38:00.000' },
      { driverId: 101, finishPosition: 2, forename: 'Gabriele', surname: 'Minì', tla: 'MIN', team: 'MP Motorsport', time: '38:01.000', gap: '1.000' },
    ],
  }),
);

function setupFetchMock(responses: Record<string, string | null>) {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    for (const [pattern, body] of Object.entries(responses)) {
      if (u.includes(pattern)) {
        if (body === null) throw new Error('network down');
        return { ok: true, status: 200, text: async () => body } as Response;
      }
    }
    return { ok: false, status: 404, text: async () => '' } as Response;
  }) as unknown as typeof fetch;
}

describe('fetchF2SeasonResults', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    kvStore.clear();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('returns feature + sprint arrays from the season manifest + race pages', async () => {
    setupFetchMock({
      '/Standings/Driver': MANIFEST_HTML,
      'raceid=1092': MELBOURNE_RACE_HTML,
      'raceid=1106': MIAMI_RACE_HTML,
      'raceid=1107': MONTREAL_RACE_HTML,
    });
    const out = await fetchF2SeasonResults();
    // Montreal has empty results → skipped. Melbourne + Miami contribute.
    expect(out.feature.map(r => r.round)).toEqual([1, 2]);
    expect(out.sprint.map(r => r.round)).toEqual([1, 2]);
    expect(out.feature[1].raceName).toBe('USA Feature Race');
    expect(out.feature[1].circuit).toBe('Miami International Autodrome');
    expect(out.feature[1].date.toISOString().startsWith('2026-05-03')).toBe(true);
  });

  it('parses positions, drivers, teams, times and reads canonical FR points incl. bonuses', async () => {
    setupFetchMock({
      '/Standings/Driver': MANIFEST_HTML,
      'raceid=1092': MELBOURNE_RACE_HTML,
      'raceid=1106': MIAMI_RACE_HTML,
      'raceid=1107': MONTREAL_RACE_HTML,
    });
    const out = await fetchF2SeasonResults();
    const miami = out.feature.find(r => r.round === 2)!;
    expect(miami.results[0]).toEqual({
      position: 1,
      driverName: 'Gabriele Minì',
      driverCode: 'MIN',
      team: 'MP Motorsport',
      status: 'Finished',
      time: '56:22.029',
      // Canonical RacePoints: win (25) + pole (+2) + fastest lap (+1) = 28.
      // The retired position-table code emitted 25 here — the audit-1a-2 bug.
      points: 28,
    });
    expect(miami.results[1].points).toBe(18);
    expect(miami.results[9].points).toBe(1);
    // 11th-placed driver scores zero.
    expect(miami.results[10].points).toBe(0);
  });

  it('sprint-race points come from the SR slot of RacePoints', async () => {
    setupFetchMock({
      '/Standings/Driver': MANIFEST_HTML,
      'raceid=1092': MELBOURNE_RACE_HTML,
      'raceid=1106': MIAMI_RACE_HTML,
      'raceid=1107': MONTREAL_RACE_HTML,
    });
    const out = await fetchF2SeasonResults();
    const miamiSprint = out.sprint.find(r => r.round === 2)!;
    expect(miamiSprint.results[0].points).toBe(10);
    expect(miamiSprint.results[1].points).toBe(8);
    expect(miamiSprint.results[7].points).toBe(1);
    // 9th/10th: canonical zero (and a missing RacePoints cell also maps to 0).
    expect(miamiSprint.results[8].points).toBe(0);
    expect(miamiSprint.results[9].points).toBe(0);
  });

  it('renders DNF rows with status "DNF" and zero points, placed after finishers', async () => {
    setupFetchMock({
      '/Standings/Driver': MANIFEST_HTML,
      'raceid=1092': MELBOURNE_RACE_HTML,
      'raceid=1106': MIAMI_RACE_HTML,
      'raceid=1107': MONTREAL_RACE_HTML,
    });
    const out = await fetchF2SeasonResults();
    const miami = out.feature.find(r => r.round === 2)!;
    const dnfs = miami.results.filter(r => r.status === 'DNF');
    expect(dnfs).toHaveLength(2);
    expect(dnfs[0].points).toBe(0);
    expect(dnfs[0].driverName).toBe('Cian Shields');
    // DNFs are appended after the 11 finishers — positions 12 onward.
    expect(dnfs[0].position).toBeGreaterThanOrEqual(12);
  });

  it('skips races where SessionResultsAvailable is false / HideSessionResult is true', async () => {
    const hidden = nextDataHtml(
      resultsPayload({ raceId: 1106, round: 2, country: 'USA', feature: MIAMI_FEATURE, sprint: MIAMI_SPRINT, hideFeature: true, hideSprint: true }),
    );
    setupFetchMock({
      '/Standings/Driver': MANIFEST_HTML,
      'raceid=1092': MELBOURNE_RACE_HTML,
      'raceid=1106': hidden,
      'raceid=1107': MONTREAL_RACE_HTML,
    });
    const out = await fetchF2SeasonResults();
    // Miami suppressed; only Melbourne remains.
    expect(out.feature.map(r => r.round)).toEqual([1]);
    expect(out.sprint.map(r => r.round)).toEqual([1]);
  });

  it('returns empty arrays when manifest fetch fails', async () => {
    setupFetchMock({});
    const out = await fetchF2SeasonResults();
    expect(out).toEqual({ feature: [], sprint: [] });
  });

  it('returns empty arrays when manifest has no SeasonRaces', async () => {
    setupFetchMock({
      '/Standings/Driver': nextDataHtml({ props: { pageProps: { pageData: { Standings: [], SeasonRaces: [] } } } }),
    });
    const out = await fetchF2SeasonResults();
    expect(out).toEqual({ feature: [], sprint: [] });
  });

  it('skips provisional races in the manifest', async () => {
    const provisionalManifest = nextDataHtml(manifestPayload({
      races: [
        { raceId: 1092, round: 1, circuit: 'Melbourne' },
        { raceId: 1106, round: 2, circuit: 'Miami', provisional: true },
      ],
    }));
    setupFetchMock({
      '/Standings/Driver': provisionalManifest,
      'raceid=1092': MELBOURNE_RACE_HTML,
      'raceid=1106': MIAMI_RACE_HTML,
    });
    const out = await fetchF2SeasonResults();
    expect(out.feature.map(r => r.round)).toEqual([1]);
  });

  it('survives a per-round fetch failure without dropping the whole season', async () => {
    setupFetchMock({
      '/Standings/Driver': MANIFEST_HTML,
      'raceid=1092': MELBOURNE_RACE_HTML,
      'raceid=1106': null,
      'raceid=1107': MONTREAL_RACE_HTML,
    });
    const out = await fetchF2SeasonResults();
    // Miami fetch threw → that one round skipped; Melbourne survives.
    expect(out.feature.map(r => r.round)).toEqual([1]);
    expect(out.sprint.map(r => r.round)).toEqual([1]);
  });

  describe('cache layer', () => {
    beforeEach(() => {
      process.env.KV_REST_API_URL = 'https://kv.test.invalid';
      process.env.KV_REST_API_TOKEN = 'test-token';
    });

    it('returns cached payload on cache hit without touching upstream', async () => {
      kvStore.set('paddock:results:f2:season:2026', {
        feature: [
          {
            round: 1,
            raceName: 'Cached Feature',
            date: new Date('2026-03-08T00:00:00Z'),
            circuit: 'Cached Circuit',
            results: [
              { position: 1, driverName: 'Cached Driver', team: 'Cached Team', status: 'Finished', points: 25 },
            ],
          },
        ],
        sprint: [],
      });
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const out = await fetchF2SeasonResults(2026);
      expect(out.feature).toHaveLength(1);
      expect(out.feature[0].raceName).toBe('Cached Feature');
      // Date must be a Date instance after the JSON round-trip via reviveDates.
      expect(out.feature[0].date).toBeInstanceOf(Date);
      expect(out.feature[0].date.toISOString()).toBe('2026-03-08T00:00:00.000Z');
      // Cache hit short-circuits upstream entirely.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('on cache miss, fetches fresh and writes the season payload to KV', async () => {
      setupFetchMock({
        '/Standings/Driver': MANIFEST_HTML,
        'raceid=1092': MELBOURNE_RACE_HTML,
        'raceid=1106': MIAMI_RACE_HTML,
        'raceid=1107': MONTREAL_RACE_HTML,
      });
      const out = await fetchF2SeasonResults(2026);
      expect(out.feature.length).toBeGreaterThan(0);
      // Cache write happened — re-fetch would now be a hit.
      const stored = kvStore.get('paddock:results:f2:season:2026') as
        | { feature: unknown[]; sprint: unknown[] }
        | undefined;
      expect(stored).toBeDefined();
      expect(stored!.feature.length).toBeGreaterThan(0);
    });

    it('does not write empty payloads to cache (avoids freezing the "unavailable" UI)', async () => {
      setupFetchMock({});
      const out = await fetchF2SeasonResults(2026);
      expect(out).toEqual({ feature: [], sprint: [] });
      expect(kvStore.has('paddock:results:f2:season:2026')).toBe(false);
    });

    it('skips the cache entirely when called without a season (legacy callers)', async () => {
      setupFetchMock({
        '/Standings/Driver': MANIFEST_HTML,
        'raceid=1092': MELBOURNE_RACE_HTML,
        'raceid=1106': MIAMI_RACE_HTML,
        'raceid=1107': MONTREAL_RACE_HTML,
      });
      const out = await fetchF2SeasonResults();
      expect(out.feature.length).toBeGreaterThan(0);
      // No season → no key to write under.
      expect(kvStore.size).toBe(0);
    });
  });
});
