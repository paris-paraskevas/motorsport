import { beforeEach, describe, expect, it, vi } from 'vitest';

// P2.25: a session's classification as ROWS with provenance (the Phase 0 pattern of
// lib/standing-rows.ts). The row tier must never break a warm run or a render:
// every DB shape here is exercised for the fail-soft path as well as the happy one.

let configured = true;
type Reply = { data?: unknown; error?: { message: string } | null; count?: number | null };
const replies: Record<string, Reply> = {};
const calls: { table: string; op: string; arg?: unknown }[] = [];

function chain(table: string, op: string, arg?: unknown): unknown {
  calls.push({ table, op, arg });
  const reply = replies[`${table}:${op}`] ?? { data: [], error: null, count: 0 };
  const p = Promise.resolve(reply);
  const c: Record<string, unknown> = {
    eq: () => c,
    order: () => c,
    limit: () => c,
    select: () => c,
    single: () => Promise.resolve(replies[`${table}:single`] ?? reply),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  };
  return c;
}

vi.mock('./betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => ({
      upsert: (row: unknown) => chain(table, 'upsert', row),
      insert: (rows: unknown) => chain(table, 'insert', rows),
      update: (row: unknown) => chain(table, 'update', row),
      select: (cols: unknown) => chain(table, 'select', cols),
    }),
  }),
}));
vi.mock('./fetch-upstream', () => ({ logSourceError: vi.fn() }));

import { hasCurrentSessionResult, readCurrentSessionResults, sessionResultKey, writeSessionResultRun } from './session-result-rows';
import { bestLapCompounds } from './results/openf1';

describe('bestLapCompounds (the tyre the rows carry, lib/results/openf1.ts)', () => {
  it('names the compound of each driver’s fastest timed lap from the stint that holds it, as a word; a driver without both is absent', () => {
    const lap = (driver_number: number, lap_number: number, lap_duration: number | null) => ({ driver_number, lap_number, lap_duration, duration_sector_1: null, duration_sector_2: null, duration_sector_3: null, i1_speed: null, i2_speed: null, st_speed: null, is_pit_out_lap: false, date_start: null, segments_sector_1: null, segments_sector_2: null, segments_sector_3: null, session_key: 1 });
    const stint = (driver_number: number, stint_number: number, lap_start: number, lap_end: number, compound: string | null) => ({ driver_number, stint_number, lap_start, lap_end, compound, tyre_age_at_start: 0, session_key: 1 });
    const laps = [lap(81, 1, null), lap(81, 2, 101.5), lap(81, 7, 100.2), lap(81, 8, 100.9), lap(4, 3, 100.4), lap(4, 9, 0), lap(16, 2, 102.0)];
    const stints = [stint(81, 1, 1, 4, 'MEDIUM'), stint(81, 2, 5, 9, 'SOFT'), stint(4, 1, 1, 12, 'hard'), stint(16, 1, 1, 5, null)];
    const out = bestLapCompounds(laps, stints);
    expect(out.get(81)).toBe('Soft');
    expect(out.get(4)).toBe('Hard');
    expect(out.has(16)).toBe(false);
    expect(bestLapCompounds([], stints).size).toBe(0);
    expect(bestLapCompounds(laps, []).size).toBe(0);
  });
});

const entries = [
  { position: 1, driverName: 'Oscar Piastri', driverCode: 'PIA', carNumber: '81', team: 'McLaren', laps: 18, time: '1:40.123', q1: '1:41.000', q2: '1:40.500', q3: '1:40.123', compound: 'Soft' },
  { position: 2, driverName: 'Lando Norris', driverCode: 'NOR', carNumber: '4', team: 'McLaren', laps: 17, time: '1:40.223', gap: '+0.100', interval: '+0.100', compound: 'Soft' },
  { position: null, driverName: 'Nobody Here', team: 'Somewhere', status: 'DNS' as const },
];
const ask = { series: 'f1', season: 2026, round: 15, session: 'qualifying' };

const viewRow = (over: Record<string, unknown> = {}) => ({
  source_run_id: 'run-15',
  round: 15,
  session: 'qualifying',
  position: 1,
  driver_name: 'Oscar Piastri',
  driver_code: 'PIA',
  car_number: '81',
  team: 'McLaren',
  laps: 18,
  time: '1:40.123',
  gap: null,
  interval: null,
  q1: '1:41.000',
  q2: '1:40.500',
  q3: '1:40.123',
  compound: 'Soft',
  points: null,
  status: null,
  ...over,
});

beforeEach(() => {
  configured = true;
  calls.length = 0;
  for (const k of Object.keys(replies)) delete replies[k];
});

describe('sessionResultKey', () => {
  it('names one session of one round: the series, the season, the round and the session slug', () => {
    expect(sessionResultKey('f1', 2026, 15, 'qualifying')).toBe('session-result:f1:2026:15:qualifying');
  });
});

describe('writeSessionResultRun', () => {
  it('registers the source, opens a run, inserts one row per entry and marks the run ok LAST', async () => {
    replies['source_run:single'] = { data: { id: 'run-1' } };
    const out = await writeSessionResultRun({ ...ask, entries, runner: 'test' });
    expect(out).toEqual({ ok: true, rows: 3, runId: 'run-1', note: 'ok' });
    expect(calls.map(c => `${c.table}:${c.op}`)).toEqual(['source:upsert', 'source_run:insert', 'session_result:insert', 'source_run:update']);
    expect(calls[0].arg).toMatchObject({ key: 'session-result:f1:2026:15:qualifying', target_table: 'session_result' });
    const rows = calls[2].arg as Record<string, unknown>[];
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      source_run_id: 'run-1',
      series: 'f1',
      season: 2026,
      round: 15,
      session: 'qualifying',
      position: 1,
      driver_name: 'Oscar Piastri',
      driver_code: 'PIA',
      car_number: '81',
      team: 'McLaren',
      laps: 18,
      time: '1:40.123',
      gap: null,
      interval: null,
      q1: '1:41.000',
      q2: '1:40.500',
      q3: '1:40.123',
      compound: 'Soft',
      points: null,
      status: null,
    });
    // A DNS row keeps its null position: data, not an error.
    expect(rows[2]).toMatchObject({ position: null, driver_name: 'Nobody Here', status: 'DNS', compound: null });
    expect(calls[3].arg).toMatchObject({ status: 'ok', rows_written: 3 });
  });

  it('marks the run failed and reports the error when a row insert fails', async () => {
    replies['source_run:single'] = { data: { id: 'run-2' } };
    replies['session_result:insert'] = { error: { message: 'boom' } };
    const out = await writeSessionResultRun({ ...ask, entries, runner: 'test' });
    expect(out).toEqual({ ok: false, rows: 0, runId: 'run-2', note: 'boom' });
    expect(calls.at(-1)).toMatchObject({ table: 'source_run', op: 'update', arg: { status: 'failed', error: 'boom' } });
  });

  it('touches nothing without entries or without a configured database', async () => {
    expect(await writeSessionResultRun({ ...ask, entries: [], runner: 'test' })).toEqual({ ok: false, rows: 0, note: 'no entries' });
    configured = false;
    expect(await writeSessionResultRun({ ...ask, entries, runner: 'test' })).toEqual({ ok: false, rows: 0, note: 'supabase not configured' });
    expect(calls).toEqual([]);
  });
});

describe('readCurrentSessionResults', () => {
  it('answers a numbered round’s rows from the view, in the entry shape, with the run behind them', async () => {
    replies['session_result_current:select'] = { data: [viewRow(), viewRow({ position: 2, driver_name: 'Lando Norris', driver_code: 'NOR', car_number: '4', laps: 17, time: '1:40.223', gap: '+0.100', interval: '+0.100', q1: null, q2: null, q3: null })] };
    const out = await readCurrentSessionResults(ask);
    expect(out?.round).toBe(15);
    expect(out?.runId).toBe('run-15');
    expect(out?.rows).toHaveLength(2);
    expect(out?.rows[0]).toEqual({
      session: 'qualifying',
      position: 1,
      driverName: 'Oscar Piastri',
      driverCode: 'PIA',
      carNumber: '81',
      team: 'McLaren',
      laps: 18,
      time: '1:40.123',
      gap: null,
      interval: null,
      q1: '1:41.000',
      q2: '1:40.500',
      q3: '1:40.123',
      compound: 'Soft',
      points: null,
      status: null,
    });
    expect(out?.rows[1]).toMatchObject({ position: 2, driverName: 'Lando Norris', gap: '+0.100' });
  });

  it('the latest round: the newest round holding a captured session of that kind, its rows alone', async () => {
    replies['session_result_current:select'] = {
      data: [viewRow({ round: 15, source_run_id: 'run-15' }), viewRow({ round: 15, position: 2, driver_name: 'Lando Norris', source_run_id: 'run-15' }), viewRow({ round: 14, source_run_id: 'run-14' })],
    };
    const out = await readCurrentSessionResults({ ...ask, round: 'latest' });
    expect(out?.round).toBe(15);
    expect(out?.runId).toBe('run-15');
    expect(out?.rows.map(r => r.driverName)).toEqual(['Oscar Piastri', 'Lando Norris']);
  });

  it('returns null on no rows, on an error and when unconfigured, so the region draws empty', async () => {
    expect(await readCurrentSessionResults(ask)).toBeNull();
    replies['session_result_current:select'] = { error: { message: 'relation does not exist' } };
    expect(await readCurrentSessionResults(ask)).toBeNull();
    configured = false;
    expect(await readCurrentSessionResults(ask)).toBeNull();
  });
});

describe('hasCurrentSessionResult', () => {
  it('is true when the view holds a row for the session, false when it holds none, fails or is unconfigured', async () => {
    replies['session_result_current:select'] = { data: [{ round: 15 }] };
    expect(await hasCurrentSessionResult(ask)).toBe(true);
    replies['session_result_current:select'] = { data: [] };
    expect(await hasCurrentSessionResult(ask)).toBe(false);
    replies['session_result_current:select'] = { error: { message: 'boom' } };
    expect(await hasCurrentSessionResult(ask)).toBe(false);
    configured = false;
    expect(await hasCurrentSessionResult(ask)).toBe(false);
  });
});
