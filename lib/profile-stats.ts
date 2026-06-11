import type { RaceResult } from './types';
import { buildStandingsAtRound } from './season-trend';
import { slugify } from './slug';

// Season-form stats for driver/team profile pages (W4 step 3). Derived from
// the SAME results feeds the weekend standings snapshots cumulate — one data
// path, already reconciliation-verified per series. Series whose results
// carry no points (WEC/IMSA/GTWC/NLS/ADAC) return null and the pages degrade
// gracefully.

export interface DriverSeasonForm {
  position: number;
  points: number;
  wins: number;
  fieldSize: number;
  last5: Array<{ round: number; raceName: string; position: number; points: number }>;
}

export interface TeamSeasonForm {
  position: number;
  points: number;
  fieldSize: number;
}

// drivers.json names and results feeds drift ("Kimi Antonelli" vs Jolpica's
// "Andrea Kimi Antonelli") — match on slug equality or containment.
export function namesMatch(a: string, b: string): boolean {
  const sa = slugify(a);
  const sb = slugify(b);
  if (!sa || !sb) return false;
  return sa === sb || sa.includes(sb) || sb.includes(sa);
}

export function driverSeasonForm(
  races: RaceResult[],
  extras: RaceResult[] | undefined,
  driverName: string,
): DriverSeasonForm | null {
  if (races.length === 0) return null;
  const snap = buildStandingsAtRound(races, Number.MAX_SAFE_INTEGER, extras ?? []);
  const row = snap.drivers.find(d => namesMatch(d.driverName, driverName));
  if (!row) return null;

  const appearances = races
    .map(r => {
      const entry = r.results.find(e => namesMatch(e.driverName, driverName));
      return entry
        ? { round: r.round, raceName: r.raceName, position: entry.position, points: entry.points }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.round - a.round);

  return {
    position: row.position,
    points: row.points,
    wins: row.wins ?? 0,
    fieldSize: snap.drivers.length,
    last5: appearances.slice(0, 5),
  };
}

export function teamSeasonForm(
  races: RaceResult[],
  extras: RaceResult[] | undefined,
  teamName: string,
): TeamSeasonForm | null {
  if (races.length === 0) return null;
  const snap = buildStandingsAtRound(races, Number.MAX_SAFE_INTEGER, extras ?? []);
  const row = snap.constructors.find(c => namesMatch(c.name, teamName));
  if (!row) return null;
  return { position: row.position, points: row.points, fieldSize: snap.constructors.length };
}
