import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { logSourceError } from '@/lib/fetch-upstream';
import type { SessionClassificationEntry } from '@/lib/results/openf1';

// P2.25 (Session results): one F1 session's classification as ROWS with
// provenance, beside the KV entry the session page reads (migration
// 20260925130000). The pattern is lib/standing-rows.ts's, kept line for line:
// a capture inserts under a fresh `source_run` and marks the run `ok` LAST, so
// the `session_result_current` view (newest ok run per source) never shows a
// half-written capture, and a bad one is rolled back by marking its run
// `failed`. One `source` per session, keyed by series, season, round and
// session, so the view keeps every captured session at once.
//
// FAIL-SOFT like standing-rows: a missing table (migration not yet applied), an
// unconfigured Supabase or a network error is logged and answered as a
// failure or as null. Nothing here may break a render or a warm run.

export const SESSION_RESULT_KEY_PREFIX = 'session-result';

/** The source key of one session of one round: `session-result:f1:2026:15:qualifying`. */
export function sessionResultKey(series: string, season: number, round: number, session: string): string {
  return `${SESSION_RESULT_KEY_PREFIX}:${series}:${season}:${round}:${session}`;
}

export interface SessionResultRunOutcome {
  ok: boolean;
  rows: number;
  runId?: string;
  note: string;
}

export interface SessionAsk {
  series: string;
  season: number;
  round: number | 'latest';
  session: string;
}

/** The view's row in the entry's own words, plus the session it belongs to. */
export interface SessionResultRow {
  session: string;
  position: number | null;
  driverName: string;
  driverCode: string | null;
  carNumber: string | null;
  team: string | null;
  laps: number | null;
  time: string | null;
  gap: string | null;
  interval: string | null;
  q1: string | null;
  q2: string | null;
  q3: string | null;
  compound: string | null;
  points: number | null;
  status: string | null;
}

const VIEW_COLUMNS = 'source_run_id, round, session, position, driver_name, driver_code, car_number, team, laps, time, gap, interval, q1, q2, q3, compound, points, status';
/** Rows enough for one round of a 22-car grid, with room for a corrected recapture's extra lines. */
const LATEST_ROWS_MAX = 40;

const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Write one session's classification as rows under a new run. Called by the
 * warm-sessions cron beside its KV write, and by the backfill script; never by
 * a page render.
 */
export async function writeSessionResultRun(opts: {
  series: string;
  season: number;
  round: number;
  session: string;
  entries: readonly SessionClassificationEntry[];
  runner: string;
}): Promise<SessionResultRunOutcome> {
  if (!isBettingConfigured()) return { ok: false, rows: 0, note: 'supabase not configured' };
  if (opts.entries.length === 0) return { ok: false, rows: 0, note: 'no entries' };
  const sourceKey = sessionResultKey(opts.series, opts.season, opts.round, opts.session);
  const db = betDb();
  let runId: string | undefined;
  try {
    const src = await db
      .from('source')
      .upsert({ key: sourceKey, kind: 'rest', label: `${opts.series} ${opts.season} round ${opts.round} ${opts.session}`, target_table: 'session_result' }, { onConflict: 'key' });
    if (src.error) throw new Error(src.error.message);
    const run = await db.from('source_run').insert({ source_key: sourceKey, status: 'running', runner: opts.runner }).select('id').single();
    if (run.error || !run.data) throw new Error(run.error?.message ?? 'no run id returned');
    runId = String((run.data as { id: unknown }).id);
    const CHUNK = 500;
    for (let i = 0; i < opts.entries.length; i += CHUNK) {
      const ins = await db.from('session_result').insert(
        opts.entries.slice(i, i + CHUNK).map(e => ({
          source_run_id: runId,
          series: opts.series,
          season: opts.season,
          round: opts.round,
          session: opts.session,
          position: e.position ?? null,
          driver_name: e.driverName,
          driver_code: e.driverCode ?? null,
          car_number: e.carNumber ?? null,
          team: e.team ?? null,
          laps: e.laps ?? null,
          time: e.time ?? null,
          gap: e.gap ?? null,
          interval: e.interval ?? null,
          q1: e.q1 ?? null,
          q2: e.q2 ?? null,
          q3: e.q3 ?? null,
          compound: e.compound ?? null,
          points: e.points ?? null,
          status: e.status ?? null,
        })),
      );
      if (ins.error) throw new Error(ins.error.message);
    }
    // Marked ok LAST: until this update lands the rows are invisible to readers.
    const done = await db
      .from('source_run')
      .update({ status: 'ok', finished_at: new Date().toISOString(), rows_written: opts.entries.length })
      .eq('id', runId);
    if (done.error) throw new Error(done.error.message);
    return { ok: true, rows: opts.entries.length, runId, note: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logSourceError(`session-result:write:${sourceKey}`, err);
    if (runId) {
      try {
        await db
          .from('source_run')
          .update({ status: 'failed', finished_at: new Date().toISOString(), error: message.slice(0, 500) })
          .eq('id', runId);
      } catch {
        // The failure is already logged; a second failure has nothing to add.
      }
    }
    return { ok: false, rows: 0, runId, note: message };
  }
}

/**
 * The current rows of one session from the `session_result_current` view: a
 * numbered round's, or the latest round holding a captured session of that
 * kind (the newest round first, its rows alone). Null on no rows, error or
 * unconfigured, so the region draws empty.
 */
export async function readCurrentSessionResults(ask: SessionAsk): Promise<{ round: number; rows: SessionResultRow[]; runId: string | null } | null> {
  if (!isBettingConfigured()) return null;
  try {
    let q = betDb().from('session_result_current').select(VIEW_COLUMNS).eq('series', ask.series).eq('season', ask.season).eq('session', ask.session);
    if (ask.round !== 'latest') q = q.eq('round', ask.round);
    let ordered = q.order('round', { ascending: false }).order('position', { ascending: true, nullsFirst: false });
    // The latest round is the source's default pick: the newest round's rows come first in this order, so the read stops
    // after one round's worth (F1 classifies at most 22 cars) instead of the whole season's.
    if (ask.round === 'latest') ordered = ordered.limit(LATEST_ROWS_MAX);
    const { data, error } = await ordered;
    if (error || !data || data.length === 0) return null;
    const all = data as Record<string, unknown>[];
    const round = numOrNull(all[0].round);
    if (round === null) return null;
    const rows = all.filter(r => numOrNull(r.round) === round);
    const run = rows.find(r => r.source_run_id != null)?.source_run_id;
    return {
      round,
      runId: run == null ? null : String(run),
      rows: rows.map(r => ({
        session: String(r.session ?? ask.session),
        position: numOrNull(r.position),
        driverName: String(r.driver_name ?? ''),
        driverCode: strOrNull(r.driver_code),
        carNumber: strOrNull(r.car_number),
        team: strOrNull(r.team),
        laps: numOrNull(r.laps),
        time: strOrNull(r.time),
        gap: strOrNull(r.gap),
        interval: strOrNull(r.interval),
        q1: strOrNull(r.q1),
        q2: strOrNull(r.q2),
        q3: strOrNull(r.q3),
        compound: strOrNull(r.compound),
        points: numOrNull(r.points),
        status: strOrNull(r.status),
      })),
    };
  } catch (err) {
    logSourceError(`session-result:read:${ask.series}:${ask.session}`, err);
    return null;
  }
}

/** Whether the view holds the session's rows already (the backfill's skip). False on error or unconfigured. */
export async function hasCurrentSessionResult(ask: { series: string; season: number; round: number; session: string }): Promise<boolean> {
  if (!isBettingConfigured()) return false;
  try {
    const { data, error } = await betDb()
      .from('session_result_current')
      .select('round')
      .eq('series', ask.series)
      .eq('season', ask.season)
      .eq('round', ask.round)
      .eq('session', ask.session)
      .limit(1);
    return !error && Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}
