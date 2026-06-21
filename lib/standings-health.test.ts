import { describe, it, expect } from 'vitest';
import { countRows, summarize, type HealthResult } from './standings-health';

describe('countRows', () => {
  it('counts a flat array of standing rows', () => {
    const f1 = [
      { position: 1, driverName: 'A', points: 25 },
      { position: 2, driverName: 'B', points: 18 },
      { position: 3, driverName: 'C', points: 15 },
    ];
    expect(countRows(f1)).toBe(3);
  });

  it('sums rows across class-keyed records (the IMSA/WEC shape)', () => {
    const wec = {
      drivers: {
        Hypercar: [{ p: 1 }, { p: 2 }],
        LMGT3: [{ p: 1 }, { p: 2 }, { p: 3 }],
      },
      manufacturers: { Hypercar: [{ p: 1 }] },
    };
    expect(countRows(wec)).toBe(6); // 2 + 3 + 1
  });

  it('sums the sections of a typical standings result', () => {
    const result = {
      drivers: [{ p: 1 }, { p: 2 }],
      teams: [{ p: 1 }],
      constructors: [{ p: 1 }, { p: 2 }, { p: 3 }],
    };
    expect(countRows(result)).toBe(6);
  });

  it('ignores arrays of primitives (e.g. string headers)', () => {
    const withHeader = {
      header: ['Pos', 'Driver', 'Points'],
      rows: [{ p: 1 }, { p: 2 }],
    };
    expect(countRows(withHeader)).toBe(2);
  });

  it('treats null / empty as zero rows', () => {
    expect(countRows(null)).toBe(0);
    expect(countRows(undefined)).toBe(0);
    expect(countRows({})).toBe(0);
    expect(countRows([])).toBe(0);
    expect(countRows({ drivers: {} })).toBe(0);
  });
});

describe('summarize', () => {
  const make = (slug: string, status: HealthResult['status'], rows = 0): HealthResult => ({
    slug, label: slug, source: 'x', status, rows, min: 10, ms: 1,
  });

  it('classifies down (ERROR/EMPTY), degraded (LOW) and healthy (OK)', () => {
    const s = summarize([
      make('f1', 'OK', 30),
      make('dtm', 'LOW', 5),
      make('wrc', 'EMPTY', 0),
      make('wec', 'ERROR', 0),
    ]);
    expect(s.total).toBe(4);
    expect(s.healthy).toBe(1);
    expect(s.low).toBe(1);
    expect(s.down).toBe(2);
    expect(s.downSlugs.sort()).toEqual(['wec', 'wrc']);
    expect(s.lowSlugs).toEqual(['dtm']);
  });

  it('reports all-healthy with no down or low', () => {
    const s = summarize([make('f1', 'OK', 30), make('motogp', 'OK', 27)]);
    expect(s.down).toBe(0);
    expect(s.low).toBe(0);
    expect(s.healthy).toBe(2);
  });
});
