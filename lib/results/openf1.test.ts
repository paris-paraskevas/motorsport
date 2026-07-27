import { describe, it, expect } from 'vitest';
import { deriveIntervals, hasResolvedDrivers } from './openf1';

// gap_to_leader shapes observed live from OpenF1 (see the module header):
// numbers for timed rows, "+N LAP" strings for lapped cars, null for the
// leader and for DNF/DNS rows, [Q1, Q2, Q3] arrays in qualifying.
describe('deriveIntervals', () => {
  it('derives car-ahead deltas from consecutive leader gaps', () => {
    expect(deriveIntervals([null, 1.2, 3.45])).toEqual([
      null,
      '+1.200',
      '+2.250',
    ]);
  });

  it('treats a numeric 0 leader gap as the baseline', () => {
    expect(deriveIntervals([0, 0.5])).toEqual([null, '+0.500']);
  });

  it('marks lapped rows and the row behind them as underivable', () => {
    expect(deriveIntervals([null, 10, '+1 LAP', '+2 LAPS'])).toEqual([
      null,
      '+10.000',
      null,
      null,
    ]);
  });

  it('marks DNF rows (null gap mid-field) and their followers as underivable', () => {
    expect(deriveIntervals([null, 5, null, 20])).toEqual([
      null,
      '+5.000',
      null,
      null,
    ]);
  });

  it('does not treat a mid-field null as a zero gap', () => {
    // Only the front row's null means "leader"; further down it means the
    // timing feed has nothing for that car.
    expect(deriveIntervals([null, null])).toEqual([null, null]);
  });

  it('returns all-null for qualifying-style per-segment arrays', () => {
    expect(
      deriveIntervals([
        [71.2, 70.9, 70.1],
        [71.5, 71.0, 70.4],
      ]),
    ).toEqual([null, null]);
  });

  it('never invents a negative interval from out-of-order data', () => {
    expect(deriveIntervals([null, 5, 3])).toEqual([null, '+5.000', null]);
  });

  it('renders a genuine dead-heat delta as +0.000', () => {
    expect(deriveIntervals([null, 2.5, 2.5])).toEqual([
      null,
      '+2.500',
      '+0.000',
    ]);
  });

  it('handles empty and single-row inputs', () => {
    expect(deriveIntervals([])).toEqual([]);
    expect(deriveIntervals([null])).toEqual([null]);
  });
});

// The cache gate that stops a half-failed classification being frozen into KV
// for its 7-day TTL. Reproduces the payload found cached for the 2026 Hungarian
// GP: correct timing, but every driver reduced to a bare car number because the
// parallel /drivers call was throttled to [].
describe('hasResolvedDrivers', () => {
  const entry = (driverName: string) => ({ position: 1, driverName, team: '' });

  it('rejects the nameless payload that was cached for Hungary', () => {
    expect(
      hasResolvedDrivers({
        isQualifying: false,
        isRace: true,
        entries: [entry('#1'), entry('#3'), entry('#12')],
      }),
    ).toBe(false);
  });

  it('accepts a classification with real driver names', () => {
    expect(
      hasResolvedDrivers({
        isQualifying: false,
        isRace: true,
        entries: [entry('Lando Norris'), entry('#3')],
      }),
    ).toBe(true);
  });

  it('rejects null and empty classifications', () => {
    expect(hasResolvedDrivers(null)).toBe(false);
    expect(hasResolvedDrivers({ isQualifying: false, isRace: true, entries: [] })).toBe(false);
  });

  it('does not mistake a name containing a number for a placeholder', () => {
    expect(
      hasResolvedDrivers({
        isQualifying: false,
        isRace: false,
        entries: [entry('Car #44 Mercedes')],
      }),
    ).toBe(true);
  });
});
