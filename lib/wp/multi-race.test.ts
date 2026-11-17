import { describe, expect, it } from 'vitest';
import type { FomResultRow } from '../results/fom-api';
import {
  answered,
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
  initialsSpeller,
  roundOver,
  sessionNone,
  sessionsWanted,
  timedTable,
  wsbkCarried,
  wsbkDue,
  wsbkPoints,
  wsbkRaceTable,
  wsbkScored,
  type DtmGroups,
} from './multi-race';
import { calledOffOf, padHour, type CalendarEntry, type ResultRound, type Table } from './render';

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

  it("builds a restarted race's table from its results answer, as the stored tables write it", () => {
    const row = (id: string, position: number, status: string, time: number | null) => ({ type: 'results', attributes: { position, status, time }, relationships: { rider: { data: { id } }, team: { data: { id: `t${id}` } } } });
    const names = ['Bulega', 'Lecuona', 'Lowes', 'Montella', 'Lowes', 'Baldassarri', 'Bassani', 'Surra', 'Bridewell'];
    const env = {
      data: [...names.slice(0, 8).map((_, i) => row(`r${i}`, i + 1, 'Classified', 1_000_000 + i * 1500)), row('r8', 15, 'Retired', null)],
      included: names.flatMap((n, i) => [{ type: 'rider', id: `r${i}`, attributes: { name: `R${i}`, surname: n } }, { type: 'team', id: `tr${i}`, attributes: { name: `Team ${i}` } }]),
    };
    const t = wsbkRaceTable('Race 1', env, false);
    expect(t?.columns).toEqual(['Pos', 'Rider', 'Team', 'Time', 'Pts']);
    expect(t?.rows[0]).toEqual(['1', 'R0 Bulega', 'Team 0', '16:40.000', '25']);
    expect(t?.rows[1]).toEqual(['2', 'R1 Lecuona', 'Team 1', '+1.500s', '20']);
    expect(t?.rows[8]).toEqual(['15', 'R8 Bridewell', 'Team 8', 'Retired', '0']);
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

  it("reads a round's session list while the round is run, until its races are known, and for a restarted race", () => {
    const known = (round: number, date: string, parts: number): ResultRound => ({ round, name: `Round ${round}`, date, sessions: [{ label: 'Race 1', tables: [], parts }, { label: 'Race 2', tables: [], parts: 1 }] });
    const rounds = [known(8, '2026-08-02', 1), known(9, '2026-09-06', 2), { ...known(10, '2026-09-27', 1), sessions: [{ label: 'Race 1', tables: [] }] }, known(12, '2026-10-18', 1)];
    const endOf = (round: number | null) => rounds.find(r => r.round === round)?.date;
    expect(wsbkDue(rounds, endOf, new Date('2026-11-17T08:00:00Z')).map(r => r.round)).toEqual([10, 9]);
    expect(wsbkDue(rounds, endOf, new Date('2026-10-19T08:00:00Z')).map(r => r.round)).toEqual([12, 10, 9]);
  });

  it('pays a retirement nothing in the stored tables', () => {
    expect(wsbkScored([magnyCours(nineLaps)])[0].sessions[0].tables[0].rows.map(r => r[4])).toEqual(['25', '0']);
  });
});
