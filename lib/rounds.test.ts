import { describe, it, expect } from 'vitest';
import { assignRoundsToWeekends } from './rounds';
import { Session, SeriesRoundsFile, Weekend } from './types';

function s(start: string): Session {
  return {
    uid: start,
    seriesSlug: 'f1',
    title: 'Race',
    start: new Date(start),
    end: new Date(new Date(start).getTime() + 60 * 60 * 1000),
  };
}

function w(start: string): Weekend {
  const session = s(start);
  return {
    key: start.slice(0, 10),
    dateRangeLabel: '',
    sessions: [session],
    isPast: false,
    round: 0,
  };
}

const F1_2026: SeriesRoundsFile = {
  season: 2026,
  rounds: [
    { round: 1, startDate: '2026-03-06', endDate: '2026-03-08', name: 'Australia' },
    { round: 3, startDate: '2026-03-27', endDate: '2026-03-29', name: 'Japan' },
    { round: 5, startDate: '2026-05-22', endDate: '2026-05-24', name: 'Canada' },
    { round: 6, startDate: '2026-06-05', endDate: '2026-06-07', name: 'Monaco' },
  ],
};

describe('assignRoundsToWeekends', () => {
  it('assigns canonical round numbers from rounds.json by date overlap', () => {
    const weekends = [w('2026-03-27T11:00:00Z'), w('2026-05-22T11:00:00Z'), w('2026-06-05T11:00:00Z')];
    const out = assignRoundsToWeekends(weekends, F1_2026);
    expect(out[0].round).toBe(3);
    expect(out[0].roundName).toBe('Japan');
    expect(out[1].round).toBe(5);
    expect(out[1].roundName).toBe('Canada');
    expect(out[2].round).toBe(6);
  });

  it('falls back to index+1 when no rounds.json supplied', () => {
    const weekends = [w('2026-05-22T11:00:00Z'), w('2026-06-05T11:00:00Z')];
    const out = assignRoundsToWeekends(weekends, undefined);
    expect(out[0].round).toBe(1);
    expect(out[1].round).toBe(2);
  });

  it('keeps uncovered weekends OUT of the curated number space (round 0)', () => {
    const weekends = [w('2026-04-10T11:00:00Z'), w('2026-05-22T11:00:00Z')];
    const out = assignRoundsToWeekends(weekends, F1_2026);
    // April 10 has no rounds.json entry (cancelled Bahrain / a test). The old
    // index+1 fallback gave it round 1, colliding with Australia's curated
    // round 1 and shadowing the real round at /weekend/1 (audit 1b-1 — MotoGP
    // pre-season tests served as rounds 1-3 in production).
    expect(out[0].round).toBe(0);
    expect(out[1].round).toBe(5);
  });

  it('splits a merged doubleheader weekend into one weekend per covering round', () => {
    // FE Jeddah 2026 shape: R4 Thu-Fri, R5 Sat — one day apart, so the 4-day
    // grouping merges all sessions into a single weekend (audit 1b-2: six FE
    // rounds incl. the finale 404'd).
    const FE_DOUBLE: SeriesRoundsFile = {
      season: 2026,
      rounds: [
        { round: 4, startDate: '2026-02-12', endDate: '2026-02-13', name: 'Jeddah E-Prix – Race 1' },
        { round: 5, startDate: '2026-02-14', endDate: '2026-02-14', name: 'Jeddah E-Prix – Race 2' },
      ],
    };
    const merged: Weekend = {
      key: '2026-02-12',
      dateRangeLabel: '',
      sessions: [
        s('2026-02-12T14:00:00Z'), // FP (R4 range)
        s('2026-02-13T16:00:00Z'), // Race 1 (R4 range)
        s('2026-02-14T16:00:00Z'), // Race 2 (R5 range)
      ],
      isPast: false,
      round: 0,
    };
    const out = assignRoundsToWeekends([merged], FE_DOUBLE, new Date('2026-06-01T00:00:00Z'));
    expect(out).toHaveLength(2);
    expect(out[0].round).toBe(4);
    expect(out[0].sessions).toHaveLength(2);
    expect(out[0].roundName).toBe('Jeddah E-Prix – Race 1');
    expect(out[1].round).toBe(5);
    expect(out[1].sessions).toHaveLength(1);
    expect(out[1].key).toBe('2026-02-14');
    // Both halves are in the past relative to the supplied now.
    expect(out[0].isPast).toBe(true);
    expect(out[1].isPast).toBe(true);
  });

  it('attaches shared support days outside every range to the nearest round', () => {
    const FE_DOUBLE: SeriesRoundsFile = {
      season: 2026,
      rounds: [
        { round: 7, startDate: '2026-05-01', endDate: '2026-05-02', name: 'Berlin – Race 1' },
        { round: 8, startDate: '2026-05-03', endDate: '2026-05-03', name: 'Berlin – Race 2' },
      ],
    };
    const merged: Weekend = {
      key: '2026-04-30',
      dateRangeLabel: '',
      sessions: [
        s('2026-04-30T10:00:00Z'), // shakedown before R7's range → nearest = R7
        s('2026-05-02T15:00:00Z'),
        s('2026-05-03T15:00:00Z'),
      ],
      isPast: false,
      round: 0,
    };
    const out = assignRoundsToWeekends([merged], FE_DOUBLE, new Date('2026-06-01T00:00:00Z'));
    expect(out).toHaveLength(2);
    expect(out[0].sessions.map(x => x.uid)).toEqual([
      '2026-04-30T10:00:00Z',
      '2026-05-02T15:00:00Z',
    ]);
    expect(out[1].sessions.map(x => x.uid)).toEqual(['2026-05-03T15:00:00Z']);
  });
});
