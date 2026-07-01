import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { buildEnvironment, cornerIndices } from './track-environment';

// A unit circle (closed loop) as a centreline fixture — curvature is uniform,
// width constant 0.1, 64 points. Centre at the origin, so "outfield" = radius > 1.
const N = 64;
const loop = Array.from({ length: N }, (_, i) => {
  const a = (i / N) * Math.PI * 2;
  return new Vector3(Math.cos(a), 0, Math.sin(a));
});
const halfL = loop.map(() => 0.1);
const halfR = loop.map(() => 0.1);

// A square loop (4 distinct 90° corners) for assertions about corner-driven
// placement — a uniform circle has no corners above the builder's threshold.
const sq = Array.from({ length: N }, (_, i) => {
  const t = (i / N) * 4;
  const seg = Math.floor(t);
  const f = t - seg;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const a = corners[seg];
  const b = corners[(seg + 1) % 4];
  return new Vector3(a[0] + (b[0] - a[0]) * f, 0, a[1] + (b[1] - a[1]) * f);
});
const sqHalfL = sq.map(() => 0.1);
const sqHalfR = sq.map(() => 0.1);

describe('buildEnvironment', () => {
  it('runs a continuous barrier down BOTH edges, set back into the run-off', () => {
    const env = buildEnvironment(loop, halfL, halfR, 'high');
    expect(env.barrierLeft.length).toBe(N);
    expect(env.barrierRight.length).toBe(N);
    // circle radius 1, half 0.1, run-off 0.24 → barriers ~0.34 off the line: one edge
    // clearly outside 1.2, the other inside 0.8 (never hugging the 1.0 racing line).
    const radii = [...env.barrierLeft, ...env.barrierRight].map(p => p.length());
    expect(Math.max(...radii)).toBeGreaterThan(1.2);
    expect(Math.min(...radii)).toBeLessThan(0.8);
  });

  it('places trees only in the OUTFIELD (never inside the loop / on the track)', () => {
    const env = buildEnvironment(loop, halfL, halfR, 'high');
    expect(env.trees.length).toBeGreaterThan(0);
    // centre at origin → outfield = radius > 1; every tree must be outside the loop.
    expect(Math.min(...env.trees.map(t => t.position.length()))).toBeGreaterThan(1);
  });

  it('places fewer grandstands + trees on the low tier than high', () => {
    const hiSq = buildEnvironment(sq, sqHalfL, sqHalfR, 'high');
    const loSq = buildEnvironment(sq, sqHalfL, sqHalfR, 'low');
    expect(loSq.grandstands.length).toBeLessThan(hiSq.grandstands.length);
    const hi = buildEnvironment(loop, halfL, halfR, 'high');
    const lo = buildEnvironment(loop, halfL, halfR, 'low');
    expect(lo.trees.length).toBeLessThan(hi.trees.length);
  });

  it('emits one banner per grandstand', () => {
    const env = buildEnvironment(sq, sqHalfL, sqHalfR, 'high');
    expect(env.banners.length).toBe(env.grandstands.length);
  });

  it('builds a pit on a track with a straight, none on a cornerless loop', () => {
    // the square's sides are long straights → a pit; the uniform circle has no straight.
    const sqPit = buildEnvironment(sq, sqHalfL, sqHalfR, 'high').pit;
    expect(sqPit).not.toBeNull();
    expect(sqPit!.laneInner.length).toBeGreaterThan(0);
    expect(sqPit!.laneOuter.length).toBe(sqPit!.laneInner.length);
    expect(buildEnvironment(loop, halfL, halfR, 'high').pit).toBeNull();
  });

  it('is deterministic — same input yields identical tree scatter', () => {
    const a = buildEnvironment(loop, halfL, halfR, 'high');
    const b = buildEnvironment(loop, halfL, halfR, 'high');
    expect(a.trees.map((t) => t.position.toArray())).toEqual(b.trees.map((t) => t.position.toArray()));
  });

  it('cornerIndices finds high-curvature points (none on a uniform circle above a sharp threshold)', () => {
    expect(cornerIndices(loop, 0.5).length).toBe(0);
  });
});
