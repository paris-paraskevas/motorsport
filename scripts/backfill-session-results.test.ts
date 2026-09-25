import { describe, expect, it } from 'vitest';
import { SESSION_KINDS, planBackfill, summarise } from './backfill-session-results.mjs';

// P2.25: the backfill of the season's already-finished practice and qualifying
// sessions into the session_result rows. The plan is counted before anything is
// written: a session already captured is skipped, a race is not this source's,
// a session still inside OpenF1's thirty-minute lockout waits for the next run.

const now = new Date('2026-09-25T14:00:00Z');
const at = (iso: string) => new Date(iso);
const sessions = [
  { round: 14, slug: 'practice-1', start: at('2026-09-04T10:30:00Z'), end: at('2026-09-04T11:30:00Z') },
  { round: 14, slug: 'qualifying', start: at('2026-09-05T14:00:00Z'), end: at('2026-09-05T15:00:00Z') },
  { round: 14, slug: 'race', start: at('2026-09-06T13:00:00Z'), end: at('2026-09-06T15:00:00Z') },
  { round: 15, slug: 'practice-3', start: at('2026-09-25T13:00:00Z'), end: at('2026-09-25T13:45:00Z') },
  { round: 15, slug: 'qualifying', start: at('2026-09-25T16:00:00Z'), end: at('2026-09-25T17:00:00Z') },
];

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
