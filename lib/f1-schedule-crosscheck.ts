// Pure diff: our rendered F1 weekend sessions vs OpenF1's official session times.
// The wrong-DAY / wrong-TIME curation errors the count-based sessions-health
// monitor can't catch (right count, wrong day). Kept pure + fetch-free so it's
// unit-testable; scripts/health-f1-schedule.mts does the OpenF1 fetch + loop.
// F1-only — OpenF1 is F1's official timing source.

import { sessionSlug } from './weekend';

/** Our schedule session (from the ICS feed + curated sessions.json overrides). */
export interface OurSessionLite {
  title: string;
  start: Date;
  dateOnly?: boolean;
}

/** An OpenF1 official session (name + ISO start). */
export interface OfficialSessionLite {
  name: string;
  dateStart: string;
}

export interface ScheduleDiff {
  session: string;
  kind: 'wrong-day' | 'wrong-time';
  ours: string;
  official: string;
}

function officialSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function hhmm(d: Date): string {
  return d.toISOString().slice(11, 16);
}

/**
 * Compare one round's sessions to the official set, matched by normalized type
 * (our "F1 - Practice 1" → "practice-1" via sessionSlug; OpenF1 "Practice 1" →
 * "practice-1"). Only sessions present in BOTH are compared — our support
 * sessions absent from OpenF1 are skipped (not flagged). A different UTC day is
 * a wrong-day; a same-day start off by more than `toleranceMin` is a wrong-time.
 * A date-only session is checked for day only (it carries no real time).
 */
export function diffRoundSchedule(
  ours: OurSessionLite[],
  official: OfficialSessionLite[],
  toleranceMin = 30,
): ScheduleDiff[] {
  const bySlug = new Map<string, OfficialSessionLite>();
  for (const o of official) bySlug.set(officialSlug(o.name), o);

  const out: ScheduleDiff[] = [];
  for (const s of ours) {
    const match = bySlug.get(sessionSlug(s.title));
    if (!match) continue;
    const off = new Date(match.dateStart);
    if (Number.isNaN(off.getTime())) continue;
    if (utcDay(s.start) !== utcDay(off)) {
      out.push({
        session: s.title,
        kind: 'wrong-day',
        ours: `${utcDay(s.start)}${s.dateOnly ? ' (date-only)' : ' ' + hhmm(s.start) + 'Z'}`,
        official: `${utcDay(off)} ${hhmm(off)}Z`,
      });
    } else if (!s.dateOnly) {
      const deltaMin = Math.abs(s.start.getTime() - off.getTime()) / 60000;
      if (deltaMin > toleranceMin) {
        out.push({
          session: s.title,
          kind: 'wrong-time',
          ours: `${hhmm(s.start)}Z`,
          official: `${hhmm(off)}Z (${Math.round(deltaMin)}m off)`,
        });
      }
    }
  }
  return out;
}
