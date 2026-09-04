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

/**
 * Re-rank a table whose points have moved, because a curated `position` can no
 * longer be trusted once a delta has changed the order underneath it.
 *
 * Points descending, then wins, then the position upstream gave — that last
 * tiebreak keeps the result deterministic and leaves a genuine dead heat in the
 * order the governing body already published rather than inventing one.
 */
function rerankByPoints<T extends { points: number; wins?: number; position: number }>(
  rows: T[],
): T[] {
  return rows
    .slice()
    .sort((a, b) => b.points - a.points || (b.wins ?? 0) - (a.wins ?? 0) || a.position - b.position)
    .map((row, i) => ({ ...row, position: i + 1 }));
}

/** Patch a drivers' table with curated overrides (position/points/pointsDelta/
 *  wins by driverName). No-op when overrides is undefined/empty.
 *
 *  A `pointsDelta` is an ADJUSTMENT to whatever upstream reports, which is what
 *  an appeal produces — the FIA International Court of Appeal reinstated Pierre
 *  Gasly's Monaco penalties on 2026-09-04, three months after the race, moving
 *  five drivers. A standings table accumulates, so writing absolute totals there
 *  would have frozen those five at their 4 September values for the rest of the
 *  season. Any delta therefore re-ranks the table rather than trusting a curated
 *  position that the delta may have invalidated. */
export function applyDriverOverrides(
  drivers: DriverStanding[],
  overrides: StandingsOverridesFile['drivers'],
): DriverStanding[] {
  if (!overrides || overrides.length === 0) return drivers;
  let shifted = false;
  const patched = drivers.map(d => {
    const o = overrides.find(x => x.driverName === d.driverName);
    if (!o) return d;
    if (o.pointsDelta) shifted = true;
    return {
      ...d,
      position: o.position ?? d.position,
      points: (o.points ?? d.points) + (o.pointsDelta ?? 0),
      wins: o.wins ?? d.wins,
    };
  });
  return shifted ? rerankByPoints(patched) : patched.sort((a, b) => a.position - b.position);
}

/** Patch a constructors' table with curated overrides (position/points/
 *  pointsDelta/wins by name). No-op when overrides is undefined/empty.
 *  `pointsDelta` behaves exactly as it does for drivers above, including the
 *  re-rank, because a constructors' table accumulates the same way. */
export function applyConstructorOverrides(
  constructors: ConstructorStanding[],
  overrides: StandingsOverridesFile['constructors'],
): ConstructorStanding[] {
  if (!overrides || overrides.length === 0) return constructors;
  let shifted = false;
  const patched = constructors.map(c => {
    const o = overrides.find(x => x.name === c.name);
    if (!o) return c;
    if (o.pointsDelta) shifted = true;
    return {
      ...c,
      position: o.position ?? c.position,
      points: (o.points ?? c.points) + (o.pointsDelta ?? 0),
      wins: o.wins ?? c.wins,
    };
  });
  return shifted ? rerankByPoints(patched) : patched.sort((a, b) => a.position - b.position);
}
