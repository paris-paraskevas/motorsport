import { describe, it, expect } from 'vitest';
import { detectTurns, nearestTurn, type TurnMarker } from './turns';
import type { TrackPath, TrackPoint } from './track';
import type { DistSample } from './delta';

// Build a TrackPath from planar points, spacing time evenly across [0, tEnd] so
// each point carries a `t` the telemetry can map to a distance.
function path(coords: [number, number][], tEnd = coords.length - 1): TrackPath {
  const points: TrackPoint[] = coords.map(([x, y], i) => ({
    x,
    y,
    z: 0,
    t: (tEnd * i) / (coords.length - 1),
  }));
  return { d: '', width: 1000, height: 1000, viewBox: '0 0 1000 1000', points };
}

// Telemetry at constant speed so lap distance is linear in time — a corner at
// time t then sits at distance (t / tEnd) * lapDist, which the tests assert on.
function telemetry(tEnd: number, lapDist: number, steps = 200): DistSample[] {
  const out: DistSample[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (tEnd * i) / steps;
    out.push({ t, d: (lapDist * i) / steps, speed: 100, throttle: 0, brake: 0, gear: 0, drs: 0 });
  }
  return out;
}

// A square lap traced OPEN (start/finish mid-way down the bottom edge, back to it),
// giving four ~90° corners — the canonical corner-detection fixture, matching the
// square used in track-environment.test.ts.
function squareLap(perSide = 20): [number, number][] {
  const corners: [number, number][] = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
    [0, 0],
  ];
  const pts: [number, number][] = [];
  // Start half-way along the bottom edge so the lap opens/closes on a straight.
  pts.push([50, 0]);
  for (let i = 20; i < perSide; i++) pts.push([(100 * i) / perSide, 0]);
  for (let s = 1; s < corners.length; s++) {
    const [ax, ay] = corners[s - 1];
    const [bx, by] = corners[s];
    for (let i = 1; i <= perSide; i++) {
      pts.push([ax + ((bx - ax) * i) / perSide, ay + ((by - ay) * i) / perSide]);
    }
  }
  for (let i = 1; i <= perSide / 2; i++) pts.push([(100 * i) / perSide, 0]);
  return pts;
}

describe('detectTurns', () => {
  it('finds the four corners of a square lap, numbered in lap order', () => {
    const lap = squareLap(20);
    const track = path(lap, 100);
    const turns = detectTurns(track, telemetry(100, 4000));
    expect(turns.length).toBe(4);
    expect(turns.map(t => t.n)).toEqual([1, 2, 3, 4]);
    // Numbering follows increasing lap distance.
    for (let i = 1; i < turns.length; i++) {
      expect(turns[i].d).toBeGreaterThan(turns[i - 1].d);
    }
  });

  it('finds no turns on a straight line (nothing above threshold)', () => {
    const straight: [number, number][] = Array.from({ length: 40 }, (_, i) => [i * 5, 0]);
    const turns = detectTurns(path(straight, 40), telemetry(40, 2000));
    expect(turns).toEqual([]);
  });

  it('returns [] with no track geometry (caller falls back to km labels)', () => {
    expect(detectTurns(null, telemetry(40, 2000))).toEqual([]);
  });

  it('returns [] when telemetry has no distance', () => {
    const lap = squareLap(20);
    expect(detectTurns(path(lap, 100), [])).toEqual([]);
  });

  it('maps a corner to a lap distance inside the lap length', () => {
    const lap = squareLap(20);
    const turns = detectTurns(path(lap, 100), telemetry(100, 4000));
    for (const t of turns) {
      expect(t.d).toBeGreaterThan(0);
      expect(t.d).toBeLessThan(4000);
    }
  });

  it('merges a sustained curve into a single turn via minSpacing', () => {
    // A gentle 90° arc sampled densely — many adjacent high-curvature points that
    // must collapse to ONE turn, not a cluster.
    const arc: [number, number][] = [];
    for (let i = 0; i < 15; i++) arc.push([i * 5, 0]); // lead-in straight
    for (let i = 0; i <= 30; i++) {
      const a = (i / 30) * (Math.PI / 2);
      arc.push([70 + 20 * Math.sin(a), 20 - 20 * Math.cos(a)]);
    }
    for (let i = 1; i < 15; i++) arc.push([90, 20 + i * 5]); // lead-out straight
    const turns = detectTurns(path(arc, 100), telemetry(100, 3000), { minSpacingFrac: 0.1 });
    expect(turns.length).toBe(1);
  });
});

describe('nearestTurn', () => {
  const turns: TurnMarker[] = [
    { n: 1, d: 500 },
    { n: 2, d: 1500 },
    { n: 3, d: 3000 },
  ];

  it('returns the closest turn to a distance', () => {
    expect(nearestTurn(turns, 1600)?.n).toBe(2);
    expect(nearestTurn(turns, 400)?.n).toBe(1);
  });

  it('respects maxGap, returning null when nothing is close enough', () => {
    expect(nearestTurn(turns, 2200, 100)).toBeNull();
    expect(nearestTurn(turns, 1520, 100)?.n).toBe(2);
  });

  it('returns null for an empty turn list', () => {
    expect(nearestTurn([], 1000)).toBeNull();
  });
});
