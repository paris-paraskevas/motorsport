// Overtakes-of-the-race assembler — SERVER ONLY (enriches drivers →
// series-content → fs). One /overtakes pull (immutable historical). Counts
// completed overtakes per overtaking driver, ranked most first, plus the race
// total. KV read-through (immutable) so a warm render skips the OpenF1 fan-out.
// Degrades to an empty list when OpenF1 has no overtake data — never throws.
//
// Race sessions only. OpenF1 notes overtake coverage may be incomplete, so the
// totals are "as recorded by OpenF1", which the component's attribution covers.

import { fetchOpenF1, OF1_REVALIDATE } from './client';
import { getSessionDrivers, type EnrichedDriver } from './drivers';
import type { OF1Overtake } from './types';
import {
  OPENF1_DATASET_TTL_SECONDS,
  openf1DatasetKey,
  readResultsCache,
  writeResultsCache,
} from '@/lib/results-cache';

/** One driver's overtake tally for the session. */
export interface OvertakeEntry {
  driverNumber: number;
  overtakes: number; // moves completed by this driver (as the overtaker)
}

export interface OvertakesBoard {
  sessionKey: number;
  drivers: EnrichedDriver[];
  entries: OvertakeEntry[]; // ranked most overtakes first
  totalOvertakes: number; // every recorded overtake in the session
}

/**
 * Tally overtakes per overtaking driver. Pure + synchronous so it's
 * unit-testable in isolation from the fetch/cache.
 */
export function overtakesByDriver(overtakes: OF1Overtake[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const o of overtakes) {
    const n = o.overtaking_driver_number;
    if (typeof n !== 'number') continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return counts;
}

/** Assembled, driver-enriched, most-overtakes-first board for a session. */
export async function buildOvertakesBoard(
  sessionKey: number,
  slug = 'f1',
): Promise<OvertakesBoard> {
  const cacheKey = openf1DatasetKey('overtakes', sessionKey);
  const cached = await readResultsCache<OvertakesBoard>(cacheKey);
  if (cached) return cached;

  const [{ list: drivers }, overtakes] = await Promise.all([
    getSessionDrivers(sessionKey, slug),
    fetchOpenF1<OF1Overtake>(
      'overtakes',
      { session_key: sessionKey },
      { revalidate: OF1_REVALIDATE.immutable },
    ),
  ]);

  const counts = overtakesByDriver(overtakes);
  const entries = Array.from(counts.entries())
    .map(([driverNumber, n]) => ({ driverNumber, overtakes: n }))
    // Most overtakes first; tie-break by driver number for a stable order.
    .sort((a, b) => b.overtakes - a.overtakes || a.driverNumber - b.driverNumber);

  const result: OvertakesBoard = {
    sessionKey,
    drivers,
    entries,
    totalOvertakes: overtakes.length,
  };
  // Persist only a non-empty result — never freeze an empty miss for the TTL.
  if (result.entries.length > 0) {
    await writeResultsCache(cacheKey, result, OPENF1_DATASET_TTL_SECONDS);
  }
  return result;
}
