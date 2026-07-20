import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FomSeasonBundle } from './fom-api';

// f3.ts is a thin adapter over fetchFomSeason (tested in fom-api.test.ts). These
// tests cover only the adapter: the flat feature+sprint ordering and the
// session-results passthrough.
vi.mock('./fom-api', () => ({ fetchFomSeason: vi.fn() }));
import { fetchFomSeason } from './fom-api';
import { fetchF3SeasonResults, fetchF3SessionResults } from './f3';

const race = (round: number, kind: 'Feature' | 'Sprint'): FomSeasonBundle['feature'][number] => ({
  round,
  raceName: `Round ${round} ${kind} Race`,
  date: new Date('2026-03-08T00:00:00Z'),
  circuit: 'C',
  results: [],
});

const BUNDLE: FomSeasonBundle = {
  // Deliberately out of order to prove the adapter sorts.
  feature: [race(2, 'Feature'), race(1, 'Feature')],
  sprint: [race(1, 'Sprint')],
  qualifying: [{ round: 1, data: { isQualifying: false, isRace: false, entries: [] } }],
  practice: [{ round: 1, data: { isQualifying: false, isRace: false, entries: [] } }],
};

describe('fetchF3SeasonResults', () => {
  beforeEach(() => vi.mocked(fetchFomSeason).mockReset());

  it('flattens feature + sprint sorted by round, feature before sprint within a round', async () => {
    vi.mocked(fetchFomSeason).mockResolvedValue(BUNDLE);
    const races = await fetchF3SeasonResults(2026);
    expect(fetchFomSeason).toHaveBeenCalledWith('f3', 2026);
    expect(races.map(r => [r.round, r.raceName.includes('Feature')])).toEqual([
      [1, true],  // round 1 feature
      [1, false], // round 1 sprint
      [2, true],  // round 2 feature
    ]);
  });
});

describe('fetchF3SessionResults', () => {
  beforeEach(() => vi.mocked(fetchFomSeason).mockReset());

  it('returns the qualifying + practice classifications from the bundle', async () => {
    vi.mocked(fetchFomSeason).mockResolvedValue(BUNDLE);
    const out = await fetchF3SessionResults(2026);
    expect(out).toEqual({ qualifying: BUNDLE.qualifying, practice: BUNDLE.practice });
  });
});
