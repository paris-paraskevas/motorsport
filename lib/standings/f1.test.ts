import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchF1Standings } from './f1';

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
