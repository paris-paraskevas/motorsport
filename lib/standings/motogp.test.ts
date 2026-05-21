import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchMotoGPStandings } from './motogp';

// Mock the Pulselive endpoint chain. The standings parser issues two fetches:
//   1) /motogp/v1/results/seasons → resolve seasonUuid for the requested year
//   2) /motogp/v1/results/standings?seasonUuid=...&categoryUuid=... → rows
function mockFetch(routes: {
  seasons?: unknown[] | null;
  standings?: unknown | null;
  seasonsOk?: boolean;
  standingsOk?: boolean;
  seasonsThrows?: boolean;
}) {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('/results/seasons')) {
      if (routes.seasonsThrows) throw new Error('network down');
      const ok = routes.seasonsOk !== false;
      return {
        ok,
        status: ok ? 200 : 500,
        json: async () => routes.seasons,
      } as Response;
    }
    if (u.includes('/results/standings')) {
      const ok = routes.standingsOk !== false;
      return {
        ok,
        status: ok ? 200 : 500,
        json: async () => routes.standings,
      } as Response;
    }
    return { ok: false, status: 404, json: async () => null } as Response;
  }) as unknown as typeof fetch;
}

function row(opts: {
  position: number;
  fullName: string;
  number: number;
  team: string;
  points: number;
  wins?: number;
}) {
  return {
    position: opts.position,
    rider: { full_name: opts.fullName, number: opts.number },
    team: { name: opts.team },
    points: opts.points,
    race_wins: opts.wins ?? 0,
  };
}

const SEASONS_2026 = [
  { id: 'e88b4e43-2209-47aa-8e83-0e0b1cedde6e', year: 2026, current: true },
  { id: 'ae6c6f0d-c652-44f8-94aa-420fc5b3dab4', year: 2025, current: false },
];

const FULL_STANDINGS = {
  classification: [
    row({ position: 1, fullName: 'Marco Bezzecchi', number: 72, team: 'Aprilia Racing', points: 142, wins: 3 }),
    row({ position: 2, fullName: 'Jorge Martin', number: 89, team: 'Aprilia Racing', points: 127, wins: 1 }),
    row({ position: 3, fullName: 'Fabio Di Giannantonio', number: 49, team: 'Team VR46', points: 116, wins: 0 }),
    row({ position: 4, fullName: 'Pedro Acosta', number: 37, team: 'Red Bull KTM Factory Racing', points: 110 }),
    row({ position: 5, fullName: 'Marc Marquez', number: 93, team: 'Ducati Lenovo Team', points: 105 }),
    row({ position: 6, fullName: 'Francesco Bagnaia', number: 1, team: 'Ducati Lenovo Team', points: 100 }),
    row({ position: 7, fullName: 'Enea Bastianini', number: 23, team: 'Tech3 KTM', points: 80 }),
    row({ position: 8, fullName: 'Alex Marquez', number: 73, team: 'Gresini Racing', points: 75 }),
    row({ position: 9, fullName: 'Brad Binder', number: 33, team: 'Red Bull KTM Factory Racing', points: 70 }),
    row({ position: 10, fullName: 'Maverick Vinales', number: 12, team: 'Tech3 KTM', points: 60 }),
    row({ position: 11, fullName: 'Johann Zarco', number: 5, team: 'LCR Honda', points: 50 }),
    row({ position: 12, fullName: 'Joan Mir', number: 36, team: 'Honda HRC', points: 40 }),
    row({ position: 13, fullName: 'Luca Marini', number: 10, team: 'Honda HRC', points: 35 }),
    row({ position: 14, fullName: 'Raul Fernandez', number: 25, team: 'Trackhouse Racing', points: 30 }),
    row({ position: 15, fullName: 'Ai Ogura', number: 79, team: 'Trackhouse Racing', points: 25 }),
    row({ position: 16, fullName: 'Miguel Oliveira', number: 88, team: 'Pramac Yamaha', points: 20 }),
  ],
};

describe('fetchMotoGPStandings', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('resolves seasonUuid + parses 16-rider classification', async () => {
    mockFetch({ seasons: SEASONS_2026, standings: FULL_STANDINGS });
    const result = await fetchMotoGPStandings(2026);
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(16);
    expect(result!.drivers[0]).toEqual({
      position: 1,
      driverName: 'Marco Bezzecchi',
      team: 'Aprilia Racing',
      points: 142,
      wins: 3,
    });
    expect(result!.drivers[5].driverName).toBe('Francesco Bagnaia');
  });

  it('sorts drivers by position ascending', async () => {
    const reversed = {
      classification: FULL_STANDINGS.classification.slice().reverse(),
    };
    mockFetch({ seasons: SEASONS_2026, standings: reversed });
    const result = await fetchMotoGPStandings(2026);
    expect(result).not.toBeNull();
    expect(result!.drivers.map(d => d.position).slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns null when fewer than 15 rows clear the sanity floor', async () => {
    const partial = {
      classification: FULL_STANDINGS.classification.slice(0, 5),
    };
    mockFetch({ seasons: SEASONS_2026, standings: partial });
    const result = await fetchMotoGPStandings(2026);
    expect(result).toBeNull();
  });

  it('returns null when the requested year is absent from /seasons', async () => {
    const onlyPast = [
      { id: 'ae6c6f0d-c652-44f8-94aa-420fc5b3dab4', year: 2025, current: false },
    ];
    mockFetch({ seasons: onlyPast });
    const result = await fetchMotoGPStandings(2026);
    expect(result).toBeNull();
  });

  it('returns null when seasons fetch is not ok', async () => {
    mockFetch({ seasons: null, seasonsOk: false });
    const result = await fetchMotoGPStandings(2026);
    expect(result).toBeNull();
  });

  it('returns null when standings fetch is not ok', async () => {
    mockFetch({ seasons: SEASONS_2026, standings: null, standingsOk: false });
    const result = await fetchMotoGPStandings(2026);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    mockFetch({ seasonsThrows: true });
    const result = await fetchMotoGPStandings(2026);
    expect(result).toBeNull();
  });

  it('skips rows missing required fields without dropping the whole result', async () => {
    const partialRows = {
      classification: [
        ...FULL_STANDINGS.classification.slice(0, 14),
        // 15th row: missing team.name — should be skipped, no team string.
        {
          position: 15,
          rider: { full_name: 'Ai Ogura', number: 79 },
          team: { name: '' },
          points: 25,
        },
        // 16th row: salvageable
        row({ position: 16, fullName: 'Miguel Oliveira', number: 88, team: 'Pramac Yamaha', points: 20 }),
      ],
    };
    mockFetch({ seasons: SEASONS_2026, standings: partialRows });
    const result = await fetchMotoGPStandings(2026);
    // 14 valid + 1 valid (Oliveira) = 15 rows, which is exactly the floor.
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(15);
    expect(result!.drivers.every(d => d.team !== '')).toBe(true);
  });
});
