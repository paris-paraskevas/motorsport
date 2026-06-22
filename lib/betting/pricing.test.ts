import { describe, it, expect } from 'vitest';
import { winProbabilities, winMultipliers, multiplierFromProb } from './pricing';

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

  it('longshots pay more than favourites (the core requirement)', () => {
    const m = winMultipliers(field);
    // Bottas (8 pts) must pay a bigger multiplier than Antonelli (250 pts).
    expect(m.Bottas).toBeGreaterThan(m.Antonelli);
    // every multiplier returns something
    expect(m.Antonelli).toBeGreaterThan(1);
    expect(m.Bottas).toBeGreaterThan(m.Russell);
  });

  it('multiplier is inverse-probability with margin, floored at 1.01', () => {
    expect(multiplierFromProb(0.5)).toBeCloseTo(1.8, 2); // (1-0.1)/0.5
    expect(multiplierFromProb(0.999)).toBe(1.01); // favourite floor
    expect(multiplierFromProb(0.001)).toBeGreaterThan(100); // extreme longshot
  });
});
