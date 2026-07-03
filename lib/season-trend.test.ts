import { describe, it, expect } from 'vitest';
import {
  aggregateTeamsTrend,
  buildSeasonTrendData,
  buildStandingsAtRound,
} from './season-trend';
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

describe('aggregateTeamsTrend', () => {
  const races: RaceResult[] = [
    race(1, 'GP1', [
      { driverName: 'A1', team: 'Alpha', points: 25 },
      { driverName: 'B1', team: 'Beta', points: 18 },
      { driverName: 'A2', team: 'Alpha', points: 15 },
      { driverName: 'B2', team: 'Beta', points: 12 },
    ]),
    race(2, 'GP2', [
      { driverName: 'B1', team: 'Beta', points: 25 },
      { driverName: 'A1', team: 'Alpha', points: 18 },
      { driverName: 'B2', team: 'Beta', points: 15 },
      { driverName: 'A2', team: 'Alpha', points: 12 },
    ]),
  ];
  const full = buildSeasonTrendData(races);
  const teams = [
    { name: 'Alpha Racing', feedTeam: 'Alpha', memberNames: ['A1', 'A2'] },
    { name: 'Beta Racing', feedTeam: 'Beta', memberNames: ['B1', 'B2'] },
  ];

  it('sums member drivers cumulative points per round', () => {
    const agg = aggregateTeamsTrend(full, teams);
    expect(agg.data).toHaveLength(2);
    expect(agg.data[0]).toMatchObject({ round: 1, 'Alpha Racing': 40, 'Beta Racing': 30 });
    expect(agg.data[1]).toMatchObject({ round: 2, 'Alpha Racing': 70, 'Beta Racing': 70 });
  });

  it('totals equal the last data point and the summed member totals', () => {
    const agg = aggregateTeamsTrend(full, teams);
    expect(agg.totalsByDriver).toEqual({ 'Alpha Racing': 70, 'Beta Racing': 70 });
    expect(agg.data[agg.data.length - 1]['Alpha Racing']).toBe(agg.totalsByDriver['Alpha Racing']);
  });

  it('carries the feed team name for chart color resolution', () => {
    const agg = aggregateTeamsTrend(full, teams);
    expect(agg.drivers).toEqual([
      { name: 'Alpha Racing', team: 'Alpha' },
      { name: 'Beta Racing', team: 'Beta' },
    ]);
  });

  it('treats unknown member keys as zero and empty membership as a flat zero line', () => {
    const agg = aggregateTeamsTrend(full, [
      { name: 'Ghost Team', memberNames: ['Nobody'] },
      { name: 'Empty Team', memberNames: [] },
    ]);
    expect(agg.data[1]).toMatchObject({ 'Ghost Team': 0, 'Empty Team': 0 });
    expect(agg.totalsByDriver).toEqual({ 'Ghost Team': 0, 'Empty Team': 0 });
  });
});

describe('buildStandingsAtRound', () => {
  const races: RaceResult[] = [
    race(1, 'Round One', [
      { driverName: 'Driver A', team: 'Team A', points: 25 },
      { driverName: 'Driver B', team: 'Team B', points: 18 },
    ]),
    race(2, 'Round Two', [
      { driverName: 'Driver B', team: 'Team B', points: 25 },
      { driverName: 'Driver A', team: 'Team A', points: 18 },
    ]),
    race(3, 'Round Three', [
      { driverName: 'Driver A', team: 'Team A', points: 25 },
      { driverName: 'Driver B', team: 'Team B', points: 18 },
    ]),
  ];

  it('freezes the table at the requested round', () => {
    const snap = buildStandingsAtRound(races, 2);
    expect(snap.throughRound).toBe(2);
    expect(snap.drivers[0]).toMatchObject({ position: 1, driverName: 'Driver A', points: 43, wins: 1 });
    expect(snap.drivers[1]).toMatchObject({ position: 2, driverName: 'Driver B', points: 43, wins: 1 });
    expect(snap.constructors[0]).toMatchObject({ name: 'Team A', points: 43 });
  });

  it('ranks by points then wins', () => {
    const snap = buildStandingsAtRound(races, 3);
    // A: 68pts 2 wins; B: 61pts 1 win
    expect(snap.drivers[0]).toMatchObject({ driverName: 'Driver A', points: 68, wins: 2, position: 1 });
    expect(snap.drivers[1]).toMatchObject({ driverName: 'Driver B', points: 61, position: 2 });
  });

  it('folds sprint extras into points but not wins', () => {
    const sprint = [
      race(2, 'Round Two Sprint', [
        { driverName: 'Driver B', team: 'Team B', points: 8 },
      ]),
    ];
    const snap = buildStandingsAtRound(races, 2, sprint);
    expect(snap.drivers[0]).toMatchObject({ driverName: 'Driver B', points: 51, wins: 1 });
    expect(snap.constructors.find(c => c.name === 'Team B')?.points).toBe(51);
  });

  it('reports the round actually counted when later results are missing', () => {
    const snap = buildStandingsAtRound(races, 7);
    expect(snap.throughRound).toBe(3);
  });

  it('returns empty tables before any counted round', () => {
    const snap = buildStandingsAtRound(races, 0);
    expect(snap.drivers).toHaveLength(0);
    expect(snap.constructors).toHaveLength(0);
    expect(snap.throughRound).toBe(0);
  });
});
