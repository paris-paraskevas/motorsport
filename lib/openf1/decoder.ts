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
import { buildTrackPath } from './track';
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

/** Telemetry + track trace for the chosen drivers' fastest laps. */
export async function buildDecoderTraces(
  sessionKey: number,
  driverNumbers: number[],
  slug = 'f1',
): Promise<DecoderTraces> {
  const cacheKey = openf1DatasetKey(
    'decoder-traces',
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

  const result: DecoderTraces = { sessionKey, drivers, traces };
  if (result.traces.length > 0) {
    await writeResultsCache(cacheKey, result, OPENF1_DATASET_TTL_SECONDS);
  }
  return result;
}
