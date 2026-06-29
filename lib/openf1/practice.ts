// Practice-session analysis assembler — SERVER ONLY (enriches drivers →
// series-content → fs). Two immutable-historical pulls (laps + stints, both
// reused via the paced client) reduced into the two things a practice page
// actually answers: who was quick over one lap, and who looked racy over a long
// run. KV read-through (immutable) so a warm render skips the OpenF1 fan-out +
// its rate-limit cost. Degrades to empty boards when OpenF1 has no lap/stint
// data for the session — never throws.
//
// Practice ONLY (FP1/FP2/FP3). Qualifying gets the Decoder + speed trap; race
// gets the Race Story + pit/overtake boards. Practice is where long-run race
// simulations happen, which none of those surface — hence this board.
//
// Long-run pace is the load-bearing metric. A practice stint mixes warm-up,
// push, and cool-down laps, plus the in/out laps that bracket a run; averaging
// raw lap times would drown the representative pace in pit-lane traffic. So per
// stint we average only GREEN laps: timed, non-pit-out laps within OUTLIER_PCT
// of that driver's best green lap for the whole session (a per-driver, not
// per-stint, reference so a slow tyre's whole stint still reads as slow rather
// than being judged against its own worst lap). That filter drops out-laps,
// in-laps, traffic-spoiled laps, and the lift-and-coast tail, leaving the clean
// representative pace teams compare across cars.

import { fetchLaps } from './laps';
import { fetchOpenF1, OF1_REVALIDATE } from './client';
import { getSessionDrivers, type EnrichedDriver } from './drivers';
import type { OF1Lap, OF1Stint } from './types';
import {
  OPENF1_DATASET_TTL_SECONDS,
  openf1DatasetKey,
  readResultsCache,
  writeResultsCache,
} from '@/lib/results-cache';

// A lap counts toward long-run pace only if it's no slower than this multiple
// of the driver's best green lap. 1.07 (the F1 "107% rule" figure) cleanly
// separates push/representative laps from in/out/traffic/cool-down laps without
// needing per-stint statistics. Laps with no timed duration or flagged pit-out
// are excluded before this even applies.
const OUTLIER_PCT = 1.07;

// A "long run" worth surfacing as representative needs at least this many green
// laps — a 1-2 lap burst isn't a race-sim stint.
const MIN_LONG_RUN_LAPS = 3;

/** One driver's single fastest timed, non-pit-out lap in the session. */
export interface PracticeFastestLap {
  driverNumber: number;
  lapDuration: number; // seconds
  lapNumber: number;
}

/** One tyre stint's long-run summary for a driver. */
export interface PracticeStint {
  stintNumber: number;
  compound: string | null; // SOFT | MEDIUM | HARD | INTERMEDIATE | WET
  lapStart: number;
  lapEnd: number;
  greenLaps: number; // laps that fed the average (after the outlier filter)
  avgGreenPace: number | null; // mean green-lap time, seconds; null if none
}

/** A driver's representative long run + every stint they ran. */
export interface PracticeLongRun {
  driverNumber: number;
  stints: PracticeStint[];
  // The stint that best represents race-sim pace: most green laps, tie-broken
  // by faster average. null when the driver never strung MIN_LONG_RUN_LAPS
  // clean laps together (quali-sim only / very short FP1 cameo).
  best: PracticeStint | null;
  compounds: string[]; // distinct compounds the driver ran, in stint order
}

export interface PracticeAnalysis {
  sessionKey: number;
  drivers: EnrichedDriver[];
  fastest: PracticeFastestLap[]; // ranked fastest first
  longRuns: PracticeLongRun[]; // sorted by best-stint avg pace (fastest first)
}

/** A timed lap that actually ran (not a pit-out, has a positive duration). */
function isTimedLap(l: OF1Lap): boolean {
  return l.lap_duration != null && l.lap_duration > 0 && !l.is_pit_out_lap;
}

/**
 * Each driver's single fastest timed, non-pit-out lap. Pure + synchronous so
 * it's unit-testable in isolation from the fetch/cache.
 */
export function fastestLapByDriver(laps: OF1Lap[]): Map<number, PracticeFastestLap> {
  const best = new Map<number, PracticeFastestLap>();
  for (const l of laps) {
    if (!isTimedLap(l)) continue;
    const dur = l.lap_duration as number;
    const cur = best.get(l.driver_number);
    if (cur && dur >= cur.lapDuration) continue;
    best.set(l.driver_number, {
      driverNumber: l.driver_number,
      lapDuration: dur,
      lapNumber: l.lap_number,
    });
  }
  return best;
}

/**
 * Average a stint's green laps. `bestGreen` is the driver's session-best timed
 * lap; a lap joins the average only if it's timed, non-pit-out, and within
 * OUTLIER_PCT of that reference. Returns the mean + the count that fed it.
 */
function averageGreenPace(
  stintLaps: OF1Lap[],
  bestGreen: number,
): { avg: number | null; count: number } {
  const ceiling = bestGreen * OUTLIER_PCT;
  let sum = 0;
  let count = 0;
  for (const l of stintLaps) {
    if (!isTimedLap(l)) continue;
    const dur = l.lap_duration as number;
    if (dur > ceiling) continue; // in/out/traffic/cool-down lap
    sum += dur;
    count += 1;
  }
  return count > 0 ? { avg: sum / count, count } : { avg: null, count: 0 };
}

/**
 * Group a driver's laps into stints. Prefers the explicit OpenF1 /stints lap
 * ranges; falls back to contiguous runs split at pit-out laps when stints are
 * absent for the driver (older/partial sessions). Returns stints in running
 * order. Pure + synchronous.
 */
function stintsForDriver(
  laps: OF1Lap[],
  stintRows: OF1Stint[],
): Array<{ stintNumber: number; compound: string | null; lapStart: number; lapEnd: number; laps: OF1Lap[] }> {
  const byLap = new Map<number, OF1Lap>();
  for (const l of laps) byLap.set(l.lap_number, l);

  const relevant = stintRows
    .filter(s => typeof s.lap_start === 'number' && typeof s.lap_end === 'number')
    .sort((a, b) => a.lap_start - b.lap_start);

  if (relevant.length > 0) {
    return relevant.map(s => {
      const stintLaps: OF1Lap[] = [];
      for (let n = s.lap_start; n <= s.lap_end; n++) {
        const l = byLap.get(n);
        if (l) stintLaps.push(l);
      }
      return {
        stintNumber: s.stint_number,
        compound: s.compound,
        lapStart: s.lap_start,
        lapEnd: s.lap_end,
        laps: stintLaps,
      };
    });
  }

  // Fallback: no /stints rows — split contiguous laps at each pit-out lap (a
  // pit-out lap is the first lap of a new run). Compound unknown here.
  const ordered = [...laps].sort((a, b) => a.lap_number - b.lap_number);
  const groups: OF1Lap[][] = [];
  for (const l of ordered) {
    if (groups.length === 0 || l.is_pit_out_lap) groups.push([l]);
    else groups[groups.length - 1].push(l);
  }
  return groups
    .filter(g => g.length > 0)
    .map((g, i) => ({
      stintNumber: i + 1,
      compound: null,
      lapStart: g[0].lap_number,
      lapEnd: g[g.length - 1].lap_number,
      laps: g,
    }));
}

/**
 * Reduce a session's laps + stints to a per-driver long-run summary. Pure +
 * synchronous so it's unit-testable in isolation from the fetch/cache.
 */
export function longRunsByDriver(
  laps: OF1Lap[],
  stintRows: OF1Stint[],
): Map<number, PracticeLongRun> {
  const lapsByDriver = new Map<number, OF1Lap[]>();
  for (const l of laps) {
    const arr = lapsByDriver.get(l.driver_number);
    if (arr) arr.push(l);
    else lapsByDriver.set(l.driver_number, [l]);
  }
  const stintsByDriver = new Map<number, OF1Stint[]>();
  for (const s of stintRows) {
    const arr = stintsByDriver.get(s.driver_number);
    if (arr) arr.push(s);
    else stintsByDriver.set(s.driver_number, [s]);
  }

  const out = new Map<number, PracticeLongRun>();
  for (const [driverNumber, driverLaps] of lapsByDriver) {
    // Per-driver reference: the driver's own best green lap anchors the outlier
    // ceiling, so a car that ran only hards isn't measured against a softs lap.
    let bestGreen = Infinity;
    for (const l of driverLaps) {
      if (isTimedLap(l)) bestGreen = Math.min(bestGreen, l.lap_duration as number);
    }
    if (!Number.isFinite(bestGreen)) continue; // no timed laps at all

    const grouped = stintsForDriver(driverLaps, stintsByDriver.get(driverNumber) ?? []);
    const stints: PracticeStint[] = grouped.map(g => {
      const { avg, count } = averageGreenPace(g.laps, bestGreen);
      return {
        stintNumber: g.stintNumber,
        compound: g.compound,
        lapStart: g.lapStart,
        lapEnd: g.lapEnd,
        greenLaps: count,
        avgGreenPace: avg,
      };
    });

    // Representative long run: most green laps wins; ties go to the faster
    // average. Only stints with a real long-run sample qualify.
    let best: PracticeStint | null = null;
    for (const s of stints) {
      if (s.avgGreenPace == null || s.greenLaps < MIN_LONG_RUN_LAPS) continue;
      if (
        !best ||
        s.greenLaps > best.greenLaps ||
        (s.greenLaps === best.greenLaps && s.avgGreenPace < (best.avgGreenPace as number))
      ) {
        best = s;
      }
    }

    const compounds: string[] = [];
    for (const s of stints) {
      if (s.compound && !compounds.includes(s.compound)) compounds.push(s.compound);
    }

    out.set(driverNumber, { driverNumber, stints, best, compounds });
  }
  return out;
}

/** Assembled, driver-enriched practice analysis (fastest laps + long runs). */
export async function buildPracticeAnalysis(
  sessionKey: number,
  slug = 'f1',
): Promise<PracticeAnalysis> {
  const cacheKey = openf1DatasetKey('practice', sessionKey);
  const cached = await readResultsCache<PracticeAnalysis>(cacheKey);
  if (cached) return cached;

  const [{ list: drivers }, laps, stints] = await Promise.all([
    getSessionDrivers(sessionKey, slug),
    fetchLaps(sessionKey),
    fetchOpenF1<OF1Stint>(
      'stints',
      { session_key: sessionKey },
      { revalidate: OF1_REVALIDATE.immutable },
    ),
  ]);

  const fastest = Array.from(fastestLapByDriver(laps).values()).sort(
    (a, b) => a.lapDuration - b.lapDuration,
  );

  const longRuns = Array.from(longRunsByDriver(laps, stints).values()).sort((a, b) => {
    // Drivers with a representative long run rank first, fastest avg leading;
    // those without one (quali-sim only) fall to the back by driver number.
    const aPace = a.best?.avgGreenPace ?? Infinity;
    const bPace = b.best?.avgGreenPace ?? Infinity;
    if (aPace !== bPace) return aPace - bPace;
    return a.driverNumber - b.driverNumber;
  });

  const result: PracticeAnalysis = { sessionKey, drivers, fastest, longRuns };
  // Persist only a result with something to show — never freeze an empty miss
  // (a transient OpenF1 throttle / live-session lockout) for the whole TTL.
  if (result.fastest.length > 0 || result.longRuns.length > 0) {
    await writeResultsCache(cacheKey, result, OPENF1_DATASET_TTL_SECONDS);
  }
  return result;
}
