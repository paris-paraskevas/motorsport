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

  it('falls back to index+1 for weekends that no rounds.json entry covers', () => {
    const weekends = [w('2026-04-10T11:00:00Z'), w('2026-05-22T11:00:00Z')];
    const out = assignRoundsToWeekends(weekends, F1_2026);
    // April 10 is the cancelled Bahrain weekend — no rounds.json entry.
    expect(out[0].round).toBe(1);
    expect(out[1].round).toBe(5);
  });
});
