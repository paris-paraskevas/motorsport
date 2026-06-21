// Live source-health check for RESULTS. Sibling of standings-health; shares the
// grading core. The notify cron's "results are in" push depends on these
// parsers, so a silent break here means a missed (or wrong) notification.
//
// Scope: the series whose season results are fetched live from a self-contained
// source (API or scrape) callable without per-series content. Skipped on purpose:
//   - gt-world, nascar-cup — their season fetchers need the round list passed in
//     (content-coupled); their motorsport.com source is already exercised by the
//     standings monitor.
//   - imsa, wec — results are per-round curated / link-out, so there is no live
//     parser here to drift.
//
// Grading: floor is 1, so results grade only OK (got data) / EMPTY (parser
// returned nothing) / ERROR (threw). Results accumulate across a season, so a
// magnitude floor would false-alarm; catching "went empty" is the real signal.
// Drop-vs-yesterday detection would need a stored baseline (a future ledger).

import { type Check, runChecks } from '@/lib/health-core';
import { fetchF1SeasonResults } from '@/lib/results/f1';
import { fetchF2SeasonResults } from '@/lib/results/f2';
import { fetchF3SeasonResults } from '@/lib/results/f3';
import { fetchFormulaESeasonResults } from '@/lib/results/formula-e';
import { fetchMotoGPSeasonResults } from '@/lib/results/motogp';
import { fetchWsbkSeasonResults } from '@/lib/results/wsbk';
import { fetchWRCSeasonResults } from '@/lib/results/wrc';
import { fetchIndyCarSeasonResults } from '@/lib/results/indycar';

export { countRows, summarize } from '@/lib/health-core';
export type { HealthResult, HealthStatus, HealthSummary } from '@/lib/health-core';

export const RESULTS_HEALTH_SEASON = 2026;

function buildChecks(season: number): Check[] {
  return [
    { slug: 'f1',         label: 'Formula 1',  source: 'Jolpica API',        run: () => fetchF1SeasonResults(),                min: 1 },
    { slug: 'f2',         label: 'Formula 2',  source: 'motorsport.com',     run: () => fetchF2SeasonResults(season),         min: 1 },
    { slug: 'f3',         label: 'Formula 3',  source: 'motorsport.com',     run: () => fetchF3SeasonResults(season),         min: 1 },
    { slug: 'motogp',     label: 'MotoGP',     source: 'Pulselive API',      run: () => fetchMotoGPSeasonResults(season),     min: 1 },
    { slug: 'wsbk',       label: 'WSBK',       source: 'Pulselive API',      run: () => fetchWsbkSeasonResults(season),       min: 1 },
    { slug: 'indycar',    label: 'IndyCar',    source: 'Wikipedia',          run: () => fetchIndyCarSeasonResults({}),         min: 1 },
    { slug: 'formula-e',  label: 'Formula E',  source: 'Wikipedia',          run: () => fetchFormulaESeasonResults(),          min: 1 },
    { slug: 'wrc',        label: 'WRC',        source: 'Wikipedia',          run: () => fetchWRCSeasonResults(season),         min: 1 },
  ];
}

export async function runResultsHealth(season: number = RESULTS_HEALTH_SEASON) {
  return runChecks(buildChecks(season));
}
