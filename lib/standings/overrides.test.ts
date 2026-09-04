import { describe, expect, it } from 'vitest';
import { applyDriverOverrides, applyConstructorOverrides } from './overrides';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';

// These helpers had no tests, and `pointsDelta` was added to them for a real
// event: on 2026-09-04 the FIA International Court of Appeal reinstated Pierre
// Gasly's two Monaco pit-lane penalties, three months after the race, moving
// five drivers in a season that is still running.
//
// The distinction that matters is absolute vs delta. A standings table
// ACCUMULATES, so writing "Hadjar 71" would have frozen him at his 4 September
// total for every remaining round. A delta stays correct as the season goes on.

const d = (position: number, driverName: string, points: number, wins = 0): DriverStanding => ({
  position,
  driverName,
  team: 'Some Team',
  points,
  wins,
});

// The real table after round 12, upstream, pre-appeal.
const F1_AFTER_R12: DriverStanding[] = [
  d(6, 'Max Verstappen', 112),
  d(7, 'Oscar Piastri', 104),
  d(8, 'Isack Hadjar', 68),
  d(9, 'Liam Lawson', 49),
  d(10, 'Pierre Gasly', 44),
  d(11, 'Arvid Lindblad', 23),
  d(12, 'Franco Colapinto', 19),
];

// Exactly what content/series/f1/standings-overrides.json carries.
const MONACO_ICA = [
  { driverName: 'Isack Hadjar', pointsDelta: 3 },
  { driverName: 'Oscar Piastri', pointsDelta: 2 },
  { driverName: 'Liam Lawson', pointsDelta: 2 },
  { driverName: 'Arvid Lindblad', pointsDelta: 2 },
  { driverName: 'Pierre Gasly', pointsDelta: -9 },
];

describe('applyDriverOverrides', () => {
  it('is a no-op without overrides', () => {
    expect(applyDriverOverrides(F1_AFTER_R12, undefined)).toBe(F1_AFTER_R12);
    expect(applyDriverOverrides(F1_AFTER_R12, [])).toBe(F1_AFTER_R12);
  });

  it('applies the Monaco appeal deltas', () => {
    const out = applyDriverOverrides(F1_AFTER_R12, MONACO_ICA);
    const by = (name: string) => out.find(x => x.driverName === name)!;
    expect(by('Isack Hadjar').points).toBe(71);
    expect(by('Oscar Piastri').points).toBe(106);
    expect(by('Liam Lawson').points).toBe(51);
    expect(by('Arvid Lindblad').points).toBe(25);
    expect(by('Pierre Gasly').points).toBe(35);
  });

  it('leaves an untouched driver exactly alone', () => {
    const out = applyDriverOverrides(F1_AFTER_R12, MONACO_ICA);
    expect(out.find(x => x.driverName === 'Max Verstappen')!.points).toBe(112);
    expect(out.find(x => x.driverName === 'Franco Colapinto')!.points).toBe(19);
  });

  it('renumbers positions from 1 after a delta, and orders by points', () => {
    const out = applyDriverOverrides(F1_AFTER_R12, MONACO_ICA);
    expect(out.map(x => x.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(out.map(x => x.driverName)).toEqual([
      'Max Verstappen',
      'Oscar Piastri',
      'Isack Hadjar',
      'Liam Lawson',
      'Pierre Gasly',
      'Arvid Lindblad',
      'Franco Colapinto',
    ]);
  });

  it('reorders when a delta actually changes the order', () => {
    // Not the Monaco case — there nobody swapped — so this proves the re-rank
    // does more than renumber a list that was already correct.
    const out = applyDriverOverrides(
      [d(1, 'Ahead', 50), d(2, 'Behind', 40)],
      [{ driverName: 'Behind', pointsDelta: 20 }],
    );
    expect(out.map(x => x.driverName)).toEqual(['Behind', 'Ahead']);
    expect(out.map(x => x.position)).toEqual([1, 2]);
  });

  it('breaks a points tie on wins, then on the position upstream gave', () => {
    const out = applyDriverOverrides(
      [d(1, 'NoWins', 100, 0), d(2, 'OneWin', 90, 1), d(3, 'AlsoNoWins', 100, 0)],
      [{ driverName: 'OneWin', pointsDelta: 10 }],
    );
    // All three on 100: the winner first, then the two by their prior order.
    expect(out.map(x => x.driverName)).toEqual(['OneWin', 'NoWins', 'AlsoNoWins']);
  });

  it('still honours an absolute points override, and does not re-rank for it', () => {
    // The pre-existing behaviour, unchanged: a curated `position` is obeyed.
    const out = applyDriverOverrides(
      [d(1, 'First', 50), d(2, 'Second', 40)],
      [{ driverName: 'Second', points: 999, position: 1 }, { driverName: 'First', position: 2 }],
    );
    expect(out.map(x => x.driverName)).toEqual(['Second', 'First']);
    expect(out[0].points).toBe(999);
  });
});

describe('applyConstructorOverrides', () => {
  const c = (position: number, name: string, points: number): ConstructorStanding => ({
    position,
    name,
    points,
  });

  it('applies the Monaco appeal deltas and keeps the order', () => {
    const out = applyConstructorOverrides(
      [c(3, 'McLaren', 263), c(4, 'Red Bull', 186), c(5, 'RB F1 Team', 66), c(6, 'Alpine F1 Team', 63)],
      [
        { name: 'McLaren', pointsDelta: 2 },
        { name: 'Red Bull', pointsDelta: 3 },
        { name: 'RB F1 Team', pointsDelta: 4 },
        { name: 'Alpine F1 Team', pointsDelta: -9 },
      ],
    );
    expect(out.map(x => [x.name, x.points])).toEqual([
      ['McLaren', 265],
      ['Red Bull', 189],
      ['RB F1 Team', 70],
      ['Alpine F1 Team', 54],
    ]);
    expect(out.map(x => x.position)).toEqual([1, 2, 3, 4]);
  });

  it('is a no-op without overrides', () => {
    const rows = [c(1, 'A', 10)];
    expect(applyConstructorOverrides(rows, undefined)).toBe(rows);
  });
});
