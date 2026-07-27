// Live health monitor for WEEKEND SESSION SCHEDULES. The standings/results
// monitors catch a source going empty, but neither looks at the per-round
// weekend timetable — which is how GT World's Misano weekend silently rendered
// only "Free Practice 2" (its curated sessions.json override dropped the real
// races) while standings stayed green. This monitor grades each series' weekend
// schedules and flags rounds whose session list is anomalously thin.
//
// Signal: a COMPLETED round whose session count is far below its own series'
// typical completed-round count (or below an absolute floor) is almost always a
// broken/incomplete schedule. This is self-calibrating — no per-series floors
// and no fragile race-name detection (which breaks on WEC's "6 Hours of…" or
// WRC's stage names). It compares a round against how many sessions THAT series
// normally runs, so a 1-session weekend in a series that usually runs 5-6 lights
// up regardless of series.
//
// Known gap (v1): it counts sessions, so it does NOT catch a round with the
// right COUNT but wrong days/times (e.g. an override placing practice on the
// wrong day). That needs official-timetable cross-referencing — a later pass.

import { loadAllSeries } from '@/lib/series';
import { groupByWeekend } from '@/lib/group';
import type { Series, Weekend } from '@/lib/types';

export type SessionHealthStatus = 'OK' | 'LOW' | 'EMPTY' | 'ERROR';

export interface ThinRound {
  round: number;
  name: string;
  sessions: number;
}

export interface SessionHealthResult {
  slug: string;
  label: string;
  status: SessionHealthStatus;
  completedRounds: number;
  /** Median session count across the series' completed rounds. */
  median: number;
  /** Session count below which a completed round is treated as thin. */
  floor: number;
  /** Completed rounds whose schedule is anomalously thin (worst first). */
  thin: ThinRound[];
  ms: number;
  error?: string;
}

export const SESSIONS_HEALTH_SEASON = 2026;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function roundName(w: Weekend): string {
  return w.roundName || w.label || `Round ${w.round}`;
}

/**
 * Grade one series' weekend schedules. Pure — takes the already-grouped
 * weekends so it can be unit-tested without touching the filesystem or ICS.
 * A completed round is "thin" when it has fewer sessions than half its series'
 * median completed-round count, or fewer than 2 outright.
 */
export function gradeSeriesSchedule(
  slug: string,
  label: string,
  weekends: Weekend[],
): Omit<SessionHealthResult, 'ms'> {
  // Real championship rounds only. round < 1 is groupByWeekend's bucket for
  // stray sessions that fall outside the rounds.json windows (pre-season tests,
  // unmatched ICS entries) — not a weekend to grade.
  const completed = weekends.filter(w => w.isPast && w.round >= 1);
  // No completed rounds yet (pre-season / early) — nothing to grade.
  if (completed.length === 0) {
    return { slug, label, status: 'OK', completedRounds: 0, median: 0, floor: 0, thin: [] };
  }
  const counts = completed.map(w => w.sessions.length);
  const med = median(counts);
  // Floor is purely RELATIVE to the series' own median, so a series that
  // legitimately runs one session per round (NASCAR, IndyCar — race-only feeds)
  // never trips, while a round that regresses far below its series' norm does
  // (GT World's median-5 sprint weekends vs a 1-session Misano). A 0-session
  // completed round is always thin regardless of median.
  const floor = med * 0.5;
  const thin = completed
    .filter(w => w.sessions.length === 0 || w.sessions.length < floor)
    .map(w => ({ round: w.round, name: roundName(w), sessions: w.sessions.length }))
    .sort((a, b) => a.sessions - b.sessions);
  const status: SessionHealthStatus =
    thin.some(t => t.sessions === 0)
      ? 'EMPTY'
      : thin.length > 0
        ? 'LOW'
        : 'OK';
  return { slug, label, status, completedRounds: completed.length, median: med, floor, thin };
}

async function checkSeries(series: Series, now: Date): Promise<SessionHealthResult> {
  const t0 = Date.now();
  const label = series.meta.name ?? series.meta.slug;
  try {
    const weekends = groupByWeekend(series.sessions, now, series.rounds);
    return { ...gradeSeriesSchedule(series.meta.slug, label, weekends), ms: Date.now() - t0 };
  } catch (e) {
    return {
      slug: series.meta.slug,
      label,
      status: 'ERROR',
      completedRounds: 0,
      median: 0,
      floor: 0,
      thin: [],
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function runSessionsHealth(now: Date = new Date()): Promise<SessionHealthResult[]> {
  const all = await loadAllSeries();
  const results = await Promise.all(all.map(s => checkSeries(s, now)));
  return results.sort((a, b) => a.label.localeCompare(b.label));
}

export interface SessionHealthSummary {
  total: number;
  healthy: number;
  flagged: number;
  flaggedSlugs: string[];
}

export function summarizeSessions(results: SessionHealthResult[]): SessionHealthSummary {
  const flagged = results.filter(r => r.status !== 'OK');
  return {
    total: results.length,
    healthy: results.length - flagged.length,
    flagged: flagged.length,
    flaggedSlugs: flagged.map(r => r.slug),
  };
}
