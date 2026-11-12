import { describe, expect, it } from 'vitest';
import type { FomResultRow } from '../results/fom-api';
import { DTM_QUALIFYING_POINTS, dtmEvents, dtmRows, dtmSessions, dtmTable, dtmTime, fomQualifyingLabel, fomTable, nameSpeller, sessionsWanted, timedTable, wsbkPoints, wsbkRaceTable } from './multi-race';
import { calledOffOf, padHour, type CalendarEntry, type ResultRound } from './render';

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
    const spell = nameSpeller(file.teams.flatMap(t => t.drivers));
    expect(spell('M. Engel')).toBe('Maro Engel');
    expect(spell('K. van der Linde')).toBe('Kelvin van der Linde');
    expect(spell('B. Dörr')).toBe('Ben Dörr');
    expect(spell('P. Maximilian')).toBe('Maximilian Paul');
    expect(spell('C. Engelhart')).toBe('Christian Engelhart');
    expect(spell('S. Connor Primm')).toBe('Simon Connor Primm');
    expect(spell('X. Nobody')).toBe('X. Nobody');
    expect(nameSpeller([{ name: 'Max Muster' }, { name: 'Mia Muster' }])('M. Muster')).toBe('M. Muster');
  });
});

describe("DTM's events on motorsport.com (O33)", () => {
  it("reads the picker's events and the page's own, in the order of their ids, and nothing else", () => {
    const html =
      '<a class="msnt-select__option" href="/dtm/results/2026/zandvoort-665347/">Zandvoort</a>' +
      '<a class="msnt-select__option" href="/dtm/results/2026/red-bull-ring-665344/">Red Bull Ring</a>' +
      '<a class="ms-tab-menu__link" href="/dtm/results/2026/hockenheim-665365/?st=FP1">FP1</a>' +
      '<a href="/dtm/results/2026/hockenheim-663181/">another Hockenheim page</a>';
    expect(dtmEvents(html, 2026)).toEqual(['red-bull-ring-665344', 'zandvoort-665347', 'hockenheim-665365']);
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
});
