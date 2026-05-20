import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchF1LastRace, fetchF1SeasonResults, fetchF1SeasonSprints } from './f1';

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

describe('fetchF1SeasonResults', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses season payload into full RaceResult array with finishers per round', async () => {
    vi.stubGlobal('fetch', mockLastRaceFetch(seasonFixture));
    const races = await fetchF1SeasonResults();
    expect(races).toHaveLength(2);
    expect(races[0].round).toBe(1);
    expect(races[0].raceName).toBe('Bahrain Grand Prix');
    expect(races[0].results).toHaveLength(1);
    expect(races[0].results[0].driverName).toBe('Max Verstappen');
    expect(races[0].results[0].team).toBe('Red Bull');
    expect(races[1].results[0].driverName).toBe('Lando Norris');
  });

  it('returns empty array on fetch failure', async () => {
    vi.stubGlobal('fetch', mockLastRaceFetch(seasonFixture, false));
    const races = await fetchF1SeasonResults();
    expect(races).toEqual([]);
  });

  it('returns empty array when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const races = await fetchF1SeasonResults();
    expect(races).toEqual([]);
  });
});

const sprintFixture = {
  MRData: {
    RaceTable: {
      Races: [
        {
          round: '2',
          raceName: 'Chinese Grand Prix',
          date: '2026-03-15',
          Circuit: { circuitName: 'Shanghai International Circuit' },
          SprintResults: [
            {
              position: '1',
              points: '8',
              Driver: { givenName: 'George', familyName: 'Russell', code: 'RUS' },
              Constructor: { name: 'Mercedes' },
              status: 'Finished',
              Time: { time: '33:38.998' },
            },
            {
              position: '2',
              points: '7',
              Driver: { givenName: 'Charles', familyName: 'Leclerc', code: 'LEC' },
              Constructor: { name: 'Ferrari' },
              status: 'Finished',
              Time: { time: '+0.674' },
            },
            {
              position: '3',
              points: '6',
              Driver: { givenName: 'Lewis', familyName: 'Hamilton', code: 'HAM' },
              Constructor: { name: 'Ferrari' },
              status: 'Finished',
            },
          ],
        },
        {
          round: '4',
          raceName: 'Miami Grand Prix',
          date: '2026-05-03',
          Circuit: { circuitName: 'Miami International Autodrome' },
          SprintResults: [
            {
              position: '1',
              points: '8',
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

function mockSprintFetch(payload: unknown, ok = true) {
  return vi.fn(async () => ({
    ok,
    json: async () => payload,
  }) as Response);
}

describe('fetchF1SeasonSprints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses sprint payload SprintResults[] into RaceResult[] with points + positions', async () => {
    vi.stubGlobal('fetch', mockSprintFetch(sprintFixture));
    const sprints = await fetchF1SeasonSprints();
    expect(sprints).toHaveLength(2);
    expect(sprints[0].round).toBe(2);
    expect(sprints[0].raceName).toBe('Chinese Grand Prix');
    expect(sprints[0].results).toHaveLength(3);
    expect(sprints[0].results[0]).toEqual({
      position: 1,
      driverName: 'George Russell',
      driverCode: 'RUS',
      team: 'Mercedes',
      status: 'Finished',
      time: '33:38.998',
      points: 8,
    });
    expect(sprints[1].round).toBe(4);
    expect(sprints[1].results[0].driverName).toBe('Lando Norris');
    expect(sprints[1].results[0].points).toBe(8);
  });

  it('returns empty array on fetch failure', async () => {
    vi.stubGlobal('fetch', mockSprintFetch(sprintFixture, false));
    const sprints = await fetchF1SeasonSprints();
    expect(sprints).toEqual([]);
  });

  it('returns empty array when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const sprints = await fetchF1SeasonSprints();
    expect(sprints).toEqual([]);
  });

  it('returns empty array when SprintResults is missing on a race entry', async () => {
    vi.stubGlobal(
      'fetch',
      mockSprintFetch({
        MRData: {
          RaceTable: {
            Races: [
              {
                round: '2',
                raceName: 'Chinese Grand Prix',
                date: '2026-03-15',
                Circuit: { circuitName: 'Shanghai International Circuit' },
                // No SprintResults field at all
              },
            ],
          },
        },
      }),
    );
    const sprints = await fetchF1SeasonSprints();
    expect(sprints).toEqual([]);
  });
});
