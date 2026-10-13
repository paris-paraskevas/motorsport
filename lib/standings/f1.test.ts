import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchF1Standings } from './f1';
import { loadTeamNames } from '@/lib/series-content';
import { F1_TEAM_COLORS } from '@/components/LazySeasonTrendChart';

const driverFixture = {
  MRData: {
    StandingsTable: {
      StandingsLists: [
        {
          DriverStandings: [
            {
              position: '1',
              points: '350',
              wins: '10',
              Driver: { givenName: 'Max', familyName: 'Verstappen', code: 'VER' },
              Constructors: [{ name: 'Red Bull' }],
            },
            {
              position: '2',
              points: '280',
              wins: '5',
              Driver: { givenName: 'Lando', familyName: 'Norris', code: 'NOR' },
              Constructors: [{ name: 'McLaren' }],
            },
          ],
        },
      ],
    },
  },
};

const constructorFixture = {
  MRData: {
    StandingsTable: {
      StandingsLists: [
        {
          ConstructorStandings: [
            {
              position: '1',
              points: '600',
              wins: '12',
              Constructor: { name: 'Red Bull' },
            },
            {
              position: '2',
              points: '450',
              wins: '8',
              Constructor: { name: 'McLaren' },
            },
          ],
        },
      ],
    },
  },
};

function mockFetchResponses(driverPayload: unknown, constructorPayload: unknown, driverOk = true, constructorOk = true) {
  return vi.fn(async (url: string) => {
    if (typeof url === 'string' && url.includes('driverStandings')) {
      return {
        ok: driverOk,
        json: async () => driverPayload,
      } as Response;
    }
    if (typeof url === 'string' && url.includes('constructorStandings')) {
      return {
        ok: constructorOk,
        json: async () => constructorPayload,
      } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
}

describe('fetchF1Standings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses both endpoints into typed standings', async () => {
    vi.stubGlobal('fetch', mockFetchResponses(driverFixture, constructorFixture));
    const result = await fetchF1Standings();
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(2);
    expect(result!.drivers[0]).toEqual({
      position: 1,
      driverName: 'Max Verstappen',
      driverCode: 'VER',
      team: 'Red Bull',
      points: 350,
      wins: 10,
    });
    expect(result!.constructors).toHaveLength(2);
    expect(result!.constructors[0]).toEqual({
      position: 1,
      name: 'Red Bull',
      points: 600,
      wins: 12,
    });
  });

  it('returns null when driver endpoint fails', async () => {
    vi.stubGlobal('fetch', mockFetchResponses(driverFixture, constructorFixture, false, true));
    const result = await fetchF1Standings();
    expect(result).toBeNull();
  });

  it('returns null when payload structure is unexpected', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchResponses({ MRData: { wrong: 'shape' } }, constructorFixture),
    );
    const result = await fetchF1Standings();
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const result = await fetchF1Standings();
    expect(result).toBeNull();
  });
});

// B6: jolpi.ca keeps older names for some teams; content/series/f1/team-names.json gives formula1.com's per season.
describe('team names as formula1.com prints them', () => {
  const driversOf = (season: string, team: string) => ({
    MRData: { StandingsTable: { StandingsLists: [{ season, DriverStandings: [
      { position: '1', points: '75', wins: '0', Driver: { givenName: 'Liam', familyName: 'Lawson', code: 'LAW' }, Constructors: [{ name: team }] },
    ] }] } },
  });
  const constructorsOf = (season: string, name: string) => ({
    MRData: { StandingsTable: { StandingsLists: [{ season, ConstructorStandings: [
      { position: '1', points: '100', wins: '0', Constructor: { name } },
    ] }] } },
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renames a 2026 team in both tables: RB F1 Team is Racing Bulls', async () => {
    vi.stubGlobal('fetch', mockFetchResponses(driversOf('2026', 'RB F1 Team'), constructorsOf('2026', 'RB F1 Team')));
    const result = await fetchF1Standings();
    expect(result!.drivers[0].team).toBe('Racing Bulls');
    expect(result!.constructors[0].name).toBe('Racing Bulls');
  });

  it('leaves a season without lines as jolpi.ca names it', async () => {
    vi.stubGlobal('fetch', mockFetchResponses(driversOf('2025', 'RB F1 Team'), constructorsOf('2025', 'RB F1 Team')));
    const result = await fetchF1Standings();
    expect(result!.drivers[0].team).toBe('RB F1 Team');
    expect(result!.constructors[0].name).toBe('RB F1 Team');
  });

  it('gives every 2026 team name the parsers hand on a colour in the season chart', async () => {
    const lines = (await loadTeamNames('f1'))?.['2026'];
    expect(typeof lines).toBe('object');
    const renamed = Object.values(lines as Record<string, string>);
    const unchanged = ['Mercedes', 'Ferrari', 'McLaren', 'Aston Martin', 'Williams', 'Haas F1 Team', 'Audi'];
    expect(renamed.length + unchanged.length).toBe(11);
    for (const name of [...renamed, ...unchanged]) expect(F1_TEAM_COLORS[name], name).toBeDefined();
  });
});
