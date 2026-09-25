import { describe, expect, it, vi } from 'vitest';
import { SESSION_KINDS, matchOpenF1Session, planBackfill, runBackfill, summarise, type BackfillDeps } from './backfill-session-results.mjs';

// P2.25: the backfill of the season's already-finished practice and qualifying
// sessions into the session_result rows. The plan is counted before anything is
// written: a session already captured is skipped, a race is not this source's,
// a session still inside OpenF1's thirty-minute lockout waits for the next run.
// The write walks the plan through the cron's capture path with the fetchers
// and the writer handed in, so it runs here without a network or a database;
// the dry run never reaches it (main returns before runBackfill without --write).

const now = new Date('2026-09-25T14:00:00Z');
const at = (iso: string) => new Date(iso);
const sessions = [
  { round: 14, slug: 'practice-1', start: at('2026-09-04T10:30:00Z'), end: at('2026-09-04T11:30:00Z') },
  { round: 14, slug: 'qualifying', start: at('2026-09-05T14:00:00Z'), end: at('2026-09-05T15:00:00Z') },
  { round: 14, slug: 'race', start: at('2026-09-06T13:00:00Z'), end: at('2026-09-06T15:00:00Z') },
  { round: 15, slug: 'practice-3', start: at('2026-09-25T13:00:00Z'), end: at('2026-09-25T13:45:00Z') },
  { round: 15, slug: 'qualifying', start: at('2026-09-25T16:00:00Z'), end: at('2026-09-25T17:00:00Z') },
];
const of1 = (session_key: number, session_name: string, date_start: string) => ({ session_key, session_name, session_type: session_name, date_start, date_end: date_start, location: 'Monza', circuit_short_name: 'Monza', meeting_key: 14, year: 2026 });
const entries = [
  { position: 1, driverName: 'Oscar Piastri', driverCode: 'PIA', carNumber: '81', team: 'McLaren', time: '1:19.123', compound: 'Soft' },
  { position: 2, driverName: 'Lando Norris', driverCode: 'NOR', carNumber: '4', team: 'McLaren', time: '1:19.223', gap: '+0.100' },
];
const resolved = { isQualifying: false, isRace: false, entries };
const nameless = { isQualifying: false, isRace: false, entries: entries.map(e => ({ ...e, driverName: `#${e.carNumber}` })) };

describe('planBackfill', () => {
  it('keeps the practice and qualifying kinds that ended over thirty minutes ago and are not yet captured', () => {
    expect(SESSION_KINDS).toEqual(['practice-1', 'practice-2', 'practice-3', 'qualifying', 'sprint-qualifying']);
    const plan = planBackfill(sessions, now, new Set(['session-result:f1:2026:14:qualifying']));
    expect(plan.planned.map(s => `${s.round}/${s.slug}`)).toEqual(['14/practice-1']);
    expect(plan.skipped.map(s => `${s.round}/${s.slug}`)).toEqual(['14/qualifying']);
    // The race is not this source's; round 15's practice ended fifteen minutes ago (the lockout) and its qualifying is ahead.
    expect(plan.notYet.map(s => `${s.round}/${s.slug}`)).toEqual(['15/practice-3']);
    expect(plan.eligible).toHaveLength(3);
  });

  it('plans nothing on an empty season and counts every outcome', () => {
    expect(planBackfill([], now, new Set())).toEqual({ eligible: [], planned: [], skipped: [], notYet: [] });
    expect(summarise([{ ok: true, rows: 20 }, { ok: true, rows: 19 }, { ok: false, rows: 0, note: 'no-classification' }])).toEqual({ written: 2, rows: 39, failed: 1 });
  });
});

describe('matchOpenF1Session', () => {
  it('matches by the slugified name first, then by the nearest start within three hours, else nothing', () => {
    const candidates = [of1(1, 'Practice 1', '2026-09-04T10:30:00Z'), of1(2, 'Qualifying', '2026-09-05T14:00:00Z')];
    expect(matchOpenF1Session(candidates, 'qualifying', at('2026-09-05T09:00:00Z'))?.session_key).toBe(2);
    expect(matchOpenF1Session(candidates, 'practice-2', at('2026-09-04T11:00:00Z'))?.session_key).toBe(1);
    expect(matchOpenF1Session(candidates, 'practice-2', at('2026-09-04T18:00:00Z'))).toBeNull();
    expect(matchOpenF1Session([], 'qualifying', now)).toBeNull();
  });
});

describe('runBackfill', () => {
  const deps = (over: Partial<BackfillDeps> = {}): BackfillDeps & { lines: string[] } => {
    const lines: string[] = [];
    return {
      fetchWeekendSessions: vi.fn(async () => [of1(1, 'Practice 1', '2026-09-04T10:30:00Z'), of1(2, 'Qualifying', '2026-09-05T14:00:00Z')]),
      fetchClassification: vi.fn(async () => resolved),
      resolved: c => c !== null && c.entries.some(e => !/^#\d+$/.test(e.driverName)),
      write: vi.fn(async () => ({ ok: true, rows: 2, note: 'ok' })),
      log: line => lines.push(line),
      lines,
      ...over,
    };
  };

  it('fetches the weekend’s sessions once per round, matches each planned session, and writes one run per session under the guard', async () => {
    const d = deps();
    const plan = planBackfill(sessions, now, new Set());
    const outcomes = await runBackfill(plan, sessions, 2026, d);
    expect(d.fetchWeekendSessions).toHaveBeenCalledTimes(1);
    expect(d.fetchWeekendSessions).toHaveBeenCalledWith(at('2026-09-04T10:30:00Z'), at('2026-09-06T15:00:00Z'));
    expect(d.fetchClassification).toHaveBeenCalledTimes(2);
    expect(d.write).toHaveBeenCalledTimes(2);
    expect(d.write).toHaveBeenNthCalledWith(1, { series: 'f1', season: 2026, round: 14, session: 'practice-1', entries, runner: 'backfill-session-results' });
    expect(d.write).toHaveBeenNthCalledWith(2, expect.objectContaining({ round: 14, session: 'qualifying' }));
    expect(outcomes).toEqual([{ ok: true, rows: 2, note: 'ok' }, { ok: true, rows: 2, note: 'ok' }]);
    expect(d.lines).toEqual(['  wrote  r14 practice-1: 2 rows', '  wrote  r14 qualifying: 2 rows']);
  });

  it('writes nothing for a session OpenF1 does not list, for an empty classification, or for a nameless one', async () => {
    const plan = { eligible: [], planned: [sessions[0], sessions[1]], skipped: [], notYet: [] };
    const none = deps({ fetchWeekendSessions: vi.fn(async () => []) });
    expect(await runBackfill(plan, sessions, 2026, none)).toEqual([{ ok: false, rows: 0, note: 'no-openf1-match' }, { ok: false, rows: 0, note: 'no-openf1-match' }]);
    expect(none.write).not.toHaveBeenCalled();
    const empty = deps({ fetchClassification: vi.fn(async () => null) });
    expect((await runBackfill(plan, sessions, 2026, empty)).map(o => o.note)).toEqual(['no-classification', 'no-classification']);
    expect(empty.write).not.toHaveBeenCalled();
    const bare = deps({ fetchClassification: vi.fn(async () => nameless) });
    expect((await runBackfill(plan, sessions, 2026, bare)).map(o => o.note)).toEqual(['no-driver-names', 'no-driver-names']);
    expect(bare.write).not.toHaveBeenCalled();
    // A failed write is reported as the writer's note and the walk goes on.
    const failing = deps({ write: vi.fn(async () => ({ ok: false, rows: 0, note: 'relation does not exist' })) });
    expect(await runBackfill(plan, sessions, 2026, failing)).toEqual([{ ok: false, rows: 0, note: 'relation does not exist' }, { ok: false, rows: 0, note: 'relation does not exist' }]);
    expect(failing.lines[0]).toBe('  failed r14 practice-1: relation does not exist');
  });
});
