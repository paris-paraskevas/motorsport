import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchF1LastRace, fetchF1SeasonRaces } from './f1';

const lastRaceFixture = {
  MRData: {
    RaceTable: {
      Races: [
        {
          round: '23',
          raceName: 'Abu Dhabi Grand Prix',
          date: '2026-12-06',
          Circuit: { circuitName: 'Yas Marina Circuit' },
          Results: [
            {
              position: '1',
              points: '25',
              Driver: { givenName: 'Max', familyName: 'Verstappen', code: 'VER' },
              Constructor: { name: 'Red Bull' },
              status: 'Finished',
              Time: { time: '1:26:33.291' },
            },
            {
              position: '2',
              points: '18',
              Driver: { givenName: 'Lando', familyName: 'Norris', code: 'NOR' },
              Constructor: { name: 'McLaren' },
              status: 'Finished',
              Time: { time: '+5.832' },
            },
            {
              position: '3',
              points: '15',
              Driver: { givenName: 'Charles', familyName: 'Leclerc', code: 'LEC' },
              Constructor: { name: 'Ferrari' },
              status: '+1 Lap',
            },
          ],
        },
      ],
    },
  },
};

const seasonFixture = {
  MRData: {
    RaceTable: {
      Races: [
        {
          round: '1',
          raceName: 'Bahrain Grand Prix',
          date: '2026-03-08',
          Circuit: { circuitName: 'Bahrain International Circuit' },
          Results: [
            {
              position: '1',
              points: '25',
              Driver: { givenName: 'Max', familyName: 'Verstappen', code: 'VER' },
              Constructor: { name: 'Red Bull' },
              status: 'Finished',
            },
          ],
        },
        {
          round: '2',
          raceName: 'Saudi Arabian Grand Prix',
          date: '2026-03-15',
          Circuit: { circuitName: 'Jeddah Corniche Circuit' },
          Results: [
            {
              position: '1',
              points: '25',
              Driver: { givenName: 'Lando', familyName: 'Norris', code: 'NOR' },
              Constructor: { name: 'McLaren' },
              status: 'Finished',
            },
          ],
        },
      ],
    },
  },
};

function mockLastRaceFetch(payload: unknown, ok = true) {
  return vi.fn(async () => ({
    ok,
    json: async () => payload,
  }) as Response);
}

describe('fetchF1LastRace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses last race payload into a typed RaceResult with finishers', async () => {
    vi.stubGlobal('fetch', mockLastRaceFetch(lastRaceFixture));
    const result = await fetchF1LastRace();
    expect(result).not.toBeNull();
    expect(result!.round).toBe(23);
    expect(result!.raceName).toBe('Abu Dhabi Grand Prix');
    expect(result!.circuit).toBe('Yas Marina Circuit');
    expect(result!.date).toBeInstanceOf(Date);
    expect(result!.date.toISOString().startsWith('2026-12-06')).toBe(true);
    expect(result!.results).toHaveLength(3);
    expect(result!.results[0]).toEqual({
      position: 1,
      driverName: 'Max Verstappen',
      driverCode: 'VER',
      team: 'Red Bull',
      status: 'Finished',
      time: '1:26:33.291',
      points: 25,
    });
    expect(result!.results[2].time).toBeUndefined();
    expect(result!.results[2].status).toBe('+1 Lap');
  });

  it('returns null when fetch is not ok', async () => {
    vi.stubGlobal('fetch', mockLastRaceFetch(lastRaceFixture, false));
    const result = await fetchF1LastRace();
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const result = await fetchF1LastRace();
    expect(result).toBeNull();
  });

  it('returns null when payload shape is wrong', async () => {
    vi.stubGlobal('fetch', mockLastRaceFetch({ MRData: { RaceTable: { Races: [] } } }));
    const result = await fetchF1LastRace();
    expect(result).toBeNull();
  });
});

describe('fetchF1SeasonRaces', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses season payload into RaceSummary array with winners', async () => {
    vi.stubGlobal('fetch', mockLastRaceFetch(seasonFixture));
    const races = await fetchF1SeasonRaces();
    expect(races).toHaveLength(2);
    expect(races[0]).toEqual({
      round: 1,
      raceName: 'Bahrain Grand Prix',
      date: expect.any(Date),
      winner: 'Max Verstappen',
      winnerTeam: 'Red Bull',
    });
    expect(races[1].winner).toBe('Lando Norris');
    expect(races[1].winnerTeam).toBe('McLaren');
  });

  it('returns empty array on fetch failure', async () => {
    vi.stubGlobal('fetch', mockLastRaceFetch(seasonFixture, false));
    const races = await fetchF1SeasonRaces();
    expect(races).toEqual([]);
  });

  it('returns empty array when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const races = await fetchF1SeasonRaces();
    expect(races).toEqual([]);
  });
});
