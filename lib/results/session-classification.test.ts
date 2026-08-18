import { describe, expect, it } from 'vitest';
import {
  isRaceLikeTitle,
  pickRaceForSession,
  pickGtWorldRace,
} from '@/lib/results/session-classification';
import { shortSessionLabel, weekendSessionNav } from '@/lib/weekend';
import type { RaceResult, Session, Weekend } from '@/lib/types';
import type { GtWorldRaceResult } from '@/lib/results/gt-world';

// The series-contract layer (reimagining §9 step 3): these are the pickers and
// generators every results surface builds on. A wrong pick silently renders
// the wrong race's result, and a wrongly-ordered tab row breaks DTM's weekend.

const race = (raceName: string, round = 5): RaceResult =>
  ({ round, raceName, date: new Date('2026-05-01'), circuit: '', results: [] });

const gtRace = (raceName: string): GtWorldRaceResult =>
  ({ raceName } as GtWorldRaceResult);

describe('isRaceLikeTitle', () => {
  it('accepts races, sprints and features in the series own words', () => {
    expect(isRaceLikeTitle('F2 - Sprint')).toBe(true);
    expect(isRaceLikeTitle('F2 - Feature')).toBe(true);
    expect(isRaceLikeTitle('WSBK: Race 2')).toBe(true);
    expect(isRaceLikeTitle('MotoGP - Race')).toBe(true);
  });
  it('rejects sprint QUALIFYING in both naming eras', () => {
    expect(isRaceLikeTitle('F1 - Sprint Qualifying')).toBe(false);
    expect(isRaceLikeTitle('F1 - Sprint Shootout')).toBe(false);
  });
  it('rejects practice and qualifying', () => {
    expect(isRaceLikeTitle('F1 - Practice 1')).toBe(false);
    expect(isRaceLikeTitle('F1 - Qualifying')).toBe(false);
  });
});

describe('pickRaceForSession', () => {
  it('returns null for no candidates and the sole candidate unwrapped', () => {
    expect(pickRaceForSession([], 'F2 - Sprint')).toBeNull();
    const only = race('Feature');
    expect(pickRaceForSession([only], 'F2 - Sprint')).toBe(only);
  });
  it('disambiguates a multi-race round by shared tokens', () => {
    const sprint = race('Sprint Race');
    const feature = race('Feature Race');
    expect(pickRaceForSession([sprint, feature], 'F2 - Sprint')).toBe(sprint);
    expect(pickRaceForSession([sprint, feature], 'F2 - Feature')).toBe(feature);
  });
  it('matches WorldSBK race numbers and the Superpole Race', () => {
    const r1 = race('Race 1');
    const sp = race('Superpole Race');
    const r2 = race('Race 2');
    expect(pickRaceForSession([r1, sp, r2], 'WSBK - Race 2')).toBe(r2);
    expect(pickRaceForSession([r1, sp, r2], 'WSBK - Superpole Race')).toBe(sp);
  });
});

describe('pickGtWorldRace', () => {
  it('returns null for none and the sole race unwrapped', () => {
    expect(pickGtWorldRace([], 'Sprint Race 1')).toBeNull();
    const only = gtRace('Main Race');
    expect(pickGtWorldRace([only], 'anything')).toBe(only);
  });
  it('matches sprint-round races by digit', () => {
    const r1 = gtRace('Race 1');
    const r2 = gtRace('Race 2');
    expect(pickGtWorldRace([r1, r2], 'GTWC - Sprint Race 2')).toBe(r2);
    expect(pickGtWorldRace([r1, r2], 'GTWC - Sprint Race 1')).toBe(r1);
  });
  it('falls back to the main race when the title carries no digit', () => {
    const main = gtRace('Main Race');
    const quali = gtRace('Qualifying Race');
    expect(pickGtWorldRace([quali, main], 'GTWC - Race')).toBe(main);
  });
});

describe('shortSessionLabel', () => {
  it.each([
    ['F1 - Practice 1', 'FP1'],
    ['Free Practice 2', 'FP2'],
    ['FP3', 'FP3'],
    ['F1 - Sprint Qualifying', 'SQ'],
    ['F1 - Sprint Shootout', 'SQ'],
    ['MotoGP - Sprint', 'SPRINT'],
    ['F1 - Qualifying', 'QUALI'],
    ['WSBK - Superpole', 'QUALI'],
    ['MotoGP - Warm Up', 'WARM-UP'],
    ['DTM - Race 1', 'RACE 1'],
    ['F1 - Race', 'RACE'],
    ['WRC - Shakedown', 'SHAKEDOWN'],
  ])('%s → %s', (title, label) => {
    expect(shortSessionLabel(title)).toBe(label);
  });
});

describe('weekendSessionNav', () => {
  const session = (uid: string, title: string, start: string): Session => ({
    uid,
    seriesSlug: 'dtm',
    title,
    start: new Date(start),
    end: new Date(new Date(start).getTime() + 3600_000),
  });
  // DTM's weekend is the contract's ordering proof: Q2 runs SUNDAY morning,
  // AFTER Saturday's Race 1 — grouping "all qualifying before all races"
  // would put the tabs in the wrong order. Input array is deliberately
  // shuffled; only start times may decide.
  const dtm: Weekend = {
    key: 'dtm-5',
    dateRangeLabel: '',
    isPast: true,
    round: 5,
    sessions: [
      session('race1', 'DTM - Race 1', '2026-05-02T13:30:00Z'),
      session('q2', 'DTM - Qualifying 2', '2026-05-03T09:00:00Z'),
      session('fp1', 'DTM - Free Practice 1', '2026-05-01T10:00:00Z'),
      session('race2', 'DTM - Race 2', '2026-05-03T13:30:00Z'),
      session('q1', 'DTM - Qualifying 1', '2026-05-02T09:00:00Z'),
    ],
  };

  it('orders strictly chronologically — DTM Q2 sits AFTER Race 1', () => {
    const nav = weekendSessionNav(dtm, 'dtm', 5, 'q2');
    expect(nav.items.map(i => i.uid)).toEqual(['fp1', 'q1', 'race1', 'q2', 'race2']);
  });
  it('builds hrefs from the session slug and marks the current session', () => {
    const nav = weekendSessionNav(dtm, 'dtm', 5, 'race1');
    const current = nav.items.find(i => i.isCurrent);
    expect(current?.uid).toBe('race1');
    expect(current?.href).toBe('/series/dtm/weekend/5/race-1');
  });
  it('pages prev/next in running order across the Q2-after-Race-1 boundary', () => {
    const nav = weekendSessionNav(dtm, 'dtm', 5, 'q2');
    expect(nav.prev?.uid).toBe('race1');
    expect(nav.next?.uid).toBe('race2');
  });
  it('has no prev at the first session and no next at the last', () => {
    expect(weekendSessionNav(dtm, 'dtm', 5, 'fp1').prev).toBeNull();
    expect(weekendSessionNav(dtm, 'dtm', 5, 'race2').next).toBeNull();
  });
});
