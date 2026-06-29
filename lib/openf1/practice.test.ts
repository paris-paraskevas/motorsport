import { describe, it, expect } from 'vitest';
import { fastestLapByDriver, longRunsByDriver } from './practice';
import type { OF1Lap, OF1Stint } from './types';

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

function stint(
  p: Partial<OF1Stint> & {
    driver_number: number;
    stint_number: number;
    lap_start: number;
    lap_end: number;
  },
): OF1Stint {
  return {
    compound: null,
    tyre_age_at_start: null,
    session_key: 1,
    ...p,
  };
}

describe('fastestLapByDriver', () => {
  it("picks each driver's fastest timed, non-pit-out lap", () => {
    const best = fastestLapByDriver([
      lap({ driver_number: 16, lap_number: 1, lap_duration: 95, is_pit_out_lap: true }),
      lap({ driver_number: 16, lap_number: 2, lap_duration: 80.4 }),
      lap({ driver_number: 16, lap_number: 3, lap_duration: 79.91 }),
      lap({ driver_number: 1, lap_number: 2, lap_duration: 80.1 }),
      lap({ driver_number: 1, lap_number: 3, lap_duration: null }),
    ]);
    expect(best.get(16)?.lapNumber).toBe(3);
    expect(best.get(16)?.lapDuration).toBeCloseTo(79.91, 2);
    expect(best.get(1)?.lapNumber).toBe(2);
    expect(best.size).toBe(2);
  });

  it('ignores drivers with only pit-out or untimed laps', () => {
    const best = fastestLapByDriver([
      lap({ driver_number: 99, lap_number: 1, lap_duration: 90, is_pit_out_lap: true }),
      lap({ driver_number: 99, lap_number: 2, lap_duration: null }),
    ]);
    expect(best.has(99)).toBe(false);
  });
});

describe('longRunsByDriver — green-lap average + outlier filter', () => {
  it('averages only green laps within 107% of the driver best, excluding in/out + traffic laps', () => {
    // Driver 4, one stint (laps 1-6 on MEDIUM). Best green lap = 80.0.
    // Ceiling = 80.0 * 1.07 = 85.6. Lap 1 is the out-lap (pit-out, excluded),
    // lap 6 is an in-lap / traffic lap at 92.0 (> ceiling, excluded). The four
    // green laps are 80.0, 80.5, 81.0, 80.5 → mean 80.5.
    const laps: OF1Lap[] = [
      lap({ driver_number: 4, lap_number: 1, lap_duration: 110.0, is_pit_out_lap: true }),
      lap({ driver_number: 4, lap_number: 2, lap_duration: 80.0 }),
      lap({ driver_number: 4, lap_number: 3, lap_duration: 80.5 }),
      lap({ driver_number: 4, lap_number: 4, lap_duration: 81.0 }),
      lap({ driver_number: 4, lap_number: 5, lap_duration: 80.5 }),
      lap({ driver_number: 4, lap_number: 6, lap_duration: 92.0 }), // traffic/in-lap → outlier
    ];
    const stints: OF1Stint[] = [
      stint({ driver_number: 4, stint_number: 1, lap_start: 1, lap_end: 6, compound: 'MEDIUM' }),
    ];

    const result = longRunsByDriver(laps, stints);
    const lr = result.get(4);
    expect(lr).toBeTruthy();
    expect(lr?.stints).toHaveLength(1);

    const s = lr!.stints[0];
    expect(s.compound).toBe('MEDIUM');
    expect(s.greenLaps).toBe(4); // out-lap + traffic-lap excluded
    expect(s.avgGreenPace).toBeCloseTo(80.5, 5);
    expect(s.lapStart).toBe(1);
    expect(s.lapEnd).toBe(6);

    // Representative long run = this stint (>= 3 green laps).
    expect(lr?.best?.stintNumber).toBe(1);
    expect(lr?.best?.avgGreenPace).toBeCloseTo(80.5, 5);
    expect(lr?.compounds).toEqual(['MEDIUM']);
  });

  it('uses the longest qualifying stint as representative, tie-broken by faster average', () => {
    // Two stints. Stint 1 (SOFT, laps 1-4): green laps 90.0, 90.2, 90.1 → 3
    // green, avg ~90.1. Stint 2 (HARD, laps 5-10): 5 green laps avg ~91.0.
    // Stint 2 has more green laps, so it's the representative run even though
    // it's slower — long-run sample size wins.
    const laps: OF1Lap[] = [
      lap({ driver_number: 7, lap_number: 1, lap_duration: 120.0, is_pit_out_lap: true }),
      lap({ driver_number: 7, lap_number: 2, lap_duration: 90.0 }),
      lap({ driver_number: 7, lap_number: 3, lap_duration: 90.2 }),
      lap({ driver_number: 7, lap_number: 4, lap_duration: 90.1 }),
      lap({ driver_number: 7, lap_number: 5, lap_duration: 121.0, is_pit_out_lap: true }),
      lap({ driver_number: 7, lap_number: 6, lap_duration: 91.0 }),
      lap({ driver_number: 7, lap_number: 7, lap_duration: 91.2 }),
      lap({ driver_number: 7, lap_number: 8, lap_duration: 90.8 }),
      lap({ driver_number: 7, lap_number: 9, lap_duration: 91.1 }),
      lap({ driver_number: 7, lap_number: 10, lap_duration: 90.9 }),
    ];
    const stints: OF1Stint[] = [
      stint({ driver_number: 7, stint_number: 1, lap_start: 1, lap_end: 4, compound: 'SOFT' }),
      stint({ driver_number: 7, stint_number: 2, lap_start: 5, lap_end: 10, compound: 'HARD' }),
    ];

    const lr = longRunsByDriver(laps, stints).get(7);
    expect(lr?.stints).toHaveLength(2);
    expect(lr?.best?.stintNumber).toBe(2);
    expect(lr?.best?.greenLaps).toBe(5);
    expect(lr?.best?.avgGreenPace).toBeCloseTo((91.0 + 91.2 + 90.8 + 91.1 + 90.9) / 5, 5);
    expect(lr?.compounds).toEqual(['SOFT', 'HARD']);
  });

  it('leaves best = null when no stint reaches the long-run minimum (quali-sim only)', () => {
    // Two single push laps bracketed by in/out laps — no stint has >= 3 clean
    // laps, so there's no representative long run.
    const laps: OF1Lap[] = [
      lap({ driver_number: 11, lap_number: 1, lap_duration: 130.0, is_pit_out_lap: true }),
      lap({ driver_number: 11, lap_number: 2, lap_duration: 78.0 }),
      lap({ driver_number: 11, lap_number: 3, lap_duration: 140.0 }), // in-lap (outlier)
    ];
    const stints: OF1Stint[] = [
      stint({ driver_number: 11, stint_number: 1, lap_start: 1, lap_end: 3, compound: 'SOFT' }),
    ];

    const lr = longRunsByDriver(laps, stints).get(11);
    expect(lr).toBeTruthy();
    expect(lr?.best).toBeNull();
    expect(lr?.stints[0].greenLaps).toBe(1); // only the single push lap is green
  });

  it('falls back to pit-out-split contiguous runs when no /stints rows exist', () => {
    // No stint rows at all — grouping splits at the pit-out lap (lap 5).
    const laps: OF1Lap[] = [
      lap({ driver_number: 3, lap_number: 1, lap_duration: 125.0, is_pit_out_lap: true }),
      lap({ driver_number: 3, lap_number: 2, lap_duration: 85.0 }),
      lap({ driver_number: 3, lap_number: 3, lap_duration: 85.2 }),
      lap({ driver_number: 3, lap_number: 4, lap_duration: 85.1 }),
      lap({ driver_number: 3, lap_number: 5, lap_duration: 126.0, is_pit_out_lap: true }),
      lap({ driver_number: 3, lap_number: 6, lap_duration: 86.0 }),
      lap({ driver_number: 3, lap_number: 7, lap_duration: 86.1 }),
    ];

    const lr = longRunsByDriver(laps, []).get(3);
    expect(lr?.stints).toHaveLength(2); // split at lap 5's pit-out
    expect(lr?.stints[0].lapStart).toBe(1);
    expect(lr?.stints[0].lapEnd).toBe(4);
    expect(lr?.stints[1].lapStart).toBe(5);
    expect(lr?.stints[1].lapEnd).toBe(7);
    expect(lr?.stints[0].compound).toBeNull(); // unknown without /stints
    // Stint 1 has 3 green laps (out-lap excluded) and is the representative run.
    expect(lr?.best?.stintNumber).toBe(1);
    expect(lr?.best?.greenLaps).toBe(3);
  });
});
