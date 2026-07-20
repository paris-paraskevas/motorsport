import type { RaceResult, RaceResultEntry } from '@/lib/types';
import type { SessionClassification } from '@/lib/results/openf1';
import { fetchFomSeason } from '@/lib/results/fom-api';

export type { RaceResult, RaceResultEntry };

// F2 results are served by the shared FOM API client (lib/results/fom-api.ts).
// The FIA rebuilt fiaformula2.com onto a Next.js App-Router frontend that
// server-renders only the feature race and loads every other session from
// api.formula1.com; the old __NEXT_DATA__ scrape went permanently empty when
// that shipped. See fom-api.ts for the source, the [SR,FR] canonical-points
// contract, and the public-key landmine.

export interface F2SessionClassification {
  round: number;
  data: SessionClassification;
}

export interface F2SeasonResults {
  feature: RaceResult[];
  sprint: RaceResult[];
  // Per-round practice and qualifying classifications, for the weekend session
  // pages. Optional so cached payloads written before this field stay valid.
  qualifying?: F2SessionClassification[];
  practice?: F2SessionClassification[];
}

export async function fetchF2SeasonResults(season?: number): Promise<F2SeasonResults> {
  const bundle = await fetchFomSeason('f2', season ?? new Date().getUTCFullYear());
  return {
    feature: bundle.feature,
    sprint: bundle.sprint,
    qualifying: bundle.qualifying,
    practice: bundle.practice,
  };
}
