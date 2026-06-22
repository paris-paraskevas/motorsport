import { describe, it, expect } from 'vitest';
import {
  winProbabilities, winMultipliers, multiplierFromProb,
  podiumProbabilities, podiumMultipliers,
  topKProbabilities, topTenMultipliers,
  positionProbabilities, exactPositionMultipliers,
  MIN_MULTIPLIER, MAX_MULTIPLIER, HOUSE_MARGIN, PODIUM_SLOTS,
} from './pricing';
import { parseExactPositionOdds } from './constants';

const field = [
  { name: 'Antonelli', points: 250 },
  { name: 'Russell', points: 120 },
  { name: 'Bottas', points: 8 },
];

describe('pricing model', () => {
  it('probabilities sum to ~1 and rank with points', () => {
    const p = winProbabilities(field);
    const sum = [...p.values()].reduce((s, x) => s + x, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(p.get('Antonelli')!).toBeGreaterThan(p.get('Russell')!);
    expect(p.get('Russell')!).toBeGreaterThan(p.get('Bottas')!);
  });

  it('longshots pay more than favourites, every price inside the [min,max] band', () => {
    const m = winMultipliers(field);
    expect(m.Bottas).toBeGreaterThan(m.Antonelli); // the core requirement
    expect(m.Bottas).toBeGreaterThan(m.Russell);
    for (const v of Object.values(m)) {
      expect(v).toBeGreaterThanOrEqual(MIN_MULTIPLIER);
      expect(v).toBeLessThanOrEqual(MAX_MULTIPLIER);
    }
  });

  it('caps longshots and floors the favourite (no 900x, no ~1x)', () => {
    // an extreme longshot is capped, not paid a four-figure jackpot
    expect(multiplierFromProb(1e-6)).toBe(MAX_MULTIPLIER);
    // a near-certain favourite is floored, not paid a meaningless ~1x
    expect(multiplierFromProb(0.999)).toBe(MIN_MULTIPLIER);
    // a mid probability is the honest inverse-with-margin, inside the band
    expect(multiplierFromProb(0.5)).toBeCloseTo((1 - HOUSE_MARGIN) / 0.5, 2);
  });

  it('a flat field (equal points) prices everyone identically', () => {
    const flat = winMultipliers([
      { name: 'A', points: 10 },
      { name: 'B', points: 10 },
      { name: 'C', points: 10 },
    ]);
    expect(flat.A).toBe(flat.B);
    expect(flat.B).toBe(flat.C);
  });
});

describe('podium pricing (Harville top-3)', () => {
  const grid = [
    { name: 'A', points: 200 },
    { name: 'B', points: 150 },
    { name: 'C', points: 120 },
    { name: 'D', points: 80 },
    { name: 'E', points: 40 },
    { name: 'F', points: 5 },
  ];

  it('probabilities sum to the number of podium slots and rank with points', () => {
    const p = podiumProbabilities(grid);
    const sum = [...p.values()].reduce((s, x) => s + x, 0);
    expect(sum).toBeCloseTo(PODIUM_SLOTS, 3);
    expect(p.get('A')!).toBeGreaterThan(p.get('B')!);
    expect(p.get('E')!).toBeGreaterThan(p.get('F')!);
    expect(p.get('A')!).toBeLessThanOrEqual(1);
  });

  it('a podium is likelier than the win, so it pays less — and stays in the band', () => {
    const win = winProbabilities(grid);
    const pod = podiumProbabilities(grid);
    expect(pod.get('A')!).toBeGreaterThan(win.get('A')!);
    const m = podiumMultipliers(grid);
    for (const v of Object.values(m)) {
      expect(v).toBeGreaterThanOrEqual(MIN_MULTIPLIER);
      expect(v).toBeLessThanOrEqual(MAX_MULTIPLIER);
    }
  });

  it('a field of three-or-fewer makes every driver a certain podium', () => {
    const p = podiumProbabilities([
      { name: 'A', points: 10 },
      { name: 'B', points: 5 },
      { name: 'C', points: 1 },
    ]);
    expect(p.get('A')!).toBeCloseTo(1, 6);
    expect(p.get('C')!).toBeCloseTo(1, 6);
  });
});

describe('top-K pricing (mean-field PL)', () => {
  // 22-car grid, points descending and close at the front (no single runaway).
  const grid = Array.from({ length: 22 }, (_, i) => ({ name: `D${i}`, points: Math.max(220 - i * 11, 0) }));

  it('is exact for K=1 (equals the win probability)', () => {
    const k1 = topKProbabilities(grid, 1);
    const win = winProbabilities(grid);
    for (const name of win.keys()) expect(k1.get(name)!).toBeCloseTo(win.get(name)!, 9);
  });

  it('top-10 favours form, stays bounded, and covers ~10 slots', () => {
    const p = topKProbabilities(grid, 10);
    // top-10 saturates near 1 across the strong front, so only compare drivers
    // far apart in form: a frontrunner beats a backmarker; the tail still orders.
    expect(p.get('D0')!).toBeGreaterThan(p.get('D20')!);
    expect(p.get('D18')!).toBeGreaterThan(p.get('D21')!);
    for (const v of p.values()) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    const sum = [...p.values()].reduce((s, x) => s + x, 0);
    expect(sum).toBeGreaterThan(9);
    expect(sum).toBeLessThanOrEqual(10.0001);
  });

  it('a midfielder makes the top-10 at least as easily as the podium, and prices in band', () => {
    expect(topKProbabilities(grid, 10).get('D8')!).toBeGreaterThanOrEqual(podiumProbabilities(grid).get('D8')!);
    const m = topTenMultipliers(grid);
    for (const v of Object.values(m)) {
      expect(v).toBeGreaterThanOrEqual(MIN_MULTIPLIER);
      expect(v).toBeLessThanOrEqual(MAX_MULTIPLIER);
    }
  });
});

describe('exact-position pricing (finishing-position distribution)', () => {
  const grid = Array.from({ length: 12 }, (_, i) => ({ name: `D${i}`, points: 240 - i * 20 }));

  it('each finishing position sums to 1 across the field, every prob bounded', () => {
    const rows = [...positionProbabilities(grid).values()];
    // the meaningful invariant: each position (column) is filled by exactly one
    // driver, so probabilities sum to 1 across the field. (Row sums are ~1 but
    // not exact — the mean-field normalises columns, not rows.)
    for (let pos = 0; pos < grid.length; pos++) {
      const col = rows.reduce((s, ps) => s + ps[pos], 0);
      expect(col).toBeCloseTo(1, 6);
    }
    for (const ps of rows) for (const p of ps) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('position 1 equals the win probability', () => {
    const dist = positionProbabilities(grid);
    const win = winProbabilities(grid);
    for (const [name, ps] of dist) expect(ps[0]).toBeCloseTo(win.get(name)!, 9);
  });

  it('the favourite peaks at P1; the leader is likelier P1 than a backmarker', () => {
    const dist = positionProbabilities(grid);
    expect(dist.get('D0')![0]).toBeGreaterThan(dist.get('D0')![5]);
    expect(dist.get('D0')![0]).toBeGreaterThan(dist.get('D11')![0]);
  });

  it('prices every (driver, position) pair in the band, keyed driver@position', () => {
    const m = exactPositionMultipliers(grid);
    expect(Object.keys(m).length).toBe(grid.length * grid.length);
    expect(m['D0@1']).toBeGreaterThanOrEqual(MIN_MULTIPLIER);
    for (const v of Object.values(m)) {
      expect(v).toBeGreaterThanOrEqual(MIN_MULTIPLIER);
      expect(v).toBeLessThanOrEqual(MAX_MULTIPLIER);
    }
  });

  it('its odds map round-trips through the UI parser (parseExactPositionOdds)', () => {
    const small = [
      { name: 'A', points: 100 },
      { name: 'B', points: 50 },
      { name: 'C', points: 10 },
    ];
    const { drivers, positions } = parseExactPositionOdds(exactPositionMultipliers(small));
    expect(drivers).toEqual(['A', 'B', 'C']); // favourite-first by win odds
    expect(positions).toEqual([1, 2, 3]);
  });
});
