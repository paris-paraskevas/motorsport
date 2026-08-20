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
  /** Best finishing position across the season, null when never classified. */
  bestFinish: number | null;
  /** Race starts (appearances in the results feeds, extras included). */
  starts: number;
  /** Top-three finishes (position 1–3), extras included — same derivation as
   *  the rounds table, so it can never disagree with it (§4.9 rule). */
  podiums: number;
  last5: Array<{ round: number; raceName: string; position: number; points: number }>;
  /** EVERY round this season, ascending, with the running points total — the
   *  profile's body table (design handoff §4.9: "All of them"). Derived from
   *  the same results the headline stats cumulate, so the two can never
   *  disagree. `circuit` carries the venue for the row's sub-line.
   *  `championshipPosition` is the driver's title-race position AFTER that
   *  round (buildStandingsAtRound), stamped on each round's final row only —
   *  standings are per-round, so a sprint row carries none. */
  rounds: Array<{
    round: number;
    raceName: string;
    circuit: string;
    position: number;
    points: number;
    runningTotal: number;
    championshipPosition?: number;
  }>;
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

  // Extras (sprints, superpole races…) count toward starts + the running
  // total but list under their parent round's name where they share a round.
  const pick = (r: RaceResult, fromExtras: boolean) => {
    const entry = r.results.find(e => namesMatch(e.driverName, driverName));
    return entry
      ? { round: r.round, raceName: r.raceName, circuit: r.circuit, position: entry.position, points: entry.points, fromExtras }
      : null;
  };
  const all = [
    ...races.map(r => pick(r, false)),
    ...(extras ?? []).map(r => pick(r, true)),
  ]
    .filter((x): x is NonNullable<ReturnType<typeof pick>> => x !== null)
    .sort((a, b) => a.round - b.round || Number(b.fromExtras) - Number(a.fromExtras));
  // F1's sprint extras reuse the grand prix's raceName — disambiguate the
  // label when a round carries two same-named rows (WSBK's extras are already
  // distinctly named, so they pass through untouched).
  for (const a of all) {
    if (a.fromExtras && all.some(b => b !== a && b.round === a.round && b.raceName === a.raceName)) {
      a.raceName = `${a.raceName} · Sprint`;
    }
  }
  // Championship position after each round — the same snapshot the trend
  // chart derives from, so the two can never disagree (operator, 2026-08-20:
  // "could we add championship position per result?").
  const posAfterRound = new Map<number, number>();
  for (const rn of new Set(all.map(a => a.round))) {
    const s = buildStandingsAtRound(races, rn, extras ?? []);
    const p = s.drivers.find(d => namesMatch(d.driverName, driverName))?.position;
    if (p != null) posAfterRound.set(rn, p);
  }
  let running = 0;
  const rounds = all.map((a, i) => {
    running += a.points;
    const isRoundFinal = i === all.length - 1 || all[i + 1].round !== a.round;
    return {
      ...a,
      runningTotal: running,
      championshipPosition: isRoundFinal ? posAfterRound.get(a.round) : undefined,
    };
  });
  const classified = all.filter(a => a.position >= 1);
  const appearances = [...all].sort((a, b) => b.round - a.round);

  return {
    position: row.position,
    points: row.points,
    wins: row.wins ?? 0,
    fieldSize: snap.drivers.length,
    bestFinish: classified.length > 0 ? Math.min(...classified.map(a => a.position)) : null,
    starts: all.length,
    podiums: classified.filter(a => a.position <= 3).length,
    last5: appearances.slice(0, 5),
    rounds,
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
