// Race Story assembler — SERVER ONLY (enriches drivers → series-content → fs).
// One pull per source, all immutable post-session. Tyre stints become strategy
// bands; race_control + overtakes + pit + team_radio collapse into the unified
// Moments timeline (the radio moments carry the mp3 for an inline player).

import { fetchOpenF1, OF1_REVALIDATE } from './client';
import { getSessionDrivers } from './drivers';
import { buildMoments, type Moment } from './moments';
import type {
  OF1Overtake,
  OF1Pit,
  OF1RaceControl,
  OF1Stint,
  OF1TeamRadio,
} from './types';
import type { DriverStints, RaceStoryData } from './racestory';
import {
  OPENF1_DATASET_TTL_SECONDS,
  openf1DatasetKey,
  readResultsCache,
  writeResultsCache,
} from '@/lib/results-cache';

// The RaceStory component renders at most MAX_VISIBLE (80) moments and its
// default "Key" filter hides routine info (overtake/pit/drs/green) entirely. A
// busy race emits 500+ moments, so shipping them all bloats the RSC payload for
// rows that can never render. Trim server-side BEFORE returning: keep EVERY
// high-value moment (severity 'alert' + 'notice' — flags, safety cars,
// penalties, investigations, team radio) so the "Key"/"Radio" filters are
// untouched, and cap the routine 'info' stream to the most recent ROUTINE_CAP so
// the "All" filter still shows recent overtakes/pit stops without the long tail.
// buildMoments returns chronological order; we preserve it in the output.
const ROUTINE_CAP = 60;

export function trimMoments(moments: Moment[]): Moment[] {
  const routine = moments.filter(m => m.severity === 'info');
  if (routine.length <= ROUTINE_CAP) return moments;
  // Keep the most recent ROUTINE_CAP routine moments. `moments` is already
  // chronological, so the cutoff is the start `at` of the kept window; drop any
  // earlier routine moment, keep every high-value one regardless of age.
  const cutoff = new Date(routine[routine.length - ROUTINE_CAP].at).getTime();
  return moments.filter(
    m => m.severity !== 'info' || new Date(m.at).getTime() >= cutoff,
  );
}

export async function buildRaceStory(
  sessionKey: number,
  slug = 'f1',
): Promise<RaceStoryData> {
  const cacheKey = openf1DatasetKey('race-story', sessionKey);
  const cached = await readResultsCache<RaceStoryData>(cacheKey);
  if (cached) return cached;

  const revalidate = OF1_REVALIDATE.immutable;
  const [{ list: drivers }, stints, raceControl, overtakes, pit, radio] =
    await Promise.all([
      getSessionDrivers(sessionKey, slug),
      fetchOpenF1<OF1Stint>('stints', { session_key: sessionKey }, { revalidate }),
      fetchOpenF1<OF1RaceControl>('race_control', { session_key: sessionKey }, { revalidate }),
      fetchOpenF1<OF1Overtake>('overtakes', { session_key: sessionKey }, { revalidate }),
      fetchOpenF1<OF1Pit>('pit', { session_key: sessionKey }, { revalidate }),
      fetchOpenF1<OF1TeamRadio>('team_radio', { session_key: sessionKey }, { revalidate }),
    ]);

  const byDriver = new Map<number, DriverStints>();
  let totalLaps = 0;
  for (const s of stints) {
    if (typeof s.lap_end === 'number') totalLaps = Math.max(totalLaps, s.lap_end);
    const entry = byDriver.get(s.driver_number) ?? {
      driverNumber: s.driver_number,
      stints: [],
    };
    entry.stints.push({
      compound: s.compound,
      lapStart: s.lap_start,
      lapEnd: s.lap_end,
      ageAtStart: s.tyre_age_at_start,
    });
    byDriver.set(s.driver_number, entry);
  }
  for (const e of byDriver.values()) e.stints.sort((a, b) => a.lapStart - b.lapStart);

  const driverStints = Array.from(byDriver.values()).sort(
    (a, b) => a.driverNumber - b.driverNumber,
  );

  const result: RaceStoryData = {
    sessionKey,
    drivers,
    totalLaps,
    stints: driverStints,
    moments: trimMoments(buildMoments({ raceControl, overtakes, pit, radio })),
  };
  // Persist only when there's something to show.
  if (result.stints.length > 0 || result.moments.length > 0) {
    await writeResultsCache(cacheKey, result, OPENF1_DATASET_TTL_SECONDS);
  }
  return result;
}
