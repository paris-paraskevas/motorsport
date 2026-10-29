import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import type { ResultRound } from './render';
import {
  alkamelSession,
  CREW,
  crewCell,
  emptyCrews,
  fetchedRound,
  gtSessionOptions,
  gtTable,
  inShape,
  mergeRounds,
  nameKey,
  nameSpeller,
  respell,
  roundsDue,
  teamSpeller,
  tidyCaps,
  wecCarCrew,
  wecCarsDue,
  wecCrewNames,
  wecDriverName,
  wecDriversDue,
  wecSession,
  wecTable,
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

  it("shows a car's status where its gap would be when Al Kamel gives one", () => {
    const s = alkamelSession(fixture('imsa-results-sebring-2026.json'), 'Race', true, none, same);
    const dns = s!.tables.find(t => t.title === 'LMP2')!.rows.find(r => r[1] === '79');
    expect(dns?.[6]).toBe('338 Laps');
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
    expect(wecCarsDue([old, fuji], raceIds, crews)).toEqual([{ raceId: 4954, car: '8' }]);
    expect(wecCarsDue([fuji], raceIds, emptyCrews()).map(c => c.car)).toEqual(['8', '36', '43']);
    expect(wecDriversDue(crews, spell)).toEqual(['8790']);
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
    const t = gtTable(fixture('gtw-qualifying-portimao-2026.html'), 'Qualifying Combined', nameSpeller(['Maximilian Götz']));
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
    expect(gtTable(html, 'Main Race', none)?.rows.map(r => `${r[0]}#${r[1]}`)).toEqual(['1#17', '2#80', 'DSQ#58', 'NC#54']);
  });

  it('reads a sprint race with its cup, time, laps and gap', () => {
    const t = gtTable(fixture('gtw-race-brandshatch-r1-2026.html'), 'Race 1', none);
    expect(t?.columns).toEqual(['Pos', 'No.', CREW, 'Team', 'Cup', 'Time', 'Laps', 'Gap']);
    expect(t?.rows[0]).toEqual(['1', '50', 'Arthur Leclerc, Thomas Neubauer', 'AF Corse', 'Pro Cup', '1:24.132', '39', '']);
  });
});

describe('what a run fetches and keeps', () => {
  const rounds = [
    { round: 1, startDate: '2026-04-17', endDate: '2026-04-19', name: 'Imola' },
    { round: 6, startDate: '2026-09-25', endDate: '2026-09-27', name: 'Fuji' },
    { round: 7, startDate: '2026-10-16', endDate: '2026-10-18', name: 'Barcelona' },
    { round: 8, startDate: '2026-11-06', endDate: '2026-11-08', name: 'Monza' },
  ];
  const shaped = (round: number): ResultRound => ({ round, name: '', date: null, sessions: [{ label: 'Race', tables: [{ title: 'Hypercar', columns: ['Pos', 'No.', CREW], rows: [] }] }] });
  const now = new Date('2026-10-23T12:00:00Z');

  it('fetches a round still settling and one not yet in this shape, the newest first, and never one not started', () => {
    expect(roundsDue(rounds, [shaped(1), shaped(6), shaped(7)], now, 5)).toEqual([7]);
    expect(roundsDue(rounds, [shaped(1)], now, 5)).toEqual([7, 6]);
    expect(roundsDue(rounds, null, now, 2)).toEqual([7, 6]);
    expect(roundsDue(rounds, [shaped(1), shaped(6), shaped(7)], new Date('2026-10-26T00:00:00Z'), 5)).toEqual([]);
  });

  it('tells a round of this shape from one stored before it', () => {
    expect(inShape(shaped(1))).toBe(true);
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

  it('keeps a stored session a fetch did not bring back, and every round it did not fetch', () => {
    const t = (title: string) => ({ title, columns: [CREW], rows: [] });
    const stored: ResultRound[] = [
      { round: 1, name: 'Imola', date: '2026-04-19', sessions: [{ label: 'Race', tables: [t('old')] }] },
      { round: 6, name: 'Fuji', date: '2026-09-27', sessions: [{ label: 'Race', tables: [t('old')] }], others: [{ label: 'Free Practice 1', tables: [t('old')] }] },
    ];
    const fresh: ResultRound[] = [{ round: 6, name: '6 Hours of Fuji', date: '2026-09-27', sessions: [], others: [{ label: 'Free Practice 1', tables: [t('new')] }] }];
    const out = mergeRounds(fresh, stored);
    expect(out.map(r => r.round)).toEqual([1, 6]);
    expect(out[1].name).toBe('6 Hours of Fuji');
    expect(out[1].sessions[0].tables[0].title).toBe('old');
    expect(out[1].others?.[0].tables[0].title).toBe('new');
    expect(out[0]).toBe(stored[0]);
  });
});
