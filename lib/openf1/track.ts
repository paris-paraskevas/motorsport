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

// ── Start/finish anchoring ───────────────────────────────────────────────────
// Each trace is timed from its OWN first GPS sample (see `t0` above), which lands
// a different distance past the start/finish line per driver (OpenF1 location
// samples are ~0.2–0.4 s apart, and each lap clip begins on a different sampling
// phase). The onboard replay is time-synced, so at t=0 the cars sit on those
// mismatched spots — a slower driver can appear to START ahead. These helpers
// re-anchor every trace to ONE shared S/F line so all cars begin ON the line at
// t=0 and then diverge by pace.

/** Shared start/finish reference: a line through a reference trace's first point
 *  (use the fastest lap), perpendicular to the track direction there. */
export interface StartFinishRef {
  x: number;
  y: number;
  dx: number; // unit track direction (travel) at the line
  dy: number;
}

/** Unit track direction at the lap start: points[0] → the first point at least a
 *  car-length away (a stable heading, not one noisy sample). Falls back to [0]→[1]. */
function startDirection(points: TrackPoint[]): { dx: number; dy: number } {
  const p0 = points[0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - p0.x;
    const dy = points[i].y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len >= 15) return { dx: dx / len, dy: dy / len };
  }
  const dx = points[1].x - p0.x;
  const dy = points[1].y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  return { dx: dx / len, dy: dy / len };
}

/** Build the shared S/F reference from a trace (pass the fastest lap). */
export function startFinishReference(ref: TrackPath): StartFinishRef | null {
  if (ref.points.length < 2) return null;
  const p0 = ref.points[0];
  const { dx, dy } = startDirection(ref.points);
  if (dx === 0 && dy === 0) return null;
  return { x: p0.x, y: p0.y, dx, dy };
}

function lerpPoint(a: TrackPoint, b: TrackPoint, f: number): TrackPoint {
  return {
    x: round2(a.x + (b.x - a.x) * f),
    y: round2(a.y + (b.y - a.y) * f),
    z: round2(a.z + (b.z - a.z) * f),
    t: round2(a.t + (b.t - a.t) * f),
  };
}

/**
 * Re-anchor a trace so it BEGINS on the shared S/F line at t=0. Finds where the
 * trace crosses the S/F plane near the lap start — searching only the first ~15%
 * so a flying lap's END crossing of the same line can't be picked — synthesizes
 * that exact crossing point, drops anything before it, and re-zeros time there.
 * Same pace, new time origin = the line. Pure + synchronous (unit-tested).
 */
export function anchorTrackToStartFinish(track: TrackPath, ref: StartFinishRef): TrackPath {
  const pts = track.points;
  if (pts.length < 2) return track;
  const s = (p: TrackPoint) => (p.x - ref.x) * ref.dx + (p.y - ref.y) * ref.dy;
  const win = Math.max(2, Math.floor(pts.length * 0.15));

  let start: TrackPoint;
  let rest: TrackPoint[];
  let crossed = -1;
  for (let i = 1; i < win; i++) {
    if (s(pts[i - 1]) <= 0 && s(pts[i]) > 0) {
      crossed = i;
      break;
    }
  }
  if (crossed >= 0) {
    const a = pts[crossed - 1];
    const b = pts[crossed];
    const sa = s(a);
    const sb = s(b);
    const f = sb === sa ? 0 : (0 - sa) / (sb - sa);
    start = lerpPoint(a, b, f);
    rest = pts.slice(crossed);
  } else {
    // First sample already past the line (s0 > 0) → extrapolate backward to s=0.
    const a = pts[0];
    const b = pts[1];
    const sa = s(a);
    const sb = s(b);
    if (sb === sa) return track; // degenerate; leave as-is
    const f = (0 - sa) / (sb - sa); // f < 0 → just before the first sample, on the line
    start = lerpPoint(a, b, f);
    rest = pts.slice(0);
  }

  const t0 = start.t;
  const points: TrackPoint[] = [start, ...rest]
    .filter((p, i, arr) => i === 0 || p.t !== arr[i - 1].t) // drop a coincident synthetic start
    .map(p => ({ x: p.x, y: p.y, z: p.z, t: round2(p.t - t0) }));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  return { ...track, points, d };
}

// Cap a measured half-width (viewBox units) so a car running deep into a runoff
// / pit entry can't blow the ribbon out to absurd width. ~3% of the circuit's
// width is a generous F1 track + kerbs + a little verge.
// Track half-width + the most we push the centreline outward through corners, in
// viewBox units. Every car bunches on the racing line, so the unused tarmac isn't
// observable; instead we ESTIMATE the geometric centre by shifting the racing line
// OUTWARD where it curves (away from the turn), so the racing line then sits at
// the inside/apex of a fixed-width track — cars clip apexes + ride the kerbs.
const TRACK_HALF_VB = 13; // half track width (viewBox units)
const MAX_SHIFT_VB = 9; // most the centreline shifts outward, at the sharpest corners
const TURN_REF = 0.5; // heading change (rad over the window) that reaches the max shift
const CURV_WIN = 4; // stations either side, for the heading/curvature estimate

/**
 * Reconstruct a drivable track from the fastest lap (the racing line). Because
 * every car bunches on the racing line, the unused width isn't measurable — so we
 * estimate the geometric centreline by pushing the racing line OUTWARD through
 * corners (by its own curvature). The racing line then clips the inside/apex of a
 * fixed-width track, and each car (plotted by its own coords) rides the kerbs.
 */
export function reconstructCircuit(laps: TrackPath[]): Circuit | null {
  const usable = laps.filter(l => l.points.length >= 5);
  if (usable.length === 0) return null;
  const center = usable[0].points;
  const n = center.length;

  // Signed outward shift (viewBox units) at each station, from the local turn.
  const rawShift = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = center[Math.max(0, i - CURV_WIN)];
    const b = center[Math.min(n - 1, i + CURV_WIN)];
    const inx = center[i].x - a.x;
    const iny = center[i].y - a.y;
    const outx = b.x - center[i].x;
    const outy = b.y - center[i].y;
    const inLen = Math.hypot(inx, iny) || 1;
    const outLen = Math.hypot(outx, outy) || 1;
    const cross = (inx / inLen) * (outy / outLen) - (iny / inLen) * (outx / outLen);
    const dot = (inx / inLen) * (outx / outLen) + (iny / inLen) * (outy / outLen);
    const turn = Math.atan2(cross, dot); // + = left turn, − = right turn
    const mag = Math.min(1, Math.abs(turn) / TURN_REF) * MAX_SHIFT_VB;
    rawShift[i] = -Math.sign(turn) * mag; // outward = away from the turn centre
  }
  // Smooth the shift so the centreline glides rather than kinks.
  const shift = rawShift.map((_, i) => {
    let acc = 0;
    let c = 0;
    for (let k = -3; k <= 3; k++) {
      const j = i + k;
      if (j >= 0 && j < n) {
        acc += rawShift[j];
        c += 1;
      }
    }
    return acc / c;
  });

  // Apply the shift along each station's left-normal → the estimated geometric centre.
  const points: TrackPoint[] = center.map((p, i) => {
    const a = center[Math.max(0, i - 1)];
    const b = center[Math.min(n - 1, i + 1)];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    return { x: p.x + (-ty / len) * shift[i], y: p.y + (tx / len) * shift[i], z: p.z, t: p.t };
  });

  const half = new Array<number>(n).fill(TRACK_HALF_VB);
  return { points, halfLeft: half, halfRight: half };
}
