// Turn detection for the Qualifying Decoder's delta chart. Client-safe + pure —
// no `three`, no `fs` — so it can be imported straight into DeltaTrace (which is
// already lazy-loaded) without dragging weight onto the bundle.
//
// This mirrors the corner-detection approach in lib/openf1/track-environment.ts
// (`cornerIndices`): compute a per-point turning angle from the incoming/outgoing
// chord vectors, then keep the local maxima above a threshold. Two deliberate
// differences from that (3D, closed-loop) version:
//   1. It runs on the 2D `{x, y}` reconstructed lap points (TrackPath.points), so
//      it needs no Vector3 / three import.
//   2. It treats the lap as an OPEN path (start→finish), not a closed loop — a
//      fastest-lap trace begins and ends on the start/finish straight, so wrapping
//      neighbours across the ends would invent a phantom corner there.
//
// A turn's X position is reported as a LAP DISTANCE (metres). The reconstructed
// track points and the speed/distance telemetry are two independent ~3.7 Hz
// series over the same lap window, both normalised to `t` seconds from lap start
// — NOT index-aligned. So we locate each corner's time `points[i].t` and map it
// to distance by interpolating the telemetry's (t, d) pairs.

import type { DistSample } from './delta';
import type { TrackPath } from './track';

/** A detected turn: `n` is its 1-based number in lap order, `d` its lap distance (m). */
export interface TurnMarker {
  n: number;
  d: number;
}

export interface DetectTurnsOptions {
  /** Turning angle (rad, summed across the window) at/above which a point is a corner. */
  threshold?: number;
  /** Points either side used for the incoming/outgoing chord — smooths sampling noise. */
  window?: number;
  /** Merge corners closer than this fraction of the lap so a sustained curve is one turn. */
  minSpacingFrac?: number;
  /** Cap on reported turns (real circuits top out ~20; guards against noisy over-detection). */
  maxTurns?: number;
}

// Defaults tuned to the reconstructed viewBox-space points. `track.ts` uses
// TURN_REF = 0.5 rad over a ±4 window to size its centreline shift and
// track-environment uses 0.18 rad for grandstand corners; ~0.30 rad over a ±3
// window sits between those — it fires on real corners but not on the small
// wiggles of a fast sweep or GPS jitter down a straight.
const DEFAULTS: Required<DetectTurnsOptions> = {
  threshold: 0.3,
  window: 3,
  minSpacingFrac: 0.03,
  maxTurns: 24,
};

interface Pt {
  x: number;
  y: number;
}

/**
 * Turning angle (radians) at each point: the angle between the chord arriving
 * from `window` points back and the chord leaving to `window` points ahead.
 * Endpoints (where a full window isn't available) are 0 — a lap trace starts and
 * ends on the straight, so that's correct, not a lost corner. Same idea as
 * track-environment's `turnAngles`, minus the closed-loop wrap.
 */
function turnAngles(pts: Pt[], window: number): number[] {
  const n = pts.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const lo = i - window;
    const hi = i + window;
    if (lo < 0 || hi >= n) continue;
    const ax = pts[i].x - pts[lo].x;
    const ay = pts[i].y - pts[lo].y;
    const bx = pts[hi].x - pts[i].x;
    const by = pts[hi].y - pts[i].y;
    const aLen = Math.hypot(ax, ay);
    const bLen = Math.hypot(bx, by);
    if (aLen < 1e-6 || bLen < 1e-6) continue;
    // Signed via cross, unsigned magnitude via atan2 — robust near ±π and 0.
    const cross = (ax / aLen) * (by / bLen) - (ay / aLen) * (bx / bLen);
    const dot = (ax / aLen) * (bx / bLen) + (ay / aLen) * (by / bLen);
    out[i] = Math.abs(Math.atan2(cross, dot));
  }
  return out;
}

/** Indices that are local maxima of turning angle at/above `threshold` (corners). */
function cornerIndices(pts: Pt[], threshold: number, window: number): number[] {
  const ang = turnAngles(pts, window);
  const n = pts.length;
  const out: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (ang[i] >= threshold && ang[i] >= ang[i - 1] && ang[i] > ang[i + 1]) out.push(i);
  }
  return out;
}

/** Linear-interpolate cumulative distance (m) at lap time `t` from the (t, d) telemetry. */
function distanceAtTime(tel: DistSample[], t: number): number | null {
  if (tel.length === 0) return null;
  if (t <= tel[0].t) return tel[0].d;
  for (let i = 1; i < tel.length; i++) {
    if (tel[i].t >= t) {
      const p0 = tel[i - 1];
      const p1 = tel[i];
      const span = p1.t - p0.t || 1;
      return p0.d + ((t - p0.t) / span) * (p1.d - p0.d);
    }
  }
  return tel[tel.length - 1].d;
}

/**
 * Detect the circuit's turns from a reconstructed lap path + its speed/distance
 * telemetry, returned as numbered markers at lap distances (metres), in lap order.
 *
 * Returns [] when there's no usable track geometry or telemetry — the caller
 * should then fall back to plain distance labels. Detection is intentionally
 * conservative: sparse or straight data yields few/no markers rather than noise.
 */
export function detectTurns(
  track: TrackPath | null,
  telemetry: DistSample[],
  options: DetectTurnsOptions = {},
): TurnMarker[] {
  const { threshold, window, minSpacingFrac, maxTurns } = { ...DEFAULTS, ...options };
  const pts = track?.points;
  if (!pts || pts.length < 2 * window + 3 || telemetry.length < 2) return [];

  const lapDist = telemetry[telemetry.length - 1].d;
  if (!(lapDist > 0)) return [];
  const minSpacing = lapDist * minSpacingFrac;

  const ang = turnAngles(pts as Pt[], window);
  const corners = cornerIndices(pts as Pt[], threshold, window);

  // Corner index → lap distance, dropping any the telemetry can't place.
  const placed: { d: number; idx: number }[] = [];
  for (const idx of corners) {
    const d = distanceAtTime(telemetry, pts[idx].t);
    if (d != null && Number.isFinite(d)) placed.push({ d, idx });
  }
  placed.sort((p, q) => p.d - q.d);

  // Merge corners closer than `minSpacing` (a sustained curve reads as one turn);
  // keep the sharper of the two so a hairpin isn't lost to an adjacent kink.
  const merged: { d: number; idx: number }[] = [];
  for (const c of placed) {
    const prev = merged[merged.length - 1];
    if (prev && c.d - prev.d < minSpacing) {
      if (ang[c.idx] > ang[prev.idx]) merged[merged.length - 1] = c;
      continue;
    }
    merged.push(c);
  }

  const limited = merged.length > maxTurns ? merged.slice(0, maxTurns) : merged;
  return limited.map((c, i) => ({ n: i + 1, d: Math.round(c.d) }));
}

/** Nearest turn to a lap distance (m), or null when none is within `maxGap` metres. */
export function nearestTurn(turns: TurnMarker[], d: number, maxGap = Infinity): TurnMarker | null {
  let best: TurnMarker | null = null;
  let bestGap = maxGap;
  for (const t of turns) {
    const gap = Math.abs(t.d - d);
    if (gap <= bestGap) {
      bestGap = gap;
      best = t;
    }
  }
  return best;
}
