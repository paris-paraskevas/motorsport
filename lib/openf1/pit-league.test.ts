import { describe, it, expect } from 'vitest';
import { pitStopsByDriver } from './pit-league';
import type { OF1Pit } from './types';

function pit(
  p: Partial<OF1Pit> & { driver_number: number },
): OF1Pit {
  return {
    date: '2024-01-01T12:00:00+00:00',
    lap_number: 1,
    session_key: 1,
    ...p,
  };
}

describe('pitStopsByDriver', () => {
  it('tracks fastest stop + count per driver', () => {
    const byDriver = pitStopsByDriver([
      pit({ driver_number: 1, lap_number: 12, stop_duration: 2.6 }),
      pit({ driver_number: 1, lap_number: 30, stop_duration: 2.3 }),
      pit({ driver_number: 16, lap_number: 14, stop_duration: 2.9 }),
    ]);
    expect(byDriver.get(1)?.fastestStop).toBeCloseTo(2.3, 2);
    expect(byDriver.get(1)?.stopCount).toBe(2);
    expect(byDriver.get(1)?.fastestStopLap).toBe(30);
    expect(byDriver.get(16)?.stopCount).toBe(1);
  });

  it('falls back to pit_duration and skips rows with no stationary time', () => {
    const byDriver = pitStopsByDriver([
      pit({ driver_number: 4, lap_number: 10, stop_duration: null, pit_duration: 24.5 }),
      pit({ driver_number: 4, lap_number: 11 }), // no duration at all → skipped
      pit({ driver_number: 7, lap_number: 9, stop_duration: 0 }), // 0 is not a stop
    ]);
    expect(byDriver.get(4)?.fastestStop).toBeCloseTo(24.5, 2);
    expect(byDriver.get(4)?.stopCount).toBe(1);
    expect(byDriver.has(7)).toBe(false);
  });

  it('returns an empty map for no pit rows', () => {
    expect(pitStopsByDriver([]).size).toBe(0);
  });
});
