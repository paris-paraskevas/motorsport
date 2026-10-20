import { describe, it, expect } from 'vitest';
import type { Series, Session } from '../types';
import {
  bandLabel,
  calendarEntries,
  calendarMonthPages,
  escapeHtml,
  hashOf,
  latestRace,
  MARKER,
  planSync,
  resultRounds,
  seriesPages,
  sessionKind,
  splitRaceName,
  standingsTables,
  tableBlock,
  whenCells,
  withMarker,
  wpPaths,
  type CalendarEntry,
  type Page,
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
  it('turns a newest-first feed into rounds oldest first, sprint before the main race, top ten classified', () => {
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
    expect(main.rows).toHaveLength(10);
  });

  it("joins F1's Grand Prix list and sprint list into one round", () => {
    const [round] = resultRounds('f1', {
      races: [{ round: 6, raceName: 'Miami Grand Prix', date: '2026-05-03T00:00:00.000Z', circuit: 'Miami', results: [entry(1, 'Winner', { time: '1:30:00.000' })] }],
      sprints: [{ round: 6, raceName: 'Miami Grand Prix', date: '2026-05-02T00:00:00.000Z', circuit: 'Miami', results: [entry(1, 'Sprinter')] }],
    });
    expect(round.name).toBe('Miami Grand Prix');
    expect(round.sessions.map(s => s.label)).toEqual(['Sprint', 'Race']);
    expect(round.sessions[1].tables[0].rows[0]).toEqual(['1', 'Winner', 'Team', '1:30:00.000', '25']);
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

  it('writes /calendar/ as this month, then every month the data reaches, on the wide template', () => {
    expect(pages.map(p => p.path)).toEqual(['/calendar/', '/calendar/2026-10/', '/calendar/2026-11/']);
    expect(pages[0].body).toBe(october.body);
    expect(pages.map(p => p.title)).toEqual(['Calendar', 'Calendar · October 2026', 'Calendar · November 2026']);
    expect(pages.every(p => p.template === 'page-wide')).toBe(true);
    expect(october.body.startsWith('<!-- wp:html -->')).toBe(true);
  });

  it('links the months either side, and none past the last', () => {
    expect(october.body).toContain('<a href="/calendar/2026-11/" aria-label="Next month: November 2026">›</a>');
    expect(october.body).toContain('<span aria-hidden="true">‹</span>');
    expect(pages[2].body).toContain('<a href="/calendar/2026-10/" aria-label="Previous month: October 2026">‹</a>');
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
    expect(october.body).toContain('<span class="pd-cal-band pd-s-f1 pd-c5 pd-w3 pd-r1" data-s="f1" data-from="2026-10-23" data-to="2026-10-25">F1 · United States GP</span>');
    expect(pages[2].body).toContain('pd-c5 pd-w3 pd-r1" data-s="f1" data-from="2026-10-30" data-to="2026-11-01">F1 · Mexico City GP</span>');
  });

  it('cards each weekend with its host and its sessions by day', () => {
    expect(october.body).toContain('<div class="pd-cal-wkend" data-from="2026-10-23" data-to="2026-10-25"><h2 class="pd-cal-wkh"><span>23–25 October</span>');
    expect(october.body).toContain('<small>Formula 1 · Round 18</small><b>United States Grand Prix</b><span>Circuit of the Americas</span>');
    expect(october.body).toContain('3 sessions · <span data-pd-zonename>UTC</span>');
    expect(october.body).toContain('<span>30 October – 1 November</span>');
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

  it('draws up to twelve overlapping rounds in a week, and refuses a thirteenth rather than overlap the sessions', () => {
    const busy = (n: number): SeriesData[] =>
      Array.from({ length: n }, (_, i) => ({ ...f1, slug: `s${i}`, name: `S${i}`, short: `S${i}`, calendar: [], rounds: [{ round: 1, name: 'R', startDate: '2026-10-23', endDate: '2026-10-25', venue: null }] }));
    expect(calendarMonthPages(busy(12), now)[0].body).toContain('<div class="pd-cal-wk pd-b12">');
    expect(() => calendarMonthPages(busy(13), now)).toThrow(/13 overlapping rounds/);
  });

  it("names a band shortly: GP, NASCAR's track, no trailing Round", () => {
    expect(bandLabel('f1', 'Bahrain Grand Prix')).toBe('Bahrain GP');
    expect(bandLabel('nascar-cup', 'Bank of America 400 (Charlotte oval)')).toBe('Charlotte');
    expect(bandLabel('dtm', 'Hockenheimring Round')).toBe('Hockenheimring');
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
