import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { SeriesRoundsFile } from '@/lib/types';
import { BASE_CREDITS, PER_WEEKEND_CREDITS } from './constants';

// Lean economy (design §8). The monthly grant scales to that month's race-weekend
// count, so a player gets ~one standard bet per weekend plus a thin cushion —
// enough to stay engaged, never enough to stockpile. Returns are MULTIPLIED and
// the leaderboard ranks by WIN-RATE (not bankroll), so this grant never buys an
// advantage; it only floors losing players so they can keep playing. Constants
// live in ./constants (client-safe — the UI imports STANDARD_STAKE from there).

// rounds.json is static at runtime — cache the parse across requests so the
// per-grant cost is a single in-process lookup, never a disk read or an ICS fetch.
let cachedRounds: SeriesRoundsFile | null | undefined;

function f1Rounds(): SeriesRoundsFile | null {
  if (cachedRounds !== undefined) return cachedRounds;
  try {
    const file = path.join(process.cwd(), 'content', 'series', 'f1', 'rounds.json');
    cachedRounds = JSON.parse(readFileSync(file, 'utf8')) as SeriesRoundsFile;
  } catch {
    cachedRounds = null;
  }
  return cachedRounds;
}

/** F1 race weekends in `now`'s calendar month (UTC). `rounds[]` already excludes
 *  cancelled rounds; `endDate` is the race (Sunday) day. */
export function raceWeekendsInMonth(now: Date): number {
  const rounds = f1Rounds();
  if (!rounds) return 0;
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  return rounds.rounds.filter(r => typeof r.endDate === 'string' && r.endDate.slice(0, 7) === month).length;
}

/** This month's lean grant: BASE + raceWeekends × PER_WEEKEND (e.g. June 2026 = 3 → 350). */
export function computeMonthlyAllowance(now: Date): number {
  return BASE_CREDITS + raceWeekendsInMonth(now) * PER_WEEKEND_CREDITS;
}
