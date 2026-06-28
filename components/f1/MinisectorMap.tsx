'use client';
import { useMemo } from 'react';
import { computeDelta, type DriverTrace } from '@/lib/openf1/delta';
import type { EnrichedDriver } from '@/lib/openf1/drivers';

// "Dominance" map: one driver's self-drawn track, with the racing line coloured
// along its length by WHO IS AHEAD at each point — the sign of the cumulative,
// distance-aligned delta. Segments in the leading driver's team colour.
//
// The geometry (track.points) is indexed by elapsed time t; the delta is indexed
// by distance d. We bridge them through the reference driver's own telemetry:
// each track point's t → distance d (interpolate over telemetry), then look up
// the delta sign at d. Falls back to per-sector dominance if the trace lacks the
// distance/telemetry data needed to align them (noted in the caption).

interface Segment {
  d: string; // SVG path data for this run of same-leader points
  leader: 'a' | 'b' | 'tie';
}

// distance (m) along the reference lap at elapsed time t (s).
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

function buildSegments(ref: DriverTrace, a: DriverTrace, b: DriverTrace): Segment[] | null {
  const track = ref.track;
  if (!track || track.points.length < 2) return null;
  const delta = computeDelta(a, b);
  if (delta.length === 0 || ref.telemetry.length === 0) return null;

  const deltaAt = (d: number): number => {
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
  };

  const leaderOf = (signedDelta: number): Segment['leader'] =>
    // delta = t_b − t_a; positive → B is behind → A leads.
    signedDelta > 0.02 ? 'a' : signedDelta < -0.02 ? 'b' : 'tie';

  const pts = track.points;
  const segs: Segment[] = [];
  let cur: { leader: Segment['leader']; coords: string[] } | null = null;

  for (let i = 0; i < pts.length; i++) {
    const d = distanceAtTime(ref.telemetry, pts[i].t);
    const leader = leaderOf(deltaAt(d));
    const coord = `${pts[i].x} ${pts[i].y}`;
    if (!cur || cur.leader !== leader) {
      // Close the previous run, starting the new one at the shared vertex so
      // segments visually connect with no gap.
      if (cur) {
        cur.coords.push(coord);
        segs.push({ d: `M${cur.coords.join(' L')}`, leader: cur.leader });
      }
      cur = { leader, coords: [coord] };
    } else {
      cur.coords.push(coord);
    }
  }
  if (cur && cur.coords.length > 1) segs.push({ d: `M${cur.coords.join(' L')}`, leader: cur.leader });
  return segs;
}

// Fallback: colour the three sectors by their per-sector winner. Crude but
// always correct — used when telemetry can't be distance-aligned. Splits the
// track points into equal thirds by index (a reasonable proxy: sectors are
// roughly equal slices of the lap and we lack sector distance markers here).
function buildSectorSegments(ref: DriverTrace, lapA: number[], lapB: number[]): Segment[] | null {
  const track = ref.track;
  if (!track || track.points.length < 4) return null;
  const pts = track.points;
  const third = Math.floor(pts.length / 3);
  const slices: Array<[number, number]> = [
    [0, third],
    [third, third * 2],
    [third * 2, pts.length],
  ];
  const segs: Segment[] = [];
  slices.forEach(([from, to], s) => {
    const a = lapA[s];
    const b = lapB[s];
    const leader: Segment['leader'] =
      a != null && b != null ? (a < b ? 'a' : b < a ? 'b' : 'tie') : 'tie';
    // include the boundary vertex so slices connect
    const run = pts.slice(from, Math.min(to + 1, pts.length));
    if (run.length > 1) {
      segs.push({ d: `M${run.map(p => `${p.x} ${p.y}`).join(' L')}`, leader });
    }
  });
  return segs;
}

export function MinisectorMap({
  driverA,
  driverB,
  traceA,
  traceB,
  sectorsA,
  sectorsB,
}: {
  driverA: EnrichedDriver;
  driverB: EnrichedDriver;
  traceA: DriverTrace;
  traceB: DriverTrace;
  // Optional sector times (from the LapSummaries) powering the fallback map.
  sectorsA?: Array<number | null>;
  sectorsB?: Array<number | null>;
}) {
  // Prefer the faster driver's track as the canvas; fall back to the other.
  const ref = traceA.track ? traceA : traceB.track ? traceB : null;

  const { segments, mode } = useMemo(() => {
    if (!ref) return { segments: null as Segment[] | null, mode: 'none' as const };
    const precise = buildSegments(ref, traceA, traceB);
    if (precise && precise.length > 0) return { segments: precise, mode: 'delta' as const };
    if (sectorsA && sectorsB) {
      const fallback = buildSectorSegments(
        ref,
        sectorsA.map(s => s ?? Infinity),
        sectorsB.map(s => s ?? Infinity),
      );
      if (fallback && fallback.length > 0) return { segments: fallback, mode: 'sector' as const };
    }
    return { segments: null as Segment[] | null, mode: 'none' as const };
  }, [ref, traceA, traceB, sectorsA, sectorsB]);

  const colourFor = (leader: Segment['leader']) =>
    leader === 'a' ? driverA.teamColour : leader === 'b' ? driverB.teamColour : 'var(--border-strong)';

  if (!ref?.track || !segments) {
    return (
      <div className="flex h-64 items-center justify-center border border-border bg-surface/40 text-center text-sm text-text-faint">
        Track map unavailable for this session.
      </div>
    );
  }

  const track = ref.track;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-text">Dominance map</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          {mode === 'sector' ? 'by sector winner' : 'who leads, by track position'}
        </span>
      </div>
      <div className="border border-border bg-surface/40 p-3">
        <svg
          viewBox={track.viewBox}
          className="h-auto w-full"
          role="img"
          aria-label={`Track dominance map: segments coloured by whether ${driverA.code} or ${driverB.code} leads`}
        >
          {/* Faint full-lap underlay so the unsegmented geometry always reads. */}
          <path d={track.d} fill="none" stroke="var(--border)" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
          {segments.map((seg, i) => (
            <path
              key={i}
              d={seg.d}
              fill="none"
              stroke={colourFor(seg.leader)}
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-text-muted">
        <LegendDot colour={driverA.teamColour} label={`${driverA.code} ahead`} />
        <LegendDot colour={driverB.teamColour} label={`${driverB.code} ahead`} />
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
