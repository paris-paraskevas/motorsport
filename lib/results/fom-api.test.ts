import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mapRaceResult,
  mapClassification,
  buildPointsLookup,
  completedRounds,
  fetchFomSeason,
  fetchFomStandings,
  type FomSessionResponse,
  type FomMeeting,
  type FomStandingRow,
} from './fom-api';

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
      kvStore.set('paddock:results:fom:f2:season:2026', {
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
      const stored = kvStore.get('paddock:results:fom:f2:season:2026') as { feature: unknown[] } | undefined;
      expect(stored?.feature.length).toBe(1);
    });

    it('does not cache an empty bundle', async () => {
      mockApi({});
      await fetchFomSeason('f2', 2026);
      expect(kvStore.has('paddock:results:fom:f2:season:2026')).toBe(false);
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
