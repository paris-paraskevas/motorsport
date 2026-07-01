import { Vector3 } from 'three';
import type { QualityTier } from '@/lib/onboard/useQualityTier';

export interface Placement { position: Vector3; rotationY: number; scale: number }
/** Pit complex on the main straight: a tapered lane strip + a row of garages behind it. */
export interface Pit {
  laneInner: Vector3[]; // edge of the pit lane nearest the track
  laneOuter: Vector3[]; // far edge of the pit lane (tapers to the entry/exit)
  garages: Placement[];
}
export interface TrackEnvironment {
  /** Continuous barrier polyline set back on the run-off, left edge (rendered as a low wall). */
  barrierLeft: Vector3[];
  /** Ditto, right edge. */
  barrierRight: Vector3[];
  grandstands: Placement[];
  trees: Placement[];
  banners: Placement[];
  pit: Pit | null;
}

const UP = new Vector3(0, 1, 0);

/**
 * Unit forward tangents (XZ, y-zeroed) per point — computed with the SAME clamped
 * neighbours as buildRibbon (`pts[i-1]`→`pts[i+1]`) so the side normal lines up with the
 * asphalt edges point-for-point.
 */
function tangents(pts: Vector3[]): Vector3[] {
  const n = pts.length;
  const out: Vector3[] = [];
  const t = new Vector3();
  for (let i = 0; i < n; i++) {
    t.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]);
    t.y = 0;
    if (t.lengthSq() < 1e-9) t.set(0, 0, 1);
    else t.normalize();
    out.push(t.clone());
  }
  return out;
}

/**
 * Per-point side normal computed IDENTICALLY to buildRibbon (`crossVectors(tangent,
 * UP)`): `+side` is the ribbon's LEFT (halfL) edge, `-side` its RIGHT. The old builder
 * used `crossVectors(UP, tangent)` — the opposite sign — so its offsets landed mirrored
 * vs the actual track. This sign is that fix.
 */
function sideNormals(tans: Vector3[]): Vector3[] {
  return tans.map(t => new Vector3().crossVectors(t, UP).normalize());
}

/** Turning angle (rad) at each point — discrete curvature proxy. */
function turnAngles(pts: Vector3[]): number[] {
  const n = pts.length;
  const a = new Vector3(), b = new Vector3();
  return pts.map((_, i) => {
    a.subVectors(pts[i], pts[(i - 1 + n) % n]); a.y = 0;
    b.subVectors(pts[(i + 1) % n], pts[i]); b.y = 0;
    if (a.lengthSq() < 1e-9 || b.lengthSq() < 1e-9) return 0;
    return Math.abs(a.angleTo(b));
  });
}

/** Indices that are LOCAL maxima of turning angle above `threshold` (corners). */
export function cornerIndices(pts: Vector3[], threshold: number): number[] {
  const ang = turnAngles(pts);
  const n = pts.length;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (ang[i] >= threshold && ang[i] >= ang[(i - 1 + n) % n] && ang[i] > ang[(i + 1) % n]) out.push(i);
  }
  return out;
}

/** Longest contiguous low-curvature run (the main straight) as {start, len}, wrap-aware. */
function longestStraight(ang: number[]): { start: number; len: number } {
  const n = ang.length;
  const STRAIGHT = 0.05; // rad/point below which the track reads as straight
  let bestStart = 0, bestLen = 0, curStart = 0, curLen = 0;
  for (let k = 0; k < 2 * n && curLen < n; k++) {
    const i = k % n;
    if (ang[i] < STRAIGHT) {
      if (curLen === 0) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else curLen = 0;
  }
  return { start: bestStart, len: Math.min(bestLen, n) };
}

/** Seeded PRNG (mulberry32) — deterministic scatter, no Math.random. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Representative half-width (median of per-point mean half) — the REAL track scale. */
function medianHalf(halfL: number[], halfR: number[]): number {
  const hs = halfL
    .map((l, i) => ((l ?? 0) + (halfR[i] ?? 0)) / 2)
    .filter(h => h > 0)
    .sort((a, b) => a - b);
  return hs.length ? hs[hs.length >> 1] : 0.1;
}

/** XZ centroid of the loop — the inside of the circuit (the infield). */
function centroidXZ(pts: Vector3[]): Vector3 {
  const c = new Vector3();
  for (const p of pts) c.add(p);
  return c.divideScalar(pts.length || 1).setY(0);
}

// Ground sits this far below the asphalt so the track never "grasses over" (enough margin
// to clear the coarse terrain-grid's triangle bow on steep climbs, e.g. the run to T1).
const GROUND_DROP = 0.02;

/**
 * Ground elevation at an arbitrary (x,z): inverse-distance-weighted over the centreline's
 * real (GPS) elevations, CLAMPED to never rise above the nearest track point, then dropped
 * a hair. This is the SINGLE ground surface — smooth (no Voronoi steps), it hugs the true
 * elevation and blends between sections, and because it can't exceed the nearest track
 * elevation the asphalt (drawn at that elevation) always sits ON TOP (no grass over track).
 * buildRibbon samples it for the terrain mesh and buildEnvironment drapes every element
 * onto it, so the ground, the barriers and the furniture all share one height.
 */
export function groundHeight(pts: Vector3[], x: number, z: number): number {
  let wsum = 0, ysum = 0, nearY = 0, nearD = Infinity;
  for (let j = 0; j < pts.length; j++) {
    const dx = x - pts[j].x, dz = z - pts[j].z;
    const d2 = dx * dx + dz * dz;
    const wj = 1 / (d2 + 1e-5);
    wsum += wj;
    ysum += wj * pts[j].y;
    if (d2 < nearD) { nearD = d2; nearY = pts[j].y; }
  }
  const idw = wsum > 0 ? ysum / wsum : 0;
  return Math.min(idw, nearY) - GROUND_DROP;
}

// All set-backs are MULTIPLES of the measured half-width `w`, so the dressing scales to
// any reconstructed circuit regardless of the scene's absolute units.
const RUNOFF_MULT = 2.4;   // stand/pit set-back reference (half-widths beyond the edge)
const BARRIER_MULT = 1.2;  // barrier set-back beyond the edge — modest run-off, small enough to rarely fold
const STAND_MULT = 1.5;    // grandstand set-back beyond the barrier
const TREE_MULT = 5.5;     // treeline set well back (distant), OUTFIELD-only
const TREE_CLEAR_MULT = 3.0; // a tree must be at least this many half-widths from EVERY section
const PIT_GAP_MULT = 0.4;  // gap from the barrier to the pit lane
const PIT_LANE_MULT = 1.4; // pit lane width (half-widths)
const GARAGE_BACK_MULT = 1.0;
// Target instance counts — density independent of the centreline's point count; tier-scaled.
const TREES_TOTAL: Record<QualityTier, number> = { high: 40, low: 16 };
const STAND_CAP: Record<QualityTier, number> = { high: 6, low: 2 };

export function buildEnvironment(
  pts: Vector3[], halfL: number[], halfR: number[], tier: QualityTier,
): TrackEnvironment {
  const n = pts.length;
  if (n < 2) return { barrierLeft: [], barrierRight: [], grandstands: [], trees: [], banners: [], pit: null };

  const tans = tangents(pts);
  const side = sideNormals(tans);
  const w = medianHalf(halfL, halfR);
  const runoff = RUNOFF_MULT * w;
  const c = centroidXZ(pts);
  const ang = turnAngles(pts);
  const edgeAt = (i: number, s: 1 | -1) => (s > 0 ? (halfL[i] ?? w) : (halfR[i] ?? w));

  const drape = (v: Vector3): Vector3 => { v.y = groundHeight(pts, v.x, v.z); return v; };

  // Outfield side (away from the enclosed infield), computed ONCE from the point farthest
  // from the centroid — which is unambiguously on the outer boundary. For a simple
  // (non-self-intersecting) loop the outward side is globally consistent, so this single
  // sign is correct everywhere. The old per-point centroid test flipped wrongly at concave
  // sections, dropping trees onto the track (the reported T4 bug). Trees/stands/pit use it;
  // barriers dress both sides.
  let farI = 0, farD = -1;
  for (let i = 0; i < n; i++) {
    const d = pts[i].distanceToSquared(c);
    if (d > farD) { farD = d; farI = i; }
  }
  const farAway = new Vector3().subVectors(pts[farI], c); farAway.y = 0;
  const outSign: 1 | -1 = side[farI].dot(farAway) >= 0 ? 1 : -1;
  const outfield = (_i?: number): 1 | -1 => outSign;

  // BARRIERS — a continuous low wall on each edge at a modest constant set-back. Each point
  // keeps its OWN centreline elevation (pts[i].y — smooth along the track). We deliberately
  // do NOT drape barriers onto the terrain: at the sideways offset the nearest ground can be
  // a DIFFERENT, different-elevation section, so draping made adjacent points jump in height
  // → tilted, flying wall panels (the reported bug). The renderer's deep downward skirt keeps
  // the smooth-topped wall meeting the ground. dropFolds removes the self-crossing that a
  // constant offset produces on the inside of a tight corner.
  const barrierLeft = dropFolds(pts.map((p, i) => p.clone().addScaledVector(side[i], edgeAt(i, 1) + BARRIER_MULT * w)), tans);
  const barrierRight = dropFolds(pts.map((p, i) => p.clone().addScaledVector(side[i], -(edgeAt(i, -1) + BARRIER_MULT * w))), tans);

  // GRANDSTANDS + their BANNERS — sharpest corners only, OUTFIELD side, behind the barrier.
  const corners = cornerIndices(pts, 0.18).sort((a, b) => ang[b] - ang[a]).slice(0, STAND_CAP[tier]);
  const grandstands: Placement[] = [];
  const banners: Placement[] = [];
  for (const i of corners) {
    const s = outfield(i);
    const rotationY = Math.atan2(tans[i].x, tans[i].z);
    grandstands.push({
      position: drape(pts[i].clone().addScaledVector(side[i], s * (edgeAt(i, s) + runoff + STAND_MULT * w))),
      rotationY,
      scale: 1,
    });
    banners.push({
      position: drape(pts[i].clone().addScaledVector(side[i], s * (edgeAt(i, s) + runoff * 0.9))),
      rotationY,
      scale: 1,
    });
  }

  // TREES — a low, small, sparse treeline WELL back on the OUTFIELD side only,
  // deterministic scatter, draped onto the ground.
  const rand = rng(n * 131 + 7);
  const trees: Placement[] = [];
  const tStride = Math.max(1, Math.floor(n / TREES_TOTAL[tier]));
  const clearSq = (TREE_CLEAR_MULT * w) ** 2;
  for (let i = 0; i < n; i += tStride) {
    const s = outfield(i);
    const jitter = Math.abs((rand() - 0.5) * w * 1.5);
    const rotationY = rand() * Math.PI * 2;
    const scale = 0.45 + rand() * 0.4;
    const p = pts[i].clone().addScaledVector(side[i], s * (edgeAt(i, s) + TREE_MULT * w + jitter));
    // Skip any tree that lands on/near ANY track section — on a compact circuit the outer
    // side of one section can still be close to another section, which is how trees ended
    // up on the track at T8/T8-9. Clearance from the WHOLE centreline guarantees none do.
    let near = Infinity;
    for (let j = 0; j < n; j++) {
      const dx = p.x - pts[j].x, dz = p.z - pts[j].z;
      const d = dx * dx + dz * dz;
      if (d < near) near = d;
    }
    if (near < clearSq) continue;
    trees.push({ position: drape(p), rotationY, scale });
  }

  // PIT — a lane + garages along the main straight (longest low-curvature run), just
  // beyond the outfield barrier so it never fouls the track. The lane width tapers to
  // nothing at each end, reading as the pit ENTRY and EXIT.
  const pit = buildPit(pts, tans, side, ang, w, runoff, edgeAt, outfield, drape);

  return { barrierLeft, barrierRight, grandstands, trees, banners, pit };
}

/** Remove self-folded points from an offset polyline: on the INSIDE of a tight corner a
 *  constant offset can exceed the corner radius and fold back on itself. Keep only points
 *  that keep progressing forward along the track (dot with the tangent > 0) so the wall
 *  chords cleanly across the apex instead of tangling. */
function dropFolds(offsetPts: Vector3[], tans: Vector3[]): Vector3[] {
  if (offsetPts.length === 0) return offsetPts;
  const out: Vector3[] = [offsetPts[0]];
  let last = 0;
  const dir = new Vector3();
  for (let i = 1; i < offsetPts.length; i++) {
    dir.subVectors(offsetPts[i], offsetPts[last]); dir.y = 0;
    if (dir.dot(tans[i]) > 0) { out.push(offsetPts[i]); last = i; }
  }
  return out;
}

function buildPit(
  pts: Vector3[], tans: Vector3[], side: Vector3[], ang: number[], w: number,
  runoff: number, edgeAt: (i: number, s: 1 | -1) => number, outfield: (i: number) => 1 | -1,
  drape: (v: Vector3) => Vector3,
): Pit | null {
  const n = pts.length;
  const { start, len } = longestStraight(ang);
  if (len < 10) return null; // no straight long enough for a pit complex
  const s = outfield(start); // consistent along a straight
  const gap = PIT_GAP_MULT * w;
  const laneW = PIT_LANE_MULT * w;
  const garageBack = GARAGE_BACK_MULT * w;
  const taper = Math.max(1, Math.min(8, Math.floor(len / 3)));
  const laneInner: Vector3[] = [];
  const laneOuter: Vector3[] = [];
  const garages: Placement[] = [];
  for (let k = 0; k < len; k++) {
    const i = (start + k) % n;
    const tp = Math.min(1, Math.min(k, len - 1 - k) / taper); // 0 at ends → 1 in the middle
    const base = edgeAt(i, s) + runoff + gap;
    laneInner.push(drape(pts[i].clone().addScaledVector(side[i], s * base)));
    laneOuter.push(drape(pts[i].clone().addScaledVector(side[i], s * (base + laneW * tp))));
    if (tp > 0.8 && k % 3 === 0) {
      garages.push({
        position: drape(pts[i].clone().addScaledVector(side[i], s * (base + laneW + garageBack))),
        rotationY: Math.atan2(tans[i].x, tans[i].z),
        scale: 1,
      });
    }
  }
  return { laneInner, laneOuter, garages };
}
