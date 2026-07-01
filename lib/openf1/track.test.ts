import { describe, it, expect } from 'vitest';
import {
  anchorTrackToStartFinish,
  buildTrackPath,
  startFinishReference,
  type TrackPath,
} from './track';

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

const trackOf = (pts: { x: number; y: number; t: number }[]): TrackPath => ({
  d: '',
  width: 1000,
  height: 1000,
  viewBox: '0 0 1000 1000',
  points: pts.map(p => ({ x: p.x, y: p.y, z: 0, t: p.t })),
});

describe('anchorTrackToStartFinish', () => {
  // A straight +x reference lap: the S/F line is at x=0, direction (1,0).
  const ref = startFinishReference(
    trackOf([
      { x: 0, y: 50, t: 0 },
      { x: 10, y: 50, t: 0.1 },
      { x: 20, y: 50, t: 0.2 },
      { x: 30, y: 50, t: 0.3 },
    ]),
  )!;
  const s = (p: { x: number; y: number }) => (p.x - ref.x) * ref.dx + (p.y - ref.y) * ref.dy;

  it('derives the line at the reference start, perpendicular to travel', () => {
    expect(ref).toEqual({ x: 0, y: 50, dx: 1, dy: 0 });
  });

  it('a trace starting PAST the line is extrapolated back onto it at t=0', () => {
    const a = anchorTrackToStartFinish(
      trackOf([
        { x: 5, y: 50, t: 0 }, // already 5 past the line
        { x: 15, y: 50, t: 0.1 },
        { x: 25, y: 50, t: 0.2 },
        { x: 35, y: 50, t: 0.3 },
      ]),
      ref,
    );
    expect(a.points[0].t).toBe(0);
    expect(s(a.points[0])).toBeCloseTo(0, 5); // sits ON the line
    expect(a.points[1].t).toBeCloseTo(0.05, 5); // its real first sample, re-zeroed
  });

  it('co-locates two traces with different sampling phases on the same line', () => {
    const t1 = anchorTrackToStartFinish(
      trackOf([
        { x: 5, y: 50, t: 0 },
        { x: 15, y: 50, t: 0.1 },
        { x: 25, y: 50, t: 0.2 },
        { x: 35, y: 50, t: 0.3 },
      ]),
      ref,
    );
    const t2 = anchorTrackToStartFinish(
      trackOf([
        { x: 8, y: 50, t: 0 },
        { x: 18, y: 50, t: 0.1 },
        { x: 28, y: 50, t: 0.2 },
        { x: 38, y: 50, t: 0.3 },
      ]),
      ref,
    );
    expect(s(t1.points[0])).toBeCloseTo(0, 5);
    expect(s(t2.points[0])).toBeCloseTo(0, 5);
    expect(Math.abs(s(t1.points[0]) - s(t2.points[0]))).toBeLessThan(1e-6);
  });

  it('a trace starting BEFORE the line anchors at the crossing, re-zeroed', () => {
    const a = anchorTrackToStartFinish(
      trackOf([
        { x: -6, y: 50, t: 0 }, // before the line
        { x: 4, y: 50, t: 0.1 }, // crosses between here
        { x: 14, y: 50, t: 0.2 },
        { x: 24, y: 50, t: 0.3 },
      ]),
      ref,
    );
    expect(a.points[0].t).toBe(0);
    expect(s(a.points[0])).toBeCloseTo(0, 5);
    expect(a.points[0].x).toBeCloseTo(0, 5);
  });
});
