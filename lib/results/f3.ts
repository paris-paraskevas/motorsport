import type { RaceResult, RaceResultEntry } from '@/lib/types';
import type { SessionClassification } from '@/lib/results/openf1';
import { fetchFomSeason } from '@/lib/results/fom-api';

export type { RaceResult, RaceResultEntry };

// F3 results are served by the shared FOM API client (lib/results/fom-api.ts) —
// same backend and identical handling to F2 (the two FIA sites are the same
// App-Router app on different brand ids). See fom-api.ts for the source, the
// canonical-points contract, and the public-key landmine.

// Flat feature + sprint list (feature first within a round), matching the
// long-standing shape the standings chart, movers, home, and results tab read.
export async function fetchF3SeasonResults(season: number): Promise<RaceResult[]> {
  const bundle = await fetchFomSeason('f3', season);
  const all = [...bundle.feature, ...bundle.sprint];
  all.sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    const aIsFeature = a.raceName.includes('Feature');
    const bIsFeature = b.raceName.includes('Feature');
    if (aIsFeature === bIsFeature) return 0;
    return aIsFeature ? -1 : 1;
  });
  return all;
}

export interface F3SessionClassification {
  round: number;
  data: SessionClassification;
}

export interface F3SessionResults {
  qualifying: F3SessionClassification[];
  practice: F3SessionClassification[];
}

// Per-round practice + qualifying classifications for the weekend session pages.
// Shares the cached season bundle with fetchF3SeasonResults (one fan-out).
export async function fetchF3SessionResults(season: number): Promise<F3SessionResults> {
  const bundle = await fetchFomSeason('f3', season);
  return { qualifying: bundle.qualifying, practice: bundle.practice };
}
