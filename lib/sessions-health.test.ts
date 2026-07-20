import { describe, it, expect } from 'vitest';
import { gradeSeriesSchedule, summarizeSessions, type SessionHealthResult } from './sessions-health';
import type { Weekend } from './types';

// Minimal Weekend for grading — only round / sessions.length / isPast / name matter.
function wk(round: number, sessionCount: number, isPast = true, roundName?: string): Weekend {
  return {
    key: `r${round}`,
    dateRangeLabel: '',
    sessions: Array.from({ length: sessionCount }, () => ({}) as never),
    isPast,
    round,
    roundName,
  } as Weekend;
}

describe('gradeSeriesSchedule', () => {
  it('flags a round with far fewer sessions than the series norm (the GT World case)', () => {
    // Median 5; Misano/Spa show 1 → thin.
    const r = gradeSeriesSchedule('gt-world', 'GT World', [
      wk(1, 5), wk(2, 6), wk(3, 5), wk(4, 1, true, 'Spa'), wk(5, 1, true, 'Misano'),
    ]);
    expect(r.status).toBe('LOW');
    expect(r.median).toBe(5);
    expect(r.thin.map(t => t.round)).toEqual([4, 5]);
  });

  it('does NOT flag a series that legitimately runs one session per round (NASCAR)', () => {
    const r = gradeSeriesSchedule('nascar-cup', 'NASCAR', [wk(1, 1), wk(2, 1), wk(3, 1), wk(4, 1)]);
    expect(r.status).toBe('OK');
    expect(r.thin).toHaveLength(0);
  });

  it('ignores stray round < 1 weekends (unassigned sessions)', () => {
    const r = gradeSeriesSchedule('motogp', 'MotoGP', [
      wk(0, 1), wk(0, 1), wk(1, 8), wk(2, 8), wk(3, 8),
    ]);
    expect(r.status).toBe('OK');
    expect(r.completedRounds).toBe(3); // the three real rounds only
  });

  it('marks a 0-session completed round EMPTY regardless of median', () => {
    const r = gradeSeriesSchedule('x', 'X', [wk(1, 5), wk(2, 5), wk(3, 0, true, 'Broken')]);
    expect(r.status).toBe('EMPTY');
    expect(r.thin.find(t => t.round === 3)?.sessions).toBe(0);
  });

  it('is OK with no completed rounds yet (pre-season)', () => {
    const r = gradeSeriesSchedule('x', 'X', [wk(1, 5, false), wk(2, 6, false)]);
    expect(r.status).toBe('OK');
    expect(r.completedRounds).toBe(0);
  });
});

describe('summarizeSessions', () => {
  it('counts flagged (non-OK) series', () => {
    const results = [
      { status: 'OK', slug: 'a' },
      { status: 'LOW', slug: 'b' },
      { status: 'EMPTY', slug: 'c' },
    ] as SessionHealthResult[];
    const s = summarizeSessions(results);
    expect(s).toMatchObject({ total: 3, healthy: 1, flagged: 2, flaggedSlugs: ['b', 'c'] });
  });
});
