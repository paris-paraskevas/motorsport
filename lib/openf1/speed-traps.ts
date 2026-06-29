// Speed-trap leaderboard assembler — SERVER ONLY (enriches drivers →
// series-content → fs). One /laps pull (reused via fetchLaps, immutable
// historical); the top speed per driver is the max of the three trap readings
// each lap (i1/i2/straight). Ranked fastest first. KV read-through (immutable),
// so a warm render skips the OpenF1 fan-out + its rate-limit cost. Degrades to
// an empty list when OpenF1 has no lap/speed data — never throws.
//
// Shown on BOTH qualifying and race sessions (the only telemetry leaderboard
// that makes sense outside a race — quali pulls peak straight-line speed).

import { fetchLaps } from './laps';
import { getSessionDrivers, type EnrichedDriver } from './drivers';
import type { OF1Lap } from './types';
import {
  OPENF1_DATASET_TTL_SECONDS,
  openf1DatasetKey,
  readResultsCache,
  writeResultsCache,
} from '@/lib/results-cache';

/** One driver's best speed-trap reading for the session. */
export interface SpeedTrapEntry {
  driverNumber: number;
  topSpeed: number; // km/h — best of i1/i2/st across all the driver's laps
  lapNumber: number; // lap the top speed was set on
}

export interface SpeedTrapLeaderboard {
  sessionKey: number;
  drivers: EnrichedDriver[];
  entries: SpeedTrapEntry[]; // ranked fastest first
}

/** Best of the three trap readings on a lap, ignoring nulls. 0 if none. */
function lapTopSpeed(lap: OF1Lap): number {
  return Math.max(0, lap.i1_speed ?? 0, lap.i2_speed ?? 0, lap.st_speed ?? 0);
}

/**
 * Reduce a session's laps to one peak speed-trap reading per driver. Pure +
 * synchronous so it's unit-testable in isolation from the fetch/cache.
 */
export function topSpeedByDriver(laps: OF1Lap[]): Map<number, SpeedTrapEntry> {
  const best = new Map<number, SpeedTrapEntry>();
  for (const l of laps) {
    const speed = lapTopSpeed(l);
    if (speed <= 0) continue; // no trap reading on this lap
    const cur = best.get(l.driver_number);
    if (cur && speed <= cur.topSpeed) continue;
    best.set(l.driver_number, {
      driverNumber: l.driver_number,
      topSpeed: speed,
      lapNumber: l.lap_number,
    });
  }
  return best;
}

/** Assembled, driver-enriched, fastest-first speed-trap board for a session. */
export async function buildSpeedTrapLeaderboard(
  sessionKey: number,
  slug = 'f1',
): Promise<SpeedTrapLeaderboard> {
  const cacheKey = openf1DatasetKey('speed-trap', sessionKey);
  const cached = await readResultsCache<SpeedTrapLeaderboard>(cacheKey);
  if (cached) return cached;

  const [{ list: drivers }, laps] = await Promise.all([
    getSessionDrivers(sessionKey, slug),
    fetchLaps(sessionKey),
  ]);

  const entries = Array.from(topSpeedByDriver(laps).values()).sort(
    (a, b) => b.topSpeed - a.topSpeed,
  );

  const result: SpeedTrapLeaderboard = { sessionKey, drivers, entries };
  // Persist only a non-empty result — never freeze an empty miss (a transient
  // upstream throttle) for the whole TTL.
  if (result.entries.length > 0) {
    await writeResultsCache(cacheKey, result, OPENF1_DATASET_TTL_SECONDS);
  }
  return result;
}
