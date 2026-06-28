import { describe, it, expect } from 'vitest';
import { fastestLapsByDriver } from './laps';
import type { OF1Lap } from './types';

function lap(
  p: Partial<OF1Lap> & { driver_number: number; lap_number: number },
): OF1Lap {
  return {
    duration_sector_1: null,
    duration_sector_2: null,
    duration_sector_3: null,
    i1_speed: null,
    i2_speed: null,
    st_speed: null,
    is_pit_out_lap: false,
    date_start: null,
    segments_sector_1: null,
    segments_sector_2: null,
    segments_sector_3: null,
    lap_duration: null,
    session_key: 1,
    ...p,
  };
}

describe('fastestLapsByDriver', () => {
  it("picks each driver's fastest timed, non-pit-out lap", () => {
    const best = fastestLapsByDriver([
      lap({ driver_number: 16, lap_number: 1, lap_duration: 80, is_pit_out_lap: true }),
      lap({ driver_number: 16, lap_number: 2, lap_duration: 71.5 }),
      lap({ driver_number: 16, lap_number: 3, lap_duration: 70.27, date_start: '2024-05-25T14:58:18.527000+00:00' }),
      lap({ driver_number: 1, lap_number: 2, lap_duration: 70.6 }),
      lap({ driver_number: 1, lap_number: 3, lap_duration: null }),
    ]);
    expect(best.get(16)?.lapNumber).toBe(3);
    expect(best.get(16)?.lapDuration).toBeCloseTo(70.27, 2);
    expect(best.get(1)?.lapNumber).toBe(2);
    expect(best.size).toBe(2);
  });

  it('ignores drivers with only pit-out or untimed laps', () => {
    const best = fastestLapsByDriver([
      lap({ driver_number: 99, lap_number: 1, lap_duration: 90, is_pit_out_lap: true }),
      lap({ driver_number: 99, lap_number: 2, lap_duration: null }),
    ]);
    expect(best.has(99)).toBe(false);
  });
});
