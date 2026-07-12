import { describe, it, expect } from 'vitest';
import { groupByWeekend, groupByDay } from './group';
import { Session, SeriesRoundsFile } from './types';

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

describe('assignRoundsToWeekends (via groupByWeekend + rounds.json)', () => {
  const now = new Date('2026-07-01T00:00:00Z');

  it('splits a 4-day-merged doubleheader into one weekend per round (FE-style)', () => {
    // Two races within the 4-day window → grouped into ONE cluster, then split
    // back apart by rounds.json so both rounds get a reachable weekend page.
    const rounds: SeriesRoundsFile = {
      season: 2026,
      rounds: [
        { round: 8, name: 'Race 8', startDate: '2026-07-11', endDate: '2026-07-11' },
        { round: 9, name: 'Race 9', startDate: '2026-07-12', endDate: '2026-07-12' },
      ],
    };
    const sessions = [
      s('2026-07-10T09:00:00Z', 'Shared practice'),
      s('2026-07-11T14:00:00Z', 'Race 1'),
      s('2026-07-12T14:00:00Z', 'Race 2'),
    ];
    const out = groupByWeekend(sessions, now, rounds);
    expect(out).toHaveLength(2);
    expect(out.map(w => w.round)).toEqual([8, 9]); // both rounds distinct + reachable
    expect(new Set(out.map(w => w.round)).size).toBe(out.length); // no duplicate round numbers
    expect(out[0].sessions).toHaveLength(2); // shared practice attaches to the nearest round (8)
    expect(out[1].sessions).toHaveLength(1);
  });

  it('leaves a session no curated round covers at round 0 (not URL-addressable)', () => {
    // A pre-season test must not shadow real round 1 (the MotoGP Sepang-test regression).
    const rounds: SeriesRoundsFile = {
      season: 2026,
      rounds: [{ round: 1, name: 'Round 1', startDate: '2026-03-06', endDate: '2026-03-08' }],
    };
    const sessions = [s('2026-02-01T09:00:00Z', 'Pre-season test')];
    const out = groupByWeekend(sessions, new Date('2026-01-15T00:00:00Z'), rounds);
    expect(out[0].round).toBe(0);
  });

  it('falls back to index numbering when no rounds.json is supplied', () => {
    const sessions = [
      s('2026-05-24T14:00:00Z', 'R1 race'),
      s('2026-06-14T14:00:00Z', 'R2 race'),
    ];
    const out = groupByWeekend(sessions, new Date('2026-05-13T00:00:00Z'));
    expect(out.map(w => w.round)).toEqual([1, 2]);
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
