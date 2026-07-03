import { describe, it, expect } from 'vitest';
import { deriveIntervals } from './openf1';

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
