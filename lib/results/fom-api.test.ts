import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import {
  mapRaceResult,
  mapClassification,
  buildPointsLookup,
  completedRounds,
  fetchFomSeason,
  fetchFomStandings,
  roundOfMeeting,
  type FomSessionResponse,
  type FomMeeting,
  type FomStandingRow,
} from './fom-api';

// B3: the curated calendar the reader numbers rounds by (lib/rounds-loader.ts), nothing (the meeting's position) unless
// a test hands one over.
vi.mock('../rounds-loader', () => ({ loadRounds: vi.fn(async () => undefined) }));
import { loadRounds } from '../rounds-loader';

// In-memory KV stand-in — cache path is a no-op unless env vars are set.
const kvStore = new Map<string, unknown>();
vi.mock('../kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => {
      const raw = kvStore.get(key);
      return raw === undefined ? null : JSON.parse(JSON.stringify(raw));
    }),
    set: vi.fn(async (key: string, value: unknown) => {
      kvStore.set(key, value);
      return 'OK';
    }),
  },
}));

const MELBOURNE: FomMeeting = {
  meetingKey: 1279,
  meetingCountryName: 'Australia',
  meetingLocation: 'Melbourne',
  meetingStartDate: '2026-03-06',
  meetingEndDate: '2026-03-08',
  url: '/en/racing/2026/melbourne',
  raceSessions: [
    { description: 'SPRINT RACE', sessionNumber: 1 },
    { description: 'FEATURE RACE', sessionNumber: 2 },
  ],
};

function sessionResponse(results: unknown[], meeting?: FomSessionResponse['meeting']): FomSessionResponse {
  return { sessionResults: { results: results as never }, meeting };
}

// Canonical per-round [SR, FR] points. Tsolov's feature value is 27 (win + pole
// + FL) — deliberately NOT the 25 a position table would emit, to prove points
// come from the standings breakdown, not the race row.
const STANDINGS: FomStandingRow[] = [
  { driverReference: 'NIKTSO01', driverFirstName: 'Nikola', driverLastName: 'Tsolov', championshipPoints: 37, points: [[10, 27], [null, null]] },
  { driverReference: 'GABMIN01', driverFirstName: 'Gabriele', driverLastName: 'Mini', championshipPoints: 18, points: [[0, 18], [null, null]] },
  { driverReference: 'DINBEG01', driverFirstName: 'Dino', driverLastName: 'Beganovic', championshipPoints: 0, points: [[0, 0], [null, null]] },
];

const FEATURE_ROWS = [
  { positionNumber: '1', completionStatusCode: 'OK', driverReference: 'NIKTSO01', driverFirstName: 'Nikola', driverLastName: 'Tsolov', driverTLA: 'TSO', teamName: 'Campos Racing', displayTime: '56:05.248' },
  { positionNumber: '2', completionStatusCode: 'OK', driverReference: 'GABMIN01', driverFirstName: 'Gabriele', driverLastName: 'Mini', driverTLA: 'MIN', teamName: 'MP Motorsport', displayTime: '+1.669s' },
  { positionNumber: '666', completionStatusCode: 'DNF', displayPosition: 'NC', driverReference: 'DINBEG01', driverFirstName: 'Dino', driverLastName: 'Beganovic', driverTLA: 'BEG', teamName: 'DAMS Lucas Oil', displayTime: 'DNF' },
];
const SPRINT_ROWS = [
  { positionNumber: '1', completionStatusCode: 'OK', driverReference: 'NIKTSO01', driverFirstName: 'Nikola', driverLastName: 'Tsolov', driverTLA: 'TSO', teamName: 'Campos Racing', displayTime: '39:09.726' },
];

describe('buildPointsLookup / completedRounds', () => {
  it('indexes points by driverReference and flags rounds with any non-null cell', () => {
    const lookup = buildPointsLookup(STANDINGS);
    expect(lookup.get('NIKTSO01')?.[0]).toEqual([10, 27]);
    // Only round 1 has scored; round 2 is all null.
    expect([...completedRounds(STANDINGS)]).toEqual([1]);
  });
});

describe('mapRaceResult', () => {
  const points = buildPointsLookup(STANDINGS);
  const data = sessionResponse(FEATURE_ROWS, { circuitOfficialName: 'Albert Park Grand Prix Circuit', meetingCountryName: 'Australia', meetingEndDate: '2026-03-08' });

  it('builds round metadata from the session meeting', () => {
    const rr = mapRaceResult(data, 1, 'feature', MELBOURNE, points)!;
    expect(rr.round).toBe(1);
    expect(rr.raceName).toBe('Australia Feature Race');
    expect(rr.circuit).toBe('Albert Park Grand Prix Circuit');
    expect(rr.date.toISOString().startsWith('2026-03-08')).toBe(true);
  });

  it('reads canonical FEATURE points from standings (not the race row)', () => {
    const rr = mapRaceResult(data, 1, 'feature', MELBOURNE, points)!;
    expect(rr.results[0]).toEqual({
      position: 1,
      driverName: 'Nikola Tsolov',
      driverCode: 'TSO',
      team: 'Campos Racing',
      status: 'Finished',
      time: '56:05.248',
      points: 27, // win + pole + FL, from standings.points[0][1]
    });
    expect(rr.results[1].points).toBe(18);
  });

  it('reads SPRINT points from the SR slot (index 0)', () => {
    const rr = mapRaceResult(sessionResponse(SPRINT_ROWS), 1, 'sprint', MELBOURNE, points)!;
    expect(rr.results[0].points).toBe(10);
  });

  it('appends DNF rows after finishers with status DNF and zero points', () => {
    const rr = mapRaceResult(data, 1, 'feature', MELBOURNE, points)!;
    const dnf = rr.results[rr.results.length - 1];
    expect(dnf).toMatchObject({ driverName: 'Dino Beganovic', status: 'DNF', points: 0 });
    expect(dnf.position).toBe(3); // after the two classified finishers
  });

  it('returns null for empty / missing results', () => {
    expect(mapRaceResult(null, 1, 'feature', MELBOURNE, points)).toBeNull();
    expect(mapRaceResult(sessionResponse([]), 1, 'feature', MELBOURNE, points)).toBeNull();
  });
});

describe('fetchFomSeason', () => {
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

  function mockApi(map: Record<string, unknown | null>) {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      for (const [pattern, body] of Object.entries(map)) {
        if (u.includes(pattern)) {
          if (body === null) throw new Error('network down');
          return { ok: true, status: 200, json: async () => body } as Response;
        }
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;
  }

  const MANIFEST = {
    season: '2026',
    meetings: [
      MELBOURNE,
      { ...MELBOURNE, meetingKey: 1284, meetingLocation: 'Miami', url: '/en/racing/2026/miami-gardens' },
    ],
    standings: STANDINGS, // only round 1 scored → only round 1 fetched
  };

  it('fetches only completed rounds and returns a sorted bundle', async () => {
    mockApi({
      'driver-standings-breakdown': MANIFEST,
      'race?meeting=1279&session=2': sessionResponse(FEATURE_ROWS, { meetingCountryName: 'Australia', meetingEndDate: '2026-03-08', circuitOfficialName: 'Albert Park' }),
      'race?meeting=1279&session=1': sessionResponse(SPRINT_ROWS, { meetingCountryName: 'Australia', meetingEndDate: '2026-03-08' }),
      'qualifying?meeting=1279': sessionResponse([{ positionNumber: '1', driverFirstName: 'Nikola', driverLastName: 'Tsolov', driverTLA: 'TSO', teamName: 'Campos Racing', displayTime: '1:28.6', gapToLeader: '0' }]),
      'practice?meeting=1279': sessionResponse([{ positionNumber: '1', driverFirstName: 'Nikola', driverLastName: 'Tsolov', driverTLA: 'TSO', teamName: 'Campos Racing', displayTime: '1:29.0', gapToLeader: '0' }]),
      // Miami (round 2) must NOT be fetched — its points column is all null.
      'meeting=1284': null,
    });
    const bundle = await fetchFomSeason('f2', 2026);
    expect(bundle.feature.map(r => r.round)).toEqual([1]);
    expect(bundle.sprint.map(r => r.round)).toEqual([1]);
    expect(bundle.qualifying.map(q => q.round)).toEqual([1]);
    expect(bundle.practice.map(p => p.round)).toEqual([1]);
    expect(bundle.feature[0].results[0].points).toBe(27);
  });

  it('returns an empty bundle when the manifest is unavailable', async () => {
    mockApi({});
    const bundle = await fetchFomSeason('f2', 2026);
    expect(bundle).toEqual({ feature: [], sprint: [], qualifying: [], practice: [] });
  });

  describe('cache', () => {
    beforeEach(() => {
      process.env.KV_REST_API_URL = 'https://kv.test.invalid';
      process.env.KV_REST_API_TOKEN = 'test-token';
    });

    it('short-circuits on a cache hit without touching the API', async () => {
      kvStore.set('paddock:results:fom:v2:f2:season:2026', {
        feature: [{ round: 1, raceName: 'Cached', date: new Date('2026-03-08T00:00:00Z'), circuit: 'C', results: [] }],
        sprint: [], qualifying: [], practice: [],
      });
      const fetchMock = vi.fn();
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      const bundle = await fetchFomSeason('f2', 2026);
      expect(bundle.feature[0].raceName).toBe('Cached');
      expect(bundle.feature[0].date).toBeInstanceOf(Date);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('writes a non-empty bundle to KV on a cache miss', async () => {
      mockApi({
        'driver-standings-breakdown': MANIFEST,
        'race?meeting=1279&session=2': sessionResponse(FEATURE_ROWS, { meetingCountryName: 'Australia', meetingEndDate: '2026-03-08' }),
        'race?meeting=1279&session=1': sessionResponse(SPRINT_ROWS, { meetingCountryName: 'Australia', meetingEndDate: '2026-03-08' }),
        'qualifying?meeting=1279': null,
        'practice?meeting=1279': null,
      });
      await fetchFomSeason('f2', 2026);
      const stored = kvStore.get('paddock:results:fom:v2:f2:season:2026') as { feature: unknown[] } | undefined;
      expect(stored?.feature.length).toBe(1);
    });

    it('does not cache an empty bundle', async () => {
      mockApi({});
      await fetchFomSeason('f2', 2026);
      expect(kvStore.has('paddock:results:fom:v2:f2:season:2026')).toBe(false);
    });
  });
});

describe('mapClassification', () => {
  it('ranks timed rows, formats gap, and marks a non-timed row', () => {
    const c = mapClassification(sessionResponse([
      { positionNumber: '1', driverFirstName: 'A', driverLastName: 'One', driverTLA: 'AON', teamName: 'T', displayTime: '1:28.6', gapToLeader: '0' },
      { positionNumber: '2', driverFirstName: 'B', driverLastName: 'Two', driverTLA: 'BTW', teamName: 'T', displayTime: '1:28.8', gapToLeader: '0.216' },
      { positionNumber: '666', displayPosition: 'DNS', driverFirstName: 'C', driverLastName: 'Three', driverTLA: 'CTH', teamName: 'T' },
    ]))!;
    expect(c.isQualifying).toBe(false);
    expect(c.entries[0].gap).toBeUndefined();
    expect(c.entries[1].gap).toBe('+0.216');
    const last = c.entries[c.entries.length - 1];
    expect(last).toMatchObject({ position: null, status: 'DNS' });
  });
});

describe('fetchFomStandings', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); });

  function mockApi(map: Record<string, unknown | null>) {
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      for (const [pattern, body] of Object.entries(map)) {
        if (u.includes(pattern)) {
          if (body === null) throw new Error('down');
          return { ok: true, status: 200, json: async () => body } as Response;
        }
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;
  }

  it('maps drivers (team joined from the latest race) + constructors, with feature wins', async () => {
    mockApi({
      'driver-standings-breakdown': {
        season: '2026',
        meetings: [MELBOURNE],
        standings: [
          { position: '1st', championshipPoints: 37, driverReference: 'NIKTSO01', driverFirstName: 'Nikola', driverLastName: 'Tsolov', driverTLA: 'TSO', points: [[10, 27], [null, null]] },
          { position: '2nd', championshipPoints: 18, driverReference: 'GABMIN01', driverFirstName: 'Gabriele', driverLastName: 'Mini', driverTLA: 'MIN', points: [[0, 18], [null, null]] },
        ],
      },
      'constructor-standings-breakdown': {
        standings: [
          { position: '1st', teamName: 'Campos Racing', championshipPoints: 55 },
          { position: '2nd', teamName: 'MP Motorsport', championshipPoints: 40 },
        ],
      },
      // team map source (latest completed feature race)
      'race?meeting=1279&session=2': sessionResponse(FEATURE_ROWS),
    });
    const s = (await fetchFomStandings('f2', 2026))!;
    expect(s.drivers).toHaveLength(2);
    // Team joined from FEATURE_ROWS; wins from FR >= 25 (Tsolov 27 → 1, Mini 18 → 0).
    expect(s.drivers[0]).toEqual({ position: 1, driverName: 'Nikola Tsolov', driverCode: 'TSO', team: 'Campos Racing', points: 37, wins: 1 });
    expect(s.drivers[1]).toMatchObject({ position: 2, team: 'MP Motorsport', wins: 0 });
    expect(s.constructors).toEqual([
      { position: 1, name: 'Campos Racing', points: 55 },
      { position: 2, name: 'MP Motorsport', points: 40 },
    ]);
  });

  it('returns null when both breakdown tables are empty', async () => {
    mockApi({});
    expect(await fetchFomStandings('f2', 2026)).toBeNull();
  });
});

// B3 (2026-10-05): Formula 2 at Baku and Formula 3 at Madrid ran three races (a feature carried over); the manifest
// lists three race sessions and three points cells per round. Formula 3 also skipped its round 2, so the feed's
// meeting order and the curated calendar's round numbers part company from Monaco on.
describe('B3: a round with three races, and the curated round numbers', () => {
  const BAKU: FomMeeting = {
    meetingKey: 1295,
    meetingCountryName: 'Azerbaijan',
    meetingLocation: 'Baku',
    meetingStartDate: '2026-09-24',
    meetingEndDate: '2026-09-26',
    raceSessions: [
      { description: 'Sprint Race', sessionNumber: 1 },
      { description: 'Feature Race 1', sessionNumber: 2 },
      { description: 'Feature Race 2', sessionNumber: 3 },
    ],
  };
  const THREE_CELLS: FomStandingRow[] = [
    { driverReference: 'RAFCAM01', driverFirstName: 'Rafael', driverLastName: 'Câmara', championshipPoints: 37, points: [[0, 12, 25]] },
    { driverReference: 'ALEDUN01', driverFirstName: 'Alexander', driverLastName: 'Dunne', championshipPoints: 50, points: [[7, 28, 15]] },
  ];
  const row = (ref: string, first: string, last: string, pos: string) => ({ positionNumber: pos, completionStatusCode: 'OK', driverReference: ref, driverFirstName: first, driverLastName: last, teamName: 'Team' });
  const meta = { meetingCountryName: 'Azerbaijan', meetingEndDate: '2026-09-26' };

  it('keeps every points cell of a round and reads each race at its own index', () => {
    const lookup = buildPointsLookup(THREE_CELLS);
    expect(lookup.get('RAFCAM01')).toEqual([[0, 12, 25]]);
    const second = mapRaceResult(sessionResponse([row('RAFCAM01', 'Rafael', 'Câmara', '1'), row('ALEDUN01', 'Alexander', 'Dunne', '3')], meta), 12, 'feature', BAKU, lookup, { index: 2, name: 'Feature Race 2' }, 1);
    expect(second?.raceName).toBe('Azerbaijan Feature Race 2');
    expect(second?.results.map(r => r.points)).toEqual([25, 15]);
    const first = mapRaceResult(sessionResponse([row('ALEDUN01', 'Alexander', 'Dunne', '1'), row('RAFCAM01', 'Rafael', 'Câmara', '4')], meta), 12, 'feature', BAKU, lookup, { index: 1, name: 'Feature Race 1' }, 1);
    expect(first?.raceName).toBe('Azerbaijan Feature Race 1');
    expect(first?.results.map(r => r.points)).toEqual([28, 12]);
  });

  it('fetches all three race sessions of a meeting and files both features under the round', async () => {
    const originalFetch = globalThis.fetch;
    const manifest = { season: '2026', meetings: [BAKU], standings: THREE_CELLS };
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      const body = u.includes('driver-standings-breakdown') ? manifest
        : u.includes('session=1') ? sessionResponse([row('ALEDUN01', 'Alexander', 'Dunne', '1')], meta)
        : u.includes('session=2') ? sessionResponse([row('ALEDUN01', 'Alexander', 'Dunne', '1'), row('RAFCAM01', 'Rafael', 'Câmara', '4')], meta)
        : u.includes('session=3') ? sessionResponse([row('RAFCAM01', 'Rafael', 'Câmara', '1'), row('ALEDUN01', 'Alexander', 'Dunne', '3')], meta)
        : { sessionResults: { results: [] } };
      return { ok: true, status: 200, json: async () => body } as Response;
    }) as unknown as typeof fetch;
    try {
      vi.mocked(loadRounds).mockResolvedValueOnce({ season: 2026, rounds: [{ round: 12, name: 'Azerbaijan Grand Prix', startDate: '2026-09-24', endDate: '2026-09-26' }] });
      const bundle = await fetchFomSeason('f2', 2026);
      expect(vi.mocked(loadRounds).mock.calls.at(-1)?.[0]).toBe(path.join(process.cwd(), 'content', 'series', 'f2'));
      expect(bundle.sprint.map(r => [r.round, r.raceName])).toEqual([[12, 'Azerbaijan Sprint Race']]);
      expect(bundle.feature.map(r => [r.round, r.raceName])).toEqual([[12, 'Azerbaijan Feature Race 1'], [12, 'Azerbaijan Feature Race 2']]);
      const camara = bundle.feature.flatMap(r => r.results).filter(e => e.driverName === 'Rafael Câmara').map(e => e.points);
      expect(camara).toEqual([12, 25]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('numbers a meeting by the curated round whose dates hold it, else by its position (Formula 3 skipped round 2)', () => {
    const rounds = [
      { round: 1, name: 'Australian Grand Prix', startDate: '2026-03-06', endDate: '2026-03-08' },
      { round: 3, name: 'Monaco Grand Prix', startDate: '2026-06-05', endDate: '2026-06-07' },
    ];
    expect(roundOfMeeting({ meetingStartDate: '2026-06-04', meetingEndDate: '2026-06-07' }, 2, rounds)).toBe(3);
    expect(roundOfMeeting({ meetingStartDate: '2026-05-01', meetingEndDate: '2026-05-03' }, 2, rounds)).toBe(2);
    expect(roundOfMeeting({ meetingStartDate: '2026-06-05' }, 2, rounds)).toBe(3);
    expect(roundOfMeeting({ meetingStartDate: '2026-03-06' }, 1, rounds)).toBe(1);
    expect(roundOfMeeting({ meetingStartDate: '2026-09-11' }, 9)).toBe(9);
  });

  it('numbers a season by the calendar the rounds loader reads: Formula 3’s Monaco meeting, second in the feed, is round 3 on its feature, its sprint and its qualifying, with the points of the second cell', async () => {
    const MONACO: FomMeeting = { meetingKey: 1290, meetingCountryName: 'Monaco', meetingLocation: 'Monaco', meetingStartDate: '2026-06-04', meetingEndDate: '2026-06-07', raceSessions: [{ description: 'Sprint Race', sessionNumber: 1 }, { description: 'Feature Race', sessionNumber: 2 }] };
    const standings: FomStandingRow[] = [{ driverReference: 'RAFCAM01', driverFirstName: 'Rafael', driverLastName: 'Câmara', championshipPoints: 50, points: [[10, 25], [0, 15]] }];
    vi.mocked(loadRounds).mockResolvedValueOnce({ season: 2026, rounds: [
      { round: 1, name: 'Australian Grand Prix', startDate: '2026-03-06', endDate: '2026-03-08' },
      { round: 3, name: 'Monaco Grand Prix', startDate: '2026-06-05', endDate: '2026-06-07' },
    ] });
    const monaco = { meetingCountryName: 'Monaco', meetingEndDate: '2026-06-07' };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      const body = u.includes('driver-standings-breakdown') ? { season: '2026', meetings: [MELBOURNE, MONACO], standings }
        : u.includes('meeting=1290') && !u.includes('practice') ? sessionResponse([row('RAFCAM01', 'Rafael', 'Câmara', '1')], monaco)
        : u.includes('qualifying') || u.includes('practice') ? { sessionResults: { results: [] } }
        : sessionResponse([row('RAFCAM01', 'Rafael', 'Câmara', '1')], { meetingCountryName: 'Australia', meetingEndDate: '2026-03-08' });
      return { ok: true, status: 200, json: async () => body } as Response;
    }) as unknown as typeof fetch;
    try {
      const bundle = await fetchFomSeason('f3', 2026);
      expect(vi.mocked(loadRounds).mock.calls.at(-1)?.[0]).toBe(path.join(process.cwd(), 'content', 'series', 'f3'));
      expect(bundle.feature.map(r => [r.round, r.raceName])).toEqual([[1, 'Australia Feature Race'], [3, 'Monaco Feature Race']]);
      expect(bundle.sprint.map(r => r.round)).toEqual([1, 3]);
      expect(bundle.qualifying.map(q => q.round)).toEqual([3]);
      expect(bundle.feature[1].results[0].points).toBe(15);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('counts a feature win in any cell of 25 or more, the third cell included, and none below it', async () => {
    const originalFetch = globalThis.fetch;
    const standings: FomStandingRow[] = [
      { position: '1st', championshipPoints: 63, driverReference: 'RAFCAM01', driverFirstName: 'Rafael', driverLastName: 'Câmara', driverTLA: 'CAM', points: [[11, 27, 25]] },
      { position: '2nd', championshipPoints: 11, driverReference: 'ALEDUN01', driverFirstName: 'Alexander', driverLastName: 'Dunne', driverTLA: 'DUN', points: [[11, 0, 0]] },
    ];
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      const u = String(url);
      const body = u.includes('driver-standings-breakdown') ? { season: '2026', meetings: [BAKU], standings }
        : u.includes('constructor-standings-breakdown') ? { standings: [] }
        : sessionResponse([row('RAFCAM01', 'Rafael', 'Câmara', '1'), row('ALEDUN01', 'Alexander', 'Dunne', '2')], meta);
      return { ok: true, status: 200, json: async () => body } as Response;
    }) as unknown as typeof fetch;
    try {
      const s = (await fetchFomStandings('f2', 2026))!;
      expect(s.drivers.map(d => [d.driverName, d.wins])).toEqual([['Rafael Câmara', 2], ['Alexander Dunne', 0]]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
