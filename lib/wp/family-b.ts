// Family B's data (slot O35): IndyCar, NASCAR Cup and Formula E, every session of a round from each series' own results
// (the operator's answers of 12 Nov: indycar.com's results service, NASCAR's race feed, fiaformulae.com's result pages),
// every name spelled as the series' drivers.json spells it. Pure, as render.ts: the sources' answers in, the stored
// shapes out. The publisher (scripts/wp-publish.mts, family B's block) fetches and keeps them; the pages that read them
// join this file in O35's third PR.
//
// Every table keeps Formula 1's columns where a series has them (render.ts), so the pages read the three as they read
// Formula 1: a race's Pos, Driver, Team, Grid (the starting place, which all three print, and which tells a round stored
// in this shape from one stored before it: inShape), Laps (IndyCar's and NASCAR's: laps and gaps, B6), Time (the winner's
// total, then the gap, "+N laps", or why a car stopped, as the series writes it) and Pts (as the series gives them,
// bonuses included); a practice's best lap as Time, then Gap and Laps; an oval's qualifying and NASCAR's the Time and the
// Speed it is ranked by.

import * as cheerio from 'cheerio';
import type { SeriesRoundEntry } from '@/lib/types';
import type { ResultRound, ResultSession, Table } from './render';

const RACE_COLUMNS = ['Pos', 'Driver', 'Team', 'Grid', 'Laps', 'Time', 'Pts'];
const FE_RACE_COLUMNS = ['Pos', 'Driver', 'Team', 'Grid', 'Time', 'Pts'];
const STAGE_COLUMNS = ['Pos', 'Driver', 'Team', 'Pts'];
const TIMED_COLUMNS = ['Pos', 'Driver', 'Team', 'Time', 'Gap', 'Laps'];
const RUN_COLUMNS = ['Pos', 'Driver', 'Team', 'Time', 'Speed'];
const FE_PRACTICE_COLUMNS = ['Pos', 'Driver', 'Team', 'Time', 'Gap'];
const FE_QUALIFYING_COLUMNS = ['Pos', 'Driver', 'Team', 'Time'];

type Spell = (name: string) => string | null;

const clean = (s: unknown): string => (typeof s === 'string' ? s : typeof s === 'number' ? String(s) : '').replace(/\s+/g, ' ').trim();
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A clock as the series writes it, its leading zero hours and minutes dropped: "01:51:38.7603" → "1:51:38.7603",
 *  "00:58.5716" → "58.5716", NASCAR's "0:49:07" → "49:07". */
const clock = (s: unknown): string =>
  clean(s)
    .replace(/^(?:0?0:)+/, '')
    .replace(/^0(?=\d)/, '');

/** Seconds as a lap time, counted in whole milliseconds so 119.9999 reads "2:00.000", never "1:60.000"; '' for none. */
function seconds(n: number | null): string {
  if (n === null || !(n > 0)) return '';
  const ms = Math.round(n * 1000);
  const m = Math.floor(ms / 60_000);
  const s = ((ms - m * 60_000) / 1000).toFixed(3);
  return m ? `${m}:${s.padStart(6, '0')}` : s;
}

const lapsDown = (n: number): string => (n === 1 ? '+1 lap' : `+${n} laps`);

// ── Names ────────────────────────────────────────────────────────────────────

/** A name's words for comparing two spellings: case and accents dropped, the letters NFD keeps whole written plainly,
 *  the words sorted, so "Alex Palou" meets "Álex Palou" and "António Félix Da Costa" "António Félix da Costa". The same
 *  rule as family C's (endurance.ts, O34); one of the two goes once both are merged. */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');
}

/** drivers.json's spelling of a name when every word of it matches one name there, else null; two names with the same
 *  words spell neither. */
export function nameSpeller(spellings: readonly string[]): Spell {
  const byKey = new Map<string, string | null>();
  for (const s of spellings) {
    const key = nameKey(s);
    if (!key) continue;
    byKey.set(key, byKey.has(key) && byKey.get(key) !== s ? null : s);
  }
  return name => byKey.get(nameKey(name)) ?? null;
}

/** A name written entirely in capitals, in ordinary case ("CUPRA KIRO" → "Cupra Kiro"); any other unchanged. */
export function tidyCaps(name: string): string {
  if (/\p{Ll}/u.test(name)) return name;
  return name.toLowerCase().replace(/(^|[\s'-])(\p{Ll})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** A team as the result names it. Formula E writes its teams in capitals: those take the spelling of drivers.json's team
 *  with the same words, or the one team whose words they all hold ("LOLA YAMAHA ABT FORMULA E TEAM" → "Lola Yamaha
 *  ABT"), else ordinary case. A name in mixed case (IndyCar's, NASCAR's) is kept as written. */
export function teamSpeller(teams: readonly string[]): (name: string) => string {
  const keyed = teams.map(t => ({ name: t, words: new Set(nameKey(t).split(' ')) }));
  return name => {
    const written = clean(name);
    if (/\p{Ll}/u.test(written) || !written) return written;
    const words = nameKey(written).split(' ');
    const same = keyed.find(t => t.words.size === words.length && words.every(w => t.words.has(w)));
    if (same) return same.name;
    const within = keyed.filter(t => [...t.words].every(w => words.includes(w)));
    return within.length === 1 ? within[0].name : tidyCaps(written);
  };
}

/** Every table's Driver column spelled again, a run at a time, so an edit to drivers.json reaches the rounds already
 *  kept; a name drivers.json does not know stays as stored. */
export function respell(rounds: readonly ResultRound[], spell: Spell): ResultRound[] {
  const again = (s: ResultSession): ResultSession => ({
    ...s,
    tables: s.tables.map(t => {
      const at = t.columns.indexOf('Driver');
      return at < 0 ? t : { ...t, rows: t.rows.map(row => row.map((cell, i) => (i === at ? (spell(cell) ?? cell) : cell))) };
    }),
  });
  return rounds.map(r => ({ ...r, sessions: r.sessions.map(again), ...(r.others ? { others: r.others.map(again) } : {}) }));
}

// ── Matching an event to its round ───────────────────────────────────────────

const dayNumber = (iso: string): number => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000;

/** Whether a day is within `before` days ahead of a round's start and `after` days past its end. */
export const nearRound = (day: string, r: Pick<SeriesRoundEntry, 'startDate' | 'endDate'>, before: number, after: number): boolean =>
  dayNumber(day) >= dayNumber(r.startDate) - before && dayNumber(day) <= dayNumber(r.endDate) + after;

/** The share of two names' words they have in common (the words in brackets aside: rounds.json's "(Phoenix Raceway)"). */
function likeness(a: string, b: string): number {
  const words = (s: string) => new Set(nameKey(s.replace(/\([^)]*\)/g, ' ')).split(' ').filter(Boolean));
  const x = words(a);
  const y = words(b);
  const shared = [...x].filter(w => y.has(w)).length;
  return shared / (x.size + y.size - shared || 1);
}

/** Each round's event by name, the closest first, never one event for two rounds, and at least half the words shared:
 *  the "110th Running of the Indianapolis 500" is rounds.json's "110th Indianapolis 500". A sponsor's new name rounds.json
 *  has not taken leaves its round unmatched, logged by the caller. */
export function matchByName<T extends { name: string }>(events: readonly T[], rounds: readonly Pick<SeriesRoundEntry, 'round' | 'name'>[]): Map<number, T> {
  const pairs = rounds.flatMap(r => events.map(e => ({ round: r.round, e, score: likeness(r.name, e.name) }))).filter(p => p.score >= 0.5);
  pairs.sort((a, b) => b.score - a.score);
  const out = new Map<number, T>();
  const used = new Set<T>();
  for (const p of pairs) {
    if (out.has(p.round) || used.has(p.e)) continue;
    out.set(p.round, p.e);
    used.add(p.e);
  }
  return out;
}

// ── IndyCar: indycar.com's results service ───────────────────────────────────

export interface IndyCarEvent {
  id: number;
  name: string;
  /** As SeasonDropDown lists them, the latest first. */
  sessions: { id: number; name: string }[];
}

/** The season's events from SeasonDropDown's answer (every season IndyCar keeps, each with its events and sessions). */
export function indycarEvents(raw: string, season: number): IndyCarEvent[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const year = Array.isArray(data) ? data.find(y => isObj(y) && clean(y.Year) === String(season)) : null;
  const events = isObj(year) && Array.isArray(year.Events) ? year.Events : [];
  return events.filter(isObj).map(e => ({
    id: Number(e.EventID),
    name: clean(e.EventName),
    sessions: (Array.isArray(e.Sessions) ? e.Sessions : []).filter(isObj).map(s => ({ id: Number(s.EventsSessionID), name: clean(s.SessionName) })),
  }));
}

/**
 * A session as IndyCar names it, as the pages name it: the race "Race"; every part of qualifying one session,
 * "Qualifying", each part a table ("Combined Qualifying" and a lone "Qualifying" the table "Qualifying", the grid;
 * "Qualifying - Round 2" the table "Round 2"); "Warmup" "Warm-up"; any other as written. IndyCar wrote "Qualifications"
 * and "Firstone" at its first two rounds of 2026.
 */
export function indycarLabel(name: string): { label: string; title: string } {
  const n = clean(name).replace(/\bQualifications\b/gi, 'Qualifying').replace(/\bFirstone\b/g, 'Firestone');
  if (/^race$/i.test(n)) return { label: 'Race', title: 'Race' };
  if (/^(combined )?qualifying$/i.test(n)) return { label: 'Qualifying', title: 'Qualifying' };
  const part = /^qualifying\s+-+\s+(.+)$/i.exec(n);
  if (part) return { label: 'Qualifying', title: part[1] };
  if (/^warm-?up$/i.test(n)) return { label: 'Warm-up', title: 'Warm-up' };
  return { label: n, title: n };
}

interface IndyCarRecord {
  PositionFinish?: unknown;
  PositionStart?: unknown;
  DriverName?: unknown;
  TeamName?: unknown;
  ElapsedTime?: unknown;
  LapsComplete?: unknown;
  LapsDown?: unknown;
  BestLapTime?: unknown;
  Difference?: unknown;
  Status?: unknown;
  PointsEarned?: unknown;
  SpeedAvg?: unknown;
  IsDeleted?: unknown;
}

/** "+0.8731" from IndyCar's Difference; '' for the leader's "--.----" and a lapped car's "-". */
const icGap = (d: unknown): string => (/^\d+(\.\d+)?$/.test(clean(d)) ? `+${clean(d)}` : '');

/**
 * One session from EventsSessionDetails' answer: its rows as classified, its day (SessionDate "7/20/2026" as YYYY-MM-DD)
 * and whether it is the race. A race's row: Grid from the start, Laps completed, Time the winner's elapsed time, a car
 * on the lead lap's gap, a lapped car's laps down, or why a car stopped ("Contact"), and the official points (the
 * Indianapolis 500's qualifying points among its race's, as IndyCar's own points table counts them). An oval's
 * qualifying ranks by the run's total time and its average speed; every other session by the best lap, its gap and the
 * laps run. A session that gives points of its own outside a race keeps them in a Pts column. Null for an unreadable
 * answer or one with no rows.
 */
export function indycarSession(raw: string, title: string, spell: Spell): { table: Table; day: string | null; race: boolean } | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(data) || !Array.isArray(data.records)) return null;
  const date = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean(data.SessionDate));
  const day = date ? `${date[3]}-${date[1].padStart(2, '0')}-${date[2].padStart(2, '0')}` : null;
  const race = clean(data.SessionType) === 'R';
  // IndyCar marks its ovals O and the Indianapolis oval I (its road course is R, the streets S).
  const oval = /^[OI]$/.test(clean(data.TrackType));
  const records = (data.records as unknown[])
    .filter(isObj)
    .map(r => r as IndyCarRecord)
    .filter(r => r.IsDeleted !== true && (num(r.PositionFinish) ?? 0) >= 1)
    .sort((a, b) => (num(a.PositionFinish) ?? 0) - (num(b.PositionFinish) ?? 0));
  if (records.length === 0) return null;
  const who = (r: IndyCarRecord): string[] => [String(num(r.PositionFinish)), spell(clean(r.DriverName)) ?? clean(r.DriverName), clean(r.TeamName)];
  const pts = (r: IndyCarRecord): string => (num(r.PointsEarned) === null ? '' : String(num(r.PointsEarned)));
  if (race) {
    const rows = records.map(r => {
      const status = clean(r.Status);
      const down = num(r.LapsDown) ?? 0;
      const time = num(r.PositionFinish) === 1 ? clock(r.ElapsedTime) : status && !/^running$/i.test(status) ? status : down > 0 ? lapsDown(down) : icGap(r.Difference);
      const grid = num(r.PositionStart);
      return [...who(r), grid && grid > 0 ? String(grid) : '', num(r.LapsComplete) === null ? '' : String(num(r.LapsComplete)), time, pts(r)];
    });
    return { table: { title, columns: RACE_COLUMNS, rows }, day, race };
  }
  const scored = records.some(r => (num(r.PointsEarned) ?? 0) > 0);
  const withPts = (columns: string[], rows: string[][]): Table =>
    scored ? { title, columns: [...columns, 'Pts'], rows: rows.map((row, i) => [...row, pts(records[i])]) } : { title, columns, rows };
  if (oval && clean(data.SessionType) === 'Q') {
    const rows = records.map(r => {
      const total = clock(r.ElapsedTime);
      const speed = num(r.SpeedAvg);
      return [...who(r), /^\d/.test(total) ? total : 'No time', speed && speed > 0 ? speed.toFixed(3) : ''];
    });
    return { table: withPts(RUN_COLUMNS, rows), day, race };
  }
  const rows = records.map(r => [...who(r), clock(r.BestLapTime), icGap(r.Difference), num(r.LapsComplete) === null ? '' : String(num(r.LapsComplete))]);
  return { table: withPts(TIMED_COLUMNS, rows), day, race };
}

/** Running order, from the order the sources list a round's sessions and each session's day. */
interface Placed {
  label: string;
  table: Table;
  race: boolean;
  day: string | null;
  order: number;
}

/** Sessions as a round holds them: the races in `sessions` (the main race last), the rest in `others`, in running order
 *  (by day, then as listed); the tables of one label (qualifying's parts) one session, its grid first, then the parts in
 *  running order. */
function sessionsOf(placed: readonly Placed[]): { sessions: ResultSession[]; others: ResultSession[] } {
  const ordered = [...placed].sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '') || a.order - b.order);
  const byLabel = new Map<string, { label: string; race: boolean; tables: Table[] }>();
  for (const p of ordered) {
    const s = byLabel.get(p.label) ?? { label: p.label, race: p.race, tables: [] };
    s.tables.push(p.table);
    byLabel.set(p.label, s);
  }
  const grouped = [...byLabel.values()].map(s => {
    if (s.tables.length === 1) return { label: s.label, race: s.race, tables: [{ ...s.tables[0], title: s.label }] };
    const grid = s.tables.filter(t => t.title === s.label);
    return { label: s.label, race: s.race, tables: [...grid, ...s.tables.filter(t => t.title !== s.label)] };
  });
  return {
    sessions: grouped.filter(s => s.race).map(({ label, tables }) => ({ label, tables })),
    others: grouped.filter(s => !s.race).map(({ label, tables }) => ({ label, tables })),
  };
}

/**
 * An IndyCar event as its round: each listed session's answer read (`answers` by session id; null where the request
 * went unanswered), the race in `sessions`, the rest in running order. Nothing (and what was missed) when a request went
 * unanswered or the race's day lies more than three days from the round's dates (a name matched to the wrong round): the
 * stored round stays and is asked again next run. A session listed with no rows is left out.
 */
export function indycarRound(
  entry: Pick<SeriesRoundEntry, 'round' | 'name' | 'startDate' | 'endDate'>,
  event: IndyCarEvent,
  answers: ReadonlyMap<number, string | null>,
  spell: Spell,
): { round: ResultRound | null; missed: string[] } {
  const missed: string[] = [];
  const placed: Placed[] = [];
  let raceDay: string | null = null;
  event.sessions.forEach((s, i) => {
    const raw = answers.get(s.id);
    if (raw === undefined || raw === null) {
      missed.push(s.name);
      return;
    }
    const { label, title } = indycarLabel(s.name);
    const got = indycarSession(raw, title, spell);
    if (!got) return;
    if (got.race) raceDay = got.day;
    placed.push({ label, table: got.table, race: got.race, day: got.day, order: event.sessions.length - i });
  });
  if (raceDay !== null && !nearRound(raceDay, entry, 3, 3)) missed.push(`the race on ${raceDay}, outside round ${entry.round}'s dates`);
  if (missed.length > 0 || placed.length === 0) return { round: null, missed };
  const { sessions, others } = sessionsOf(placed);
  return { round: { round: entry.round, name: entry.name, date: raceDay ?? entry.endDate, sessions, others }, missed };
}

// ── NASCAR: its race feed (cf.nascar.com) ────────────────────────────────────

export interface NascarRace {
  id: number;
  name: string;
  /** YYYY-MM-DD, the day NASCAR dates the race. */
  day: string;
  /** A points race (race_type_id 1); the Clash, the Duels and the All-Star Race are not. */
  points: boolean;
  /** Its start as the list writes it, to order two races of one day (the Duels). */
  start: string;
}

/** The season's races from race_list_basic.json. */
export function nascarRaces(raw: string): NascarRace[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  return (Array.isArray(data) ? data : [])
    .filter(isObj)
    .filter(r => typeof r.race_id === 'number' && /^\d{4}-\d{2}-\d{2}/.test(clean(r.race_date)))
    .map(r => ({ id: r.race_id as number, name: clean(r.race_name), day: clean(r.race_date).slice(0, 10), points: r.race_type_id === 1, start: clean(r.race_date) }));
}

/** Each round's points race by its day (within a day of the round's), and the Duels a Daytona 500 round also holds: the
 *  races named Duel in the four days before it, in the order they ran. They pay the top ten championship points. */
export function nascarRoundRaces(races: readonly NascarRace[], rounds: readonly Pick<SeriesRoundEntry, 'round' | 'startDate' | 'endDate'>[]): Map<number, { race: NascarRace; duels: NascarRace[] }> {
  const out = new Map<number, { race: NascarRace; duels: NascarRace[] }>();
  for (const r of rounds) {
    const race = races.filter(x => x.points && nearRound(x.day, r, 1, 1));
    if (race.length !== 1) continue;
    const duels = races
      .filter(x => !x.points && /\bduel\b/i.test(x.name) && nearRound(x.day, r, 4, 0) && x.day < r.startDate)
      .sort((a, b) => a.start.localeCompare(b.start) || a.id - b.id);
    out.set(r.round, { race: race[0], duels });
  }
  return out;
}

interface NascarFinish {
  finishing_position?: unknown;
  starting_position?: unknown;
  car_number?: unknown;
  driver_fullname?: unknown;
  team_name?: unknown;
  laps_completed?: unknown;
  finishing_status?: unknown;
  points_earned?: unknown;
  diff_laps?: unknown;
  diff_time?: unknown;
}

const carOf = (v: unknown): string => clean(v).replace(/^\*+/, '');

/**
 * A weekend feed's race as a session (`label`: "Race", "Duel 1"): its classification, then each stage's top ten and the
 * points it paid ("Stage 1", "Stage 2"; the Coca-Cola 600's three); its practices and qualifying beside it in running
 * order, each car's team from the race; and the race's day. Time is the winner's race time, then each car's gap
 * (diff_time, in milliseconds), "+N laps", or its status when it stopped ("Accident"). A car that did not qualify
 * (position 0) is left out; a practice or qualifying with no time (called off, the field set by the rule book) too.
 */
export function nascarWeekend(raw: string, label: string, spell: Spell): { race: ResultSession | null; others: ResultSession[]; day: string | null } | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const race = isObj(data) && Array.isArray(data.weekend_race) && isObj(data.weekend_race[0]) ? data.weekend_race[0] : null;
  if (!race) return null;
  const finish = (Array.isArray(race.results) ? race.results : [])
    .filter(isObj)
    .map(r => r as NascarFinish)
    .filter(r => (num(r.finishing_position) ?? 0) >= 1)
    .sort((a, b) => (num(a.finishing_position) ?? 0) - (num(b.finishing_position) ?? 0));
  const teams = new Map(finish.map(r => [carOf(r.car_number), clean(r.team_name)]));
  const name = (n: unknown): string => spell(clean(n)) ?? clean(n);
  const tables: Table[] = [];
  if (finish.length) {
    const rows = finish.map(r => {
      const status = clean(r.finishing_status);
      const down = num(r.diff_laps) ?? 0;
      const gap = num(r.diff_time) ?? 0;
      const time = num(r.finishing_position) === 1 ? clock(race.total_race_time) : status && !/^running$/i.test(status) ? status : down > 0 ? lapsDown(down) : gap > 0 ? `+${seconds(gap / 1000)}` : '';
      const grid = num(r.starting_position);
      return [String(num(r.finishing_position)), name(r.driver_fullname), clean(r.team_name), grid && grid > 0 ? String(grid) : '', num(r.laps_completed) === null ? '' : String(num(r.laps_completed)), time, String(num(r.points_earned) ?? '')];
    });
    tables.push({ title: label, columns: RACE_COLUMNS, rows });
    const stages = (Array.isArray(race.stage_results) ? race.stage_results : []).filter(isObj).sort((a, b) => (num(a.stage_number) ?? 0) - (num(b.stage_number) ?? 0));
    for (const s of stages) {
      const rows = (Array.isArray(s.results) ? s.results : [])
        .filter(isObj)
        .filter(r => (num(r.finishing_position) ?? 0) >= 1)
        .sort((a, b) => (num(a.finishing_position) ?? 0) - (num(b.finishing_position) ?? 0))
        .map(r => [String(num(r.finishing_position)), name(r.driver_fullname), teams.get(carOf(r.car_number)) ?? '', String(num(r.stage_points) ?? '')]);
      if (rows.length) tables.push({ title: `Stage ${num(s.stage_number)}`, columns: STAGE_COLUMNS, rows });
    }
  }
  const placed: Placed[] = [];
  const runs = isObj(data) && Array.isArray(data.weekend_runs) ? data.weekend_runs.filter(isObj) : [];
  runs.forEach((run, i) => {
    const results = (Array.isArray(run.results) ? run.results : []).filter(isObj).filter(r => (num(r.finishing_position) ?? 0) >= 1);
    if (!results.some(r => (num(r.best_lap_time) ?? 0) > 0)) return;
    results.sort((a, b) => (num(a.finishing_position) ?? 0) - (num(b.finishing_position) ?? 0));
    const qualifying = run.run_type === 2;
    const runName = clean(run.run_name);
    const part = /\s-{1,2}\s(.+)$/.exec(runName);
    const label = qualifying ? 'Qualifying' : runName.replace(/^NCS\s+/i, '');
    const title = qualifying ? (part ? part[1] : 'Qualifying') : label;
    const who = (r: Record<string, unknown>): string[] => [String(num(r.finishing_position)), name(r.driver_name), teams.get(carOf(r.car_number)) ?? ''];
    const rows = qualifying
      ? results.map(r => [...who(r), seconds(num(r.best_lap_time)), (num(r.best_lap_speed) ?? 0) > 0 ? (num(r.best_lap_speed) as number).toFixed(3) : ''])
      : results.map((r, j) => {
          const delta = Math.abs(num(r.delta_leader) ?? 0);
          return [...who(r), seconds(num(r.best_lap_time)), j > 0 && delta > 0 ? `+${seconds(delta)}` : '', num(r.laps_completed) === null ? '' : String(num(r.laps_completed))];
        });
    placed.push({ label, table: { title, columns: qualifying ? RUN_COLUMNS : TIMED_COLUMNS, rows }, race: false, day: clean(run.run_date_utc) || null, order: i });
  });
  const day = /^\d{4}-\d{2}-\d{2}/.test(clean(race.race_date)) ? clean(race.race_date).slice(0, 10) : null;
  return { race: tables.length ? { label, tables } : null, others: sessionsOf(placed).others, day };
}

// ── Formula E: fiaformulae.com's result pages ────────────────────────────────

/** Formula E's season number on its site: season 12 is the 2025-26 championship, our 2026. */
export const feSeason = (season: number): number => season - 2014;

/** The season's rounds as the results page links them ("12-shanghai"), keyed by their number. */
export function feRounds(html: string, feSeasonNumber: number): Map<number, string> {
  const $ = cheerio.load(html);
  const out = new Map<number, string>();
  $('a[href*="results-and-standings"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const q = new URLSearchParams(href.split('?')[1] ?? '');
    const slug = q.get('round');
    if (q.get('season') !== String(feSeasonNumber) || !slug || q.get('session')) return;
    const n = /^(\d+)-/.exec(slug);
    if (n && !out.has(Number(n[1]))) out.set(Number(n[1]), slug);
  });
  return out;
}

export type FeKind = 'race' | 'qualifying' | 'practice';

/** A round's sessions as its page links them, in running order (the page lists the latest first): "free-practice-1" as
 *  Practice 1, "qualifying" as Qualifying, "race" as Race. */
export function feSessions(html: string, slug: string): { key: string; label: string; kind: FeKind }[] {
  const $ = cheerio.load(html);
  const keys: string[] = [];
  $('a[href*="results-and-standings"]').each((_, a) => {
    const q = new URLSearchParams(($(a).attr('href') ?? '').split('?')[1] ?? '');
    const key = q.get('session');
    if (q.get('round') === slug && key && !keys.includes(key)) keys.push(key);
  });
  return keys.reverse().flatMap((key): { key: string; label: string; kind: FeKind }[] => {
    const fp = /^free-practice-(\d+)$/.exec(key);
    if (fp) return [{ key, label: `Practice ${fp[1]}`, kind: 'practice' }];
    if (key === 'qualifying') return [{ key, label: 'Qualifying', kind: 'qualifying' }];
    if (key === 'race') return [{ key, label: 'Race', kind: 'race' }];
    return [];
  });
}

/**
 * One session's table from its result page, read by its headings (Pos, Driver, Team, Grid, Time, Gap, Pts: the page
 * repeats Time and Pts for its narrow layout, the first is read). A race's lapped car "+1 lap" where the page writes
 * "1 Lap"; a car the page lists unplaced keeps its "—". The driver is the link to his page; the team as teamSpeller
 * spells Formula E's capitals. Null when the page holds no such table.
 */
export function feTable(html: string, kind: FeKind, title: string, spell: Spell, team: (name: string) => string): Table | null {
  const $ = cheerio.load(html);
  const table = $('table').first();
  if (!table.length) return null;
  const heads = table
    .find('thead th')
    .map((_, th) => clean($(th).text()).toLowerCase())
    .get();
  const at = (word: string): number => heads.findIndex(h => h.startsWith(word));
  const [pos, driver, club, grid, time, gap, pts] = ['pos', 'driver', 'team', 'grid', 'time', 'gap', 'pts'].map(at);
  if (pos < 0 || driver < 0 || time < 0) return null;
  const rows: string[][] = [];
  table.find('tbody tr').each((_, tr) => {
    const cells = $(tr).children('td, th');
    if (cells.length < heads.length) return;
    const cell = (i: number): string => (i < 0 ? '' : clean(cells.eq(i).text()));
    const place = /^\d+/.exec(cell(pos))?.[0] ?? (/^[—–-]/.test(cell(pos)) ? '—' : '');
    const named = clean(cells.eq(driver).find('a[href*="/drivers/"]').first().text());
    if (!place || !named) return;
    const head = [place, spell(named) ?? named, team(cell(club))];
    if (kind === 'race') {
      const lapped = /^(\d+)\s+laps?$/i.exec(cell(time));
      rows.push([...head, cell(grid), lapped ? lapsDown(Number(lapped[1])) : cell(time), cell(pts)]);
    } else if (kind === 'practice') {
      rows.push([...head, cell(time), /^\+/.test(cell(gap)) ? cell(gap) : '']);
    } else rows.push([...head, cell(time)]);
  });
  if (rows.length === 0) return null;
  return { title, columns: kind === 'race' ? FE_RACE_COLUMNS : kind === 'practice' ? FE_PRACTICE_COLUMNS : FE_QUALIFYING_COLUMNS, rows };
}

// ── What a run fetches, and what it keeps ────────────────────────────────────

/** Whether a stored round is in this shape: its race read with the grid (Wikipedia's rounds, stored before, have none). */
export function inShape(r: ResultRound | undefined): boolean {
  const race = r?.sessions.at(-1)?.tables[0];
  return race !== undefined && race.columns.includes('Grid');
}

const dayAfter = (iso: string, days: number): string => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** The rounds a run asks for, the newest first, at most `max`: each started round while it runs and for `settleDays`
 *  after (a penalty, a disqualification), and any not yet stored in this shape. */
export function roundsDue(rounds: readonly Pick<SeriesRoundEntry, 'round' | 'startDate' | 'endDate'>[], stored: readonly ResultRound[] | null, now: Date, max: number, settleDays = 7): number[] {
  const today = now.toISOString().slice(0, 10);
  return rounds
    .filter(r => r.startDate <= today && (dayAfter(r.endDate, settleDays) >= today || !inShape(keptFor(stored, r))))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, Math.max(0, max))
    .map(r => r.round);
}

/** A round's stored result: its number, dated within a week of its dates. A season is told by its rounds' dates, not
 *  the year: Formula E's 2026 season opened in São Paulo on 6 December 2025. */
const keptFor = (stored: readonly ResultRound[] | null, e: Pick<SeriesRoundEntry, 'round' | 'startDate' | 'endDate'>): ResultRound | undefined =>
  (stored ?? []).find(r => r.round === e.round && r.date !== null && nearRound(r.date, e, 7, 7));

/** The season's stored rounds with the fresh ones in their place, by date then round: a round is replaced whole, as only
 *  a whole fetch is kept. A stored round no round of the season's rounds.json dates (last season's) is dropped. */
export function mergeRounds(fresh: readonly ResultRound[], stored: readonly ResultRound[] | null, rounds: readonly Pick<SeriesRoundEntry, 'round' | 'startDate' | 'endDate'>[]): ResultRound[] {
  const out = new Map(rounds.flatMap(e => keptFor(stored, e) ?? []).map(r => [r.round as number, r]));
  for (const f of fresh) if (f.round !== null) out.set(f.round, f);
  return [...out.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.round ?? 0) - (b.round ?? 0));
}
