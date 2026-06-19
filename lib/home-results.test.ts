import { describe, it, expect } from 'vitest';
import { latestRaceFromFlat } from './home-results';
import type { RaceResult, RaceResultEntry } from './types';

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
