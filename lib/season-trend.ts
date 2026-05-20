import type { RaceResult, RaceResultEntry } from './types';

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
