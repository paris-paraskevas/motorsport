import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  latestRaceFromFlat,
  fetchLatestPodium,
  fetchFirstPodiumWithin,
  type LatestRace,
} from './home-results';
import { readResultsCache, writeResultsCache } from './results-cache';
import { fetchF1SeasonResults } from './results/f1';
import type { RaceResult, RaceResultEntry } from './types';

// The negative-cache tests below drive fetchLatestPodium('f1') without any
// network or KV: the cache layer and the one source they exercise are mocked.
vi.mock('./results-cache', () => ({
  readResultsCache: vi.fn(async () => null),
  writeResultsCache: vi.fn(async () => undefined),
}));
vi.mock('./series-content', () => ({
  loadResultsOverrides: vi.fn(async () => null),
}));
vi.mock('./results/f1', () => ({ fetchF1SeasonResults: vi.fn(async () => []) }));

const NOW = Date.UTC(2026, 5, 19); // 2026-06-19

function entry(position: number, driverName: string, team: string): RaceResultEntry {
  return { position, driverName, team, status: 'Finished', points: 0 };
}

function race(round: number, raceName: string, isoDate: string, entries: RaceResultEntry[]): RaceResult {
  return { round, raceName, date: new Date(isoDate), circuit: '', results: entries };
}

describe('latestRaceFromFlat', () => {
  it('picks the most recent finished race and returns the top 3 in order', () => {
    const races = [
      race(1, 'Opener', '2026-03-01T14:00:00Z', [
        entry(1, 'Old Winner', 'Team A'),
        entry(2, 'B', 'Team B'),
        entry(3, 'C', 'Team C'),
      ]),
      race(8, 'Latest', '2026-06-14T14:00:00Z', [
        entry(3, 'Third', 'Team C'),
        entry(1, 'First', 'Team A'),
        entry(2, 'Second', 'Team B'),
        entry(4, 'Fourth', 'Team D'),
      ]),
    ];
    const result = latestRaceFromFlat(races, NOW);
    expect(result?.raceName).toBe('Latest');
    expect(result?.round).toBe(8);
    expect(result?.podium.map(p => p.position)).toEqual([1, 2, 3]);
    expect(result?.podium.map(p => p.name)).toEqual(['First', 'Second', 'Third']);
    expect(result?.podium[0].detail).toBe('Team A');
  });

  it('ignores races that have not happened yet', () => {
    const races = [
      race(1, 'Done', '2026-06-10T14:00:00Z', [entry(1, 'Won', 'T')]),
      race(2, 'Future', '2026-07-10T14:00:00Z', [entry(1, 'NotYet', 'T')]),
    ];
    expect(latestRaceFromFlat(races, NOW)?.raceName).toBe('Done');
  });

  it('skips races with no classification rows', () => {
    const races = [
      race(1, 'Classified', '2026-06-01T14:00:00Z', [entry(1, 'Won', 'T')]),
      race(2, 'WinnersOnlyEmpty', '2026-06-15T14:00:00Z', []),
    ];
    expect(latestRaceFromFlat(races, NOW)?.raceName).toBe('Classified');
  });

  it('returns null when there are no finished races', () => {
    expect(latestRaceFromFlat([], NOW)).toBeNull();
    expect(
      latestRaceFromFlat([race(1, 'F', '2026-12-01T00:00:00Z', [entry(1, 'X', 'T')])], NOW),
    ).toBeNull();
  });

  it('carries the feed time/gap strings — the home lead reads P2 as the winning margin', () => {
    const withTimes = race(1, 'R', '2026-06-10T14:00:00Z', [
      { ...entry(1, 'Winner', 'TA'), time: '1:31:44.702' },
      { ...entry(2, 'Second', 'TB'), time: '+15.080' },
      { ...entry(3, 'Third', 'TC'), time: '+18.728' },
    ]);
    const result = latestRaceFromFlat([withTimes], NOW);
    expect(result?.podium.map(p => p.time)).toEqual(['1:31:44.702', '+15.080', '+18.728']);
  });

  it('caps the podium at 3 even when more positions exist', () => {
    const result = latestRaceFromFlat(
      [
        race(1, 'R', '2026-06-10T14:00:00Z', [
          entry(1, 'A', 'TA'),
          entry(2, 'B', 'TB'),
          entry(3, 'C', 'TC'),
          entry(4, 'D', 'TD'),
          entry(5, 'E', 'TE'),
        ]),
      ],
      NOW,
    );
    expect(result?.podium).toHaveLength(3);
  });
});

describe('fetchLatestPodium negative cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a cached sentinel short-circuits to null without touching the source', async () => {
    vi.mocked(readResultsCache).mockResolvedValueOnce('none');
    const result = await fetchLatestPodium('f1');
    expect(result).toBeNull();
    expect(fetchF1SeasonResults).not.toHaveBeenCalled();
    expect(writeResultsCache).not.toHaveBeenCalled();
  });

  it('an empty season writes the short-TTL sentinel instead of nothing', async () => {
    vi.mocked(readResultsCache).mockResolvedValueOnce(null);
    vi.mocked(fetchF1SeasonResults).mockResolvedValueOnce([]);
    const result = await fetchLatestPodium('f1');
    expect(result).toBeNull();
    expect(writeResultsCache).toHaveBeenCalledWith(expect.stringContaining(':f1:'), 'none', 15 * 60);
  });

  it('a throwing source writes the sentinel and resolves null', async () => {
    vi.mocked(readResultsCache).mockResolvedValueOnce(null);
    vi.mocked(fetchF1SeasonResults).mockRejectedValueOnce(new Error('blocked egress'));
    const result = await fetchLatestPodium('f1');
    expect(result).toBeNull();
    expect(writeResultsCache).toHaveBeenCalledWith(expect.any(String), 'none', 15 * 60);
  });

  it('force bypasses the cache reads entirely (the warm-path contract)', async () => {
    vi.mocked(fetchF1SeasonResults).mockResolvedValueOnce([
      race(1, 'Warmed', '2026-06-10T14:00:00Z', [entry(1, 'W', 'T')]),
    ]);
    const result = await fetchLatestPodium('f1', { force: true });
    expect(readResultsCache).not.toHaveBeenCalled();
    expect(result?.raceName).toBe('Warmed');
    expect(writeResultsCache).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ raceName: 'Warmed' }),
    );
  });
});

describe('fetchFirstPodiumWithin', () => {
  function podiumRace(name: string): LatestRace {
    return {
      round: 1,
      raceName: name,
      date: '2026-06-14T14:00:00.000Z',
      podium: [{ position: 1, name: 'Winner' }],
    };
  }

  it('returns the first candidate that has a podium and stops there', async () => {
    const lookup = vi.fn(async (slug: string) => (slug === 'a' ? podiumRace('A') : null));
    const result = await fetchFirstPodiumWithin(['a', 'b'], 1000, lookup);
    expect(result?.raceName).toBe('A');
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('falls through null and empty-podium candidates in order', async () => {
    const lookup = vi.fn(async (slug: string) => {
      if (slug === 'a') return null;
      if (slug === 'b') return { ...podiumRace('B'), podium: [] };
      return podiumRace('C');
    });
    const result = await fetchFirstPodiumWithin(['a', 'b', 'c'], 1000, lookup);
    expect(result?.raceName).toBe('C');
    expect(lookup).toHaveBeenCalledTimes(3);
  });

  it('tries at most three candidates', async () => {
    const lookup = vi.fn(async () => null);
    const result = await fetchFirstPodiumWithin(['a', 'b', 'c', 'd'], 1000, lookup);
    expect(result).toBeNull();
    expect(lookup).toHaveBeenCalledTimes(3);
  });

  it('treats a lookup rejection as null and keeps going', async () => {
    const lookup = vi.fn(async (slug: string) => {
      if (slug === 'a') throw new Error('boom');
      return podiumRace('B');
    });
    const result = await fetchFirstPodiumWithin(['a', 'b'], 1000, lookup);
    expect(result?.raceName).toBe('B');
  });

  it('renders empty once the budget expires — a hung lookup cannot hold the stream', async () => {
    const lookup = vi.fn(() => new Promise<LatestRace | null>(() => {}));
    const started = Date.now();
    const result = await fetchFirstPodiumWithin(['a'], 25, lookup);
    expect(result).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
