import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ChampionNotesFile } from '../series-content';
import type { Champion } from '../types';
import type { FomResultRow } from '../results/fom-api';
import {
  answered,
  datedByLastDay,
  DTM_QUALIFYING_POINTS,
  dtmAsk,
  dtmEvents,
  dtmPageCode,
  dtmQualifyingPoints,
  dtmRead,
  dtmRows,
  dtmSessions,
  dtmShown,
  dtmTable,
  dtmTime,
  dtmWanted,
  dtmWinnersTimes,
  fomQualifyingLabel,
  fomTable,
  foldName,
  groupsGrid,
  initialsSpeller,
  multiRaceKit,
  multiRaceLeft,
  multiRaceWins,
  raceName,
  roundOver,
  roundPoints,
  sessionNone,
  sessionsWanted,
  spelledAsRoster,
  timedTable,
  unitsOf,
  unitStates,
  wsbkCarried,
  wsbkDue,
  wsbkHeld,
  wsbkMs,
  wsbkPoints,
  wsbkRaceTable,
  wsbkReclassified,
  wsbkScored,
  wsbkTimedTable,
  type DtmGroups,
  type RosterTeam,
} from './multi-race';
import { calledOffOf, padHour, siteOf, type CalendarEntry, type CalendarRound, type Page, type ResultRound, type SeriesData, type Table } from './render';
import { seriesFamily } from './series';
import { weekendOf } from './weekend';

// Rows as FOM's API wrote them for Formula 2's 2026 sessions (probed 12 Nov 2026): a placed driver, a "666" with
// "NC" and a slow lap (Boya, Melbourne qualifying), a "666" with "NC" and no time (Varrone, Madrid qualifying), and a
// "66666" with "DQ" (Montoya, round 7 practice); practice writes the gap behind its leader as the time.
const row = (o: Partial<FomResultRow>): FomResultRow => ({ driverFirstName: 'A', driverLastName: 'B', teamName: 'T', ...o });

describe('family A: FOM sessions as tables (O33)', () => {
  it('places the classified in order, then the rest under the place FOM displays', () => {
    const t = fomTable('Qualifying', [
      row({ positionNumber: '666', displayPosition: 'NC', displayTime: '2:03.045', driverFirstName: 'Mari', driverLastName: 'Boya', teamName: 'PREMA Racing' }),
      row({ positionNumber: '2', displayPosition: '2', displayTime: '1:28.911', driverFirstName: 'Martinius', driverLastName: 'Stenshorne', teamName: 'Rodin Motorsport' }),
      row({ positionNumber: '1', displayPosition: '1', displayTime: '1:28.695', driverFirstName: 'Dino', driverLastName: 'Beganovic', teamName: 'DAMS Lucas Oil' }),
      row({ positionNumber: '666', displayPosition: 'NC', displayTime: '', driverFirstName: 'Nico', driverLastName: 'Varrone', teamName: 'Van Amersfoort Racing' }),
    ]);
    expect(t?.columns).toEqual(['Pos', 'Driver', 'Team', 'Time']);
    expect(t?.rows).toEqual([
      ['1', 'Dino Beganovic', 'DAMS Lucas Oil', '1:28.695'],
      ['2', 'Martinius Stenshorne', 'Rodin Motorsport', '1:28.911'],
      ['NC', 'Mari Boya', 'PREMA Racing', '2:03.045'],
      ['NC', 'Nico Varrone', 'Van Amersfoort Racing', ''],
    ]);
  });

  it("keeps practice's gaps as FOM writes them and its 66666 as DQ", () => {
    const t = fomTable('Practice', [
      row({ positionNumber: '1', displayTime: '1:42.065', driverFirstName: 'Alexander', driverLastName: 'Dunne' }),
      row({ positionNumber: '2', displayTime: '+0.071s', driverFirstName: 'Rafael', driverLastName: 'Câmara' }),
      row({ positionNumber: '66666', displayPosition: 'DQ', displayTime: '', driverFirstName: 'Sebastian', driverLastName: 'Montoya' }),
    ]);
    expect(t?.rows.map(r => [r[0], r[1], r[3]])).toEqual([
      ['1', 'Alexander Dunne', '1:42.065'],
      ['2', 'Rafael Câmara', '+0.071s'],
      ['DQ', 'Sebastian Montoya', ''],
    ]);
  });

  it('draws nothing from a session nobody was placed in', () => {
    expect(fomTable('Qualifying', [])).toBeNull();
    expect(fomTable('Qualifying', [row({ positionNumber: '666', displayPosition: 'NC' })])).toBeNull();
  });

  it("names a qualifying asked by number as the timetable does", () => {
    expect(fomQualifyingLabel('Qualifying A', 1)).toBe('Qualifying Group A');
    expect(fomQualifyingLabel('Group B - Qualifying', 2)).toBe('Qualifying Group B');
    expect(fomQualifyingLabel('Qualifying 1', 1)).toBe('Qualifying 1');
    expect(fomQualifyingLabel('Qualifying 2', 2)).toBe('Qualifying 2');
    expect(fomQualifyingLabel(undefined, 2)).toBe('Qualifying 2');
  });
});

describe("family A: MotoGP's and WorldSBK's timed sessions (O33)", () => {
  it('places riders by time, else gap, then the unplaced under their status', () => {
    const t = timedTable(
      'Q2',
      [
        { position: 2, driverName: 'Marco Bezzecchi', team: 'Aprilia Racing', gap: '+0.120' },
        { position: 1, driverName: 'Marc Marquez', team: 'Ducati Lenovo Team', time: '1:29.871' },
        { position: null, driverName: 'Jack Miller', team: 'Prima Pramac Yamaha MotoGP', status: 'DNS' },
      ],
      'Rider',
    );
    expect(t?.columns).toEqual(['Pos', 'Rider', 'Team', 'Time']);
    expect(t?.rows).toEqual([
      ['1', 'Marc Marquez', 'Ducati Lenovo Team', '1:29.871'],
      ['2', 'Marco Bezzecchi', 'Aprilia Racing', '+0.120'],
      ['DNS', 'Jack Miller', 'Prima Pramac Yamaha MotoGP', ''],
    ]);
  });
});

describe('family A: the sessions a run asks for (O33)', () => {
  const at = (round: number, session: string, end: string): CalendarEntry => ({ round, session, start: end, end, dateOnly: false, event: `Round ${round}` }) as CalendarEntry;
  const rounds = [{ round: 17, name: 'Indonesia', date: '2026-10-11', sessions: [], others: [{ label: 'FP1', tables: [] }] }] as ResultRound[];
  const now = new Date('2026-10-12T12:00:00Z');

  it('asks for ended sessions not yet held, the newest first, up to the cap', () => {
    const calendar = [at(17, 'FP1', '2026-10-10T02:00:00Z'), at(17, 'Q2', '2026-10-11T05:00:00Z'), at(17, 'Race', '2026-10-12T08:00:00Z'), at(18, 'FP1', '2026-10-12T11:30:00Z')];
    const names = new Set(['FP1', 'Q2']);
    expect(sessionsWanted(rounds, calendar, names, now, 20).map(e => `${e.round} ${e.session}`)).toEqual(['17 Q2']);
    expect(sessionsWanted(rounds, calendar, names, new Date('2026-10-12T13:00:00Z'), 20).map(e => `${e.round} ${e.session}`)).toEqual(['18 FP1', '17 Q2']);
    expect(sessionsWanted(rounds, calendar, names, new Date('2026-10-12T13:00:00Z'), 1)).toHaveLength(1);
  });
});

describe('family A: an answer, none, or no answer at all (O33)', () => {
  const table: Table = { title: 'Warm Up', columns: ['Pos', 'Rider', 'Team', 'Time'], rows: [['1', 'A', 'T', '1:30.000']] };

  it('tells an API that answered with none from a call that failed', () => {
    // A failed call reaches here as undefined: getJson's null, read as `c?.classification`.
    expect(answered(undefined, () => table)).toBeUndefined();
    expect(answered({ rows: [] }, () => table)).toBeUndefined();
    // MotoGP's Indonesian warm-up, 2026 (probed 17 Nov 2026): HTTP 200, `"classification": []`.
    expect(answered([], () => table)).toBeNull();
    expect(answered([{}], () => null)).toBeUndefined();
    expect(answered([{}], () => table)).toBe(table);
  });

  it('keeps "no classification" only for a finished session answered with none, once its round is over', () => {
    expect(sessionNone('FINISHED', null, true)).toBe('no classification');
    expect(sessionNone('FINISHED', undefined, true)).toBeUndefined();
    expect(sessionNone('FINISHED', null, false)).toBeUndefined();
    expect(sessionNone('NOT-STARTED', null, true)).toBeUndefined();
    expect(sessionNone('FINISHED', table, true)).toBeUndefined();
    expect(sessionNone('CANCELLED', undefined, false)).toBe('called off');
  });

  it('counts a round over a day after its last day', () => {
    expect(roundOver('2026-10-11', new Date('2026-10-12T23:00:00Z'))).toBe(false);
    expect(roundOver('2026-10-11', new Date('2026-10-13T00:00:00Z'))).toBe(true);
    expect(roundOver(null, new Date('2026-10-13T00:00:00Z'))).toBe(false);
  });
});

describe('family A: a round dated by its last day (O33)', () => {
  it('dates each round rounds.json names by its last day, and leaves the others as they are', () => {
    const rounds: ResultRound[] = [
      { round: 9, name: 'France', date: '2026-09-04', sessions: [] },
      { round: null, name: 'A test', date: '2026-01-10', sessions: [] },
      { round: 13, name: 'Not in rounds.json', date: null, sessions: [] },
    ];
    const got = datedByLastDay(rounds, [{ round: 9, endDate: '2026-09-06' }]);
    expect(got.map(r => r.date)).toEqual(['2026-09-06', '2026-01-10', null]);
    expect(got[1]).toBe(rounds[1]);
    expect(rounds[0].date).toBe('2026-09-04');
  });

  it("is the day WorldSBK's and DTM's timetables run each round's last race", async () => {
    const { readFileSync } = await import('node:fs');
    for (const slug of ['wsbk', 'dtm']) {
      const rounds = (JSON.parse(readFileSync(`content/series/${slug}/rounds.json`, 'utf8')) as { rounds: { round: number; endDate: string }[] }).rounds;
      const timetable = (JSON.parse(readFileSync(`content/series/${slug}/sessions.json`, 'utf8')) as { overrides: { round: number; sessions: { title: string; start: string }[] }[] }).overrides;
      const lastRace = timetable.flatMap(o => o.sessions.filter(s => /- Race 2$/.test(s.title)).map(s => [o.round, s.start.slice(0, 10)] as const));
      expect(lastRace.length).toBeGreaterThan(0);
      for (const [round, day] of lastRace) expect([slug, round, rounds.find(r => r.round === round)?.endDate]).toEqual([slug, round, day]);
    }
  });
});

describe("a round's called-off sessions, from rounds.json (O33)", () => {
  const source = 'https://www.motogp.com/en/news/2026/10/24/latest-motogp-phillip-island-track-activity-delayed/1180939';

  it('keeps each whole entry with an https source and leaves out the rest', () => {
    const note = 'The Grand Prix was called off: poor visibility for the medical helicopter.';
    expect(calledOffOf([{ session: 'Race', note, source }])).toEqual([{ session: 'Race', note, source }]);
    expect(calledOffOf([{ session: 'Race', note }, { session: 'Race', note, source: 'motogp.com' }, 'Race', null])).toEqual([]);
    expect(calledOffOf(undefined)).toEqual([]);
  });

  it("is in MotoGP's rounds.json for round 18 alone", async () => {
    const { readFileSync } = await import('node:fs');
    const file = JSON.parse(readFileSync('content/series/motogp/rounds.json', 'utf8')) as { rounds: { round: number; calledOff?: unknown }[] };
    const off = file.rounds.filter(r => calledOffOf(r.calledOff).length);
    expect(off.map(r => r.round)).toEqual([18]);
    expect(calledOffOf(off[0].calledOff)[0]).toMatchObject({ session: 'Race', source });
  });
});

describe("Formula 2's and 3's race times (O33)", () => {
  it('restores the zero FOM drops after the hour, and leaves every other time alone', () => {
    expect(padHour('1:3:29.190')).toBe('1:03:29.190');
    expect(padHour('1:0:19.442')).toBe('1:00:19.442');
    expect(padHour('1:11:45.095')).toBe('1:11:45.095');
    expect(padHour('47:21.330')).toBe('47:21.330');
    expect(padHour('+2.678s')).toBe('+2.678s');
    expect(padHour('DNF')).toBe('DNF');
  });
});

describe("DTM from motorsport.com's pages (O33)", () => {
  const fixture = async (name: string) => (await import('node:fs')).readFileSync(`tests/fixtures/${name}`, 'utf8');

  it("reads a race's rows in order, each with its own time, and keeps the disqualified car under the page's word", async () => {
    const rows = dtmRows(await fixture('dtm-oschersleben-race2-2026.html'));
    expect(rows[0]).toMatchObject({ pos: 'dq', name: 'M. Bortolotti', time: '57:30.754' });
    expect(rows[1]).toMatchObject({ pos: '1', name: 'M. Engel', team: 'Mercedes-AMG Team Winward', time: '57:33.781' });
    const t = dtmTable('Race 2', rows);
    expect(t?.rows[0].slice(0, 2)).toEqual(['1', 'M. Engel']);
    // The unplaced follow the placed in the page's order: the disqualified winner first, then the retirements.
    const first = t?.rows.findIndex(r => !/^\d+$/.test(r[0])) ?? -1;
    expect(t?.rows[first].slice(0, 2)).toEqual(['DQ', 'M. Bortolotti']);
    expect(t?.rows.slice(0, first).every(r => /^\d+$/.test(r[0]))).toBe(true);
  });

  it("gives qualifying's top three their 3, 2 and 1, with colons in the times", async () => {
    const t = dtmTable('Qualifying 2', dtmRows(await fixture('dtm-hockenheim-q2-2026.html')), DTM_QUALIFYING_POINTS);
    expect(t?.columns).toEqual(['Pos', 'Driver', 'Team', 'Time', 'Pts']);
    expect(t?.rows.slice(0, 4).map(r => [r[0], r[1], r[3], r[4]])).toEqual([
      ['1', 'B. Buus', '1:36.923', '3'],
      ['2', 'R. Feller', '1:36.929', '2'],
      ['3', 'M. Engel', '1:37.051', '1'],
      ['4', t?.rows[3][1], t?.rows[3][3], ''],
    ]);
  });

  it("lists a grouped weekend's sessions: four qualifying groups and two grids", async () => {
    const st = dtmSessions(await fixture('dtm-norisring-q3-2026.html'));
    expect(st).toEqual(expect.arrayContaining(['FP1', 'FP2', 'Q1', 'Q2', 'Q3', 'Q4', 'GRID1', 'GRID2', 'RACE1', 'RACE2']));
    expect(dtmRows(await fixture('dtm-norisring-q3-2026.html'))[0]).toMatchObject({ pos: '1', name: 'N. Thiim', time: '48.583' });
  });

  it('writes minutes with colons', () => {
    expect(dtmTime("1:50'55.938")).toBe('1:50:55.938');
    expect(dtmTime("+1'00.591")).toBe('+1:00.591');
    expect(dtmTime('+3.027')).toBe('+3.027');
  });

  it("spells motorsport.com's initials as drivers.json does, and leaves a name it cannot place alone", async () => {
    const file = JSON.parse(await fixture('../../content/series/dtm/drivers.json')) as { teams: { drivers: { name: string; also?: string[] }[] }[] };
    const spell = initialsSpeller(file.teams.flatMap(t => t.drivers));
    expect(spell('M. Engel')).toBe('Maro Engel');
    expect(spell('K. van der Linde')).toBe('Kelvin van der Linde');
    expect(spell('B. Dörr')).toBe('Ben Dörr');
    expect(spell('P. Maximilian')).toBe('Maximilian Paul');
    expect(spell('C. Engelhart')).toBe('Christian Engelhart');
    expect(spell('S. Connor Primm')).toBe('Simon Connor Primm');
    expect(spell('X. Nobody')).toBe('X. Nobody');
    expect(initialsSpeller([{ name: 'Max Muster' }, { name: 'Mia Muster' }])('M. Muster')).toBe('M. Muster');
  });
});

describe("DTM's events on motorsport.com (O33)", () => {
  const fixture = async (name: string) => (await import('node:fs')).readFileSync(`tests/fixtures/${name}`, 'utf8');

  it("reads the picker's events and the page's own, in the order of their ids, and nothing else", () => {
    const html =
      '<a class="msnt-select__option" href="/dtm/results/2026/zandvoort-665347/">Zandvoort</a>' +
      '<a class="msnt-select__option" href="/dtm/results/2026/red-bull-ring-665344/">Red Bull Ring</a>' +
      '<a class="ms-tab-menu__link" href="/dtm/results/2026/hockenheim-665365/?st=FP1">FP1</a>' +
      '<a href="/dtm/results/2026/hockenheim-663181/">another Hockenheim page</a>';
    expect(dtmEvents(html, 2026)).toEqual(['red-bull-ring-665344', 'zandvoort-665347', 'hockenheim-665365']);
  });

  it("reads what a page says of itself: the session its table shows and its event's own days", async () => {
    expect(dtmShown(await fixture('dtm-hockenheim-q2-2026.html'))).toEqual({ session: 'Q2', start: '2026-10-09', end: '2026-10-11', table: true });
    expect(dtmShown(await fixture('dtm-norisring-q3-2026.html'))).toEqual({ session: 'Q3', start: '2026-07-03', end: '2026-07-05', table: true });
    expect(dtmShown(await fixture('dtm-oschersleben-race2-2026.html'))).toEqual({ session: 'RACE2', start: '2026-07-24', end: '2026-07-26', table: true });
  });

  it('says nothing where the page does not: no tab marked, no dates, two different ranges, no results table', () => {
    const tab = (st: string, current: boolean) => `<li class="ms-tab-menu__item${current ? ' current' : ''}"><a href="/dtm/results/2026/x-1/?st=${st}">${st}</a></li>`;
    expect(dtmShown(tab('FP1', false))).toEqual({ session: null, start: null, end: null, table: false });
    expect(dtmShown(`${tab('FP1', false)}${tab('FP3', true)}<span> Apr 24, 2026 </span><table class="ms-table ms-table--result"></table>`)).toEqual({ session: 'FP3', start: '2026-04-24', end: '2026-04-24', table: true });
    expect(dtmShown(`${tab('FP1', true)}<span>Oct 9, 2026 to Oct 11, 2026</span><span>Jul 3, 2026 to Jul 5, 2026</span>`)).toEqual({ session: 'FP1', start: null, end: null, table: false });
  });

  it("reads a session from its own page, a grouped weekend's qualifying from its grid, a group from the page rounds.json names", async () => {
    const file = JSON.parse(await fixture('../../content/series/dtm/rounds.json')) as { rounds: { round: number; qualifyingGroups?: DtmGroups }[] };
    const groups = file.rounds.find(r => r.round === 4)?.qualifyingGroups;
    expect(file.rounds.filter(r => r.qualifyingGroups).map(r => r.round)).toEqual([4]);
    expect(dtmPageCode('Free Practice 3', false)).toBe('FP3');
    expect(dtmPageCode('Qualifying 2', false)).toBe('Q2');
    expect(dtmPageCode('Qualifying 2', true, groups)).toBe('GRID2');
    expect(dtmPageCode('Qualifying 1 Group A', true, groups)).toBe('Q1');
    expect(dtmPageCode('Qualifying 1 Group B', true, groups)).toBe('Q2');
    expect(dtmPageCode('Qualifying 2 Group A', true, groups)).toBe('Q4');
    expect(dtmPageCode('Qualifying 2 Group B', true, groups)).toBe('Q3');
    expect(dtmPageCode('Qualifying 1 Group A', true, undefined)).toBeNull();
    expect(dtmPageCode('Race 1', false)).toBeNull();
  });
});

describe('DTM: a session from the page asked for it (O33)', () => {
  const fixture = async (name: string) => (await import('node:fs')).readFileSync(`tests/fixtures/${name}`, 'utf8');
  const norisring = { 'Qualifying 1': { A: 'Q1', B: 'Q2' }, 'Qualifying 2': { A: 'Q4', B: 'Q3' } };

  it('asks by rounds.json until a page of the event has named its sessions, then by them', async () => {
    const tabs = dtmSessions(await fixture('dtm-hockenheim-q2-2026.html'));
    expect(dtmAsk('Qualifying 2', undefined, undefined)).toBe('Q2');
    expect(dtmAsk('Qualifying 2', norisring, undefined)).toBe('GRID2');
    expect(dtmAsk('Qualifying 2', undefined, tabs)).toBe('Q2');
    // Hockenheim lists no third practice and no Q3: neither a third practice nor a group is its own.
    expect(dtmAsk('Free Practice 3', undefined, tabs)).toBeNull();
    expect(dtmAsk('Qualifying 1 Group A', norisring, tabs)).toBeNull();
    expect(dtmAsk('Qualifying 1 Group A', undefined, undefined)).toBeUndefined();
    // The Norisring's own tabs lead to its grids, whatever rounds.json names.
    expect(dtmAsk('Qualifying 2', undefined, dtmSessions(await fixture('dtm-norisring-q3-2026.html')))).toBe('GRID2');
  });

  it("keeps the table of the session the page shows, and its event's tabs", async () => {
    const page = await fixture('dtm-hockenheim-q2-2026.html');
    const got = dtmRead('Qualifying 2', 'Q2', page, undefined, undefined);
    expect(got.tabs).toEqual(dtmSessions(page));
    expect((got.table as Table).rows[0].slice(0, 2)).toEqual(['1', 'B. Buus']);
    const group = dtmRead('Qualifying 2 Group B', 'Q3', await fixture('dtm-norisring-q3-2026.html'), norisring, undefined);
    expect((group.table as Table).title).toBe('Qualifying 2 Group B');
    expect((group.table as Table).rows[0].slice(0, 2)).toEqual(['1', 'N. Thiim']);
  });

  it("asks again where the event's first page leads elsewhere, and takes nothing from another session's table", async () => {
    const hockenheim = await fixture('dtm-hockenheim-q2-2026.html');
    const norisringQ3 = await fixture('dtm-norisring-q3-2026.html');
    // A third practice the event does not list: its address shows another table (here Q2's). Asked again by the
    // event's tabs, it has none.
    const fp3 = dtmRead('Free Practice 3', 'FP3', hockenheim, undefined, undefined);
    expect(fp3.table).toBe('again');
    expect(dtmAsk('Free Practice 3', undefined, fp3.tabs)).toBeNull();
    // A weekend in groups rounds.json does not name: "Qualifying 2" was asked as Q2, and its tabs lead to the grid.
    const grid = dtmRead('Qualifying 2', 'Q2', norisringQ3, undefined, undefined);
    expect(grid.table).toBe('again');
    expect(dtmAsk('Qualifying 2', undefined, grid.tabs)).toBe('GRID2');
    // With the tabs known, a page that shows another session than the one asked gives nothing, never "none".
    expect(dtmRead('Qualifying 1', 'Q1', hockenheim, undefined, dtmSessions(hockenheim)).table).toBeUndefined();
  });

  it('says a session has no classification only on a page that shows it with nobody placed', () => {
    const page = (current: boolean, table: string) =>
      `<li class="ms-tab-menu__item${current ? ' current' : ''}"><a href="/dtm/results/2026/x-1/?st=FP1">FP1</a></li><span>Apr 24, 2026 to Apr 26, 2026</span>${table}`;
    const empty = '<table class="ms-table ms-table--result"><tbody></tbody></table>';
    expect(dtmRead('Free Practice 1', 'FP1', page(true, empty), undefined, undefined).table).toBeNull();
    // No results table at all, or no tab marked: the page cannot be read, and nothing is concluded from it.
    expect(dtmRead('Free Practice 1', 'FP1', page(true, ''), undefined, undefined).table).toBeUndefined();
    expect(dtmRead('Free Practice 1', 'FP1', page(false, empty), undefined, undefined)).toEqual({ tabs: undefined, table: undefined });
  });
});

describe('DTM: the sessions a run asks for (O33)', () => {
  // Hockenheim's timetable (content/series/dtm/sessions.json, round 8), each session's start and end.
  const at = (session: string, start: string, end: string): CalendarEntry => ({ round: 8, session, start, end, dateOnly: false, event: 'Hockenheimring Round' });
  const calendar = [
    at('Free Practice 1', '2026-10-09T10:05:00Z', '2026-10-09T10:50:00Z'),
    at('Free Practice 2', '2026-10-09T13:30:00Z', '2026-10-09T14:15:00Z'),
    at('Qualifying 1', '2026-10-10T07:35:00Z', '2026-10-10T07:55:00Z'),
    at('Race 1', '2026-10-10T11:30:00Z', '2026-10-10T12:30:00Z'),
    at('Qualifying 2', '2026-10-11T07:30:00Z', '2026-10-11T07:50:00Z'),
    at('Race 2', '2026-10-11T14:30:00Z', '2026-10-11T15:30:00Z'),
  ];
  const table: Table = { title: 't', columns: ['Pos'], rows: [['1']] };
  const round = (sessions: string[], others: ResultRound['others']): ResultRound => ({ round: 8, name: 'Hockenheim', date: '2026-10-11', sessions: sessions.map(label => ({ label, tables: [table] })), others });
  const labels = (rounds: ResultRound[], now: string, groupsOf: (round: number) => DtmGroups | undefined = () => undefined) => dtmWanted(rounds, calendar, groupsOf, new Date(now)).map(w => `${w.round} ${w.label}`);

  it('asks for a session an hour after it ended, the newest first, and never for a race', () => {
    expect(labels([], '2026-10-09T11:00:00Z')).toEqual([]);
    expect(labels([], '2026-10-09T12:00:00Z')).toEqual(['8 Free Practice 1']);
    expect(labels([], '2026-10-10T13:45:00Z')).toEqual(['8 Qualifying 1', '8 Free Practice 2', '8 Free Practice 1']);
  });

  it('asks for the second qualifying the morning after the first race, though the round holds its first practice', () => {
    // The round as Saturday afternoon's run leaves it: its first race, both practices and the first qualifying.
    const saturday = [round(['Race 1'], ['Free Practice 1', 'Free Practice 2', 'Qualifying 1'].map(label => ({ label, tables: [table] })))];
    expect(labels(saturday, '2026-10-10T13:45:00Z')).toEqual([]);
    expect(labels(saturday, '2026-10-11T08:40:00Z')).toEqual([]);
    expect(labels(saturday, '2026-10-11T09:00:00Z')).toEqual(['8 Qualifying 2']);
  });

  it('asks again for a session whose page did not answer, and not for one kept without a classification', () => {
    const partly = [round([], [{ label: 'Free Practice 1', tables: [table] }, { label: 'Qualifying 1', tables: [], none: 'no classification' }])];
    expect(labels(partly, '2026-10-12T12:00:00Z')).toEqual(['8 Qualifying 2', '8 Free Practice 2']);
  });

  it('asks for each group of a qualifying whose groups rounds.json names, once that qualifying has run', () => {
    const groups = () => ({ _comment: 'the groups as the race reports give them', 'Qualifying 1': { A: 'Q1', B: 'Q2' }, 'Qualifying 2': { A: 'Q4', B: 'Q3' }, sources: [] });
    expect(labels([], '2026-10-10T13:45:00Z', groups)).toEqual(['8 Qualifying 1', '8 Qualifying 1 Group A', '8 Qualifying 1 Group B', '8 Free Practice 2', '8 Free Practice 1']);
    expect(labels([round([], [{ label: 'Qualifying 1', tables: [table] }, { label: 'Qualifying 1 Group B', tables: [table] }])], '2026-10-10T09:00:00Z', groups)).toEqual(['8 Qualifying 1 Group A', '8 Free Practice 2', '8 Free Practice 1']);
  });
});

describe("DTM: qualifying's points against the official table (O33)", () => {
  const q = (title: string, order: string[]): Table => ({ title, columns: ['Pos', 'Driver', 'Team', 'Time'], rows: order.map((name, i) => [String(i + 1), name, 'T', '1:30.000']) });
  const race = (title: string, order: string[]): Table => ({ title, columns: ['Pos', 'Driver', 'Team', 'Time', 'Pts'], rows: order.map((name, i) => [String(i + 1), name, 'T', '57:00.000', String([25, 20, 16][i])]) });
  const weekend = (n: number, q1: string[], r1: string[], q2: string[], r2: string[]): ResultRound => ({
    round: n,
    name: `Round ${n}`,
    date: `2026-0${n + 3}-26`,
    sessions: [{ label: 'Race 1', tables: [race('Race 1', r1)] }, { label: 'Race 2', tables: [race('Race 2', r2)] }],
    others: [{ label: 'Free Practice 1', tables: [q('Free Practice 1', q1)] }, { label: 'Qualifying 1', tables: [q('Qualifying 1', q1)] }, { label: 'Qualifying 2', tables: [q('Qualifying 2', q2)] }],
  });
  // Round 1 pays A 50, B 50, C 34; round 2 pays A 50, B 34, C 50; its last race alone A 25, B 16, C 20.
  const rounds = [weekend(1, ['A', 'B', 'C'], ['A', 'B', 'C'], ['B', 'A', 'C'], ['B', 'A', 'C']), weekend(2, ['C', 'A', 'B'], ['C', 'A', 'B'], ['A', 'C', 'B'], ['A', 'C', 'B'])];
  const official = (a: number, b: number, c: number): Table => ({ title: 'Drivers', columns: ['Pos', 'Driver', 'Pts'], rows: [['1', 'A', String(a)], ['2', 'B', String(b)], ['3', 'C', String(c)]] });
  const pointed = (out: ResultRound[]) => out.flatMap(r => (r.others ?? []).filter(s => s.tables[0].columns.includes('Pts')).map(s => `R${r.round} ${s.label}`));

  it('gives each qualifying its 3, 2 and 1 when every total equals the official table', () => {
    const got = dtmQualifyingPoints(rounds, official(100, 84, 84));
    expect(pointed(got.rounds)).toEqual(['R1 Qualifying 1', 'R1 Qualifying 2', 'R2 Qualifying 1', 'R2 Qualifying 2']);
    expect(got.rounds[1].others?.[1].tables[0].rows.map(r => r[4])).toEqual(['3', '2', '1']);
    expect(got.rounds[0].others?.[0].tables[0].columns).toEqual(['Pos', 'Driver', 'Team', 'Time']);
    expect(got.report).toBe("3 of 3 drivers' totals equal the official table with qualifying's points");
  });

  it("keeps the points the official table bears out when it is behind the results, a race or a weekend", () => {
    const race2 = dtmQualifyingPoints(rounds, official(75, 68, 64));
    expect(pointed(race2.rounds)).toEqual(['R1 Qualifying 1', 'R1 Qualifying 2', 'R2 Qualifying 1', 'R2 Qualifying 2']);
    expect(race2.report).toContain('through R2 Qualifying 2, 1 session behind');
    const weekend2 = dtmQualifyingPoints(rounds, official(50, 50, 34));
    expect(pointed(weekend2.rounds)).toEqual(['R1 Qualifying 1', 'R1 Qualifying 2']);
    expect(weekend2.report).toContain('through R1 Race 2, 4 sessions behind');
  });

  it('keeps no points when the totals are equal at no session, and says whose are not', () => {
    const got = dtmQualifyingPoints(rounds, official(99, 84, 84));
    expect(pointed(got.rounds)).toEqual([]);
    expect(got.report).toContain('kept without them (not A 100 for 99)');
  });

  it('leaves the stored tables as they are on a run without the official table', () => {
    const stored = dtmQualifyingPoints(rounds, official(100, 84, 84)).rounds;
    const got = dtmQualifyingPoints(stored, undefined);
    expect(got.rounds).toBe(stored);
    expect(pointed(got.rounds)).toHaveLength(4);
  });
});

describe("DTM: a winner's own time for the gap his line shows (O33)", () => {
  const race2 = (driver: string, time: string): ResultRound => ({
    round: 5,
    name: 'Oschersleben',
    date: '2026-07-26',
    sessions: [
      { label: 'Race 1', tables: [{ title: 'Race 1', columns: ['Pos', 'Driver', 'Team', 'Time', 'Pts'], rows: [['1', 'Thomas Preining', 'Manthey', '56:30.308', '25']] }] },
      { label: 'Race 2', tables: [{ title: 'Race 2', columns: ['Pos', 'Driver', 'Team', 'Time', 'Pts'], rows: [['1', driver, 'Mercedes-AMG Team Winward', time, '25'], ['2', 'Jules Gounon', 'Mercedes-AMG Team Winward', '+4.508', '20']] }] },
    ],
  });
  const fresh = [race2('Maro Engel', '+3.027')];
  const winner = (rounds: ResultRound[]) => rounds[0].sessions[1].tables[0].rows[0][3];

  it('takes the time an earlier run read, and asks for no page', () => {
    const got = dtmWinnersTimes(fresh, [race2('Maro Engel', '57:33.781')], 2026);
    expect(winner(got.rounds)).toBe('57:33.781');
    expect(got.rounds[0].sessions[1].tables[0].rows[1][3]).toBe('+4.508');
    expect(got.pending).toEqual([]);
  });

  it('asks for the race when no run has read it, or the stored line is another winner, a gap, or another season', () => {
    const asks = [{ round: 5, label: 'Race 2' }];
    for (const stored of [null, [race2('M. Engel', '57:33.781')], [race2('Maro Engel', '+3.027')], [{ ...race2('Maro Engel', '57:33.781'), date: '2025-07-27' }]]) {
      const got = dtmWinnersTimes(fresh, stored, 2026);
      expect(winner(got.rounds)).toBe('+3.027');
      expect(got.pending).toEqual(asks);
    }
  });
});

describe("WorldSBK's race points (O33)", () => {
  it('pays a classified rider by place and nothing to a retirement, wherever it is listed', () => {
    expect(wsbkPoints(1, 'Classified', false)).toBe(25);
    expect(wsbkPoints(15, 'Classified', false)).toBe(1);
    expect(wsbkPoints(16, 'Classified', false)).toBe(0);
    expect(wsbkPoints(9, 'Classified', true)).toBe(1);
    expect(wsbkPoints(15, 'Retired', false)).toBe(0);
  });

  // WorldSBK's API answers of 24 Nov 2026 (api.wsbk.pulselive.com/wsbk-results/v1/seasons/2026/categories/SBK/rounds/
  // <round>/sessions/<session>/results), every row with its position, rider, time, status and laps as answered, the
  // teams left out. The official classifications: resources.worldsbk.com/files/results/2026/<round>/SBK/<session>/CLA/Results.pdf.
  type Saved = [position: number, rider: string, time: number, status: string, laps: number];
  const answer = (rows: Saved[]) => ({
    data: rows.map(([position, , time, status, laps], i) => ({ type: 'results', attributes: { position, time, status, laps }, relationships: { rider: { data: { id: `r${i}` } }, team: { data: { id: 't' } } } })),
    included: [...rows.map(([, rider], i) => ({ type: 'rider', id: `r${i}`, attributes: { name: rider.split(' ')[0], surname: rider.split(' ').slice(1).join(' ') } })), { type: 'team', id: 't', attributes: { name: 'Team' } }],
  });
  // JER, session 003.
  const JEREZ_RACE_2: Saved[] = [
    [1, 'Nicolo Bulega', 3256372, 'Classified', 20], [2, 'Iker Lecuona', 3301068, 'Classified', 20], [3, 'Sam Lowes', 3309721, 'Classified', 20], [4, 'Alvaro Bautista', 3311300, 'Classified', 20],
    [5, 'Yari Montella', 3313564, 'Classified', 20], [6, 'Lorenzo Baldassarri', 3314492, 'Classified', 20], [7, 'Alex Lowes', 3318968, 'Classified', 20], [8, 'Axel Bassani', 3322329, 'Classified', 20],
    [9, 'Alberto Surra', 3323514, 'Classified', 20], [10, 'Miguel Oliveira', 3324374, 'Classified', 20], [11, 'Thomas Bridewell', 3325423, 'Classified', 20], [12, 'Xavi Vierge', 3326465, 'Classified', 20],
    [13, 'Garrett Gerloff', 3329111, 'Classified', 20], [14, 'Somkiat Chantra', 3331471, 'Classified', 20], [15, 'Jake Dixon', 3332378, 'Classified', 20], [16, 'Andrea Locatelli', 3333996, 'Classified', 20],
    [17, 'Stefano Manzi', 3335125, 'Classified', 20], [18, 'Loris Baz', 3337039, 'Classified', 20], [19, 'Remy Gardner', 3337217, 'Classified', 20], [20, 'Danilo Petrucci', 3344197, 'Classified', 20],
    [21, 'Twan Smits', 3347973, 'Classified', 20], [22, 'Mattia Rato', 3413411, 'Classified', 20],
  ];
  // GBR (Donington Park), session 003.
  const DONINGTON_RACE_2: Saved[] = [
    [1, 'Nicolo Bulega', 3256440, 'Classified', 23], [2, 'Iker Lecuona', 3300601, 'Classified', 23], [3, 'Yari Montella', 3303290, 'Classified', 23], [4, 'Axel Bassani', 3311786, 'Classified', 23],
    [5, 'Alex Lowes', 3312022, 'Classified', 23], [6, 'Garrett Gerloff', 3313096, 'Classified', 23], [7, 'Sam Lowes', 3318878, 'Classified', 23], [8, 'Lorenzo Baldassarri', 3321188, 'Classified', 23],
    [9, 'Xavi Vierge', 3321733, 'Classified', 23], [10, 'Alvaro Bautista', 3323067, 'Classified', 23], [11, 'Andrea Locatelli', 3324895, 'Classified', 23], [12, 'Miguel Oliveira', 3325868, 'Classified', 23],
    [13, 'Remy Gardner', 3328049, 'Classified', 23], [14, 'Jonathan Rea', 3328618, 'Classified', 23], [15, 'Danilo Petrucci', 3336168, 'Classified', 23], [16, 'Stefano Manzi', 3338728, 'Classified', 23],
    [17, 'Jake Dixon', 3340260, 'Classified', 23], [18, 'Mattia Rato', 3346684, 'Classified', 23], [19, 'Bahattin Sofuoglu', 3347086, 'Classified', 19], [20, 'Somkiat Chantra', 2834337, 'Retired', 19],
    [21, 'Thomas Bridewell', 1006109, 'Retired', 7],
  ];
  // FRA (Magny-Cours), session 003.
  const MAGNY_COURS_RACE_2: Saved[] = [
    [1, 'Nicolo Bulega', 3131396, 'Classified', 19], [2, 'Iker Lecuona', 3136854, 'Classified', 19], [3, 'Yari Montella', 3130075, 'Classified', 19], [4, 'Lorenzo Baldassarri', 3134558, 'Classified', 19],
    [5, 'Alberto Surra', 3137413, 'Classified', 19], [6, 'Alvaro Bautista', 3131446, 'Classified', 19], [7, 'Garrett Gerloff', 3132784, 'Classified', 19], [8, 'Xavi Vierge', 3133581, 'Classified', 19],
    [9, 'Axel Bassani', 3134185, 'Classified', 19], [10, 'Remy Gardner', 3135364, 'Classified', 19], [11, 'Sam Lowes', 3136463, 'Classified', 19], [12, 'Danilo Petrucci', 3130827, 'Classified', 19],
    [13, 'Alex Lowes', 3135137, 'Classified', 19], [14, 'Somkiat Chantra', 3135294, 'Classified', 19], [15, 'Miguel Oliveira', 3136556, 'Classified', 19], [16, 'Thomas Bridewell', 3055979, 'Retired', 19],
    [17, 'Stefano Manzi', 2834624, 'Retired', 17], [18, 'Jake Dixon', 1722014, 'Retired', 10], [19, 'Mattia Rato', 756727, 'Retired', 4], [20, 'Andrea Locatelli', 405933, 'Retired', 2],
  ];
  // FRA, session 101: Race 1's restart, after "001", the nine laps before the red flag.
  const MAGNY_COURS_RESTART: Saved[] = [
    [1, 'Nicolo Bulega', 1906594, 'Classified', 12], [2, 'Iker Lecuona', 1909712, 'Classified', 12], [3, 'Sam Lowes', 1912887, 'Classified', 12], [4, 'Yari Montella', 1915380, 'Classified', 12],
    [5, 'Alex Lowes', 1916027, 'Classified', 12], [6, 'Lorenzo Baldassarri', 1916644, 'Classified', 12], [7, 'Axel Bassani', 1919189, 'Classified', 12], [8, 'Alberto Surra', 1920437, 'Classified', 12],
    [9, 'Garrett Gerloff', 1921827, 'Classified', 12], [10, 'Xavi Vierge', 1922889, 'Classified', 12], [11, 'Jake Dixon', 1923332, 'Classified', 12], [12, 'Andrea Locatelli', 1923919, 'Classified', 12],
    [13, 'Danilo Petrucci', 1930625, 'Classified', 12], [14, 'Alvaro Bautista', 2016056, 'Classified', 12], [15, 'Somkiat Chantra', 0, 'Retired', 0], [16, 'Thomas Bridewell', 0, 'Retired', 0],
    [17, 'Stefano Manzi', 0, 'Retired', 0], [18, 'Mattia Rato', 0, 'Retired', 0], [19, 'Miguel Oliveira', 0, 'Retired', 0], [20, 'Remy Gardner', 0, 'Retired', 0],
  ];
  // JER, session Q1A: the Superpole.
  const JEREZ_SUPERPOLE: Saved[] = [
    [1, 'Nicolo Bulega', 136643, 'Classified', 7], [2, 'Sam Lowes', 136960, 'Classified', 7], [3, 'Iker Lecuona', 137098, 'Classified', 8], [4, 'Yari Montella', 137381, 'Classified', 8],
    [5, 'Alex Lowes', 137443, 'Classified', 8], [6, 'Lorenzo Baldassarri', 137639, 'Classified', 7], [7, 'Thomas Bridewell', 137753, 'Classified', 7], [8, 'Alberto Surra', 137759, 'Classified', 7],
    [9, 'Alvaro Bautista', 138115, 'Classified', 8], [10, 'Axel Bassani', 138178, 'Classified', 8], [11, 'Xavi Vierge', 138193, 'Classified', 6], [12, 'Jake Dixon', 138209, 'Classified', 7],
    [13, 'Miguel Oliveira', 138312, 'Classified', 8], [14, 'Loris Baz', 138381, 'Classified', 8], [15, 'Danilo Petrucci', 138392, 'Classified', 7], [16, 'Garrett Gerloff', 138416, 'Classified', 8],
    [17, 'Remy Gardner', 138542, 'Classified', 6], [18, 'Somkiat Chantra', 138606, 'Classified', 7], [19, 'Stefano Manzi', 138822, 'Classified', 6], [20, 'Andrea Locatelli', 138826, 'Classified', 6],
    [21, 'Twan Smits', 139374, 'Classified', 5], [22, 'Mattia Rato', 139563, 'Classified', 7],
  ];
  const times = (t: Table | null) => t?.rows.map(row => row[3]);

  it("reads the API's times as the digits they are: 3309762 is 33'09.762, 136643 a lap of 1'36.643", () => {
    expect(wsbkMs(3309762)).toBe(1_989_762);
    expect(wsbkMs(136643)).toBe(96_643);
    for (const none of [0, -1, 3360000, 1906594.5, '3309762', null]) expect(wsbkMs(none)).toBeNull();
  });

  it("draws Jerez's second race as its official classification: 32'56.372, then gaps across a minute", () => {
    const t = wsbkRaceTable('Race 2', answer(JEREZ_RACE_2), false);
    expect(t?.columns).toEqual(['Pos', 'Rider', 'Team', 'Time', 'Pts']);
    expect(t?.rows.slice(0, 3)).toEqual([
      ['1', 'Nicolo Bulega', 'Team', '32:56.372', '25'],
      ['2', 'Iker Lecuona', 'Team', '+4.696s', '20'],
      ['3', 'Sam Lowes', 'Team', '+13.349s', '16'],
    ]);
    expect(t?.rows[21]).toEqual(['22', 'Mattia Rato', 'Team', '+1:17.039', '0']);
  });

  it('reads a lapped rider his laps, and a rider timed at an intermediate his status: neither has a gap at the line', () => {
    const donington = wsbkRaceTable('Race 2', answer(DONINGTON_RACE_2), false);
    expect(times(donington)?.slice(16)).toEqual(['+43.820s', '+50.244s', '+4 Laps', 'Retired', 'Retired']);
    // Magny-Cours's official classification: P3 to P14 "1 Sector" to "3 Sectors" behind.
    const magnyCours = times(wsbkRaceTable('Race 2', answer(MAGNY_COURS_RACE_2), false));
    expect(magnyCours?.slice(0, 2)).toEqual(['31:31.396', '+5.458s']);
    expect(magnyCours?.slice(2)).toEqual([...Array<string>(13).fill('Classified'), ...Array<string>(5).fill('Retired')]);
  });

  it("draws Magny-Cours's restarted first race from the restart: 19'06.594, a gap over a minute, retirements with no time", () => {
    const t = wsbkRaceTable('Race 1', answer(MAGNY_COURS_RESTART), false);
    expect(times(t)?.slice(0, 3)).toEqual(['19:06.594', '+3.118s', '+6.293s']);
    expect(t?.rows[13]).toEqual(['14', 'Alvaro Bautista', 'Team', '+1:09.462', '2']);
    expect(t?.rows[14]).toEqual(['15', 'Somkiat Chantra', 'Team', 'Retired', '0']);
  });

  it("draws Jerez's Superpole as its official classification: the leader's 1'36.643, then the gaps to it", () => {
    const t = wsbkTimedTable('Superpole', answer(JEREZ_SUPERPOLE));
    expect(t?.columns).toEqual(['Pos', 'Rider', 'Team', 'Time']);
    expect(t?.rows.slice(0, 3)).toEqual([
      ['1', 'Nicolo Bulega', 'Team', '1:36.643'],
      ['2', 'Sam Lowes', 'Team', '+0.317s'],
      ['3', 'Iker Lecuona', 'Team', '+0.455s'],
    ]);
    expect(t?.rows[21]).toEqual(['22', 'Mattia Rato', 'Team', '+2.920s']);
    expect(wsbkTimedTable('Superpole', answer(JEREZ_SUPERPOLE.slice(0, 7)))).toBeNull();
  });

  it("reads a lap's gap across a minute, and a rider with no place under the old reader's word for him", () => {
    // Made up: a leader on 1'59.900, a rider on 2'00.100 (0.200 behind, not 40.200), one not started.
    const rows: Saved[] = [[1, 'A One', 159900, 'Classified', 9], [2, 'B Two', 200100, 'Classified', 9], ...[3, 4, 5, 6, 7].map((p): Saved => [p, `C${p} Rider`, 200100 + p, 'Classified', 9]), [0, 'D Four', 0, 'DNS', 0]];
    expect(wsbkTimedTable('FP1', answer(rows))?.rows.map(row => row[3])).toEqual(['1:59.900', '+0.200s', '+0.203s', '+0.204s', '+0.205s', '+0.206s', '+0.207s', '']);
    expect(wsbkTimedTable('FP1', answer(rows))?.rows[7].slice(0, 2)).toEqual(['DNS', 'D Four']);
  });

  it('asks again, once, for a timed session the old reader drew: one with a table and no `from`', () => {
    const lap = table('Superpole', [['1', 'Nicolo Bulega', 'Aruba.it Racing - Ducati', '2:16.643']]);
    const jerez: ResultRound = {
      round: 12,
      name: 'Spain',
      date: '2026-10-18',
      sessions: [],
      others: [{ label: 'Superpole', tables: [lap] }, { label: 'FP1', tables: [lap], from: 'L1A' }, { label: 'Warm Up', tables: [], none: 'called off' }],
    };
    expect(wsbkHeld([jerez])[0].others?.map(s => s.label)).toEqual(['FP1', 'Warm Up']);
    expect(wsbkHeld([{ ...jerez, others: undefined }])[0]).toEqual({ ...jerez, others: undefined });
  });

  it('takes an answer whose leader has no time for none, so it never replaces a table held', () => {
    const timeless = (rows: Saved[]) => rows.map(([p, n, , s, l]): Saved => [p, n, 0, s, l]);
    expect(wsbkRaceTable('Race 2', answer(timeless(JEREZ_RACE_2)), false)).toBeNull();
    expect(wsbkTimedTable('Superpole', answer(timeless(JEREZ_SUPERPOLE)))).toBeNull();
  });

  it('reads a rider one lap down as "+1 Lap"', () => {
    // Donington's second race with Sofuoglu made one lap down instead of four.
    const rows = DONINGTON_RACE_2.map(([p, n, t, s, l]): Saved => [p, n, t, s, p === 19 ? 22 : l]);
    expect(wsbkRaceTable('Race 2', answer(rows), false)?.rows[18][3]).toBe('+1 Lap');
  });

  it('reads again a race the old fetcher now orders otherwise: classified again since it was read', () => {
    const t = (rows: string[][]): Table => ({ title: 'Race 2', columns: ['Pos', 'Rider', 'Team', 'Time', 'Pts'], rows });
    const read = t([['1', 'Nicolo Bulega', 'T', '32:56.372', '25'], ['2', 'Iker Lecuona', 'T', '+4.696s', '20']]);
    const swapped = t([['1', 'Iker Lecuona', 'T', '54:21.068', '25'], ['2', 'Nicolo Bulega', 'T', '+0.304s', '20']]);
    const round = (sessions: ResultRound['sessions']): ResultRound => ({ round: 12, name: 'Spain', date: '2026-10-18', sessions });
    const stored = [round([{ label: 'Race 2', tables: [read], parts: 1, from: '003' }, { label: 'Race 1', tables: [read], parts: 2, from: '101' }])];
    // The old fetcher's tables carry its own times: only the order of the riders counts.
    const same = [round([{ label: 'Race 2', tables: [{ ...read, rows: read.rows.map(row => [...row.slice(0, 3), '54:16.372', row[4]]) }] }, { label: 'Race 1', tables: [swapped] }])];
    expect([...wsbkReclassified(stored, same)]).toEqual([]);
    const again = wsbkReclassified(stored, [round([{ label: 'Race 2', tables: [swapped] }, { label: 'Race 1', tables: [swapped] }])]);
    expect([...again]).toEqual(['12|Race 2']);
    expect(wsbkReclassified([round([{ label: 'Race 2', tables: [read], parts: 1 }])], [round([{ label: 'Race 2', tables: [swapped] }])]).size).toBe(0);
    const finished = [round([{ label: 'Race 2', tables: [read], parts: 1, from: '003' }])];
    const endOf = () => '2026-10-18';
    expect(wsbkDue(finished, endOf, new Date('2026-11-25T08:00:00Z'))).toEqual([]);
    expect(wsbkDue(finished, endOf, new Date('2026-11-25T08:00:00Z'), again).map(r => r.round)).toEqual([12]);
  });

  const table = (title: string, rows: string[][]): Table => ({ title, columns: ['Pos', 'Rider', 'Team', 'Time', 'Pts'], rows });
  const nineLaps = table('Race 1', [['1', 'Nicolo Bulega', 'Aruba.it Racing - Ducati', '14:50.000', '25'], ['15', 'Tom Bridewell', 'Honda', 'Retired', '1']]);
  const restart = table('Race 1', [['1', 'Nicolo Bulega', 'Aruba.it Racing - Ducati', '21:40.000', '25']]);
  const magnyCours = (race1: Table, parts?: number): ResultRound => ({
    round: 9,
    name: 'France',
    date: '2026-09-06',
    sessions: [{ label: 'Race 1', tables: [race1], ...(parts ? { parts } : {}) }, { label: 'Superpole Race', tables: [table('Superpole Race', [])], ...(parts ? { parts: 1 } : {}) }],
  });

  it("carries a restarted race's own result and each race's parts from the season's stored rounds", () => {
    const carried = wsbkCarried([magnyCours(nineLaps)], [magnyCours(restart, 2)], 2026);
    expect(carried[0].sessions[0]).toMatchObject({ parts: 2, tables: [restart] });
    expect(carried[0].sessions[1]).toMatchObject({ parts: 1 });
    expect(wsbkCarried([magnyCours(nineLaps)], [{ ...magnyCours(restart, 2), date: '2025-09-07' }], 2026)[0].sessions[0]).toEqual({ label: 'Race 1', tables: [nineLaps] });
    expect(wsbkCarried([magnyCours(nineLaps)], null, 2026)[0].sessions[0]).toEqual({ label: 'Race 1', tables: [nineLaps] });
  });

  it("keeps the table a run read from a race's own result, over the old fetcher's", () => {
    const read = table('Superpole Race', [['1', 'Nicolo Bulega', 'Aruba.it Racing - Ducati', '15:52.648', '12']]);
    const stored: ResultRound = { ...magnyCours(restart), sessions: [{ label: 'Race 1', tables: [restart], parts: 2, from: '101' }, { label: 'Superpole Race', tables: [read], parts: 1, from: '002' }] };
    expect(wsbkCarried([magnyCours(nineLaps)], [stored], 2026)[0].sessions).toEqual(stored.sessions);
  });

  it("reads a round's session list while the round is run, until its races are known and read, and for a restarted race", () => {
    const known = (round: number, date: string, parts: number): ResultRound => ({
      round,
      name: `Round ${round}`,
      date,
      sessions: [{ label: 'Race 1', tables: [], parts, from: parts > 1 ? '101' : '001' }, { label: 'Race 2', tables: [], parts: 1, from: '003' }],
    });
    // Round 11 as stored before 1.0.319: its races known to be one part each, their tables the old fetcher's.
    const unread: ResultRound = { ...known(11, '2026-10-11', 1), sessions: [{ label: 'Race 1', tables: [], parts: 1 }, { label: 'Race 2', tables: [], parts: 1 }] };
    const rounds = [known(8, '2026-08-02', 1), known(9, '2026-09-06', 2), { ...known(10, '2026-09-27', 1), sessions: [{ label: 'Race 1', tables: [] }] }, unread, known(12, '2026-10-18', 1)];
    const endOf = (round: number | null) => rounds.find(r => r.round === round)?.date;
    expect(wsbkDue(rounds, endOf, new Date('2026-11-17T08:00:00Z')).map(r => r.round)).toEqual([11, 10, 9]);
    expect(wsbkDue(rounds, endOf, new Date('2026-10-19T08:00:00Z')).map(r => r.round)).toEqual([12, 11, 10, 9]);
  });

  it('pays a retirement nothing in the stored tables', () => {
    expect(wsbkScored([magnyCours(nineLaps)])[0].sessions[0].tables[0].rows.map(r => r[4])).toEqual(['25', '0']);
  });
});

// ── Family A's pages (O33's PR 3), from the saved document ────────────────────
//
// tests/fixtures/multi-race.json: paddock-data 868b8dc4 as the publisher keeps it (its `about` says what and from where),
// read through the publisher's line (spelledAsRoster) and each series' own setting in content/series/<slug>/meta.json.

type SlugA = 'f2' | 'f3' | 'motogp' | 'wsbk' | 'dtm';
interface SavedA {
  name: string;
  rounds: CalendarRound[];
  cancelled?: SeriesData['cancelled'];
  calendar: CalendarEntry[];
  results: ResultRound[];
  standings: Table[];
  teams: RosterTeam[];
  champions: { seasons: Champion[]; notes: ChampionNotesFile };
}
const savedA = (JSON.parse(readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'multi-race.json'), 'utf8')) as { series: Record<SlugA, SavedA> }).series;
const SITES_A = Object.fromEntries(
  ['f1', 'f2', 'f3', 'motogp', 'wsbk', 'dtm', 'gt-world'].flatMap(slug => {
    const site = siteOf(slug, (JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'series', slug, 'meta.json'), 'utf8')) as { site?: unknown }).site);
    return site ? [[slug, site]] : [];
  }),
);

/** A series as the publisher hands it to the kit: the saved document through the publisher's line. */
function seriesA(slug: SlugA, extra: Partial<SeriesData> = {}): SeriesData {
  const s = savedA[slug];
  const spelled = spelledAsRoster({ results: s.results, standings: s.standings }, s.teams);
  return {
    slug,
    name: s.name,
    season: 2026,
    sites: SITES_A,
    standings: spelled.standings,
    results: spelled.results,
    calendar: s.calendar,
    rounds: s.rounds,
    teams: spelled.teams,
    cancelled: s.cancelled ?? [],
    champions: { seasons: s.champions.seasons, notes: s.champions.notes, records: null, historic: {}, names: null },
    ...extra,
  };
}

const kitA = multiRaceKit();
const pagesA = (d: SeriesData): Map<string, Page> => new Map([...seriesFamily(d, kitA), ...kitA.weekendPages(d)].map(p => [p.path, p]));
const F2 = pagesA(seriesA('f2'));
const MOTO = pagesA(seriesA('motogp'));
const WSBK = pagesA(seriesA('wsbk'));
const DTM = pagesA(seriesA('dtm'));
const F3 = pagesA(seriesA('f3'));
const at = (pages: Map<string, Page>, p: string): string => pages.get(p)?.body ?? '';
const roundA = (d: SeriesData, n: number): CalendarRound => (d.rounds ?? []).find(r => r.round === n) as CalendarRound;
const unitsA = (slug: SlugA, n: number) => {
  const d = seriesA(slug);
  const w = weekendOf(d, 2026, roundA(d, n));
  const { units } = unitsOf(w);
  return { units, states: unitStates(w, units) };
};
/** The bar's items as "label | note", the note's markup dropped. */
const barA = (html: string): string[] => [...(/<nav class="pd-wb".*?<\/nav>/.exec(html)?.[0] ?? '').matchAll(/<(?:a|span)[^>]*>([^<]+)<small>(.*?)<\/small>/g)].map(m => `${m[1]} | ${m[2].replace(/<[^>]+>/g, '')}`);
const tabsA = (html: string): string[] => [...html.matchAll(/data-pd-tab="([^"]+)"/g)].map(m => m[1]);
/** A results table's panel: from its tab to the next. */
const panelA = (html: string, tab: string): string => {
  const from = html.indexOf(`data-pd-tab="${tab}"`);
  const to = html.indexOf('<section class="pd-rt-p"', from);
  return from < 0 ? '' : html.slice(from, to < 0 ? undefined : to);
};
const rowsA = (html: string): number => (html.match(/<tr><td class="p">/g) ?? []).length;
const headA = (html: string): string[] => [...(/<thead>(.*?)<\/thead>/.exec(html)?.[1] ?? '').matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(m => m[1]);
const W = (slug: string, n: number) => `/series/${slug}/2026/round-${n}/`;

describe("family A: the roster's spellings (default 17)", () => {
  it('spells every name as drivers.json writes it, and joins each team name the series writes otherwise', () => {
    const moto = spelledAsRoster({ results: savedA.motogp.results, standings: savedA.motogp.standings }, savedA.motogp.teams);
    expect(moto.standings?.[0].rows[0].slice(0, 2)).toEqual(['1', 'Marc Márquez']);
    expect(moto.teams.filter(t => ['Castrol Honda LCR', 'Pro Honda LCR', 'Trackhouse MotoGP Team', 'Monster Energy Yamaha MotoGP Team'].includes(t.name)).map(t => [t.name, t.colour]).sort()).toEqual([
      ['Castrol Honda LCR', '#00873E'],
      ['Monster Energy Yamaha MotoGP Team', '#2140C9'],
      ['Pro Honda LCR', '#00873E'],
      ['Trackhouse MotoGP Team', '#24449C'],
    ]);
    // A one-off wildcard entry is no roster team: drawn grey, named in the log (Honda HRC's, round 16's practice alone,
    // is not in the saved document).
    expect(moto.grey).toEqual(['Yamaha Factory Racing']);
    const wsbk = spelledAsRoster({ results: savedA.wsbk.results, standings: savedA.wsbk.standings }, savedA.wsbk.teams);
    expect(wsbk.grey).toEqual(['Team Apreco']);
    expect(wsbk.standings?.[0].rows.find(r => r[1].endsWith('Bridewell'))?.[1]).toBe('Tommy Bridewell');
    expect(wsbk.teams.find(t => t.name === 'Aruba.it Racing - Ducati')?.colour).toBe('#CC0000');
    const dtm = spelledAsRoster({ results: savedA.dtm.results, standings: savedA.dtm.standings }, savedA.dtm.teams);
    expect([dtm.grey, dtm.teams.find(t => t.name === 'Mercedes-AMG Team Winward')?.colour]).toEqual([[], '#D2232A']);
    // A name the roster does not hold stays as the feed writes it.
    expect(spelledAsRoster({ results: null, standings: [{ title: 'Riders', columns: ['Pos', 'Rider', 'Team', 'Pts'], rows: [['1', 'Aleix Espargaro', 'Honda HRC', '9']] }] }, savedA.motogp.teams).standings?.[0].rows[0][1]).toBe('Aleix Espargaro');
  });

  it('folds accents, case, dashes and the letters NFD keeps whole', () => {
    expect(foldName('Toprak Razgatlıoğlu')).toBe(foldName('Toprak  Razgatlioglu'));
    expect(foldName('Maciej Gładysz')).toBe(foldName('Maciej Gladysz'));
    expect(foldName('Noah Strømsted')).toBe(foldName('Noah Stromsted'));
    expect(foldName('Aruba.it Racing – Ducati')).toBe(foldName('aruba.it racing - ducati'));
  });
});

describe("family A: a weekend's pages and their states (the label bridge; the operator's \"Greyed, as drawn\", 24 Nov)", () => {
  it("pairs the timetable's names with the stored sessions", () => {
    const { units, states } = unitsA('f2', 11);
    expect(units.map(u => [u.page, u.label, u.kind])).toEqual([
      ['Practice', 'Practice', 'practice'],
      ['Qualifying', 'Qualifying', 'qualifying'],
      ['Sprint Race', 'Sprint', 'race'],
      ['Feature Race', 'Feature', 'race'],
    ]);
    expect(states).toEqual(['run', 'run', 'run', 'run']);
    expect(unitsA('motogp', 17).units.map(u => u.label)).toEqual(['FP1', 'Practice', 'FP2', 'Q1', 'Q2', 'Sprint', 'Warm Up', 'Grand Prix']);
  });

  it("joins a qualifying's two groups on one page, the order they make by the series' rule (A3, default 5)", () => {
    const monaco = unitsA('f2', 4).units.find(u => u.page === 'Qualifying');
    expect(monaco?.entries.map(e => e.session)).toEqual(['Qualifying Group A', 'Qualifying Group B']);
    expect(monaco?.groups.map(g => g.name)).toEqual(['Group A', 'Group B']);
    // Câmara's Group A was faster (1:20.923 to Tsolov's 1:21.053): its drivers take the odd places (motorsportweek.com).
    expect(monaco?.table?.rows.slice(0, 7).map(r => `${r[0]} ${r[1]} ${r[r.length - 1]}`)).toEqual([
      '1 Rafael Câmara A',
      '2 Nikola Tsolov B',
      '3 Alexander Dunne A',
      '4 Martinius Stenshorne B',
      '5 Dino Beganovic A',
      '6 Kush Maini B',
      '7 Gabriele Minì A',
    ]);
    // Those a group did not place follow, unplaced: Bennett's best lap was deleted (Group A, NC), van Hoepen set none.
    expect(monaco?.table?.rows.slice(-2).map(r => `${r[0]} ${r[1]}`)).toEqual(['NC John Bennett', 'NC Laurens van Hoepen']);
    // Formula 3's Monaco, all 30 as Formula Scout lists the overall order.
    const f3 = unitsA('f3', 2).units.find(u => u.page === 'Qualifying');
    expect(f3?.table?.rows.map(r => r[1].split(' ').pop())).toEqual(
      'Naël Badoer Slater Ugochukwu Rivera Taponen Giusti Pino Clerot Strømsted Xie Yamakoshi Gładysz Kato Nakamura Sharp Lacorte Bhirombhakdi Ho Benavides Deligny Le David Palo Wharton Garfias Colnaghi McLaughlin Shin Barrichello'.split(' '),
    );
    // DTM keeps the order its two groups made (motorsport.com's grid, which gives no time) beside each group.
    const noris = unitsA('dtm', 4).units.find(u => u.page === 'Qualifying 1');
    expect([noris?.table?.columns, noris?.groups.length, noris?.table?.rows[0][1]]).toEqual([['Pos', 'Driver', 'Team', 'Pts'], 2, 'Nicki Thiim']);
  });

  it('a session run, still to run, with no results, not stored, or called off', () => {
    expect(unitsA('motogp', 18).states).toEqual(['run', 'run', 'run', 'run', 'run', 'run', 'x', 'x']);
    expect(unitsA('motogp', 17).states[6]).toBe('none');
    expect(unitsA('motogp', 21).states).toEqual(['run', 'run', 'run', 'run', 'run', 'run', 'run', 'up']);
    expect(new Set(unitsA('motogp', 22).states)).toEqual(new Set(['up']));
    // The saved document keeps round 1's races alone: its practice and qualifying are not stored.
    expect(unitsA('motogp', 1).states).toEqual(['unstored', 'unstored', 'unstored', 'unstored', 'unstored', 'run', 'unstored', 'run']);
    // Formula 2's Qatar, its times "TBC" in the stored timetable: no session on its weekend yet.
    expect(unitsA('f2', 13).units).toEqual([]);
  });

  it('greys a session with no results or not stored on the bar and its card, with no page; a reason typed into rounds.json shows', () => {
    const r17 = at(MOTO, W('motogp', 17));
    expect(barA(r17)).toContain('Warm Up | Sun · no results');
    expect(r17).toContain('<span class="is-off">Warm Up<small>Sun · no results</small></span>');
    expect(r17).toContain('<p class="pd-sc-empty">No results are available for this session.</p><span class="pd-sc-go is-off">No page yet</span>');
    expect(MOTO.has(`${W('motogp', 17)}warm-up/`)).toBe(false);
    expect(barA(at(MOTO, W('motogp', 1)))).toContain('FP1 | Fri · not stored');
    expect(MOTO.has(`${W('motogp', 1)}fp1/`)).toBe(false);
    const line = [{ session: 'Warm Up', note: 'Rain stopped it before a lap was timed.', source: 'https://www.motogp.com/' }];
    const moto = seriesA('motogp');
    const typed = pagesA({ ...moto, rounds: moto.rounds?.map(r => (r.round === 17 ? { ...r, noResults: line } : r)) });
    expect(at(typed, W('motogp', 17))).toContain('<p class="pd-sc-empty">Rain stopped it before a lap was timed: no results are available for this session.</p>');
  });
});

describe("family A: a round's Overview after its races (O, W, X)", () => {
  const madrid = at(F2, W('f2', 11));

  it('O: the Final line names each race’s winner, the bar each session’s leader', () => {
    expect(madrid).toContain('<span class="pd-wk-sum"><b>Dino Beganovic</b> won the Feature Race, and the Sprint went to Ritomo Miyata</span>');
    expect(barA(madrid)).toEqual(['Overview | the weekend', 'Practice | Fri · TSO', 'Qualifying | Fri · BEG', 'Sprint Race | Sat · MIY', 'Feature Race | Sun · BEG']);
  });

  it('O: one table with tabs, Both races first with every scorer, then a tab a race with its top ten', () => {
    expect(tabsA(madrid)).toEqual(['Both races', 'Sprint Race', 'Feature Race']);
    const both = panelA(madrid, 'Both races');
    expect(headA(both)).toEqual(['Pos', 'Driver', 'Team', 'Sprint', 'Feature', 'Total']);
    expect(rowsA(both)).toBe(13);
    expect(both).toContain('<b>BEG</b><span>Dino Beganovic</span></td><td class="tm">DAMS Lucas Oil</td><td class="n">–</td><td class="n">27</td><td class="n tot">27</td>');
    // Equal totals by the earlier race's points, as drawn: Stenshorne (4 and 4) before Inthraphuvasak (8).
    expect(both.indexOf('Martinius Stenshorne')).toBeLessThan(both.indexOf('Tasanapol Inthraphuvasak'));
    const sprint = panelA(madrid, 'Sprint Race');
    expect([rowsA(sprint), headA(sprint)]).toEqual([10, ['Pos', 'Driver', 'Team', 'Time', 'Pts']]);
    expect(sprint).toContain(`<a class="pd-wk-link" href="${W('f2', 11)}sprint-race/">All 21 on the race's page</a>`);
  });

  it('O: the earlier sessions, the championship after the round, the format, the next round', () => {
    expect(madrid).toContain('<h2>Earlier in the weekend</h2><p class="pd-wk-hint">Each session’s leading results, in the order they ran</p>');
    expect(madrid).toContain('<h3>Championship after round 11</h3>');
    expect(madrid).toContain('<b>Nikola Tsolov</b><small>Campos Racing</small></span><span class="g">Leader</span><b class="pt">177</b>');
    expect(madrid).toContain('<dt>Format</dt><dd>Sprint and Feature</dd>');
    expect(madrid).toContain('<small>Next round · 12</small><b>Azerbaijan Grand Prix</b>');
  });

  it('X: Baku, two qualifying sessions and three races', () => {
    const baku = at(F2, W('f2', 12));
    expect(baku).toContain('<em class="pd-wk-tag">Two qualifying sessions and two Feature Races</em>');
    expect(baku).toContain('<b>Rafael Câmara</b> won Feature Race 2; Alexander Dunne Feature Race 1, Dino Beganovic the Sprint');
    expect(barA(baku).map(x => x.split(' | ')[0])).toEqual(['Overview', 'Practice', 'Qualifying 1', 'Qualifying 2', 'Sprint Race', 'Feature Race 1', 'Feature Race 2']);
    expect(tabsA(baku)).toEqual(['All three races', 'Sprint Race', 'Feature Race 1', 'Feature Race 2']);
    expect(baku).toContain('<p class="pd-wk-hint">All three races together, or one race at a time</p>');
    expect(headA(panelA(baku, 'All three races'))).toEqual(['Pos', 'Driver', 'Team', 'Sprint', 'FR1', 'FR2', 'Total']);
    expect(rowsA(panelA(baku, 'All three races'))).toBe(14);
    expect(baku).toContain('<dt>Format</dt><dd>Two qualifying sessions, three races</dd>');
  });

  it("W: MotoGP's, WorldSBK's and DTM's weekends, a column a race (DTM's qualifying too)", () => {
    const r17 = at(MOTO, W('motogp', 17));
    expect(tabsA(r17)).toEqual(['Both races', 'Sprint', 'Grand Prix']);
    expect(headA(panelA(r17, 'Both races'))).toEqual(['Pos', 'Rider', 'Team', 'Sprint', 'GP', 'Total']);
    const jerez = at(WSBK, W('wsbk', 12));
    expect(tabsA(jerez)).toEqual(['All three races', 'Race 1', 'Superpole Race', 'Race 2']);
    expect(headA(panelA(jerez, 'All three races'))).toEqual(['Pos', 'Rider', 'Team', 'R1', 'SPR', 'R2', 'Total']);
    expect(jerez).toContain('<dt>Format</dt><dd>Race 1, Superpole Race and Race 2</dd>');
    const hockenheim = at(DTM, W('dtm', 8));
    expect(headA(panelA(hockenheim, 'Both races'))).toEqual(['Pos', 'Driver', 'Team', 'Q1', 'R1', 'Q2', 'R2', 'Total']);
    expect(roundPoints(seriesA('dtm'), savedA.dtm.results.find(r => r.round === 8) as ResultRound).cols).toEqual(['Q1', 'R1', 'Q2', 'R2']);
  });
});

describe("family A: MotoGP's round 18, as drawn (12 Nov)", () => {
  const r18 = at(MOTO, W('motogp', 18));

  it('the Final line gives the reason, the race is struck through, the Sprint is the round’s only result', () => {
    expect(r18).toContain('<span class="pd-wk-sum">The Grand Prix was called off: poor visibility for the medical helicopter. <b>Marc Márquez</b> won the Sprint.</span>');
    expect(r18).toContain('<span class="is-x">Race<small>Sun · called off</small></span>');
    expect(barA(r18).slice(-3)).toEqual(['Sprint | Sat · MAR', 'Warm Up | Sun · called off', 'Race | Sun · called off']);
    expect(r18).toContain("<h2>Results</h2><p class=\"pd-wk-hint\">The Sprint, the weekend's only race</p>");
    expect(tabsA(r18)).toEqual([]);
    expect(MOTO.has(`${W('motogp', 18)}race/`)).toBe(false);
  });

  it('the season tile, the Overview tile and the Results row name the Sprint’s winner and the race called off', () => {
    expect(at(MOTO, '/series/motogp/2026/')).toContain('<small>Round 18 · 23–25 Oct</small><b>Australian Grand Prix</b><span><i class="pd-tc" style="--t:#CC0000"></i>Sprint: Márquez · Grand Prix called off</span>');
    expect(at(MOTO, '/series/motogp/')).toContain('<small>R18</small><b>Australian Grand Prix</b><span class="pd-sr-win" style="--t:#CC0000"><b>MAR</b>Sprint</span>');
    expect(at(MOTO, '/series/motogp/results/')).toContain('<b>Sprint: Marc Márquez</b><small>Ducati Lenovo Team · GP called off</small>');
  });

  it('the points left never count it', () => {
    expect(multiRaceLeft(seriesA('motogp'))).toEqual({ points: 62, scales: ['one Sprint at 12', 'two Grands Prix at 25'] });
  });
});

describe('family A: a weekend before and during it, as Formula 1’s (default 8)', () => {
  it("MotoGP's round 21 between its Sprint and its Grand Prix", () => {
    const r21 = at(MOTO, W('motogp', 21));
    expect(r21).toContain('<h2>Done so far</h2>');
    expect(r21).toContain('<h3>Sprint</h3>');
    expect(r21).toContain('<h2>Still to come</h2>');
    expect(r21).toContain(`<a class="pd-wk-row" href="${W('motogp', 21)}race/">`);
    expect(r21).not.toContain('pd-wk-pill is-fin');
    expect(barA(r21).at(-1)).toBe('Race | Sun 13:00 UTC · still to run');
    expect(at(MOTO, `${W('motogp', 21)}race/`)).toContain('<p class="pd-wk-empty">Not run yet. Its results join this page when it ends.</p>');
  });

  it("MotoGP's round 22 before it starts: every session to come, dashed", () => {
    const r22 = at(MOTO, W('motogp', 22));
    expect(r22).toContain('<h2>The weekend</h2>');
    expect(barA(r22).slice(1).every(x => x.endsWith('still to run'))).toBe(true);
    // Two rounds off the latest raced, the table as it stands, as Formula 1's side says it.
    expect(r22).toContain('<h3>Championship after round 20</h3>');
  });
});

describe("family A: a session's own page (L)", () => {
  it('every driver, time and points; a qualifying in groups, the order they make and each group', () => {
    const feature = at(F2, `${W('f2', 11)}feature-race/`);
    expect(feature).toContain('<h2>Classification</h2><p class="pd-wk-hint">All 21, as classified</p>');
    expect(rowsA(feature)).toBe(21);
    const monaco = at(F2, `${W('f2', 4)}qualifying/`);
    expect([...monaco.matchAll(/<h3 class="pd-fa-part">([^<]+)/g)].map(m => m[1].trim())).toEqual(['The order the two groups make', 'Group A', 'Group B']);
    expect(monaco).toContain('<h1>Qualifying</h1><p class="pd-ss-sub">Friday 5 June · Group A 15:10 · Group B 15:34 at the track, from');
    expect(F2.has(`${W('f2', 4)}qualifying-group-a/`)).toBe(false);
    expect([...at(DTM, `${W('dtm', 4)}qualifying-1/`).matchAll(/<h3 class="pd-fa-part">([^<]+)/g)].map(m => m[1].trim())).toEqual(['The order the two groups make', 'Group A', 'Group B']);
  });
});

describe('family A: Standings, points left and the title box (All five; Name the champion)', () => {
  it('points left by each series’ scale, every point counted', () => {
    expect(multiRaceLeft(seriesA('f2'))).toEqual({ points: 78, scales: ['two Sprint Races at 10', 'two Feature Races at 25', 'two Feature poles at 2', 'four fastest laps at 1'] });
    for (const slug of ['f3', 'wsbk', 'dtm'] as const) expect(multiRaceLeft(seriesA(slug)).points).toBe(0);
    // A round with no timetable counts the series' standard weekend.
    const f2 = seriesA('f2');
    expect(multiRaceLeft({ ...f2, calendar: (f2.calendar ?? []).filter(e => e.round !== 14) }).points).toBe(78);
  });

  it("Formula 2: Who can still win it, as drawn on 12 Nov", () => {
    const body = at(F2, '/series/f2/standings/');
    expect(body).toContain('<p>78 points left: two Sprint Races at 10, two Feature Races at 25, two Feature poles at 2, four fastest laps at 1. A bar is how much of that a driver needs just to draw level.</p>');
    expect([...body.matchAll(/<li(?: class="(?:ld|out)")? style="--t:[^"]+"><b>([^<]+)<\/b>/g)].map(m => m[1])).toEqual(['Câmara', 'Tsolov', 'Dunne', 'Minì', 'Beganovic', 'León', 'Stenshorne']);
    expect(body).toContain('<p class="pd-st-sum">Six drivers are still in it on paper. Stenshorne is out by 22 points.</p>');
    expect(body).toContain('<h3 class="pd-st-ch">Teams</h3>');
    expect(body).not.toContain('Teammates');
  });

  it('Formula 3, WorldSBK and DTM: the season over, the champion named, where it was clinched (24 Nov)', () => {
    expect(at(F3, '/series/f3/standings/')).toContain(
      '<h3>The 2026 title</h3><p class="pd-fa-champ"><b>Ugo Ugochukwu</b> is the 2026 champion, 14 points clear of Freddie Slater. Clinched in Feature Race 2 at Madrid on 13 September, the last race of the season.</p><p>Teams&#39; champion: Campos Racing.</p><a class="pd-fa-how" href="/series/f3/champions/">How it was won →</a>',
    );
    expect(at(WSBK, '/series/wsbk/standings/')).toContain('<b>Nicolò Bulega</b> is the 2026 champion, 163 points clear of Iker Lecuona. Clinched in Race 2 at Cremona on 27 September with six races to spare.</p><p>Manufacturers&#39; champion: Ducati.</p>');
    expect(at(DTM, '/series/dtm/standings/')).toContain('<b>Thomas Preining</b> is the 2026 champion, 12 points clear of Maro Engel. Clinched in Race 2 at the Hockenheimring on 11 October, the last race of the season.');
    // DTM's teams beside its manufacturers, each under its own name, the manufacturers without wins.
    const dtm = at(DTM, '/series/dtm/standings/');
    expect([...dtm.matchAll(/<h3 class="pd-st-ch">([^<]+)<\/h3>/g)].map(m => m[1])).toEqual(['Teams', 'Manufacturers']);
    expect(dtm).toContain('<button type="button" data-pd-st="constructors">Teams and manufacturers</button>');
  });

  it("MotoGP: the riders' words, the head as of the Sprint, wins its Grands Prix", () => {
    const body = at(MOTO, '/series/motogp/standings/');
    expect(body).toContain(`<h2 class="pd-st-h">Standings after the round 21 Sprint</h2><p>Portuguese Grand Prix Sprint, 21 November<span class="pd-st-next"> · next update after Sunday's Portuguese Grand Prix</span></p>`);
    expect(body).toContain('<p class="pd-st-sum">Three riders are still in it on paper. Acosta is out by 54 points.</p>');
    expect(multiRaceWins(seriesA('motogp')).driver('Marc Márquez')).toBe(7);
  });
});

describe('family A: Champions, in each series’ words (default 13)', () => {
  const crowned = (slug: SlugA): Map<string, Page> =>
    pagesA(seriesA(slug, { champions: { seasons: JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'series', slug, 'champions.json'), 'utf8')) as Champion[], notes: null, records: null, historic: {}, names: null } }));

  it("Formula 2's footnote and its door to Formula 1's champions", () => {
    const body = at(crowned('f2'), '/series/f2/champions/');
    expect(body).toContain("Every drivers' champion since 2005 and every teams' champion since 2005");
    expect(body).toContain('<p class="pd-ch-foot">From 2005 to 2016 the series was GP2; the FIA renamed it the FIA Formula 2 Championship in 2017. ×2, ×3: the driver\'s second, third title.');
    expect(body).toContain('<a class="pd-ch-door" href="/series/f1/champions/"><small>/series/f1/champions/</small><b>Formula 1 champions</b><span>Since 1950.</span><em>Open →</em></a>');
  });

  it("MotoGP's riders and manufacturers, WorldSBK's door, DTM's to GT World's", () => {
    const body = at(crowned('motogp'), '/series/motogp/champions/');
    expect(body).toContain("Every riders' champion since 1949 and every constructors' champion since 1949");
    expect(body).toContain('<h2>Most successful manufacturers</h2>');
    expect(body).toContain('Until 2001 the top class raced 500cc bikes; in 2002 990cc bikes replaced them and the class was renamed MotoGP. ×2, ×3: the rider\'s second, third title.');
    expect(at(WSBK, '/series/wsbk/champions/')).toContain('<b>MotoGP champions</b><span>Since 1949, including the 500cc years.</span><em>Open →</em>');
    expect(at(WSBK, '/series/wsbk/champions/')).toContain('<p class="pd-ch-foot">×2, ×3: the rider\'s second, third title.');
    expect(at(DTM, '/series/dtm/champions/')).toContain('<a class="pd-ch-door" href="/series/gt-world/champions/"><small>/series/gt-world/champions/</small><b>GT World Challenge champions</b><span>Since 2014.</span><em>Open →</em></a>');
  });
});

describe('family A: the kit as the registry holds it', () => {
  it('names its races where the shared pages name them, and folds the weekend’s points under a Results row', () => {
    const f2 = seriesA('f2');
    expect([raceName(f2, 'Feature 1'), raceName(f2, 'Sprint'), raceName(f2, 'Feature 2', true)]).toEqual(['Feature Race 1', 'Sprint', 'FR2']);
    expect([raceName(seriesA('motogp'), 'Race', true), raceName(seriesA('motogp'), 'Grand Prix')]).toEqual(['GP', 'Grand Prix']);
    expect(at(F2, '/series/f2/results/')).toContain('<b>Dino Beganovic</b><small>DAMS Lucas Oil · Sprint: Miyata</small>');
    expect(at(WSBK, '/series/wsbk/results/')).toContain('<b>Nicolò Bulega</b><small>Aruba.it Racing - Ducati · Race 1: Bulega · Superpole Race: Bulega</small>');
    expect(at(F2, '/series/f2/results/')).toContain('<th class="n">Sprint</th><th class="n">Feature</th><th class="n tot">Total</th>');
  });

  it('builds every page a series lists, a session greyed without one', () => {
    // From the saved document, whose rounds but the ones read whole keep their races alone: their practice and
    // qualifying are greyed, with no page.
    expect([F2.size, F3.size, MOTO.size, WSBK.size, DTM.size]).toEqual([51, 40, 92, 63, 37]);
    expect([...F2.keys()].slice(0, 5)).toEqual(['/series/f2/', '/series/f2/results/', '/series/f2/standings/', '/series/f2/champions/', '/series/f2/2026/']);
    expect(groupsGrid({ title: 'A', columns: ['Pos', 'Driver', 'Team', 'Time'], rows: [['1', 'A1', 'T', '1:21.000'], ['2', 'A2', 'T', '1:21.500']] }, { title: 'B', columns: ['Pos', 'Driver', 'Team', 'Time'], rows: [['1', 'B1', 'T', '1:20.900'], ['NC', 'B2', 'T', '']] }).rows).toEqual([
      ['1', 'B1', 'T', '1:20.900', 'B'],
      ['2', 'A1', 'T', '1:21.000', 'A'],
      ['3', 'A2', 'T', '1:21.500', 'A'],
      ['NC', 'B2', 'T', '', 'B'],
    ]);
  });
});
