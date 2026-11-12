import { describe, expect, it } from 'vitest';
import type { FomResultRow } from '../results/fom-api';
import { fomQualifyingLabel, fomTable, sessionsWanted, timedTable } from './multi-race';
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
