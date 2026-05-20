import { describe, it, expect } from 'vitest';
import { buildSeasonTrendData } from './season-trend';
import type { RaceResult } from './types';

function race(
  round: number,
  raceName: string,
  results: Array<{ driverName: string; team: string; points: number; code?: string }>,
): RaceResult {
  return {
    round,
    raceName,
    date: new Date(`2026-${String(round).padStart(2, '0')}-01T00:00:00Z`),
    circuit: `${raceName} Circuit`,
    results: results.map((r, idx) => ({
      position: idx + 1,
      driverName: r.driverName,
      driverCode: r.code,
      team: r.team,
      status: 'Finished',
      points: r.points,
    })),
  };
}

describe('buildSeasonTrendData', () => {
  it('accumulates running totals per round per driver', () => {
    const races: RaceResult[] = [
      race(1, 'Round One', [
        { driverName: 'Driver A', team: 'Team A', points: 25, code: 'AAA' },
        { driverName: 'Driver B', team: 'Team B', points: 18, code: 'BBB' },
      ]),
      race(2, 'Round Two', [
        { driverName: 'Driver B', team: 'Team B', points: 25 },
        { driverName: 'Driver A', team: 'Team A', points: 18 },
      ]),
    ];
    const trend = buildSeasonTrendData(races);
    expect(trend.data).toHaveLength(2);
    expect(trend.data[0]).toMatchObject({ round: 1, 'Driver A': 25, 'Driver B': 18 });
    expect(trend.data[1]).toMatchObject({ round: 2, 'Driver A': 43, 'Driver B': 43 });
    expect(trend.totalsByDriver).toEqual({ 'Driver A': 43, 'Driver B': 43 });
  });

  it('folds extras (sprints) into the same round without adding x-axis ticks', () => {
    const races: RaceResult[] = [
      race(1, 'GP1', [{ driverName: 'A', team: 'X', points: 25 }]),
      race(2, 'GP2', [{ driverName: 'A', team: 'X', points: 18 }]),
      race(3, 'GP3', [{ driverName: 'A', team: 'X', points: 15 }]),
    ];
    const sprints: RaceResult[] = [
      // Sprint at round 2 only
      race(2, 'GP2 Sprint', [{ driverName: 'A', team: 'X', points: 8 }]),
    ];
    const trend = buildSeasonTrendData(races, sprints);
    expect(trend.data).toHaveLength(3); // 3 x-axis ticks, NOT 4
    expect(trend.data[0]['A']).toBe(25);
    expect(trend.data[1]['A']).toBe(25 + 18 + 8); // sprint folded in
    expect(trend.data[2]['A']).toBe(25 + 18 + 8 + 15);
    expect(trend.totalsByDriver['A']).toBe(66);
  });

  it('registers drivers that appear only in extras (sprint-only finishers)', () => {
    const races: RaceResult[] = [
      race(1, 'GP1', [{ driverName: 'Race-only', team: 'X', points: 25 }]),
    ];
    const sprints: RaceResult[] = [
      race(1, 'GP1 Sprint', [
        { driverName: 'Race-only', team: 'X', points: 8 },
        // This driver scored sprint points but didn't classify in the race
        { driverName: 'Sprint-only', team: 'Y', points: 1 },
      ]),
    ];
    const trend = buildSeasonTrendData(races, sprints);
    const driverNames = trend.drivers.map(d => d.name);
    expect(driverNames).toContain('Race-only');
    expect(driverNames).toContain('Sprint-only');
    expect(trend.totalsByDriver['Sprint-only']).toBe(1);
  });

  it('handles empty extras gracefully (default arg)', () => {
    const races: RaceResult[] = [
      race(1, 'GP1', [{ driverName: 'A', team: 'X', points: 25 }]),
    ];
    const trend = buildSeasonTrendData(races);
    expect(trend.data).toHaveLength(1);
    expect(trend.totalsByDriver['A']).toBe(25);
  });

  it('sorts by round even when extras arrive out of order', () => {
    const races: RaceResult[] = [
      race(3, 'GP3', [{ driverName: 'A', team: 'X', points: 25 }]),
      race(1, 'GP1', [{ driverName: 'A', team: 'X', points: 18 }]),
      race(2, 'GP2', [{ driverName: 'A', team: 'X', points: 15 }]),
    ];
    const sprints: RaceResult[] = [
      race(2, 'GP2 Sprint', [{ driverName: 'A', team: 'X', points: 8 }]),
    ];
    const trend = buildSeasonTrendData(races, sprints);
    expect(trend.data[0].round).toBe(1);
    expect(trend.data[1].round).toBe(2);
    expect(trend.data[2].round).toBe(3);
    expect(trend.data[1]['A']).toBe(18 + 15 + 8);
  });
});
