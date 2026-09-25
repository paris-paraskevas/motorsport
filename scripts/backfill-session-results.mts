// P2.25: the backfill of the season's finished practice and qualifying sessions into the session_result rows, by the
// operator's hand, once the migration is on prod:
//
//   npx tsx --conditions=react-server --env-file=.env.production.local scripts/backfill-session-results.mts
//   ... --write            writes; without it the run is dry: the plan's counts alone, nothing fetched from OpenF1
//   ... --season 2026      the season (the series' current one by default)
//   ... --round 14         one round of the season alone (a retry, or the local proof)
//
// The plan: every F1 session of the kinds the Session results source offers (lib/design/sources.ts SESSION_KINDS) that
// ended more than thirty minutes ago (OpenF1's lockout) and has no rows in session_result_current yet. The write walks
// the plan in order through the capture path the warm-sessions cron uses (the weekend's OpenF1 sessions once per round,
// then the classification with its drivers, laps and stints), under the same hasResolvedDrivers guard, one source_run per
// session; the shared OpenF1 client paces the calls (3 a second, 30 a minute), so this script adds no throttling of its
// own. The output is counts and round/session names alone. A rerun changes nothing: a captured session is skipped.
import { basename } from 'node:path';
import { SESSION_KINDS } from '@/lib/design/sources';
import { loadSeries } from '@/lib/series';
import { buildRoundLookup, roundFor, sessionSlug } from '@/lib/weekend';
import { fetchOpenF1WeekendSessions, fetchSessionClassification, hasResolvedDrivers, type OpenF1Session } from '@/lib/results/openf1';
import { hasCurrentSessionResult, sessionResultKey, writeSessionResultRun } from '@/lib/session-result-rows';

export { SESSION_KINDS };

export interface BackfillSession {
  round: number;
  slug: string;
  start: Date;
  end: Date;
}
export interface BackfillPlan {
  /** The finished sessions of the five kinds, the earliest first. */
  eligible: BackfillSession[];
  /** Not yet captured and past the lockout: the write's list. */
  planned: BackfillSession[];
  /** Captured already: a rerun changes nothing. */
  skipped: BackfillSession[];
  /** Ended less than thirty minutes ago: OpenF1 refuses them; the next run takes them. */
  notYet: BackfillSession[];
}
export interface BackfillOutcome {
  ok: boolean;
  rows: number;
  note?: string;
}

/** OpenF1 refuses a session that ended less than thirty minutes ago to unauthenticated callers (read 2026-09-25). */
const LOCKOUT_MS = 30 * 60_000;
const KINDS: readonly string[] = SESSION_KINDS;

/** The plan from a season's sessions: what is finished, what is already captured, what is still locked out. */
export function planBackfill(sessions: readonly BackfillSession[], now: Date, present: ReadonlySet<string>, series = 'f1', season = 2026): BackfillPlan {
  const eligible = sessions.filter(s => KINDS.includes(s.slug) && s.end.getTime() <= now.getTime()).sort((a, b) => a.end.getTime() - b.end.getTime());
  const planned: BackfillSession[] = [];
  const skipped: BackfillSession[] = [];
  const notYet: BackfillSession[] = [];
  for (const s of eligible) {
    if (s.end.getTime() + LOCKOUT_MS > now.getTime()) notYet.push(s);
    else if (present.has(sessionResultKey(series, season, s.round, s.slug))) skipped.push(s);
    else planned.push(s);
  }
  return { eligible, planned, skipped, notYet };
}

/** The counts of a write: sessions written with their rows, and the failures. */
export function summarise(outcomes: readonly BackfillOutcome[]): { written: number; rows: number; failed: number } {
  let written = 0;
  let rows = 0;
  let failed = 0;
  for (const o of outcomes) {
    if (o.ok) {
      written++;
      rows += o.rows;
    } else failed++;
  }
  return { written, rows, failed };
}

/** The cron's matcher: the slugified OpenF1 session name first, then the nearest start within three hours. */
function matchOpenF1Session(candidates: readonly OpenF1Session[], slug: string, start: Date): OpenF1Session | null {
  const byName = candidates.find(s => sessionSlug(s.session_name) === slug);
  if (byName) return byName;
  let best: OpenF1Session | null = null;
  let bestDelta = 3 * 3600 * 1000;
  for (const s of candidates) {
    const delta = Math.abs(new Date(s.date_start).getTime() - start.getTime());
    if (delta < bestDelta) {
      bestDelta = delta;
      best = s;
    }
  }
  return best;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const series = await loadSeries('f1');
  const season = args.includes('--season') ? Number(args[args.indexOf('--season') + 1]) : series.meta.season;
  if (!Number.isInteger(season)) throw new Error('--season needs a year');
  const onlyRound = args.includes('--round') ? Number(args[args.indexOf('--round') + 1]) : null;
  if (onlyRound !== null && !Number.isInteger(onlyRound)) throw new Error('--round needs a number');
  const now = new Date();
  const lookup = buildRoundLookup(series, now);
  const sessions: BackfillSession[] = [];
  for (const s of series.sessions) {
    if (s.dateOnly) continue;
    const round = roundFor(lookup, series.meta.slug, s.uid);
    if (round === undefined || (onlyRound !== null && round !== onlyRound)) continue;
    sessions.push({ round, slug: sessionSlug(s.title), start: s.start, end: s.end });
  }
  const present = new Set<string>();
  for (const s of sessions) {
    if (!KINDS.includes(s.slug) || s.end.getTime() > now.getTime()) continue;
    if (await hasCurrentSessionResult({ series: 'f1', season, round: s.round, session: s.slug })) present.add(sessionResultKey('f1', season, s.round, s.slug));
  }
  const plan = planBackfill(sessions, now, present, 'f1', season);
  const rounds = new Set(plan.planned.map(s => s.round)).size;
  console.log(
    `${write ? 'WRITE' : 'DRY RUN'} · F1 ${season} · ${plan.eligible.length} finished sessions of the five kinds · ${plan.skipped.length} captured already · ` +
      `${plan.notYet.length} inside the lockout · ${plan.planned.length} to capture across ${rounds} rounds (${plan.planned.length * 4 + rounds} OpenF1 calls)`,
  );
  for (const s of plan.planned) console.log(`  plan   r${s.round} ${s.slug}`);
  if (!write) return;

  const byRound = new Map<number, OpenF1Session[]>();
  const outcomes: BackfillOutcome[] = [];
  const report = (s: BackfillSession, o: BackfillOutcome) => {
    outcomes.push(o);
    console.log(`  ${o.ok ? 'wrote ' : 'failed'} r${s.round} ${s.slug}: ${o.ok ? `${o.rows} rows` : o.note}`);
  };
  for (const s of plan.planned) {
    let weekendSessions = byRound.get(s.round);
    if (!weekendSessions) {
      const own = sessions.filter(x => x.round === s.round);
      const start = new Date(Math.min(...own.map(x => x.start.getTime())));
      const end = new Date(Math.max(...own.map(x => x.end.getTime())));
      weekendSessions = await fetchOpenF1WeekendSessions(start, end);
      byRound.set(s.round, weekendSessions);
    }
    const match = matchOpenF1Session(weekendSessions, s.slug, s.start);
    if (!match) {
      report(s, { ok: false, rows: 0, note: 'no-openf1-match' });
      continue;
    }
    const classification = await fetchSessionClassification(match);
    if (!classification || classification.entries.length === 0) {
      report(s, { ok: false, rows: 0, note: 'no-classification' });
      continue;
    }
    if (!hasResolvedDrivers(classification)) {
      report(s, { ok: false, rows: 0, note: 'no-driver-names' });
      continue;
    }
    const out = await writeSessionResultRun({ series: 'f1', season, round: s.round, session: s.slug, entries: classification.entries, runner: 'backfill-session-results' });
    report(s, { ok: out.ok, rows: out.rows, note: out.note });
  }
  const sum = summarise(outcomes);
  console.log(`written ${sum.written} sessions (${sum.rows} rows), failed ${sum.failed}`);
}

if (process.argv[1] && basename(process.argv[1]) === 'backfill-session-results.mts') await main();
