// Pure override-application helpers for the drivers'/constructors' standings
// tables. Extracted from components/tabs/StandingsTab.tsx (0.27.x) so the home
// standings-snapshot + championship-leader widgets (lib/standings/brief.ts) and
// any server/cron path can apply the SAME curated overrides the canonical
// Standings tab does — closing the latent drift bug where a curated
// `standings-overrides.json` would patch the tab but not the home widgets.
//
// NO React/client imports — safe in server-only loaders and cron jobs.

import type {
  DriverStanding,
  ConstructorStanding,
  StandingsOverridesFile,
} from '@/lib/types';

/** Patch a drivers' table with curated overrides (position/points/wins by
 *  driverName), then re-sort by position. No-op when overrides is
 *  undefined/empty — every series today, so behaviour is unchanged. */
export function applyDriverOverrides(
  drivers: DriverStanding[],
  overrides: StandingsOverridesFile['drivers'],
): DriverStanding[] {
  if (!overrides || overrides.length === 0) return drivers;
  const patched = drivers.map(d => {
    const o = overrides.find(x => x.driverName === d.driverName);
    if (!o) return d;
    return {
      ...d,
      position: o.position ?? d.position,
      points: o.points ?? d.points,
      wins: o.wins ?? d.wins,
    };
  });
  return patched.sort((a, b) => a.position - b.position);
}

/** Patch a constructors' table with curated overrides (position/points/wins by
 *  name), then re-sort by position. No-op when overrides is undefined/empty. */
export function applyConstructorOverrides(
  constructors: ConstructorStanding[],
  overrides: StandingsOverridesFile['constructors'],
): ConstructorStanding[] {
  if (!overrides || overrides.length === 0) return constructors;
  const patched = constructors.map(c => {
    const o = overrides.find(x => x.name === c.name);
    if (!o) return c;
    return {
      ...c,
      position: o.position ?? c.position,
      points: o.points ?? c.points,
      wins: o.wins ?? c.wins,
    };
  });
  return patched.sort((a, b) => a.position - b.position);
}
