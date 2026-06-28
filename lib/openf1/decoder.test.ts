import { describe, it, expect } from 'vitest';
import { computeDelta, type DriverTrace } from './decoder';

function trace(driverNumber: number, samples: { t: number; d: number }[]): DriverTrace {
  return {
    driverNumber,
    lapNumber: 1,
    lapTime: samples[samples.length - 1]?.t ?? 0,
    telemetry: samples.map(s => ({
      t: s.t,
      d: s.d,
      speed: 0,
      throttle: 0,
      brake: 0,
      gear: 0,
      drs: 0,
    })),
    track: null,
  };
}

describe('computeDelta', () => {
  it('is zero at the start and positive where B trails A', () => {
    // A ~100 km/h (27.78 m/s), B ~90 km/h (25 m/s) — B falls behind with distance
    const a = trace(1, [{ t: 0, d: 0 }, { t: 1, d: 27.78 }, { t: 2, d: 55.56 }]);
    const b = trace(2, [{ t: 0, d: 0 }, { t: 1, d: 25 }, { t: 2, d: 50 }]);
    const delta = computeDelta(a, b, 50);

    expect(delta).toHaveLength(51);
    expect(delta[0].delta).toBeCloseTo(0, 5);
    expect(delta[delta.length - 1].d).toBeCloseTo(50, 1);
    expect(delta[delta.length - 1].delta).toBeGreaterThan(0);
  });

  it('returns [] when a trace has no distance', () => {
    const a = trace(1, [{ t: 0, d: 0 }]);
    const b = trace(2, [{ t: 0, d: 0 }, { t: 1, d: 25 }]);
    expect(computeDelta(a, b)).toEqual([]);
  });
});
