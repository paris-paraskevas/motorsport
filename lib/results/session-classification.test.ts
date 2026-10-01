import { describe, expect, it, vi } from 'vitest';
import {
  isRaceLikeTitle,
  isRaceSession,
  mainRaceSession,
  indycarRoundByDate,
  fetchRoundClassification,
  pickRaceForSession,
  pickGtWorldRace,
} from '@/lib/results/session-classification';
import { shortSessionLabel, weekendSessionNav } from '@/lib/weekend';
import type { RaceResult, Series, Session, Weekend } from '@/lib/types';
import type { GtWorldRaceResult } from '@/lib/results/gt-world';

// B2: the snapshot source and DTM's per-race source are mocked per case; the overrides are empty.
const snapshot = vi.fn(async (): Promise<{ races: RaceResult[]; extras?: RaceResult[] } | null> => null);
const dtmResults = vi.fn(async (): Promise<RaceResult[]> => []);
vi.mock('@/components/weekend/WeekendStandingsSnapshot', () => ({ loadSnapshotSource: () => snapshot() }));
vi.mock('@/lib/results/dtm', () => ({ fetchDTMSeasonResults: () => dtmResults() }));
vi.mock('@/lib/series-content', () => ({ loadResultsOverrides: async () => [] }));

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

// B2: the event-named series (NASCAR, IndyCar) name the race by the event, so the race of a weekend is chosen per
// weekend: a session that is neither practice nor qualifying, nearest the round's end date.
const s = (seriesSlug: string, title: string, start: string): Session =>
  ({ uid: `${seriesSlug}-${title}-${start}`, seriesSlug, title, start: new Date(start), end: new Date(new Date(start).getTime() + 7200000) });
const weekendOf = (sessions: Session[], round: number): Weekend =>
  ({ key: `w${round}`, dateRangeLabel: '', sessions, isPast: true, round }) as unknown as Weekend;

describe('mainRaceSession and isRaceSession (B2)', () => {
  const indy500Week = weekendOf([
    s('indycar', 'IndyCar - Indianapolis 500 Practice 1', '2026-05-12T16:00:00Z'),
    s('indycar', 'IndyCar - Indianapolis 500 Qualifying Day 1', '2026-05-16T15:00:00Z'),
    s('indycar', 'IndyCar - Indianapolis 500 Last Chance Qualifying', '2026-05-17T18:00:00Z'),
    s('indycar', 'IndyCar - Indianapolis 500 Firestone Fast Six', '2026-05-17T20:00:00Z'),
    s('indycar', 'IndyCar - Indianapolis 500 Carb Day Practice', '2026-05-22T15:00:00Z'),
    s('indycar', 'IndyCar - Oscar Mayer Indy 500 Pit Stop Challenge', '2026-05-22T19:00:00Z'),
    s('indycar', 'IndyCar - 110th Indianapolis 500', '2026-05-24T16:45:00Z'),
  ], 7);
  const info = { endDate: '2026-05-24' };

  it('picks the 500 over the Fast Six and the Pit Stop Challenge: the non-practice, non-qualifying session nearest the round’s end', () => {
    expect(mainRaceSession(indy500Week, info)?.title).toBe('IndyCar - 110th Indianapolis 500');
    expect(isRaceSession('indycar', 'IndyCar - 110th Indianapolis 500', indy500Week, info)).toBe(true);
    expect(isRaceSession('indycar', 'IndyCar - Indianapolis 500 Firestone Fast Six', indy500Week, info)).toBe(false);
    expect(isRaceSession('indycar', 'IndyCar - Oscar Mayer Indy 500 Pit Stop Challenge', indy500Week, info)).toBe(false);
    expect(isRaceSession('indycar', 'IndyCar - Indianapolis 500 Carb Day Practice', indy500Week, info)).toBe(false);
  });

  it('picks the Daytona 500 over the Duel and the practice; the latest start without a curated round', () => {
    const daytona = weekendOf([
      s('nascar-cup', 'NASCAR - Practice', '2026-02-11T18:00:00Z'),
      s('nascar-cup', 'NASCAR - Qualifying', '2026-02-11T20:00:00Z'),
      s('nascar-cup', 'NASCAR - Bluegreen Vacations Duel 1', '2026-02-12T23:00:00Z'),
      s('nascar-cup', 'NASCAR - 68th Daytona 500', '2026-02-15T19:30:00Z'),
      // A later same-day session that is no race by its words: the 500 still wins, with or without the round's dates.
      s('nascar-cup', 'NASCAR - Victory Lane Celebration', '2026-02-15T23:00:00Z'),
    ], 1);
    expect(mainRaceSession(daytona, { endDate: '2026-02-15' })?.title).toBe('NASCAR - 68th Daytona 500');
    expect(mainRaceSession(daytona)?.title).toBe('NASCAR - 68th Daytona 500');
    // The round's end date decides between two race-like sessions on different days.
    const twoRaces = weekendOf([s('nascar-cup', 'NASCAR - Duel 500', '2026-02-12T23:00:00Z'), s('nascar-cup', 'NASCAR - 68th Daytona 500', '2026-02-15T19:30:00Z')], 1);
    expect(mainRaceSession(twoRaces, { endDate: '2026-02-12' })?.title).toBe('NASCAR - Duel 500');
    expect(mainRaceSession(twoRaces, { endDate: '2026-02-15' })?.title).toBe('NASCAR - 68th Daytona 500');
    expect(isRaceSession('nascar-cup', 'NASCAR - Bluegreen Vacations Duel 1', daytona, { endDate: '2026-02-15' })).toBe(false);
    const one = weekendOf([s('nascar-cup', 'NASCAR - Hollywood Casino 400', '2026-09-27T19:00:00Z')], 30);
    expect(isRaceSession('nascar-cup', 'NASCAR - Hollywood Casino 400', one, { endDate: '2026-09-27' })).toBe(true);
    expect(isRaceSession('indycar', 'IndyCar | Laguna Seca', weekendOf([s('indycar', 'IndyCar | Laguna Seca', '2026-09-06T19:00:00Z')], 17), null)).toBe(true);
  });

  it('keeps the word test for every other series, with or without a weekend', () => {
    expect(isRaceSession('f1', 'F1 - Race', null)).toBe(true);
    expect(isRaceSession('f1', 'F1 - Qualifying', weekendOf([s('f1', 'F1 - Qualifying', '2026-03-07T15:00:00Z')], 1))).toBe(false);
    expect(isRaceSession('dtm', 'DTM - Race 2', null)).toBe(true);
    expect(mainRaceSession(weekendOf([s('f1', 'F1 - Practice 1', '2026-03-06T11:00:00Z')], 1))).toBeNull();
  });
});

describe('indycarRoundByDate (B2)', () => {
  const rounds = [
    { round: 11, name: 'Music City', startDate: '2026-07-17', endDate: '2026-07-19' },
    { round: 12, name: 'Portland', startDate: '2026-08-07', endDate: '2026-08-09' },
  ];
  it('keys a race by the round whose dates hold its date; a race in no window (Mid-Ohio) has none', () => {
    expect(indycarRoundByDate(rounds, new Date('2026-08-09T00:00:00Z'))).toBe(12);
    expect(indycarRoundByDate(rounds, new Date('2026-07-19T00:00:00Z'))).toBe(11);
    expect(indycarRoundByDate(rounds, new Date('2026-07-05T00:00:00Z'))).toBeNull();
    expect(indycarRoundByDate(undefined, new Date('2026-08-09T00:00:00Z'))).toBeNull();
  });
});

describe('fetchRoundClassification (B2)', () => {
  const entry = (position: number, driverName: string, time?: string, status = 'Finished') =>
    ({ position, driverName, driverCode: driverName.slice(0, 3).toUpperCase(), team: 'Team', status, time, points: 10 });
  const seriesOf = (slug: string, sessions: Session[], rounds: { round: number; name: string; startDate: string; endDate: string }[]): Series =>
    ({ meta: { slug, name: slug, color: '#f00', icsUrl: '', season: 2026, category: 'single-seater' }, sessions, rounds: { season: 2026, rounds } }) as unknown as Series;

  it('answers the event-named race from the snapshot pool, drops a bare “Finished” from the time column, and refuses a non-race session', async () => {
    const nascar = seriesOf('nascar-cup', [s('nascar-cup', 'NASCAR - Hollywood Casino 400', '2026-09-27T19:00:00Z')], [{ round: 30, name: 'Hollywood Casino 400', startDate: '2026-09-27', endDate: '2026-09-27' }]);
    // NASCAR's parser leaves the time empty and says "Classified" in the status; IndyCar's says "Finished".
    snapshot.mockResolvedValue({ races: [{ round: 30, raceName: 'Hollywood Casino 400', date: new Date('2026-09-27'), circuit: '', results: [entry(1, 'Larson', undefined, 'Classified'), entry(2, 'Bell', 'Finished'), entry(0, 'Logano', undefined, 'Accident')] }] });
    const got = await fetchRoundClassification(nascar, 30, 'NASCAR - Hollywood Casino 400');
    expect(got?.entries.map(e => [e.position, e.driverName, e.time])).toEqual([[1, 'Larson', undefined], [2, 'Bell', undefined], [null, 'Logano', 'Accident']]);
    expect(await fetchRoundClassification(nascar, 30, 'NASCAR - Practice')).toBeNull();
  });

  it('re-keys IndyCar’s races by date against the rounds, so a round reads its own race', async () => {
    const indycar = seriesOf('indycar', [
      s('indycar', 'IndyCar | Nashville', '2026-07-19T19:00:00Z'),
      s('indycar', 'IndyCar | Portland', '2026-08-09T19:00:00Z'),
    ], [
      { round: 11, name: 'Music City', startDate: '2026-07-17', endDate: '2026-07-19' },
      { round: 12, name: 'Portland', startDate: '2026-08-07', endDate: '2026-08-09' },
    ]);
    snapshot.mockResolvedValue({ races: [
      { round: 11, raceName: 'Honda Indy 200 at Mid-Ohio', date: new Date('2026-07-05'), circuit: '', results: [entry(1, 'Palou'), entry(2, 'Dixon')] },
      { round: 12, raceName: 'Music City Grand Prix', date: new Date('2026-07-19'), circuit: '', results: [entry(1, 'Power'), entry(2, 'Palou')] },
      { round: 13, raceName: 'Grand Prix of Portland', date: new Date('2026-08-09'), circuit: '', results: [entry(1, 'Kirkwood'), entry(2, 'Palou')] },
    ] });
    expect((await fetchRoundClassification(indycar, 12, 'IndyCar | Portland'))?.entries[0].driverName).toBe('Kirkwood');
    expect((await fetchRoundClassification(indycar, 11, 'IndyCar | Nashville'))?.entries[0].driverName).toBe('Power');
  });

  it('reads DTM’s per-race source, matches the race by its number, and gives a synthetic position no number', async () => {
    const dtm = seriesOf('dtm', [
      s('dtm', 'DTM - Race 1', '2026-05-23T11:00:00Z'),
      s('dtm', 'DTM - Race 2', '2026-05-24T11:00:00Z'),
    ], [{ round: 2, name: 'Lausitzring', startDate: '2026-05-22', endDate: '2026-05-24' }]);
    snapshot.mockClear();
    dtmResults.mockResolvedValue([{ round: 2, raceName: 'Lausitzring — Race 1', date: new Date('2026-05-23'), circuit: '', results: [entry(1, 'Güven', '1:02:00'), entry(2, 'Auer', '+1.2'), entry(91, 'Engel', undefined, 'DNF')] }]);
    expect(await fetchRoundClassification(dtm, 2, 'DTM - Race 2')).toBeNull();
    const r1 = await fetchRoundClassification(dtm, 2, 'DTM - Race 1');
    expect(r1?.entries.map(e => [e.position, e.driverName])).toEqual([[1, 'Güven'], [2, 'Auer'], [null, 'Engel']]);
    expect(snapshot).not.toHaveBeenCalled();
    dtmResults.mockResolvedValue([
      { round: 2, raceName: 'Lausitzring — Race 1', date: new Date('2026-05-23'), circuit: '', results: [entry(1, 'Güven', '1:02:00'), entry(2, 'Auer', '+1.2')] },
      { round: 2, raceName: 'Lausitzring — Race 2', date: new Date('2026-05-24'), circuit: '', results: [entry(1, 'Auer', '58:14.005'), entry(2, 'Dörr', '+6.377')] },
    ]);
    expect((await fetchRoundClassification(dtm, 2, 'DTM - Race 2'))?.entries[0].driverName).toBe('Auer');
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
