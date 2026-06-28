// Qualifying Decoder dataset assembly — the contract the API routes produce and
// the components consume. Two payloads:
//   - DecoderSummary: every driver's best lap (light; powers the picker + sector
//     bars). One drivers + laps fetch.
//   - DecoderTraces: telemetry + self-drawn track for a chosen pair (heavier;
//     fetched on demand). car_data + location windowed to each fastest lap.
// computeDelta() turns two traces into the broadcast-style cumulative time gap,
// aligned by distance — shared by the delta trace + the dominance map so the
// math lives in one tested place.

import { getSessionDrivers, type EnrichedDriver } from './drivers';
import {
  fastestLapsByDriver,
  fetchLapLocation,
  fetchLapTelemetry,
  fetchLaps,
  type TelemetrySample,
} from './laps';
import { buildTrackPath, type TrackPath } from './track';

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

/** Best lap per driver as light summaries — drives the picker + sector bars. */
export async function buildDecoderSummary(
  sessionKey: number,
  slug = 'f1',
): Promise<DecoderSummary> {
  const [{ list: drivers }, laps] = await Promise.all([
    getSessionDrivers(sessionKey, slug),
    fetchLaps(sessionKey),
  ]);
  const laps_ = Array.from(fastestLapsByDriver(laps).values())
    .map(b => ({
      driverNumber: b.driverNumber,
      lapNumber: b.lapNumber,
      lapTime: b.lapDuration,
      sectors: b.sectors,
    }))
    .sort((a, b) => a.lapTime - b.lapTime);
  return { sessionKey, drivers, laps: laps_ };
}

/** Integrate speed (km/h) over time to get cumulative distance per sample. */
function withDistance(samples: TelemetrySample[]): DistSample[] {
  let d = 0;
  const out: DistSample[] = [];
  for (let i = 0; i < samples.length; i++) {
    if (i > 0) {
      const dt = samples[i].t - samples[i - 1].t;
      if (dt > 0) d += (samples[i - 1].speed / 3.6) * dt;
    }
    out.push({ ...samples[i], d });
  }
  return out;
}

/** Telemetry + track trace for the chosen drivers' fastest laps. */
export async function buildDecoderTraces(
  sessionKey: number,
  driverNumbers: number[],
  slug = 'f1',
): Promise<DecoderTraces> {
  const [{ byNumber }, laps] = await Promise.all([
    getSessionDrivers(sessionKey, slug),
    fetchLaps(sessionKey),
  ]);
  const best = fastestLapsByDriver(laps);

  const traces: DriverTrace[] = [];
  await Promise.all(
    driverNumbers.map(async n => {
      const bl = best.get(n);
      if (!bl) return;
      const [tel, loc] = await Promise.all([
        fetchLapTelemetry(sessionKey, bl),
        fetchLapLocation(sessionKey, bl),
      ]);
      traces.push({
        driverNumber: n,
        lapNumber: bl.lapNumber,
        lapTime: bl.lapDuration,
        telemetry: withDistance(tel),
        track: buildTrackPath(loc),
      });
    }),
  );
  traces.sort((a, b) => a.lapTime - b.lapTime);

  const drivers = driverNumbers
    .map(n => byNumber.get(n))
    .filter((d): d is EnrichedDriver => Boolean(d));
  return { sessionKey, drivers, traces };
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
