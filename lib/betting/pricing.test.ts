import { describe, it, expect } from 'vitest';
import {
  winProbabilities, winMultipliers, multiplierFromProb,
  MIN_MULTIPLIER, MAX_MULTIPLIER, HOUSE_MARGIN,
} from './pricing';

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
