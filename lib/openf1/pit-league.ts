// Pit-stop league assembler — SERVER ONLY (enriches drivers → series-content →
// fs). One /pit pull (immutable historical). Per driver: fastest stationary
// stop + total stop count, ranked by fastest stop ascending. KV read-through
// (immutable) so a warm render skips the OpenF1 fan-out. Degrades to an empty
// list when OpenF1 has no pit data for the session — never throws.
//
// Race sessions only — there are no green-flag pit stops to rank in qualifying.
//
// `stop_duration` is the stationary (jack-up → drop) time, the number fans mean
// by "pit stop time". `pit_duration` (deprecated, removed end-2026) is the full
// pit-lane time and is the fallback when stop_duration is absent on older data.

import { fetchOpenF1, OF1_REVALIDATE } from './client';
import { getSessionDrivers, type EnrichedDriver } from './drivers';
import type { OF1Pit } from './types';
import {
  OPENF1_DATASET_TTL_SECONDS,
  openf1DatasetKey,
  readResultsCache,
  writeResultsCache,
} from '@/lib/results-cache';

/** One driver's pit-stop record for the session. */
export interface PitStopEntry {
  driverNumber: number;
  fastestStop: number; // seconds — quickest stationary stop
  stopCount: number; // number of timed stops
  fastestStopLap: number | null; // lap the fastest stop happened on
}

export interface PitStopLeague {
  sessionKey: number;
  drivers: EnrichedDriver[];
  entries: PitStopEntry[]; // ranked fastest stop first
}

/** Stationary stop time for a pit row, preferring stop_duration. null if none. */
function stopDuration(p: OF1Pit): number | null {
  const d = p.stop_duration ?? p.pit_duration ?? null;
  return typeof d === 'number' && d > 0 ? d : null;
}

/**
 * Reduce a session's pit rows to a fastest-stop + count per driver. Pure +
 * synchronous so it's unit-testable in isolation from the fetch/cache.
 */
export function pitStopsByDriver(pits: OF1Pit[]): Map<number, PitStopEntry> {
  const byDriver = new Map<number, PitStopEntry>();
  for (const p of pits) {
    const dur = stopDuration(p);
    if (dur == null) continue;
    const cur = byDriver.get(p.driver_number);
    if (!cur) {
      byDriver.set(p.driver_number, {
        driverNumber: p.driver_number,
        fastestStop: dur,
        stopCount: 1,
        fastestStopLap: p.lap_number ?? null,
      });
      continue;
    }
    cur.stopCount += 1;
    if (dur < cur.fastestStop) {
      cur.fastestStop = dur;
      cur.fastestStopLap = p.lap_number ?? null;
    }
  }
  return byDriver;
}

/** Assembled, driver-enriched, fastest-stop-first pit league for a session. */
export async function buildPitStopLeague(
  sessionKey: number,
  slug = 'f1',
): Promise<PitStopLeague> {
  const cacheKey = openf1DatasetKey('pit-league', sessionKey);
  const cached = await readResultsCache<PitStopLeague>(cacheKey);
  if (cached) return cached;

  const [{ list: drivers }, pits] = await Promise.all([
    getSessionDrivers(sessionKey, slug),
    fetchOpenF1<OF1Pit>(
      'pit',
      { session_key: sessionKey },
      { revalidate: OF1_REVALIDATE.immutable },
    ),
  ]);

  const entries = Array.from(pitStopsByDriver(pits).values()).sort(
    (a, b) => a.fastestStop - b.fastestStop,
  );

  const result: PitStopLeague = { sessionKey, drivers, entries };
  // Persist only a non-empty result — never freeze an empty miss for the TTL.
  if (result.entries.length > 0) {
    await writeResultsCache(cacheKey, result, OPENF1_DATASET_TTL_SECONDS);
  }
  return result;
}
