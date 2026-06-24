import { describe, it, expect } from 'vitest';
import type { Session } from './types';
import {
  buildMonthMatrix,
  weekDays,
  startOfWeek,
  localDayKey,
  bucketByDay,
  addMonths,
  dayKeyOf,
  utcDayKeyOf,
  classifySession,
} from './calendar-grid';

function session(partial: Partial<Session> & { start: Date }): Session {
  return {
    uid: 'u',
    seriesSlug: 'f1',
    title: 'Race',
    end: new Date(partial.start.getTime() + 3600_000),
    ...partial,
  };
}

describe('calendar-grid', () => {
  it('builds a 42-cell month matrix that starts on a Monday', () => {
    const cells = buildMonthMatrix(new Date(2026, 5, 1), new Date(2026, 5, 23)); // June 2026
    expect(cells).toHaveLength(42);
    expect(cells[0].date.getDay()).toBe(1); // Monday
  });

  it('flags the in-month days (June 2026 has 30) and today', () => {
    const cells = buildMonthMatrix(new Date(2026, 5, 1), new Date(2026, 5, 23));
    expect(cells.filter(c => c.inMonth)).toHaveLength(30);
    const today = cells.find(c => c.isToday);
    expect(today?.date.getDate()).toBe(23);
  });

  it('startOfWeek snaps to the Monday of the week', () => {
    // 2026-06-23 is a Tuesday → Monday is the 22nd.
    expect(startOfWeek(new Date(2026, 5, 23)).getDate()).toBe(22);
    expect(weekDays(new Date(2026, 5, 23), new Date(2026, 5, 23))).toHaveLength(7);
  });

  it('addMonths anchors to the 1st of the target month', () => {
    const next = addMonths(new Date(2026, 5, 23), 1); // → July 2026
    expect(next.getMonth()).toBe(6);
    expect(next.getDate()).toBe(1);
  });

  it('buckets date-only sessions by their UTC wall date (never a local shift)', () => {
    const s = session({ start: new Date(Date.UTC(2026, 5, 5)), dateOnly: true });
    expect(localDayKey(s)).toBe('2026-06-05');
    expect(localDayKey(s)).toBe(utcDayKeyOf(s.start));
  });

  it('buckets timed sessions by their device-local day', () => {
    const s = session({ start: new Date(2026, 5, 5, 14, 30) });
    expect(localDayKey(s)).toBe('2026-06-05');
    expect(localDayKey(s)).toBe(dayKeyOf(s.start));
  });

  it('groups multiple sessions on the same day together', () => {
    const a = { session: session({ start: new Date(2026, 5, 5, 9, 0) }), color: '#fff', seriesSlug: 'f1' };
    const b = { session: session({ start: new Date(2026, 5, 5, 15, 0) }), color: '#fff', seriesSlug: 'f1' };
    const c = { session: session({ start: new Date(2026, 5, 6, 9, 0) }), color: '#fff', seriesSlug: 'f1' };
    const m = bucketByDay([a, b, c]);
    expect(m.get('2026-06-05')).toHaveLength(2);
    expect(m.get('2026-06-06')).toHaveLength(1);
  });
});

describe('classifySession', () => {
  it('classifies the main session types', () => {
    expect(classifySession('Practice 1')).toBe('practice');
    expect(classifySession('FP2')).toBe('practice');
    expect(classifySession('Qualifying')).toBe('qualifying');
    expect(classifySession('Hyperpole')).toBe('qualifying');
    expect(classifySession('Race')).toBe('race');
    expect(classifySession('Grand Prix')).toBe('race');
  });

  it('reads "Sprint Qualifying" as qualifying but "Sprint" as race', () => {
    expect(classifySession('Sprint Qualifying')).toBe('qualifying');
    expect(classifySession('Sprint')).toBe('race');
    expect(classifySession('Sprint Race')).toBe('race');
  });

  it('falls back to other for unrecognised titles', () => {
    expect(classifySession('Driver Parade')).toBe('other');
  });
});
