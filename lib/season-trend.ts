import type { RaceResult } from './types';

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
 */
export function buildSeasonTrendData(races: RaceResult[]): SeasonTrendData {
  const sorted = [...races].sort((a, b) => a.round - b.round);

  const driverInfo = new Map<string, { code?: string; team?: string }>();
  for (const race of sorted) {
    for (const r of race.results) {
      if (!driverInfo.has(r.driverName)) {
        driverInfo.set(r.driverName, { code: r.driverCode, team: r.team });
      }
    }
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
    const snapshot: SeasonTrendPoint = { round: race.round, raceName: race.raceName };
    for (const d of drivers) snapshot[d.name] = running[d.name] ?? 0;
    return snapshot;
  });

  return { data, drivers, totalsByDriver: { ...running } };
}
