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

export interface TeamTrendInput {
  /** Display name for the aggregated line (curated team name). */
  name: string;
  /** Results-feed constructor name — lets the chart resolve team colors. */
  feedTeam?: string;
  /** Member driver keys as they appear in the SeasonTrendData (feed names). */
  memberNames: string[];
}

/**
 * Aggregate a per-driver season trend into per-team lines by summing the
 * member drivers' cumulative points at every round. Pure over
 * `buildSeasonTrendData` output; the caller resolves membership (feed team
 * string → curated team) so this stays matcher-agnostic.
 *
 * Caveat: `buildSeasonTrendData` registers one team per driver, so a
 * mid-season seat swap attributes the driver's whole cumulative line to the
 * summed team — fine for a two-team comparison chart, not championship math
 * (that's `buildStandingsAtRound`, which attributes per race entry).
 */
export function aggregateTeamsTrend(
  full: SeasonTrendData,
  teams: TeamTrendInput[],
): SeasonTrendData {
  const sumFor = (memberNames: string[], values: Record<string, number | string>): number =>
    memberNames.reduce((acc, m) => {
      const v = values[m];
      return acc + (typeof v === 'number' ? v : 0);
    }, 0);

  const data: SeasonTrendPoint[] = full.data.map(p => {
    const point: SeasonTrendPoint = { round: p.round, raceName: p.raceName };
    for (const t of teams) point[t.name] = sumFor(t.memberNames, p);
    return point;
  });

  const totalsByDriver: Record<string, number> = {};
  for (const t of teams) totalsByDriver[t.name] = sumFor(t.memberNames, full.totalsByDriver);

  return {
    data,
    drivers: teams.map(t => ({ name: t.name, team: t.feedTeam })),
    totalsByDriver,
  };
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

/**
 * Constructors' cumulative-points trend, one line per team (operator ask,
 * 2026-08-20: "chart for constructors standings would be good").
 *
 * Built by walking `buildStandingsAtRound` round by round rather than summing
 * driver lines: that function attributes points PER RACE ENTRY, so a
 * mid-season seat swap lands on the team the driver actually scored for, and
 * the final round's values are the same numbers the constructors table shows —
 * the chart-vs-standings invariant (CHANGELOG header) holds by construction
 * rather than by luck. `aggregateTeamsTrend` deliberately isn't reused here:
 * its own docstring rules it out for championship math.
 *
 * Shaped as SeasonTrendData so it renders through the existing chart: teams
 * occupy the `drivers` slot, with `team` set to the same string so the chart's
 * F1 team-colour map resolves. Empty `data` when no round has team points
 * (series whose results carry no team strings) — the caller hides the chart.
 */
export function buildConstructorsTrendData(
  races: RaceResult[],
  extras: RaceResult[] = [],
): SeasonTrendData {
  const sorted = [...races].sort((a, b) => a.round - b.round);
  const rounds = [...new Set(sorted.map(r => r.round))].sort((a, b) => a - b);

  const snapshots = rounds.map(round => ({
    round,
    raceName: sorted.find(r => r.round === round)?.raceName ?? `Round ${round}`,
    standings: buildStandingsAtRound(races, round, extras).constructors,
  }));

  const names: string[] = [];
  for (const s of snapshots) {
    for (const c of s.standings) if (!names.includes(c.name)) names.push(c.name);
  }
  if (names.length === 0) return { data: [], drivers: [], totalsByDriver: {} };

  const data: SeasonTrendPoint[] = snapshots.map(s => {
    const point: SeasonTrendPoint = { round: s.round, raceName: s.raceName };
    const byName = new Map(s.standings.map(c => [c.name, c.points]));
    for (const n of names) point[n] = byName.get(n) ?? 0;
    return point;
  });

  const last = data[data.length - 1];
  const totalsByDriver: Record<string, number> = {};
  for (const n of names) totalsByDriver[n] = Number(last?.[n]) || 0;

  return {
    data,
    // `team: n` so the chart resolves each line's team colour by the same key.
    drivers: names.map(n => ({ name: n, team: n })),
    totalsByDriver,
  };
}
