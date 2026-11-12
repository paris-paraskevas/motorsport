import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  feRounds,
  feSeason,
  feSessions,
  feTable,
  inShape,
  indycarEvents,
  indycarLabel,
  indycarRound,
  indycarSession,
  matchByName,
  mergeRounds,
  nameKey,
  nameSpeller,
  nascarRaces,
  nascarRoundRaces,
  nascarWeekend,
  respell,
  roundsDue,
  teamSpeller,
  tidyCaps,
} from './family-b';
import type { ResultRound } from './render';

// The saved answers of 12 Nov 2026 (tests/fixtures): IndyCar's season list and Nashville's race and qualifying (the race
// run on Monday 20 July), NASCAR's Phoenix weekend (18 Oct), Formula E's Shanghai race (round 12, 3 July).
const fixture = (name: string): string => readFileSync(path.join(process.cwd(), 'tests', 'fixtures', name), 'utf8');

const icSpell = nameSpeller(['Álex Palou', 'Josef Newgarden', 'Kyle Kirkwood', 'Caio Collet', 'Louis Foster', 'Graham Rahal']);
const ncSpell = nameSpeller(['Tyler Reddick', 'Ryan Blaney', 'Joey Logano', 'Shane van Gisbergen', 'Austin Dillon']);
const feSpell = nameSpeller(['Pascal Wehrlein', 'António Félix da Costa', 'Lucas di Grassi', 'Norman Nato']);
const FE_TEAMS = ['Jaguar TCS Racing', 'Porsche Formula E Team', 'Mahindra Racing', 'Nissan Formula E Team', 'Envision Racing', 'Andretti Formula E', 'Citroën Racing', 'Cupra Kiro', 'DS Penske', 'Lola Yamaha ABT'];

const row = (t: { columns: string[]; rows: string[][] } | undefined, name: string): Record<string, string> | undefined => {
  const at = t?.columns.indexOf('Driver') ?? -1;
  const r = t?.rows.find(x => x[at] === name);
  return r && t ? Object.fromEntries(t.columns.map((c, i) => [c, r[i]])) : undefined;
};

describe('names', () => {
  it('compares two spellings by their words, case and accents aside', () => {
    expect(nameKey('Alex Palou')).toBe(nameKey('Álex Palou'));
    expect(nameKey('António Félix Da Costa')).toBe(nameKey('António Félix da Costa'));
    expect(icSpell('Alex Palou')).toBe('Álex Palou');
    expect(icSpell('Scott Dixon')).toBeNull();
  });

  it('spells neither of two names with the same words', () => {
    expect(nameSpeller(['Jo Smith', 'Smith Jo'])('jo smith')).toBeNull();
  });

  it("spells Formula E's capitals as drivers.json spells the team, else in ordinary case; mixed case as written", () => {
    const team = teamSpeller(FE_TEAMS);
    expect(team('JAGUAR TCS RACING')).toBe('Jaguar TCS Racing');
    expect(team('DS PENSKE')).toBe('DS Penske');
    expect(team('CITROËN RACING')).toBe('Citroën Racing');
    expect(team('LOLA YAMAHA ABT FORMULA E TEAM')).toBe('Lola Yamaha ABT');
    expect(team('NEW TEAM RACING')).toBe('New Team Racing');
    expect(team('Andretti Global w/ Curb-Agajanian')).toBe('Andretti Global w/ Curb-Agajanian');
    expect(tidyCaps('CUPRA KIRO')).toBe('Cupra Kiro');
  });
});

describe('IndyCar: indycar.com’s results service', () => {
  const events = indycarEvents(fixture('indycar-season-2026.json'), 2026);

  it('lists the season’s eighteen events with their sessions, the latest first', () => {
    expect(events).toHaveLength(18);
    const nashville = events.find(e => e.id === 5531);
    expect(nashville?.name).toBe('Borchetta Bourbon Music City Grand Prix');
    expect(nashville?.sessions.map(s => `${s.id} ${s.name}`)).toEqual(['6748 Race', '6922 Final Practice', '6920 Qualifying', '6919 Practice 1']);
    expect(indycarEvents(fixture('indycar-season-2026.json'), 2025)).toEqual([]);
    expect(indycarEvents('not json', 2026)).toEqual([]);
  });

  it('matches each event to its round by name: the brackets aside, never twice, a sponsor’s new name left unmatched', () => {
    const rounds = [
      { round: 7, name: '110th Indianapolis 500' },
      { round: 12, name: 'Borchetta Bourbon Music City Grand Prix (Nashville Superspeedway)' },
      { round: 15, name: 'Freedom 250 Grand Prix of Washington, D.C.' },
      { round: 16, name: 'Snap-on Makers and Fixers 250 (Milwaukee Mile Race 1)' },
      { round: 17, name: 'Snap-on Milwaukee Mile 250 (Race 2)' },
      { round: 18, name: 'Mission Foods Grand Prix of Monterey' },
      { round: 19, name: 'Acme Grand Prix of Somewhere' },
    ];
    const byRound = matchByName(events, rounds);
    expect(byRound.get(7)?.id).toBe(5526);
    expect(byRound.get(12)?.id).toBe(5531);
    expect(byRound.get(15)?.id).toBe(5549);
    expect(byRound.get(16)?.id).toBe(5522);
    expect(byRound.get(17)?.id).toBe(5521);
    expect(byRound.get(18)?.id).toBe(5519);
    expect(byRound.has(19)).toBe(false);
  });

  it('names the sessions as the pages do: every part of qualifying one session, the grid its first table', () => {
    expect(indycarLabel('Race')).toEqual({ label: 'Race', title: 'Race' });
    expect(indycarLabel('Combined Qualifications')).toEqual({ label: 'Qualifying', title: 'Qualifying' });
    expect(indycarLabel('Qualifying')).toEqual({ label: 'Qualifying', title: 'Qualifying' });
    expect(indycarLabel('Qualifications - Firstone Fast 6')).toEqual({ label: 'Qualifying', title: 'Firestone Fast 6' });
    expect(indycarLabel('Qualifying - Round 1 Group 2')).toEqual({ label: 'Qualifying', title: 'Round 1 Group 2' });
    expect(indycarLabel('Warmup')).toEqual({ label: 'Warm-up', title: 'Warm-up' });
    expect(indycarLabel('Final Practice (Carb Day)')).toEqual({ label: 'Final Practice (Carb Day)', title: 'Final Practice (Carb Day)' });
  });

  it('reads a race: the grid, laps, the winner’s time, each gap, laps down, why a car stopped, the official points', () => {
    const got = indycarSession(fixture('indycar-session-6748.json'), 'Race', icSpell);
    expect(got?.race).toBe(true);
    expect(got?.day).toBe('2026-07-20');
    expect(got?.table.columns).toEqual(['Pos', 'Driver', 'Team', 'Grid', 'Laps', 'Time', 'Pts']);
    expect(got?.table.rows).toHaveLength(25);
    expect(got?.table.rows[0]).toEqual(['1', 'Álex Palou', 'Chip Ganassi Racing', '4', '225', '1:51:38.7603', '53']);
    expect(row(got?.table, 'Josef Newgarden')).toMatchObject({ Pos: '2', Time: '+0.8731', Pts: '40' });
    expect(row(got?.table, 'Louis Foster')).toMatchObject({ Pos: '17', Laps: '223', Time: '+2 laps', Pts: '14' });
    expect(row(got?.table, 'Scott Dixon')).toMatchObject({ Time: '+7 laps' });
    expect(row(got?.table, 'Caio Collet')).toMatchObject({ Pos: '25', Grid: '15', Laps: '17', Time: 'Contact', Pts: '5' });
    expect(got?.table.rows.reduce((n, r) => n + Number(r[6]), 0)).toBe(497);
  });

  it('reads an oval’s qualifying by the run’s total time and its average speed; a car with none “No time”', () => {
    const got = indycarSession(fixture('indycar-session-6920.json'), 'Qualifying', icSpell);
    expect(got?.race).toBe(false);
    expect(got?.day).toBe('2026-07-18');
    expect(got?.table.columns).toEqual(['Pos', 'Driver', 'Team', 'Time', 'Speed']);
    expect(got?.table.rows[0]).toEqual(['1', 'Kyle Kirkwood', 'Andretti Global w/ Curb-Agajanian', '47.5485', '196.852']);
    expect(row(got?.table, 'Graham Rahal')).toMatchObject({ Pos: '25', Time: 'No time', Speed: '' });
  });

  it('reads a road course’s session by the best lap, its gap and the laps run', () => {
    const raw = JSON.stringify({
      SessionName: 'Practice 1',
      SessionDate: '8/7/2026',
      SessionType: 'P',
      TrackType: 'R',
      records: [
        { PositionFinish: 2, DriverName: 'Kyle Kirkwood', TeamName: 'Andretti Global w/ Curb-Agajanian', LapsComplete: 17, BestLapTime: '00:58.6602', Difference: '0.0886' },
        { PositionFinish: 1, DriverName: 'Alex Palou', TeamName: 'Chip Ganassi Racing', LapsComplete: 17, BestLapTime: '00:58.5716', Difference: '--.----' },
        { PositionFinish: 0, DriverName: 'Nobody', IsDeleted: false },
      ],
    });
    const got = indycarSession(raw, 'Practice 1', icSpell);
    expect(got?.table.columns).toEqual(['Pos', 'Driver', 'Team', 'Time', 'Gap', 'Laps']);
    expect(got?.table.rows).toEqual([
      ['1', 'Álex Palou', 'Chip Ganassi Racing', '58.5716', '', '17'],
      ['2', 'Kyle Kirkwood', 'Andretti Global w/ Curb-Agajanian', '58.6602', '+0.0886', '17'],
    ]);
    expect(indycarSession('<html>', 'Practice 1', icSpell)).toBeNull();
    expect(indycarSession(JSON.stringify({ records: [] }), 'Practice 1', icSpell)).toBeNull();
  });

  const nashville = { round: 12, name: 'Borchetta Bourbon Music City Grand Prix (Nashville Superspeedway)', startDate: '2026-07-17', endDate: '2026-07-19' };
  const event = () => events.find(e => e.id === 5531)!;

  it('keeps an event whole as its round: the race dated by its own day, the rest in running order', () => {
    const answers = new Map<number, string | null>([
      [6748, fixture('indycar-session-6748.json')],
      [6920, fixture('indycar-session-6920.json')],
      [6922, JSON.stringify({ SessionType: 'P', records: [] })],
      [6919, JSON.stringify({ SessionType: 'P', records: [] })],
    ]);
    const got = indycarRound(nashville, event(), answers, icSpell);
    expect(got.missed).toEqual([]);
    expect(got.round).toMatchObject({ round: 12, name: nashville.name, date: '2026-07-20' });
    expect(got.round?.sessions.map(s => s.label)).toEqual(['Race']);
    expect(got.round?.others?.map(s => `${s.label}: ${s.tables.map(t => t.title).join(', ')}`)).toEqual(['Qualifying: Qualifying']);
    expect(inShape(got.round ?? undefined)).toBe(true);
  });

  it('keeps nothing from an event with a request unanswered, or a race far from its round’s dates', () => {
    const answers = new Map<number, string | null>([
      [6748, fixture('indycar-session-6748.json')],
      [6920, null],
    ]);
    const got = indycarRound(nashville, event(), answers, icSpell);
    expect(got.round).toBeNull();
    expect(got.missed).toEqual(['Final Practice', 'Qualifying', 'Practice 1']);
    const elsewhere = indycarRound({ ...nashville, startDate: '2026-08-07', endDate: '2026-08-09' }, event(), new Map(event().sessions.map(s => [s.id, s.id === 6748 ? fixture('indycar-session-6748.json') : '{"records":[]}'])), icSpell);
    expect(elsewhere.round).toBeNull();
    expect(elsewhere.missed).toEqual(["the race on 2026-07-20, outside round 12's dates"]);
  });

  it('groups qualifying’s parts in one session, the grid first, then the parts as they ran', () => {
    const part = (title: string, day: string) => JSON.stringify({ SessionDate: day, SessionType: 'Q', TrackType: 'R', records: [{ PositionFinish: 1, DriverName: `${title} leader`, TeamName: 'Team Penske', BestLapTime: '58.4828', LapsComplete: 5 }] });
    const ev = { id: 1, name: 'Test Grand Prix', sessions: [
      { id: 9, name: 'Race' },
      { id: 8, name: 'Warmup' },
      { id: 7, name: 'Combined Qualifying' },
      { id: 6, name: 'Qualifying - Firestone Fast 6' },
      { id: 5, name: 'Qualifying - Round 2' },
      { id: 4, name: 'Qualifying - Round 1 Group 2' },
      { id: 3, name: 'Qualifying - Round 1 Group 1' },
      { id: 2, name: 'Practice 2' },
      { id: 1, name: 'Practice 1' },
    ] };
    const answers = new Map<number, string | null>([
      [9, fixture('indycar-session-6748.json').replace('7/20/2026', '8/9/2026')],
      [8, JSON.stringify({ SessionDate: '8/9/2026', SessionType: 'P', TrackType: 'R', records: [{ PositionFinish: 1, DriverName: 'W', TeamName: 'T', BestLapTime: '00:59.1', LapsComplete: 9 }] })],
      [7, part('Combined', '8/8/2026')],
      [6, part('Fast 6', '8/8/2026')],
      [5, part('Round 2', '8/8/2026')],
      [4, part('Group 2', '8/8/2026')],
      [3, part('Group 1', '8/8/2026')],
      [2, JSON.stringify({ SessionDate: '8/8/2026', SessionType: 'P', TrackType: 'R', records: [{ PositionFinish: 1, DriverName: 'P2', TeamName: 'T', BestLapTime: '00:59.0', LapsComplete: 9 }] })],
      [1, JSON.stringify({ SessionDate: '8/7/2026', SessionType: 'P', TrackType: 'R', records: [{ PositionFinish: 1, DriverName: 'P1', TeamName: 'T', BestLapTime: '00:59.0', LapsComplete: 9 }] })],
    ]);
    const got = indycarRound({ round: 13, name: 'Test Grand Prix', startDate: '2026-08-07', endDate: '2026-08-09' }, ev, answers, icSpell);
    expect(got.round?.others?.map(s => s.label)).toEqual(['Practice 1', 'Practice 2', 'Qualifying', 'Warm-up']);
    expect(got.round?.others?.[2].tables.map(t => t.title)).toEqual(['Qualifying', 'Round 1 Group 1', 'Round 1 Group 2', 'Round 2', 'Firestone Fast 6']);
  });
});

describe('NASCAR: its race feed', () => {
  it('reads a weekend: the finish, each stage’s top ten, practice and qualifying, each car’s team from the race', () => {
    const got = nascarWeekend(fixture('nascar-weekend-5633.json'), 'Race', ncSpell);
    expect(got?.day).toBe('2026-10-18');
    const [race, stage1, stage2] = got?.race?.tables ?? [];
    expect(race.columns).toEqual(['Pos', 'Driver', 'Team', 'Grid', 'Laps', 'Time', 'Pts']);
    expect(race.rows).toHaveLength(37);
    expect(race.rows[0]).toEqual(['1', 'Tyler Reddick', '23XI Racing', '6', '312', '3:01:23', '61']);
    expect(row(race, 'Ryan Blaney')).toMatchObject({ Grid: '1', Time: '+0.801', Pts: '48' });
    expect(row(race, 'Denny Hamlin')).toMatchObject({ Pos: '28', Time: '+1 lap' });
    expect(row(race, 'Austin Dillon')).toMatchObject({ Pos: '37', Laps: '155', Time: 'Accident', Pts: '1' });
    expect(stage1.title).toBe('Stage 1');
    expect(stage1.columns).toEqual(['Pos', 'Driver', 'Team', 'Pts']);
    expect(stage1.rows[0]).toEqual(['1', 'Joey Logano', 'Team Penske', '10']);
    expect(stage2.rows).toHaveLength(10);
    expect(got?.others.map(s => s.label)).toEqual(['Final Practice', 'Qualifying']);
    const [practice] = got?.others[0].tables ?? [];
    expect(practice.columns).toEqual(['Pos', 'Driver', 'Team', 'Time', 'Gap', 'Laps']);
    expect(practice.rows[0]).toEqual(['1', 'Ryan Blaney', 'Team Penske', '26.969', '', '77']);
    expect(row(practice, 'Shane van Gisbergen')).toMatchObject({ Pos: '37', Team: 'Trackhouse Racing', Time: '27.696', Gap: '+0.727' });
    const [qualifying] = got?.others[1].tables ?? [];
    expect(qualifying.title).toBe('Qualifying');
    expect(qualifying.columns).toEqual(['Pos', 'Driver', 'Team', 'Time', 'Speed']);
    expect(qualifying.rows[0]).toEqual(['1', 'Ryan Blaney', 'Team Penske', '26.250', '137.143']);
  });

  it('leaves out a car that did not qualify and a session with no time (called off, the field set by the rule book)', () => {
    const feed = JSON.stringify({
      weekend_race: [{ race_date: '2026-02-22T15:00:00', total_race_time: '0:49:07', results: [
        { finishing_position: 0, driver_fullname: 'Did Not Qualify', team_name: 'X' },
        { finishing_position: 1, starting_position: 1, driver_fullname: 'Tyler Reddick', team_name: '23XI Racing', laps_completed: 60, finishing_status: 'Running', points_earned: 10, diff_laps: 0, diff_time: 0 },
      ] }],
      weekend_runs: [{ run_type: 2, run_name: 'Autotrader 400 Busch Pole Qualifying - Round 1', run_date_utc: '2026-02-22T20:00:00', results: [{ finishing_position: 1, car_number: '45', driver_name: 'Tyler Reddick', best_lap_time: 0, laps_completed: 0 }] }],
    });
    const got = nascarWeekend(feed, 'Duel 1', ncSpell);
    expect(got?.race?.tables[0].rows).toEqual([['1', 'Tyler Reddick', '23XI Racing', '1', '60', '49:07', '10']]);
    expect(got?.race?.label).toBe('Duel 1');
    expect(got?.others).toEqual([]);
    expect(nascarWeekend('<html>', 'Race', ncSpell)).toBeNull();
  });

  it('finds each round’s points race by its day, and the Duels the Daytona 500 round also holds', () => {
    const list = JSON.stringify([
      { race_id: 5593, race_type_id: 2, race_name: 'Cook Out Clash at Bowman Gray', race_date: '2026-02-04T18:00:00' },
      { race_id: 5595, race_type_id: 2, race_name: 'America 250 Florida Duel at DAYTONA', race_date: '2026-02-12T20:45:00' },
      { race_id: 5594, race_type_id: 2, race_name: 'America 250 Florida Duel at DAYTONA', race_date: '2026-02-12T19:00:00' },
      { race_id: 5596, race_type_id: 1, race_name: 'DAYTONA 500', race_date: '2026-02-15T14:30:00' },
      { race_id: 5597, race_type_id: 1, race_name: 'Autotrader 400', race_date: '2026-02-22T15:00:00' },
      { race_id: 5609, race_type_id: 2, race_name: 'NASCAR All-Star Race', race_date: '2026-05-17T13:00:00' },
    ]);
    const races = nascarRaces(list);
    expect(races).toHaveLength(6);
    const byRound = nascarRoundRaces(races, [
      { round: 1, startDate: '2026-02-15', endDate: '2026-02-15' },
      { round: 2, startDate: '2026-02-22', endDate: '2026-02-22' },
      { round: 3, startDate: '2026-03-01', endDate: '2026-03-01' },
    ]);
    expect(byRound.get(1)?.race.id).toBe(5596);
    expect(byRound.get(1)?.duels.map(d => d.id)).toEqual([5594, 5595]);
    expect(byRound.get(2)).toMatchObject({ race: { id: 5597 }, duels: [] });
    expect(byRound.has(3)).toBe(false);
  });
});

describe('Formula E: fiaformulae.com’s result pages', () => {
  const page = fixture('formula-e-r12-race-2026.html');

  it('lists the season’s rounds by number and a round’s sessions in running order', () => {
    expect(feSeason(2026)).toBe(12);
    const rounds = feRounds(page, 12);
    expect(rounds.size).toBe(17);
    expect(rounds.get(12)).toBe('12-shanghai');
    expect(rounds.get(11)).toBe('11-sanya-fenghuang-international-apt');
    expect(feRounds(page, 11).size).toBe(0);
    expect(feSessions(page, '12-shanghai')).toEqual([
      { key: 'free-practice-1', label: 'Practice 1', kind: 'practice' },
      { key: 'free-practice-2', label: 'Practice 2', kind: 'practice' },
      { key: 'qualifying', label: 'Qualifying', kind: 'qualifying' },
      { key: 'race', label: 'Race', kind: 'race' },
    ]);
  });

  it('reads a race: twenty finishers, the grid, the time or gap, a lapped car, the points with the pole’s', () => {
    const t = feTable(page, 'race', 'Race', feSpell, teamSpeller(FE_TEAMS));
    expect(t?.columns).toEqual(['Pos', 'Driver', 'Team', 'Grid', 'Time', 'Pts']);
    expect(t?.rows).toHaveLength(20);
    expect(t?.rows[0]).toEqual(['1', 'Pascal Wehrlein', 'Porsche Formula E Team', '1', '40:30.411', '28']);
    expect(t?.rows[1]).toEqual(['2', 'António Félix da Costa', 'Jaguar TCS Racing', '5', '+1.633', '19']);
    expect(row(t ?? undefined, 'Norman Nato')).toMatchObject({ Pos: '20', Grid: '20', Time: '+1 lap', Pts: '0' });
    expect(row(t ?? undefined, 'Lucas di Grassi')?.Team).toBe('Lola Yamaha ABT');
    expect(feTable('<html><body>No results</body></html>', 'race', 'Race', feSpell, teamSpeller(FE_TEAMS))).toBeNull();
  });

  it('reads a practice’s gap and qualifying’s classification by their headings', () => {
    const head = (cells: string[]) => `<thead><tr>${cells.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
    const body = (rows: string[][]) =>
      `<tbody>${rows.map(([p, n, team, ...rest]) => `<tr><td><span>${p}</span></td><th scope="row"><a href="/en/drivers/x">${n}</a><span>${team}</span></th><td>${team}</td>${rest.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`;
    const practice = `<table>${head(['PosPosition', 'Driver', 'Team', 'Time', 'Gap', 'Time'])}${body([
      ['1', 'Pascal Wehrlein', 'PORSCHE FORMULA E TEAM', '1:09.259', '-', '1:09.259'],
      ['2', 'Jean-Éric Vergne', 'CITROËN RACING', '1:09.449', '+0.190', '1:09.449'],
    ])}</table>`;
    expect(feTable(practice, 'practice', 'Practice 1', feSpell, teamSpeller(FE_TEAMS))?.rows).toEqual([
      ['1', 'Pascal Wehrlein', 'Porsche Formula E Team', '1:09.259', ''],
      ['2', 'Jean-Éric Vergne', 'Citroën Racing', '1:09.449', '+0.190'],
    ]);
    const qualifying = `<table>${head(['PosPosition', 'Driver', 'Team', 'Time', 'Time'])}${body([['—', 'Lucas Di Grassi', 'LOLA YAMAHA ABT FORMULA E TEAM', '1:10.916', '1:10.916']])}</table>`;
    const q = feTable(qualifying, 'qualifying', 'Qualifying', feSpell, teamSpeller(FE_TEAMS));
    expect(q?.columns).toEqual(['Pos', 'Driver', 'Team', 'Time']);
    expect(q?.rows).toEqual([['—', 'Lucas di Grassi', 'Lola Yamaha ABT', '1:10.916']]);
  });
});

describe('what a run fetches, and what it keeps', () => {
  const old = (round: number, date: string): ResultRound => ({ round, name: `R${round}`, date, sessions: [{ label: 'Race', tables: [{ title: 'Race', columns: ['Pos', 'Driver', 'Team', 'Time', 'Pts'], rows: [['1', 'Alex Palou', 'Chip Ganassi Racing', 'Finished', '51']] }] }] });
  const shaped = (round: number, date: string): ResultRound => ({ round, name: `R${round}`, date, sessions: [{ label: 'Race', tables: [{ title: 'Race', columns: ['Pos', 'Driver', 'Team', 'Grid', 'Laps', 'Time', 'Pts'], rows: [['1', 'Alex Palou', 'Chip Ganassi Racing', '4', '225', '1:51:38.7603', '53']] }] }] });
  const rounds = [
    { round: 1, startDate: '2026-03-01', endDate: '2026-03-01' },
    { round: 2, startDate: '2026-03-08', endDate: '2026-03-08' },
    { round: 3, startDate: '2026-03-15', endDate: '2026-03-15' },
    { round: 4, startDate: '2026-03-22', endDate: '2026-03-22' },
  ];

  it('tells a round stored in this shape by its race’s grid', () => {
    expect(inShape(shaped(1, '2026-03-01'))).toBe(true);
    expect(inShape(old(1, '2026-03-01'))).toBe(false);
    expect(inShape(undefined)).toBe(false);
  });

  it('asks for each started round within a week of its end, and any not yet in this shape, the newest first', () => {
    const now = new Date('2026-03-18T12:00:00Z');
    // Round 1 in shape and settled; round 2 stored before; round 3 within its week; round 4 not started.
    expect(roundsDue(rounds, [shaped(1, '2026-03-01'), old(2, '2026-03-08'), shaped(3, '2026-03-15')], now, 10)).toEqual([3, 2]);
    expect(roundsDue(rounds, null, now, 2)).toEqual([3, 2]);
    expect(roundsDue(rounds, [shaped(1, '2026-03-01'), shaped(2, '2026-03-08')], new Date('2026-03-30T00:00:00Z'), 10)).toEqual([4, 3]);
  });

  it('puts the fresh rounds in the stored ones’ place, by date, the other seasons dropped', () => {
    const merged = mergeRounds([shaped(2, '2026-03-08')], [old(2, '2026-03-08'), old(1, '2026-03-01'), old(9, '2025-09-01')], 2026);
    expect(merged.map(r => `${r.round} ${inShape(r)}`)).toEqual(['1 false', '2 true']);
  });

  it('spells every kept round’s drivers again as drivers.json does', () => {
    const [r] = respell([old(1, '2026-03-01')], icSpell);
    expect(r.sessions[0].tables[0].rows[0][1]).toBe('Álex Palou');
  });
});
