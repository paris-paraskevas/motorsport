// Self-drawn circuit geometry from /location samples. Plotting one lap's worth
// of (x, y) points traces the track outline to scale — no per-circuit SVG
// calibration. Y is flipped (track coords are y-up; SVG is y-down). `z` (real
// elevation) is normalised to the same scale and carried on each point for the
// 3D ghost view; the 2D path string ignores it. Pure + synchronous so it can be
// unit-tested and run server-side without a fetch.
//
// A SHARED `TrackFrame` (computed across many drivers' laps) lets every lap +
// the reconstructed track normalise into ONE coordinate frame, so the cars line
// up on the reconstructed surface. `reconstructCircuit` turns the point-cloud of
// many drivers into a centreline + measured left/right width (the real drivable
// surface — OpenF1 has no track-geometry endpoint, so the track IS where cars drove).

import type { OF1Location } from './types';

export interface TrackPoint {
  x: number; // viewBox space
  y: number;
  z: number; // elevation, same scale as x/y (0 when no z data); for the 3D view
  t: number; // seconds from the first sample (for time-based animation)
}

export interface TrackPath {
  d: string; // SVG path data ("M.. L..")
  width: number;
  height: number;
  viewBox: string; // "0 0 W H"
  points: TrackPoint[];
}

/** Shared spatial normalisation (raw OpenF1 units → viewBox units). */
export interface TrackFrame {
  minX: number;
  minY: number;
  minZ: number;
  scale: number;
  width: number;
  height: number;
  padding: number;
}

/** Reconstructed circuit: a centreline + the measured drivable half-width either
 *  side of it (viewBox units), per centreline point. */
export interface Circuit {
  points: TrackPoint[];
  halfLeft: number[];
  halfRight: number[];
}

type LocationSample = Pick<OF1Location, 'x' | 'y' | 'date'> & { z?: number };

const DEFAULT_WIDTH = 1000;
const DEFAULT_PADDING = 40;
const MAX_POINTS = 800; // a ~90s lap at 3.7 Hz is ~330 pts; cap pathological inputs

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface CleanSample {
  x: number;
  y: number;
  z: number | null;
  ms: number;
}

/** Drop non-finite + (0,0) dropout samples; sort by time. */
function cleanSamples(samples: LocationSample[]): CleanSample[] {
  return samples
    .map(s => ({
      x: s.x,
      y: s.y,
      z: typeof s.z === 'number' && Number.isFinite(s.z) ? s.z : null,
      ms: new Date(s.date).getTime(),
    }))
    .filter(
      s =>
        Number.isFinite(s.x) &&
        Number.isFinite(s.y) &&
        Number.isFinite(s.ms) &&
        !(s.x === 0 && s.y === 0),
    )
    .sort((a, b) => a.ms - b.ms);
}

/**
 * Compute a shared frame from one or more laps' raw samples — the bounds span
 * every lap, so all of them (and the reconstructed track) normalise identically.
 */
export function computeTrackFrame(
  laps: LocationSample[][],
  opts: { width?: number; padding?: number } = {},
): TrackFrame | null {
  const width = opts.width ?? DEFAULT_WIDTH;
  const padding = opts.padding ?? DEFAULT_PADDING;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  for (const lap of laps) {
    for (const s of cleanSamples(lap)) {
      if (s.x < minX) minX = s.x;
      if (s.x > maxX) maxX = s.x;
      if (s.y < minY) minY = s.y;
      if (s.y > maxY) maxY = s.y;
      if (s.z != null && s.z < minZ) minZ = s.z;
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = (width - 2 * padding) / spanX;
  const height = Math.round(spanY * scale + 2 * padding);
  return { minX, minY, minZ: Number.isFinite(minZ) ? minZ : 0, scale, width, height, padding };
}

/**
 * Build a normalised SVG path from location samples (one lap, ideally). Pass
 * `opts.frame` to normalise into a shared coordinate frame (so multiple laps +
 * the reconstructed track align); omit it and the lap is normalised to its own
 * bounds (backwards-compatible). Returns null with fewer than 2 usable points.
 */
export function buildTrackPath(
  samples: LocationSample[],
  opts: { width?: number; padding?: number; frame?: TrackFrame } = {},
): TrackPath | null {
  const clean = cleanSamples(samples);
  if (clean.length < 2) return null;

  const step = clean.length > MAX_POINTS ? Math.ceil(clean.length / MAX_POINTS) : 1;
  const pts = clean.filter((_, i) => i % step === 0);

  const frame = opts.frame ?? computeTrackFrame([samples], opts);
  if (!frame) return null;
  const { minX, minY, minZ, scale, width, height, padding } = frame;
  const t0 = pts[0].ms;

  const points: TrackPoint[] = pts.map(p => ({
    x: round2(padding + (p.x - minX) * scale),
    // flip Y so the map is north-up rather than mirrored
    y: round2(height - padding - (p.y - minY) * scale),
    z: p.z != null ? round2((p.z - minZ) * scale) : 0,
    t: round2((p.ms - t0) / 1000),
  }));

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');

  return { d, width, height, viewBox: `0 0 ${width} ${height}`, points };
}

// Cap a measured half-width (viewBox units) so a car running deep into a runoff
// / pit entry can't blow the ribbon out to absurd width. ~3% of the circuit's
// width is a generous F1 track + kerbs + a little verge.
const MAX_HALF_W = 30;

/**
 * Reconstruct the drivable surface from many drivers' laps (all built with the
 * SAME frame). The fastest lap is the centreline; for every other point, the
 * signed perpendicular offset onto the nearest centreline station gives how far
 * left/right cars ran there — the measured track edges. Smoothed + capped.
 */
export function reconstructCircuit(laps: TrackPath[]): Circuit | null {
  const usable = laps.filter(l => l.points.length >= 3);
  if (usable.length === 0) return null;
  const center = usable[0].points;
  const n = center.length;

  // Unit left-normal at each centreline station (2D, x/y).
  const nx: number[] = new Array(n);
  const ny: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(n - 1, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / len; // left normal = perpendicular to the tangent
    ny[i] = tx / len;
  }

  const left = new Array(n).fill(0);
  const right = new Array(n).fill(0);
  for (const lap of usable) {
    let hint = 0; // points are ordered along the track → nearest station advances
    for (const p of lap.points) {
      let bi = hint;
      let bd = Infinity;
      for (let k = -20; k <= 20; k++) {
        const i = hint + k;
        if (i < 0 || i >= n) continue;
        const dx = p.x - center[i].x;
        const dy = p.y - center[i].y;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      hint = bi;
      const off = (p.x - center[bi].x) * nx[bi] + (p.y - center[bi].y) * ny[bi];
      if (off > left[bi]) left[bi] = Math.min(off, MAX_HALF_W);
      else if (-off > right[bi]) right[bi] = Math.min(-off, MAX_HALF_W);
    }
  }

  // Smooth over stations (the per-station max is spiky) + keep a small floor so
  // the ribbon never collapses to a thread where coverage was sparse.
  const smooth = (arr: number[]): number[] =>
    arr.map((_, i) => {
      let s = 0;
      let c = 0;
      for (let k = -4; k <= 4; k++) {
        const j = i + k;
        if (j >= 0 && j < n) {
          s += arr[j];
          c += 1;
        }
      }
      return Math.max(6, s / c); // floor ≈ a minimum half-track so it reads as a road
    });

  return { points: center, halfLeft: smooth(left), halfRight: smooth(right) };
}
