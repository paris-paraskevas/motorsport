import { Session, SeriesRoundsFile, SignificanceFlag, Weekend } from './types';

export const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dateRangeLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (dateKey(start) === dateKey(end)) return fmt(start);
  const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' });
  const endStr = fmt(end);
  return `${startStr}–${endStr}`;
}

export function pickBestSignificance(sessions: Session[]): SignificanceFlag | undefined {
  const order: Record<string, number> = { marquee: 4, finale: 3, weighted: 2, note: 1 };
  let best: SignificanceFlag | undefined;
  for (const s of sessions) {
    const f = s.significance;
    if (!f) continue;
    if (!best || (order[f.tier] ?? 0) > (order[best.tier] ?? 0)) best = f;
  }
  return best;
}

/** Weekend shell from a session group. round stays 0 until assigned. */
export function buildWeekend(sessions: Session[], now: Date): Weekend {
  const significance = pickBestSignificance(sessions);
  const startDate = sessions[0].start;
  const endDate = sessions[sessions.length - 1].start;
  return {
    key: dateKey(startDate),
    label: significance?.weekend,
    dateRangeLabel: dateRangeLabel(startDate, endDate),
    sessions,
    significance,
    isPast: endDate.getTime() < now.getTime() - DAY_MS,
    round: 0,
  };
}

// Returns true when the rounds.json entry covers a weekend whose sessions
// fall within [startDate, endDate] inclusive (date-key comparison).
function rangeCovers(startDate: string, endDate: string, weekendStart: Date, weekendEnd: Date): boolean {
  const ws = dateKey(weekendStart);
  const we = dateKey(weekendEnd);
  return startDate <= we && endDate >= ws;
}

type RoundEntry = SeriesRoundsFile['rounds'][number];

function withRound(w: Weekend, match: RoundEntry): Weekend {
  return {
    ...w,
    round: match.round,
    roundName: match.name,
    previousStartDate: match.previousStartDate,
    previousEndDate: match.previousEndDate,
    rescheduleNote: match.rescheduleNote,
  };
}

// Days between a session's date key and a round's [startDate, endDate],
// zero when inside. Used to attach shared support days (shakedowns,
// doubleheader Friday practice) to the nearest of the covering rounds.
function dayDistance(key: string, entry: RoundEntry): number {
  const t = new Date(key + 'T00:00:00Z').getTime();
  if (key < entry.startDate) {
    return new Date(entry.startDate + 'T00:00:00Z').getTime() - t;
  }
  if (key > entry.endDate) {
    return t - new Date(entry.endDate + 'T00:00:00Z').getTime();
  }
  return 0;
}

// A weekend whose date range overlaps two or more rounds.json entries is a
// doubleheader the 4-day grouping heuristic merged (FE Jeddah/Berlin/Monaco/
// Shanghai/Tokyo/London 2026). The grouping is heuristic; rounds.json is the
// splitting authority — emit one Weekend per round so every round has a
// reachable page and frozen standings freeze at the right race (audit
// 1b-2 + 2-6: six FE rounds incl. the season finale 404'd while their races
// rendered inside the prior round's page).
function splitAcrossRounds(w: Weekend, matches: RoundEntry[], now: Date): Weekend[] {
  const buckets = new Map<number, Session[]>();
  for (const session of w.sessions) {
    const key = dateKey(session.start);
    const chosen =
      matches.find(r => r.startDate <= key && key <= r.endDate) ??
      matches.reduce((best, r) =>
        dayDistance(key, r) < dayDistance(key, best) ? r : best,
      );
    const bucket = buckets.get(chosen.round);
    if (bucket) bucket.push(session);
    else buckets.set(chosen.round, [session]);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, sessions]) => {
      const entry = matches.find(r => r.round === round)!;
      return withRound(buildWeekend(sessions, now), entry);
    });
}

export function assignRoundsToWeekends(
  weekends: Weekend[],
  rounds: SeriesRoundsFile | undefined,
  now: Date = new Date(),
): Weekend[] {
  if (!rounds) {
    return weekends.map((w, i) => ({ ...w, round: i + 1 }));
  }
  return weekends.flatMap(w => {
    const start = w.sessions[0]?.start;
    const end = w.sessions[w.sessions.length - 1]?.start;
    if (!start || !end) return [{ ...w, round: 0 }];
    const matches = rounds.rounds.filter(
      r => !r.cancelled && rangeCovers(r.startDate, r.endDate, start, end),
    );
    // When the series has curated rounds, weekends no entry covers
    // (pre-season tests, exhibitions) stay at round 0 — outside the curated
    // number space, never URL-addressable. The old index-fallback here let
    // MotoGP's Sepang/Buriram tests shadow real rounds 1-3 in production
    // (audit 1b-1): /weekend/1 served the shakedown, the Thai GP was
    // unreachable. Index numbering applies only when no rounds.json exists.
    if (matches.length === 0) return [{ ...w, round: 0 }];
    if (matches.length === 1) return [withRound(w, matches[0])];
    return splitAcrossRounds(w, matches, now);
  });
}
