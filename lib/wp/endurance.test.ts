import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import type { ChampionNotesFile, HistoricTeamColor, RecordNotesFile } from '@/lib/series-content';
import type { Champion } from '@/lib/types';
import type { CalendarEntry, CalendarRound, Page, ResultRound, ResultSession, SeriesData, Table } from './render';
import { seriesFamily } from './series';
import { tabAnchor, weekendOf } from './weekend';
import {
  alkamelSession,
  calledOffLine,
  classBlock,
  classStandings,
  classWinners,
  CREW,
  crewCell,
  emptyCrews,
  enduranceChampions,
  enduranceKit,
  enduranceStandings,
  joinKey,
  fetchedRound,
  gtSessionOptions,
  gtTable,
  inShape,
  mergeRounds,
  nameKey,
  nameSpeller,
  plainName,
  respell,
  roundsDue,
  sessionsCalledOff,
  surnameOf,
  teamSpeller,
  tidyCaps,
  unitsOf,
  unitStates,
  wecCarCrew,
  wecCarsDue,
  wecCrewNames,
  wecDriverName,
  wecDriversDue,
  wecSession,
  wecTable,
  withResultTeams,
  withWecCrews,
  type WecCrews,
} from './endurance';

// Saved documents (tests/fixtures): the IMSA race files and the GT World and WEC pages captured for the fetchers, and
// the five cut on 28 Oct 2026 for family C (O34): a WEC car page and driver page, a WEC qualifying table, an IMSA
// qualifying file and a GT World combined qualifying.
const fixture = (name: string): string => readFileSync(path.join(process.cwd(), 'tests', 'fixtures', name), 'utf8');

const same = (name: string): string => name;
const none = (): string | null => null;

describe('names', () => {
  it('compares words whatever their order, case and accents', () => {
    expect(nameKey('Gounon Jules')).toBe(nameKey('Jules GOUNON'));
    expect(nameKey('Hirakawa Ryō')).toBe(nameKey('Ryo Hirakawa'));
    expect(nameKey('Sørensen Marco')).toBe(nameKey('Marco Sorensen'));
    expect(nameKey('Paul-Loup Chatin')).toBe(nameKey('Chatin Paul-Loup'));
  });

  it("spells a name as drivers.json does only when every word matches, never a part ('Daniel Harper' is not 'Dan Harper')", () => {
    const spell = nameSpeller(['Jules Gounon', 'Ryo Hirakawa', 'Tom Van Rompuy', 'Dan Harper', 'Pipo Derani']);
    expect(spell('Gounon Jules')).toBe('Jules Gounon');
    expect(spell('Hirakawa Ryō')).toBe('Ryo Hirakawa');
    expect(spell('Van Rompuy Tom')).toBe('Tom Van Rompuy');
    expect(spell('Harper Daniel')).toBeNull();
    expect(spell('Derani Luis Felipe')).toBeNull();
  });

  it('spells neither of two different names with the same words', () => {
    const spell = nameSpeller(['Marco Sørensen', 'Marco Sorensen']);
    expect(spell('Sorensen Marco')).toBeNull();
  });

  it('writes a name in capitals in ordinary case, and leaves any other alone', () => {
    expect(tidyCaps('JOSÉ MARÍA LÓPEZ')).toBe('José María López');
    expect(tidyCaps('PAUL-LOUP CHATIN')).toBe('Paul-Loup Chatin');
    expect(tidyCaps('AJ Allmendinger')).toBe('AJ Allmendinger');
  });

  it('joins a crew, each name spelled where it can be', () => {
    expect(crewCell(['Gounon Jules', ' Victor Martins '], nameSpeller(['Jules Gounon']))).toBe('Jules Gounon, Victor Martins');
  });

  it("finds a team's line whatever the case and accents of the name, so a kept round follows a line whose spelling changes", () => {
    const team = teamSpeller({ 'VISTA AF CORSE': 'VISTA AF Corse', 'RACING SPIRIT OF LEMAN': 'Racing Spirit of Léman', Rs1: 'RS1', 'TOYOTA RACING': 'TOYOTA RACING' });
    expect(team('VISTA AF CORSE')).toBe('VISTA AF Corse');
    expect(team('Vista AF Corse')).toBe('VISTA AF Corse');
    expect(team('Racing Spirit of Léman')).toBe('Racing Spirit of Léman');
    expect(team('RS1')).toBe('RS1');
    expect(team('Toyota Racing')).toBe('TOYOTA RACING');
    expect(team('TF SPORT')).toBeNull();
  });

  it('spells a kept round again, so an edit to drivers.json or team-names.json reaches it; an old table stays', () => {
    const kept: ResultRound[] = [
      {
        round: 11,
        name: 'Motul Petit Le Mans',
        date: '2026-10-03',
        sessions: [{ label: 'Race', tables: [{ title: 'LMP2', columns: ['Pos', 'No.', CREW, 'Team', 'Laps', 'Time', 'Gap'], rows: [['1', '04', 'George Kurtz, Alex Quinn', 'Crowdstrike Racing by APR', '', '', ''], ['2', '43', '', 'Inter Europol Competition', '', '', '']] }] }],
        others: [{ label: 'Qualifying', tables: [{ title: 'LMP2', columns: ['Pos', '#', 'Drivers', 'Team'], rows: [['1', '04', 'George Kurtz Alex Quinn', 'Crowdstrike Racing by APR']] }] }],
      },
    ];
    const out = respell(kept, nameSpeller(['Alexander Quinn']), t => (t === 'Crowdstrike Racing by APR' ? 'CrowdStrike Racing by APR' : t));
    expect(out[0].sessions[0].tables[0].rows[0].slice(2, 4)).toEqual(['George Kurtz, Alex Quinn', 'CrowdStrike Racing by APR']);
    expect(out[0].sessions[0].tables[0].rows[1][2]).toBe('');
    expect(out[0].others).toEqual(kept[0].others);
    expect(respell(kept, nameSpeller(['Alex Quinn', 'George Kurtz']), t => t)).toEqual(kept);
  });
});

describe('IMSA: Al Kamel class results', () => {
  const spell = nameSpeller(['Nick Yelloly', 'Connor De Phillippi']);
  const team = (t: string): string => ({ 'Af Corse Usa': 'AF Corse USA' })[t] ?? t;

  it('reads a qualifying a table a class, in IMSA order, each driver apart', () => {
    const s = alkamelSession(fixture('imsa-qualifying-petit-2026.json'), 'Qualifying', false, spell, team);
    expect(s?.label).toBe('Qualifying');
    expect(s?.tables.map(t => t.title)).toEqual(['GTP', 'LMP2', 'GTD Pro', 'GTD']);
    const gtp = s!.tables[0];
    expect(gtp.columns).toEqual(['Pos', 'No.', CREW, 'Team', 'Time', 'Laps', 'Gap']);
    expect(gtp.rows[1].slice(0, 4)).toEqual(['2', '93', 'Renger van der Zande, Nick Yelloly, Alex Palou', 'Acura Meyer Shank Racing w/Curb Agajanian']);
    expect(gtp.rows[1][6]).toBe('+0.222');
    // A two-word surname stays whole (the old join with spaces drew "Lilou Wadoux, Ducellier"); the team as IMSA writes it.
    const gtd = s!.tables[3];
    expect(gtd.rows[1][2]).toBe('Simon Mann, Lilou Wadoux Ducellier, Antonio Fuoco');
    expect(gtd.rows[1][3]).toBe('AF Corse USA');
  });

  it("reads a race with laps, time and the gap, the leader's gap empty", () => {
    const s = alkamelSession(fixture('imsa-results-daytona-2026.json'), 'Race', true, none, same);
    const gtp = s!.tables.find(t => t.title === 'GTP')!;
    expect(gtp.columns).toEqual(['Pos', 'No.', CREW, 'Team', 'Laps', 'Time', 'Gap']);
    expect(gtp.rows[0]).toEqual(['1', '7', 'Felipe Nasr, Julien Andlauer, Laurin Heinrich', 'Porsche Penske Motorsport', '705', '24:01:20.108', '']);
    expect(gtp.rows[1][6]).toBe('+1.569');
    expect(s!.tables.find(t => t.title === 'LMP2')!.rows[0][1]).toBe('04');
  });

  it("shows a car's status where its gap would be when it was not classified, never the gap Al Kamel also gives it", () => {
    const s = alkamelSession(fixture('imsa-results-sebring-2026.json'), 'Race', true, none, same);
    const dns = s!.tables.find(t => t.title === 'LMP2')!.rows.find(r => r[1] === '79');
    expect(dns?.[6]).toBe('Not Started');
    expect(s!.tables.find(t => t.title === 'LMP2')!.rows[1][6]).toMatch(/^\+|Laps?$/);
  });

  it('gives nothing for a file it cannot read or a class IMSA does not race', () => {
    expect(alkamelSession('not json', 'Race', true, none, same)).toBeNull();
    expect(alkamelSession(JSON.stringify({ classifications: [{ name: 'Other', classification: [{ position: 1 }] }] }), 'Race', true, none, same)).toBeNull();
  });
});

describe('WEC: fiawec.com', () => {
  it('names a session and its classes, and drops a called-off one', () => {
    expect(wecSession('QUALIFYING - LMP2 & LMGT3')).toEqual({ label: 'Qualifying', classes: ['LMP2', 'LMGT3'], race: false });
    expect(wecSession('HYPERPOLE 1 - HYPERCAR')).toEqual({ label: 'Hyperpole 1', classes: ['Hypercar'], race: false });
    expect(wecSession('FREE PRACTICE 2')).toEqual({ label: 'Free Practice 2', classes: null, race: false });
    expect(wecSession('WARM-UP')?.label).toBe('Warm-up');
    expect(wecSession('RACE')).toEqual({ label: 'Race', classes: null, race: true });
    expect(wecSession('HYPERPOLE - HYPERCAR - CANCELLED')).toBeNull();
  });

  it("reads a qualifying table, the best lap as its Time, the team as the team writes it", () => {
    const t = wecTable(fixture('wec-qualifying-barcelona-2026.html'), 'Hypercar', false, n => (n === 'GENESIS MAGMA RACING' ? 'Genesis Magma Racing' : n));
    expect(t?.columns).toEqual(['Pos', 'No.', CREW, 'Team', 'Time', 'Laps', 'Gap']);
    expect(t?.rows[0]).toEqual(['1', '19', '', 'Genesis Magma Racing', '1:30.479', '6', '']);
    expect(t?.rows[1]).toEqual(['2', '8', '', 'TOYOTA RACING', '1:30.623', '6', '+0.144']);
    expect(t?.rows).toHaveLength(17);
  });

  it('reads a race table of June, whose headings had no "N°" over the car', () => {
    const t = wecTable(fixture('wec-results-imola-race-hypercar-2026-06-12.html'), 'Hypercar', true, same);
    expect(t?.columns).toEqual(['Pos', 'No.', CREW, 'Team', 'Laps', 'Time', 'Gap']);
    expect(t?.rows[0]).toEqual(['1', '8', '', 'TOYOTA RACING', '213', '6:00:10.939', '']);
    expect(t?.rows[1]).toEqual(['2', '51', '', 'FERRARI AF CORSE', '213', '6:00:24.291', '13.352']);
  });

  it("reads a car's crew for one race from its car page: Fuji's #36 without Makowiecki", () => {
    expect(wecCarCrew(fixture('wec-car-fuji-2026.html'))).toEqual([
      { id: '9500', card: 'Gounon Jules' },
      { id: expect.any(String), card: 'Martins Victor' },
    ]);
  });

  it("reads a driver's name in reading order from the driver's page", () => {
    expect(wecDriverName(fixture('wec-driver-2026.html'))).toBe('Nicholas Yelloly');
    expect(wecDriverName('<h1>Yelloly</h1>')).toBeNull();
  });

  const crews: WecCrews = {
    races: { '4954': { '36': ['9500', '9501'], '43': ['8790'] } },
    drivers: { '9500': { card: 'Gounon Jules' }, '9501': { card: 'Martins Victor' }, '8790': { card: 'Yelloly Nicholas' } },
  };
  const spell = nameSpeller(['Jules Gounon', 'Victor Martins']);

  it('names a whole crew or none, never half of one', () => {
    expect(wecCrewNames(crews, 4954, '36', spell)).toEqual(['Jules Gounon', 'Victor Martins']);
    expect(wecCrewNames(crews, 4954, '43', spell)).toBeNull();
    expect(wecCrewNames({ ...crews, drivers: { ...crews.drivers, '8790': { card: 'Yelloly Nicholas', name: 'Nicholas Yelloly' } } }, 4954, '43', spell)).toEqual(['Nicholas Yelloly']);
    expect(wecCrewNames(crews, 4954, '8', spell)).toBeNull();
  });

  const fuji: ResultRound = {
    round: 6,
    name: '6 Hours of Fuji',
    date: '2026-09-27',
    sessions: [{ label: 'Race', tables: [{ title: 'Hypercar', columns: ['Pos', 'No.', CREW, 'Team', 'Laps', 'Time', 'Gap'], rows: [['1', '8', '', 'Toyota Racing', '', '', ''], ['2', '36', '', 'Alpine Endurance Team', '', '', '']] }] }],
    others: [{ label: 'Free Practice 1', tables: [{ title: 'LMP2', columns: ['Pos', 'No.', CREW, 'Team', 'Time', 'Laps', 'Gap'], rows: [['1', '43', '', 'Inter Europol Competition', '', '', '']] }] }],
  };
  const old: ResultRound = { round: 5, name: 'Lone Star Le Mans', date: '2026-09-06', sessions: [{ label: 'Race', tables: [{ title: 'Hypercar', columns: ['Pos', '#', 'Drivers', 'Team', 'Gap'], rows: [['1', '8', 'BRENDON HARTLEY', 'TOYOTA RACING', '']] }] }] };
  const raceIds = new Map([[5, 4953], [6, 4954]]);

  it("fills each table's Crew from the stored crews and leaves an old table alone", () => {
    const [lone, filled] = withWecCrews([old, fuji], raceIds, crews, spell);
    expect(filled.sessions[0].tables[0].rows.map(r => r[2])).toEqual(['', 'Jules Gounon, Victor Martins']);
    expect(filled.others?.[0].tables[0].rows[0][2]).toBe('');
    expect(lone).toEqual(old);
  });

  it('asks for the car pages it lacks, the newest round first, and the driver pages drivers.json cannot spell', () => {
    expect(wecCarsDue([fuji], raceIds, emptyCrews()).map(c => c.car)).toEqual(['8', '36', '43']);
    expect(wecDriversDue(crews, spell)).toEqual(['8790']);
  });

  it('reads a crew read before its race once more after it, then never again', () => {
    // Fuji's race is classified: #36 and #43 were read, but not with the race classified, so they are read again.
    expect(wecCarsDue([old, fuji], raceIds, crews)).toEqual([
      { raceId: 4954, car: '8', afterRace: true },
      { raceId: 4954, car: '36', afterRace: true },
      { raceId: 4954, car: '43', afterRace: true },
    ]);
    expect(wecCarsDue([fuji], raceIds, { ...crews, afterRace: { '4954': ['36', '43'] } })).toEqual([{ raceId: 4954, car: '8', afterRace: true }]);
    // Before the race has a classification, a crew read once is kept.
    const weekend: ResultRound = { ...fuji, sessions: [] };
    expect(wecCarsDue([weekend], raceIds, crews)).toEqual([]);
    expect(wecCarsDue([weekend], raceIds, emptyCrews())).toEqual([{ raceId: 4954, car: '43', afterRace: false }]);
  });
});

describe('GT World: event pages and session tables', () => {
  it("lists an event's sessions in running order, the race's checkpoints left out", () => {
    const options = gtSessionOptions(fixture('gtw-event-paulricard-2026.html'));
    expect(options.map(o => o.label)).toEqual(['Bronze Test', 'Free Practice 1', 'Free Practice 2', 'Qualifying 1', 'Qualifying 2', 'Qualifying 3', 'Qualifying Combined', 'Main Race']);
    expect(options.filter(o => o.race).map(o => o.id)).toEqual([1749]);
  });

  it('leaves out the pit walks, the parade and the test days, and keeps the Bronze Test', () => {
    const select = (labels: string[]) =>
      `<select id="filter_race_id"><option value="">Session</option>${labels.map((l, i) => `<option value="${i + 1}">${l}</option>`).join('')}</select>`;
    const labels = gtSessionOptions(select(['Race 2', 'Pit Walk', 'Spa Parade', 'Free Practice 1', 'Bronze Test', 'Official Paid Test Session 1', 'Official test sessions'])).map(o => o.label);
    expect(labels).toEqual(['Bronze Test', 'Free Practice 1', 'Race 2']);
  });

  it("reads an endurance round's combined qualifying, its average as Time and each driver's time beside it", () => {
    const t = gtTable(fixture('gtw-qualifying-portimao-2026.html'), 'Qualifying Combined', false, nameSpeller(['Maximilian Götz']));
    expect(t?.columns).toEqual(['Pos', 'No.', CREW, 'Team', 'Cup', 'Time', 'Time 1', 'Time 2', 'Time 3']);
    expect(t?.rows[0]).toEqual(['1', '2', 'Morris Schuring, Dorian Boccolacci, Alessio Picariello', 'Boutsen VDS', 'Pro Cup', '1:42.071', '1:42.445', '1:41.856', '1:41.912']);
    expect(t?.rows[1][2]).toBe('Ralf Aron, Maximilian Götz, Fabian Schiller');
  });

  it('keeps the cars listed unclassified after the classified places, marked as the site marks them', () => {
    const row = (...cells: string[]) => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    const html =
      '<table><thead><tr><th>Pos</th><th>Car #</th><th>Class</th><th>Drivers</th><th>Team</th><th>Car</th><th>Time</th><th>Laps</th><th>Gap</th></tr></thead><tbody>' +
      row('DSQ', '58', 'Gold Cup', 'Thomas Fleming, Louis Prette, Benjamin Goethe', 'Garage 59', 'McLaren 720S GT3 EVO', '1:44.549', '', '') +
      row('NC', '54', 'Silver Cup', 'Tanart Sathienthirakul', 'Dinamic GT', 'Porsche', '1:45.193', '49', '-1:30:35.200') +
      row('2', '80', 'Pro Cup', 'Ricardo Feller', 'Lionspeed GP', 'Porsche', '1:44.200', '94', '1.1') +
      row('1', '17', 'Pro Cup', 'Ralf Aron', 'Mercedes-AMG Team GetSpeed', 'Mercedes', '1:44.190', '94', '') +
      row('', '99', 'Pro Cup', 'Nobody', 'None', 'None', '', '', '') +
      '</tbody></table>';
    expect(gtTable(html, 'Main Race', true, none)?.rows.map(r => `${r[0]}#${r[1]}`)).toEqual(['1#17', '2#80', 'DSQ#58', 'NC#54']);
  });

  it("reads a sprint race with its cup, each car's best lap (GT World gives a race no total time), laps and gap", () => {
    const t = gtTable(fixture('gtw-race-brandshatch-r1-2026.html'), 'Race 1', true, none);
    expect(t?.columns).toEqual(['Pos', 'No.', CREW, 'Team', 'Cup', 'Best lap', 'Laps', 'Gap']);
    expect(t?.rows[0]).toEqual(['1', '50', 'Arthur Leclerc, Thomas Neubauer', 'AF Corse', 'Pro Cup', '1:24.132', '39', '']);
    // Second, with a faster lap than the winner's: a best lap, not a race time.
    expect([t?.rows[1][1], t?.rows[1][5]]).toEqual(['2', '1:24.020']);
  });
});

describe('what a run fetches and keeps', () => {
  const rounds = [
    { round: 1, startDate: '2026-04-17', endDate: '2026-04-19', name: 'Imola' },
    { round: 6, startDate: '2026-09-25', endDate: '2026-09-27', name: 'Fuji' },
    { round: 7, startDate: '2026-10-16', endDate: '2026-10-18', name: 'Barcelona' },
    { round: 8, startDate: '2026-11-06', endDate: '2026-11-08', name: 'Monza' },
  ];
  // A stored round as fetchedRound writes it: dated with its round's last day.
  const shaped = (round: number, date: string): ResultRound => ({ round, name: '', date, sessions: [{ label: 'Race', tables: [{ title: 'Hypercar', columns: ['Pos', 'No.', CREW], rows: [] }] }] });
  const stored2026 = [shaped(1, '2026-04-19'), shaped(6, '2026-09-27'), shaped(7, '2026-10-18')];
  const now = new Date('2026-10-23T12:00:00Z');

  it('fetches a round still settling and one not yet in this shape, the newest first, and never one not started', () => {
    expect(roundsDue(rounds, stored2026, now, 5)).toEqual([7]);
    expect(roundsDue(rounds, [shaped(1, '2026-04-19')], now, 5)).toEqual([7, 6]);
    expect(roundsDue(rounds, null, now, 2)).toEqual([7, 6]);
    expect(roundsDue(rounds, stored2026, new Date('2026-10-26T00:00:00Z'), 5)).toEqual([]);
  });

  it("never counts last season's round of the same number as this season's", () => {
    const rounds2027 = [{ round: 2, startDate: '2027-03-18', endDate: '2027-03-20', name: 'Sebring' }];
    // 2027's round 2 is past its week; the stored round 2 is 2026's, so 2027's is still due.
    expect(roundsDue(rounds2027, [shaped(2, '2026-03-21')], new Date('2027-04-15T00:00:00Z'), 5)).toEqual([2]);
    expect(roundsDue(rounds2027, [shaped(2, '2027-03-20')], new Date('2027-04-15T00:00:00Z'), 5)).toEqual([]);
  });

  it('tells a round of this shape from one stored before it', () => {
    expect(inShape(shaped(1, '2026-04-19'))).toBe(true);
    expect(inShape({ round: 1, name: '', date: null, sessions: [{ label: 'Race', tables: [{ title: 'GTP', columns: ['Pos', '#', 'Drivers'], rows: [] }] }] })).toBe(false);
    expect(inShape(undefined)).toBe(false);
  });

  it("builds a round from its sessions, named and dated as rounds.json does", () => {
    const table = { title: 'GTP', columns: ['Pos'], rows: [] };
    const r = fetchedRound({ round: 11, name: 'Motul Petit Le Mans', endDate: '2026-10-03' }, [
      { label: 'Practice 1', tables: [table], race: false },
      { label: 'Qualifying', tables: [table], race: false },
      { label: 'Race', tables: [table], race: true },
    ]);
    expect(r).toEqual({ round: 11, name: 'Motul Petit Le Mans', date: '2026-10-03', sessions: [{ label: 'Race', tables: [table] }], others: [{ label: 'Practice 1', tables: [table] }, { label: 'Qualifying', tables: [table] }] });
  });

  it('keeps no round from a fetch that was not whole: a request unanswered or the time run out', () => {
    const table = { title: 'Hypercar', columns: [CREW], rows: [] };
    const entry = { round: 6, name: '6 Hours of Fuji', endDate: '2026-09-27' };
    const race = { label: 'Race', tables: [table], race: true };
    const practice = { label: 'Free Practice 1', tables: [table], race: false };
    expect(fetchedRound(entry, [race, practice], ['Free Practice 2 on (out of time)'])).toBeNull();
    expect(fetchedRound(entry, [race], ['Free Practice 1 LMGT3'])).toBeNull();
    expect(fetchedRound(entry, [])).toBeNull();
    expect(fetchedRound(entry, [race, practice])?.others?.map(s => s.label)).toEqual(['Free Practice 1']);
  });

  const t = (title: string, shape = true) => ({ title, columns: shape ? ['Pos', 'No.', CREW] : ['Pos', '#', 'Drivers'], rows: [] });

  it('keeps a stored session a fetch did not bring back, and every round it did not fetch', () => {
    // One class's table, marked by its row: the stored version and the fetched one.
    const v = (version: string) => ({ title: 'Hypercar', columns: ['Pos', 'No.', CREW], rows: [[version]] });
    const stored: ResultRound[] = [
      { round: 1, name: 'Imola', date: '2026-04-19', sessions: [{ label: 'Race', tables: [v('stored')] }] },
      { round: 6, name: 'Fuji', date: '2026-09-27', sessions: [{ label: 'Race', tables: [v('stored')] }], others: [{ label: 'Free Practice 1', tables: [v('stored')] }] },
    ];
    const fresh: ResultRound[] = [{ round: 6, name: '6 Hours of Fuji', date: '2026-09-27', sessions: [], others: [{ label: 'Free Practice 1', tables: [v('fetched')] }] }];
    const out = mergeRounds(fresh, stored, 2026);
    expect(out.map(r => r.round)).toEqual([1, 6]);
    expect(out[1].name).toBe('6 Hours of Fuji');
    expect(out[1].sessions[0].tables.map(x => x.rows[0][0])).toEqual(['stored']);
    expect(out[1].others?.[0].tables.map(x => x.rows[0][0])).toEqual(['fetched']);
    expect(out[0]).toBe(stored[0]);
  });

  it("keeps a stored class table the fetched session lacks, and the sessions' running order", () => {
    const stored: ResultRound[] = [
      {
        round: 6,
        name: 'Fuji',
        date: '2026-09-27',
        sessions: [{ label: 'Race', tables: [t('Hypercar'), t('LMGT3')] }],
        others: [{ label: 'Free Practice 1', tables: [t('Hypercar')] }, { label: 'Free Practice 2', tables: [t('Hypercar')] }, { label: 'Qualifying', tables: [t('Hypercar')] }],
      },
    ];
    const fresh: ResultRound[] = [
      { round: 6, name: 'Fuji', date: '2026-09-27', sessions: [{ label: 'Race', tables: [t('Hypercar')] }], others: [{ label: 'Free Practice 2', tables: [t('Hypercar')] }, { label: 'Qualifying', tables: [t('Hypercar')] }] },
    ];
    const [round] = mergeRounds(fresh, stored, 2026);
    expect(round.sessions[0].tables.map(x => x.title)).toEqual(['Hypercar', 'LMGT3']);
    expect(round.others?.map(s => s.label)).toEqual(['Free Practice 1', 'Free Practice 2', 'Qualifying']);
  });

  it('drops what was stored in the old shape beside a fetched round', () => {
    const stored: ResultRound[] = [{ round: 6, name: 'Fuji', date: '2026-09-27', sessions: [{ label: 'Race', tables: [t('Hypercar', false), t('LMP2', false)] }, { label: 'Main Race after 6 hours', tables: [t('Overall', false)] }] }];
    const fresh: ResultRound[] = [{ round: 6, name: 'Fuji', date: '2026-09-27', sessions: [{ label: 'Race', tables: [t('Hypercar')] }] }];
    const [round] = mergeRounds(fresh, stored, 2026);
    expect(round.sessions.map(s => s.label)).toEqual(['Race']);
    expect(round.sessions[0].tables.map(x => x.title)).toEqual(['Hypercar']);
    expect(inShape(round)).toBe(true);
  });

  it("keeps the season's rounds only, never mixing last season's into this one's", () => {
    const stored: ResultRound[] = [
      { round: 1, name: 'Daytona', date: '2026-01-25', sessions: [{ label: 'Race', tables: [t('GTP')] }] },
      { round: 2, name: 'Sebring', date: '2026-03-21', sessions: [{ label: 'Race', tables: [t('GTP')] }] },
    ];
    const fresh: ResultRound[] = [{ round: 1, name: 'Daytona', date: '2027-01-24', sessions: [{ label: 'Race', tables: [t('GTP')] }] }];
    expect(mergeRounds(fresh, stored, 2027).map(r => `${r.round} ${r.date}`)).toEqual(['1 2027-01-24']);
    expect(mergeRounds([], stored, 2026)).toEqual(stored);
  });
});

// ── The pages (O34's second PR), from the saved document ─────────────────────
//
// tests/fixtures/endurance.json: the stored shapes as the publisher keeps them (its `about` says what and from where).
// WEC every round's race with Le Mans (round 3) and Fuji (round 6) whole, IMSA Daytona (round 1), GT World Spa (round 4)
// and Zandvoort (round 8). The rounds called off and Fuji's qualifying are read from content/series/wec/rounds.json, as
// the publisher's registry line reads them.

type Slug = 'wec' | 'imsa' | 'gt-world';
interface Saved {
  name: string;
  rounds: CalendarRound[];
  calendar: CalendarEntry[];
  results: ResultRound[];
  /** The races of the rounds `results` does not hold (PR 3's Standings and Champions read both). */
  races?: ResultRound[];
  standings: Table[];
  teams: { name: string; colour: string }[];
}
const saved = (JSON.parse(fixture('endurance.json')) as { series: Record<Slug, Saved> }).series;

interface RawCancelled {
  originalRound: number;
  name: string;
  place?: string;
  originalStartDate: string;
  originalEndDate: string;
  reason?: string;
}
const wecFile = JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'series', 'wec', 'rounds.json'), 'utf8')) as { rounds: { round: number }[]; cancelledRounds: RawCancelled[] };

const kit = enduranceKit({
  offLine: (slug, c) => (slug === 'wec' ? calledOffLine(wecFile.cancelledRounds.find(x => x.originalRound === c.round && x.name === c.name)) : '') || (c.reason ?? `Round ${c.round}`),
  calledOff: (slug, round) => (slug === 'wec' ? sessionsCalledOff(wecFile.rounds.find(r => r.round === round)) : []),
});

/** A series as the publisher hands it to the kit, from the saved document. */
function seriesOf(slug: Slug, extra: Partial<SeriesData> = {}): SeriesData {
  const s = saved[slug];
  return {
    slug,
    name: s.name,
    season: 2026,
    standings: s.standings,
    results: s.results,
    calendar: s.calendar,
    rounds: s.rounds,
    teams: withResultTeams(
      s.teams.map(x => ({ ...x, drivers: [] })),
      s.results,
    ),
    ...(slug === 'wec'
      ? { cancelled: wecFile.cancelledRounds.map(c => ({ round: c.originalRound, name: c.name, ...(c.place ? { place: c.place } : {}), from: c.originalStartDate, to: c.originalEndDate, ...(c.reason ? { reason: c.reason } : {}) })) }
      : {}),
    sites: { [slug]: { family: 'C', pages: ['results', 'weekends'] } },
    ...extra,
  };
}

const pagesOf = (d: SeriesData, k = kit): Map<string, Page> => new Map(k.weekendPages(d).map(p => [p.path, p]));
const roundOf = (d: SeriesData, n: number): CalendarRound => (d.rounds ?? []).find(r => r.round === n) as CalendarRound;
const unitList = (d: SeriesData, n: number) => unitsOf(weekendOf(d, 2026, roundOf(d, n)));
const resultOf = (d: SeriesData, n: number): ResultRound => (d.results ?? []).find(r => r.round === n) as ResultRound;
const body = (pages: Map<string, Page>, at: string): string => pages.get(at)?.body ?? '';
/** One panel of a results table with tabs: from its tab's name to the next panel. */
const panel = (html: string, tab: string): string => {
  const from = html.indexOf(`data-pd-tab="${tab}"`);
  const to = html.indexOf('<section class="pd-rt-p"', from);
  return from < 0 ? '' : html.slice(from, to < 0 ? html.indexOf('</section></div>', from) : to);
};
const rowsIn = (html: string): number => (html.match(/<tr><td class="p">/g) ?? []).length;
const tabsOf = (html: string): string[] => [...html.matchAll(/data-pd-tab="([^"]+)"/g)].map(m => m[1]);
const barOf = (html: string): string[] => [...(/<nav class="pd-wb".*?<\/nav>/.exec(html)?.[0] ?? '').matchAll(/<(?:a|span)[^>]*>([^<]+)<small>(.*?)<\/small>/g)].map(m => `${m[1]} | ${m[2].replace(/<[^>]+>/g, '')}`);

const wec = seriesOf('wec');
const imsa = seriesOf('imsa');
const gtw = seriesOf('gt-world');
const wecPages = pagesOf(wec);
const imsaPages = pagesOf(imsa);
const gtwPages = pagesOf(gtw);
const FUJI = '/series/wec/2026/round-6/';
const LE_MANS = '/series/wec/2026/round-3/';
const DAYTONA = '/series/imsa/2026/round-1/';
const SPA = '/series/gt-world/2026/round-4/';
const ZANDVOORT = '/series/gt-world/2026/round-8/';

describe("family C's units: the timetable's names paired with the stored labels by kind and order (O34)", () => {
  it('reads a timetable name without its class, its brackets or its prefix', () => {
    expect(plainName('Le Mans Hyperpole 1 (LMP2 & LMGT3)')).toBe('Hyperpole 1');
    expect(plainName('LMGT3 Free Practice 3')).toBe('Free Practice 3');
    expect(plainName('Practice 2 (Night)')).toBe('Practice 2');
    expect(plainName('Sprint Race 1')).toBe('Race 1');
    expect(plainName('Qualifying 1 (Group A)')).toBe('Qualifying 1');
    expect(plainName('24 Hours of Le Mans (Race Start)')).toBe('24 Hours of Le Mans');
  });

  it("WEC: every qualifying part on one Qualifying page, Le Mans' prefix and its classes read past, the race by any name", () => {
    const { units, left } = unitList(wec, 3);
    expect(units.map(u => u.label)).toEqual(['Free Practice 1', 'Qualifying', 'Free Practice 2', 'Free Practice 3', 'Free Practice 4', 'Warm-up', 'Race']);
    expect(units[1].entries.map(e => e.session)).toEqual([
      'Le Mans Qualifying (LMP2 & LMGT3)',
      'Le Mans Qualifying (Hypercar)',
      'Le Mans Hyperpole 1 (LMP2 & LMGT3)',
      'Le Mans Hyperpole 2 (LMP2 & LMGT3)',
      'Le Mans Hyperpole 1 (Hypercar)',
      'Le Mans Hyperpole 2 (Hypercar)',
    ]);
    expect(units[1].sessions.map(s => s.label)).toEqual(['Qualifying', 'Hyperpole 1', 'Hyperpole 2']);
    expect(units[5].entries.map(e => e.session)).toEqual(['Le Mans Warm-up']);
    expect(units[6].entries.map(e => e.session)).toEqual(['24 Hours of Le Mans (Race Start)']);
    expect(units.every(u => u.sessions.length > 0)).toBe(true);
    expect(left).toEqual([]);
  });

  it("IMSA: a practice by its number, the timetable's Final Practice with the Practice 3 left", () => {
    const { units, left } = unitList(imsa, 1);
    expect(units.map(u => `${u.label} <- ${u.entries.map(e => e.session).join(', ')}`)).toEqual([
      'Practice 1 <- Practice 1',
      'Qualifying <- Qualifying',
      'Practice 2 <- Practice 2 (Night)',
      'Practice 3 <- Final Practice',
      'Race <- Rolex 24 At Daytona (Race)',
    ]);
    expect(units.map(u => u.sessions.map(s => s.label).join(', '))).toEqual(['Practice 1', 'Qualifying', 'Practice 2', 'Practice 3', 'Race']);
    expect(left).toEqual([]);
  });

  it('GT World, a Sprint Cup round: a Qualifying page before each race, its groups and their combined order on it', () => {
    const { units, left } = unitList(gtw, 8);
    expect(units.map(u => u.label)).toEqual(['Free Practice 1', 'Free Practice 2', 'Qualifying 1', 'Race 1', 'Qualifying 2', 'Race 2']);
    expect(units[2].entries.map(e => e.session)).toEqual(['Qualifying 1 (Group A)', 'Qualifying 1 (Group B)']);
    expect(units[2].sessions.map(s => s.label)).toEqual(['Qualifying 1 - Group A', 'Qualifying 1 - Group B', 'Qualifying 1 Combined']);
    expect(units[4].sessions.map(s => s.label)).toEqual(['Qualifying 2 - Group A', 'Qualifying 2 - Group B', 'Qualifying 2 Combined']);
    expect(units[3].entries.map(e => e.session)).toEqual(['Sprint Race 1']);
    expect(units[5].sessions.map(s => s.label)).toEqual(['Race 2']);
    expect(left).toEqual([]);
  });

  it('GT World, an Endurance Cup round: the driver sessions, their combined order and the Superpole on one Qualifying page; a name with nothing stored is not stored', () => {
    const { units, left } = unitList(gtw, 4);
    expect(units.map(u => u.label)).toEqual(['Bronze Test', 'Free Practice 1', 'Free Practice 2', 'Qualifying', 'Night Practice', 'Warm Up', 'Race']);
    expect(units[3].entries.map(e => e.session)).toEqual(['Qualifying 1', 'Qualifying 2', 'Qualifying 3', 'Qualifying 4', 'Superpole']);
    expect(units[3].sessions.map(s => s.label)).toEqual(['Qualifying 1', 'Qualifying 2', 'Qualifying 3', 'Qualifying 4', 'Qualifying Combined', 'Superpole', 'Superpole 1', 'Superpole 2', 'Superpole 3', 'Superpole 4']);
    expect(units[6].sessions.map(s => s.label)).toEqual(['Main Race']);
    expect(unitStates(units, [])).toEqual(['run', 'run', 'run', 'run', 'run', 'off', 'run']);
    expect(left).toEqual([]);
  });

  it("Fuji: its qualifying is called off by rounds.json's word, and without it reads as not stored, never as still to run", () => {
    const { units } = unitList(wec, 6);
    expect(units.map(u => u.label)).toEqual(['Free Practice 1', 'Free Practice 2', 'Free Practice 3', 'Qualifying', 'Race']);
    expect(units[3].entries.map(e => e.session)).toEqual(['LMGT3 Qualifying', 'LMGT3 Hyperpole', 'Hypercar Qualifying', 'Hypercar Hyperpole']);
    expect(units[3].sessions).toEqual([]);
    const off = sessionsCalledOff(wecFile.rounds.find(r => r.round === 6));
    expect(off).toEqual([
      {
        session: 'Qualifying',
        note: 'Qualifying and Hyperpole called off for rain: the grid came from each car’s fastest lap in the three free practices',
        source: 'https://www.fiawec.com/en/news/alpine-locks-out-front-row-after-qualifying-cancelled-at-fuji/13817',
      },
    ]);
    expect(unitStates(units, off)).toEqual(['run', 'run', 'run', 'x', 'run']);
    expect(unitStates(units, [])).toEqual(['run', 'run', 'run', 'off', 'run']);
    // A part's own name calls the page off too.
    expect(unitStates(units, [{ session: 'LMGT3 Hyperpole', note: 'n', source: 'https://example.org/' }])[3]).toBe('x');
  });

  it("a session run a class at a time is one unit (Barcelona's Free Practice 3)", () => {
    const calendar = (wec.calendar ?? []).flatMap(e =>
      e.round === 6 && e.session === 'Free Practice 3' ? [{ ...e, session: 'LMGT3 Free Practice 3' }, { ...e, session: 'Hypercar Free Practice 3', start: '2026-09-26T03:00:00.000Z', end: '2026-09-26T04:00:00.000Z' }] : [e],
    );
    const { units, left } = unitList(seriesOf('wec', { calendar }), 6);
    expect(units.map(u => u.label)).toEqual(['Free Practice 1', 'Free Practice 2', 'Free Practice 3', 'Qualifying', 'Race']);
    expect(units[2].entries.map(e => e.session)).toEqual(['LMGT3 Free Practice 3', 'Hypercar Free Practice 3']);
    expect(units[2].sessions.map(s => s.label)).toEqual(['Free Practice 3']);
    expect(left).toEqual([]);
  });

  it('a stored session the timetable does not name stands alone and is named for the log; a pit walk is no unit', () => {
    const calendar = [
      ...(wec.calendar ?? []).filter(e => !(e.round === 6 && e.session === 'Free Practice 2')),
      { start: '2026-09-26T02:00:00.000Z', end: '2026-09-26T02:45:00.000Z', dateOnly: false, event: '6 Hours of Fuji', session: 'Pit Walk', round: 6 },
    ];
    const { units, left } = unitList(seriesOf('wec', { calendar }), 6);
    expect(units.map(u => u.label)).toEqual(['Free Practice 1', 'Free Practice 3', 'Free Practice 2', 'Qualifying', 'Race']);
    expect(units[2].entries).toEqual([]);
    expect(left).toEqual(['Free Practice 2: stored, not in the timetable']);
  });

  it('before its results a session is still to run; once a later one is stored, not stored', () => {
    const fuji = resultOf(wec, 6);
    const first = (fuji.others ?? []).filter(s => s.label === 'Free Practice 1');
    const during = seriesOf('wec', { results: [{ ...fuji, sessions: [], others: first }] });
    expect(unitStates(unitList(during, 6).units, [])).toEqual(['run', 'up', 'up', 'up', 'up']);
    const before = seriesOf('wec', { results: [] });
    expect(unitStates(unitList(before, 6).units, [])).toEqual(['up', 'up', 'up', 'up', 'up']);
    const gap = seriesOf('wec', { results: [{ ...fuji, others: (fuji.others ?? []).filter(s => s.label !== 'Free Practice 2') }] });
    expect(unitStates(unitList(gap, 6).units, [])).toEqual(['run', 'off', 'run', 'off', 'run']);
  });

  it("another championship's cars under a GT World session's name are left out (Paul Ricard's Free Practice 1 on its site)", () => {
    const spa = resultOf(gtw, 4);
    const others = (spa.others ?? []).map(s =>
      s.label === 'Free Practice 1' ? { ...s, tables: s.tables.map(t => ({ ...t, rows: t.rows.map(r => r.map((c, i) => (t.columns[i] === 'Cup' ? (Number(r[0]) % 2 ? 'AM' : 'PRO-AM') : c))) })) } : s,
    );
    const d = seriesOf('gt-world', { results: [{ ...spa, others }] });
    const { units } = unitList(d, 4);
    expect(units[1].label).toBe('Free Practice 1');
    expect(units[1].sessions).toEqual([]);
    expect(unitStates(units, [])[1]).toBe('off');
    const lines: string[] = [];
    const pages = pagesOf(d, enduranceKit({ log: line => lines.push(line) }));
    expect(lines).toContain("gt-world R4 Free Practice 1: another championship's cars, left out");
    expect(lines).toContain('gt-world R4 Free Practice 1: not stored');
    expect(pages.has(`${SPA}free-practice-1/`)).toBe(false);
    expect(barOf(body(pages, SPA))).toContain('Free Practice 1 | Thu · not stored');
  });
});

describe("family C's weekend pages (O34), as drawn on Endurance Weekend Drafts", () => {
  it("builds the season, each round's Overview and a page a unit; none for a unit called off or not stored", () => {
    expect(wecPages.has('/series/wec/2026/')).toBe(true);
    expect([...wecPages.keys()].filter(p => p.startsWith(FUJI))).toEqual([FUJI, `${FUJI}free-practice-1/`, `${FUJI}free-practice-2/`, `${FUJI}free-practice-3/`, `${FUJI}race/`]);
    expect([...wecPages.keys()].filter(p => p.startsWith(LE_MANS))).toEqual([
      LE_MANS,
      `${LE_MANS}free-practice-1/`,
      `${LE_MANS}qualifying/`,
      `${LE_MANS}free-practice-2/`,
      `${LE_MANS}free-practice-3/`,
      `${LE_MANS}free-practice-4/`,
      `${LE_MANS}warm-up/`,
      `${LE_MANS}race/`,
    ]);
    expect([...gtwPages.keys()].filter(p => p.startsWith(ZANDVOORT))).toEqual([ZANDVOORT, `${ZANDVOORT}free-practice-1/`, `${ZANDVOORT}free-practice-2/`, `${ZANDVOORT}qualifying-1/`, `${ZANDVOORT}race-1/`, `${ZANDVOORT}qualifying-2/`, `${ZANDVOORT}race-2/`]);
    expect(gtwPages.has(`${SPA}warm-up/`)).toBe(false);
    for (const p of [...wecPages.values(), ...imsaPages.values(), ...gtwPages.values()]) expect(p.template).toBe('page-wide');
    expect(enduranceKit().weekendPages({ ...wec, sites: {} })).toEqual([]);
  });

  it('O, the Overview after the race (Fuji): the strip names each class winner, the bar every unit, the results a tab a class', () => {
    const html = body(wecPages, FUJI);
    expect(html).toContain('<p class="pd-wk-crumb"><a href="/series/wec/">FIA WEC</a> › <a href="/series/wec/2026/">2026 season</a> › Round 6 of 8</p><h1>6 Hours of Fuji</h1>');
    expect(html).toContain('<em class="pd-wk-pill is-fin">Final</em><span class="pd-wk-sum"><b>#8 TOYOTA RACING</b> won (Hartley, Hirakawa, Buemi); LMGT3 to #32 Team WRT</span>');
    expect(barOf(html)).toEqual(['Overview | the weekend', 'Free Practice 1 | Fri · #8', 'Free Practice 2 | Fri · #36', 'Free Practice 3 | Sat · #36', 'Qualifying | Sat · called off', 'Race | Sun · #8']);
    expect(html).toContain('<span class="is-x">Qualifying<small>Sat · called off</small></span>');
    expect(html).toContain('<a href="/series/wec/2026/round-6/race/">Race<small>Sun · #8</small></a>');
    expect(html).toContain(
      '<h2>Results</h2><p class="pd-wk-hint">Sunday · 6 hours · a class at a time</p></div>' +
        '<p class="pd-ec-flag">Qualifying and Hyperpole called off for rain: the grid came from each car’s fastest lap in the three free practices</p><div class="pd-rt">',
    );
    expect(tabsOf(html)).toEqual(['Hypercar · 17 cars', 'LMGT3 · 18 cars']);
    const hypercar = panel(html, 'Hypercar · 17 cars');
    expect(hypercar).toContain('<thead><tr><th class="p">Pos</th><th class="no">No.</th><th class="crew">Crew</th><th class="tm">Team</th><th class="t">Gap</th></tr></thead>');
    expect(hypercar).toContain('<tr><td class="p">1</td><td class="no">#8</td><td class="crew">Brendon Hartley, Ryo Hirakawa, Sébastien Buemi</td><td class="tm">TOYOTA RACING</td><td class="t">–</td></tr>');
    expect(hypercar).toContain('<tr><td class="p">2</td><td class="no">#36</td><td class="crew">Jules Gounon, Victor Martins</td><td class="tm">Alpine Endurance Team</td><td class="t">0.591</td></tr>');
    expect(rowsIn(hypercar)).toBe(10);
    // The link under a class's table opens the race's page on that class (the operator's check, 17 Nov).
    expect(hypercar).toContain('<p class="pd-wk-links pd-ec-all"><a class="pd-wk-link" href="/series/wec/2026/round-6/race/#hypercar">All 17 on the race\'s page</a></p>');
    const lmgt3 = panel(html, 'LMGT3 · 18 cars');
    expect(lmgt3).toContain('<tr><td class="p">1</td><td class="no">#32</td><td class="crew">Darren Leung, Sean Gelael, Augusto Farfus</td><td class="tm">Team WRT</td><td class="t">–</td></tr>');
    expect(lmgt3).toContain('<a class="pd-wk-link" href="/series/wec/2026/round-6/race/#lmgt3">All 18 on the race\'s page</a>');
  });

  it("O: each class's fastest car on a practice's card, the top class's drivers as they stand, the race's length and the classes", () => {
    const html = body(wecPages, FUJI);
    expect(html).toContain('<h2>Earlier in the weekend</h2><p class="pd-wk-hint">Each class’s fastest in practice and its pole in qualifying, in the order they ran</p>');
    expect(html).toContain(
      '<article class="pd-sc"><header><div><h3>Free Practice 1</h3><p><span class="pd-t" data-utc="2026-09-25T01:15:00.000Z" data-f="wt">Fri 01:15 UTC</span> your time · Fri 10:15 at the track</p></div></header>' +
        '<ol class="pd-sc-rows pd-ec-rows"><li><span class="c">Hypercar</span><b>#8</b><span class="nm">Brendon Hartley, Ryo Hirakawa, Sébastien Buemi</span><span class="tt">1:29.694</span></li>' +
        '<li><span class="c">LMGT3</span><b>#58</b><span class="nm">Alexander West, Finn Gehrsitz, Benjamin Goethe</span><span class="tt">1:40.214</span></li></ol>' +
        '<a class="pd-sc-go" href="/series/wec/2026/round-6/free-practice-1/">All 35 on its page →</a></article>',
    );
    expect((html.match(/<article class="pd-sc">/g) ?? []).length).toBe(3);
    expect(html).toContain(
      '<section class="pd-wk-box pd-wk-champ"><h3>Hypercar drivers, as they stand</h3><ol><li><span class="p">1</span><i class="pd-tc" style="--t:#EB0A1E"></i>' +
        '<span class="d"><b>Brendon Hartley, Ryo Hirakawa, Sébastien Buemi</b><small>#8 TOYOTA RACING</small></span><span class="g">Leader</span><b class="pt">115</b></li>',
    );
    expect(html).toContain('<span class="d"><b>Kamui Kobayashi, Mike Conway, Nyck de Vries</b><small>#7 TOYOTA RACING</small></span><span class="g">−18</span><b class="pt">97</b>');
    expect(html).toContain('<span class="pd-wk-more is-off">Full standings →</span></section>');
    expect(html).not.toContain('Championship after round');
    expect(html).toContain('<dt>Circuit</dt><dd>Fuji Speedway</dd><dt>Country</dt><dd>Japan</dd>');
    expect(html).toContain('<dt>Race</dt><dd>6 hours</dd><dt>Classes</dt><dd>Hypercar, LMGT3</dd></dl>');
    expect(html).toContain('<a class="pd-wk-next" href="/series/wec/2026/round-7/"><small>Next round · 7</small><b>6 Hours of Barcelona</b>');
  });

  it('C3, the Qualifying page: a tab a class, Qualifying then each Hyperpole inside it (Le Mans)', () => {
    const html = body(wecPages, `${LE_MANS}qualifying/`);
    expect(html).toContain('<h1>Qualifying</h1>');
    expect(html).toContain('<h2>Classification</h2><p class="pd-wk-hint">A class at a time: Qualifying, then Hyperpole 1, then Hyperpole 2</p>');
    expect(tabsOf(html)).toEqual(['Hypercar · 18 cars', 'LMP2 · 19 cars', 'LMGT3 · 25 cars']);
    const lmp2 = panel(html, 'LMP2 · 19 cars');
    expect([...lmp2.matchAll(/<h4 class="pd-ec-part">(.*?)<\/h4>/g)].map(m => m[1])).toEqual(['Qualifying <small>19 cars</small>', 'Hyperpole 1 <small>the top 15</small>', 'Hyperpole 2 <small>the top 10</small>']);
    expect(rowsIn(lmp2)).toBe(19 + 15 + 10);
    // A narrow box keeps a qualifying's time at the edge; its laps and gap may move under the crew.
    expect(lmp2).toContain('<th class="tm">Team</th><th class="t">Time</th><th class="n mv">Laps</th><th class="t mv">Gap</th>');
    expect(barOf(html)[2]).toBe('Qualifying | Wed · #15');
    expect(html).toContain(`<a href="${LE_MANS}qualifying/" aria-current="page">Qualifying<small>Wed · #15</small></a>`);
  });

  it("M, four classes (Daytona): a tab a class with its cars, IMSA's GTD PRO as it writes it, every class winner in the strip", () => {
    const html = body(imsaPages, DAYTONA);
    expect(tabsOf(html)).toEqual(['GTP · 11 cars', 'LMP2 · 13 cars', 'GTD PRO · 15 cars', 'GTD · 21 cars']);
    expect(html).toContain(
      '<span class="pd-wk-sum"><b>#7 Porsche Penske Motorsport</b> won (Nasr, Andlauer, Heinrich); LMP2 to #04 CrowdStrike Racing by APR, GTD PRO to #1 Paul Miller Racing, GTD to #57 Winward Racing</span>',
    );
    expect(barOf(html)).toEqual(['Overview | the weekend', 'Practice 1 | Thu · #60', 'Qualifying | Thu · #31', 'Practice 2 | Thu · #31', 'Practice 3 | Fri · #6', 'Race | Sat · #7']);
    expect(panel(html, 'GTP · 11 cars')).toContain('<tr><td class="p">2</td><td class="no">#31</td><td class="crew">Jack Aitken, Earl Bamber, Frederik Vesti, Connor Zilisch</td><td class="tm">Cadillac Whelen</td><td class="t">+1.569</td></tr>');
    expect(html).toContain('<dt>Race</dt><dd>24 hours</dd><dt>Classes</dt><dd>GTP, LMP2, GTD PRO, GTD</dd>');
    // The standings feed runs a crew's names together: split by the names the season's results hold.
    expect(html).toContain('<h3>GTP drivers, as they stand</h3>');
    expect(html).toContain('<span class="d"><b>Nick Yelloly, Renger van der Zande</b><small>#93 Acura Meyer Shank Racing w/Curb Agajanian</small></span>');
  });

  it('G, a Sprint Cup round (Zandvoort): a row of races over a row of classes, opening on the last race overall; a cup its first five with their overall places', () => {
    const html = body(gtwPages, ZANDVOORT);
    expect(html).toContain('› Round 8 of 10 · Sprint Cup</p><h1>Zandvoort Sprint</h1>');
    expect(html).toContain('<span class="pd-wk-sum"><b>#69 Emil Frey Racing</b> won Race 2; #58 Garage 59 Race 1</span>');
    expect(barOf(html)).toEqual(['Overview | the weekend', 'Free Practice 1 | Fri · #99', 'Free Practice 2 | Fri · #2', 'Qualifying 1 | Sat · #2', 'Race 1 | Sat · #58', 'Qualifying 2 | Sun · #14', 'Race 2 | Sun · #69']);
    expect(html).toContain('<h2>Results</h2><p class="pd-wk-hint">A race, then overall or a cup; it opens on Race 2 overall</p></div><div class="pd-rt" data-pd-rt="Race|Class" data-pd-open="Race 2 · Sun|Overall">');
    expect(tabsOf(html)).toEqual([
      'Race 1 · Sat|Overall',
      'Race 1 · Sat|Pro',
      'Race 1 · Sat|Gold',
      'Race 1 · Sat|Silver',
      'Race 1 · Sat|Bronze',
      'Race 2 · Sun|Overall',
      'Race 2 · Sun|Pro',
      'Race 2 · Sun|Gold',
      'Race 2 · Sun|Silver',
      'Race 2 · Sun|Bronze',
    ]);
    const overall = panel(html, 'Race 2 · Sun|Overall');
    expect(overall).toContain('<th class="tm">Team</th><th class="cup">Cup</th></tr>');
    expect(overall).toContain('<tr><td class="p">1</td><td class="no">#69</td><td class="crew">Thierry Vermeulen, Ben Green</td><td class="tm">Emil Frey Racing</td><td class="cup">Pro Cup</td></tr>');
    expect(rowsIn(overall)).toBe(10);
    expect(overall).toContain(`<a class="pd-wk-link" href="${ZANDVOORT}race-2/#overall">All 45 on the race's page</a>`);
    const gold = panel(html, 'Race 2 · Sun|Gold');
    expect(gold).toContain('<th class="tm">Team</th><th class="cup">Overall</th></tr>');
    expect(gold).toContain('<tr><td class="p">1</td><td class="no">#51</td><td class="crew">Tommaso Mosca, Matias Zagazeta</td><td class="tm">AF Corse</td><td class="cup">P6 overall</td></tr>');
    expect(rowsIn(gold)).toBe(5);
    expect(gold).not.toContain('pd-wk-link');
    expect(html).toContain('<dt>Cup</dt><dd>Sprint Cup: two one-hour races</dd><dt>Cups</dt><dd>Pro, Gold, Silver, Bronze</dd></dl>');
    expect(html).toContain('<h2>Earlier in the weekend</h2><p class="pd-wk-hint">Each cup’s fastest in practice and its pole in qualifying, in the order they ran</p>');
    // GT World lists a crew's drivers a row each, level on points: one row a car.
    expect(html).toContain('<h3>Drivers overall, as they stand</h3>');
    expect(html).toContain('<span class="d"><b>Lucas Auer, Maro Engel</b><small>#48 Winward Racing</small></span><span class="g">Leader</span><b class="pt">131.5</b>');
  });

  it("C3 and C4, GT World's Qualifying pages: its sessions in a row, the combined order first, over overall and each cup", () => {
    const q1 = body(gtwPages, `${ZANDVOORT}qualifying-1/`);
    expect(q1).toContain('<div class="pd-rt" data-pd-rt="Session|Class" data-pd-open="Combined|Overall">');
    expect(tabsOf(q1)).toEqual([
      'Combined|Overall',
      'Combined|Pro',
      'Combined|Gold',
      'Combined|Silver',
      'Combined|Bronze',
      'Group A|Overall',
      'Group A|Pro',
      'Group A|Gold',
      'Group B|Overall',
      'Group B|Silver',
      'Group B|Bronze',
    ]);
    // With no time in the combined order, its gap stays at the edge and the cup may move under the crew, bare.
    expect(panel(q1, 'Combined|Overall')).toContain(
      '<tr><td class="p">1</td><td class="no">#2</td><td class="crew">Morris Schuring, Dorian Boccolacci<span class="pd-ec-sub">Pro Cup</span></td><td class="tm">Boutsen VDS</td><td class="cup mv">Pro Cup</td><td class="t">–</td></tr>',
    );
    // A group's pole on its card: the combined order gives no lap, the car's group does.
    expect(body(gtwPages, ZANDVOORT)).toContain('<li><span class="c">Pro</span><b>#2</b><span class="nm">Morris Schuring, Dorian Boccolacci</span><span class="tt">1:33.730</span></li>');
    expect(body(gtwPages, ZANDVOORT)).toContain(`<a class="pd-sc-go" href="${ZANDVOORT}qualifying-1/">All 45 on its page →</a>`);

    const spa = body(gtwPages, `${SPA}qualifying/`);
    expect([...new Set(tabsOf(spa).map(t => t.split('|')[0]))]).toEqual(['Combined', 'Qualifying 1', 'Qualifying 2', 'Qualifying 3', 'Qualifying 4', 'Superpole', 'Superpole 1', 'Superpole 2', 'Superpole 3', 'Superpole 4']);
    expect([...new Set(tabsOf(spa).map(t => t.split('|')[1]))]).toEqual(['Overall', 'Pro', 'Gold', 'Silver', 'Bronze', 'Pro-AM']);
    // Six figures: a wide table, its combined time at the edge, each driver's time and the cup moving first; a time not
    // set is left off the line under the crew.
    const combined = panel(spa, 'Combined|Overall');
    expect(combined).toContain('<table class="pd-wk-tbl pd-ec-tbl is-wide">');
    expect(combined).toContain('<th class="cup mv">Cup</th><th class="t">Time</th><th class="t mv">Time 1</th><th class="t mv">Time 2</th><th class="t mv">Time 3</th><th class="t mv">Time 4</th></tr>');
    expect(combined).toContain(
      '<td class="crew">Alessio Rovera, Tommaso Mosca, Nicklas Nielsen<span class="pd-ec-sub">Pro Cup · Time 2&nbsp;2:17.012 · Time 3&nbsp;2:17.156 · Time 4&nbsp;2:17.038</span></td><td class="tm">AF Corse</td><td class="cup mv">Pro Cup</td><td class="t">2:17.068</td><td class="t mv">–</td>',
    );
  });

  it("an Endurance Cup round (Spa): its cup in the crumb, each cup's winner in the strip, the pole from the Superpole with the lap of its last part", () => {
    const html = body(gtwPages, SPA);
    expect(html).toContain('› Round 4 of 10 · Endurance Cup</p><h1>CrowdStrike 24 Hours of Spa</h1>');
    expect(html).toContain(
      '<span class="pd-wk-sum"><b>#80 Lionspeed GP</b> won (Feller, Preining, Buus); Gold Cup to #998 Rowe Racing, Silver Cup to #45 Rinaldi Racing, Bronze Cup to #74 Kessel Racing, Pro-AM Cup to #0 Johor Motorsports Racing JMR</span>',
    );
    expect(barOf(html)).toEqual([
      'Overview | the weekend',
      'Bronze Test | Tue · #222',
      'Free Practice 1 | Thu · #51',
      'Free Practice 2 | Thu · #50',
      'Qualifying | Thu · #51',
      'Night Practice | Thu · #58',
      'Warm Up | Fri · not stored',
      'Race | Sat · #80',
    ]);
    expect(html).toContain('<span class="is-off">Warm Up<small>Fri · not stored</small></span>');
    expect(tabsOf(html)).toEqual(['Overall', 'Pro', 'Gold', 'Silver', 'Bronze', 'Pro-AM']);
    expect(html).toContain('<h3>Qualifying</h3>');
    expect(html).toContain('<li><span class="c">Pro</span><b>#51</b><span class="nm">Alessio Rovera, Tommaso Mosca, Nicklas Nielsen</span><span class="tt">2:18.613</span></li>');
    expect(html).toContain('<dt>Cup</dt><dd>Endurance Cup</dd><dt>Race</dt><dd>24 hours</dd><dt>Cups</dt><dd>Pro, Gold, Silver, Bronze, Pro-AM</dd></dl>');
  });

  it("a race's own page: every car a class at a time with its laps, time and gap; a cup's cars with their overall places and no gap to another cup's leader", () => {
    const race = body(wecPages, `${FUJI}race/`);
    expect(race).toContain('<p class="pd-wk-crumb"><a href="/series/wec/">FIA WEC</a> › <a href="/series/wec/2026/">2026</a> › <a href="/series/wec/2026/round-6/">Round 6 · 6 Hours of Fuji</a></p><h1>Race</h1>');
    expect(race).toContain('<h2>Classification</h2><p class="pd-wk-hint">Every car, as classified, a class at a time</p>');
    const hypercar = panel(race, 'Hypercar · 17 cars');
    // A narrow box keeps a race's gap at the edge and puts its laps and time under the crew, each named ("A · Under the
    // crew", 17 Nov); the theme decides when, by the box's width.
    expect(hypercar).toContain('<th class="tm">Team</th><th class="n mv">Laps</th><th class="t mv">Time</th><th class="t">Gap</th></tr>');
    expect(hypercar).toContain(
      '<td class="crew">Brendon Hartley, Ryo Hirakawa, Sébastien Buemi<span class="pd-ec-sub">Laps&nbsp;203 · Time&nbsp;6:01:01.299</span></td>' +
        '<td class="tm">TOYOTA RACING</td><td class="n mv">203</td><td class="t mv">6:01:01.299</td><td class="t">–</td></tr>',
    );
    expect(hypercar).toContain('<table class="pd-wk-tbl pd-ec-tbl"><thead>');
    expect(rowsIn(hypercar)).toBe(17);
    expect(rowsIn(panel(race, 'LMGT3 · 18 cars'))).toBe(18);
    expect(race).toContain(`<a href="${FUJI}race/" aria-current="page">Race<small>Sun · #8</small></a>`);

    const gt = body(gtwPages, `${ZANDVOORT}race-2/`);
    expect(tabsOf(gt)).toEqual(['Overall', 'Pro', 'Gold', 'Silver', 'Bronze']);
    expect(rowsIn(panel(gt, 'Overall'))).toBe(45);
    expect(panel(gt, 'Overall')).toContain('<table class="pd-wk-tbl pd-ec-tbl is-wide"><thead>');
    expect(panel(gt, 'Overall')).toContain('<th class="cup mv">Cup</th><th class="t mv">Best lap</th><th class="n mv">Laps</th><th class="t">Gap</th></tr>');
    expect(panel(gt, 'Overall')).toContain('<td class="crew">Thierry Vermeulen, Ben Green<span class="pd-ec-sub">Pro Cup · Best lap&nbsp;1:35.182 · Laps&nbsp;36</span></td>');
    const gold = panel(gt, 'Gold');
    // A cup's own table keeps the overall place at the edge.
    expect(gold).toContain('<th class="cup">Overall</th><th class="t mv">Best lap</th><th class="n mv">Laps</th></tr>');
    expect(gold).toContain(
      '<td class="crew">Tommaso Mosca, Matias Zagazeta<span class="pd-ec-sub">Best lap&nbsp;1:35.476 · Laps&nbsp;36</span></td><td class="tm">AF Corse</td><td class="cup">P6 overall</td><td class="t mv">1:35.476</td><td class="n mv">36</td></tr>',
    );
    expect(gold).not.toContain('>Gap<');

    const practice = body(imsaPages, `${DAYTONA}practice-3/`);
    expect(practice).toContain('<h1>Practice 3</h1>');
    expect(practice).toContain('<p class="pd-wk-hint">Every car’s best lap, a class at a time</p>');
    expect(tabsOf(practice)).toEqual(['GTP · 11 cars', 'LMP2 · 13 cars', 'GTD PRO · 15 cars', 'GTD · 21 cars']);
    // A practice keeps its time at the edge; the leader's empty gap is left off the line under the crew.
    expect(panel(practice, 'GTP · 11 cars')).toContain('<th class="tm">Team</th><th class="t">Time</th><th class="n mv">Laps</th><th class="t mv">Gap</th></tr>');
    const fp1 = panel(body(wecPages, `${FUJI}free-practice-1/`), 'Hypercar · 17 cars');
    expect(fp1).toContain('<td class="crew">Brendon Hartley, Ryo Hirakawa, Sébastien Buemi<span class="pd-ec-sub">Laps&nbsp;50</span></td><td class="tm">TOYOTA RACING</td><td class="t">1:29.694</td>');
    expect(fp1).toContain('<td class="crew">Will Stevens, Norman Nato<span class="pd-ec-sub">Laps&nbsp;49 · Gap&nbsp;+0.343</span></td>');
  });

  it("the link under a class's table names its tab on the race's page, and every Overview table keeps its columns (the operator's check, 17 Nov)", () => {
    expect(body(imsaPages, DAYTONA)).toContain(`<a class="pd-wk-link" href="${DAYTONA}race/#gtd-pro">All 15 on the race's page</a>`);
    expect(body(gtwPages, ZANDVOORT)).toContain(`<a class="pd-wk-link" href="${ZANDVOORT}race-1/#overall">All 45 on the race's page</a>`);
    // Every such link on every saved Overview: its page exists and its fragment names one of that page's tabs.
    let links = 0;
    for (const pages of [wecPages, imsaPages, gtwPages]) {
      for (const [at, p] of pages) {
        for (const m of p.body.matchAll(/<a class="pd-wk-link" href="([^"#]+)#([^"]+)">All \d+ on the race's page<\/a>/g)) {
          links++;
          const target = pages.get(m[1]);
          expect(target, `${at} links ${m[1]}`).toBeDefined();
          expect(tabsOf(target?.body ?? '').map(t => tabAnchor(t.split('|'))), `${at} → ${m[1]}#${m[2]}`).toContain(m[2]);
        }
        // An Overview's tables hold one figure each: nothing moves, as before.
        if (/\/round-\d+\/$/.test(at)) expect(p.body).not.toMatch(/ mv"|pd-ec-sub|is-wide/);
      }
    }
    expect(links).toBe(8 * 2 + 1 + 4 + 1 + 2);
  });

  it("S, the season page: a car's win by its number and team, the rounds called off struck through with where they were first set and when they were called off", () => {
    const html = body(wecPages, '/series/wec/2026/');
    expect(html).toContain('<h2>The 2026 season</h2><p>8 rounds · 8 run</p>');
    expect(html).toContain('<small>Round 6 · 25–27 Sep</small><b>6 Hours of Fuji</b><span><i class="pd-tc" style="--t:#EB0A1E"></i>#8 TOYOTA RACING</span>');
    expect(html).toContain('<span class="pd-sn-t is-off"><small>Called off · was 22–24 Oct</small><b>Qatar 1812 km</b><span>First set for 26–28 March; called off on 28 July</span></span>');
    expect(html).toContain('<span class="pd-sn-t is-off"><small>Called off · was 5–7 Nov</small><b>Bapco Energies 8 Hours of Bahrain</b><span>Called off on 28 July</span></span>');
    // Without the publisher's line, the reason stands, as on Formula 1's.
    expect(body(pagesOf(wec, enduranceKit()), '/series/wec/2026/')).toContain('<b>Qatar 1812 km</b><span>Ongoing regional developments affecting freight and travel arrangements</span>');
  });

  it('reads a called-off round and a called-off session from rounds.json, whole or not at all', () => {
    expect(calledOffLine({ previousStartDate: '2026-03-26', previousEndDate: '2026-03-28', rescheduleStatus: 'called off on 28 July' })).toBe('First set for 26–28 March; called off on 28 July');
    expect(calledOffLine({ rescheduleStatus: 'called off on 28 July' })).toBe('Called off on 28 July');
    expect(calledOffLine({ previousStartDate: '2026-03-26' })).toBe('');
    expect(calledOffLine(undefined)).toBe('');
    expect(sessionsCalledOff({ calledOff: [{ session: 'Qualifying', note: 'n', source: 'https://example.org/a' }] })).toEqual([{ session: 'Qualifying', note: 'n', source: 'https://example.org/a' }]);
    expect(sessionsCalledOff({ calledOff: [{ session: 'Qualifying', note: 'n' }, { session: 'Race', note: 'n', source: 'example.org' }, 'Race', null] })).toEqual([]);
    expect(sessionsCalledOff({ calledOff: 'Qualifying' })).toEqual([]);
    expect(sessionsCalledOff(undefined)).toEqual([]);
  });

  it("the Results page's fold: each class's winner with its car, crew and team; GT World's a cup at a time, a Sprint Cup round's a race at a time", () => {
    const fold = classWinners(wec, resultOf(wec, 6));
    expect(fold).toContain('<thead><tr><th>Class</th><th class="no">No.</th><th class="crew">Crew</th><th class="tm">Team</th></tr></thead>');
    expect(fold).toContain('<tr><td>Hypercar</td><td class="no">#8</td><td class="crew">Brendon Hartley, Ryo Hirakawa, Sébastien Buemi</td><td class="tm">TOYOTA RACING</td></tr>');
    expect(fold).toContain('<tr><td>LMGT3</td><td class="no">#32</td><td class="crew">Darren Leung, Sean Gelael, Augusto Farfus</td><td class="tm">Team WRT</td></tr>');
    const sprint = classWinners(gtw, resultOf(gtw, 8));
    expect([...sprint.matchAll(/<tr><td>([^<]+)<\/td>/g)].map(m => m[1])).toEqual([
      'Race 1 · Pro Cup',
      'Race 1 · Gold Cup',
      'Race 1 · Silver Cup',
      'Race 1 · Bronze Cup',
      'Race 2 · Pro Cup',
      'Race 2 · Gold Cup',
      'Race 2 · Silver Cup',
      'Race 2 · Bronze Cup',
    ]);
    expect(sprint).toContain('<thead><tr><th>Cup</th>');
    expect(sprint).toContain('<tr><td>Race 2 · Pro Cup</td><td class="no">#69</td><td class="crew">Thierry Vermeulen, Ben Green</td><td class="tm">Emil Frey Racing</td></tr>');
    expect(classWinners(wec, { round: 9, name: 'None', date: null, sessions: [] })).toBe('');
    // On the Results page, under the round's row, with the way to the weekend.
    const results = seriesFamily(wec, kit).find(p => p.path === '/series/wec/results/')?.body ?? '';
    expect(results).toContain('<td>Hypercar</td><td class="no">#8</td>');
    expect(results).toContain('All 35 and every session on the weekend page →');
  });

  it("draws the Overview's standings block a class at a time, never Formula 1's drivers beside its constructors (PR 3, OV)", () => {
    expect(kit.overviewStandings).toBe(classBlock);
    const overview = seriesFamily(wec, kit)[0];
    expect(overview.path).toBe('/series/wec/');
    expect(overview.body).toContain('<section class="pd-sr-sec pd-ec-ov">');
    expect(overview.body).not.toContain('<section class="pd-sr-sec pd-sr-two">');
    expect(seriesFamily(wec)[0].body).toContain('<section class="pd-sr-sec pd-sr-two">');
  });

  it("joins a result's team to its car's colour in drivers.json, so a tile and a tick draw it", () => {
    const teams = [{ name: 'Toyota Gazoo Racing #8 (Hypercar)', colour: '#EB0A1E', drivers: [] }, { name: 'Team WRT', colour: '#1C69D4', drivers: [] }, { name: 'No Colour #9 (Hypercar)', drivers: [] }];
    const table = (rows: string[][]): Table => ({ title: 'Hypercar', columns: ['Pos', 'No.', CREW, 'Team'], rows });
    const results: ResultRound[] = [{ round: 1, name: 'R', date: '2026-04-19', sessions: [{ label: 'Race', tables: [table([['1', '8', 'A B', 'TOYOTA RACING'], ['2', '31', 'C D', 'Team WRT'], ['3', '9', 'E F', 'Nine'], ['4', '77', 'G H', 'Unknown']])] }] }];
    expect(withResultTeams(teams, results)).toEqual([...teams, { name: 'TOYOTA RACING', colour: '#EB0A1E', drivers: [] }]);
    expect(withResultTeams(teams, null)).toEqual(teams);
    expect(wec.teams?.find(t => t.name === 'TOYOTA RACING')?.colour).toBe('#EB0A1E');
  });

  it('before a weekend: the sessions to come by the track’s day, each to its unit’s page, and no Final', () => {
    const before = seriesOf('wec', { results: (wec.results ?? []).filter(r => r.round !== 6) });
    // With nothing called off, as the weekend stood before its Saturday.
    const planned = pagesOf(before, enduranceKit());
    const html = body(planned, FUJI);
    expect(html).not.toContain('is-fin');
    expect(html).toContain('<em class="pd-wk-pill is-next">Next</em>');
    expect(html).toContain('<h2>The weekend</h2>');
    expect(html).toContain('<h3 class="pd-wk-day">Friday 25 September</h3>');
    // A class's part of qualifying by its own name, to the one Qualifying page.
    expect(html).toContain(`<a class="pd-wk-row" href="${FUJI}qualifying/"><span class="pd-wk-when"><b><span class="pd-t" data-utc="2026-09-26T05:00:00.000Z" data-f="wt">Sat 05:00 UTC</span></b><small>Track 14:00</small></span><span class="pd-wk-name">LMGT3 Qualifying</span>`);
    expect(body(planned, `${FUJI}qualifying/`)).toContain('<h1>Qualifying</h1>');
    expect(html).toContain('<dt>Race</dt><dd>6 hours</dd></dl>');
    // Once rounds.json calls its qualifying off: no page, struck through on the bar, and the Overview says why.
    const pages = pagesOf(before);
    expect(pages.has(`${FUJI}qualifying/`)).toBe(false);
    expect(body(pages, FUJI)).toContain('<span class="is-x">Qualifying<small>Sat · called off</small></span>');
    expect(body(pages, FUJI)).toContain('<h2>Called off</h2></div><p class="pd-ec-flag">Qualifying and Hyperpole called off for rain');
    expect(body(pages, FUJI)).not.toContain(`href="${FUJI}qualifying/"`);
    const page = body(pages, `${FUJI}free-practice-1/`);
    expect(page).toContain('<h1>Free Practice 1</h1>');
    expect(page).toContain('<p class="pd-wk-empty">Not run yet. Its results join this page when it ends.</p>');
    expect(barOf(page)[1]).toBe('Free Practice 1 | Fri 01:15 UTC · still to run');
    expect(page).toContain(`<a href="${FUJI}free-practice-1/" aria-current="page" class="is-up">`);
  });

  it('during a weekend: what is done so far as cards, the rest still to come', () => {
    const fuji = resultOf(wec, 6);
    const during = seriesOf('wec', { results: [...(wec.results ?? []).filter(r => r.round !== 6), { ...fuji, sessions: [], others: (fuji.others ?? []).filter(s => s.label !== 'Free Practice 3') }] });
    const html = body(pagesOf(during), FUJI);
    expect(html).toContain('<h2>Done so far</h2><p class="pd-wk-hint">Each class’s fastest in practice and its pole in qualifying</p>');
    expect((html.match(/<article class="pd-sc">/g) ?? []).length).toBe(2);
    expect(html).toContain('<h2>Still to come</h2>');
    expect(html).not.toContain('<h2>Results</h2>');
    expect(html).not.toContain('is-fin');
  });

  it('keeps a feed’s car, crew, team and class as text', () => {
    const evil = (s: ResultSession): ResultSession => ({
      ...s,
      tables: s.tables.map(t => ({ ...t, title: t.title === 'Hypercar' ? 'Hyper<b>car' : t.title, rows: t.rows.map((r, i) => (i === 0 && t.title === 'Hypercar' ? [r[0], '<8>', 'A <i>B</i>, C "D" E', 'T&C <script>', ...r.slice(4)] : r)) })),
    });
    const fuji = resultOf(wec, 6);
    const d = seriesOf('wec', { results: [...(wec.results ?? []).filter(r => r.round !== 6), { ...fuji, sessions: fuji.sessions.map(evil), others: (fuji.others ?? []).map(evil) }] });
    const pages = pagesOf(d);
    const html = [body(pages, FUJI), body(pages, `${FUJI}race/`), body(pages, `${FUJI}free-practice-1/`), classWinners(d, resultOf(d, 6))].join('\n');
    expect(html).not.toMatch(/<script>|<i>B<\/i>|Hyper<b>car|#<8>/);
    expect(html).toContain('<b>#&lt;8&gt; T&amp;C &lt;script&gt;</b> won (&lt;i&gt;B&lt;/i&gt;, E)');
    expect(html).toContain('<td class="no">#&lt;8&gt;</td><td class="crew">A &lt;i&gt;B&lt;/i&gt;, C &quot;D&quot; E</td><td class="tm">T&amp;C &lt;script&gt;</td>');
    expect(html).toContain('data-pd-tab="Hyper&lt;b&gt;car · 17 cars"');
    expect(html).toContain('<span class="c">Hyper&lt;b&gt;car</span><b>#&lt;8&gt;</b>');
    // The line under the crew, from a feed's figures, is text too; the link's fragment holds no markup.
    const odd = (s: ResultSession): ResultSession => ({ ...s, tables: s.tables.map(t => ({ ...t, rows: t.rows.map((r, i) => (i === 0 ? [...r.slice(0, 4), '<203>', 'a&b "c"', r[6]] : r)) })) });
    const d2 = seriesOf('wec', { results: [...(wec.results ?? []).filter(r => r.round !== 6), { ...fuji, sessions: fuji.sessions.map(odd) }] });
    const race = body(pagesOf(d2), `${FUJI}race/`);
    expect(race).toContain('<span class="pd-ec-sub">Laps&nbsp;&lt;203&gt; · Time&nbsp;a&amp;b &quot;c&quot;</span>');
    expect(race).not.toContain('<203>');
    expect(body(pagesOf(d), FUJI)).toContain('race/#hyper-b-car">All 17 on the race');
  });

  it("names a driver by the surname with its particle, for the strip's crew", () => {
    expect(['Sébastien Buemi', 'Nyck de Vries', 'Sheldon van der Linde', 'António Félix da Costa', 'Dave Musial Jr.', 'Tom Van Rompuy', 'Ye'].map(surnameOf)).toEqual(['Buemi', 'de Vries', 'van der Linde', 'da Costa', 'Musial Jr.', 'Van Rompuy', 'Ye']);
  });
});

describe("family C's pages: what #1201's review found", () => {
  const without = (d: SeriesData, round: number): ResultRound[] => (d.results ?? []).filter(r => r.round !== round);

  it('pairs a race by its name: a Race 2 stored without its Race 1 keeps its own place and its own page', () => {
    const z = resultOf(gtw, 8);
    const d = seriesOf('gt-world', { results: [...without(gtw, 8), { ...z, sessions: z.sessions.filter(s => s.label === 'Race 2') }] });
    const { units } = unitList(d, 8);
    expect(units.filter(u => u.kind === 'race').map(u => `${u.label} <- ${u.entries.map(e => e.session).join()} = ${u.sessions.map(s => s.label).join()}`)).toEqual([
      'Race 1 <- Sprint Race 1 = ',
      'Race 2 <- Sprint Race 2 = Race 2',
    ]);
    const paths = kit.weekendPages(d).map(p => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter(p => p.startsWith(ZANDVOORT) && /race/.test(p))).toEqual([`${ZANDVOORT}race-2/`]);
    // Where the two share no name, the races still pair in order.
    expect(unitList(wec, 6).units.filter(u => u.kind === 'race').map(u => `${u.label} <- ${u.entries[0].session} = ${u.sessions[0].label}`)).toEqual(['Race <- 6 Hours of Fuji (Race) = Race']);
  });

  it('lists the sessions still to come in the order they run, a class at a time among them', () => {
    const calendar = (wec.calendar ?? []).flatMap(e =>
      e.round === 6 && e.session === 'Free Practice 3' ? [{ ...e, session: 'LMGT3 Free Practice 3' }, { ...e, session: 'Hypercar Free Practice 3', start: '2026-09-26T05:10:00.000Z', end: '2026-09-26T05:18:00.000Z' }] : [e],
    );
    const html = body(pagesOf(seriesOf('wec', { calendar, results: without(wec, 6) }), enduranceKit()), FUJI);
    const saturday = html.slice(html.indexOf('<h3 class="pd-wk-day">Saturday 26 September</h3>'), html.indexOf('<h3 class="pd-wk-day">Sunday 27 September</h3>'));
    expect([...saturday.matchAll(/data-utc="2026-09-26T(\d\d:\d\d)[^>]*>[^<]*<\/span><\/b>.*?<span class="pd-wk-name">([^<]+)<\/span>/g)].map(m => `${m[1]} ${m[2]}`)).toEqual([
      '00:30 LMGT3 Free Practice 3',
      '05:00 LMGT3 Qualifying',
      '05:10 Hypercar Free Practice 3',
      '05:20 LMGT3 Hyperpole',
      '05:40 Hypercar Qualifying',
      '06:00 Hypercar Hyperpole',
    ]);
    // Each part to its own unit's page.
    expect(saturday).toContain(`<a class="pd-wk-row" href="${FUJI}free-practice-3/"><span class="pd-wk-when"><b><span class="pd-t" data-utc="2026-09-26T05:10:00.000Z"`);
  });

  it("a unit of several timed parts: its card says from when, its page names each part's own start at the track", () => {
    const overview = body(wecPages, LE_MANS);
    expect(overview).toContain('<h3>Qualifying</h3><p>from <span class="pd-t" data-utc="2026-06-10T16:45:00.000Z" data-f="wt">Wed 16:45 UTC</span> your time · Wed 18:45 at the track</p>');
    expect(overview).toContain('<h3>Free Practice 1</h3><p><span class="pd-t" data-utc="2026-06-10T12:00:00.000Z" data-f="wt">Wed 12:00 UTC</span> your time · Wed 14:00 at the track</p>');
    expect(body(wecPages, `${LE_MANS}qualifying/`)).toContain(
      '<h1>Qualifying</h1><p class="pd-ss-sub">Wednesday 10 June · Le Mans Qualifying (LMP2 &amp; LMGT3) 18:45 · Le Mans Qualifying (Hypercar) 19:30; ' +
        'Thursday 11 June · Le Mans Hyperpole 1 (LMP2 &amp; LMGT3) 20:00 · Le Mans Hyperpole 2 (LMP2 &amp; LMGT3) 20:35 · Le Mans Hyperpole 1 (Hypercar) 21:05 · Le Mans Hyperpole 2 (Hypercar) 21:40, at the track; ' +
        'from <span class="pd-t" data-utc="2026-06-10T16:45:00.000Z" data-f="wt">Wed 16:45 UTC</span> your time</p>',
    );
    expect(body(gtwPages, `${ZANDVOORT}qualifying-1/`)).toContain('<p class="pd-ss-sub">Saturday 19 September · Qualifying 1 (Group A) 09:50 · Qualifying 1 (Group B) 10:05, at the track; from ');
    // One timed session keeps the shared band.
    expect(body(wecPages, `${FUJI}race/`)).toContain('<h1>Race</h1><p class="pd-ss-sub">Sunday 27 September · 11:00 at the track, ');
  });

  it('reads a class named twice in a stored session once, so the publisher’s run goes on', () => {
    const fuji = resultOf(wec, 6);
    const twice = { ...fuji, sessions: fuji.sessions.map(s => ({ ...s, tables: [...s.tables, s.tables[0]] })) };
    const pages = pagesOf(seriesOf('wec', { results: [...without(wec, 6), twice] }));
    expect(tabsOf(body(pages, FUJI))).toEqual(['Hypercar · 17 cars', 'LMGT3 · 18 cars']);
    expect(tabsOf(body(pages, `${FUJI}race/`))).toEqual(['Hypercar · 17 cars', 'LMGT3 · 18 cars']);
  });

  it('names the first session still to run on the strip, whatever the timetable calls the ones already stored', () => {
    const lm = resultOf(wec, 3);
    const d = seriesOf('wec', { results: [...without(wec, 3), { ...lm, sessions: [], others: (lm.others ?? []).filter(s => s.label === 'Free Practice 1') }] });
    const html = body(pagesOf(d), LE_MANS);
    expect(html).toContain('<b class="pd-sr-ses">Le Mans Qualifying (LMP2 &amp; LMGT3) · <span class="pd-t" data-utc="2026-06-10T16:45:00.000Z" data-f="wt">Wed 16:45 UTC</span></b>');
    expect(html).toContain('data-pd-target="2026-06-10T16:45:00.000Z"');
    expect(html).not.toContain('Le%20Mans%20Free%20Practice%201|');
    expect(html).toContain('<h2>Done so far</h2>');
  });

  it("keeps an unclassified car's mark in a cup's tab, in its place and beside it", () => {
    const pro = panel(body(gtwPages, `${ZANDVOORT}race-2/`), 'Pro');
    expect(pro).toContain(
      '<tr><td class="p">NC</td><td class="no">#7</td><td class="crew">Nicki Thiim, Kobe Pauwels<span class="pd-ec-sub">Best lap&nbsp;1:38.794 · Laps&nbsp;9</span></td><td class="tm">Comtoyou Racing</td><td class="cup">NC</td>',
    );
    expect(pro).toContain('<tr><td class="p">1</td><td class="no">#69</td>');
  });

  it('a Sprint Cup round after its first race: the race named in its own row of tabs, no Final until both are run', () => {
    const z = resultOf(gtw, 8);
    const first = { ...z, sessions: z.sessions.filter(s => s.label === 'Race 1'), others: (z.others ?? []).filter(s => !/^Qualifying 2/.test(s.label)) };
    const html = body(pagesOf(seriesOf('gt-world', { results: [...without(gtw, 8), first] })), ZANDVOORT);
    expect(html).not.toContain('is-fin');
    expect(html).toContain('<p class="pd-wk-hint">A race, then overall or a cup; it opens on Race 1 overall</p></div><div class="pd-rt" data-pd-rt="Race|Class" data-pd-open="Race 1 · Sat|Overall">');
    expect(tabsOf(html)).toEqual(['Race 1 · Sat|Overall', 'Race 1 · Sat|Pro', 'Race 1 · Sat|Gold', 'Race 1 · Sat|Silver', 'Race 1 · Sat|Bronze']);
    expect(barOf(html).slice(3)).toEqual(['Qualifying 1 | Sat · #2', 'Race 1 | Sat · #58', 'Qualifying 2 | Sun 08:35 UTC · still to run', 'Race 2 | Sun 12:15 UTC · still to run']);
    expect(html).toContain('<b class="pd-sr-ses">Qualifying 2 (Group A) · ');
  });

  it('keeps a standings name the results do not hold as it is written', () => {
    const [table] = saved.imsa.standings;
    const standings = [{ ...table, rows: [['1', 'Zed Unknown Quux Nobody', '3100'], ...table.rows] }];
    const html = body(pagesOf(seriesOf('imsa', { standings })), DAYTONA);
    expect(html).toContain('<span class="d"><b>Zed Unknown Quux Nobody</b><small></small></span><span class="g">Leader</span><b class="pt">3100</b>');
    expect(html).toContain('<span class="d"><b>Jack Aitken</b><small>#31 Cadillac Whelen</small></span><span class="g">−80</span><b class="pt">3020</b>');
  });

  it('names no fastest car for a class that set no lap', () => {
    const day = resultOf(imsa, 1);
    const blank = (t: Table): Table => ({ ...t, rows: t.rows.map(r => r.map((c, i) => (t.columns[i] === 'Time' || t.columns[i] === 'Gap' ? '' : t.columns[i] === 'Laps' ? '0' : c))) });
    const others = (day.others ?? []).map(s => (s.label === 'Qualifying' ? { ...s, tables: s.tables.map(t => (t.title === 'GTD Pro' ? blank(t) : t)) } : s));
    const html = body(pagesOf(seriesOf('imsa', { results: [{ ...day, others }] })), DAYTONA);
    const from = html.indexOf('<h3>Qualifying</h3>');
    const card = html.slice(from, html.indexOf('</article>', from));
    expect([...card.matchAll(/<span class="c">([^<]+)<\/span>/g)].map(m => m[1])).toEqual(['GTP', 'LMP2', 'GTD']);
    // The page itself still lists the class as stored.
    expect(tabsOf(body(pagesOf(seriesOf('imsa', { results: [{ ...day, others }] })), `${DAYTONA}qualifying/`))).toContain('GTD PRO · 15 cars');
  });

  it('logs a stored session without a car as that, and counts one car as one', () => {
    const fuji = resultOf(wec, 6);
    const empty: ResultSession = { label: 'Free Practice 4', tables: [{ title: 'Hypercar', columns: fuji.sessions[0].tables[0].columns, rows: [] }] };
    const one = { ...fuji, sessions: fuji.sessions.map(s => ({ ...s, tables: s.tables.map(t => (t.title === 'LMGT3' ? { ...t, rows: t.rows.slice(0, 1) } : t)) })), others: [...(fuji.others ?? []), empty] };
    const lines: string[] = [];
    const pages = pagesOf(seriesOf('wec', { results: [...without(wec, 6), one] }), enduranceKit({ log: line => lines.push(line) }));
    expect(lines).toContain('wec R6 Free Practice 4: no car stored, left out');
    expect(lines.some(l => /another championship/.test(l))).toBe(false);
    expect(tabsOf(body(pages, FUJI))).toEqual(['Hypercar · 17 cars', 'LMGT3 · 1 car']);
  });
});

// ── Standings and Champions (O34, PR 3) ──────────────────────────────────────

describe("family C's Standings and Champions (O34, PR 3), as drawn on Endurance Weekend Drafts, Version 4", () => {
  const content = (slug: Slug, file: string): unknown => JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'series', slug, file), 'utf8'));
  /** A series as the publisher hands it over once its setting lists Standings and Champions: every stored table, every
   *  round's race, champions.json and what the Champions page reads beside it (the colour file left out on request). */
  const full = (slug: Slug, extra: Partial<SeriesData> = {}, historic = true): SeriesData => {
    const s = saved[slug];
    const results = [...s.results, ...(s.races ?? [])].sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
    return seriesOf(slug, {
      results,
      teams: withResultTeams(
        s.teams.map(x => ({ ...x, drivers: [] })),
        results,
      ),
      champions: {
        seasons: content(slug, 'champions.json') as Champion[],
        notes: content(slug, 'champion-notes.json') as ChampionNotesFile,
        records: content(slug, 'record-notes.json') as RecordNotesFile,
        historic: historic ? (content(slug, 'historic-team-colors.json') as { teams: Record<string, HistoricTeamColor> }).teams : {},
        names: null,
      },
      sites: { [slug]: { family: 'C', pages: ['results', 'standings', 'champions', 'weekends'] } },
      ...extra,
    });
  };
  /** One class's tab: from its name to the next tab, or to the end (a box's own section closes inside a tab). */
  const tab = (html: string, name: string): string => {
    const from = html.indexOf(`data-pd-tab="${name}"`);
    const to = html.indexOf('<section class="pd-rt-p"', from + 1);
    return from < 0 ? '' : html.slice(from, to < 0 ? undefined : to);
  };
  const seasonsWith = (slug: Slug, change: (s: Champion) => Champion): Champion[] => (content(slug, 'champions.json') as Champion[]).map(s => (s.year === 2026 ? change(s) : s));

  it('matches a table’s names to the results’ whatever their initials, accents and umlauts', () => {
    expect(joinKey('A. J. Allmendinger')).toBe(joinKey('AJ Allmendinger'));
    expect(joinKey('Nico Mueller')).toBe(joinKey('Nico Müller'));
    expect(joinKey('Maximilian Goetz')).toBe(joinKey('Maximilian Götz'));
    expect(joinKey('Marco Sørensen')).toBe(joinKey('Marco Sorensen'));
    expect(joinKey('Juan Pablo Montoya')).not.toBe(joinKey('Juan Montoya'));
    expect(surnameOf('Alessandro Pier Guidi')).toBe('Pier Guidi');
  });

  it("joins FIA WEC's tables to its races: a crew a row, its car and team, its class wins and its colour", () => {
    const [hyper, gt3] = classStandings(full('wec'));
    expect([hyper.label, gt3.label]).toEqual(['Hypercar', 'LMGT3']);
    expect(hyper.drivers).toHaveLength(29);
    expect(hyper.drivers[0]).toEqual({ pos: '1', names: ['Brendon Hartley', 'Ryo Hirakawa', 'Sébastien Buemi'], shown: '115', pts: 115, car: '8', team: 'TOYOTA RACING', also: [], wins: 3, colour: '#EB0A1E' });
    expect(hyper.drivers[3]).toMatchObject({ names: ['Earl Bamber', 'Sébastien Bourdais'], car: '38', team: 'Cadillac Hertz Team JOTA', wins: 1 });
    expect(hyper.makes.slice(0, 3).map(m => `${m.name} ${m.shown} ${m.wins}`)).toEqual(['Toyota 215 4', 'BMW 172 2', 'Ferrari 150 1']);
    expect(hyper.teams).toEqual([]);
    expect(gt3.drivers.slice(0, 3).map(x => `${x.names.join(', ')} #${x.car} ${x.wins}`)).toEqual(['Jonny Edgar #33 1', 'Nicky Catsburg #33 1', 'Riccardo Pera, Richard Lietz, Yasser Shahin #92 2']);
    // fiawec.com's "CORVETTE #33 TF SPORT": the car, the team as its races spell it, the make under it.
    expect(gt3.teams[0]).toMatchObject({ car: '33', name: 'TF Sport', small: 'Corvette', shown: '107', wins: 1 });
    expect(gt3.makes).toEqual([]);
  });

  it("splits IMSA's run-together names by the results' and finds a name the table spells otherwise in its class", () => {
    const classes = classStandings(full('imsa'));
    expect(classes.map(c => `${c.label} ${c.drivers.length}`)).toEqual(['GTP 32', 'LMP2 42', 'GTD PRO 44', 'GTD 82']);
    const [gtp, lmp2, pro, gtd] = classes;
    expect(gtp.drivers[2]).toMatchObject({ names: ['Nick Yelloly', 'Renger van der Zande'], car: '93', team: 'Acura Meyer Shank Racing w/Curb Agajanian' });
    expect(lmp2.drivers[0]).toMatchObject({ names: ['George Kurtz', 'Alex Quinn'], car: '04', team: 'CrowdStrike Racing by APR', wins: 2 });
    // Wikipedia's "Eduardo Barrichello" is the results' (and imsa.com's) Dudu Barrichello.
    expect(saved.imsa.standings.find(t => t.title === 'GTD · Drivers')?.rows[2]).toEqual(['3', 'Eduardo Barrichello', '2742']);
    expect(gtd.drivers[2]).toMatchObject({ names: ['Dudu Barrichello'], car: '27', team: 'Heart of Racing Team' });
    // A stored car holding two models and a footnote's digits is not shown.
    expect(pro.teams.find(t => t.car === '9')).toMatchObject({ name: 'Pfaff Motorsports', small: '' });
    expect(gtp.teams[0]).toMatchObject({ car: '31', name: 'Cadillac Whelen', small: 'Cadillac V-Series.R', wins: 2 });
    expect(gtd.makes[0]).toMatchObject({ name: 'Mercedes-AMG', shown: '3339', wins: 5 });
    expect(lmp2.makes).toEqual([]);
  });

  it('names every car a driver raced in the class, the one raced most first (the operator’s “Every car”, 18 Nov)', () => {
    // Heinrich raced the #5 most, won in the #7 and raced the #6 once: one row, its points from every car.
    const [gtp] = classStandings(full('imsa'));
    expect(gtp.drivers[1]).toMatchObject({ pos: '2', names: ['Laurin Heinrich'], car: '5', team: 'JDC-Miller MotorSports', also: ['7', '6'], wins: 3 });
    const page = enduranceStandings(full('imsa')).body;
    expect(tab(page, 'GTP')).toContain('<span class="sn">Laurin Heinrich</span></b><small>#5 JDC-Miller MotorSports, also #7 and #6</small>');
    expect(tab(classBlock(full('imsa')), 'GTP')).toContain('<small>#5 JDC-Miller MotorSports, also #7 and #6</small>');
    const [overall] = classStandings(full('gt-world'));
    expect(overall.drivers.find(x => x.names.join() === 'Fabian Schiller')).toMatchObject({ car: '12', also: ['17'] });
    expect(page).toContain(
      '<p class="pd-st-foot">A row is the drivers level on points who raced together: a driver who missed a round has a row of their own, and a driver who raced more than one car has each car named, the one raced most first. Wins are class wins.</p>',
    );
  });

  it("joins GT World's crew-mates into one row by place, points and car, never two cars level on points", () => {
    const [overall, sprint, endurance] = classStandings(full('gt-world'));
    expect([overall.label, sprint.label, endurance.label]).toEqual(['Overall', 'Sprint Cup', 'Endurance Cup']);
    expect([overall.drivers.length, sprint.drivers.length, endurance.drivers.length]).toEqual([72, 31, 38]);
    expect(overall.drivers[0]).toMatchObject({ names: ['Lucas Auer', 'Maro Engel'], car: '48', team: 'Winward Racing', shown: '131.5', wins: 0 });
    expect(endurance.drivers[0]).toMatchObject({ names: ['Lucas Auer', 'Maro Engel', 'Luca Stolz'], car: '48', team: 'Mercedes-AMG Team MANN-FILTER' });
    expect(sprint.drivers[0]).toMatchObject({ names: ['Ricardo Feller', 'Bastian Buus'], car: '80', team: 'Lionspeed GP', wins: 2 });
    expect(overall.drivers.filter(x => x.pos === '20').map(x => `${x.names.join(', ')} #${x.car}`)).toEqual(['Fabian Schiller #12', 'Maximilian Götz #17']);
    // The #71's crew, which the table lists around another car's: one row.
    expect(overall.drivers.find(x => x.car === '71' && x.pos === '47')?.names).toEqual(['Simon Birch', 'Malte Ebdrup', 'Frederik Schandorff']);
    // A team named without its car takes its best-placed crew's colour.
    expect(overall.teams[0]).toMatchObject({ car: '', name: 'Team WRT', shown: '152.5', wins: 2, colour: '#1C69D4' });
  });

  it('draws the Standings page with the season over: a tab a class, the box naming the champions, ten rows open (ST1)', () => {
    const page = enduranceStandings(full('wec'));
    expect(page).toMatchObject({ path: '/series/wec/standings/', title: 'FIA WEC standings', template: 'page-wide' });
    const html = page.body;
    expect(html).toContain('<nav class="pd-sr-tabs" aria-label="FIA WEC pages"><div class="pd-sr-tabs-in"><a href="/series/wec/">Overview</a>');
    expect(html).toContain('<a href="/series/wec/standings/" aria-current="page">Standings</a>');
    expect(html).toContain('<h2 class="pd-st-h">Final standings</h2><p>All 8 rounds run. The last: 6 Hours of Monza, 8 November.</p>');
    expect(tabsOf(html)).toEqual(['Hypercar', 'LMGT3']);
    const hyper = tab(html, 'Hypercar');
    expect(hyper).toContain('<p class="k">2026 champions · Hypercar</p>');
    expect(hyper).toContain('<small>Drivers</small><b>Brendon Hartley<br>Ryo Hirakawa<br>Sébastien Buemi</b><span>#8 TOYOTA RACING · 115 points, 18 clear · 3 wins</span>');
    expect(hyper).toContain('<small>Manufacturers</small><b>Toyota</b><span>215 points, 43 clear of BMW · 4 wins</span>');
    expect(hyper).toContain('<p class="sum"><b>Clinched</b> 6 Hours of Monza, 8 November 2026, final round (8 of 8)</p>');
    expect(hyper).toContain('<span class="fn">Brendon Hartley, Ryo Hirakawa, Sébastien Buemi</span><span class="sn">Hartley, Hirakawa, Buemi</span></b><small>#8 TOYOTA RACING <em>Champions</em></small>');
    expect(hyper).toContain('<span class="pt">97</span><span class="g">−18</span><span class="w">1</span>');
    const open = hyper.slice(hyper.indexOf('pd-ec-drv'), hyper.indexOf('<details'));
    expect((open.match(/<li/g) ?? []).length).toBe(10);
    expect(hyper).toContain('<details class="pd-ec-more"><summary>All 29 rows</summary>');
    expect(hyper).toContain('<span class="d"><b>Toyota</b><small><em>Champion</em></small></span>');
    const gt3 = tab(html, 'LMGT3');
    expect(gt3).toContain('<p class="k">2026 champions · LMGT3</p>');
    expect(gt3).toContain('<small>Teams</small><b>#33 TF Sport</b><span>Corvette · 107 points, 8 clear · 1 win</span>');
    expect(gt3).not.toContain('Clinched');
    expect(gt3).toContain('<summary>All 26 rows</summary>');
    expect(gt3).toContain('<summary>All 18 teams</summary>');
    expect(seriesFamily(full('wec'), kit).find(p => p.path === '/series/wec/standings/')?.body).toBe(html);
  });

  it("says champions only where champions.json names the class's champions as the table does", () => {
    const d = full('wec');
    const none = d.champions ? { ...d.champions, seasons: seasonsWith('wec', s => ({ ...s, others: [] }) as Champion) } : undefined;
    const gt3 = tab(enduranceStandings({ ...d, champions: none }).body, 'LMGT3');
    expect(gt3).toContain('<p class="k">2026 · LMGT3</p>');
    expect(gt3).not.toContain('<em>Champion');
    const other = d.champions ? { ...d.champions, seasons: seasonsWith('wec', s => ({ ...s, driver: 'Kamui Kobayashi, Mike Conway, Nyck de Vries' })) } : undefined;
    const hyper = tab(enduranceStandings({ ...d, champions: other }).body, 'Hypercar');
    expect(hyper).toContain('<p class="k">2026 · Hypercar</p>');
    expect(hyper).not.toContain('Clinched');
    expect(hyper).not.toContain('<em>Champion');
    // GT World's Endurance Cup is named by the season's second title; its Sprint Cup by an `others` line.
    const gtw = enduranceStandings(full('gt-world')).body;
    expect(tab(gtw, 'Endurance Cup')).toContain('<p class="k">2026 champions · Endurance Cup</p>');
    expect(tab(gtw, 'Sprint Cup')).toContain('<p class="k">2026 champions · Sprint Cup</p>');
    expect(tab(gtw, 'Overall')).toContain('<p class="sum"><b>Clinched</b> On appeal, before the Portimão finale, October 2026</p>');
  });

  it('draws the page in season: the round run and when the next points are scored, and no box until S1 (ST4)', () => {
    const d = full('wec');
    const html = enduranceStandings({ ...d, results: (d.results ?? []).filter(r => r.round !== 8) }).body;
    expect(html).toContain('<h2 class="pd-st-h">Standings after round 7 of 8</h2><p>6 Hours of Barcelona, 18 October<span class="pd-st-next"> · next update after Sunday’s 6 Hours of Monza</span></p>');
    expect(html).not.toContain('pd-ec-title');
    expect(html).not.toContain('<em>Champion');
    expect(html).toContain('<div class="pd-ec-cols no-box"><div class="pd-ec-drv">');
    // A Sprint Cup round with its first race alone is not run yet.
    const g = full('gt-world');
    const half = (g.results ?? []).map(r => (r.round === 9 ? { ...r, sessions: r.sessions.filter(s => s.label === 'Race 1') } : r)).filter(r => r.round !== 10);
    expect(enduranceStandings({ ...g, results: half }).body).toContain('<h2 class="pd-st-h">Standings after round 8 of 10</h2>');
    // A round stored while an earlier one is still missing waits for it.
    const gap = enduranceStandings({ ...d, results: (d.results ?? []).filter(r => r.round !== 7) }).body;
    expect(gap).toContain('<h2 class="pd-st-h">Standings after round 6 of 8</h2>');
    expect(gap).toContain('<span class="pd-st-next"> · next update after Sunday’s 6 Hours of Barcelona</span>');
  });

  it('heads the box with the class alone when the series names no season', () => {
    const hyper = tab(enduranceStandings({ ...full('wec'), season: undefined }).body, 'Hypercar');
    expect(hyper).toContain('<p class="k">Hypercar</p>');
    expect(hyper).not.toContain('Clinched');
  });

  it('escapes what a table holds', () => {
    const evil = saved.wec.standings.map(t => (t.title === 'Hypercar · Drivers' ? { ...t, rows: [...t.rows.slice(0, -1), ['29', '<img src=x onerror=alert(1)>', '', '0']] } : t));
    const html = enduranceStandings(full('wec', { standings: evil })).body;
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
  });

  it('draws the Champions page with a crew in the champion’s place and each other class’s line under its season (CH1)', () => {
    const page = enduranceChampions(full('wec'));
    expect(page).toMatchObject({ path: '/series/wec/champions/', title: 'FIA WEC champions', template: 'page-wide' });
    const html = page.body;
    expect(html).toContain('<p class="pd-ch-intro">Every drivers’ champion crew since 2012 and every manufacturers’ champion, year by year: 14 seasons, 26 different drivers.</p>');
    expect(html).toContain('<p class="pd-ch-lab"><span>Reigning champions</span> 2026 season</p><h3><span>Sébastien Buemi</span><span>Brendon Hartley</span><span>Ryō Hirakawa</span></h3>');
    expect(html).toContain('<p class="pd-ch-sub"><b>TOYOTA RACING · Toyota TR010 Hybrid</b><b>Fifth title for Buemi and Hartley, third for Hirakawa</b></p>');
    expect(html).toContain('<div class="pd-ch-tiles"><span><b>115</b>Points</span><span><b>3</b>Wins</span><span><b>+18</b>Over Kobayashi, Conway and de Vries</span></div>');
    expect(html).toContain('Manufacturers’ champion: <b>Toyota</b>, its sixth title. Buemi, Hartley and Hirakawa went to Monza 17 points clear of the sister #7 Toyota with 26 still to win, and tenth place on 8 November was enough.</p>');
    expect(html).toContain('<a href="/series/wec/standings/">2026 final standings →</a>');
    expect(html).toContain('<b>Sébastien Buemi<sup>×5</sup>, Brendon Hartley<sup>×5</sup>, Ryō Hirakawa<sup>×3</sup></b><small>TOYOTA RACING · Toyota TR010 Hybrid</small>');
    expect(html).toContain('<td class="mk" data-l="Manufacturers’"><b>Toyota</b><small>6th title</small></td>');
    expect(html).toContain('<tr class="cls"><td class="yr"></td><td colspan="2" class="ot"><span><em>LMGT3</em> <b>Jonny Edgar</b> #33 TF Sport</span><span><em>LMGT3 teams</em> <b>#33 TF Sport</b> Corvette</span></td></tr>');
    expect(html).toContain('<tr><td class="yr">2020</td><td class="ch"');
    expect(html).toMatch(/<td class="yr">2020<\/td>.*?<td class="mk" data-l="Manufacturers’"><small>—<\/small><\/td>/);
    expect(html).not.toContain('pd-ch-jump');
    expect(html).toMatch(/<li><b>Sébastien Buemi<\/b><span class="sq">(<i style="--t:#[0-9A-Fa-f]{6}"><\/i>){5}<\/span><span class="n">5<\/span><\/li>/);
    expect(html).toContain('<blockquote><b>Buemi and Hartley have shared the record since 2022, when both reached three in the same car; a fourth came in the 2023 finale and a fifth at Monza in 2026.</b> One square per title, in that season’s team colour.</blockquote>');
    expect(html).toMatch(/<li><b>Toyota<\/b><span class="sq">(<i style="--t:#EB0A1E"><\/i>){6}<\/span><span class="n">6<\/span><\/li>/);
    // The doorways as on Formula 1's page; the blog's waits for a category, the Standings door has its own line.
    expect(html).toContain('<b>FIA WEC standings</b><span>The final standings, a class at a time.</span>');
    expect(html).toContain('<span class="pd-ch-door is-off"><small>From the blog</small><b>FIA WEC posts</b>');
    expect(html).toContain('<section class="pd-ch-call">');
    expect(seriesFamily(full('wec'), kit).find(p => p.path === '/series/wec/champions/')?.body).toBe(html);
  });

  it('colours a past champion from the colour file, grey without it', () => {
    expect(enduranceChampions(full('wec')).body).toContain('<tr><td class="yr">2017</td><td class="ch" style="--t:#D5001C">');
    expect(enduranceChampions(full('wec', {}, false)).body).toContain('<tr><td class="yr">2017</td><td class="ch" style="--t:#9aa3b2">');
    // A name with its era in brackets reads the plain name's line, as GT World writes 2015's team.
    expect(enduranceChampions(full('gt-world')).body).toContain('<tr><td class="yr">2015</td><td class="ch" style="--t:#1C69D4">');
  });

  it("draws GT World's two titles a season and IMSA's manufacturers' (CH2)", () => {
    const gtw = enduranceChampions(full('gt-world')).body;
    expect(gtw).toContain('<p class="pd-ch-intro">Every overall champion since 2014 and every Endurance Cup champion, year by year: 13 seasons, 15 different drivers.</p>');
    expect(gtw).toContain('<p class="pd-ch-sub"><b>Winward Racing</b><b>Second title for Auer and Engel</b></p>');
    expect(gtw).toContain('<div class="pd-ch-tiles"><span><b>131.5</b>Points</span><span><b>0</b>Wins</span><span><b>+11.5</b>Over Feller and Buus</span></div>');
    expect(gtw).toContain('Endurance Cup: <b>Lucas Auer, Maro Engel and Luca Stolz</b>, Winward Racing.');
    expect(gtw).toContain('<th>Year</th><th>Overall champions</th><th>Endurance Cup champions</th>');
    expect(gtw).toContain('<span><em>Sprint Cup</em> <b>Ricardo Feller, Bastian Buus</b> Lionspeed GP</span>');
    expect(gtw).not.toContain('Manufacturers’ titles');
    const imsaPage = enduranceChampions(full('imsa')).body;
    expect(imsaPage).toContain('<b>Cadillac Whelen · Cadillac V-Series.R (GTP)</b><b>First title for Aitken</b>');
    expect(imsaPage).toContain('<span><b>+161</b>Over Heinrich</span>');
    expect(imsaPage).toContain('Manufacturers’ champion: <b>Cadillac</b>, its fifth title.');
    expect(imsaPage).toContain('<span><em>GTD PRO</em> <b>Connor De Phillippi, Neil Verhagen</b> #1 Paul Miller Racing</span>');
  });

  it("draws the Overview's block: a tab a class, five crews beside five manufacturers or teams, each list to its class (OV)", () => {
    const block = classBlock(full('wec'));
    expect(block).toContain('<div class="pd-sh"><h2>Standings</h2><p>Final · a class at a time</p></div>');
    expect(tabsOf(block)).toEqual(['Hypercar', 'LMGT3']);
    const hyper = tab(block, 'Hypercar');
    expect(hyper).toContain('<h3>Drivers</h3><p><a href="/series/wec/standings/#hypercar">All 29 →</a></p>');
    expect(hyper).toContain('<h3>Manufacturers</h3><p><a href="/series/wec/standings/#hypercar">All 8 →</a></p>');
    expect((hyper.match(/<li>/g) ?? []).length).toBe(10);
    expect(hyper).toContain('<span class="fn">Brendon Hartley, Ryo Hirakawa, Sébastien Buemi</span><span class="sn">Hartley, Hirakawa, Buemi</span></b> <small>#8 TOYOTA RACING</small>');
    expect(hyper).toContain('<span class="pd-pt">115</span><span class="pd-w">3 wins</span>');
    expect(tab(block, 'LMGT3')).toContain('<h3>Teams</h3><p><a href="/series/wec/standings/#lmgt3">All 18 →</a></p>');
    expect(tab(classBlock(full('imsa')), 'GTD PRO')).toContain('<a href="/series/imsa/standings/#gtd-pro">All 44 →</a>');
    expect(classBlock(full('wec', { sites: { wec: { family: 'C', pages: ['results', 'weekends'] } } }))).toContain('<span class="is-off">All 29</span>');
    expect(seriesFamily(full('wec'), kit)[0].body).toContain(block);
  });
});
