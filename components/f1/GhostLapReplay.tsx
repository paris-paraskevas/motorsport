'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { computeDelta, type DriverTrace } from '@/lib/openf1/delta';
import type { EnrichedDriver } from '@/lib/openf1/drivers';
import type { TrackPath, TrackPoint } from '@/lib/openf1/track';

// The wow view: a side-by-side ghost replay of two qualifying laps on the
// self-drawn circuit. Two dots (one per driver, team-coloured) advance along
// each driver's own track.points by elapsed lap time t. requestAnimationFrame
// drives playback; a scrub slider sets t directly; the running gap reads off the
// distance-aligned delta. Respects prefers-reduced-motion: no autoplay, static
// track + scrub only (rAF loop never starts).

// Linear-interpolate an (x, y) position along time-ordered track points at lap
// time t. Clamps to the endpoints outside the lap's recorded span.
function posAtTime(points: TrackPoint[], t: number): { x: number; y: number } | null {
  if (points.length === 0) return null;
  if (t <= points[0].t) return { x: points[0].x, y: points[0].y };
  for (let i = 1; i < points.length; i++) {
    if (points[i].t >= t) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const span = p1.t - p0.t || 1;
      const f = (t - p0.t) / span;
      return { x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f };
    }
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y };
}

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

export function GhostLapReplay({
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

  // Outline: prefer A's track, fall back to B's (a driver's track can be null
  // when /location was sparse for that car).
  const outline: TrackPath | null = traceA.track ?? traceB.track ?? null;

  // Playback runs over the slower lap so both dots stay on track the whole time.
  const duration = useMemo(
    () => Math.max(traceA.lapTime, traceB.lapTime) || 0,
    [traceA.lapTime, traceB.lapTime],
  );

  // Distance-aligned delta, sampled by the faster driver's reached distance.
  const ref = traceA.lapTime <= traceB.lapTime ? traceA : traceB;
  const delta = useMemo(() => computeDelta(traceA, traceB), [traceA, traceB]);
  const gapAt = useCallback(
    (t: number): number | null => {
      if (delta.length === 0) return null;
      const d = distanceAtTime(ref.telemetry, t);
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

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // rAF playback loop. Advances t by real elapsed wall-time; loops back to 0 at
  // the end. Never starts under reduced motion (the effect guards on `playing`,
  // which the play button can't set true in that mode — see the toggle below).
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
      setT(prev => {
        const next = prev + dt;
        return next >= duration ? 0 : next; // loop
      });
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

  const onScrub = useCallback((v: number) => {
    setPlaying(false);
    setT(v);
  }, []);

  if (!outline) {
    return (
      <div className="flex h-64 items-center justify-center border border-border bg-surface/40 text-center text-sm text-text-faint">
        Telemetry unavailable for this session.
      </div>
    );
  }

  const posA = traceA.track ? posAtTime(traceA.track.points, t) : null;
  const posB = traceB.track ? posAtTime(traceB.track.points, t) : null;
  const gap = gapAt(t);
  const dotR = Math.max(outline.width, outline.height) * 0.012;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-text">Lap replay</h3>
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

      <div className="border border-border bg-surface/40 p-3">
        <svg viewBox={outline.viewBox} className="h-auto w-full" role="img" aria-label="Animated lap replay on the circuit map">
          <path d={outline.d} fill="none" stroke="var(--border-strong)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
          {posA && (
            <circle cx={posA.x} cy={posA.y} r={dotR} fill={driverA.teamColour} stroke="var(--bg)" strokeWidth={dotR * 0.35}>
              {/* aria title for the dot */}
              <title>{driverA.code}</title>
            </circle>
          )}
          {posB && (
            <circle cx={posB.x} cy={posB.y} r={dotR} fill={driverB.teamColour} stroke="var(--bg)" strokeWidth={dotR * 0.35}>
              <title>{driverB.code}</title>
            </circle>
          )}
        </svg>
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
