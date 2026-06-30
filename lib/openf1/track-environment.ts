import { Vector3 } from 'three';
import type { QualityTier } from '@/lib/onboard/useQualityTier';

export interface Placement { position: Vector3; rotationY: number; scale: number }
export interface TrackEnvironment {
  barriersLeft: Vector3[];
  barriersRight: Vector3[];
  grandstands: Placement[];
  trees: Placement[];
  banners: Placement[];
}

const UP = new Vector3(0, 1, 0);

/** Per-point outward normal (tangent × up), left/right side of travel. */
function sideNormals(pts: Vector3[]): Vector3[] {
  const n = pts.length;
  const out: Vector3[] = [];
  const tan = new Vector3();
  for (let i = 0; i < n; i++) {
    tan.subVectors(pts[(i + 1) % n], pts[(i - 1 + n) % n]);
    tan.y = 0;
    if (tan.lengthSq() < 1e-9) tan.set(0, 0, 1); else tan.normalize();
    out.push(new Vector3().crossVectors(UP, tan).normalize());
  }
  return out;
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

/** Seeded PRNG (mulberry32) — deterministic scatter, no Math.random. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BARRIER_GAP = 0.04;   // beyond the track edge
const STAND_SET_BACK = 0.5;
const TREE_SET_BACK = 1.2;

export function buildEnvironment(
  pts: Vector3[], halfL: number[], halfR: number[], tier: QualityTier,
): TrackEnvironment {
  const n = pts.length;
  const side = sideNormals(pts);
  const barriersLeft = pts.map((p, i) => p.clone().addScaledVector(side[i], (halfL[i] ?? 0.1) + BARRIER_GAP));
  const barriersRight = pts.map((p, i) => p.clone().addScaledVector(side[i], -((halfR[i] ?? 0.1) + BARRIER_GAP)));

  // Grandstands at the sharpest corners (outside of the bend), capped per tier.
  const cap = tier === 'high' ? 8 : 3;
  const corners = cornerIndices(pts, 0.18).sort((a, b) => turnAngles(pts)[b] - turnAngles(pts)[a]).slice(0, cap);
  const grandstands: Placement[] = corners.map((i) => ({
    position: pts[i].clone().addScaledVector(side[i], (halfL[i] ?? 0.1) + STAND_SET_BACK),
    rotationY: Math.atan2(side[i].x, side[i].z),
    scale: 1,
  }));

  // Trees scattered along the right runoff at a tier-dependent stride.
  const stride = tier === 'high' ? 2 : 5;
  const rand = rng(n * 131 + 7);
  const trees: Placement[] = [];
  for (let i = 0; i < n; i += stride) {
    const jitter = (rand() - 0.5) * 0.6;
    trees.push({
      position: pts[i].clone().addScaledVector(side[i], -((halfR[i] ?? 0.1) + TREE_SET_BACK + jitter)),
      rotationY: rand() * Math.PI * 2,
      scale: 0.7 + rand() * 0.6,
    });
  }

  // Banners along the left barrier at a fixed stride (both tiers — they read well + are cheap).
  const banners: Placement[] = [];
  for (let i = 0; i < n; i += 6) {
    banners.push({ position: barriersLeft[i].clone(), rotationY: Math.atan2(side[i].x, side[i].z), scale: 1 });
  }
  return { barriersLeft, barriersRight, grandstands, trees, banners };
}
