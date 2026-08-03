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
  groupIntoEvents,
  sessionTimeLabel,
  seriesCode,
  tzLabel,
  SESSION_KINDS,
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

function entry(
  start: Date,
  seriesSlug = 'f1',
  seriesName = 'Formula 1',
  title = 'Race',
): { session: Session; color: string; seriesSlug: string; seriesName: string } {
  return {
    session: session({ start, seriesSlug, title, uid: `${seriesSlug}-${title}-${start.getTime()}` }),
    color: '#e10600',
    seriesSlug,
    seriesName,
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

  it('exposes other as a real, selectable filter kind', () => {
    expect(SESSION_KINDS).toEqual(['practice', 'qualifying', 'race', 'other']);
  });
});

describe('groupIntoEvents', () => {
  it('collapses a day of sessions into one block per series', () => {
    const day = [
      entry(new Date(2026, 7, 22, 13, 0), 'f1', 'Formula 1', 'Sprint'),
      entry(new Date(2026, 7, 22, 17, 0), 'f1', 'Formula 1', 'Qualifying'),
      entry(new Date(2026, 7, 22, 23, 45), 'imsa', 'IMSA', 'Qualifying'),
    ];
    const events = groupIntoEvents(day, () => 15);
    expect(events).toHaveLength(2);
    expect(events[0].seriesSlug).toBe('f1');
    expect(events[0].entries).toHaveLength(2);
    expect(events[1].seriesSlug).toBe('imsa');
  });

  it('keeps a doubleheader as two blocks — the round is part of the key', () => {
    const day = [
      entry(new Date(2026, 7, 15, 12, 30), 'formula-e', 'Formula E', 'FP2 (London R16)'),
      entry(new Date(2026, 7, 16, 12, 30), 'formula-e', 'Formula E', 'FP3 (London R17)'),
    ];
    const rounds = new Map([['FP2 (London R16)', 16], ['FP3 (London R17)', 17]]);
    const events = groupIntoEvents(day, e => rounds.get(e.session.title));
    expect(events).toHaveLength(2);
    expect(events.map(e => e.round)).toEqual([16, 17]);
  });

  it('preserves the incoming order of first appearance', () => {
    const day = [
      entry(new Date(2026, 7, 22, 2, 0), 'nascar-cup', 'NASCAR Cup', 'Cook Out 400'),
      entry(new Date(2026, 7, 22, 13, 0), 'f1', 'Formula 1', 'Sprint'),
    ];
    expect(groupIntoEvents(day, () => undefined).map(e => e.seriesSlug)).toEqual(['nascar-cup', 'f1']);
  });
});

describe('seriesCode', () => {
  it('abbreviates every curated series to something a 38px cell can hold', () => {
    const slugs = [
      'adac-ravenol-24h', 'dtm', 'f1', 'f2', 'f3', 'formula-e', 'gt-world', 'imsa',
      'indycar', 'motogp', 'nascar-cup', 'nls', 'wec', 'wrc', 'wsbk',
    ];
    for (const slug of slugs) {
      const code = seriesCode(slug);
      expect(code).toMatch(/^[A-Z0-9]{2,6}$/);
    }
    expect(seriesCode('gt-world')).toBe('GTWC');
    expect(seriesCode('nascar-cup')).toBe('NASCAR');
    expect(seriesCode('formula-e')).toBe('FE');
  });

  it('gives every series a DISTINCT code — a legend that collides is useless', () => {
    const slugs = [
      'adac-ravenol-24h', 'dtm', 'f1', 'f2', 'f3', 'formula-e', 'gt-world', 'imsa',
      'indycar', 'motogp', 'nascar-cup', 'nls', 'wec', 'wrc', 'wsbk',
    ];
    expect(new Set(slugs.map(seriesCode)).size).toBe(slugs.length);
  });

  it('derives a fallback for a series scaffolded later', () => {
    expect(seriesCode('super-formula')).toBe('SUPERF');
  });
});

describe('time-mode helpers', () => {
  it('renders TBC for a date-only session in either mode', () => {
    const s = session({ start: new Date(Date.UTC(2026, 7, 26)), dateOnly: true });
    expect(sessionTimeLabel(s, false)).toBe('TBC');
    expect(sessionTimeLabel(s, true)).toBe('TBC');
  });

  it('renders a timed session as 24h wall time, and in UTC when pinned', () => {
    const s = session({ start: new Date(Date.UTC(2026, 7, 23, 14, 5)) });
    expect(sessionTimeLabel(s, true)).toBe('14:05');
    expect(sessionTimeLabel(s, false)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('buckets a timed session by its UTC date when UTC is pinned', () => {
    // 23:30 UTC — in any zone east of Greenwich this is the NEXT local day, so
    // the two modes must disagree on the cell, which is the whole point.
    const s = session({ start: new Date(Date.UTC(2026, 7, 23, 23, 30)) });
    expect(localDayKey(s, true)).toBe('2026-08-23');
    expect(localDayKey(s, false)).toBe(dayKeyOf(s.start));
  });

  it('reports UTC when pinned and GMT before the clock syncs', () => {
    const now = new Date(Date.UTC(2026, 7, 3, 12, 0));
    expect(tzLabel(now, true, true)).toBe('UTC');
    expect(tzLabel(now, false, false)).toBe('GMT');
    expect(tzLabel(now, true, false)).not.toBe('');
  });
});
