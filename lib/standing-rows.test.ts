import { beforeEach, describe, expect, it, vi } from 'vitest';

// The row tier must never break a render or a warm run: every DB shape here is
// exercised for the fail-soft path as well as the happy one.

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
    lt: () => c,
    not: () => c,
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
      delete: () => chain(table, 'delete'),
    }),
  }),
}));
vi.mock('./fetch-upstream', () => ({ logSourceError: vi.fn() }));

import {
  standingRowsFromPayload,
  writeStandingRun,
  readCurrentStandings,
  latestRuns,
  pruneStandingRuns,
} from './standing-rows';

const f1Payload = {
  drivers: [
    { position: 1, driverName: 'Kimi Antonelli', driverCode: 'ANT', team: 'Mercedes', points: 267, wins: 7 },
    { position: 2, driverName: 'George Russell', driverCode: 'RUS', team: 'Mercedes', points: 201, wins: 2 },
    { position: 'x', driverName: 'Broken Row', team: 'Nowhere', points: 1 },
  ],
  constructors: [{ position: 1, name: 'Mercedes', points: 468, wins: 9 }],
};

beforeEach(() => {
  configured = true;
  calls.length = 0;
  for (const k of Object.keys(replies)) delete replies[k];
});

describe('standingRowsFromPayload', () => {
  it('maps the { drivers, constructors } shape and drops rows that fail the shape check', () => {
    const rows = standingRowsFromPayload(f1Payload)!;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      kind: 'driver',
      position: 1,
      name: 'Kimi Antonelli',
      code: 'ANT',
      team: 'Mercedes',
      points: 267,
      wins: 7,
      className: undefined,
    });
    expect(rows[2]).toMatchObject({ kind: 'constructor', name: 'Mercedes', points: 468 });
  });

  it('maps a bare driver array and accepts `teams` for constructors', () => {
    expect(standingRowsFromPayload([{ position: 1, driverName: 'A', team: 'T', points: 10 }])).toHaveLength(1);
    const rows = standingRowsFromPayload({ drivers: [], teams: [{ position: 1, team: 'Team Only', points: 5 }] })!;
    expect(rows).toEqual([{ kind: 'constructor', position: 1, name: 'Team Only', points: 5, wins: undefined, className: undefined }]);
  });

  it('returns null for shapes it does not recognise, so the caller logs instead of guessing', () => {
    expect(standingRowsFromPayload(null)).toBeNull();
    expect(standingRowsFromPayload('nope')).toBeNull();
    expect(standingRowsFromPayload({ feature: [], sprint: [] })).toBeNull();
    expect(standingRowsFromPayload([{ position: 1 }])).toBeNull();
  });
});

describe('writeStandingRun', () => {
  const opts = { sourceKey: 'standings:f1', label: 'Formula 1', series: 'f1', season: 2026, payload: f1Payload, runner: 'test' };

  it('registers the source, opens a run, inserts the rows and marks the run ok LAST', async () => {
    replies['source_run:single'] = { data: { id: 'run-1' }, error: null };
    const out = await writeStandingRun(opts);
    expect(out).toEqual({ ok: true, rows: 3, runId: 'run-1', note: 'ok' });
    const ops = calls.map(c => `${c.table}:${c.op}`);
    expect(ops).toEqual(['source:upsert', 'source_run:insert', 'standing:insert', 'source_run:update']);
    const inserted = calls[2].arg as Record<string, unknown>[];
    expect(inserted[0]).toMatchObject({ source_run_id: 'run-1', series: 'f1', season: 2026, kind: 'driver', name: 'Kimi Antonelli', points: 267 });
    expect(calls[3].arg).toMatchObject({ status: 'ok', rows_written: 3 });
  });

  it('marks the run failed and reports the error when a row insert fails', async () => {
    replies['source_run:single'] = { data: { id: 'run-2' }, error: null };
    replies['standing:insert'] = { error: { message: 'relation "public.standing" does not exist' } };
    const out = await writeStandingRun(opts);
    expect(out.ok).toBe(false);
    expect(out.note).toMatch(/does not exist/);
    const last = calls[calls.length - 1];
    expect(last.table).toBe('source_run');
    expect(last.arg).toMatchObject({ status: 'failed' });
  });

  it('skips an unmapped payload and an unconfigured database without touching the DB', async () => {
    expect(await writeStandingRun({ ...opts, payload: { feature: [] } })).toMatchObject({ ok: false, note: 'payload shape not mapped yet' });
    configured = false;
    expect(await writeStandingRun(opts)).toMatchObject({ ok: false, note: 'supabase not configured' });
    expect(calls).toHaveLength(0);
  });
});

describe('readCurrentStandings', () => {
  it('groups the view rows into the tab shape and coerces numeric strings', async () => {
    replies['standing_current:select'] = {
      data: [
        { kind: 'driver', position: 1, name: 'Kimi Antonelli', code: 'ANT', team: 'Mercedes', points: '267', wins: 7 },
        { kind: 'constructor', position: 1, name: 'Mercedes', code: null, team: null, points: '468', wins: null },
      ],
      error: null,
    };
    const out = await readCurrentStandings('f1', 2026);
    expect(out?.drivers).toEqual([{ position: 1, driverName: 'Kimi Antonelli', driverCode: 'ANT', team: 'Mercedes', points: 267, wins: 7 }]);
    expect(out?.constructors).toEqual([{ position: 1, name: 'Mercedes', points: 468, wins: undefined }]);
  });

  it('returns null on no rows, on an error and when unconfigured, so the caller falls back', async () => {
    replies['standing_current:select'] = { data: [], error: null };
    expect(await readCurrentStandings('f1', 2026)).toBeNull();
    replies['standing_current:select'] = { data: null, error: { message: 'boom' } };
    expect(await readCurrentStandings('f1', 2026)).toBeNull();
    configured = false;
    expect(await readCurrentStandings('f1', 2026)).toBeNull();
  });
});

describe('latestRuns and pruneStandingRuns', () => {
  it('keeps the newest run per source, stalest first, and tolerates failures', async () => {
    const now = Date.now();
    replies['source_run:select'] = {
      data: [
        { source_key: 'standings:f1', status: 'ok', started_at: new Date(now - 60_000).toISOString(), finished_at: new Date(now - 30_000).toISOString(), rows_written: 34, error: null },
        { source_key: 'standings:f1', status: 'failed', started_at: new Date(now - 90_000).toISOString(), finished_at: new Date(now - 80_000).toISOString(), rows_written: 0, error: 'x' },
        { source_key: 'standings:wec', status: 'ok', started_at: new Date(now - 7_200_000).toISOString(), finished_at: new Date(now - 7_000_000).toISOString(), rows_written: 76, error: null },
      ],
      error: null,
    };
    const runs = await latestRuns();
    expect(runs.map(r => r.sourceKey)).toEqual(['standings:wec', 'standings:f1']);
    expect(runs[1]).toMatchObject({ status: 'ok', rowsWritten: 34 });
    replies['source_run:select'] = { data: null, error: { message: 'no table' } };
    expect(await latestRuns()).toEqual([]);
  });

  it('deletes old runs but never the newest ok run of a source', async () => {
    replies['source_run:select'] = { data: [{ id: 'keep-f1', source_key: 'standings:f1' }, { id: 'old-f1', source_key: 'standings:f1' }], error: null };
    replies['source_run:delete'] = { error: null, count: 4 };
    expect(await pruneStandingRuns(30)).toBe(4);
    const del = calls.find(c => c.op === 'delete');
    expect(del?.table).toBe('source_run');
    replies['source_run:delete'] = { error: { message: 'nope' }, count: null };
    expect(await pruneStandingRuns(30)).toBe(0);
  });
});
