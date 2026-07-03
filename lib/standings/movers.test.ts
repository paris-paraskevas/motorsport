import { describe, expect, it } from 'vitest';
import { computeMovers } from './movers';
import type { SeasonTrendData } from '@/lib/season-trend';

// Build a minimal SeasonTrendData: drivers + per-round cumulative snapshots.
function trend(
  drivers: string[],
  rounds: Array<Record<string, number>>,
): SeasonTrendData {
  return {
    drivers: drivers.map(name => ({ name })),
    data: rounds.map((pts, i) => ({ round: i + 1, raceName: `R${i + 1}`, ...pts })),
    totalsByDriver: rounds.length ? { ...rounds[rounds.length - 1] } : {},
  };
}

describe('computeMovers', () => {
  it('returns [] for an empty trend', () => {
    expect(computeMovers(trend(['A', 'B'], []))).toEqual([]);
  });

  it('gives every driver delta:null with only one round (no prior to compare)', () => {
    const m = computeMovers(trend(['A', 'B'], [{ A: 25, B: 18 }]));
    expect(m.map(x => x.delta)).toEqual([null, null]);
    expect(m.map(x => x.name)).toEqual(['A', 'B']); // ranked by points
  });

  it('computes rank change between the last two rounds (+ climbed, - dropped)', () => {
    // After R1: A=25 (P1), B=18 (P2), C=15 (P3).
    // After R2: C=55 (P1), A=40 (P2), B=20 (P3). C climbed P3→P1 (+2), A P1→P2 (-1), B P2→P3 (-1).
    const m = computeMovers(
      trend(['A', 'B', 'C'], [
        { A: 25, B: 18, C: 15 },
        { A: 40, B: 20, C: 55 },
      ]),
    );
    const byName = Object.fromEntries(m.map(x => [x.name, x]));
    expect(byName.C).toMatchObject({ rank: 1, delta: 2, points: 55 });
    expect(byName.A).toMatchObject({ rank: 2, delta: -1 });
    expect(byName.B).toMatchObject({ rank: 3, delta: -1 });
    // returned best-rank-first
    expect(m.map(x => x.name)).toEqual(['C', 'A', 'B']);
  });

  it('reports delta 0 for a driver who held position', () => {
    const m = computeMovers(
      trend(['A', 'B'], [
        { A: 25, B: 10 },
        { A: 50, B: 20 },
      ]),
    );
    expect(m.every(x => x.delta === 0)).toBe(true);
  });

  it('only compares the LAST two rounds, ignoring earlier ones', () => {
    const m = computeMovers(
      trend(['A', 'B'], [
        { A: 5, B: 40 }, // R1: B leads
        { A: 30, B: 45 }, // R2: B still leads
        { A: 80, B: 50 }, // R3: A overtakes → A +1, B -1
      ]),
    );
    const byName = Object.fromEntries(m.map(x => [x.name, x]));
    expect(byName.A).toMatchObject({ rank: 1, delta: 1 });
    expect(byName.B).toMatchObject({ rank: 2, delta: -1 });
  });
});
