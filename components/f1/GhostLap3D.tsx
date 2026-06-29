'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import { Pause, Play } from 'lucide-react';
import * as THREE from 'three';
import { computeDelta, type DriverTrace } from '@/lib/openf1/delta';
import type { EnrichedDriver } from '@/lib/openf1/drivers';
import type { TrackPath, TrackPoint } from '@/lib/openf1/track';

// The 3D wow view: the self-drawn circuit laid flat on the ground plane with
// real elevation, two team-coloured spheres advancing along each driver's own
// track.points by elapsed lap time t. Mirrors GhostLapReplay's playback exactly
// (rAF loop, scrub slider, running gap, prefers-reduced-motion → scrub only) but
// renders in three.js via @react-three/fiber + drei. Heavy deps (three/drei) are
// imported ONLY here and the file is mounted through LazyGhostLap3D (ssr:false +
// dynamic import), so they never reach the critical/home path.

// --- coordinate mapping --------------------------------------------------
// track.ts gives normalised viewBox coords: x ∈ [0,width] (left→right), y ∈
// [0,height] already FLIPPED for SVG (y-down, larger y = lower on screen), and
// z = elevation on the same scale (0 = lowest point). We lay the circuit on the
// ground (scene XZ plane) with z → world Y as elevation:
//   worldX =  (x - cx) / S
//   worldY =  z / S                       (elevation up)
//   worldZ = -(y - cy) / S                 (negate to undo the SVG y-flip, so
//                                           the layout reads the same handedness
//                                           as the 2D map rather than mirrored)
// S keeps the ~1000-wide track at ~10 world units. Centring uses the track's
// own bounds so the circuit sits on the origin regardless of viewBox padding.
const SCENE_SCALE = 90;

interface Mapped {
  pts: THREE.Vector3[]; // ground-plane track polyline (with elevation)
  cx: number;
  cy: number;
}

function mapPoint(p: { x: number; y: number; z: number }, cx: number, cy: number): THREE.Vector3 {
  // Guard every axis against non-finite values. A trace whose track.points were
  // KV-cached BEFORE the 3D view added `z` (0.114.0) has no `z` key, so `p.z` is
  // undefined → `undefined / SCENE_SCALE` = NaN → drei's <Line> geometry gets a
  // NaN bounding sphere and the whole scene fails to render (the "3D doesn't work
  // at all" bug). Coerce any non-finite coord so a stale/partial point sits flat
  // instead of breaking the geometry; elevation self-heals as caches refresh.
  const x = Number.isFinite(p.x) ? p.x : cx;
  const y = Number.isFinite(p.y) ? p.y : cy;
  const z = Number.isFinite(p.z) ? p.z : 0;
  return new THREE.Vector3((x - cx) / SCENE_SCALE, z / SCENE_SCALE, -(y - cy) / SCENE_SCALE);
}

function mapTrack(track: TrackPath): Mapped {
  const cx = track.width / 2;
  const cy = track.height / 2;
  const pts = track.points.map(p => mapPoint(p, cx, cy));
  return { pts, cx, cy };
}

// Linear-interpolate an (x, y, z) position along time-ordered track points at
// lap time t, then map to scene space. Clamps to the endpoints outside the lap's
// recorded span. Same bracketing logic as GhostLapReplay.posAtTime, extended to z.
function scenePosAtTime(
  points: TrackPoint[],
  t: number,
  cx: number,
  cy: number,
): THREE.Vector3 | null {
  if (points.length === 0) return null;
  if (t <= points[0].t) return mapPoint(points[0], cx, cy);
  for (let i = 1; i < points.length; i++) {
    if (points[i].t >= t) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const span = p1.t - p0.t || 1;
      const f = (t - p0.t) / span;
      return mapPoint(
        { x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f, z: p0.z + (p1.z - p0.z) * f },
        cx,
        cy,
      );
    }
  }
  const last = points[points.length - 1];
  return mapPoint(last, cx, cy);
}

// Distance reached along a trace's telemetry at lap time t (for the gap readout).
function distanceAtTime(tel: DriverTrace['telemetry'], t: number): number {
  if (tel.length === 0) return 0;
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

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function fmtGap(delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${Math.abs(delta).toFixed(3)}`;
}

// A car sphere whose scene position is recomputed each frame from the live `t`
// held in a ref. Reading t from a ref (not props/state) keeps the rAF playback
// loop from re-rendering React on every frame — the mesh just moves.
function CarMesh({
  points,
  cx,
  cy,
  colour,
  tRef,
}: {
  points: TrackPoint[];
  cx: number;
  cy: number;
  colour: string;
  tRef: React.RefObject<number>;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const pos = scenePosAtTime(points, tRef.current ?? 0, cx, cy);
    if (pos) mesh.position.copy(pos);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.15, 24, 24]} />
      <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.35} roughness={0.4} />
    </mesh>
  );
}

function Scene({
  outline,
  trackA,
  trackB,
  driverA,
  driverB,
  tRef,
}: {
  outline: Mapped;
  trackA: TrackPath | null;
  trackB: TrackPath | null;
  driverA: EnrichedDriver;
  driverB: EnrichedDriver;
  tRef: React.RefObject<number>;
}) {
  return (
    <>
      {/* Look down at the track at ~35°. Distance scales with the track's XZ
          extent so circuits of any size frame sensibly. */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 4]} intensity={1.1} />
      <Line points={outline.pts} color="#3a3a48" lineWidth={2} />
      {trackA && (
        <CarMesh points={trackA.points} cx={outline.cx} cy={outline.cy} colour={driverA.teamColour} tRef={tRef} />
      )}
      {trackB && (
        <CarMesh points={trackB.points} cx={outline.cx} cy={outline.cy} colour={driverB.teamColour} tRef={tRef} />
      )}
      <OrbitControls enablePan={false} minDistance={4} maxDistance={40} />
    </>
  );
}

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

  // Prefer A's track for the outline, fall back to B's (a driver's track can be
  // null when /location was sparse for that car). Cars only animate when their
  // OWN track is present — a null-track driver is simply omitted from the 3D
  // scene (its telemetry has no x/y/z to place it on the shared outline).
  const outlineTrack: TrackPath | null = traceA.track ?? traceB.track ?? null;
  const mapped = useMemo(() => (outlineTrack ? mapTrack(outlineTrack) : null), [outlineTrack]);

  // Playback runs over the slower lap so both spheres stay on track the whole time.
  const duration = useMemo(
    () => Math.max(traceA.lapTime, traceB.lapTime) || 0,
    [traceA.lapTime, traceB.lapTime],
  );

  // Distance-aligned delta, sampled by the faster driver's reached distance.
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
          const span = p1.d - p0.d || 1;
          return p0.delta + ((d - p0.d) / span) * (p1.delta - p0.delta);
        }
      }
      return delta[delta.length - 1].delta;
    },
    [delta, ref],
  );

  // t lives in BOTH a ref (read by the rAF loop + per-frame car positioning, no
  // re-render) and state (drives the slider + clock + gap, which must re-render).
  const tRef = useRef(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const applyT = useCallback((v: number) => {
    tRef.current = v;
    setT(v);
  }, []);

  // rAF playback loop. Advances t by real elapsed wall-time; loops back to 0 at
  // the end. Never starts under reduced motion (the toggle can't set playing
  // true in that mode — see below), matching GhostLapReplay.
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
      const next = tRef.current + dt;
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
  }, [playing, duration]);

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
        3D track unavailable for this session.
      </div>
    );
  }

  const gap = gapAt(t);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-text">Ghost lap · 3D</h3>
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
        <Canvas camera={{ position: [9, 8, 11], fov: 42 }} dpr={[1, 2]}>
          <Scene
            outline={mapped}
            trackA={traceA.track}
            trackB={traceB.track}
            driverA={driverA}
            driverB={driverB}
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
      </div>

      {reduced && (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          Reduced-motion: drag to scrub.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-text-muted">
        <LegendDot colour={driverA.teamColour} label={driverA.code} />
        <LegendDot colour={driverB.teamColour} label={driverB.code} />
        <span className="text-text-faint">drag to orbit · scroll to zoom</span>
      </div>
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
