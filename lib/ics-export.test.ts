import { describe, it, expect } from 'vitest';
import { buildSeriesIcs, escapeIcsText, foldIcsLine, ICS_RECENT_PAST_MS } from './ics-export';
import { DAY_MS } from './rounds';
import { Session, Weekend } from './types';

const NOW = new Date('2026-07-03T12:00:00Z');

function session(over: Partial<Session> & { title: string; start: Date }): Session {
  return {
    uid: `src-${over.title}`,
    seriesSlug: 'f1',
    end: new Date(over.start.getTime() + 60 * 60 * 1000),
    ...over,
  };
}

function weekend(round: number, sessions: Session[], over: Partial<Weekend> = {}): Weekend {
  return {
    key: sessions[0].start.toISOString().slice(0, 10),
    dateRangeLabel: '',
    sessions,
    isPast: false,
    round,
    ...over,
  };
}

function build(weekends: Weekend[], now = NOW): string {
  return buildSeriesIcs({ slug: 'f1', name: 'Formula 1', weekends, now });
}

const british = () =>
  weekend(
    12,
    [
      session({ title: 'F1: Practice 1', start: new Date('2026-07-10T11:30:00Z'), location: 'Silverstone Circuit, Silverstone' }),
      session({ title: 'F1: Qualifying', start: new Date('2026-07-11T14:00:00Z'), location: 'Silverstone Circuit, Silverstone' }),
      session({ title: 'F1: Race', start: new Date('2026-07-12T14:00:00Z'), location: 'Silverstone Circuit, Silverstone' }),
    ],
    { roundName: 'British Grand Prix' },
  );

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon, comma, and newlines per RFC 5545', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
  });
});

describe('foldIcsLine', () => {
  it('leaves short lines untouched', () => {
    expect(foldIcsLine('SUMMARY:Race')).toBe('SUMMARY:Race');
  });

  it('folds long lines at 75 octets with a space continuation', () => {
    const folded = foldIcsLine(`SUMMARY:${'x'.repeat(200)}`);
    const physical = folded.split('\r\n');
    expect(physical.length).toBeGreaterThan(1);
    for (const line of physical) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    for (const cont of physical.slice(1)) {
      expect(cont.startsWith(' ')).toBe(true);
    }
    // Unfolding (strip CRLF+space) restores the logical line.
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'x'.repeat(200)}`);
  });

  it('never splits a multi-byte character across a fold', () => {
    const folded = foldIcsLine(`SUMMARY:${'🏎'.repeat(40)}`);
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'🏎'.repeat(40)}`);
    for (const line of folded.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});

describe('buildSeriesIcs', () => {
  it('emits a well-formed VCALENDAR with CRLF endings and Paddock PRODID', () => {
    const ics = build([british()]);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('PRODID:-//Paddock Tracker//Paddock//EN');
    expect(ics).toContain('VERSION:2.0');
    // No bare LF anywhere — every \n is preceded by \r.
    expect(/[^\r]\n/.test(ics)).toBe(false);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(3);
  });

  it('renders UTC DTSTART/DTEND and escaped SUMMARY/LOCATION', () => {
    const ics = build([
      weekend(3, [
        session({
          title: 'F1: Sprint, Race; part\\one',
          start: new Date('2026-08-01T15:30:00Z'),
          location: 'Circuit A, Town; Region',
        }),
      ]),
    ]);
    expect(ics).toContain('DTSTART:20260801T153000Z');
    expect(ics).toContain('DTEND:20260801T163000Z');
    expect(ics).toContain('SUMMARY:F1: Sprint\\, Race\\; part\\\\one');
    expect(ics).toContain('LOCATION:Circuit A\\, Town\\; Region');
  });

  it('builds stable UIDs of the form <slug>-<round>-<sessionKey>@paddock-tracker.com', () => {
    const ics = build([british()]);
    expect(ics).toContain('UID:f1-12-practice-1@paddock-tracker.com');
    expect(ics).toContain('UID:f1-12-qualifying@paddock-tracker.com');
    expect(ics).toContain('UID:f1-12-race@paddock-tracker.com');
  });

  it('UIDs are identical across regenerations at different times', () => {
    const uidsAt = (now: Date) =>
      build([british()], now)
        .split('\r\n')
        .filter(l => l.startsWith('UID:'));
    expect(uidsAt(new Date('2026-07-03T12:00:00Z'))).toEqual(
      uidsAt(new Date('2026-07-05T09:00:00Z')),
    );
  });

  it('disambiguates duplicate session keys within a weekend deterministically', () => {
    const ics = build([
      weekend(5, [
        session({ title: 'F1: Race', start: new Date('2026-08-08T13:00:00Z') }),
        session({ title: 'F1: Race', start: new Date('2026-08-09T13:00:00Z') }),
      ]),
    ]);
    expect(ics).toContain('UID:f1-5-race@paddock-tracker.com');
    expect(ics).toContain('UID:f1-5-race-2@paddock-tracker.com');
  });

  it('keys round-0 weekends (tests) by weekend date so they cannot collide', () => {
    const ics = build([
      weekend(0, [session({ title: 'F1: Test Day 1', start: new Date('2026-07-20T09:00:00Z') })]),
    ]);
    expect(ics).toContain('UID:f1-r0-2026-07-20-test-day-1@paddock-tracker.com');
    // Non-championship weekends have no round page → no URL/DESCRIPTION.
    expect(ics).not.toContain('URL:');
    expect(ics).not.toContain('DESCRIPTION:');
  });

  it('includes future + recent-past sessions and drops older ones', () => {
    const justInside = new Date(NOW.getTime() - ICS_RECENT_PAST_MS + DAY_MS);
    const wayPast = new Date(NOW.getTime() - ICS_RECENT_PAST_MS - DAY_MS);
    const future = new Date(NOW.getTime() + 10 * DAY_MS);
    const ics = build([
      weekend(1, [session({ title: 'F1: Old Race', start: wayPast })]),
      weekend(2, [session({ title: 'F1: Recent Race', start: justInside })]),
      weekend(3, [session({ title: 'F1: Next Race', start: future })]),
    ]);
    expect(ics).not.toContain('Old Race');
    expect(ics).toContain('SUMMARY:F1: Recent Race');
    expect(ics).toContain('SUMMARY:F1: Next Race');
  });

  it('UID dedupe counters stay stable when the window drops earlier duplicates', () => {
    // Two same-key sessions; the first has aged out. The survivor must keep
    // its -2 suffix (counters run over ALL sessions, not just emitted ones).
    const ics = build([
      weekend(4, [
        session({ title: 'F1: Race', start: new Date(NOW.getTime() - ICS_RECENT_PAST_MS - DAY_MS) }),
        session({ title: 'F1: Race', start: new Date(NOW.getTime() + DAY_MS) }),
      ]),
    ]);
    expect(ics).not.toContain('UID:f1-4-race@paddock-tracker.com');
    expect(ics).toContain('UID:f1-4-race-2@paddock-tracker.com');
  });

  it('renders date-only sessions as all-day events (no invented clock time)', () => {
    const start = new Date('2026-09-05T00:00:00Z');
    const ics = build([
      weekend(7, [
        session({ title: 'WRC: Rally Day', start, end: start, dateOnly: true }),
      ]),
    ]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260905');
    expect(ics).toContain('DTEND;VALUE=DATE:20260906');
    expect(ics).not.toContain('DTSTART:2026');
  });

  it('links championship rounds to their weekend page', () => {
    const ics = build([british()]).replace(/\r\n /g, '');
    expect(ics).toContain('URL:https://paddock-tracker.com/series/f1/weekend/12');
    expect(ics).toContain('https://paddock-tracker.com/series/f1/weekend/12');
    expect(ics).toContain('British Grand Prix');
  });

  it('every physical line respects the 75-octet cap', () => {
    const ics = build([
      weekend(9, [
        session({
          title: `F1: ${'Very Long Grand Prix Name '.repeat(6)}Race`,
          start: new Date('2026-10-01T12:00:00Z'),
          location: `${'A long venue name, '.repeat(8)}Somewhere`,
        }),
      ]),
    ]);
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});
