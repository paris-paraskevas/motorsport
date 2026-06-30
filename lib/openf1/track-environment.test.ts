import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { buildEnvironment, cornerIndices } from './track-environment';

// A unit circle (closed loop) as a centreline fixture — curvature is uniform,
// width constant 0.1, 64 points.
const N = 64;
const loop = Array.from({ length: N }, (_, i) => {
  const a = (i / N) * Math.PI * 2;
  return new Vector3(Math.cos(a), 0, Math.sin(a));
});
const halfL = loop.map(() => 0.1);
const halfR = loop.map(() => 0.1);

// A square loop (4 distinct 90° corners) for assertions about corner-driven
// placement. A uniform circle has *no* corners — grandstands are correctly 0 on
// it for every tier — so the per-tier grandstand cap is only observable on a
// shape that actually registers corners above the builder's 0.18 threshold.
const sq = Array.from({ length: N }, (_, i) => {
  const t = (i / N) * 4; // parameter across 4 sides
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
  it('emits two barrier lines flanking the track (one per side)', () => {
    const env = buildEnvironment(loop, halfL, halfR, 'high');
    expect(env.barriersLeft.length).toBe(N);
    expect(env.barriersRight.length).toBe(N);
    // left barrier sits outside the left edge → further from origin than the centreline
    expect(env.barriersLeft[0].length()).toBeGreaterThan(1);
  });

  it('places fewer grandstands + trees on the low tier than high', () => {
    // Grandstands are corner-driven → exercise on the square (the circle has no corners).
    const hiSq = buildEnvironment(sq, sqHalfL, sqHalfR, 'high');
    const loSq = buildEnvironment(sq, sqHalfL, sqHalfR, 'low');
    expect(loSq.grandstands.length).toBeLessThan(hiSq.grandstands.length);
    // Trees scatter by tier-dependent stride → observable on any loop.
    const hi = buildEnvironment(loop, halfL, halfR, 'high');
    const lo = buildEnvironment(loop, halfL, halfR, 'low');
    expect(lo.trees.length).toBeLessThan(hi.trees.length);
  });

  it('is deterministic — same input yields identical tree scatter', () => {
    const a = buildEnvironment(loop, halfL, halfR, 'high');
    const b = buildEnvironment(loop, halfL, halfR, 'high');
    expect(a.trees.map((t) => t.position.toArray())).toEqual(b.trees.map((t) => t.position.toArray()));
  });

  it('cornerIndices finds high-curvature points (none on a uniform circle above a sharp threshold)', () => {
    // uniform circle has no *local* maxima sharper than neighbours → empty at a strict threshold
    expect(cornerIndices(loop, 0.5).length).toBe(0);
  });
});
