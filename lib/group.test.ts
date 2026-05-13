import { describe, it, expect } from 'vitest';
import { groupByWeekend, groupByDay } from './group';
import { Session } from './types';

function s(start: string, title = 'Test'): Session {
  return {
    uid: start,
    seriesSlug: 'f1',
    title,
    start: new Date(start),
    end: new Date(new Date(start).getTime() + 60 * 60 * 1000),
  };
}

describe('groupByWeekend', () => {
  it('clusters sessions within 4 days into the same weekend', () => {
    const sessions = [
      s('2026-05-22T11:30:00Z', 'FP1'),
      s('2026-05-22T15:00:00Z', 'FP2'),
      s('2026-05-23T11:30:00Z', 'FP3'),
      s('2026-05-23T15:00:00Z', 'Quali'),
      s('2026-05-24T14:00:00Z', 'Race'),
    ];
    const out = groupByWeekend(sessions, new Date('2026-05-13T00:00:00Z'));
    expect(out).toHaveLength(1);
    expect(out[0].sessions).toHaveLength(5);
    expect(out[0].dateRangeLabel).toMatch(/22.*24.*May/);
    expect(out[0].isPast).toBe(false);
  });

  it('splits sessions more than 4 days apart into separate weekends', () => {
    const sessions = [
      s('2026-05-22T11:30:00Z', 'Monaco FP1'),
      s('2026-05-24T14:00:00Z', 'Monaco Race'),
      s('2026-06-12T11:30:00Z', 'Canada FP1'),
      s('2026-06-14T14:00:00Z', 'Canada Race'),
    ];
    const out = groupByWeekend(sessions, new Date('2026-05-13T00:00:00Z'));
    expect(out).toHaveLength(2);
    expect(out[0].sessions).toHaveLength(2);
    expect(out[1].sessions).toHaveLength(2);
  });

  it('marks weekends entirely in the past as isPast', () => {
    const sessions = [s('2026-05-01T14:00:00Z', 'Past Race')];
    const out = groupByWeekend(sessions, new Date('2026-05-13T00:00:00Z'));
    expect(out[0].isPast).toBe(true);
  });

  it('uses significance.weekend as the label when present', () => {
    const sessions = [
      { ...s('2026-05-24T14:00:00Z', 'Race'),
        significance: { tier: 'marquee' as const, note: 'Historic', weekend: 'Monaco GP' } },
    ];
    const out = groupByWeekend(sessions, new Date('2026-05-13T00:00:00Z'));
    expect(out[0].label).toBe('Monaco GP');
    expect(out[0].significance?.tier).toBe('marquee');
  });

  it('has undefined label when no significance.weekend is set', () => {
    const sessions = [s('2026-05-24T14:00:00Z', 'Race')];
    const out = groupByWeekend(sessions, new Date('2026-05-13T00:00:00Z'));
    expect(out[0].label).toBeUndefined();
  });
});

describe('groupByDay', () => {
  it('groups sessions by UTC calendar date', () => {
    const sessions = [
      s('2026-05-16T08:00:00Z'),
      s('2026-05-16T14:00:00Z'),
      s('2026-05-17T10:00:00Z'),
    ];
    const out = groupByDay(sessions);
    expect(out).toHaveLength(2);
    expect(out[0].sessions).toHaveLength(2);
    expect(out[1].sessions).toHaveLength(1);
  });

  it('returns date label like "Sat 16 May"', () => {
    const sessions = [s('2026-05-16T10:00:00Z')];
    const out = groupByDay(sessions);
    expect(out[0].label).toMatch(/Sat.*16.*May/);
  });
});
