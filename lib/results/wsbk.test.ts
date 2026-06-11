import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchWsbkSeasonResults, fetchWsbkLastRace } from './wsbk';

// Fixtures mirror api.wsbk.pulselive.com responses captured in the May 2026
// source probe. Endpoint shapes:
//   GET /wsbk-events/v1/seasons/{year}/rounds
//   GET /wsbk-results/v1/seasons/{year}/categories/SBK/rounds/{src}/sessions/{001|002|003}/results
// Per-session `included` uses SINGULAR types (`rider`, `team`, `session`).

const roundsFixture = {
  data: [
    {
      type: 'rounds',
      id: '2026-AUS',
      attributes: {
        source_id: 'AUS',
        description: 'Australian Round',
        brief_description: 'Phillip Island',
        start_date: '2026-02-20T00:00:00+00:00',
        end_date: '2026-02-22T00:00:00+00:00',
        sequence_order: 1,
        status: 'FINISHED',
      },
      relationships: {
        circuit: { data: { type: 'circuits', id: 'PHIL' } },
      },
    },
    {
      type: 'rounds',
      id: '2026-POR',
      attributes: {
        source_id: 'POR',
        description: 'Portuguese Round',
        brief_description: 'Portimao',
        start_date: '2026-03-27T00:00:00+00:00',
        end_date: '2026-03-29T00:00:00+00:00',
        sequence_order: 2,
        status: 'FINISHED',
      },
      relationships: {
        circuit: { data: { type: 'circuits', id: 'PORTI' } },
      },
    },
    {
      type: 'rounds',
      id: '2026-ARA',
      attributes: {
        source_id: 'ARA',
        description: 'Aragon Round',
        brief_description: 'Aragon',
        start_date: '2026-05-29T00:00:00+00:00',
        end_date: '2026-05-31T00:00:00+00:00',
        sequence_order: 6,
        status: 'NOT-STARTED',
      },
      relationships: {
        circuit: { data: { type: 'circuits', id: 'ARAGO' } },
      },
    },
  ],
  included: [
    { type: 'circuits', id: 'PHIL', attributes: { name: 'Phillip Island Grand Prix Circuit' } },
    { type: 'circuits', id: 'PORTI', attributes: { name: 'Autodromo do Algarve' } },
  ],
};

function makeResultRow(
  position: number,
  riderId: string,
  teamId: string,
  status = 'Classified',
  timeMs?: number,
) {
  return {
    type: 'results',
    id: `r-${riderId}-${position}`,
    attributes: {
      position,
      number: 1,
      laps: 20,
      time: timeMs,
      status,
      speed: 300,
    },
    relationships: {
      rider: { data: { type: 'rider', id: riderId } },
      team: { data: { type: 'team', id: teamId } },
      session: { data: { type: 'session', id: 'sess-1' } },
    },
  };
}

function buildSessionFixture(positions: Array<{ pos: number; rider: string; team: string; status?: string; timeMs?: number }>) {
  const data = positions.map(p =>
    makeResultRow(p.pos, p.rider, p.team, p.status, p.timeMs),
  );
  const riderIds = new Set(positions.map(p => p.rider));
  const teamIds = new Set(positions.map(p => p.team));
  const included: Array<Record<string, unknown>> = [
    ...[...riderIds].map(id => ({
      type: 'rider',
      id,
      attributes: { name: `First${id}`, surname: `Last${id}` },
    })),
    ...[...teamIds].map(id => ({
      type: 'team',
      id,
      attributes: { name: `Team ${id}` },
    })),
  ];
  return { data, included };
}

// `timeMs` is each rider's CUMULATIVE race time, matching the live Pulselive
// payload (validation 2026-06-11: the old gap-shaped fixture masked a prod
// bug where P2 rendered "+54:07.653"). Gaps below are derived vs P1.
const standardPositions = [
  { pos: 1, rider: 'r1', team: 't1', timeMs: 3334579 },
  { pos: 2, rider: 'r2', team: 't1', timeMs: 3334579 + 5832 },
  { pos: 3, rider: 'r3', team: 't2', timeMs: 3334579 + 9120 },
  { pos: 4, rider: 'r4', team: 't2', timeMs: 3334579 + 12041 },
  { pos: 5, rider: 'r5', team: 't3', timeMs: 3334579 + 14820 },
  { pos: 6, rider: 'r6', team: 't3', timeMs: 3334579 + 16210 },
  { pos: 7, rider: 'r7', team: 't4', timeMs: 3334579 + 17500 },
  { pos: 8, rider: 'r8', team: 't4', timeMs: 3334579 + 18900 },
  { pos: 9, rider: 'r9', team: 't5', timeMs: 3334579 + 20300 },
  { pos: 10, rider: 'r10', team: 't5', timeMs: 3334579 + 21810 },
];

function urlMatches(url: string, pattern: string): boolean {
  return typeof url === 'string' && url.includes(pattern);
}

function buildMock(opts: {
  rounds?: unknown;
  roundsOk?: boolean;
  sessionPayload?: (round: string, session: string) => { ok: boolean; payload: unknown };
}) {
  const { rounds = roundsFixture, roundsOk = true, sessionPayload } = opts;
  return vi.fn(async (url: string) => {
    if (urlMatches(url, '/wsbk-events/v1/seasons/') && url.endsWith('/rounds')) {
      return { ok: roundsOk, json: async () => rounds } as Response;
    }
    const sessMatch = url.match(/\/rounds\/([A-Z]+)\/sessions\/(\d+)\/results$/);
    if (sessMatch && sessionPayload) {
      const [, round, session] = sessMatch;
      const { ok, payload } = sessionPayload(round, session);
      return { ok, json: async () => payload } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
}

describe('fetchWsbkSeasonResults', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('expands finished rounds to 3 RaceResults each (Race 1 / Superpole Race / Race 2)', async () => {
    const fixture = buildSessionFixture(standardPositions);
    vi.stubGlobal(
      'fetch',
      buildMock({
        sessionPayload: () => ({ ok: true, payload: fixture }),
      }),
    );
    const races = await fetchWsbkSeasonResults(2026);
    // 2 finished rounds × 3 sessions = 6 RaceResults.
    expect(races).toHaveLength(6);
    // Sorted by round desc, then R1 → SP → R2 within a round.
    expect(races[0].round).toBe(2);
    expect(races[0].raceName).toBe('Portuguese Round — Race 1');
    expect(races[1].raceName).toBe('Portuguese Round — Superpole Race');
    expect(races[2].raceName).toBe('Portuguese Round — Race 2');
    expect(races[3].round).toBe(1);
    expect(races[3].raceName).toBe('Australian Round — Race 1');
    expect(races[5].raceName).toBe('Australian Round — Race 2');
  });

  it('attaches circuit name from rounds.included when present', async () => {
    const fixture = buildSessionFixture(standardPositions);
    vi.stubGlobal(
      'fetch',
      buildMock({
        sessionPayload: () => ({ ok: true, payload: fixture }),
      }),
    );
    const races = await fetchWsbkSeasonResults(2026);
    expect(races[0].circuit).toBe('Autodromo do Algarve');
    expect(races[3].circuit).toBe('Phillip Island Grand Prix Circuit');
  });

  it('skips a session that fails to fetch but keeps the other 2 from same round', async () => {
    const fixture = buildSessionFixture(standardPositions);
    vi.stubGlobal(
      'fetch',
      buildMock({
        sessionPayload: (round, session) => {
          // Superpole race for Portimao not yet uploaded by upstream.
          if (round === 'POR' && session === '002') {
            return { ok: false, payload: {} };
          }
          return { ok: true, payload: fixture };
        },
      }),
    );
    const races = await fetchWsbkSeasonResults(2026);
    // Portimao only has R1 + R2 (2 sessions); Phillip Island has all 3 → 5 total.
    expect(races).toHaveLength(5);
    const porRaces = races.filter(r => r.raceName.startsWith('Portuguese'));
    expect(porRaces).toHaveLength(2);
    expect(porRaces.map(r => r.raceName).sort()).toEqual(
      ['Portuguese Round — Race 1', 'Portuguese Round — Race 2'].sort(),
    );
  });

  it('awards correct championship points: 25-20-16-13-11 for Race 1 / Race 2, 12-9-7-6-5 for Superpole', async () => {
    const fixture = buildSessionFixture(standardPositions);
    vi.stubGlobal(
      'fetch',
      buildMock({
        sessionPayload: () => ({ ok: true, payload: fixture }),
      }),
    );
    const races = await fetchWsbkSeasonResults(2026);
    const race1 = races.find(r => r.raceName === 'Portuguese Round — Race 1')!;
    expect(race1.results[0].points).toBe(25);
    expect(race1.results[1].points).toBe(20);
    expect(race1.results[2].points).toBe(16);
    expect(race1.results[3].points).toBe(13);
    expect(race1.results[4].points).toBe(11);
    const sprint = races.find(r => r.raceName === 'Portuguese Round — Superpole Race')!;
    expect(sprint.results[0].points).toBe(12);
    expect(sprint.results[1].points).toBe(9);
    expect(sprint.results[2].points).toBe(7);
    expect(sprint.results[3].points).toBe(6);
    expect(sprint.results[4].points).toBe(5);
  });

  it('awards 0 points to DNS / DSQ / EXC entries regardless of position', async () => {
    const positions = [
      ...standardPositions.slice(0, 9),
      { pos: 10, rider: 'r10', team: 't5', status: 'DNS' },
      { pos: 11, rider: 'r11', team: 't5', status: 'EXC' },
    ];
    const fixture = buildSessionFixture(positions);
    vi.stubGlobal(
      'fetch',
      buildMock({ sessionPayload: () => ({ ok: true, payload: fixture }) }),
    );
    const races = await fetchWsbkSeasonResults(2026);
    const r2 = races.find(r => r.raceName === 'Portuguese Round — Race 2')!;
    expect(r2.results.find(x => x.position === 10)!.points).toBe(0);
    expect(r2.results.find(x => x.position === 11)!.points).toBe(0);
  });

  it('formats winner time as h:mm:ss.xxx and other rows as +gap', async () => {
    const fixture = buildSessionFixture(standardPositions);
    vi.stubGlobal(
      'fetch',
      buildMock({ sessionPayload: () => ({ ok: true, payload: fixture }) }),
    );
    const races = await fetchWsbkSeasonResults(2026);
    const r1 = races.find(r => r.raceName === 'Portuguese Round — Race 1')!;
    // 3334579 ms = 55 min 34.579 s → "55:34.579"
    expect(r1.results[0].time).toBe('55:34.579');
    // Gap rows render with "+" prefix and seconds.
    expect(r1.results[1].time).toBe('+5.832s');
    expect(r1.results[2].time).toBe('+9.120s');
  });

  it('returns empty array when rounds endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      buildMock({ roundsOk: false }),
    );
    const races = await fetchWsbkSeasonResults(2026);
    expect(races).toEqual([]);
  });

  it('returns empty array when no rounds are FINISHED', async () => {
    const noFinished = {
      ...roundsFixture,
      data: roundsFixture.data.map(r => ({
        ...r,
        attributes: { ...r.attributes, status: 'NOT-STARTED' },
      })),
    };
    vi.stubGlobal(
      'fetch',
      buildMock({
        rounds: noFinished,
        sessionPayload: () => ({ ok: true, payload: buildSessionFixture(standardPositions) }),
      }),
    );
    const races = await fetchWsbkSeasonResults(2026);
    expect(races).toEqual([]);
  });

  it('returns empty array when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const races = await fetchWsbkSeasonResults(2026);
    expect(races).toEqual([]);
  });

  it('drops sessions with fewer than 8 result rows (sanity floor)', async () => {
    const thin = buildSessionFixture(standardPositions.slice(0, 5));
    vi.stubGlobal(
      'fetch',
      buildMock({ sessionPayload: () => ({ ok: true, payload: thin }) }),
    );
    const races = await fetchWsbkSeasonResults(2026);
    expect(races).toEqual([]);
  });
});

describe('fetchWsbkLastRace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the most-recent round’s Race 2', async () => {
    const fixture = buildSessionFixture(standardPositions);
    vi.stubGlobal(
      'fetch',
      buildMock({ sessionPayload: () => ({ ok: true, payload: fixture }) }),
    );
    const last = await fetchWsbkLastRace(2026);
    expect(last).not.toBeNull();
    expect(last!.round).toBe(2);
    expect(last!.raceName).toBe('Portuguese Round — Race 2');
  });

  it('falls back to whatever last session of the latest round exists when Race 2 is missing', async () => {
    const fixture = buildSessionFixture(standardPositions);
    vi.stubGlobal(
      'fetch',
      buildMock({
        sessionPayload: (round, session) => {
          // Portimao Race 2 not yet uploaded.
          if (round === 'POR' && session === '003') {
            return { ok: false, payload: {} };
          }
          return { ok: true, payload: fixture };
        },
      }),
    );
    const last = await fetchWsbkLastRace(2026);
    expect(last).not.toBeNull();
    expect(last!.round).toBe(2);
    // No Race 2 → falls back to Superpole Race (latest in R1→SP→R2 order).
    expect(last!.raceName).toBe('Portuguese Round — Superpole Race');
  });

  it('returns null when no rounds have finished', async () => {
    const noFinished = {
      ...roundsFixture,
      data: roundsFixture.data.map(r => ({
        ...r,
        attributes: { ...r.attributes, status: 'NOT-STARTED' },
      })),
    };
    vi.stubGlobal(
      'fetch',
      buildMock({ rounds: noFinished }),
    );
    const last = await fetchWsbkLastRace(2026);
    expect(last).toBeNull();
  });
});
