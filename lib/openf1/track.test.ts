import { describe, it, expect } from 'vitest';
import { buildTrackPath } from './track';

const sample = (x: number, y: number, sec: number) => ({
  x,
  y,
  date: new Date(Date.UTC(2024, 0, 1, 0, 0, sec)).toISOString(),
});

describe('buildTrackPath', () => {
  it('returns null with fewer than two usable points', () => {
    expect(buildTrackPath([])).toBeNull();
    // a lone (0,0) dropout is filtered, leaving nothing
    expect(buildTrackPath([sample(0, 0, 0)])).toBeNull();
  });

  it('drops (0,0) dropouts and non-finite samples', () => {
    const path = buildTrackPath([
      sample(10, 10, 0),
      sample(0, 0, 1), // dropout
      sample(20, 10, 2),
    ]);
    expect(path).not.toBeNull();
    expect(path!.points).toHaveLength(2);
  });

  it('normalises into the viewBox, preserves time, and flips Y north-up', () => {
    const path = buildTrackPath(
      [
        sample(100, 100, 0),
        sample(300, 100, 1),
        sample(300, 200, 2),
        sample(100, 200, 3),
        sample(100, 100, 4),
      ],
      { width: 1000, padding: 40 },
    );
    expect(path).not.toBeNull();
    expect(path!.viewBox).toBe(`0 0 1000 ${path!.height}`);
    expect(path!.d.startsWith('M')).toBe(true);

    for (const p of path!.points) {
      expect(p.x).toBeGreaterThanOrEqual(40 - 0.01);
      expect(p.x).toBeLessThanOrEqual(960 + 0.01);
    }

    expect(path!.points[0].t).toBe(0);
    expect(path!.points[path!.points.length - 1].t).toBeCloseTo(4, 5);

    // track y=100 (min) maps near the bottom; track y=200 (max) near the top
    expect(path!.points[0].y).toBeGreaterThan(path!.points[2].y);
  });
});
