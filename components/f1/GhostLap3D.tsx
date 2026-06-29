'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Pause, Play } from 'lucide-react';
import * as THREE from 'three';
import { computeDelta, type DriverTrace, type DistSample } from '@/lib/openf1/delta';
import type { EnrichedDriver } from '@/lib/openf1/drivers';
import type { TrackPath, TrackPoint } from '@/lib/openf1/track';

// The onboard comparison view: a TV-style "ghost car" replay. A chase camera
// rides just behind + above the followed driver's car (a team-coloured proxy),
// oriented along the track tangent, while the rival rides the same circuit as a
// time-aligned translucent GHOST — both "launch" at the line at t=0, so you watch
// the ghost pull ahead / drop back turn-by-turn (exactly F1's broadcast Ghost
// Car tool, reconstructed from OpenF1 location + telemetry rather than video).
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

// Chase-camera rig (world units). Close + low — just behind / above the cockpit
// (T-cam). Distances are small because the track + car are scaled near to real
// proportions (see TRACK_HALF_W) so the ribbon never folds through hairpins.
const CAM_BACK = 0.17; // distance behind the car
const CAM_UP = 0.085; // height above the car
const CAM_LOOKAHEAD = 0.55; // how far ahead the camera aims
const CAM_LERP = 0.3; // position smoothing per frame (higher = tighter centring in corners)
const HEADING_DT = 0.22; // seconds ahead used to estimate travel direction

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

// Linear-interpolate an (x, y, z) position along time-ordered track points at lap
// time t, then map to scene space. Clamps to the endpoints outside the recorded span.
function scenePosAtTime(points: TrackPoint[], t: number, cx: number, cy: number): THREE.Vector3 | null {
  if (points.length === 0) return null;
  if (t <= points[0].t) return mapPoint(points[0], cx, cy);
  for (let i = 1; i < points.length; i++) {
    if (points[i].t >= t) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const f = (t - p0.t) / (p1.t - p0.t || 1);
      return mapPoint(
        { x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f, z: p0.z + (p1.z - p0.z) * f },
        cx,
        cy,
      );
    }
  }
  return mapPoint(points[points.length - 1], cx, cy);
}

// Travel direction (XZ plane, Y zeroed) from the point at t to the point a beat
// ahead — the car's heading + the camera's aim. Falls back to +Z when degenerate
// (e.g. clamped at the lap end), so orientation freezes rather than flipping.
function headingDir(points: TrackPoint[], t: number, cx: number, cy: number): THREE.Vector3 {
  const p0 = scenePosAtTime(points, t, cx, cy);
  const p1 = scenePosAtTime(points, t + HEADING_DT, cx, cy);
  const v = new THREE.Vector3(0, 0, 1);
  if (p0 && p1) {
    const d = p1.clone().sub(p0);
    d.y = 0;
    if (d.lengthSq() > 1e-7) v.copy(d.normalize());
  }
  return v;
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
  const op = ghost ? 0.42 : 1;
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
function CarRig({
  points,
  cx,
  cy,
  colour,
  ghost,
  tRef,
}: {
  points: TrackPoint[];
  cx: number;
  cy: number;
  colour: string;
  ghost: boolean;
  tRef: React.RefObject<number>;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = tRef.current ?? 0;
    const pos = scenePosAtTime(points, t, cx, cy);
    if (!pos) return;
    g.position.copy(pos);
    const dir = headingDir(points, t, cx, cy);
    g.rotation.y = Math.atan2(dir.x, dir.z); // align local +Z to travel direction
  });
  return (
    <group ref={ref}>
      <group scale={CAR_SCALE}>
        {/* Re-centre: the model's bounding box sits ~0.13 ahead of the local
            origin (the front wing reaches further than the rear), so shift it
            back — the GPS point then sits at the car's centre, wheels on track. */}
        <group position={[0, 0, -0.13]}>
          <F1Car colour={colour} ghost={ghost} />
        </group>
      </group>
    </group>
  );
}

// Drives the default camera to chase the followed car from behind + above.
function FollowCam({
  points,
  cx,
  cy,
  tRef,
}: {
  points: TrackPoint[];
  cx: number;
  cy: number;
  tRef: React.RefObject<number>;
}) {
  const camera = useThree(s => s.camera);
  const inited = useRef(false);
  useFrame(() => {
    const t = tRef.current ?? 0;
    const pos = scenePosAtTime(points, t, cx, cy);
    if (!pos) return;
    const dir = headingDir(points, t, cx, cy);
    const target = pos.clone().addScaledVector(dir, -CAM_BACK);
    target.y += CAM_UP;
    if (!inited.current) {
      camera.position.copy(target);
      inited.current = true;
    } else {
      camera.position.lerp(target, CAM_LERP);
    }
    const look = pos.clone().addScaledVector(dir, CAM_LOOKAHEAD);
    look.y += 0.02;
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

function buildRibbon(pts: THREE.Vector3[]): {
  asphalt: THREE.BufferGeometry;
  kerbs: THREE.BufferGeometry;
  whiteLines: THREE.BufferGeometry;
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
    const L = pts[i].clone().addScaledVector(side, TRACK_HALF_W);
    const R = pts[i].clone().addScaledVector(side, -TRACK_HALF_W);
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

  return { asphalt, kerbs, whiteLines, left, right };
}

function TrackRibbon({ pts }: { pts: THREE.Vector3[] }) {
  const { asphalt, kerbs, whiteLines } = useMemo(() => buildRibbon(pts), [pts]);
  useEffect(
    () => () => {
      asphalt.dispose();
      kerbs.dispose();
      whiteLines.dispose();
    },
    [asphalt, kerbs, whiteLines],
  );
  return (
    <group>
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
  followPts,
  followColour,
  otherPts,
  otherColour,
  tRef,
}: {
  outline: Mapped;
  followPts: TrackPoint[];
  followColour: string;
  otherPts: TrackPoint[] | null;
  otherColour: string;
  tRef: React.RefObject<number>;
}) {
  return (
    <>
      <color attach="background" args={['#8fa6bb']} />
      <fog attach="fog" args={['#8fa6bb', 0.4, 5]} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 10, 4]} intensity={1.2} />
      <hemisphereLight args={['#cdddee', '#2c3a20', 0.55]} />
      {/* grass groundscape under sky + fog — gives the track a place, not a void */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#2c3a20" roughness={1} metalness={0} />
      </mesh>
      <TrackRibbon pts={outline.pts} />
      <CarRig points={followPts} cx={outline.cx} cy={outline.cy} colour={followColour} ghost={false} tRef={tRef} />
      {otherPts && (
        <CarRig points={otherPts} cx={outline.cx} cy={outline.cy} colour={otherColour} ghost tRef={tRef} />
      )}
      <FollowCam points={followPts} cx={outline.cx} cy={outline.cy} tRef={tRef} />
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

function StateChip({ driver, state }: { driver: EnrichedDriver; state: InputState }) {
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

  const sA = sampleTel(telA, t);
  const sB = sampleTel(telB, t);
  const stateA = inputState(sA.throttle, sA.brake);
  const stateB = inputState(sB.throttle, sB.brake);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">Throttle / brake</span>
        <div className="flex items-center gap-3">
          <StateChip driver={driverA} state={stateA} />
          <StateChip driver={driverB} state={stateB} />
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
}: {
  driverA: EnrichedDriver;
  driverB: EnrichedDriver;
  traceA: DriverTrace;
  traceB: DriverTrace;
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

  // Playback runs over the slower lap so both cars stay on track the whole time.
  const duration = useMemo(
    () => Math.max(traceA.lapTime, traceB.lapTime) || 0,
    [traceA.lapTime, traceB.lapTime],
  );

  // Distance-aligned delta (sign relative to A/B, unchanged), sampled by the
  // faster driver's reached distance.
  const ref = traceA.lapTime <= traceB.lapTime ? traceA : traceB;
  const delta = useMemo(() => computeDelta(traceA, traceB), [traceA, traceB]);
  const gapAt = useCallback(
    (tv: number): number | null => {
      if (delta.length === 0) return null;
      const d = distanceAtTime(ref.telemetry, tv);
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
    [delta, ref],
  );

  // t lives in BOTH a ref (read by the rAF loop + per-frame cam/cars, no re-render)
  // and state (drives the slider + clock + gap + strip playhead, which re-render).
  const tRef = useRef(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
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
            followPts={followedTrace.track!.points}
            followColour={followColour}
            otherPts={otherTrace.track ? otherTrace.track.points : null}
            otherColour={otherColour}
            tRef={tRef}
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
