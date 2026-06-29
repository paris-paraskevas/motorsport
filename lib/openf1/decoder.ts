// Qualifying Decoder dataset assembly — SERVER ONLY. buildDecoderSummary +
// buildDecoderTraces enrich drivers (→ series-content → `fs/promises`) and fetch
// from OpenF1, so this module must NEVER be imported by a client component.
// The client-safe types + delta math live in ./delta (re-exported here so
// server callers + tests can keep importing from one place).
//   - DecoderSummary: every driver's best lap (light; powers the picker + sector
//     bars). One drivers + laps fetch.
//   - DecoderTraces: telemetry + self-drawn track for a chosen pair (heavier;
//     fetched on demand). car_data + location windowed to each fastest lap.
// Both are wrapped in a durable KV read-through (immutable historical data), so
// a warm render skips the OpenF1 fan-out and its rate-limit cost. The cache
// fails open: with KV absent (local dev) it assembles fresh every time.

import { getSessionDrivers, type EnrichedDriver } from './drivers';
import {
  fastestLapsByDriver,
  fetchLapLocation,
  fetchLapTelemetry,
  fetchLaps,
  type TelemetrySample,
} from './laps';
import { buildTrackPath, computeTrackFrame, reconstructCircuit, type TrackPath } from './track';
import type { OF1Location } from './types';
import type { DecoderSummary, DecoderTraces, DistSample, DriverTrace } from './delta';
import {
  OPENF1_DATASET_TTL_SECONDS,
  openf1DatasetKey,
  readResultsCache,
  writeResultsCache,
} from '@/lib/results-cache';

export { computeDelta } from './delta';
export type {
  LapSummary,
  DecoderSummary,
  DistSample,
  DriverTrace,
  DecoderTraces,
  DeltaPoint,
} from './delta';

/** Best lap per driver as light summaries — drives the picker + sector bars. */
export async function buildDecoderSummary(
  sessionKey: number,
  slug = 'f1',
): Promise<DecoderSummary> {
  const cacheKey = openf1DatasetKey('decoder-summary', sessionKey);
  const cached = await readResultsCache<DecoderSummary>(cacheKey);
  if (cached) return cached;

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

  const result: DecoderSummary = { sessionKey, drivers, laps: laps_ };
  // Persist only a non-empty result — never freeze an empty miss (a transient
  // upstream throttle) for the whole TTL.
  if (result.laps.length > 0) {
    await writeResultsCache(cacheKey, result, OPENF1_DATASET_TTL_SECONDS);
  }
  return result;
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

// How many drivers' laps reconstruct the track surface. The fastest dozen span
// the width well (apex-clippers + wider lines) at a bounded fetch cost.
const RECON_DRIVERS = 12;

/** Telemetry + track trace for the chosen pair, plus a track surface
 *  reconstructed from the session's fastest ~dozen laps (so the cars sit on a
 *  real, measured-width track rather than each on its own centred line). */
export async function buildDecoderTraces(
  sessionKey: number,
  driverNumbers: number[],
  slug = 'f1',
): Promise<DecoderTraces> {
  const cacheKey = openf1DatasetKey(
    // v2: traces share one frame + carry a reconstructed circuit (shape change).
    'decoder-traces-v2',
    sessionKey,
    [...driverNumbers].sort((a, b) => a - b).join('-'),
  );
  const cached = await readResultsCache<DecoderTraces>(cacheKey);
  if (cached) return cached;

  const [{ byNumber }, laps] = await Promise.all([
    getSessionDrivers(sessionKey, slug),
    fetchLaps(sessionKey),
  ]);
  const best = fastestLapsByDriver(laps);
  const ranked = [...best.values()].sort((a, b) => a.lapDuration - b.lapDuration);

  // Reconstruction set = fastest dozen ∪ the requested pair.
  const reconNumbers = new Set<number>(ranked.slice(0, RECON_DRIVERS).map(b => b.driverNumber));
  for (const n of driverNumbers) reconNumbers.add(n);

  // One location fetch per recon driver (token-bucket paced + cached), by number.
  const locByNumber = new Map<number, OF1Location[]>();
  await Promise.all(
    [...reconNumbers].map(async n => {
      const bl = best.get(n);
      if (!bl) return;
      const loc = await fetchLapLocation(sessionKey, bl);
      if (loc.length > 0) locByNumber.set(n, loc);
    }),
  );

  // Shared spatial frame across every fetched lap → all laps + the reconstructed
  // track normalise into one coordinate space the cars line up on.
  const frame = computeTrackFrame([...locByNumber.values()]) ?? undefined;
  const pathOpts = frame ? { frame } : {};

  // Reconstruct the drivable surface from the recon laps, fastest-first.
  const reconPaths = ranked
    .map(b => {
      const loc = locByNumber.get(b.driverNumber);
      return loc ? buildTrackPath(loc, pathOpts) : null;
    })
    .filter((p): p is TrackPath => p !== null);
  const circuit = reconstructCircuit(reconPaths);

  // The requested pair: telemetry + their own track, in the SHARED frame.
  const traces: DriverTrace[] = [];
  await Promise.all(
    driverNumbers.map(async n => {
      const bl = best.get(n);
      if (!bl) return;
      const tel = await fetchLapTelemetry(sessionKey, bl);
      const loc = locByNumber.get(n) ?? (await fetchLapLocation(sessionKey, bl));
      traces.push({
        driverNumber: n,
        lapNumber: bl.lapNumber,
        lapTime: bl.lapDuration,
        telemetry: withDistance(tel),
        track: buildTrackPath(loc, pathOpts),
      });
    }),
  );
  traces.sort((a, b) => a.lapTime - b.lapTime);

  const drivers = driverNumbers
    .map(n => byNumber.get(n))
    .filter((d): d is EnrichedDriver => Boolean(d));

  const result: DecoderTraces = { sessionKey, drivers, traces, circuit };
  if (result.traces.length > 0) {
    await writeResultsCache(cacheKey, result, OPENF1_DATASET_TTL_SECONDS);
  }
  return result;
}
