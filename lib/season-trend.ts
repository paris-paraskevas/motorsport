import type {
  ConstructorStanding,
  DriverStanding,
  RaceResult,
  RaceResultEntry,
} from './types';

export interface SeasonTrendPoint {
  round: number;
  raceName: string;
  // Driver name → cumulative points after this round
  [driverName: string]: number | string;
}

export interface SeasonTrendData {
  data: SeasonTrendPoint[];
  drivers: Array<{ name: string; code?: string; team?: string }>;
  totalsByDriver: Record<string, number>;
}

/**
 * Build cumulative-points-per-round trend data for charting. Every race round
 * becomes one x-axis point; each driver becomes a y series carrying their
 * running total points up to that round.
 *
 * `extras` is for points awarded outside the main race result that should
 * fold into the cumulative total at the same x-axis position. F1 uses this
 * for Sprint races (Jolpica exposes Sprint on a separate endpoint; we don't
 * want a separate x-axis tick for the sprint since fans think of "Round 2"
 * as a single weekend regardless of whether it had a sprint).
 */
export function buildSeasonTrendData(
  races: RaceResult[],
  extras: RaceResult[] = [],
): SeasonTrendData {
  const sorted = [...races].sort((a, b) => a.round - b.round);

  const extrasByRound = new Map<number, RaceResultEntry[]>();
  for (const x of extras) {
    const existing = extrasByRound.get(x.round) ?? [];
    existing.push(...x.results);
    extrasByRound.set(x.round, existing);
  }

  const driverInfo = new Map<string, { code?: string; team?: string }>();
  const registerDriver = (entry: RaceResultEntry) => {
    if (!driverInfo.has(entry.driverName)) {
      driverInfo.set(entry.driverName, { code: entry.driverCode, team: entry.team });
    }
  };
  for (const race of sorted) {
    for (const r of race.results) registerDriver(r);
  }
  for (const list of extrasByRound.values()) {
    for (const r of list) registerDriver(r);
  }
  const drivers = [...driverInfo.entries()].map(([name, info]) => ({
    name,
    code: info.code,
    team: info.team,
  }));

  const running: Record<string, number> = {};
  for (const d of drivers) running[d.name] = 0;

  const data: SeasonTrendPoint[] = sorted.map(race => {
    for (const r of race.results) {
      running[r.driverName] = (running[r.driverName] ?? 0) + r.points;
    }
    const sprintEntries = extrasByRound.get(race.round);
    if (sprintEntries) {
      for (const r of sprintEntries) {
        running[r.driverName] = (running[r.driverName] ?? 0) + r.points;
      }
    }
    const snapshot: SeasonTrendPoint = { round: race.round, raceName: race.raceName };
    for (const d of drivers) snapshot[d.name] = running[d.name] ?? 0;
    return snapshot;
  });

  return { data, drivers, totalsByDriver: { ...running } };
}

export interface StandingsAtRound {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
  // The last round actually counted — ≤ the requested round when results
  // for later rounds haven't been published (or rounds were cancelled).
  throughRound: number;
}

/**
 * Standings as they stood after `throughRound` — the weekend page's
 * point-in-time snapshot (W1b). Cumulates race points from rounds ≤
 * throughRound; `extras` fold in sprint points exactly like
 * buildSeasonTrendData. Constructors sum every classified entry's points by
 * team string; a series whose results carry empty teams yields an empty
 * constructors list (renderer hides that table). Wins count P1 finishes in
 * main races only. Ties break points → wins → name; championship countback
 * beyond wins isn't modeled — fine for a snapshot, don't reuse for title
 * deciders.
 */
export function buildStandingsAtRound(
  races: RaceResult[],
  throughRound: number,
  extras: RaceResult[] = [],
): StandingsAtRound {
  const counted = races.filter(r => r.round <= throughRound);
  const countedExtras = extras.filter(r => r.round <= throughRound);

  const byDriver = new Map<
    string,
    { points: number; wins: number; team: string; code?: string }
  >();
  const byTeam = new Map<string, number>();
  const bump = (entry: RaceResultEntry, isMainRace: boolean) => {
    const d =
      byDriver.get(entry.driverName) ??
      { points: 0, wins: 0, team: entry.team, code: entry.driverCode };
    d.points += entry.points;
    if (isMainRace && entry.position === 1) d.wins += 1;
    // Latest non-empty team wins — mid-season seat swaps show the seat the
    // driver held at this point of the season.
    d.team = entry.team || d.team;
    d.code = entry.driverCode ?? d.code;
    byDriver.set(entry.driverName, d);
    if (entry.team) {
      byTeam.set(entry.team, (byTeam.get(entry.team) ?? 0) + entry.points);
    }
  };
  for (const race of counted) for (const e of race.results) bump(e, true);
  for (const race of countedExtras) for (const e of race.results) bump(e, false);

  const drivers: DriverStanding[] = [...byDriver.entries()]
    .map(([driverName, v]) => ({
      position: 0,
      driverName,
      driverCode: v.code,
      team: v.team,
      points: v.points,
      wins: v.wins,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        (b.wins ?? 0) - (a.wins ?? 0) ||
        a.driverName.localeCompare(b.driverName),
    )
    .map((d, i) => ({ ...d, position: i + 1 }));

  const constructors: ConstructorStanding[] = [...byTeam.entries()]
    .map(([name, points]) => ({ position: 0, name, points }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .map((c, i) => ({ ...c, position: i + 1 }));

  return {
    drivers,
    constructors,
    throughRound: counted.reduce((m, r) => Math.max(m, r.round), 0),
  };
}
