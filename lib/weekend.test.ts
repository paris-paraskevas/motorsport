import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RENUMBERED_ROUNDS, nextSessionAcross, nextWeekend, renumberedSessionTarget, sessionAnchorName, sessionPageTitle, weekendAnchorName, weekendPageTitle } from './weekend';
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
    // X10b: an event-named race (the session IS the round) says what it is, so it never shares its weekend page’s title.
    expect(sessionPageTitle('IndyCar', 'Firestone Grand Prix of St. Petersburg', 'Firestone Grand Prix of St. Petersburg', 1, 'St. Petersburg', 'IndyCar', 'race')).toBe('Firestone Grand Prix of St. Petersburg race');
    expect(sessionPageTitle('NASCAR Cup', '68th Daytona 500', '68th Daytona 500', 1, 'Daytona', 'NASCAR', 'race')).toBe('68th Daytona 500 race — NASCAR Cup');
    for (const [series, round, n, place, code] of [['IndyCar', 'Firestone Grand Prix of St. Petersburg', 1, 'St. Petersburg', 'IndyCar'], ['NASCAR Cup', '68th Daytona 500', 1, 'Daytona', 'NASCAR'], ['IndyCar', 'Sonsio Grand Prix at the Brickyard', 6, 'Indianapolis', 'IndyCar']] as const) {
      expect(sessionPageTitle(series, round, round, n, place, code, 'race')).not.toBe(weekendPageTitle(series, round, n, place));
    }
    // The feed’s prefix on the session’s own name goes too (“IndyCar | Laguna Seca”), and a code with spaces is no code.
    expect(sessionPageTitle('IndyCar', 'Laguna Seca', 'IndyCar | Laguna Seca', 18, 'Monterey', 'IndyCar', 'race')).toBe('Laguna Seca race — IndyCar');
    expect(sessionPageTitle('Formula E', 'Monaco E-Prix', 'FP3', 10, 'Monaco', 'FE Monaco E-Prix R10')).toBe('FP3, Monaco E-Prix — Formula E');
    // No cut leaves a separator behind.
    expect(sessionPageTitle('WRC', 'Rallye Monte-Carlo', 'SS1 Toudon / Saint-Antonin (Monte Carlo) with a very long stage name', 1, 'Monaco', 'WRC')).not.toMatch(/[·|/&,:;–—-]\s*$/);
    expect(sessionPageTitle('WRC', 'WRC | Rally Italia Sardegna', 'Rally Italia Sardegna', 13, 'Olbia', 'WRC', 'none')).toBe('Rally Italia Sardegna — WRC');
    // Without the kind, a session that is its round is the race: the feeds name a race after its event, with or without the word.
    expect(sessionPageTitle('IndyCar', 'Chevrolet Detroit Grand Prix', 'Chevrolet Detroit Grand Prix', 8, 'Detroit', 'IndyCar')).toBe('Chevrolet Detroit Grand Prix race');
    // Too wide even for "… race": the race keeps the series and the round number rather than fall to the weekend's bare name.
    expect(sessionPageTitle('IndyCar', 'Ontario Honda Dealers Indy at Markham', 'Ontario Honda Dealers Indy at Markham', 14, undefined, 'IndyCar')).toBe('Race · IndyCar round 14');
    expect(weekendPageTitle('IndyCar', 'Ontario Honda Dealers Indy at Markham', 14)).toBe('Ontario Honda Dealers Indy at Markham');
    expect(sessionPageTitle('IndyCar', 'Chevrolet Detroit Grand Prix', 'Chevrolet Detroit Grand Prix', 8, 'Detroit', 'IndyCar')).not.toBe(weekendPageTitle('IndyCar', 'Chevrolet Detroit Grand Prix', 8, 'Detroit'));
    // The weekend page already holds the bare event name (nothing wider fits), so the session takes the next form.
    expect(weekendPageTitle('NASCAR Cup', 'Bass Pro Shops Night Race (Bristol)', 29)).toBe('Bass Pro Shops Night Race (Bristol)');
    expect(sessionPageTitle('NASCAR Cup', 'Bass Pro Shops Night Race (Bristol)', 'Bass Pro Shops Night Race', 29)).toBe('Bass Pro Shops Night Race');
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

// X12 (Seobility's "link anchor text duplicates for different pages"): the identity a link to a weekend or a session page
// carries after its visible label. Seobility judges a link text site-wide, so two pages may never share one.
describe('X12: weekendAnchorName and sessionAnchorName', () => {
  it('names the series and the round, the feed’s prefix stripped, the number when the label is only “Round n”', () => {
    expect(weekendAnchorName('Formula 1', 'Azerbaijan Grand Prix', 15)).toBe('Formula 1 Azerbaijan Grand Prix');
    expect(weekendAnchorName('WRC', 'WRC | Rally Italia Sardegna', 13)).toBe('WRC Rally Italia Sardegna');
    expect(weekendAnchorName('IndyCar', 'IndyCar | Grand Prix of Washington', 15)).toBe('IndyCar Grand Prix of Washington');
    expect(weekendAnchorName('Formula 1', 'Round 7', 7)).toBe('Formula 1 round 7');
    expect(weekendAnchorName('DTM', 'Red Bull Ring Round', 1)).toBe('DTM Red Bull Ring');
    // The round names the support series share with Formula 1 differ by the series.
    expect(weekendAnchorName('Formula 2', 'Italian Grand Prix', 12)).not.toBe(weekendAnchorName('Formula 1', 'Italian Grand Prix', 16));
  });

  it('names a session by the feed’s title whole, then its weekend: the title is what tells two qualifyings apart', () => {
    expect(sessionAnchorName('Formula 1', 'Azerbaijan Grand Prix', 15, 'F1 - Qualifying')).toBe('F1 - Qualifying, Formula 1 Azerbaijan Grand Prix');
    expect(sessionAnchorName('DTM', 'Red Bull Ring Round', 1, 'DTM - Qualifying 2')).not.toBe(sessionAnchorName('DTM', 'Red Bull Ring Round', 1, 'DTM - Qualifying 1'));
    expect(sessionAnchorName('Formula 1', 'Round 7', 7, ' F1 - Race ')).toBe('F1 - Race, Formula 1 round 7');
    // A session named after its event says the weekend once (the reviewer's "too long" finding on Nashville's rail).
    expect(sessionAnchorName('IndyCar', 'Big Machine Music City Grand Prix', 13, 'IndyCar - Big Machine Music City Grand Prix')).toBe('IndyCar - Big Machine Music City Grand Prix');
    expect(sessionAnchorName('NASCAR Cup', 'South Point 400', 29, 'South Point 400')).toBe('South Point 400, NASCAR Cup');
  });

  // Data-driven: every curated weekend and session (content/series/*/rounds.json and sessions.json) through the helpers.
  // No two weekends share a name across the site, no two sessions do, and so no two sessions of one weekend.
  it('is injective over every curated weekend and session', () => {
    const root = path.resolve(process.cwd(), 'content', 'series');
    const read = (f: string) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
    const weekends = new Map<string, string>();
    const sessions = new Map<string, string>();
    for (const slug of fs.readdirSync(root)) {
      const dir = path.join(root, slug);
      const meta = read(path.join(dir, 'meta.json')) as { name: string } | null;
      if (!meta) continue;
      const rounds = ((read(path.join(dir, 'rounds.json')) as { rounds?: { round: number; name: string }[] } | null)?.rounds ?? []);
      const nameOf = (round: number) => rounds.find(r => r.round === round)?.name ?? `Round ${round}`;
      for (const r of rounds) {
        const key = weekendAnchorName(meta.name, r.name, r.round);
        expect(weekends.get(key), `“${key}” names ${weekends.get(key)} and ${slug} r${r.round}`).toBeUndefined();
        weekends.set(key, `${slug} r${r.round}`);
      }
      const overrides = ((read(path.join(dir, 'sessions.json')) as { overrides?: { round?: number; sessions?: { title?: string }[] }[] } | null)?.overrides ?? []);
      for (const o of overrides) {
        const round = o.round ?? 0;
        for (const s of o.sessions ?? []) {
          const key = sessionAnchorName(meta.name, nameOf(round), round, s.title ?? '');
          expect(sessions.get(key), `“${key}” names ${sessions.get(key)} and ${slug} r${round}`).toBeUndefined();
          sessions.set(key, `${slug} r${round}`);
        }
      }
    }
    expect(weekends.size).toBeGreaterThan(150);
    expect(sessions.size).toBeGreaterThan(800);
  });
});

describe('X14: the renumbered IndyCar rounds', () => {
  // B2 put the Honda Indy 200 at Mid-Ohio at round 11 and moved the rounds from Music City on to 12–18, so the old
  // address of each of those session pages is the same slug one round later. The lookup answers the new round only
  // when the slug is missing at the asked round and present at the next; a slug both rounds share (a practice) stays.
  const indycar = series('indycar', 'IndyCar', [
    { title: 'IndyCar - Practice', start: at('2026-07-04T15:00:00Z'), end: at('2026-07-04T16:00:00Z'), location: 'Mid-Ohio' },
    { title: 'IndyCar - Honda Indy 200 at Mid-Ohio', start: at('2026-07-05T17:00:00Z'), end: at('2026-07-05T19:00:00Z'), location: 'Mid-Ohio' },
    { title: 'IndyCar - Practice', start: at('2026-07-18T15:00:00Z'), end: at('2026-07-18T16:00:00Z'), location: 'Nashville' },
    { title: 'IndyCar - Music City Grand Prix', start: at('2026-07-19T17:00:00Z'), end: at('2026-07-19T19:00:00Z'), location: 'Nashville' },
  ], [
    { round: 11, name: 'Honda Indy 200 at Mid-Ohio', startDate: '2026-07-03', endDate: '2026-07-05' },
    { round: 12, name: 'Music City Grand Prix', startDate: '2026-07-17', endDate: '2026-07-19' },
  ]);
  const now = at('2026-08-01T00:00:00Z');

  it('sends an event-named slug asked one round early to its new round', () => {
    expect(renumberedSessionTarget(indycar, 11, 'indycar-music-city-grand-prix', now)).toBe(12);
  });

  it('leaves a slug both rounds share where it is', () => {
    expect(renumberedSessionTarget(indycar, 11, 'indycar-practice', now)).toBeNull();
  });

  it('leaves a slug that exists nowhere, and every other series, alone', () => {
    expect(renumberedSessionTarget(indycar, 11, 'no-such-session', now)).toBeNull();
    expect(renumberedSessionTarget(f1, 1, 'race', now)).toBeNull();
  });

  it('covers only the renumbered rounds', () => {
    expect(RENUMBERED_ROUNDS.indycar).toEqual({ from: 11, to: 17, shift: 1 });
    expect(renumberedSessionTarget(indycar, 3, 'indycar-music-city-grand-prix', now)).toBeNull();
  });
});
