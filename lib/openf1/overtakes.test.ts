import { describe, it, expect } from 'vitest';
import { overtakesByDriver } from './overtakes';
import type { OF1Overtake } from './types';

function ot(
  overtaking_driver_number: number,
  overtaken_driver_number: number,
  position = 5,
): OF1Overtake {
  return {
    date: '2024-01-01T12:00:00+00:00',
    overtaking_driver_number,
    overtaken_driver_number,
    position,
    session_key: 1,
  };
}

describe('overtakesByDriver', () => {
  it('counts overtakes per overtaking driver', () => {
    const counts = overtakesByDriver([
      ot(4, 16),
      ot(4, 1),
      ot(4, 11),
      ot(44, 63),
    ]);
    expect(counts.get(4)).toBe(3);
    expect(counts.get(44)).toBe(1);
    expect(counts.has(16)).toBe(false); // 16 was overtaken, never overtaking
    expect(counts.size).toBe(2);
  });

  it('returns an empty map for no overtakes', () => {
    expect(overtakesByDriver([]).size).toBe(0);
  });
});
