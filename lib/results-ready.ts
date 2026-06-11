import type { RaceResult } from '@/lib/types';
import { fetchF1SeasonResults } from '@/lib/results/f1';
import { fetchF3SeasonResults } from '@/lib/results/f3';
import { fetchFormulaESeasonResults } from '@/lib/results/formula-e';
import { fetchIndyCarSeasonResults } from '@/lib/results/indycar';
import { fetchMotoGPSeasonResults } from '@/lib/results/motogp';

// "Results are in" notification support (notify cron). A series is covered
// when its season-results fetcher is zero-config and returns RaceResult[]
// with real race dates. Each fetcher already carries its own HTTP cache
// (next revalidate / KV), and the cron only calls one when that series has
// a just-ended race session pending — a handful of calls per weekend.
//
// Not covered yet (shape/argument/fragility reasons, one adapter each to
// add): f2 (custom F2SeasonResults shape), nascar-cup (fetcher requires the
// rounds.json file), imsa (per-class shape), gt-world (needs round args),
// wrc (rally dates span days), dtm (chart data carries synthetic dates),
// wec (no results pipeline yet), wsbk.
const RESULTS_DATE_SOURCES: Record<string, () => Promise<RaceResult[]>> = {
  f1: () => fetchF1SeasonResults(),
  f3: () => fetchF3SeasonResults(new Date().getUTCFullYear()),
  'formula-e': () => fetchFormulaESeasonResults(),
  indycar: () => fetchIndyCarSeasonResults({ drivers: null }),
  motogp: () => fetchMotoGPSeasonResults(new Date().getUTCFullYear()),
};

export function seriesSupportsResultsReady(slug: string): boolean {
  return slug in RESULTS_DATE_SOURCES;
}

// A session "looks like a race" when its title names the decider — the only
// session type our results tabs render. Practice/qualifying on race day must
// not trigger (NASCAR/IndyCar race days carry warmups).
const RACE_TITLE = /\b(race|grand prix|gp|500|400|24 hours|rally)\b/i;
const NON_RACE_TITLE = /\b(practice|qualifying|hyperpole|shootout|warm-?up|test)\b/i;

export function looksLikeRaceSession(title: string): boolean {
  return RACE_TITLE.test(title) && !NON_RACE_TITLE.test(title);
}

function sameUTCDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

/**
 * True when the series' results feed — the same source the results tab
 * renders — contains a race dated on the session's start day. That is the
 * "results have rendered on our page" signal the notification promises.
 */
export async function resultsRenderedFor(
  slug: string,
  sessionStart: Date,
): Promise<boolean> {
  const source = RESULTS_DATE_SOURCES[slug];
  if (!source) return false;
  try {
    const races = await source();
    return races.some(r => sameUTCDay(r.date, sessionStart));
  } catch {
    return false;
  }
}
