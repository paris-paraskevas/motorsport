import { describe, expect, it } from 'vitest';
import { nextSessionAcross, nextWeekend, sessionPageTitle, weekendPageTitle } from './weekend';
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

  it('P2.14: nextWeekend is the weekend nextSessionAcross names for one series, null when nothing is to come or the grouping throws', () => {
    const next = nextWeekend(f1, AT);
    expect(next?.round).toBe(nextSessionAcross([f1], AT)?.weekend.round);
    expect(next?.sessions.map(s => s.title)).toEqual(['F1 - Practice 1', 'F1 - Qualifying', 'F1 - Race']);
    expect(nextWeekend(wrc, AT)?.sessions[0].title).toBe('Rally Chile');
    expect(nextWeekend(wec, AT)).toBeNull();
    expect(nextWeekend({ ...f1, sessions: null } as unknown as Series, AT)).toBeNull();
  });
});

// X10 (the Seobility crawl of 1 October): the session and weekend page titles, fitted by width so the whole title with the
// layout's suffix stays under Seobility's 580 px (lib/site.ts); the round is named once, the series once, never a word twice;
// the feed's own series prefix on a label is stripped; nothing is cut mid-word (the eight Indianapolis 500 sessions used to
// share one title cut at 60 characters).
describe('X10: sessionPageTitle', () => {
  it('names the session, the round and the series when they fit; drops the series, then the round, before cutting', () => {
    expect(sessionPageTitle('Formula 1', 'Azerbaijan Grand Prix', 'Race', 15)).toBe('Race, Azerbaijan Grand Prix — Formula 1');
    expect(sessionPageTitle('GT World Challenge', 'Barcelona Sprint', 'Sprint Race', 9)).toBe('Sprint Race · GT World Challenge round 9');
    expect(sessionPageTitle('IndyCar', 'Sonsio Grand Prix at the Brickyard', 'Indianapolis 500 Practice 1', 6)).toBe('Indianapolis 500 Practice 1 · round 6');
    expect(sessionPageTitle('IndyCar', 'Sonsio Grand Prix at the Brickyard', 'Indianapolis 500 Practice 2', 6)).toBe('Indianapolis 500 Practice 2 · round 6');
    expect(sessionPageTitle('MotoGP', 'Japanese Grand Prix', 'FP1', 16)).toBe('FP1, Japanese Grand Prix — MotoGP');
    // The support series share Formula 1's round names: the feed's short code keeps the three pages' titles apart.
    expect(sessionPageTitle('Formula 1', 'Australian Grand Prix', 'Qualifying', 1, 'Melbourne', 'F1')).toBe('Qualifying, Australian Grand Prix — F1');
    expect(sessionPageTitle('Formula 2', 'Australian Grand Prix', 'Qualifying', 1, 'Melbourne', 'F2')).toBe('Qualifying, Australian Grand Prix — F2');
    expect(sessionPageTitle('Formula 3', 'Australian Grand Prix', 'Qualifying', 1, 'Melbourne', 'F3')).toBe('Qualifying, Australian Grand Prix — F3');
    expect(sessionPageTitle('Formula 2', 'Australian Grand Prix', 'Qualifying', 1)).toBe('Qualifying · Formula 2 round 1');
    expect(sessionPageTitle('NLS Nürburgring', 'NLS5 ADAC 24h Nürburgring Qualifiers', '24h Top Qualifying (NLS5 ADAC 24h Nürburgring Qualifiers)', 5, 'Nürburgring', 'NLS')).not.toContain('(');
  });

  it('uses the session name alone when it already carries the round, and strips the feed’s series prefix from a label', () => {
    expect(sessionPageTitle('FIA WEC', 'FIA WEC | 6 Hours of Fuji', '6 Hours of Fuji (Race)', 6)).toBe('Race, 6 Hours of Fuji — FIA WEC');
    expect(sessionPageTitle('NLS Nürburgring', '71st ADAC Westfalenfahrt', 'Free Training (NLS1 71st ADAC Westfalenfahrt)', 1, 'Nürburgring', 'NLS')).toBe('Free Training · NLS Nürburgring round 1');
    expect(sessionPageTitle('NLS Nürburgring', '71st ADAC Westfalenfahrt', 'Race 4h (NLS1 71st ADAC Westfalenfahrt)', 1, 'Nürburgring', 'NLS')).toBe('Race 4h · NLS Nürburgring round 1');
    expect(sessionPageTitle('WRC', 'WRC | Rally Italia Sardegna', 'Rally Italia Sardegna', 13)).toBe('Rally Italia Sardegna — WRC');
    expect(sessionPageTitle('NASCAR Cup', 'Bass Pro Shops Night Race (Bristol)', 'Bass Pro Shops Night Race', 29)).toBe('Bass Pro Shops Night Race (Bristol)');
    expect(sessionPageTitle('Formula 1', 'Round 7', 'Qualifying', 7)).toBe('Qualifying · Formula 1 round 7');
    expect(sessionPageTitle('FIA WEC', 'TotalEnergies 6 Hours of Spa-Francorchamps', 'Hypercar Qualifying', 2, 'Spa-Francorchamps')).toBe('Hypercar Qualifying · FIA WEC round 2');
    expect(sessionPageTitle('FIA WEC', 'TotalEnergies 6 Hours of Spa-Francorchamps', 'Hypercar Qualifying', 2, 'Spa-Francorchamps', 'WEC')).toBe('Hypercar Qualifying · FIA WEC round 2');
    expect(sessionPageTitle('Formula 1', 'Round 7', 'Qualifying', 7, 'Silverstone')).toBe('Qualifying, Silverstone — Formula 1');
  });
});

describe('X10: weekendPageTitle', () => {
  it('the round once, the series once, the prefix stripped, the round number as the fallback', () => {
    expect(weekendPageTitle('WRC', 'WRC | Rally Italia Sardegna', 13)).toBe('Rally Italia Sardegna — WRC round 13');
    expect(weekendPageTitle('Formula 1', 'Azerbaijan Grand Prix', 15)).toBe('Azerbaijan Grand Prix — Formula 1');
    expect(weekendPageTitle('GT World Challenge', 'CrowdStrike 24 Hours of Spa', 4)).toBe('CrowdStrike 24 Hours of Spa — round 4');
    expect(weekendPageTitle('FIA WEC', 'TotalEnergies 6 Hours of Spa-Francorchamps', 2)).toBe('FIA WEC round 2');
    expect(weekendPageTitle('FIA WEC', 'TotalEnergies 6 Hours of Spa-Francorchamps', 2, 'Spa-Francorchamps')).toBe('Spa-Francorchamps — FIA WEC round 2');
    expect(weekendPageTitle('Formula 1', 'Azerbaijan Grand Prix', 15, 'Baku')).toBe('Azerbaijan Grand Prix — Formula 1');
    expect(weekendPageTitle('Formula 1', 'Round 7', 7)).toBe('Formula 1 round 7');
    expect(weekendPageTitle('DTM', 'Red Bull Ring Round', 1)).toBe('Red Bull Ring — DTM round 1');
    expect(sessionPageTitle('WorldSBK', 'Phillip Island Round', 'Race 1', 1)).toBe('Race 1, Phillip Island — WorldSBK');
  });
});
