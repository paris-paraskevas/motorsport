'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { Pause, Play } from 'lucide-react';
import * as THREE from 'three';
import { computeDelta, type DriverTrace, type DistSample } from '@/lib/openf1/delta';
import type { EnrichedDriver } from '@/lib/openf1/drivers';
import type { Circuit, TrackPath, TrackPoint } from '@/lib/openf1/track';
import { CarModel } from '@/components/f1/onboard/CarModel';

// The onboard comparison view: a TV-style "ghost car" replay. A chase camera
// rides behind + above the followed driver's car (a team-coloured proxy), while
// the rival rides the same circuit as a translucent GHOST. Both are TIME-synced —
// shown where each car was at the SAME elapsed time from the lap start — so you
// watch the rival pull ahead / drop back turn-by-turn. The camera sits far enough
// back (CAM_BACK) that the rival, even a few car-lengths behind, stays IN FRONT of
// it: a closer camera (the old 0.17) let the slower car fall behind the near plane
// where perspective explodes — that was the ghost "darting forward then snapping
// back" (the dart was the camera, never the spline/timing). A depth-fade dissolves
// the ghost if it ever does pass behind the camera (a badly mismatched pair). The
// camera AIM comes from a finite-difference heading (sampleHeading), not the raw
// per-frame Hermite velocity, which spiked the aim to ~600°/s at OpenF1's GPS gaps.
// A throttle/brake strip below answers "did he lift?" — THROTTLE-led, because
// OpenF1 brake is 0/100 (force-based, no trail-brake modulation), so the throttle
// trace is the reliable lift signal. Heavy deps (three/drei) live ONLY here and
// load through LazyGhostLap3D (ssr:false + dynamic import), off the critical path.

// --- 3D coordinate mapping ----------------------------------------------
// track.ts gives normalised viewBox coords reproducing the 2D map: x ∈ [0,width]
// (left→right) and y ∈ [0,height] already FLIPPED for SVG (north-up), with z =
// elevation on the same scale. We lay the circuit on the scene XZ ground plane,
// z → world Y as elevation, and map the SVG y straight to world Z (no extra
// negation — the old top-down view double-flipped it, which read mirrored):
//   worldX = (x - cx) / S
//   worldY =  z / S            (elevation up)
//   worldZ = (y - cy) / S      (matches the accepted 2D map's handedness)
// The follow camera derives heading from the path tangent in this same world, so
// left/right read true. S keeps the ~1000-wide track at ~11 world units.
const SCENE_SCALE = 90;

// Chase-camera rig (world units). Behind + above the car, pulled back enough that
// the TIME-synced rival (up to a few car-lengths behind the followed car) stays in
// FRONT of the camera — at the old 0.17 it fell behind the near plane and the
// projection exploded (the "dart forward then snap back"). Distances are small
// because the track + car are scaled near to real proportions (see TRACK_HALF_W).
const CAM_BACK = 0.35; // distance behind the car
const CAM_UP = 0.14; // height above the car
const CAM_LOOKAHEAD = 0.6; // how far ahead the camera aims
const CAM_LERP = 1; // rigid follow: position is smooth AND the heading is finite-difference-smoothed (see sampleHeading), so the camera tracks the car exactly without swimming — raw per-frame Hermite velocity used to spike the aim to ~600°/s at GPS gaps

// Cockpit / onboard T-cam rig: bolted just above + behind the driver's head on the
// followed car, looking forward over the nose (the offsets are tiny — the car model
// is only ~0.08 world units long at CAR_SCALE). Wider FOV than the chase for the
// immersive POV. NB under time-sync the rival is 15-40 m away = usually around the
// next corner / behind you, so in the onboard frustum it's a glimpse on the
// straights, not a constant presence (the chase view is the one for comparing). The
// depth-fade still guards the rare near/behind-camera pass.
type CameraMode = 'chase' | 'cockpit';
const COCKPIT_UP = 0.02; // above the GPS point (≈ above the head)
const COCKPIT_BACK = 0.012; // just behind the head, T-cam style
const COCKPIT_LOOKAHEAD = 0.5; // aim down the track ahead
const CHASE_FOV = 60; // the Canvas default (chase)
const COCKPIT_FOV = 82; // wide onboard view

// Translucent rival overlay + a depth-fade: a rival that drifts behind the camera
// (a badly mismatched pair) dissolves smoothly instead of exploding through the
// near plane. depth = how far in front of the camera (along its view) the ghost is.
const GHOST_OPACITY = 0.42;
const GHOST_FADE_LO = 0.03; // fully hidden at/under this depth
const GHOST_FADE_HI = 0.09; // fully opaque beyond this depth

// The single-seater is modelled ~1.3 long in local units, scaled so it spans
// ~40% of the asphalt width — a ~2 m car on our near-real ~5 m-wide track.
const CAR_SCALE = 0.06;

interface Mapped {
  pts: THREE.Vector3[]; // ground-plane track polyline (with elevation)
  cx: number;
  cy: number;
}

function mapPoint(p: { x: number; y: number; z: number }, cx: number, cy: number): THREE.Vector3 {
  // Guard every axis: a trace whose track.points were KV-cached BEFORE `z` was
  // added (0.114.0) has no z → NaN geometry breaks the whole scene. Coerce any
  // non-finite coord so a stale point sits flat instead of breaking the render.
  const x = Number.isFinite(p.x) ? p.x : cx;
  const y = Number.isFinite(p.y) ? p.y : cy;
  const z = Number.isFinite(p.z) ? p.z : 0;
  return new THREE.Vector3((x - cx) / SCENE_SCALE, z / SCENE_SCALE, (y - cy) / SCENE_SCALE);
}

function mapTrack(track: TrackPath): Mapped {
  const cx = track.width / 2;
  const cy = track.height / 2;
  const pts = track.points.map(p => mapPoint(p, cx, cy));
  return { pts, cx, cy };
}

// A car's lap as a SMOOTH, TIME-CORRECT motion: cleaned scene-space location
// points + their lap-time stamps. samplePos interpolates position with a
// non-uniform Catmull-Rom (Hermite) in the TIME domain (right speed everywhere;
// proven non-overshooting on real GPS). sampleHeading takes the heading from a
// finite difference of samplePos, NOT the analytic Hermite velocity — that
// velocity differentiates ≤1.16 s-gapped GPS, so its DIRECTION spikes to ~600°/s
// at gaps and a rigid chase cam re-aiming off it swims the whole scene.
interface Motion {
  pts: THREE.Vector3[]; // cleaned scene-space points
  times: number[]; // lap-time (s) per point, strictly ascending
}

function buildMotion(points: TrackPoint[], cx: number, cy: number): Motion | null {
  // Pass 1: map to scene space, keep strictly-ascending, non-duplicate points.
  const raw: THREE.Vector3[] = [];
  const rawT: number[] = [];
  for (const p of points) {
    const v = mapPoint(p, cx, cy);
    const lastT = rawT[rawT.length - 1];
    const lastV = raw[raw.length - 1];
    if (lastT !== undefined && p.t <= lastT) continue; // strictly ascending time
    if (lastV && lastV.distanceToSquared(v) < 1e-10) continue; // no zero-length segment
    raw.push(v);
    rawT.push(p.t);
  }
  if (raw.length < 2) return null;

  // Pass 2: drop out-and-back SPIKES (OpenF1 GPS glitches — a sample that juts
  // far off the line and back). The time-spline would otherwise OVERSHOOT through
  // such a point, shooting the car forward then snapping it back — the ghost
  // "jumping forward and backward". A point is a spike when the detour via it is
  // far longer than going straight from its neighbour to the next point.
  const pts: THREE.Vector3[] = [raw[0]];
  const times: number[] = [rawT[0]];
  for (let i = 1; i < raw.length - 1; i++) {
    const prev = pts[pts.length - 1];
    const cur = raw[i];
    const next = raw[i + 1];
    const detour = prev.distanceTo(cur) + cur.distanceTo(next);
    const direct = prev.distanceTo(next);
    if (detour > 2.2 * direct + 1e-6) continue; // spike → drop it
    pts.push(cur);
    times.push(rawT[i]);
  }
  pts.push(raw[raw.length - 1]);
  times.push(rawT[raw.length - 1]);
  if (pts.length < 2) return null;

  // De-jitter the TIMING. OpenF1's location timestamps jitter badly — a real ~0.25 s
  // of travel is often stamped ~0.10 s (and the next interval over-long), so a
  // time-domain spline makes the car ZOOM then CRAWL even though the PATH is smooth.
  // Between two cars that reads as the ghost "falling back then teleporting in front"
  // (relative surges hit ~170 m/s on real data — 2× a car's top speed). The fix:
  // re-derive each point's time from a speed low-passed over ±REHELP_TAU (so genuine
  // braking/accel, which is slower than that, survives) then rescale to the true lap
  // duration — same path, same finish time, physically smooth pacing. Kills the
  // recurring mid-lap surge (217 → 0 frames in the audit).
  const REHELP_TAU = 0.5;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i - 1].distanceTo(pts[i]));
  const rawV = pts.map((_, i) => {
    const a = Math.max(0, i - 1);
    const b = Math.min(pts.length - 1, i + 1);
    return (cum[b] - cum[a]) / ((times[b] - times[a]) || 1e-6);
  });
  const smoothV = rawV.map((_, i) => {
    let acc = 0;
    let w = 0;
    for (let j = 0; j < rawV.length; j++) {
      const d = (times[j] - times[i]) / REHELP_TAU;
      if (Math.abs(d) > 3) continue; // ±3σ window
      const wj = Math.exp(-d * d);
      acc += rawV[j] * wj;
      w += wj;
    }
    return w > 0 ? acc / w : rawV[i];
  });
  const retimed = [times[0]];
  for (let i = 1; i < pts.length; i++) {
    const ds = cum[i] - cum[i - 1];
    const vm = (smoothV[i] + smoothV[i - 1]) / 2 || 1e-6;
    retimed.push(retimed[i - 1] + ds / vm);
  }
  // Rescale to the original [first, last] sample-time span so overall time-sync holds.
  const span = times[times.length - 1] - times[0];
  const newSpan = retimed[retimed.length - 1] - retimed[0];
  const k = newSpan > 1e-6 ? span / newSpan : 1;
  const finalTimes = retimed.map(tt => times[0] + (tt - times[0]) * k);

  return { pts, times: finalTimes };
}

// Position at lap time t via a non-uniform Catmull-Rom Hermite in the TIME domain:
// passes through each sample at its time, C1-smooth, moves at the real speed (no
// index-parameter wobble), clamps at the ends. Proven NON-overshooting on real
// OpenF1 GPS (the cars never backtrack), so monotone/PCHIP tangents are unneeded.
function samplePos(m: Motion, t: number): THREE.Vector3 {
  const { pts, times } = m;
  const n = pts.length;
  if (t <= times[0]) return pts[0].clone();
  if (t >= times[n - 1]) return pts[n - 1].clone();
  let i = 0;
  while (i < n - 1 && times[i + 1] <= t) i++; // segment [i, i+1] with times[i] <= t < times[i+1]
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const t1 = times[i];
  const t2 = times[i + 1];
  const p0 = pts[i - 1] ?? p1;
  const p3 = pts[i + 2] ?? p2;
  const t0 = times[i - 1] ?? t1;
  const t3 = times[i + 2] ?? t2;
  // Non-uniform Catmull-Rom tangents = central finite differences in time (the
  // real velocity around each endpoint), so speed matches reality.
  const m1 = p2.clone().sub(p0).divideScalar((t2 - t0) || 1);
  const m2 = p3.clone().sub(p1).divideScalar((t3 - t1) || 1);
  const h = t2 - t1 || 1;
  const s = (t - t1) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return new THREE.Vector3()
    .addScaledVector(p1, 2 * s3 - 3 * s2 + 1)
    .addScaledVector(m1, (s3 - 2 * s2 + s) * h)
    .addScaledVector(p2, -2 * s3 + 3 * s2)
    .addScaledVector(m2, (s3 - s2) * h);
}

// Half-window (s) for the finite-difference heading. ~one sample period each side
// low-passes the GPS-noise / sampling-gap direction spikes: the analytic Hermite
// velocity hit ~600°/s at gaps; this caps the camera near ~90°/s (a real slow
// corner's rate). Position is smooth, so a heading between two positions HEAD_DT
// apart is stable — unlike the per-frame derivative.
const HEAD_DT = 0.3;

// Forward heading (XZ, y-zeroed) at lap time t — the direction between two SMOOTH
// positions HEAD_DT apart, NOT the analytic velocity. Clamped at the lap ends.
function sampleHeading(m: Motion, t: number): THREE.Vector3 {
  const { times } = m;
  const a = samplePos(m, Math.max(times[0], t - HEAD_DT));
  const b = samplePos(m, Math.min(times[times.length - 1], t + HEAD_DT));
  const d = b.sub(a);
  d.y = 0;
  return d.lengthSq() > 1e-9 ? d.normalize() : new THREE.Vector3(0, 0, 1);
}

function sampleMotion(m: Motion, t: number): { pos: THREE.Vector3; tan: THREE.Vector3 } {
  return { pos: samplePos(m, t), tan: sampleHeading(m, t) };
}

// Distance reached along a trace at lap time t (for the gap readout + strip playhead).
function distanceAtTime(tel: DistSample[], t: number): number {
  if (tel.length === 0) return 0;
  if (t <= tel[0].t) return tel[0].d;
  for (let i = 1; i < tel.length; i++) {
    if (tel[i].t >= t) {
      const p0 = tel[i - 1];
      const p1 = tel[i];
      return p0.d + ((t - p0.t) / (p1.t - p0.t || 1)) * (p1.d - p0.d);
    }
  }
  return tel[tel.length - 1].d;
}

// Throttle/brake/speed at lap time t (linear interp). Brake is 0/100 in OpenF1, so
// the interpolated value is thresholded (>=50 → on the brakes) by the caller.
function sampleTel(tel: DistSample[], t: number): { throttle: number; brake: number; speed: number } {
  if (tel.length === 0) return { throttle: 0, brake: 0, speed: 0 };
  if (t <= tel[0].t) return tel[0];
  for (let i = 1; i < tel.length; i++) {
    if (tel[i].t >= t) {
      const p0 = tel[i - 1];
      const p1 = tel[i];
      const f = (t - p0.t) / (p1.t - p0.t || 1);
      return {
        throttle: p0.throttle + (p1.throttle - p0.throttle) * f,
        brake: p0.brake + (p1.brake - p0.brake) * f,
        speed: p0.speed + (p1.speed - p0.speed) * f,
      };
    }
  }
  return tel[tel.length - 1];
}

type InputState = 'flat' | 'lifting' | 'braking';
function inputState(throttle: number, brake: number): InputState {
  if (brake >= 50) return 'braking';
  if (throttle >= 96) return 'flat';
  return 'lifting';
}
const STATE_LABEL: Record<InputState, string> = { flat: 'flat out', lifting: 'lifting', braking: 'braking' };

// useSyncExternalStore over the media query (repo idiom — see LandingAuth/LocalTime)
// rather than setState-in-effect: hydration-safe (server snapshot = no reduction)
// and no cascading-render lint error.
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    cb => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

function fmtGap(delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${Math.abs(delta).toFixed(3)}`;
}

// --- 3D scene -----------------------------------------------------------

// A stylised but readable open-wheel single-seater (local +Z = forward, sits on
// y=0): survival cell + nose + front/rear wings + sidepods + airbox + 4 open
// wheels. Team colour on bodywork, dark tyres. Scaled by the parent (CAR_SCALE).
function F1Car({ colour, ghost }: { colour: string; ghost: boolean }) {
  const op = ghost ? GHOST_OPACITY : 1;
  const body = {
    color: colour,
    emissive: colour,
    emissiveIntensity: ghost ? 0.5 : 0.22,
    roughness: 0.4,
    metalness: 0.15,
    transparent: ghost,
    opacity: op,
  };
  const tyre = { color: '#141418', roughness: 0.85, metalness: 0.05, transparent: ghost, opacity: op };
  return (
    <group>
      {/* survival cell / floor */}
      <mesh position={[0, 0.11, -0.02]}>
        <boxGeometry args={[0.22, 0.09, 0.84]} />
        <meshStandardMaterial {...body} />
      </mesh>
      {/* nose */}
      <mesh position={[0, 0.1, 0.55]}>
        <boxGeometry args={[0.12, 0.07, 0.34]} />
        <meshStandardMaterial {...body} />
      </mesh>
      {/* front wing */}
      <mesh position={[0, 0.05, 0.74]}>
        <boxGeometry args={[0.5, 0.03, 0.1]} />
        <meshStandardMaterial {...body} />
      </mesh>
      {/* sidepods */}
      <mesh position={[0.17, 0.1, -0.05]}>
        <boxGeometry args={[0.1, 0.1, 0.34]} />
        <meshStandardMaterial {...body} />
      </mesh>
      <mesh position={[-0.17, 0.1, -0.05]}>
        <boxGeometry args={[0.1, 0.1, 0.34]} />
        <meshStandardMaterial {...body} />
      </mesh>
      {/* airbox / engine cover */}
      <mesh position={[0, 0.22, -0.14]}>
        <boxGeometry args={[0.1, 0.14, 0.34]} />
        <meshStandardMaterial {...body} />
      </mesh>
      {/* cockpit hump */}
      <mesh position={[0, 0.17, 0.08]}>
        <boxGeometry args={[0.13, 0.06, 0.2]} />
        <meshStandardMaterial {...body} />
      </mesh>
      {/* rear wing + endplates */}
      <mesh position={[0, 0.28, -0.46]}>
        <boxGeometry args={[0.46, 0.1, 0.04]} />
        <meshStandardMaterial {...body} />
      </mesh>
      <mesh position={[0.23, 0.22, -0.46]}>
        <boxGeometry args={[0.02, 0.2, 0.12]} />
        <meshStandardMaterial {...body} />
      </mesh>
      <mesh position={[-0.23, 0.22, -0.46]}>
        <boxGeometry args={[0.02, 0.2, 0.12]} />
        <meshStandardMaterial {...body} />
      </mesh>
      {/* open wheels — cylinders with the axle along X */}
      {([[0.27, 0.47], [-0.27, 0.47], [0.27, -0.4], [-0.27, -0.4]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.13, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.13, 0.13, 0.15, 18]} />
          <meshStandardMaterial {...tyre} />
        </mesh>
      ))}
    </group>
  );
}

// Positions + orients a car each frame from the live `t` in a ref (no re-render).
// Both cars are TIME-synced — sampled at the SAME elapsed `t`. The ghost also fades
// as it nears / passes behind the camera (its depth in front of the camera drops
// below GHOST_FADE_*), so a far-behind rival dissolves instead of exploding through
// the near plane.
function CarRig({
  motion,
  colour,
  ghost,
  tRef,
}: {
  motion: Motion;
  colour: string;
  ghost: boolean;
  tRef: React.RefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);
  const camera = useThree(s => s.camera);
  const camFwd = useRef(new THREE.Vector3());
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const { pos, tan } = sampleMotion(motion, tRef.current ?? 0);
    g.position.copy(pos);
    g.rotation.y = Math.atan2(tan.x, tan.z); // align local +Z to travel direction
    if (ghost) {
      camera.getWorldDirection(camFwd.current); // unit camera view direction
      const depth =
        (pos.x - camera.position.x) * camFwd.current.x +
        (pos.y - camera.position.y) * camFwd.current.y +
        (pos.z - camera.position.z) * camFwd.current.z;
      const fade = THREE.MathUtils.clamp(
        (depth - GHOST_FADE_LO) / (GHOST_FADE_HI - GHOST_FADE_LO),
        0,
        1,
      );
      g.visible = fade > 0.02;
      if (g.visible) {
        g.traverse(o => {
          const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (mat && mat.transparent) mat.opacity = GHOST_OPACITY * fade;
        });
      }
    }
  });
  return (
    <group ref={ref}>
      <CarModel colour={colour} ghost={ghost} />
    </group>
  );
}

// Drives the default camera: a CHASE cam behind + above the car, or a COCKPIT
// (onboard T-cam) bolted on the car just above the driver's head, looking forward
// over the nose. Both rigid (the heading is FD-smoothed, so no lag is needed) —
// switching mode jumps cleanly (CAM_LERP = 1).
function FollowCam({
  motion,
  tRef,
  mode,
}: {
  motion: Motion;
  tRef: React.RefObject<number>;
  mode: CameraMode;
}) {
  const camera = useThree(s => s.camera);
  const inited = useRef(false);
  // FOV is set declaratively by the <PerspectiveCamera> in Scene (mutating the
  // hook-returned camera trips react-hooks/immutability); here we only drive its
  // position + aim, via method calls, which is allowed.
  useFrame(() => {
    const { pos, tan } = sampleMotion(motion, tRef.current ?? 0);
    const cockpit = mode === 'cockpit';
    const target = pos.clone().addScaledVector(tan, cockpit ? -COCKPIT_BACK : -CAM_BACK);
    target.y += cockpit ? COCKPIT_UP : CAM_UP;
    if (!inited.current) {
      camera.position.copy(target);
      inited.current = true;
    } else {
      camera.position.lerp(target, CAM_LERP);
    }
    const look = pos.clone().addScaledVector(tan, cockpit ? COCKPIT_LOOKAHEAD : CAM_LOOKAHEAD);
    look.y += cockpit ? COCKPIT_UP * 0.5 : 0.02;
    camera.lookAt(look);
  });
  return null;
}

// Build the track surface from the centreline points: offset ±halfWidth along the
// ground-plane perpendicular (tangent × up) and triangulate between cross-sections
// into an asphalt strip carrying the real x/y/z (climbs + falls with elevation),
// inset with a thin white track-limit line and flanked by red/white kerbs. Width
// is near real proportions (small vs the circuit) so it never folds at hairpins.
const TRACK_HALF_W = 0.1;
const KERB_W = 0.03; // kerb strip width just outside each asphalt edge
const WHITE_W = 0.014; // white track-limit line, inset at each asphalt edge
const KERB_BAND = 5; // centreline points per alternating red/white band
const KERB_RED = [0.74, 0.12, 0.12];
const KERB_WHITE = [0.9, 0.9, 0.92];
const TERRAIN_GRID = 64; // ground heightfield resolution (per axis)
const TERRAIN_DROP = 0.02; // terrain sits just below the asphalt

function buildRibbon(pts: THREE.Vector3[], halfL: number[], halfR: number[]): {
  asphalt: THREE.BufferGeometry;
  kerbs: THREE.BufferGeometry;
  whiteLines: THREE.BufferGeometry;
  terrain: THREE.BufferGeometry;
  left: THREE.Vector3[];
  right: THREE.Vector3[];
} {
  const n = pts.length;
  const positions = new Float32Array(n * 2 * 3);
  const left: THREE.Vector3[] = [];
  const right: THREE.Vector3[] = [];
  const sides: THREE.Vector3[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    tangent.subVectors(next, prev);
    tangent.y = 0; // width is horizontal; ignore banking
    if (tangent.lengthSq() < 1e-9) tangent.set(0, 0, 1);
    else tangent.normalize();
    side.crossVectors(tangent, up).normalize();
    sides.push(side.clone());
    const L = pts[i].clone().addScaledVector(side, halfL[i] ?? TRACK_HALF_W);
    const R = pts[i].clone().addScaledVector(side, -(halfR[i] ?? TRACK_HALF_W));
    left.push(L);
    right.push(R);
    positions[i * 6] = L.x;
    positions[i * 6 + 1] = L.y;
    positions[i * 6 + 2] = L.z;
    positions[i * 6 + 3] = R.x;
    positions[i * 6 + 4] = R.y;
    positions[i * 6 + 5] = R.z;
  }
  const indices: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, b, c, b, d, c);
  }
  const asphalt = new THREE.BufferGeometry();
  asphalt.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  asphalt.setIndex(indices);
  asphalt.computeVertexNormals();

  // Kerbs: a non-indexed, vertex-coloured strip just outside each edge, the
  // colour alternating in bands for the classic red/white look.
  const kPos: number[] = [];
  const kCol: number[] = [];
  const pushVert = (v: THREE.Vector3, c: number[]) => {
    kPos.push(v.x, v.y, v.z);
    kCol.push(c[0], c[1], c[2]);
  };
  const addQuad = (
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    p3: THREE.Vector3,
    c: number[],
  ) => {
    pushVert(p0, c);
    pushVert(p1, c);
    pushVert(p2, c);
    pushVert(p1, c);
    pushVert(p3, c);
    pushVert(p2, c);
  };
  for (let i = 0; i < n - 1; i++) {
    const c = Math.floor(i / KERB_BAND) % 2 === 0 ? KERB_RED : KERB_WHITE;
    addQuad(
      left[i],
      left[i].clone().addScaledVector(sides[i], KERB_W),
      left[i + 1],
      left[i + 1].clone().addScaledVector(sides[i + 1], KERB_W),
      c,
    );
    addQuad(
      right[i],
      right[i].clone().addScaledVector(sides[i], -KERB_W),
      right[i + 1],
      right[i + 1].clone().addScaledVector(sides[i + 1], -KERB_W),
      c,
    );
  }
  const kerbs = new THREE.BufferGeometry();
  kerbs.setAttribute('position', new THREE.Float32BufferAttribute(kPos, 3));
  kerbs.setAttribute('color', new THREE.Float32BufferAttribute(kCol, 3));
  kerbs.computeVertexNormals();
  kerbs.translate(0, 0.001, 0); // lift off the asphalt plane to avoid z-fighting

  // White track-limit line: a thin solid strip inset just inside each asphalt edge.
  const wPos: number[] = [];
  const pushW = (v: THREE.Vector3) => wPos.push(v.x, v.y, v.z);
  const addW = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) => {
    pushW(p0);
    pushW(p1);
    pushW(p2);
    pushW(p1);
    pushW(p3);
    pushW(p2);
  };
  for (let i = 0; i < n - 1; i++) {
    addW(
      left[i],
      left[i].clone().addScaledVector(sides[i], -WHITE_W),
      left[i + 1],
      left[i + 1].clone().addScaledVector(sides[i + 1], -WHITE_W),
    );
    addW(
      right[i],
      right[i].clone().addScaledVector(sides[i], WHITE_W),
      right[i + 1],
      right[i + 1].clone().addScaledVector(sides[i + 1], WHITE_W),
    );
  }
  const whiteLines = new THREE.BufferGeometry();
  whiteLines.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
  whiteLines.computeVertexNormals();
  whiteLines.translate(0, 0.0015, 0); // sit just above the asphalt

  // Terrain: ONE heightfield grid draped over the track's elevation — each grid
  // vertex takes the height of the nearest centreline point — so the ground is a
  // single surface that climbs + falls with the circuit. No folding, nothing
  // running over/under the track (the old wide grass apron self-overlapped).
  let tMinX = Infinity;
  let tMaxX = -Infinity;
  let tMinZ = Infinity;
  let tMaxZ = -Infinity;
  for (const p of pts) {
    if (p.x < tMinX) tMinX = p.x;
    if (p.x > tMaxX) tMaxX = p.x;
    if (p.z < tMinZ) tMinZ = p.z;
    if (p.z > tMaxZ) tMaxZ = p.z;
  }
  const margin = (Math.max(tMaxX - tMinX, tMaxZ - tMinZ) || 1) * 0.3 + 2;
  tMinX -= margin;
  tMaxX += margin;
  tMinZ -= margin;
  tMaxZ += margin;
  const G = TERRAIN_GRID;
  const gx = (ix: number) => tMinX + ((tMaxX - tMinX) * ix) / (G - 1);
  const gz = (iz: number) => tMinZ + ((tMaxZ - tMinZ) * iz) / (G - 1);
  const height = new Array<number>(G * G);
  for (let iz = 0; iz < G; iz++) {
    for (let ix = 0; ix < G; ix++) {
      const x = gx(ix);
      const z = gz(iz);
      let by = 0;
      let bd = Infinity;
      for (const p of pts) {
        const dx = x - p.x;
        const dz = z - p.z;
        const d = dx * dx + dz * dz;
        if (d < bd) {
          bd = d;
          by = p.y;
        }
      }
      height[iz * G + ix] = by;
    }
  }
  // Box-blur the heightfield so it reads as smooth terrain, not Voronoi steps.
  for (let pass = 0; pass < 2; pass++) {
    const src = height.slice();
    for (let iz = 0; iz < G; iz++) {
      for (let ix = 0; ix < G; ix++) {
        let s = 0;
        let c = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const jx = ix + dx;
            const jz = iz + dz;
            if (jx >= 0 && jx < G && jz >= 0 && jz < G) {
              s += src[jz * G + jx];
              c += 1;
            }
          }
        }
        height[iz * G + ix] = s / c;
      }
    }
  }
  const tPos = new Float32Array(G * G * 3);
  for (let iz = 0; iz < G; iz++) {
    for (let ix = 0; ix < G; ix++) {
      const o = (iz * G + ix) * 3;
      tPos[o] = gx(ix);
      tPos[o + 1] = height[iz * G + ix] - TERRAIN_DROP;
      tPos[o + 2] = gz(iz);
    }
  }
  const tIdx: number[] = [];
  for (let iz = 0; iz < G - 1; iz++) {
    for (let ix = 0; ix < G - 1; ix++) {
      const a = iz * G + ix;
      const b = a + 1;
      const c2 = a + G;
      const d = c2 + 1;
      tIdx.push(a, c2, b, b, c2, d);
    }
  }
  const terrain = new THREE.BufferGeometry();
  terrain.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  terrain.setIndex(tIdx);
  terrain.computeVertexNormals();

  return { asphalt, kerbs, whiteLines, terrain, left, right };
}

function TrackRibbon({ pts, halfL, halfR }: { pts: THREE.Vector3[]; halfL: number[]; halfR: number[] }) {
  const { asphalt, kerbs, whiteLines, terrain } = useMemo(() => buildRibbon(pts, halfL, halfR), [pts, halfL, halfR]);
  useEffect(
    () => () => {
      asphalt.dispose();
      kerbs.dispose();
      whiteLines.dispose();
      terrain.dispose();
    },
    [asphalt, kerbs, whiteLines, terrain],
  );
  return (
    <group>
      <mesh geometry={terrain}>
        <meshStandardMaterial color="#2c3a20" roughness={1} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={asphalt}>
        <meshStandardMaterial color="#2b2b33" roughness={0.95} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={whiteLines}>
        <meshStandardMaterial color="#eef0f4" roughness={0.6} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={kerbs}>
        <meshStandardMaterial vertexColors roughness={0.7} metalness={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Scene({
  outline,
  ribbon,
  followPts,
  followColour,
  otherPts,
  otherColour,
  tRef,
  cameraMode,
}: {
  outline: Mapped;
  ribbon: { pts: THREE.Vector3[]; halfL: number[]; halfR: number[] };
  followPts: TrackPoint[];
  followColour: string;
  otherPts: TrackPoint[] | null;
  otherColour: string;
  tRef: React.RefObject<number>;
  cameraMode: CameraMode;
}) {
  const followMotion = useMemo(
    () => buildMotion(followPts, outline.cx, outline.cy),
    [followPts, outline.cx, outline.cy],
  );
  const otherMotion = useMemo(
    () => (otherPts ? buildMotion(otherPts, outline.cx, outline.cy) : null),
    [otherPts, outline.cx, outline.cy],
  );
  return (
    <>
      {/* Default camera — FOV declarative (wider for the cockpit); FollowCam drives
          its position + aim each frame. */}
      <PerspectiveCamera
        makeDefault
        fov={cameraMode === 'cockpit' ? COCKPIT_FOV : CHASE_FOV}
        near={0.02}
        far={60}
      />
      <color attach="background" args={['#8fa6bb']} />
      <fog attach="fog" args={['#8fa6bb', 0.4, 5]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 10, 4]} intensity={1.2} />
      <hemisphereLight args={['#cdddee', '#2c3a20', 0.55]} />
      {/* The grass apron now lives inside TrackRibbon so it follows the track's
          own elevation (climbs + falls with it) instead of a flat plane. */}
      <TrackRibbon pts={ribbon.pts} halfL={ribbon.halfL} halfR={ribbon.halfR} />
      {followMotion && <CarRig motion={followMotion} colour={followColour} ghost={false} tRef={tRef} />}
      {otherMotion && <CarRig motion={otherMotion} colour={otherColour} ghost tRef={tRef} />}
      {followMotion && <FollowCam motion={followMotion} tRef={tRef} mode={cameraMode} />}
    </>
  );
}

// --- throttle / brake strip --------------------------------------------
const VW = 1000;
const PAD = 12;
const THR_TOP = 10; // y at 100% throttle
const THR_BOT = 104; // y at 0% throttle
const BRAKE_A_Y = 110;
const BRAKE_B_Y = 122;
const BRAKE_H = 8;

function xForDist(d: number, maxD: number): number {
  return PAD + (Math.max(0, Math.min(d, maxD)) / (maxD || 1)) * (VW - 2 * PAD);
}
function yForThrottle(v: number): number {
  return THR_BOT - (Math.max(0, Math.min(100, v)) / 100) * (THR_BOT - THR_TOP);
}
function throttlePath(tel: DistSample[], maxD: number): string {
  let d = '';
  for (let i = 0; i < tel.length; i++) {
    const s = tel[i];
    d += `${i === 0 ? 'M' : 'L'}${xForDist(s.d, maxD).toFixed(1)} ${yForThrottle(s.throttle).toFixed(1)}`;
  }
  return d;
}
function brakeSegments(tel: DistSample[], maxD: number, yTop: number, colour: string, keyP: string) {
  const segs: React.ReactNode[] = [];
  for (let i = 1; i < tel.length; i++) {
    if (tel[i - 1].brake >= 50) {
      const x0 = xForDist(tel[i - 1].d, maxD);
      const x1 = xForDist(tel[i].d, maxD);
      segs.push(
        <rect key={`${keyP}${i}`} x={x0} y={yTop} width={Math.max(1, x1 - x0)} height={BRAKE_H} fill={colour} opacity={0.75} />,
      );
    }
  }
  return segs;
}

// Position (track x/y) at lap time t — linear interp, clamped. Used to derive the
// exact turn (yaw) the car makes from its real GPS path.
function posXYAt(points: TrackPoint[], t: number): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (t <= points[0].t) return { x: points[0].x, y: points[0].y };
  for (let i = 1; i < points.length; i++) {
    if (points[i].t >= t) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const f = (t - p0.t) / (p1.t - p0.t || 1);
      return { x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f };
    }
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
}

// Heading in degrees (atan2(dx, dy) — same convention as the 3D car rotation, so
// left/right agree with the scene) from the path direction at lap time t.
function headingDeg(points: TrackPoint[], t: number): number {
  const a = posXYAt(points, t - 0.15);
  const b = posXYAt(points, t + 0.15);
  return (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
}

// Signed turn rate in °/s at lap time t (− = right, + = left, in TrackPoint's
// south-positive frame), central-differenced from the heading — the exact yaw the
// GPS path makes (no steering feed). The caller maps the sign to ◀/▶ arrows.
function turnRateAt(points: TrackPoint[], t: number): number {
  const dt = 0.3;
  let d = headingDeg(points, t + dt / 2) - headingDeg(points, t - dt / 2);
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d / dt;
}

function StateChip({ driver, state, turn }: { driver: EnrichedDriver; state: InputState; turn: number }) {
  const turning = Math.abs(turn) >= 4; // °/s threshold for "in a corner"
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: driver.teamColour }} />
      <span className="font-semibold text-text">{driver.code}</span>
      <span
        className={
          state === 'braking'
            ? 'text-[#ef4444]'
            : state === 'flat'
              ? 'text-emerald-400'
              : 'text-amber-400'
        }
      >
        {STATE_LABEL[state]}
      </span>
      <span className="tabular-nums text-text-faint">
        {turning ? `${turn > 0 ? '◀' : '▶'} ${Math.round(Math.abs(turn))}°/s` : '▲'}
      </span>
    </span>
  );
}

function TelemetryStrip({
  driverA,
  driverB,
  traceA,
  traceB,
  t,
  followingA,
}: {
  driverA: EnrichedDriver;
  driverB: EnrichedDriver;
  traceA: DriverTrace;
  traceB: DriverTrace;
  t: number;
  followingA: boolean;
}) {
  const telA = traceA.telemetry;
  const telB = traceB.telemetry;
  const maxD = useMemo(
    () => Math.max(telA.length ? telA[telA.length - 1].d : 0, telB.length ? telB[telB.length - 1].d : 0) || 1,
    [telA, telB],
  );
  const pathA = useMemo(() => throttlePath(telA, maxD), [telA, maxD]);
  const pathB = useMemo(() => throttlePath(telB, maxD), [telB, maxD]);
  const brakeA = useMemo(() => brakeSegments(telA, maxD, BRAKE_A_Y, driverA.teamColour, 'a'), [telA, maxD, driverA.teamColour]);
  const brakeB = useMemo(() => brakeSegments(telB, maxD, BRAKE_B_Y, driverB.teamColour, 'b'), [telB, maxD, driverB.teamColour]);

  // Playhead follows the followed car's distance so it lines up with the chase cam.
  const phTel = followingA ? telA : telB;
  const phX = xForDist(distanceAtTime(phTel, t), maxD);

  // Time-synced: both cars' instantaneous readouts at the same elapsed t.
  const sA = sampleTel(telA, t);
  const sB = sampleTel(telB, t);
  const stateA = inputState(sA.throttle, sA.brake);
  const stateB = inputState(sB.throttle, sB.brake);
  const turnA = traceA.track ? turnRateAt(traceA.track.points, t) : 0;
  const turnB = traceB.track ? turnRateAt(traceB.track.points, t) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">Throttle / brake</span>
        <div className="flex items-center gap-3">
          <StateChip driver={driverA} state={stateA} turn={turnA} />
          <StateChip driver={driverB} state={stateB} turn={turnB} />
        </div>
      </div>
      <svg
        viewBox={`0 0 ${VW} 134`}
        className="h-auto w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Throttle and brake traces for both drivers across the lap"
      >
        {/* throttle frame */}
        <line x1={PAD} y1={THR_TOP} x2={VW - PAD} y2={THR_TOP} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" />
        <line x1={PAD} y1={THR_BOT} x2={VW - PAD} y2={THR_BOT} stroke="var(--border)" strokeWidth={1} />
        {/* rival drawn first (under), followed on top */}
        <path
          d={followingA ? pathB : pathA}
          fill="none"
          stroke={followingA ? driverB.teamColour : driverA.teamColour}
          strokeWidth={1.5}
          strokeOpacity={0.55}
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={followingA ? pathA : pathB}
          fill="none"
          stroke={followingA ? driverA.teamColour : driverB.teamColour}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        {/* brake on/off rows */}
        {brakeA}
        {brakeB}
        {/* playhead */}
        <line x1={phX} y1={4} x2={phX} y2={130} stroke="var(--text)" strokeWidth={1.25} strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-text-faint">
        <span>100% throttle (top) → 0% (bottom)</span>
        <span aria-hidden>·</span>
        <span>brake on = filled bar</span>
        <span aria-hidden>·</span>
        <span>{driverA.code} solid · {driverB.code} dashed (followed car solid)</span>
      </div>
    </div>
  );
}

// --- main ---------------------------------------------------------------

export function GhostLap3D({
  driverA,
  driverB,
  traceA,
  traceB,
  circuit,
}: {
  driverA: EnrichedDriver;
  driverB: EnrichedDriver;
  traceA: DriverTrace;
  traceB: DriverTrace;
  circuit?: Circuit | null;
}) {
  const reduced = usePrefersReducedMotion();

  const aHasTrack = !!traceA.track;
  const bHasTrack = !!traceB.track;

  // Which car the camera follows (solid). Defaults to A; the toggle respects the
  // pick only when that car actually has a position trace, else follows the one
  // that does.
  const [followAState, setFollowAState] = useState(true);
  const followingA = followAState ? aHasTrack || !bHasTrack : !(bHasTrack || !aHasTrack);

  const followedTrace = followingA ? traceA : traceB;
  const otherTrace = followingA ? traceB : traceA;
  const followColour = followingA ? driverA.teamColour : driverB.teamColour;
  const otherColour = followingA ? driverB.teamColour : driverA.teamColour;

  const mapped = useMemo(
    () => (followedTrace.track ? mapTrack(followedTrace.track) : null),
    [followedTrace.track],
  );

  // Ribbon = the reconstructed circuit (centreline + measured per-point width, so
  // the cars sit on a real-width track at their true positions) when available,
  // else the followed car's own line at a uniform width.
  const ribbon = useMemo(() => {
    if (!mapped) return null;
    const { cx, cy } = mapped;
    if (circuit && circuit.points.length > 2) {
      return {
        pts: circuit.points.map(p => mapPoint(p, cx, cy)),
        halfL: circuit.halfLeft.map(w => w / SCENE_SCALE),
        halfR: circuit.halfRight.map(w => w / SCENE_SCALE),
      };
    }
    const uniform = mapped.pts.map(() => TRACK_HALF_W);
    return { pts: mapped.pts, halfL: uniform, halfR: uniform };
  }, [circuit, mapped]);

  // Time-synced playback runs over the slower lap so both cars stay on track the
  // whole time (the faster car clamps at its finish while the slower completes).
  const duration = useMemo(
    () => Math.max(traceA.lapTime, traceB.lapTime) || 0,
    [traceA.lapTime, traceB.lapTime],
  );

  // Distance-aligned delta (sign: + → B behind A). At elapsed `tv`, read the delta
  // at the distance the FOLLOWED car (the one the camera rides) has reached — i.e.
  // the time gap between the two cars at that point on the track.
  const delta = useMemo(() => computeDelta(traceA, traceB), [traceA, traceB]);
  const gapAt = useCallback(
    (tv: number): number | null => {
      if (delta.length === 0) return null;
      const d = distanceAtTime(followedTrace.telemetry, tv);
      if (d <= delta[0].d) return delta[0].delta;
      for (let i = 1; i < delta.length; i++) {
        if (delta[i].d >= d) {
          const p0 = delta[i - 1];
          const p1 = delta[i];
          return p0.delta + ((d - p0.d) / (p1.d - p0.d || 1)) * (p1.delta - p0.delta);
        }
      }
      return delta[delta.length - 1].delta;
    },
    [delta, followedTrace],
  );

  // t lives in BOTH a ref (read by the rAF loop + per-frame cam/cars, no re-render)
  // and state (drives the slider + clock + gap + strip playhead, which re-render).
  const tRef = useRef(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  // Camera view: Chase (default — frames both cars for the comparison) or Cockpit
  // (onboard T-cam on the followed car, above the head; immersive POV).
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const applyT = useCallback((v: number) => {
    tRef.current = v;
    setT(v);
  }, []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      const next = tRef.current + dt * speed;
      const wrapped = next >= duration ? 0 : next; // loop
      tRef.current = wrapped;
      setT(wrapped);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [playing, duration, speed]);

  const toggle = useCallback(() => {
    if (reduced) return; // scrub-only in reduced motion
    setPlaying(p => !p);
  }, [reduced]);

  const onScrub = useCallback(
    (v: number) => {
      setPlaying(false);
      applyT(v);
    },
    [applyT],
  );

  if (!mapped) {
    return (
      <div className="flex h-80 items-center justify-center rounded-md border border-border bg-surface/40 text-center text-sm text-text-faint md:h-[28rem]">
        Onboard view unavailable for this session.
      </div>
    );
  }

  const gap = gapAt(t);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-text">Onboard · ghost comparison</h3>
        <span className="font-mono text-[11px] tabular-nums text-text-muted">
          {gap == null ? (
            <span className="text-text-faint">gap unavailable</span>
          ) : (
            <>
              <span className="text-text-faint">gap </span>
              <span
                className="font-semibold"
                style={{ color: gap > 0 ? driverA.teamColour : gap < 0 ? driverB.teamColour : 'var(--text)' }}
              >
                {fmtGap(gap)}s
              </span>{' '}
              <span className="text-text-faint">to {gap >= 0 ? driverA.code : driverB.code}</span>
            </>
          )}
        </span>
      </div>

      <div className="h-80 overflow-hidden rounded-md border border-border bg-surface md:h-[28rem]">
        <Canvas camera={{ position: [0.3, 0.2, 0.5], fov: 60, near: 0.02, far: 60 }} dpr={[1, 2]}>
          <Scene
            outline={mapped}
            ribbon={ribbon!}
            followPts={followedTrace.track!.points}
            followColour={followColour}
            otherPts={otherTrace.track ? otherTrace.track.points : null}
            otherColour={otherColour}
            tRef={tRef}
            cameraMode={cameraMode}
          />
        </Canvas>
      </div>

      {/* Transport: play/pause (hidden under reduced motion) + scrub + clock. */}
      <div className="flex items-center gap-3">
        {!reduced && (
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Pause replay' : 'Play replay'}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong text-text transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-brand"
          >
            {playing ? <Pause size={14} /> : <Play size={14} className="translate-x-px" />}
          </button>
        )}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={Math.min(t, duration)}
          onChange={e => onScrub(Number(e.target.value))}
          aria-label="Scrub replay position"
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-brand"
        />
        <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-muted">
          {t.toFixed(2)}s
        </span>
        <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Playback speed">
          {([0.5, 1, 2, 4] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={`border px-1.5 py-0.5 font-mono text-[10px] tabular-nums transition-colors duration-(--duration-fast) ${
                speed === s
                  ? 'border-border-strong bg-surface text-text'
                  : 'border-border text-text-faint hover:border-border-strong hover:text-text-muted'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {reduced && (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          Reduced-motion: drag to scrub.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-text-muted">
          <LegendDot colour={followColour} label={`${followingA ? driverA.code : driverB.code} (you)`} />
          <LegendDot colour={otherColour} label={`${followingA ? driverB.code : driverA.code} (ghost)`} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {/* Camera view — Chase (best for comparing) or Cockpit (immersive onboard
              T-cam above the head; the time-synced rival is a glimpse on straights). */}
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">View</span>
            {([['Chase', 'chase'], ['Cockpit', 'cockpit']] as const).map(([label, m]) => (
              <button
                key={m}
                type="button"
                onClick={() => setCameraMode(m)}
                aria-pressed={cameraMode === m}
                className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-(--duration-fast) ${
                  cameraMode === m
                    ? 'border-border-strong bg-surface text-text'
                    : 'border-border text-text-faint hover:border-border-strong hover:text-text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Follow toggle — which car the camera rides. Disabled for a car with no trace. */}
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">Follow</span>
            {([[driverA.code, true, aHasTrack], [driverB.code, false, bHasTrack]] as const).map(
              ([label, isA, enabled]) => (
                <button
                  key={label}
                  type="button"
                  disabled={!enabled}
                  onClick={() => setFollowAState(isA)}
                  aria-pressed={followingA === isA}
                  className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-(--duration-fast) ${
                    followingA === isA
                      ? 'border-border-strong bg-surface text-text'
                      : enabled
                        ? 'border-border text-text-faint hover:border-border-strong hover:text-text-muted'
                        : 'cursor-not-allowed border-border text-text-faint/40'
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <TelemetryStrip
        driverA={driverA}
        driverB={driverB}
        traceA={traceA}
        traceB={traceB}
        t={t}
        followingA={followingA}
      />
    </div>
  );
}

function LegendDot({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colour }} />
      {label}
    </span>
  );
}
