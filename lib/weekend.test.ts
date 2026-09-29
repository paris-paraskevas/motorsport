import { describe, expect, it } from 'vitest';
import { nextSessionAcross } from './weekend';
import type { Series, Session } from './types';

// P2.8, the Countdown: the next session of one series or the nearest across several, from the same grouping the weekend
// pages use. The rule is Home's (lib/home-model.ts nextTimed): the first weekend not past with a session still to end, then
// its timed session under way or next to start; a series whose grouping throws contributes nothing.

const AT = new Date('2026-09-27T12:00:00Z');
const at = (iso: string) => new Date(iso);

function series(slug: string, name: string, sessions: Partial<Session>[], rounds?: { round: number; name: string; venue?: string; startDate: string; endDate: string }[]): Series {
  return {
    meta: { slug, name, color: '#123456', season: 2026 },
    sessions: sessions.map((s, i) => ({ uid: `${slug}-${i}`, seriesSlug: slug, title: s.title ?? 'Race', start: s.start!, end: s.end!, location: s.location, dateOnly: s.dateOnly })),
    rounds: rounds ? { season: 2026, rounds } : undefined,
  } as unknown as Series;
}

const f1 = series('f1', 'Formula 1', [
  { title: 'F1 - Practice 1', start: at('2026-09-25T11:30:00Z'), end: at('2026-09-25T12:30:00Z'), location: 'Baku City Circuit' },
  { title: 'F1 - Qualifying', start: at('2026-09-26T14:00:00Z'), end: at('2026-09-26T15:00:00Z'), location: 'Baku City Circuit' },
  { title: 'F1 - Race', start: at('2026-09-27T11:00:00Z'), end: at('2026-09-27T13:00:00Z'), location: 'Baku City Circuit' },
]);
const motogp = series('motogp', 'MotoGP', [
  { title: 'MotoGP: Sprint', start: at('2026-09-26T13:00:00Z'), end: at('2026-09-26T13:45:00Z'), location: 'Motegi' },
  { title: 'MotoGP: Race', start: at('2026-09-27T14:00:00Z'), end: at('2026-09-27T15:00:00Z'), location: 'Motegi' },
]);
const wrc = series('wrc', 'WRC', [
  { title: 'Rally Chile', start: at('2026-10-01T00:00:00Z'), end: at('2026-10-04T00:00:00Z'), location: 'Concepción', dateOnly: true },
]);
const wec = series('wec', 'FIA WEC', [
  { title: 'WEC - Race', start: at('2026-09-13T11:00:00Z'), end: at('2026-09-13T17:00:00Z'), location: 'Fuji Speedway' },
]);

describe('nextSessionAcross', () => {
  it('picks the session under way before the one to come, and keeps it until its end', () => {
    const next = nextSessionAcross([motogp, f1], AT);
    expect(next?.series).toEqual({ slug: 'f1', name: 'Formula 1', color: '#123456' });
    expect(next?.weekend).toMatchObject({ round: 1, title: 'Baku City Circuit', href: '/series/f1/weekend/1', location: 'Baku City Circuit' });
    expect(next?.session).toMatchObject({ title: 'F1 - Race', slug: 'race', start: at('2026-09-27T11:00:00Z'), end: at('2026-09-27T13:00:00Z') });
    // After the race ends, MotoGP's race is the nearest.
    const later = nextSessionAcross([motogp, f1], at('2026-09-27T13:00:01Z'));
    expect(later?.series.slug).toBe('motogp');
    expect(later?.session?.title).toBe('MotoGP: Race');
  });

  it('reads one series alone, and a date-only weekend as the weekend without a session', () => {
    expect(nextSessionAcross([motogp], AT)?.session?.title).toBe('MotoGP: Race');
    const rally = nextSessionAcross([wrc], AT);
    expect(rally?.weekend.title).toBe('Concepción');
    expect(rally?.session).toBeNull();
  });

  it('carries the curated round venue for the circuit lookup', () => {
    // The round's dates cover the session (lib/rounds.ts rangeCovers), so the weekend carries the round's number, name and venue.
    const bahrain = series('f1', 'Formula 1', [{ title: 'F1 - Race', start: at('2026-10-04T07:00:00Z'), end: at('2026-10-04T09:00:00Z'), location: '' }], [{ round: 16, name: 'Bahrain Grand Prix', venue: 'Sepang International Circuit', startDate: '2026-10-02', endDate: '2026-10-04' }]);
    const next = nextSessionAcross([bahrain], AT);
    expect(next?.weekend).toMatchObject({ round: 16, title: 'Bahrain Grand Prix', venue: 'Sepang International Circuit', href: '/series/f1/weekend/16' });
    expect(nextSessionAcross([f1], AT)?.weekend.venue).toBeUndefined();
  });

  it('is null when nothing is to come, and a series whose season is over or whose grouping throws contributes nothing', () => {
    expect(nextSessionAcross([wec], AT)).toBeNull();
    expect(nextSessionAcross([], AT)).toBeNull();
    const broken = { ...f1, sessions: null } as unknown as Series;
    expect(nextSessionAcross([broken, motogp], AT)?.series.slug).toBe('motogp');
  });
});
