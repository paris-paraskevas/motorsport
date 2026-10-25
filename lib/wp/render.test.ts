import { describe, it, expect } from 'vitest';
import type { Series, Session } from '../types';
import type { CircuitMap, MapsStore, SessionExtras, SessionsStore, SessionWeather } from '../openf1/weekend';
import {
  askableAt,
  bandLabel,
  calendarEntries,
  calendarMonthPages,
  carrySessions,
  escapeHtml,
  hashOf,
  isRaceLaps,
  lapsDue,
  onlyFamily,
  latestRace,
  mapsDue,
  MARKER,
  nearestOpenF1,
  nextAsk,
  openf1Session,
  openf1Wanted,
  planSync,
  raceLaps,
  resultRounds,
  withSession,
  seriesPages,
  sessionKind,
  splitRaceName,
  standingsTables,
  tableBlock,
  weekendDue,
  weekendWhole,
  whenCells,
  withMarker,
  wpPaths,
  type CalendarEntry,
  type CalendarRound,
  type LapsStore,
  type ListedSession,
  type Page,
  type RaceLaps,
  type ResultRound,
  type SeriesData,
  type WpPageRow,
} from './render';

const entry = (position: number, driverName: string, extra: Record<string, unknown> = {}) => ({
  position,
  driverName,
  team: 'Team',
  status: 'Finished',
  points: Math.max(0, 26 - position),
  ...extra,
});

describe('escapeHtml', () => {
  it('escapes the five characters that can open markup or end an attribute', () => {
    expect(escapeHtml(`<b class="x">Tom & 'Jerry'</b>`)).toBe('&lt;b class=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/b&gt;');
  });
});

describe('standingsTables', () => {
  it('keeps drivers first, sorted by position, and names F2 teams as teams', () => {
    const tables = standingsTables('f2', {
      drivers: [
        { position: 2, driverName: 'B', team: 'T2', points: 10 },
        { position: 1, driverName: 'A', team: '', points: 20 },
        { position: 3, driverName: '', team: 'T3', points: 5 },
      ],
      constructors: [{ position: 1, name: 'Team X', points: 30 }],
    });
    expect(tables.map(t => t.title)).toEqual(['Drivers', 'Teams']);
    expect(tables[0].columns).toEqual(['Pos', 'Driver', 'Team', 'Pts']);
    expect(tables[0].rows).toEqual([
      ['1', 'A', '', '20'],
      ['2', 'B', 'T2', '10'],
    ]);
    expect(tables[1]).toEqual({ title: 'Teams', columns: ['Pos', 'Team', 'Pts'], rows: [['1', 'Team X', '30']] });
  });

  it('calls MotoGP riders riders and drops an empty team column', () => {
    const [t] = standingsTables('motogp', { drivers: [{ position: 1, driverName: 'R', team: '', points: 300 }] });
    expect(t.title).toBe('Riders');
    expect(t.columns).toEqual(['Pos', 'Rider', 'Pts']);
  });

  it('gives each class of a multi-class payload its own table, team rows with their car', () => {
    const tables = standingsTables('imsa', {
      drivers: { GTP: [{ position: 1, driverName: 'Crew A', points: 100 }], GTD: [{ position: 1, driverName: 'Crew B', points: 90 }] },
      teams: { GTP: [{ position: 1, team: '#7 Porsche Penske', car: 'Porsche 963', points: 100 }] },
      manufacturers: {},
    });
    expect(tables.map(t => t.title)).toEqual(['GTP · Drivers', 'GTD · Drivers', 'GTP · Teams']);
    expect(tables[2].columns).toEqual(['Pos', 'Team', 'Car', 'Pts']);
    expect(tables[2].rows[0]).toEqual(['1', '#7 Porsche Penske', 'Porsche 963', '100']);
  });

  it("reads GT World's three championships and skips the empty ones", () => {
    const tables = standingsTables('gt-world', {
      season: 2026,
      overall: { championship: 'overall', drivers: [{ position: 1, driverName: 'D', team: '', points: 50 }], teams: [{ position: 1, name: 'T', points: 60 }] },
      sprint: { championship: 'sprint', drivers: [], teams: [] },
      endurance: { championship: 'endurance', drivers: [{ position: 1, driverName: 'E', team: '', points: 40 }], teams: [] },
    });
    expect(tables.map(t => t.title)).toEqual(['Overall · Drivers', 'Overall · Teams', 'Endurance Cup · Drivers']);
  });

  it('answers [] for a payload with nothing usable', () => {
    expect(standingsTables('f1', null)).toEqual([]);
    expect(standingsTables('f1', { drivers: [{ position: 'x', driverName: 'A' }] })).toEqual([]);
  });
});

describe('splitRaceName', () => {
  it('reads the three namings the feeds use', () => {
    expect(splitRaceName('Grand Prix of Japan — Sprint', 'Race')).toEqual({ event: 'Grand Prix of Japan', label: 'Sprint' });
    expect(splitRaceName('Bahrain Feature Race', 'Race')).toEqual({ event: 'Bahrain', label: 'Feature' });
    expect(splitRaceName('Australian Grand Prix', 'Sprint')).toEqual({ event: 'Australian Grand Prix', label: 'Sprint' });
  });

  it('keeps the number of a carried-over race (lib/results/fom-api.test.ts:343)', () => {
    expect(splitRaceName('Azerbaijan Feature Race 2', 'Race')).toEqual({ event: 'Azerbaijan', label: 'Feature 2' });
  });
});

describe('resultRounds', () => {
  it('turns a newest-first feed into rounds oldest first, sprint before the main race, every finisher classified', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => entry(i + 1, `Rider ${i + 1}`));
    const rounds = resultRounds('motogp', [
      { round: 2, raceName: 'Grand Prix of Japan — Grand Prix', date: new Date('2026-04-12T00:00:00Z'), circuit: '', results: twelve },
      { round: 2, raceName: 'Grand Prix of Japan — Sprint', date: new Date('2026-04-11T00:00:00Z'), circuit: '', results: [entry(1, 'S'), entry(0, 'Out')] },
      { round: 1, raceName: 'Grand Prix of Qatar — Grand Prix', date: new Date('2026-03-01T00:00:00Z'), circuit: '', results: [entry(1, 'Q')] },
    ]);
    expect(rounds.map(r => [r.round, r.name, r.date])).toEqual([
      [1, 'Grand Prix of Qatar', '2026-03-01'],
      [2, 'Grand Prix of Japan', '2026-04-12'],
    ]);
    expect(rounds[1].sessions.map(s => s.label)).toEqual(['Sprint', 'Grand Prix']);
    expect(rounds[1].sessions[0].tables[0].rows).toEqual([['1', 'S', 'Team', 'Finished', '25']]);
    const main = rounds[1].sessions[1].tables[0];
    expect(main.columns).toEqual(['Pos', 'Rider', 'Team', 'Time', 'Pts']);
    // Stored whole since O15; the plain pages cut to ten when they draw.
    expect(main.rows).toHaveLength(12);
    const motogp: SeriesData = { slug: 'motogp', name: 'MotoGP', standings: null, results: rounds, calendar: null };
    const plain = seriesPages(motogp, new Date('2026-10-20T00:00:00Z')).find(p => p.path === '/series/motogp/results/')!;
    expect(plain.body).toContain('Rider 10');
    expect(plain.body).not.toContain('Rider 11');
  });

  it("files F1's qualifying with the round's other sessions, the parts nobody ran left out", () => {
    const quali = (position: number, driverName: string, q3 = '') => ({ position, driverName, team: 'McLaren', q1: '1:20.0', q2: '1:19.5', q3 });
    const rounds = resultRounds(
      'f1',
      {
        races: [{ round: 6, raceName: 'Miami Grand Prix', date: '2026-05-03T00:00:00.000Z', circuit: 'Miami', results: [entry(1, 'Winner')] }],
        sprints: [],
        qualifying: [
          { round: 6, raceName: 'Miami Grand Prix', date: '2026-05-02', results: [quali(2, 'Second', '1:19.0'), quali(1, 'Pole', '1:18.9')] },
          { round: 7, raceName: 'Canadian Grand Prix', date: '2026-05-23', results: [{ position: 1, driverName: 'Fast', team: 'T', q1: '1:12.0', q2: '', q3: '' }] },
        ],
      },
      [{ round: 7, name: 'Canadian Grand Prix', startDate: '2026-05-22', endDate: '2026-05-24' }],
    );
    expect(rounds.map(r => [r.round, r.date, r.sessions.map(s => s.label), (r.others ?? []).map(s => s.label)])).toEqual([
      [6, '2026-05-03', ['Race'], ['Qualifying']],
      // No race yet: the round takes its Sunday from rounds.json, and its race stays the only thing latestRace reads.
      [7, '2026-05-24', [], ['Qualifying']],
    ]);
    expect(rounds[0].others?.[0].tables[0]).toEqual({
      title: 'Qualifying',
      columns: ['Pos', 'Driver', 'Team', 'Q1', 'Q2', 'Q3'],
      rows: [
        ['1', 'Pole', 'McLaren', '1:20.0', '1:19.5', '1:18.9'],
        ['2', 'Second', 'McLaren', '1:20.0', '1:19.5', '1:19.0'],
      ],
    });
    expect(rounds[1].others?.[0].tables[0].columns).toEqual(['Pos', 'Driver', 'Team', 'Q1']);
    expect(latestRace(rounds)?.round.round).toBe(6);
  });

  it("joins F1's Grand Prix list and sprint list into one round", () => {
    const [round] = resultRounds('f1', {
      races: [{ round: 6, raceName: 'Miami Grand Prix', date: '2026-05-03T00:00:00.000Z', circuit: 'Miami', results: [entry(1, 'Winner', { time: '1:30:00.000' })] }],
      sprints: [{ round: 6, raceName: 'Miami Grand Prix', date: '2026-05-02T00:00:00.000Z', circuit: 'Miami', results: [entry(1, 'Sprinter')] }],
    });
    expect(round.name).toBe('Miami Grand Prix');
    expect(round.sessions.map(s => s.label)).toEqual(['Sprint', 'Race']);
    expect(round.sessions[1].tables[0].rows[0]).toEqual(['1', 'Winner', 'Team', '1:30:00.000', '25']);
    // jolpi.ca times a lapped car against the winner over a lap fewer: it reads Lapped, as it is.
    const [singapore] = resultRounds('f1', {
      races: [{ round: 17, raceName: 'Singapore Grand Prix', date: '2026-10-11', circuit: 'Marina Bay', results: [entry(1, 'Max', { time: '1:42:00.785' }), entry(11, 'Pierre', { status: 'Lapped', time: '+2.171' }), entry(18, 'Alex', { status: 'Retired', time: '' })] }],
      sprints: [],
    });
    expect(singapore.sessions[0].tables[0].rows.map(r => r[3])).toEqual(['1:42:00.785', 'Lapped', 'Retired']);
    // A sprint weekend is dated by its Sunday, not by the sprint's Saturday.
    expect(round.date).toBe('2026-05-03');
  });

  it("reads F2's feature and sprint lists by their FOM names", () => {
    const [round] = resultRounds('f2', {
      feature: [{ round: 1, raceName: 'Bahrain Feature Race', date: new Date('2026-04-12T00:00:00Z'), circuit: '', results: [entry(1, 'F')] }],
      sprint: [{ round: 1, raceName: 'Bahrain Sprint Race', date: new Date('2026-04-11T00:00:00Z'), circuit: '', results: [entry(1, 'S')] }],
    });
    expect(round.name).toBe('Bahrain');
    expect(round.sessions.map(s => s.label)).toEqual(['Sprint', 'Feature']);
  });

  it('tells two feature races of one round apart, after the sprint', () => {
    const [round] = resultRounds('f2', {
      feature: [
        { round: 12, raceName: 'Azerbaijan Feature Race 1', date: new Date('2026-09-26T00:00:00Z'), circuit: '', results: [entry(1, 'One')] },
        { round: 12, raceName: 'Azerbaijan Feature Race 2', date: new Date('2026-09-26T00:00:00Z'), circuit: '', results: [entry(1, 'Two')] },
      ],
      sprint: [{ round: 12, raceName: 'Azerbaijan Sprint Race', date: new Date('2026-09-25T00:00:00Z'), circuit: '', results: [entry(1, 'S')] }],
    });
    expect(round.name).toBe('Azerbaijan');
    expect(round.sessions.map(s => s.label)).toEqual(['Sprint', 'Feature 1', 'Feature 2']);
  });

  it("keys IndyCar's races by date, not by the feed's column number", () => {
    const rounds = resultRounds(
      'indycar',
      [{ round: 5, raceName: 'Indianapolis 500', date: new Date('2026-05-24T00:00:00Z'), circuit: '', results: [entry(1, 'I')] }],
      [{ round: 4, startDate: '2026-05-22', endDate: '2026-05-24', name: 'Indianapolis 500' }],
    );
    expect(rounds[0].round).toBe(4);
  });

  it('keeps an IndyCar race in no round of the schedule apart and unnumbered, in date order', () => {
    const rounds = resultRounds(
      'indycar',
      [
        { round: 11, raceName: 'Honda Indy 200', date: new Date('2026-07-05T00:00:00Z'), circuit: '', results: [entry(1, 'A')] },
        { round: 12, raceName: 'Music City', date: new Date('2026-07-12T00:00:00Z'), circuit: '', results: [entry(1, 'B')] },
      ],
      [{ round: 11, startDate: '2026-07-10', endDate: '2026-07-12', name: 'Music City' }],
    );
    expect(rounds.map(r => [r.round, r.name, r.date])).toEqual([
      [null, 'Honda Indy 200', '2026-07-05'],
      [11, 'Music City', '2026-07-12'],
    ]);
  });

  it('puts an undated, unnumbered race first, so the newest-first page prints it last', () => {
    const rounds = resultRounds('gt-world', [
      { raceId: 1, raceName: 'Main Race', eventName: 'Monza', championship: 'endurance', round: 2, entries: [{ position: 1, carNumber: '7', drivers: ['X'], team: 'T', cupLabel: 'Pro' }] },
      { raceId: 2, raceName: 'Race 1', eventName: 'Unknown', championship: 'sprint', entries: [{ position: 1, carNumber: '9', drivers: ['Y'], team: 'U', cupLabel: 'Pro' }] },
    ], [{ round: 2, startDate: '2026-05-30', endDate: '2026-05-31', name: 'Monza' }]);
    expect(rounds.map(r => r.name)).toEqual(['Unknown', 'Monza']);
  });

  it('leaves out synthetic places (DTM 90+) and drops the points column when nobody scored', () => {
    const [round] = resultRounds('nls', [
      { round: 1, raceName: 'NLS1', date: new Date('2026-03-21T00:00:00Z'), circuit: 'Nordschleife', results: [entry(1, 'W', { points: 0, status: 'Winner' }), entry(91, 'DNF')] },
    ]);
    const t = round.sessions[0].tables[0];
    expect(t.columns).toEqual(['Pos', 'Driver', 'Team', 'Time']);
    expect(t.rows).toEqual([['1', 'W', 'Team', 'Winner']]);
  });

  it('gives a multi-class round one table per class', () => {
    const [round] = resultRounds('wec', [
      {
        round: 6,
        eventName: '6 Hours of Fuji',
        dateStart: new Date('2026-09-25T00:00:00Z'),
        dateEnd: new Date('2026-09-27T00:00:00Z'),
        perClass: {
          Hypercar: [{ position: 1, carNumber: '8', drivers: 'A, B', team: 'Toyota', gap: '', status: 'Classified' }],
          LMGT3: [{ position: 1, carNumber: '32', drivers: 'C', team: 'WRT', gap: '' }],
        },
      },
    ]);
    expect(round).toMatchObject({ round: 6, name: '6 Hours of Fuji', date: '2026-09-27' });
    expect(round.sessions).toHaveLength(1);
    expect(round.sessions[0].tables.map(t => t.title)).toEqual(['Hypercar', 'LMGT3']);
    expect(round.sessions[0].tables[0].rows[0]).toEqual(['1', '8', 'A, B', 'Toyota', 'Classified']);
  });

  it("reads GT World's races and dates a round from rounds.json", () => {
    const [round] = resultRounds(
      'gt-world',
      [{ raceId: 1, raceName: 'Main Race', eventName: 'Monza', eventSlug: 'monza', championship: 'endurance', round: 2, entries: [{ position: 1, carNumber: '7', cup: 'pro', cupLabel: 'Pro', drivers: ['X', 'Y'], team: 'T', car: 'C' }] }],
      [{ round: 2, startDate: '2026-05-30', endDate: '2026-05-31', name: 'Monza' }],
    );
    expect(round).toMatchObject({ round: 2, name: 'Monza', date: '2026-05-31' });
    expect(round.sessions[0].tables[0].rows[0]).toEqual(['1', '7', 'X, Y', 'T', 'Pro']);
  });
});

describe("F1's practices and sprint qualifying (O15)", () => {
  const table = (title: string) => ({ title, columns: ['Pos', 'Driver'], rows: [['1', 'A']] });
  const s = (label: string) => ({ label, tables: [table(label)] });
  const at = (round: number, session: string, start: string, hours = 1, dateOnly = false): CalendarEntry => ({
    start,
    end: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
    dateOnly,
    event: `Round ${round}`,
    session,
    round,
  });

  it('carries every stored session the fresh rounds lack, a round with no race yet kept for them, in running order', () => {
    const fresh: ResultRound[] = [{ round: 1, name: 'One', date: '2026-03-08', sessions: [s('Race')], others: [s('Qualifying')] }];
    const stored: ResultRound[] = [
      { round: 1, name: 'One', date: '2026-03-08', sessions: [s('Race')], others: [{ label: 'Qualifying', tables: [] }, s('Practice 2'), s('Practice 1')] },
      { round: 2, name: 'Two', date: '2026-03-15', sessions: [], others: [s('Practice 1')] },
      { round: 3, name: 'Three', date: '2026-03-22', sessions: [s('Race')] },
    ];
    const out = carrySessions(fresh, stored, 2026);
    expect(out.map(r => [r.round, r.sessions.map(x => x.label), (r.others ?? []).map(x => x.label)])).toEqual([
      [1, ['Race'], ['Practice 1', 'Practice 2', 'Qualifying']],
      [2, [], ['Practice 1']],
    ]);
    // The fresh qualifying wins over the stored one; a stored race is never carried (the health check sees it go).
    expect(out[0].others?.[2].tables).toHaveLength(1);
    expect(fresh[0].others?.map(x => x.label)).toEqual(['Qualifying']);
    expect(carrySessions(fresh, null, 2026)).toEqual(fresh);
    // At a new season the stored rounds are last year's, whose numbers the new rounds reuse: none is carried.
    const first2027: ResultRound[] = [{ round: 1, name: 'One', date: '2027-03-07', sessions: [s('Race')] }];
    expect(carrySessions(first2027, stored, 2027)).toEqual(first2027);
  });

  it('wants the practices and sprint qualifying over an hour ago that no round holds, the newest first, at most max', () => {
    const rounds: ResultRound[] = [{ round: 1, name: 'One', date: '2026-03-08', sessions: [], others: [s('Practice 1')] }];
    const calendar = [
      at(1, 'Practice 1', '2026-03-06T01:30:00Z'),
      at(1, 'Practice 2', '2026-03-06T05:00:00Z'),
      at(1, 'Qualifying', '2026-03-07T05:00:00Z'),
      at(2, 'Practice 1', '2026-03-13T03:30:00Z'),
      at(2, 'Sprint Qualifying', '2026-03-13T07:30:00Z'),
      at(2, 'Practice 3', '2026-03-13T00:00:00Z', 0, true),
      // Ended 30 minutes before now: OpenF1's free data is not final yet.
      at(3, 'Practice 1', '2026-03-20T10:30:00Z'),
    ];
    const now = new Date('2026-03-20T12:00:00Z');
    expect(openf1Wanted(rounds, calendar, now, 12).map(e => `${e.round} ${e.session}`)).toEqual(['2 Sprint Qualifying', '2 Practice 1', '1 Practice 2']);
    expect(openf1Wanted(rounds, calendar, now, 1).map(e => `${e.round} ${e.session}`)).toEqual(['2 Sprint Qualifying']);
    expect(openf1Wanted(rounds, calendar, now, 0)).toEqual([]);
  });

  it('files a fetched session into its round, replacing one of the same name, or makes the round', () => {
    const rounds: ResultRound[] = [{ round: 1, name: 'One', date: '2026-03-08', sessions: [s('Race')], others: [s('Qualifying'), { label: 'Practice 1', tables: [] }] }];
    const one = withSession(rounds, 1, 'One', null, s('Practice 1'));
    expect(one[0].others?.map(x => [x.label, x.tables.length])).toEqual([['Practice 1', 1], ['Qualifying', 1]]);
    const two = withSession(one, 2, 'Two', '2026-03-15', s('Practice 1'));
    expect(two.map(r => [r.round, r.date, r.sessions.length])).toEqual([[1, '2026-03-08', 1], [2, '2026-03-15', 0]]);
    expect(rounds[0].others?.[1].tables).toEqual([]);
  });

  it("reads OpenF1's classification: a practice by best lap, sprint qualifying by its three parts", () => {
    const practice = openf1Session('Practice 2', [
      { position: 2, driverName: 'B', team: 'Ferrari', time: '1:31.002', gap: '+0.120', laps: 24 },
      { position: 1, driverName: 'A', team: 'McLaren', time: '1:30.882', laps: 26 },
      { position: null, driverName: 'C', team: 'Haas', laps: 0 },
    ]);
    expect(practice).toEqual({
      label: 'Practice 2',
      tables: [{ title: 'Practice 2', columns: ['Pos', 'Driver', 'Team', 'Time', 'Gap', 'Laps'], rows: [['1', 'A', 'McLaren', '1:30.882', '', '26'], ['2', 'B', 'Ferrari', '1:31.002', '+0.120', '24']] }],
    });
    const sq = openf1Session('Sprint Qualifying', [{ position: 1, driverName: 'A', team: 'McLaren', q1: '1:31.1', q2: '1:30.9' }]);
    expect(sq?.tables[0].columns).toEqual(['Pos', 'Driver', 'Team', 'SQ1', 'SQ2']);
    expect(openf1Session('Practice 1', [])).toBeNull();
  });

  it('names each driver as the roster does, else tidies OpenF1’s capitals, and keeps nothing a number still stands for', () => {
    const roster = new Map([['27', { name: 'Nico Hülkenberg', team: 'Audi' }]]);
    const at = (position: number, carNumber: string, driverName: string) => ({ position, carNumber, driverName, team: 'Kick Sauber', time: '1:31.0', laps: 20 });
    const named = openf1Session('Practice 1', [at(1, '27', 'Nico HULKENBERG'), at(2, '1', 'Max VERSTAPPEN')], roster);
    expect(named?.tables[0].rows.map(r => [r[1], r[2]])).toEqual([
      ['Nico Hülkenberg', 'Audi'],
      ['Max Verstappen', 'Kick Sauber'],
    ]);
    // A throttled /drivers answer leaves a number for a driver the roster does not know: the session waits for a later run.
    expect(openf1Session('Practice 1', [at(1, '27', 'Nico HULKENBERG'), at(2, '38', '#38')], roster)).toBeNull();
  });
});

describe("Formula 1's weekend data: what a run asks OpenF1 for (O19)", () => {
  const at = (round: number, session: string, start: string, hours = 1, dateOnly = false): CalendarEntry => ({
    start,
    end: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
    dateOnly,
    event: `Round ${round}`,
    session,
    round,
  });
  const listed = (session_key: number, session_name: string, date_start: string, date_end?: string): ListedSession => ({ session_key, session_name, date_start, date_end });
  const weather: SessionWeather = { air: [27, 28, 29], track: [40, 44, 47], humidity: [60, 70], rain: false };
  const extras = (parts: Partial<SessionExtras> = {}): SessionExtras => ({ key: 1, at: '2026-03-08T07:00:00.000Z', ...parts });

  it("matches a timetable session to OpenF1's of the same name nearest its start, within a day and a half", () => {
    const races = [listed(11, 'Race', '2026-03-08T04:00:00+00:00'), listed(12, 'Race', '2026-03-15T07:00:00+00:00')];
    expect(nearestOpenF1(races, at(2, 'race', '2026-03-15T07:00:00Z'))?.session_key).toBe(12);
    // A start moved by a day still matches; two days do not, nor does another session's name.
    expect(nearestOpenF1(races, at(1, 'Race', '2026-03-09T04:00:00Z'))?.session_key).toBe(11);
    expect(nearestOpenF1(races, at(1, 'Race', '2026-03-10T05:00:00Z'))).toBeUndefined();
    expect(nearestOpenF1(races, at(1, 'Sprint', '2026-03-08T04:00:00Z'))).toBeUndefined();
  });

  it("waits out OpenF1's live window: half an hour after the later of the timetable's end and OpenF1's own", () => {
    const e = at(17, 'Sprint', '2026-10-10T09:00:00Z', 0.5);
    const iso = (ms: number) => new Date(ms).toISOString();
    expect(iso(askableAt(e, listed(1, 'Sprint', '2026-10-10T09:00:00+00:00', '2026-10-10T10:15:00+00:00')))).toBe('2026-10-10T10:45:00.000Z');
    expect(iso(askableAt(e, listed(1, 'Sprint', '2026-10-10T09:00:00+00:00', '2026-10-10T09:20:00+00:00')))).toBe('2026-10-10T10:00:00.000Z');
    expect(iso(askableAt(e, listed(1, 'Sprint', '2026-10-10T09:00:00+00:00')))).toBe('2026-10-10T10:00:00.000Z');
  });

  it('asks again within the hour while a session is less than a day over, then a day later', () => {
    const now = new Date('2026-10-11T14:00:00Z');
    expect(nextAsk(Date.parse('2026-10-11T13:00:00Z'), now)).toBe('2026-10-11T15:00:00.000Z');
    expect(nextAsk(Date.parse('2026-10-10T14:00:01Z'), now)).toBe('2026-10-11T15:00:00.000Z');
    expect(nextAsk(Date.parse('2026-10-10T14:00:00Z'), now)).toBe('2026-10-12T14:00:00.000Z');
  });

  it('calls a session whole with its weather and marks, its tyres when it is a race or a sprint, and a race with its safety car laps', () => {
    expect(weekendWhole(undefined, 'Race')).toBe(false);
    expect(weekendWhole(extras({ weather, marks: {} }), 'Practice 1')).toBe(true);
    expect(weekendWhole(extras({ weather, marks: {} }), 'Sprint Qualifying')).toBe(true);
    expect(weekendWhole(extras({ weather, marks: {} }), 'Sprint')).toBe(false);
    expect(weekendWhole(extras({ weather, marks: {}, stints: [[1, [['MEDIUM', 1, 19]]]] }), 'Sprint')).toBe(true);
    // O28: a race kept before its safety car laps were read is asked again once; none is [].
    expect(weekendWhole(extras({ weather, marks: {}, stints: [[1, [['MEDIUM', 1, 19]]]] }), 'Race')).toBe(false);
    expect(weekendWhole(extras({ weather, marks: { neutral: [] }, stints: [[1, [['MEDIUM', 1, 19]]]] }), 'Race')).toBe(true);
    expect(weekendWhole(extras({ marks: {} }), 'Practice 1')).toBe(false);
  });

  it('asks a race kept before its safety car laps again, and a race with them no more', () => {
    const calendar = [at(1, 'Race', '2026-03-08T04:00:00Z', 2)];
    const list = [listed(9002, 'Race', '2026-03-08T04:00:00+00:00', '2026-03-08T06:00:00+00:00')];
    const kept = (marks: SessionExtras['marks']): SessionsStore => ({ '2026': { '1': { Race: extras({ weather, marks, stints: [[1, [['MEDIUM', 1, 58]]]] }) } } });
    const now = new Date('2026-10-25T09:00:00Z');
    expect(weekendDue(calendar, list, kept({}), 2026, now, 20).due.map(d => d.session.session_key)).toEqual([9002]);
    expect(weekendDue(calendar, list, kept({ neutral: [{ kind: 'VSC', from: 12, to: 14 }] }), 2026, now, 20).due).toEqual([]);
  });

  describe('weekendDue', () => {
    const calendar = [
      at(1, 'Practice 1', '2026-03-06T01:30:00Z'),
      at(1, 'Practice 2', '2026-03-06T00:00:00Z', 0, true),
      at(1, 'Race', '2026-03-08T04:00:00Z', 2),
      at(2, 'Practice 1', '2026-03-13T03:30:00Z'),
      at(2, 'Sprint Qualifying', '2026-03-13T07:30:00Z'),
      at(2, 'Sprint', '2026-03-14T03:00:00Z'),
      at(2, 'Qualifying', '2026-03-14T07:00:00Z'),
      at(2, 'Race', '2026-03-15T07:00:00Z', 2),
      // Last season's finale: another season's file.
      at(24, 'Race', '2025-12-07T13:00:00Z', 2),
    ];
    const list = [
      listed(9001, 'Practice 1', '2026-03-06T01:30:00+00:00', '2026-03-06T02:30:00+00:00'),
      listed(9002, 'Race', '2026-03-08T04:00:00+00:00', '2026-03-08T06:00:00+00:00'),
      listed(9003, 'Practice 1', '2026-03-13T03:30:00+00:00', '2026-03-13T04:30:00+00:00'),
      listed(9004, 'Sprint', '2026-03-14T03:00:00+00:00', '2026-03-14T04:00:00+00:00'),
      // Ran twenty minutes over: OpenF1's own end keeps it in the live window a little longer.
      listed(9005, 'Qualifying', '2026-03-14T07:00:00+00:00', '2026-03-14T08:20:00+00:00'),
    ];
    const store: SessionsStore = {
      '2026': {
        '1': { 'Practice 1': extras({ weather, marks: {} }), Race: extras({ weather, marks: {}, next: '2026-03-09T06:00:00.000Z' }) },
        '2': { 'Practice 1': extras({ weather, next: '2026-03-14T09:00:00.000Z' }) },
      },
      // Last season's round 2 was another weekend.
      '2025': { '2': { Sprint: extras({ weather, marks: {}, stints: [[1, [['SOFT', 1, 19]]]] }) } },
    };
    const keys = (due: { entry: CalendarEntry; session: ListedSession }[]) => due.map(d => `${d.entry.round} ${d.entry.session} ${d.session.session_key}`);
    const named = (entries: CalendarEntry[]) => entries.map(e => `${e.round} ${e.session}`);

    it('asks for the finished sessions not yet whole once OpenF1 can be asked, the newest first, and sets the unlisted apart', () => {
      const got = weekendDue(calendar, list, store, 2026, new Date('2026-03-14T08:45:00Z'), 12);
      // The qualifying ended 25 minutes ago by OpenF1's clock; the first practice waits for its next ask; the race lacks
      // its tyres; OpenF1 does not list the sprint qualifying.
      expect(keys(got.due)).toEqual(['2 Sprint 9004', '1 Race 9002']);
      expect(named(got.unlisted)).toEqual(['2 Sprint Qualifying']);
    });

    it('takes the rest as their times come, at most max', () => {
      const later = new Date('2026-03-14T09:00:00Z');
      expect(keys(weekendDue(calendar, list, store, 2026, later, 12).due)).toEqual(['2 Qualifying 9005', '2 Sprint 9004', '2 Practice 1 9003', '1 Race 9002']);
      expect(keys(weekendDue(calendar, list, store, 2026, later, 1).due)).toEqual(['2 Qualifying 9005']);
      const none = weekendDue(calendar, list, store, 2026, later, 0);
      expect(none.due).toEqual([]);
      expect(named(none.unlisted)).toEqual(['2 Sprint Qualifying']);
      // OpenF1's list did not answer: nothing is asked, and the log names what waits.
      expect(named(weekendDue(calendar, [], store, 2026, later, 12).unlisted)).toEqual(['2 Qualifying', '2 Sprint', '2 Sprint Qualifying', '2 Practice 1', '1 Race']);
    });
  });

  describe('mapsDue', () => {
    const round = (n: number, circuit: string | null, startDate: string): CalendarRound => ({ round: n, name: `Round ${n}`, startDate, endDate: startDate, venue: null, circuit });
    const map = (year: number, session: number, next?: string): CircuitMap => ({
      year, session, driver: 1, lap: 90, sectors: [30, 30, 30], w: 1000, h: 600, points: [[0, 0], [1, 1]], split: [0, 1], ...(next ? { next } : {}),
    });
    const due = (got: { circuit: string; session: ListedSession | null }[]) => got.map(d => [d.circuit, d.session?.session_key ?? null]);

    it("draws each circuit from its latest pole lap, last season's until this season's qualifying, the nearest rounds first", () => {
      const rounds = [
        round(9, 'spielberg', '2026-06-26'),
        round(10, 'spielberg', '2026-07-03'),
        round(12, null, '2026-07-24'),
        round(14, 'zandvoort', '2026-08-21'),
        round(15, 'monza', '2026-09-04'),
        round(16, 'baku', '2026-09-25'),
        round(17, 'marina-bay', '2026-10-09'),
        round(18, 'americas', '2026-10-23'),
        round(19, 'mexico', '2026-10-30'),
        round(20, 'interlagos', '2026-11-06'),
      ];
      const calendar = [
        at(9, 'Qualifying', '2026-06-27T14:00:00Z'),
        at(10, 'Qualifying', '2026-07-04T14:00:00Z'),
        at(14, 'Qualifying', '2026-08-22T13:00:00Z'),
        at(15, 'Qualifying', '2026-09-05T14:00:00Z'),
        at(16, 'Qualifying', '2026-09-26T12:00:00Z'),
        at(17, 'Qualifying', '2026-10-10T13:00:00Z'),
        at(18, 'Qualifying', '2026-10-24T21:00:00Z'),
      ];
      // OpenF1 does not list Monza's qualifying; Austin's is still to run.
      const list = [
        listed(9909, 'Qualifying', '2026-06-27T14:00:00+00:00', '2026-06-27T15:00:00+00:00'),
        listed(9910, 'Qualifying', '2026-07-04T14:00:00+00:00', '2026-07-04T15:00:00+00:00'),
        listed(9914, 'Qualifying', '2026-08-22T13:00:00+00:00', '2026-08-22T14:00:00+00:00'),
        listed(9916, 'Qualifying', '2026-09-26T12:00:00+00:00', '2026-09-26T13:00:00+00:00'),
        listed(9917, 'Qualifying', '2026-10-10T13:00:00+00:00', '2026-10-10T14:00:00+00:00'),
      ];
      const maps: MapsStore = {
        // Drawn from the first of its two rounds; the second has run since.
        spielberg: map(2026, 9909),
        // A redraw failed this morning: tried again tomorrow.
        zandvoort: map(2025, 7014, '2026-10-23T06:00:00.000Z'),
        monza: map(2025, 7015),
        baku: map(2026, 9916),
        'marina-bay': map(2025, 7017),
        mexico: { miss: '2026-10-22T06:00:00.000Z', next: '2026-10-23T06:00:00.000Z' },
        interlagos: { miss: '2026-10-20T06:00:00.000Z', next: '2026-10-21T06:00:00.000Z' },
      };
      const now = new Date('2026-10-22T09:00:00Z');
      expect(due(mapsDue(rounds, calendar, list, maps, 2026, now, 12))).toEqual([['americas', null], ['marina-bay', 9917], ['interlagos', null], ['spielberg', 9910]]);
      expect(due(mapsDue(rounds, calendar, list, maps, 2026, now, 2))).toEqual([['americas', null], ['marina-bay', 9917]]);
    });

    it("redraws last season's map once this season's qualifying is past OpenF1's live window, then keeps it", () => {
      const austin = [round(18, 'americas', '2026-10-23')];
      const calendar = [at(18, 'Qualifying', '2026-10-24T21:00:00Z')];
      const list = [listed(9918, 'Qualifying', '2026-10-24T21:00:00+00:00', '2026-10-24T22:05:00+00:00')];
      const run = (maps: MapsStore, now: string) => due(mapsDue(austin, calendar, list, maps, 2026, new Date(now), 6));
      expect(run({ americas: map(2025, 7018) }, '2026-10-24T22:30:00Z')).toEqual([]);
      expect(run({ americas: map(2025, 7018) }, '2026-10-24T22:35:00Z')).toEqual([['americas', 9918]]);
      expect(run({ americas: map(2026, 9918) }, '2026-10-25T12:00:00Z')).toEqual([]);
    });
  });
});

describe("Formula 1's lap chart: what a run asks Jolpica for (O28)", () => {
  // Jolpica's answers as it gives them: numbers as strings, the race in MRData.RaceTable.Races[0], 100 timings a page.
  const answer = (race: Record<string, unknown>, total?: number) => ({ MRData: { limit: '100', ...(total === undefined ? {} : { total: String(total) }), RaceTable: { Races: [race] } } });
  const result = (driverId: string, givenName: string, familyName: string, grid: number, laps: number, status = 'Finished') => ({
    position: '1', Driver: { driverId, givenName, familyName }, grid: String(grid), laps: String(laps), status,
  });
  const lap = (n: number, ...ids: string[]) => ({ number: String(n), Timings: ids.map((driverId, i) => ({ driverId, position: String(i + 1), time: '1:40.000' })) });
  // Three laps: Verstappen from pole leads two and loses the lead on the third, Leclerc from second; Hülkenberg from
  // the pit lane runs two and retires.
  const results = answer({
    Results: [result('leclerc', 'Charles', 'Leclerc', 2, 3), result('max_verstappen', 'Max', 'Verstappen', 1, 3), result('hulkenberg', 'Nico', 'Hülkenberg', 0, 2, 'Retired')],
  });
  const laps = [lap(1, 'max_verstappen', 'leclerc', 'hulkenberg'), lap(2, 'max_verstappen', 'leclerc', 'hulkenberg'), lap(3, 'leclerc', 'max_verstappen')];
  // Jolpica's pit stops: Verstappen stopped on lap 2, Leclerc on laps 1 and 2.
  const stop = (driverId: string, n: number, lapNo: number) => ({ driverId, lap: String(lapNo), stop: String(n), time: '15:00:00', duration: '22.100' });
  const stops = [answer({ PitStops: [stop('leclerc', 1, 1), stop('max_verstappen', 1, 2), stop('leclerc', 2, 2)] }, 3)];

  it('keeps each driver of the result with the grid slot, the pit lane as 0, the place at the end of each lap and its stops', () => {
    expect(raceLaps(results, [answer({ Laps: laps }, 8)], stops)).toEqual({
      laps: 3,
      drivers: [['Charles Leclerc', 2, '2.2.1', '1.2'], ['Max Verstappen', 1, '1.1.2', '2'], ['Nico Hülkenberg', 0, '3.3', '']],
      complete: true,
      why: '',
    });
  });

  it('reads a lap split across two pages, as Jolpica splits them at 100 timings', () => {
    const split = [answer({ Laps: [laps[0], { ...laps[1], Timings: laps[1].Timings.slice(0, 1) }] }, 8), answer({ Laps: [{ ...laps[1], Timings: laps[1].Timings.slice(1) }, laps[2]] }, 8)];
    expect(raceLaps(results, split, stops).complete).toBe(true);
    expect(raceLaps(results, split, stops).drivers[1]).toEqual(['Max Verstappen', 1, '1.1.2', '2']);
  });

  it('keeps the places a penalty lap left past a driver’s result: Sainz in Britain, 52 laps run, classified a lap down', () => {
    // Hülkenberg ran all three laps on the road, but his result counts two.
    const penalty = [lap(1, 'max_verstappen', 'leclerc', 'hulkenberg'), lap(2, 'max_verstappen', 'leclerc', 'hulkenberg'), lap(3, 'leclerc', 'max_verstappen', 'hulkenberg')];
    const lapped = answer({ Results: [result('leclerc', 'Charles', 'Leclerc', 2, 3), result('max_verstappen', 'Max', 'Verstappen', 1, 3), result('hulkenberg', 'Nico', 'Hülkenberg', 0, 2, 'Lapped')] });
    expect(raceLaps(lapped, [answer({ Laps: penalty }, 9)], stops)).toMatchObject({ laps: 3, complete: true });
    expect(raceLaps(lapped, [answer({ Laps: penalty }, 9)], stops).drivers[2]).toEqual(['Nico Hülkenberg', 0, '3.3.3', '']);
  });

  it('calls the laps incomplete for a page missing, a place doubled, a driver short of laps or a driver it cannot name', () => {
    expect(raceLaps(results, [answer({ Laps: laps.slice(0, 2) }, 8)], stops)).toMatchObject({ complete: false, why: '6 of 8 timings' });
    const doubled = { number: '2', Timings: [{ driverId: 'max_verstappen', position: '1' }, { driverId: 'leclerc', position: '1' }, { driverId: 'hulkenberg', position: '3' }] };
    expect(raceLaps(results, [answer({ Laps: [laps[0], doubled, laps[2]] }, 8)], stops)).toMatchObject({ complete: false, why: 'lap 2 holds places 1,1,3' });
    const short = answer({ Results: [result('leclerc', 'Charles', 'Leclerc', 2, 3), result('max_verstappen', 'Max', 'Verstappen', 1, 3), result('hulkenberg', 'Nico', 'Hülkenberg', 0, 3, 'Lapped')] });
    expect(raceLaps(short, [answer({ Laps: laps }, 8)], stops)).toMatchObject({ complete: false, why: 'Nico Hülkenberg has 2 places for 3 laps' });
    // A lap missing before the last is a gap, though the count of places would do.
    const holed = [answer({ Laps: [lap(1, 'max_verstappen', 'leclerc'), lap(2, 'max_verstappen', 'leclerc', 'hulkenberg'), lap(3, 'leclerc', 'max_verstappen', 'hulkenberg')] }, 8)];
    expect(raceLaps(results, holed, stops)).toMatchObject({ complete: false, why: 'Nico Hülkenberg has no place on lap 1' });
    const stranger = [answer({ Laps: [...laps.slice(0, 2), lap(3, 'leclerc', 'max_verstappen', 'bottas')] }, 9)];
    expect(raceLaps(results, stranger, stops)).toMatchObject({ complete: false, why: 'laps for bottas, who is not in the result' });
    expect(raceLaps(answer({ Results: [] }), [answer({ Laps: laps }, 8)], stops)).toMatchObject({ complete: false, why: 'no result' });
    expect(raceLaps(results, [answer({ Laps: [] }, 0)], stops)).toMatchObject({ complete: false, why: 'no laps' });
    expect(raceLaps(results, [], stops)).toMatchObject({ complete: false, why: 'no laps' });
  });

  it('calls the race incomplete until its pit stops are listed whole', () => {
    expect(raceLaps(results, [answer({ Laps: laps }, 8)], [])).toMatchObject({ complete: false, why: 'no pit stops yet' });
    expect(raceLaps(results, [answer({ Laps: laps }, 8)], [{ MRData: { total: '0', RaceTable: { Races: [] } } }])).toMatchObject({ complete: false, why: 'no pit stops yet' });
    expect(raceLaps(results, [answer({ Laps: laps }, 8)], [answer({ PitStops: [stop('leclerc', 1, 1)] }, 3)])).toMatchObject({ complete: false, why: '1 of 3 pit stops' });
    expect(raceLaps(results, [answer({ Laps: laps }, 8)], [answer({ PitStops: [stop('bottas', 1, 1)] }, 1)])).toMatchObject({ complete: false, why: 'pit stops for bottas, who is not in the result' });
  });

  it('asks for the races classified this season and not yet whole, a miss after its next ask, the newest first', () => {
    const race = (round: number, date: string, label = 'Race'): ResultRound => ({ round, name: `Round ${round}`, date, sessions: [{ label, tables: [{ title: '', columns: ['Pos', 'Driver'], rows: [['1', 'Max Verstappen']] }] }] });
    const rounds = [race(1, '2026-03-08'), race(2, '2026-03-15'), race(3, '2026-03-29'), race(4, '2026-05-02', 'Sprint'), race(5, '2026-05-24'), race(6, '2025-06-01')];
    const whole: RaceLaps = { laps: 3, at: '2026-10-25T09:00:00.000Z', drivers: [] };
    const store: LapsStore = {
      '2026': { '1': whole, '2': { miss: '2026-10-25T08:00:00.000Z', next: '2026-10-25T10:00:00.000Z' }, '3': { miss: '2026-10-24T08:00:00.000Z', next: '2026-10-25T08:00:00.000Z' } },
    };
    const now = new Date('2026-10-25T09:00:00Z');
    expect(lapsDue(rounds, store, 2026, now)).toEqual([5, 3]);
    expect(lapsDue(rounds, store, 2026, new Date('2026-10-25T10:00:00Z'))).toEqual([5, 3, 2]);
    // The first fill: every race classified this season; a whole race is never asked again.
    expect(lapsDue(rounds, {}, 2026, now)).toEqual([5, 3, 2, 1]);
    expect(isRaceLaps(whole)).toBe(true);
    expect(isRaceLaps(store['2026']['2'])).toBe(false);
  });
});

describe('latestRace', () => {
  it("is the newest round's last race", () => {
    const rounds: ResultRound[] = [
      { round: 1, name: 'One', date: '2026-03-01', sessions: [{ label: 'Race', tables: [] }] },
      { round: 2, name: 'Two', date: '2026-04-12', sessions: [{ label: 'Sprint', tables: [] }, { label: 'Grand Prix', tables: [] }] },
    ];
    expect(latestRace(rounds)).toMatchObject({ round: { name: 'Two' }, session: { label: 'Grand Prix' } });
    expect(latestRace([])).toBeNull();
  });
});

describe('calendarEntries', () => {
  const session = (title: string, start: string, extra: Partial<Session> = {}): Session => ({
    uid: title + start,
    seriesSlug: 'f1',
    title,
    start: new Date(start),
    end: new Date(Date.parse(start) + 3_600_000),
    location: 'Albert Park Circuit, Melbourne',
    ...extra,
  });

  it('names each session by its round and drops the series prefix, sorted by start', () => {
    const series: Pick<Series, 'sessions' | 'rounds'> = {
      sessions: [
        session('F1 - Race', '2026-03-08T04:00:00Z'),
        session('F1 - Practice 1', '2026-03-06T01:30:00Z'),
        session('Pre-season test', '2026-02-20T08:00:00Z', { location: 'Sakhir', dateOnly: true }),
      ],
      rounds: { season: 2026, rounds: [{ round: 1, startDate: '2026-03-06', endDate: '2026-03-08', name: 'Australian Grand Prix' }] },
    };
    const entries = calendarEntries(series, new Date('2026-03-01T00:00:00Z'));
    expect(entries.map(e => [e.session, e.event, e.round, e.dateOnly])).toEqual([
      ['Pre-season test', 'Sakhir', null, true],
      ['Practice 1', 'Australian Grand Prix', 1, false],
      ['Race', 'Australian Grand Prix', 1, false],
    ]);
    expect(entries[1]).toMatchObject({ start: '2026-03-06T01:30:00.000Z', end: '2026-03-06T02:30:00.000Z' });
    expect(entries[1].location).toBe('Albert Park Circuit, Melbourne');
  });
});

describe('whenCells', () => {
  it('prints UTC and Athens, across the change of day and of summer time', () => {
    expect(whenCells({ start: '2026-10-24T22:30:00.000Z', dateOnly: false })).toEqual(['Sat 24 Oct, 22:30', 'Sun 25 Oct, 01:30']);
    expect(whenCells({ start: '2026-10-25T14:00:00.000Z', dateOnly: false })).toEqual(['Sun 25 Oct, 14:00', 'Sun 25 Oct, 16:00']);
    expect(whenCells({ start: '2026-10-25T00:00:00.000Z', dateOnly: true })).toEqual(['Sun 25 Oct, time TBC', '']);
  });
});

describe('tableBlock', () => {
  it('escapes every cell and writes our own links', () => {
    const html = tableBlock(['Pos', 'Name'], [['1', '<script>alert(1)</script>'], ['2', { text: 'F1 & co', href: '/series/f1/' }]]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('<a href="/series/f1/">F1 &amp; co</a>');
    expect(html.startsWith('<!-- wp:table {"hasFixedLayout":false} -->')).toBe(true);
  });
});

describe('seriesPages', () => {
  const calendar = [{ start: '2026-10-25T20:00:00.000Z', end: '2026-10-25T22:00:00.000Z', dateOnly: false, event: 'United States Grand Prix', session: 'Race', round: 19 }];

  it('writes no page for a feed without data', () => {
    const pages = seriesPages({ slug: 'nls', name: 'NLS', standings: null, results: null, calendar }, new Date('2026-10-20T00:00:00Z'));
    expect(pages.map(p => p.path)).toEqual(['/series/nls/', '/series/nls/calendar/']);
    expect(pages[0].body).not.toContain('Full standings');
    expect(seriesPages({ slug: 'x', name: 'X', standings: null, results: null, calendar: null }, new Date())).toEqual([]);
  });

  it("lists a series' next sessions, then hides them once they are over", () => {
    const d = { slug: 'f1', name: 'Formula 1', standings: null, results: null, calendar };
    expect(seriesPages(d, new Date('2026-10-20T00:00:00Z'))[0].body).toContain('United States Grand Prix');
    expect(seriesPages(d, new Date('2026-10-26T00:00:00Z'))[0].body).toContain('No sessions are scheduled.');
  });
});

describe('calendarMonthPages', () => {
  const at = (start: string, session: string, round = 18, dateOnly = false): CalendarEntry => ({
    start,
    end: new Date(Date.parse(start) + 3_600_000).toISOString(),
    dateOnly,
    event: 'United States Grand Prix',
    session,
    round,
  });
  const f1: SeriesData = {
    slug: 'f1',
    name: 'Formula 1',
    short: 'F1',
    order: 1,
    standings: null,
    results: null,
    calendar: [
      at('2026-10-23T17:30:00.000Z', 'Practice 1'),
      at('2026-10-24T21:00:00.000Z', 'Qualifying'),
      at('2026-10-25T20:00:00.000Z', 'Race'),
      at('2026-11-02T00:30:00.000Z', 'Race', 19),
    ],
    rounds: [
      { round: 18, name: 'United States Grand Prix', startDate: '2026-10-23', endDate: '2026-10-25', venue: 'Circuit of the Americas' },
      { round: 19, name: 'Mexico City Grand Prix', startDate: '2026-10-30', endDate: '2026-11-01', venue: null },
    ],
  };
  const now = new Date('2026-10-20T12:00:00Z');
  const pages = calendarMonthPages([f1], now);
  const october = pages.find(p => p.path === '/calendar/2026-10/')!;

  it("names each chip's series in full, for the Calendar tab's notice", () => {
    expect(october.body).toContain('<span class="pd-cal-chip pd-s-f1" data-s="f1" data-name="Formula 1">F1</span>');
    const odd = calendarMonthPages([{ ...f1, name: 'F<1> "x"' }], now)[0].body;
    expect(odd).toContain('data-name="F&lt;1&gt; &quot;x&quot;"');
  });

  it('writes /calendar/ as this month, then every month the data reaches, on the wide template', () => {
    expect(pages.map(p => p.path)).toEqual(['/calendar/', '/calendar/2026-10/', '/calendar/2026-11/']);
    expect(pages[0].body).toBe(october.body);
    expect(pages.map(p => p.title)).toEqual(['Calendar', 'Calendar · October 2026', 'Calendar · November 2026']);
    expect(pages.every(p => p.template === 'page-wide')).toBe(true);
    expect(october.body.startsWith('<!-- wp:html -->')).toBe(true);
  });

  it('heads the page with its month and names the months either side, none past the last', () => {
    expect(october.body).toContain('<h1 class="pd-cal-h1"><small>Calendar</small> October <span>2026</span></h1>');
    expect(october.body).toContain(
      '<nav class="pd-cal-month" aria-label="Months"><a class="pd-cal-step" rel="next" href="/calendar/2026-11/" aria-label="Next month: November 2026"><span class="pd-cal-full">November</span><span class="pd-cal-short">Nov</span><i aria-hidden="true">›</i></a></nav>',
    );
    expect(pages[2].body).toContain(
      '<nav class="pd-cal-month" aria-label="Months"><a class="pd-cal-step" rel="prev" href="/calendar/2026-10/" aria-label="Previous month: October 2026"><i aria-hidden="true">‹</i><span class="pd-cal-full">October</span><span class="pd-cal-short">Oct</span></a></nav>',
    );
  });

  it('puts each session in its UTC day, marks race, sprint and qualifying, and prints UTC', () => {
    const cell = (day: string) => october.body.split(`<div class="pd-cal-ses pd-c`).find(c => c.startsWith(`${c[0]}" data-date="${day}">`)) ?? '';
    expect(cell('2026-10-24')).toContain('<b>F1 Qualifying</b>');
    expect(cell('2026-10-24')).toContain('data-kind="qualifying"');
    expect(cell('2026-10-23')).toContain('data-kind="practice"');
    expect(cell('2026-10-24')).toContain('data-f="t">21:00</span>');
    expect(october.body).toContain('Times in UTC');
  });

  it('holds a session just past the grid in the spill, for a reader whose day brings it in', () => {
    expect(october.body).toMatch(/<div class="pd-cal-spill" hidden>.*F1 Race.*2026-11-02T00:30/);
  });

  it('draws each round as a band across its days, split where a week ends', () => {
    expect(october.body).toContain(
      '<span class="pd-cal-band pd-s-f1 pd-c5 pd-w3 pd-r1" data-s="f1" data-from="2026-10-23" data-to="2026-10-25">F1 · United States GP · <span class="pd-cal-race">Race <span class="pd-t" data-utc="2026-10-25T20:00:00.000Z" data-f="wt">Sun 20:00</span></span></span>',
    );
    expect(pages[2].body).toContain('pd-c5 pd-w3 pd-r1" data-s="f1" data-from="2026-10-30" data-to="2026-11-01">F1 · Mexico City GP · <span class="pd-cal-race">Race <span class="pd-t" data-utc="2026-11-02T00:30:00.000Z" data-f="wt">Mon 00:30</span></span></span>');
  });

  it("ends each band with its round's last race, by its own name only when that says race", () => {
    const october = (...calendar: CalendarEntry[]) => calendarMonthPages([{ ...f1, calendar }], now)[0].body;
    expect(october(at('2026-10-24T22:00:00.000Z', 'Sprint'), at('2026-10-25T20:00:00.000Z', 'Race'))).toContain(
      'F1 · United States GP · <span class="pd-cal-race">Race <span class="pd-t" data-utc="2026-10-25T20:00:00.000Z" data-f="wt">Sun 20:00</span>',
    );
    expect(october(at('2026-10-25T09:00:00.000Z', 'Feature Race'), at('2026-10-24T14:00:00.000Z', 'Sprint Race'))).toContain('<span class="pd-cal-race">Feature Race <span');
    expect(october(at('2026-10-25T19:00:00.000Z', 'YellaWood 500'))).toContain('<span class="pd-cal-race">Race <span');
    expect(october(at('2026-10-25T12:00:00.000Z', 'Race 4h (NLS4 ADAC 24h Qualifiers)'))).toContain('<span class="pd-cal-race">Race 4h <span');
    expect(october(at('2026-10-25T14:00:00.000Z', 'Race (London R17) — Season Finale'))).toContain('<span class="pd-cal-race">Race <span');
    for (const split of ['Race - Season Finale', 'Race – Season Finale', 'Race: Season Finale']) {
      expect(october(at('2026-10-25T14:00:00.000Z', split))).toContain('<span class="pd-cal-race">Race <span');
    }
    expect(october(at('2026-10-25T14:00:00.000Z', 'Sprint-Race'))).toContain('<span class="pd-cal-race">Sprint-Race <span');
    expect(october(at('2026-10-25T20:00:00.000Z', 'Race <2>'))).toContain('<span class="pd-cal-race">Race &lt;2&gt; <span');
    expect(october(at('2026-10-25T00:00:00.000Z', 'Race', 18, true), at('2026-10-24T21:00:00.000Z', 'Qualifying'))).toContain('F1 · United States GP</span>');
  });

  it('gives a rally its Power Stage, and nothing while the stages are untimed', () => {
    const rally = (...calendar: CalendarEntry[]) => calendarMonthPages([{ ...f1, slug: 'wrc', short: 'WRC', calendar }], now)[0].body;
    const stages = [at('2026-10-25T10:00:00.000Z', 'SS19 Alan / Senj 2 - Wolf Power Stage (Croatia)'), at('2026-10-25T07:00:00.000Z', 'SS18 Alan / Senj 1 (Croatia)')];
    expect(rally(...stages, at('2026-10-25T12:00:00.000Z', 'Podium'))).toContain(
      'WRC · United States GP · <span class="pd-cal-race">Power Stage <span class="pd-t" data-utc="2026-10-25T10:00:00.000Z" data-f="wt">Sun 10:00</span>',
    );
    expect(rally(stages[1])).toContain('WRC · United States GP</span>');
  });

  it('cards each weekend with its host and its sessions by day', () => {
    expect(october.body).toContain('<div class="pd-cal-wkend" data-from="2026-10-23" data-to="2026-10-25"><h2 class="pd-cal-wkh"><span>23–25 October</span>');
    expect(october.body).toContain('<small>Formula 1 · Round 18</small><b>United States Grand Prix</b><span>Circuit of the Americas</span>');
    expect(october.body).toContain('3 sessions · <span data-pd-zonename>UTC</span>');
    expect(october.body).toContain('<span>30 October – 1 November</span>');
  });

  it("opens a Formula 1 weekend's page from its card, once the season is known (O19)", () => {
    expect(october.body).not.toContain('Weekend page');
    const seasoned = calendarMonthPages([{ ...f1, season: 2026 }], now)[0].body;
    expect(seasoned).toContain('3 sessions · <span data-pd-zonename>UTC</span></span><a href="/series/f1/2026/round-18/">Weekend page →</a></footer>');
    expect(calendarMonthPages([{ ...f1, slug: 'f2', season: 2026 }], now)[0].body).not.toContain('Weekend page');
  });

  it('escapes what the feeds say', () => {
    const odd: SeriesData = { ...f1, calendar: [at('2026-10-24T21:00:00.000Z', '<img src=x onerror=alert(1)>')], rounds: [] };
    const body = calendarMonthPages([odd], now)[0].body;
    expect(body).not.toContain('<img');
    expect(body).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('says so when a month has no race weekend', () => {
    const quiet: SeriesData = { ...f1, calendar: [], rounds: [] };
    expect(calendarMonthPages([quiet], now)[0].body).toContain('No race weekends this month.');
  });

  it('sorts sessions into practice, qualifying and race for the Sessions filter', () => {
    expect(['Practice 1', 'FP2', 'Warm Up', 'Bronze Test', 'Free Practice 1'].map(sessionKind)).toEqual(Array(5).fill('practice'));
    expect(['Qualifying', 'Q2', 'Sprint Qualifying', 'Sprint Shootout', 'Superpole', 'Hyperpole'].map(sessionKind)).toEqual(Array(6).fill('qualifying'));
    expect(['Race', 'Sprint', 'Superpole Race', 'Race 2', 'YellaWood 500', '3 Hours of Portimão (Race)'].map(sessionKind)).toEqual(Array(6).fill('race'));
    expect(['Race 4h (NLS4 ADAC 24h Qualifiers — Saturday evening)', 'Freedom 100', 'Race (London R17) — Season Finale'].map(sessionKind)).toEqual(Array(3).fill('race'));
    expect(['Indianapolis 500 Firestone Fast Six', '24h Top Qualifying (NLS5 ADAC 24h Qualifiers)'].map(sessionKind)).toEqual(Array(2).fill('qualifying'));
    expect(['Nürburgring Scrutineering (Thu)', 'Ceremonial Start Jyväskylä (Finland)', 'Free Training (NLS1 71st ADAC Westfalenfahrt)', 'Nürburgring Pit Walk / Track Walk'].map(sessionKind)).toEqual(Array(4).fill('practice'));
  });

  it('gives a week at most the twelve rows style.css draws, however many rounds overlap', () => {
    const busy = (n: number): SeriesData[] =>
      Array.from({ length: n }, (_, i) => ({ ...f1, slug: `s${i}`, name: `S${i}`, short: `S${i}`, calendar: [], rounds: [{ round: 1, name: 'R', startDate: '2026-10-23', endDate: '2026-10-25', venue: null }] }));
    expect(calendarMonthPages(busy(12), now)[0].body).toContain('<div class="pd-cal-wk pd-b12">');
    const thirteen = calendarMonthPages(busy(13), now)[0].body;
    expect(thirteen).toContain('<div class="pd-cal-wk pd-b12">');
    expect(thirteen).not.toMatch(/pd-[rb]13/);
    expect(thirteen.match(/pd-r12"/g)).toHaveLength(2);
  });

  it("names a band shortly: GP, NASCAR's track, no trailing Round", () => {
    expect(bandLabel('f1', 'Bahrain Grand Prix')).toBe('Bahrain GP');
    expect(bandLabel('nascar-cup', 'Bank of America 400 (Charlotte oval)')).toBe('Charlotte');
    expect(bandLabel('dtm', 'Hockenheimring Round')).toBe('Hockenheimring');
  });
});

describe('onlyFamily', () => {
  const page = (path: string): Page => ({ path, title: path, body: '' });
  const all = ['/series/', '/series/f1/', '/series/f1/standings/', '/series/f2/', '/calendar/', '/calendar/2026-10/', '/status/'].map(page);
  const paths = (prefix: string) => onlyFamily(all, prefix).map(p => p.path);

  it('brings the pages above a family along, so each has its parent', () => {
    expect(paths('/series/f1/')).toEqual(['/series/', '/series/f1/', '/series/f1/standings/']);
    expect(paths('/series/f1/standings/')).toEqual(['/series/', '/series/f1/', '/series/f1/standings/']);
  });

  it('adds nothing beside the family, and nothing when the prefix matches nothing', () => {
    expect(paths('/calendar/')).toEqual(['/calendar/', '/calendar/2026-10/']);
    expect(paths('/nowhere/')).toEqual([]);
  });

  it('takes several families separated by commas, each with its parents', () => {
    expect(paths('/calendar/,/series/f1/')).toEqual(['/series/', '/series/f1/', '/series/f1/standings/', '/calendar/', '/calendar/2026-10/']);
    expect(paths('/status/,/nowhere/')).toEqual(['/status/']);
  });
});

describe('planSync', () => {
  const page = (path: string, title = path): Page => ({ path, title, body: `<p>${title}</p>` });

  it('creates, updates only its own pages, leaves anything else alone, parents first', () => {
    const series = page('/series/');
    const calendar = page('/calendar/');
    const f1 = page('/series/f1/');
    const standings = page('/series/f1/standings/');
    const existing: WpPageRow[] = [
      { id: 1, slug: 'series', parent: 0, status: 'publish', content: withMarker(series.body, hashOf(series), '/series/') },
      { id: 2, slug: 'f1', parent: 1, status: 'publish', content: '<p>written by hand</p>' },
      { id: 3, slug: 'calendar', parent: 0, status: 'publish', content: withMarker('<p>old</p>', 'a'.repeat(64), '/calendar/') },
    ];
    const steps = planSync([standings, f1, calendar, series], existing);
    expect(steps.map(s => [s.kind, s.page.path])).toEqual([
      ['update', '/calendar/'],
      ['same', '/series/'],
      ['conflict', '/series/f1/'],
      ['create', '/series/f1/standings/'],
    ]);
  });

  it('finds its own page where WordPress gave it another slug, and never creates it twice', () => {
    const status = page('/status/');
    const existing: WpPageRow[] = [{ id: 7, slug: 'status-2', parent: 0, status: 'publish', content: withMarker(status.body, hashOf(status), '/status/') }];
    expect(planSync([status], existing)).toEqual([{ kind: 'same', id: 7, page: status, at: '/status-2/' }]);
  });

  it('counts a page as its own only when the marker opens it', () => {
    const calendar = page('/calendar/');
    const quoted = `<p>Our pages begin with ${withMarker('', hashOf(calendar), '/calendar/')}</p>`;
    expect(MARKER.test(quoted)).toBe(false);
    expect(planSync([calendar], [{ id: 4, slug: 'calendar', parent: 0, status: 'publish', content: quoted }])[0].kind).toBe('conflict');
  });

  it('hashes the title with the body, so a new title is an update', () => {
    expect(hashOf({ title: 'A', body: 'x' })).not.toBe(hashOf({ title: 'B', body: 'x' }));
  });

  it('adds the template to the hash only when a page names one', () => {
    expect(hashOf({ title: 'A', body: 'x', template: 'page-wide' })).not.toBe(hashOf({ title: 'A', body: 'x' }));
    expect(hashOf({ title: 'A', body: 'x', template: undefined })).toBe(hashOf({ title: 'A', body: 'x' }));
    // sha256("A\nx"): the hash every published page was written with, before templates.
    expect(hashOf({ title: 'A', body: 'x' })).toBe('87c7567107483d30d6903f5370fffee21ec5dc1ffff3cc05fa141eb1fa2fee2e');
  });
});

describe('wpPaths', () => {
  it('builds paths from the slug chain and leaves out a page whose parent is missing', () => {
    const paths = wpPaths([
      { id: 1, slug: 'series', parent: 0, status: 'publish', content: '' },
      { id: 2, slug: 'f1', parent: 1, status: 'draft', content: '' },
      { id: 3, slug: 'orphan', parent: 99, status: 'publish', content: '' },
    ]);
    expect([...paths.keys()]).toEqual(['/series/', '/series/f1/']);
  });
});
