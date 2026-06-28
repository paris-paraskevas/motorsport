// Client-safe Decoder types + the distance-aligned delta math. Kept SEPARATE
// from decoder.ts on purpose: the assemblers there import driver enrichment →
// series-content → `fs/promises`, so importing the VALUE `computeDelta` from
// decoder.ts into a client component drags `fs` into the browser bundle and
// 500s the page. This module imports only TYPES from sibling modules (erased at
// compile), so it is safe to import from client components.

import type { EnrichedDriver } from './drivers';
import type { TelemetrySample } from './laps';
import type { TrackPath } from './track';

export interface LapSummary {
  driverNumber: number;
  lapNumber: number;
  lapTime: number; // seconds
  sectors: [number | null, number | null, number | null];
}

export interface DecoderSummary {
  sessionKey: number;
  drivers: EnrichedDriver[];
  laps: LapSummary[]; // best lap per driver, fastest first
}

/** A telemetry sample with cumulative distance (m) from the lap start. */
export interface DistSample extends TelemetrySample {
  d: number;
}

export interface DriverTrace {
  driverNumber: number;
  lapNumber: number;
  lapTime: number;
  telemetry: DistSample[];
  track: TrackPath | null;
}

export interface DecoderTraces {
  sessionKey: number;
  drivers: EnrichedDriver[]; // the requested pair, enriched
  traces: DriverTrace[]; // fastest first
}

/** A point on the cumulative-delta curve: `delta` = t_b − t_a at distance `d`. */
export interface DeltaPoint {
  d: number; // metres
  delta: number; // seconds (positive → driver B is behind A here)
}

/** Linear-interpolate elapsed time at cumulative distance `d`. */
function timeAtDistance(tel: DistSample[], d: number): number {
  if (tel.length === 0) return 0;
  if (d <= tel[0].d) return tel[0].t;
  for (let i = 1; i < tel.length; i++) {
    if (tel[i].d >= d) {
      const p0 = tel[i - 1];
      const p1 = tel[i];
      const span = p1.d - p0.d || 1;
      return p0.t + ((d - p0.d) / span) * (p1.t - p0.t);
    }
  }
  return tel[tel.length - 1].t;
}

function lastDistance(trace: DriverTrace): number {
  const t = trace.telemetry;
  return t.length ? t[t.length - 1].d : 0;
}

/**
 * Cumulative time delta between two traces, sampled evenly over the shorter of
 * the two distances. Positive delta = `b` is behind `a` at that point — so a
 * rising curve shows where A is pulling away. Returns [] if either trace lacks
 * distance data.
 */
export function computeDelta(a: DriverTrace, b: DriverTrace, samples = 200): DeltaPoint[] {
  const maxD = Math.min(lastDistance(a), lastDistance(b));
  if (maxD <= 0) return [];
  const out: DeltaPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const d = (maxD * i) / samples;
    out.push({ d, delta: timeAtDistance(b.telemetry, d) - timeAtDistance(a.telemetry, d) });
  }
  return out;
}
