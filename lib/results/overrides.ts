// Pure override-application helper for per-race results. Extracted from
// components/tabs/ResultsTab.tsx (0.27.x) so the home "just missed" podium
// loader (lib/home-results.ts) and any server/cron path can apply the SAME
// curated overrides the canonical Results tab + season-trend chart do — closing
// the latent drift bug where a curated `results-overrides.json` would patch the
// tab but not the home podium.
//
// NO React/client imports — safe in server-only loaders and cron jobs.

import type {
  RaceResult,
  RaceResultEntry,
  ResultsOverridesFile,
} from '@/lib/types';

/** Patch a season's races with curated per-round result overrides
 *  (position/points/status/time by driverName, keyed by round), re-sorting each
 *  patched race by position. No-op when overrides is null — every series today,
 *  so behaviour is unchanged. */
export function applyResultsOverrides(
  races: RaceResult[],
  overrides: ResultsOverridesFile | null,
): RaceResult[] {
  if (!overrides) return races;
  return races.map(race => {
    const patches = overrides[String(race.round)];
    if (!patches || patches.length === 0) return race;
    const patched: RaceResultEntry[] = race.results.map(entry => {
      const o = patches.find(p => p.driverName === entry.driverName);
      if (!o) return entry;
      return {
        ...entry,
        position: o.position ?? entry.position,
        points: o.points ?? entry.points,
        status: o.status ?? entry.status,
        time: o.time ?? entry.time,
      };
    });
    return { ...race, results: patched.sort((a, b) => a.position - b.position) };
  });
}
