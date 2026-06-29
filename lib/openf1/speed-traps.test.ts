import { describe, it, expect } from 'vitest';
import { topSpeedByDriver } from './speed-traps';
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

describe('topSpeedByDriver', () => {
  it('takes the max trap reading across a driver\'s laps', () => {
    const best = topSpeedByDriver([
      lap({ driver_number: 1, lap_number: 1, i1_speed: 300, i2_speed: 310, st_speed: 330 }),
      lap({ driver_number: 1, lap_number: 2, i1_speed: 320, i2_speed: 315, st_speed: 345 }),
      lap({ driver_number: 16, lap_number: 1, st_speed: 340 }),
    ]);
    expect(best.get(1)?.topSpeed).toBe(345);
    expect(best.get(1)?.lapNumber).toBe(2); // top speed set on lap 2
    expect(best.get(16)?.topSpeed).toBe(340);
    expect(best.size).toBe(2);
  });

  it('ignores nulls and laps with no trap reading', () => {
    const best = topSpeedByDriver([
      lap({ driver_number: 4, lap_number: 1 }), // all-null speeds
      lap({ driver_number: 4, lap_number: 2, i2_speed: 290 }),
      lap({ driver_number: 99, lap_number: 1, i1_speed: 0, i2_speed: 0, st_speed: 0 }),
    ]);
    expect(best.get(4)?.topSpeed).toBe(290);
    expect(best.has(99)).toBe(false); // zero is not a reading
  });

  it('returns an empty map for no laps', () => {
    expect(topSpeedByDriver([]).size).toBe(0);
  });
});
