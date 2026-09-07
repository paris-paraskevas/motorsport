import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { logSourceError } from '@/lib/fetch-upstream';
import type { DriverStanding, ConstructorStanding } from '@/lib/types';

// Phase 0 of the designer plan: standings as ROWS with provenance, beside the
// JSON payloads in `source_snapshot` (migration 20260907190000).
//
// Every row carries the `source_run` that wrote it. A load inserts under a fresh
// run and marks the run `ok` LAST, so the `standing_current` view (newest ok run
// per source) never shows a half-written load, and a bad load is rolled back by
// marking its run `failed`. There are no multi-request transactions through
// PostgREST; the run id is the transaction.
//
// FAIL-SOFT like lib/source-snapshot.ts: a missing table (migration not yet
// applied), an unconfigured Supabase or a network error is logged and the caller
// falls back to what it has. Nothing here may break a render or a warm run.

export type StandingKind = 'driver' | 'constructor';

export interface StandingRow {
  kind: StandingKind;
  position: number;
  name: string;
  code?: string;
  team?: string;
  points: number;
  wins?: number;
  className?: string;
}

export interface StandingsShape {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function driverRow(raw: unknown): StandingRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.driverName) ?? str(r.name);
  if (!isNum(r.position) || !isNum(r.points) || !name) return null;
  return {
    kind: 'driver',
    position: r.position,
    name,
    code: str(r.driverCode),
    team: str(r.team),
    points: r.points,
    wins: isNum(r.wins) ? r.wins : undefined,
    className: str(r.className) ?? str(r.class),
  };
}

function constructorRow(raw: unknown): StandingRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name) ?? str(r.team);
  if (!isNum(r.position) || !isNum(r.points) || !name) return null;
  return {
    kind: 'constructor',
    position: r.position,
    name,
    points: r.points,
    wins: isNum(r.wins) ? r.wins : undefined,
    className: str(r.className) ?? str(r.class),
  };
}

/**
 * Map a standings payload to rows. Recognises the two shapes the fetchers return
 * today: `{ drivers, constructors }` (`teams` accepted for `constructors`) and a
 * bare `DriverStanding[]`. Anything else returns null and the caller logs it:
 * an unmapped series is a follow-up, never a guess. Rows that fail the shape
 * check are dropped individually, so one bad line cannot sink a table.
 */
export function standingRowsFromPayload(payload: unknown): StandingRow[] | null {
  if (Array.isArray(payload)) {
    const rows = payload.map(driverRow).filter((r): r is StandingRow => r !== null);
    return rows.length ? rows : null;
  }
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    const drivers = Array.isArray(p.drivers)
      ? p.drivers.map(driverRow).filter((r): r is StandingRow => r !== null)
      : [];
    const teamsSrc = Array.isArray(p.constructors) ? p.constructors : Array.isArray(p.teams) ? p.teams : [];
    const constructors = teamsSrc.map(constructorRow).filter((r): r is StandingRow => r !== null);
    if (!drivers.length && !constructors.length) return null;
    return [...drivers, ...constructors];
  }
  return null;
}

export interface StandingRunOutcome {
  ok: boolean;
  rows: number;
  runId?: string;
  note: string;
}

/**
 * Write one source's standings as rows under a new run. Used by the loader
 * (scripts/warm-live-data.mts) only; the Worker never calls this.
 */
export async function writeStandingRun(opts: {
  sourceKey: string;
  label: string;
  series: string;
  season: number;
  payload: unknown;
  runner: string;
}): Promise<StandingRunOutcome> {
  if (!isBettingConfigured()) return { ok: false, rows: 0, note: 'supabase not configured' };
  const rows = standingRowsFromPayload(opts.payload);
  if (!rows) return { ok: false, rows: 0, note: 'payload shape not mapped yet' };
  const db = betDb();
  let runId: string | undefined;
  try {
    const src = await db
      .from('source')
      .upsert({ key: opts.sourceKey, kind: 'rest', label: opts.label, target_table: 'standing' }, { onConflict: 'key' });
    if (src.error) throw new Error(src.error.message);
    const run = await db
      .from('source_run')
      .insert({ source_key: opts.sourceKey, status: 'running', runner: opts.runner })
      .select('id')
      .single();
    if (run.error || !run.data) throw new Error(run.error?.message ?? 'no run id returned');
    runId = String((run.data as { id: unknown }).id);
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const ins = await db.from('standing').insert(
        rows.slice(i, i + CHUNK).map(r => ({
          source_run_id: runId,
          series: opts.series,
          season: opts.season,
          kind: r.kind,
          class_name: r.className ?? null,
          position: r.position,
          name: r.name,
          code: r.code ?? null,
          team: r.team ?? null,
          points: r.points,
          wins: r.wins ?? null,
        })),
      );
      if (ins.error) throw new Error(ins.error.message);
    }
    // Marked ok LAST: until this update lands the rows are invisible to readers.
    const done = await db
      .from('source_run')
      .update({ status: 'ok', finished_at: new Date().toISOString(), rows_written: rows.length })
      .eq('id', runId);
    if (done.error) throw new Error(done.error.message);
    return { ok: true, rows: rows.length, runId, note: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logSourceError(`standing:write:${opts.sourceKey}`, err);
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
 * The current standings for a series from the `standing_current` view, in the
 * shape the F1 tab already renders. Null on no rows, error or unconfigured, so
 * the caller falls back to the payload path. `points` arrives as a string
 * (numeric over JSON) and is coerced.
 */
export async function readCurrentStandings(series: string, season: number): Promise<StandingsShape | null> {
  if (!isBettingConfigured()) return null;
  try {
    const { data, error } = await betDb()
      .from('standing_current')
      .select('kind, position, name, code, team, points, wins')
      .eq('series', series)
      .eq('season', season)
      .order('position', { ascending: true });
    if (error || !data || data.length === 0) return null;
    const drivers: DriverStanding[] = [];
    const constructors: ConstructorStanding[] = [];
    for (const r of data as Record<string, unknown>[]) {
      const wins = r.wins == null ? undefined : Number(r.wins);
      if (r.kind === 'driver') {
        drivers.push({
          position: Number(r.position),
          driverName: String(r.name),
          driverCode: r.code ? String(r.code) : undefined,
          team: r.team ? String(r.team) : '',
          points: Number(r.points),
          wins,
        });
      } else {
        constructors.push({ position: Number(r.position), name: String(r.name), points: Number(r.points), wins });
      }
    }
    if (!drivers.length) return null;
    return { drivers, constructors };
  } catch (err) {
    logSourceError(`standing:read:${series}`, err);
    return null;
  }
}

export interface SourceRunSummary {
  sourceKey: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  rowsWritten: number;
  error: string | null;
  /** Minutes since the run finished; null while running. */
  ageMinutes: number | null;
}

/** Newest run per source, stalest first — the console's Loads panel. */
export async function latestRuns(): Promise<SourceRunSummary[]> {
  if (!isBettingConfigured()) return [];
  try {
    const { data, error } = await betDb()
      .from('source_run')
      .select('source_key, status, started_at, finished_at, rows_written, error')
      .order('started_at', { ascending: false })
      .limit(300);
    if (error || !data) return [];
    const now = Date.now();
    const seen = new Map<string, SourceRunSummary>();
    for (const r of data as Record<string, unknown>[]) {
      const key = String(r.source_key);
      if (seen.has(key)) continue;
      const finishedAt = (r.finished_at as string | null) ?? null;
      seen.set(key, {
        sourceKey: key,
        status: String(r.status),
        startedAt: String(r.started_at),
        finishedAt,
        rowsWritten: Number(r.rows_written ?? 0),
        error: (r.error as string | null) ?? null,
        ageMinutes: finishedAt ? Math.round((now - Date.parse(finishedAt)) / 60000) : null,
      });
    }
    return [...seen.values()].sort((a, b) => (b.ageMinutes ?? -1) - (a.ageMinutes ?? -1));
  } catch {
    return [];
  }
}

/**
 * Drop runs older than `keepDays` except the newest ok run of every source (the
 * view depends on it). Rows go with their run (`on delete cascade`). Returns the
 * number of runs removed; 0 on any failure.
 */
export async function pruneStandingRuns(keepDays = 30): Promise<number> {
  if (!isBettingConfigured()) return 0;
  try {
    const db = betDb();
    const cutoff = new Date(Date.now() - keepDays * 86_400_000).toISOString();
    const { data, error } = await db
      .from('source_run')
      .select('id, source_key')
      .eq('status', 'ok')
      .order('finished_at', { ascending: false });
    if (error || !data) return 0;
    const keep: string[] = [];
    const seen = new Set<string>();
    for (const r of data as Record<string, unknown>[]) {
      const key = String(r.source_key);
      if (seen.has(key)) continue;
      seen.add(key);
      keep.push(String(r.id));
    }
    let q = db.from('source_run').delete({ count: 'exact' }).lt('started_at', cutoff);
    if (keep.length) q = q.not('id', 'in', `(${keep.join(',')})`);
    const { error: delError, count } = await q;
    if (delError) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
