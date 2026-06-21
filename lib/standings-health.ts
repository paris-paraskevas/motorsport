// Live source-health check for standings. Registry only — the grading,
// row-counting and summary live in lib/health-core.ts (shared with results).

import { type Check, runChecks } from '@/lib/health-core';
import { fetchF1Standings } from '@/lib/standings/f1';
import { fetchF2Standings } from '@/lib/standings/f2';
import { fetchF3Standings } from '@/lib/standings/f3';
import { fetchFormulaEStandings } from '@/lib/standings/formula-e';
import { fetchDTMStandings } from '@/lib/standings/dtm';
import { fetchGtWorldStandings } from '@/lib/standings/gt-world';
import { fetchImsaStandings } from '@/lib/standings/imsa';
import { fetchIndyCarStandings } from '@/lib/standings/indycar';
import { fetchMotoGPStandings } from '@/lib/standings/motogp';
import { fetchNascarCupStandings } from '@/lib/standings/nascar-cup';
import { fetchWecStandings } from '@/lib/standings/wec';
import { fetchWRCStandings } from '@/lib/standings/wrc';
import { fetchWsbkStandings } from '@/lib/standings/wsbk';

export { countRows, summarize } from '@/lib/health-core';
export type { HealthResult, HealthStatus, HealthSummary } from '@/lib/health-core';

export const HEALTH_SEASON = 2026;

// The fetcher + the floor below which a table is treated as broken/partial.
// Floors are deliberately loose — they catch "went blank / collapsed", not
// off-by-a-few roster churn. Seasonal args (MotoGP/WSBK/GT World) take `season`.
function buildChecks(season: number): Check[] {
  return [
    { slug: 'f1',         label: 'Formula 1',  source: 'Jolpica API',         run: () => fetchF1Standings(),           min: 15 },
    { slug: 'f2',         label: 'Formula 2',  source: 'motorsport.com',      run: () => fetchF2Standings(),           min: 12 },
    { slug: 'f3',         label: 'Formula 3',  source: 'motorsport.com',      run: () => fetchF3Standings(),           min: 12 },
    { slug: 'motogp',     label: 'MotoGP',     source: 'Pulselive API',       run: () => fetchMotoGPStandings(season), min: 12 },
    { slug: 'wsbk',       label: 'WSBK',       source: 'Pulselive API',       run: () => fetchWsbkStandings(season),   min: 10 },
    { slug: 'indycar',    label: 'IndyCar',    source: 'motorsport.com API',  run: () => fetchIndyCarStandings(),      min: 12 },
    { slug: 'formula-e',  label: 'Formula E',  source: 'Wikipedia',           run: () => fetchFormulaEStandings(),     min: 10 },
    { slug: 'dtm',        label: 'DTM',        source: 'motorsport.com',      run: () => fetchDTMStandings(),          min: 8 },
    { slug: 'wrc',        label: 'WRC',        source: 'Wikipedia / wrc.com', run: () => fetchWRCStandings(),           min: 5 },
    { slug: 'nascar-cup', label: 'NASCAR Cup', source: 'motorsport.com',      run: () => fetchNascarCupStandings(),    min: 15 },
    { slug: 'gt-world',   label: 'GT World',   source: 'motorsport.com',      run: () => fetchGtWorldStandings(season), min: 10 },
    { slug: 'imsa',       label: 'IMSA',       source: 'imsa.com',            run: () => fetchImsaStandings(),         min: 8 },
    { slug: 'wec',        label: 'WEC',        source: 'fiawec.com',          run: () => fetchWecStandings(),          min: 8 },
  ];
}

export async function runStandingsHealth(season: number = HEALTH_SEASON) {
  return runChecks(buildChecks(season));
}
