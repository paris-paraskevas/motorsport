// The WordPress publisher's pages (slot O10): the fetchers' payloads normalised
// into plain tables, and those tables written as WordPress block markup.
//
// Pure: no network, no env, no file reads, so the JSON stored on the
// `paddock-data` branch renders the same pages anywhere (`--from-ref`). Every
// string that came from a feed passes escapeHtml before it reaches the markup;
// every href is built here from a series slug, never taken from a feed.

import { createHash } from 'node:crypto';
import type { Series, SeriesRoundEntry } from '@/lib/types';
import { groupByWeekend } from '@/lib/group';

// ── Stored shapes: what `<slug>/{standings,results,calendar}.json` hold ─────

/** One table as stored and as rendered: every cell already a string. */
export interface Table {
  title: string;
  columns: string[];
  rows: string[][];
}

/** One race of a round (a sprint, a feature race, a class's race): one table, or one per class. */
export interface ResultSession {
  label: string;
  tables: Table[];
}

export interface ResultRound {
  round: number | null;
  name: string;
  /** YYYY-MM-DD, or null when neither the feed nor rounds.json gives one. */
  date: string | null;
  sessions: ResultSession[];
  /** The round's sessions that are not races, as classified (slot O15): Formula 1's qualifying from jolpi.ca, its
   *  practices and sprint qualifying from OpenF1, in running order. Apart from `sessions`, whose last is the round's
   *  main race (latestRace) and whose count the health check compares. */
  others?: ResultSession[];
}

export interface CalendarEntry {
  /** ISO instants, UTC. */
  start: string;
  end: string;
  /** No real hour is known: shown as "time TBC", never as a clock time. */
  dateOnly: boolean;
  event: string;
  session: string;
  round: number | null;
  /** Where the feed says the session runs, when it says; the calendar's venue resolves from it. */
  location?: string;
}

/** Rows a plain results table shows, and a series page's standings excerpt. */
const TOP = 10;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const present = <T>(v: T | null): v is T => v !== null;

// ── Standings ────────────────────────────────────────────────────────────────

const TABLE_KEYS = ['drivers', 'coDrivers', 'teams', 'constructors', 'manufacturers'] as const;
type TableKey = (typeof TABLE_KEYS)[number];

const TABLE_LABEL: Record<TableKey, string> = {
  drivers: 'Drivers',
  coDrivers: 'Co-drivers',
  teams: 'Teams',
  constructors: 'Constructors',
  manufacturers: 'Manufacturers',
};

/** Where a payload key names a championship differently from the series itself
 *  (lib/standings/*: F2, F3 and Formula E return their teams as `constructors`,
 *  DTM, NASCAR and WorldSBK their manufacturers). */
const SERIES_LABEL: Record<string, Partial<Record<TableKey, string>>> = {
  f2: { constructors: 'Teams' },
  f3: { constructors: 'Teams' },
  'formula-e': { constructors: 'Teams' },
  dtm: { constructors: 'Manufacturers' },
  'nascar-cup': { constructors: 'Manufacturers' },
  motogp: { drivers: 'Riders' },
  wsbk: { drivers: 'Riders', constructors: 'Manufacturers' },
};

const SINGULAR: Record<string, string> = {
  Drivers: 'Driver',
  Riders: 'Rider',
  'Co-drivers': 'Co-driver',
  Teams: 'Team',
  Constructors: 'Constructor',
  Manufacturers: 'Manufacturer',
};

/** GT World's three championships (lib/standings/gt-world.ts GtWorldStandings). */
const GT_SECTIONS = [
  ['overall', 'Overall'],
  ['sprint', 'Sprint Cup'],
  ['endurance', 'Endurance Cup'],
] as const;

interface StandingLine {
  pos: number;
  name: string;
  extra: string;
  points: string;
}

function standingLine(r: Obj, person: boolean): StandingLine | null {
  const pos = num(r.position);
  const name = person ? str(r.driverName ?? r.coDriverName ?? r.name) : str(r.name ?? r.team ?? r.manufacturer);
  if (pos === null || name === '') return null;
  // A person's team; a team row's car (IMSA's team tables carry one).
  return { pos, name, extra: person ? str(r.team) : str(r.car), points: str(r.points) };
}

function standingsTable(title: string, label: string, rows: unknown[], person: boolean): Table | null {
  const lines = rows
    .filter(isObj)
    .map(r => standingLine(r, person))
    .filter(present)
    .sort((a, b) => a.pos - b.pos);
  if (lines.length === 0) return null;
  const withExtra = lines.some(l => l.extra !== '');
  return {
    title,
    columns: ['Pos', SINGULAR[label] ?? label, ...(withExtra ? [person ? 'Team' : 'Car'] : []), 'Pts'],
    rows: lines.map(l => [String(l.pos), l.name, ...(withExtra ? [l.extra] : []), l.points]),
  };
}

function tablesOf(slug: string, o: Obj, prefix: string | null): Table[] {
  const out: Table[] = [];
  for (const key of TABLE_KEYS) {
    const label = SERIES_LABEL[slug]?.[key] ?? TABLE_LABEL[key];
    const person = key === 'drivers' || key === 'coDrivers';
    const v = o[key];
    if (Array.isArray(v)) {
      const t = standingsTable(prefix ? `${prefix} · ${label}` : label, label, v, person);
      if (t) out.push(t);
    } else if (isObj(v)) {
      // IMSA and WEC: one table per class, in the payload's class order.
      for (const [cls, rows] of Object.entries(v)) {
        if (!Array.isArray(rows)) continue;
        const t = standingsTable(`${cls} · ${label}`, label, rows, person);
        if (t) out.push(t);
      }
    }
  }
  return out;
}

/** Every standings table a fetcher's payload holds, drivers first; [] when none is usable. */
export function standingsTables(slug: string, payload: unknown): Table[] {
  if (!isObj(payload)) return [];
  if (GT_SECTIONS.some(([k]) => isObj(payload[k]))) {
    return GT_SECTIONS.flatMap(([k, name]) => {
      const section = payload[k];
      return isObj(section) ? tablesOf(slug, section, name) : [];
    });
  }
  return tablesOf(slug, payload, null);
}

// ── Results ──────────────────────────────────────────────────────────────────

/** The event a race belongs to and the race's own label, from the feeds' naming:
 *  "<event> — <label>" (MotoGP, WorldSBK, DTM) or "<country> Feature|Sprint Race"
 *  (F2, F3: lib/results/fom-api.ts:222), numbered when a race was carried over
 *  ("Azerbaijan Feature Race 2", lib/results/fom-api.test.ts:343). Anything else is the event itself. */
export function splitRaceName(raceName: string, fallback: string): { event: string; label: string } {
  const at = raceName.lastIndexOf(' — ');
  if (at > 0) return { event: raceName.slice(0, at).trim(), label: raceName.slice(at + 3).trim() };
  const fom = /^(.*?)\s+(Feature|Sprint) Race(?:\s+(\d+))?$/.exec(raceName);
  if (fom) return { event: fom[1].trim(), label: fom[3] ? `${fom[2]} ${fom[3]}` : fom[2] };
  return { event: raceName.trim(), label: fallback };
}

/** Running order inside a round, from the labels the feeds use. */
function sessionRank(label: string): number {
  if (/^(sprint|race 1)\b/i.test(label)) return 1;
  if (/^(race 2|feature|grand prix)\b/i.test(label)) return 3;
  return 2;
}

/** A single-class race's classified finishers, every one (the pages cut to ten when they draw). Position 0
 *  (IndyCar's non-finishers) and 90+ (DTM's synthetic DNF slots) are not classified places. A lapped car reads
 *  Lapped: jolpi.ca gives it a time behind the winner over a lap fewer ("+2.171" for Singapore 2026's eleventh,
 *  a lap down), which reads as a gap it never had. */
function raceTable(title: string, entries: unknown, person: string): Table | null {
  if (!Array.isArray(entries)) return null;
  const lines = entries
    .filter(isObj)
    .map(e => ({ pos: num(e.position), name: str(e.driverName), team: str(e.team), time: /^lapped$/i.test(str(e.status)) ? 'Lapped' : str(e.time) || str(e.status), points: num(e.points) }))
    .filter((l): l is typeof l & { pos: number } => l.pos !== null && l.pos >= 1 && l.pos < 90 && l.name !== '')
    .sort((a, b) => a.pos - b.pos);
  if (lines.length === 0) return null;
  const withTeam = lines.some(l => l.team !== '');
  const withTime = lines.some(l => l.time !== '');
  const withPts = lines.some(l => (l.points ?? 0) > 0);
  return {
    title,
    columns: ['Pos', person, ...(withTeam ? ['Team'] : []), ...(withTime ? ['Time'] : []), ...(withPts ? ['Pts'] : [])],
    rows: lines.map(l => [
      String(l.pos),
      l.name,
      ...(withTeam ? [l.team] : []),
      ...(withTime ? [l.time] : []),
      ...(withPts ? [l.points === null ? '' : String(l.points)] : []),
    ]),
  };
}

/** One class's classified finishers (IMSA, WEC: lib/results/imsa.ts ImsaRaceEntry, wec.ts WecRaceEntry). */
function classTable(title: string, entries: unknown): Table | null {
  if (!Array.isArray(entries)) return null;
  const lines = entries
    .filter(isObj)
    .map(e => ({ pos: num(e.position), car: str(e.carNumber), drivers: str(e.drivers), team: str(e.team), gap: str(e.gap) || str(e.status) }))
    .filter((l): l is typeof l & { pos: number } => l.pos !== null && l.pos >= 1)
    .sort((a, b) => a.pos - b.pos);
  if (lines.length === 0) return null;
  return {
    title,
    columns: ['Pos', '#', 'Drivers', 'Team', 'Gap'],
    rows: lines.map(l => [String(l.pos), l.car, l.drivers, l.team, l.gap]),
  };
}

/** A GT World race's classified finishers overall, every cup in one classification (lib/results/gt-world.ts). */
function gtTable(title: string, entries: unknown): Table | null {
  if (!Array.isArray(entries)) return null;
  const lines = entries
    .filter(isObj)
    .map(e => ({
      pos: num(e.position),
      car: str(e.carNumber),
      drivers: Array.isArray(e.drivers) ? e.drivers.map(str).filter(Boolean).join(', ') : str(e.drivers),
      team: str(e.team),
      cup: str(e.cupLabel),
    }))
    .filter((l): l is typeof l & { pos: number } => l.pos !== null && l.pos >= 1)
    .sort((a, b) => a.pos - b.pos);
  if (lines.length === 0) return null;
  return {
    title,
    columns: ['Pos', '#', 'Drivers', 'Team', 'Cup'],
    rows: lines.map(l => [String(l.pos), l.car, l.drivers, l.team, l.cup]),
  };
}

/** A qualifying's classification by its parts, the parts nobody ran left out: jolpi.ca's QualifyingResults as the
 *  publisher maps them ({ position, driverName, team, q1, q2, q3 }), or OpenF1's sprint qualifying, whose parts
 *  are SQ1 to SQ3. */
function qualifyingTable(title: string, entries: unknown, part = 'Q'): Table | null {
  if (!Array.isArray(entries)) return null;
  const lines = entries
    .filter(isObj)
    .map(e => ({ pos: num(e.position), name: str(e.driverName), team: str(e.team), times: [str(e.q1), str(e.q2), str(e.q3)] }))
    .filter((l): l is typeof l & { pos: number } => l.pos !== null && l.pos >= 1 && l.name !== '')
    .sort((a, b) => a.pos - b.pos);
  if (lines.length === 0) return null;
  const parts = [0, 1, 2].filter(i => lines.some(l => l.times[i] !== ''));
  return {
    title,
    columns: ['Pos', 'Driver', 'Team', ...parts.map(i => `${part}${i + 1}`)],
    rows: lines.map(l => [String(l.pos), l.name, l.team, ...parts.map(i => l.times[i])]),
  };
}

/** A practice's classification by best lap (OpenF1's SessionClassificationEntry: time, gap, laps). */
function practiceTable(title: string, entries: unknown): Table | null {
  if (!Array.isArray(entries)) return null;
  const lines = entries
    .filter(isObj)
    .map(e => ({ pos: num(e.position), name: str(e.driverName), team: str(e.team), time: str(e.time), gap: str(e.gap), laps: str(e.laps) }))
    .filter((l): l is typeof l & { pos: number } => l.pos !== null && l.pos >= 1 && l.name !== '')
    .sort((a, b) => a.pos - b.pos);
  if (lines.length === 0) return null;
  return {
    title,
    columns: ['Pos', 'Driver', 'Team', 'Time', 'Gap', 'Laps'],
    rows: lines.map(l => [String(l.pos), l.name, l.team, l.time, l.gap, l.laps]),
  };
}

/** OpenF1 writes the surname in capitals ("Max VERSTAPPEN"); lib/openf1/drivers.ts tidies it the same way. */
const tidyName = (name: string): string =>
  name
    .split(/\s+/)
    .map(w => (/^\p{Lu}{2,}$/u.test(w) ? w[0] + w.slice(1).toLowerCase() : w))
    .join(' ');

/** An OpenF1 classification of one of the sessions OPENF1_SESSIONS names, as the session the round stores: each driver
 *  named as the roster (drivers.json, by car number) names them, so a practice reads as the race does, else OpenF1's name
 *  tidied. Nothing when a driver is still only a number ("#38", a throttled /drivers answer): the session is stored once
 *  and never fetched again, so it waits for a run that can name everyone. */
export function openf1Session(label: string, entries: unknown, roster: ReadonlyMap<string, { name: string; team: string }> = new Map()): ResultSession | null {
  if (!Array.isArray(entries)) return null;
  const named = entries.filter(isObj).map(e => {
    const known = roster.get(str(e.carNumber));
    return { ...e, driverName: known?.name ?? tidyName(str(e.driverName)), team: known?.team ?? str(e.team) };
  });
  if (named.some(e => /^#\d+$/.test(e.driverName))) return null;
  const t = /qualifying/i.test(label) ? qualifyingTable(label, named, 'SQ') : practiceTable(label, named);
  return t ? { label, tables: [t] } : null;
}

/** Running order of a round's other sessions: the practices, then sprint qualifying, then qualifying. */
function otherRank(label: string): number {
  const practice = /^practice (\d)$/i.exec(label);
  if (practice) return Number(practice[1]);
  return /^sprint qualifying$/i.test(label) ? 4 : /^qualifying$/i.test(label) ? 5 : 6;
}

const byRunningOrder = (sessions: ResultSession[]): ResultSession[] =>
  sessions
    .map((s, i) => ({ s, i }))
    .sort((a, b) => otherRank(a.s.label) - otherRank(b.s.label) || a.i - b.i)
    .map(x => x.s);

function dayOf(v: unknown): string | null {
  const t = v instanceof Date ? v.getTime() : typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

/** IndyCar's feed numbers its columns, which drift from the championship rounds,
 *  so its races are keyed by date as the site does (lib/results/session-classification.ts:103);
 *  a race in no round's window stays unnumbered here, where the site leaves it out. */
function roundByDate(rounds: readonly SeriesRoundEntry[], day: string): number | null {
  for (const r of rounds) if (day >= r.startDate && day <= r.endDate) return r.round;
  return null;
}

/** Oldest first, as one total order: by date (a moved round sits where its date puts it; an undated
 *  one counts as oldest, so the results page, newest first, prints it last), then number, then name. */
function compareRounds(a: ResultRound, b: ResultRound): number {
  const ad = a.date ?? '';
  const bd = b.date ?? '';
  if (ad !== bd) return ad < bd ? -1 : 1;
  const ar = a.round ?? Number.MAX_SAFE_INTEGER;
  const br = b.round ?? Number.MAX_SAFE_INTEGER;
  if (ar !== br) return ar - br;
  return a.name.localeCompare(b.name);
}

/** A season's results as rounds, oldest first, each race's classified finishers. The payload
 *  is whatever the series' fetcher returns: RaceResult[]; F2's { feature, sprint }; F1's
 *  { races, sprints, qualifying } (the Grand Prix list, the sprint list and jolpi.ca's
 *  qualifying, which goes to the round's `others`); IMSA's and WEC's per-class rounds;
 *  GT World's races. [] when nothing is usable. */
export function resultRounds(slug: string, payload: unknown, rounds: readonly SeriesRoundEntry[] = []): ResultRound[] {
  const byKey = new Map<string, ResultRound>();
  const roundOf = (round: number | null, name: string): ResultRound => {
    const key = round !== null ? `r${round}` : `e${name}`;
    let r = byKey.get(key);
    if (!r) {
      r = { round, name, date: null, sessions: [] };
      byKey.set(key, r);
    }
    return r;
  };
  const add = (round: number | null, name: string, date: string | null, session: ResultSession) => {
    const r = roundOf(round, name);
    // The round's date is its last race's: a sprint weekend is dated by its Sunday.
    if (date !== null && (r.date === null || date > r.date)) r.date = date;
    r.sessions.push(session);
  };
  const person = slug === 'motogp' || slug === 'wsbk' ? 'Rider' : 'Driver';
  const flat = (races: unknown, fallback: string) => {
    if (!Array.isArray(races)) return;
    for (const race of races.filter(isObj)) {
      const { event, label } = splitRaceName(str(race.raceName), fallback);
      const date = dayOf(race.date);
      let round = num(race.round);
      // With a schedule, an IndyCar race is keyed by its date alone; one in no round's window stays
      // unnumbered instead of joining whichever round holds its column number.
      if (slug === 'indycar' && rounds.length > 0) round = date === null ? null : roundByDate(rounds, date);
      const t = raceTable(label, race.results, person);
      if (t) add(round, event, date, { label, tables: [t] });
    }
  };

  if (isObj(payload) && ('feature' in payload || 'sprint' in payload)) {
    flat(payload.sprint, 'Sprint');
    flat(payload.feature, 'Feature');
  } else if (isObj(payload) && 'races' in payload) {
    flat(payload.sprints, 'Sprint');
    flat(payload.races, 'Race');
    // Qualifying dates nothing: a round with no race yet takes its dates from rounds.json below.
    for (const q of Array.isArray(payload.qualifying) ? payload.qualifying.filter(isObj) : []) {
      const round = num(q.round);
      const t = round === null ? null : qualifyingTable('Qualifying', q.results);
      if (t) (roundOf(round, str(q.raceName)).others ??= []).push({ label: 'Qualifying', tables: [t] });
    }
  } else if (Array.isArray(payload)) {
    const items = payload.filter(isObj);
    if (items.some(i => isObj(i.perClass))) {
      for (const i of items) {
        const perClass = isObj(i.perClass) ? i.perClass : {};
        const tables = Object.entries(perClass).map(([cls, e]) => classTable(cls, e)).filter(present);
        if (tables.length) add(num(i.round), str(i.eventName), dayOf(i.date ?? i.dateEnd), { label: 'Race', tables });
      }
    } else if (items.some(i => Array.isArray(i.entries))) {
      for (const i of items) {
        const label = str(i.raceName) || 'Race';
        const t = gtTable(label, i.entries);
        if (t) add(num(i.round), str(i.eventName) || label, null, { label, tables: [t] });
      }
    } else {
      flat(items, slug === 'wrc' ? 'Rally' : 'Race');
    }
  }

  const out = [...byKey.values()];
  for (const r of out) {
    if (r.date === null && r.round !== null) r.date = rounds.find(x => x.round === r.round)?.endDate ?? null;
    r.sessions = r.sessions
      .map((s, i) => ({ s, i }))
      .sort((a, b) => sessionRank(a.s.label) - sessionRank(b.s.label) || a.i - b.i)
      .map(x => x.s);
    if (r.others) r.others = byRunningOrder(r.others);
  }
  return out.sort(compareRounds);
}

/** The Formula 1 sessions OpenF1 classifies for the results page (slot O15). */
export const OPENF1_SESSIONS = /^(practice [123]|sprint qualifying)$/i;

/** Formula 1's fresh rounds with what a run does not fetch again (slot O15): every stored session of a round's
 *  `others` that the fresh round lacks (OpenF1's practices and sprint qualifying, fetched once each, and jolpi.ca's
 *  qualifying on a day it does not answer), a stored round with no race yet kept for them. Only the season's own: at
 *  a new season the stored rounds are last year's, whose numbers the new rounds reuse. */
export function carrySessions(fresh: ResultRound[], stored: ResultRound[] | null, season: number): ResultRound[] {
  const out = fresh.map(r => ({ ...r, ...(r.others ? { others: [...r.others] } : {}) }));
  for (const s of stored ?? []) {
    if (s.round === null || !s.others?.length || s.date?.slice(0, 4) !== String(season)) continue;
    let r = out.find(x => x.round === s.round);
    if (!r) {
      r = { round: s.round, name: s.name, date: s.date, sessions: [] };
      out.push(r);
    }
    const have = new Set((r.others ?? []).map(o => o.label));
    const kept = s.others.filter(o => !have.has(o.label));
    if (kept.length) r.others = byRunningOrder([...(r.others ?? []), ...kept]);
  }
  return out.sort(compareRounds);
}

/** The sessions of OPENF1_SESSIONS a run fetches: over an hour ago, not yet held by their round, the newest first,
 *  at most `max`. */
export function openf1Wanted(rounds: ResultRound[], calendar: CalendarEntry[], now: Date, max: number): CalendarEntry[] {
  const held = new Set(rounds.flatMap(r => (r.others ?? []).map(o => `${r.round}|${o.label.toLowerCase()}`)));
  return calendar
    .filter(e => e.round !== null && !e.dateOnly && OPENF1_SESSIONS.test(e.session) && Date.parse(e.end) + 3_600_000 <= now.getTime())
    .filter(e => !held.has(`${e.round}|${e.session.toLowerCase()}`))
    .sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
    .slice(0, Math.max(0, max));
}

/** A fetched classification into its round, in running order; a round the season has not raced yet is made for it. */
export function withSession(rounds: ResultRound[], round: number, name: string, date: string | null, session: ResultSession): ResultRound[] {
  const out = rounds.map(r => (r.round === round ? { ...r, others: byRunningOrder([...(r.others ?? []).filter(o => o.label !== session.label), session]) } : r));
  if (!out.some(r => r.round === round)) out.push({ round, name, date, sessions: [], others: [session] });
  return out.sort(compareRounds);
}

// ── Calendar ─────────────────────────────────────────────────────────────────

/** "F1 - Practice 1" → "Practice 1": the feeds prefix the series. A separator
 *  needs a space after it, so "Pre-season test" stays whole. */
function sessionName(title: string): string {
  const m = /^(.+?)\s*[-–—:]\s+(.+)$/.exec(title.trim());
  return (m ? m[2] : title).trim();
}

/** The season's sessions with their event and round (rounds.json through the
 *  site's own weekend grouping, lib/group.ts), sorted by start. */
export function calendarEntries(series: Pick<Series, 'sessions' | 'rounds'>, now: Date): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  for (const w of groupByWeekend(series.sessions, now, series.rounds)) {
    const place = w.sessions.find(s => s.location)?.location?.split(',')[0].trim();
    const event = w.roundName || w.label || place || (w.round > 0 ? `Round ${w.round}` : 'Event');
    for (const s of w.sessions) {
      const start = s.start.getTime();
      if (!Number.isFinite(start)) continue;
      const end = Number.isFinite(s.end?.getTime()) ? s.end.getTime() : start;
      const location = s.location?.trim();
      out.push({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        dateOnly: s.dateOnly === true,
        event,
        session: sessionName(s.title),
        round: w.round > 0 ? w.round : null,
        ...(location ? { location } : {}),
      });
    }
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

// ── Markup ───────────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** A cell or a run of paragraph text: plain text, or a link built from our own paths. */
export type Cell = string | { text: string; href: string };

const cellHtml = (c: Cell): string =>
  typeof c === 'string' ? escapeHtml(c) : `<a href="${escapeHtml(c.href)}">${escapeHtml(c.text)}</a>`;

export function heading(text: string, level: 2 | 3 | 4 = 2): string {
  const attrs = level === 2 ? '' : ` {"level":${level}}`;
  return `<!-- wp:heading${attrs} -->\n<h${level} class="wp-block-heading">${escapeHtml(text)}</h${level}>\n<!-- /wp:heading -->`;
}

export function paragraph(...parts: Cell[]): string {
  return `<!-- wp:paragraph -->\n<p>${parts.map(cellHtml).join('')}</p>\n<!-- /wp:paragraph -->`;
}

export function tableBlock(columns: string[], rows: Cell[][]): string {
  const head = `<thead><tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${cellHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<!-- wp:table {"hasFixedLayout":false} -->\n<figure class="wp-block-table"><table>${head}${body}</table></figure>\n<!-- /wp:table -->`;
}

const AT_UTC = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const AT_ATHENS = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Athens', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DAY_UTC = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const DATE_UTC = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

/** "Sun 25 Oct, 14:00" in UTC, and in Athens ("Sun 25 Oct, 16:00"); a date-only session reads "time TBC". */
export function whenCells(e: Pick<CalendarEntry, 'start' | 'dateOnly'>): [string, string] {
  const d = new Date(e.start);
  if (e.dateOnly) return [`${DAY_UTC.format(d)}, time TBC`, ''];
  return [AT_UTC.format(d), AT_ATHENS.format(d)];
}

/** "25 Oct 2026" for a stored YYYY-MM-DD. */
export function formatDay(day: string): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(t) ? DATE_UTC.format(new Date(t)) : day;
}

// ── Pages ────────────────────────────────────────────────────────────────────

/** A page as the publisher writes it; `path` is its address on the site, "/series/f1/standings/". */
export interface Page {
  path: string;
  title: string;
  body: string;
  /** The theme template WordPress renders the page with ("page-wide"); none: the theme's default. */
  template?: string;
}

export interface SeriesData {
  slug: string;
  name: string;
  /** The chips' label and place (content/series/<slug>/meta.json shortName, order). */
  short?: string;
  order?: number;
  /** The season's rounds with their dates and host, for the calendar's bands and cards. */
  rounds?: CalendarRound[];
  /** null: no data, so no page. */
  standings: Table[] | null;
  results: ResultRound[] | null;
  calendar: CalendarEntry[] | null;
  /** The season (meta.json), every series; for round 2's series pages (lib/wp/series.ts), the overview text without
   *  its front matter (overview.md), the teams with their colours and drivers (drivers.json), and the rounds that will
   *  not run (rounds.json cancelledRounds). */
  season?: number;
  about?: string;
  teams?: SeriesTeam[];
  cancelled?: { round: number; name: string; place?: string }[];
  /** For the series list (slot O21), every series: its type (meta.json category), its colour, and the champion of
   *  its season as champions.json writes it, when it does. */
  category?: string;
  colour?: string;
  champion?: string;
}

export interface SeriesTeam {
  name: string;
  colour?: string;
  drivers: { name: string; code?: string }[];
}

export const seriesPath = (slug: string, sub?: 'standings' | 'results' | 'calendar' | 'champions'): string =>
  `/series/${slug}/${sub ? `${sub}/` : ''}`;

/** Sessions not yet over (a live one counts), up to `withinMs` ahead. */
export function upcoming(entries: CalendarEntry[], now: Date, withinMs = Infinity): CalendarEntry[] {
  const t = now.getTime();
  return entries.filter(e => Date.parse(e.end) >= t && Date.parse(e.start) <= t + withinMs);
}

const roundTitle = (r: ResultRound): string => (r.round !== null ? `Round ${r.round} · ${r.name}` : r.name);

/** The latest round's main race (the last in running order): the series page's "latest result". */
export function latestRace(rounds: ResultRound[]): { round: ResultRound; session: ResultSession } | null {
  const dated = rounds.filter(r => r.date !== null && r.sessions.length > 0);
  const pool = dated.length ? dated : rounds.filter(r => r.sessions.length > 0);
  if (pool.length === 0) return null;
  const round = dated.length ? pool.reduce((a, b) => ((b.date ?? '') >= (a.date ?? '') ? b : a)) : pool[pool.length - 1];
  return { round, session: round.sessions[round.sessions.length - 1] };
}

function seriesLanding(d: SeriesData, now: Date): Page {
  const parts: string[] = [];
  if (d.calendar) {
    const next = upcoming(d.calendar, now).slice(0, 5);
    parts.push(heading('Next sessions'));
    parts.push(
      next.length
        ? tableBlock(['Event', 'Session', 'UTC', 'Athens'], next.map(e => [e.event, e.session, ...whenCells(e)]))
        : paragraph('No sessions are scheduled.'),
    );
  }
  if (d.standings?.length) {
    const t = d.standings[0];
    parts.push(heading('Standings'), heading(t.title, 3), tableBlock(t.columns, t.rows.slice(0, TOP)));
    parts.push(paragraph({ text: 'Full standings', href: seriesPath(d.slug, 'standings') }));
  }
  const latest = d.results ? latestRace(d.results) : null;
  if (latest) {
    const t = latest.session.tables[0];
    const when = latest.round.date ? ` · ${formatDay(latest.round.date)}` : '';
    parts.push(heading('Latest result'), heading(`${roundTitle(latest.round)} · ${latest.session.label}${when}`, 3));
    if (latest.session.tables.length > 1) parts.push(heading(t.title, 4));
    parts.push(tableBlock(t.columns, t.rows.slice(0, 3)));
    parts.push(paragraph({ text: 'All results', href: seriesPath(d.slug, 'results') }));
  }
  if (d.calendar) parts.push(paragraph({ text: 'Full calendar', href: seriesPath(d.slug, 'calendar') }));
  return { path: seriesPath(d.slug), title: d.name, body: parts.join('\n\n') };
}

function standingsPage(d: SeriesData, tables: Table[]): Page {
  const parts = tables.flatMap(t => [heading(t.title), tableBlock(t.columns, t.rows)]);
  return { path: seriesPath(d.slug, 'standings'), title: `${d.name} standings`, body: parts.join('\n\n') };
}

function resultsPage(d: SeriesData, rounds: ResultRound[]): Page {
  const parts: string[] = [];
  for (const r of [...rounds].reverse()) {
    parts.push(heading(roundTitle(r)));
    if (r.date) parts.push(paragraph(formatDay(r.date)));
    for (const s of r.sessions) {
      if (r.sessions.length > 1) parts.push(heading(s.label, 3));
      for (const t of s.tables) {
        if (s.tables.length > 1) parts.push(heading(t.title, 4));
        parts.push(tableBlock(t.columns, t.rows.slice(0, TOP)));
      }
    }
  }
  return { path: seriesPath(d.slug, 'results'), title: `${d.name} results`, body: parts.join('\n\n') };
}

function seriesCalendarPage(d: SeriesData, entries: CalendarEntry[], now: Date): Page {
  const next = upcoming(entries, now);
  const body = next.length
    ? tableBlock(['Round', 'Event', 'Session', 'UTC', 'Athens'], next.map(e => [e.round === null ? '' : String(e.round), e.event, e.session, ...whenCells(e)]))
    : paragraph('No sessions are scheduled.');
  return { path: seriesPath(d.slug, 'calendar'), title: `${d.name} calendar`, body };
}

/** A series' landing page and each of its standings, results and calendar pages that has data. */
export function seriesPages(d: SeriesData, now: Date): Page[] {
  if (!d.standings?.length && !d.results?.length && !d.calendar) return [];
  const pages = [seriesLanding(d, now)];
  if (d.standings?.length) pages.push(standingsPage(d, d.standings));
  if (d.results?.length) pages.push(resultsPage(d, d.results));
  if (d.calendar) pages.push(seriesCalendarPage(d, d.calendar, now));
  return pages;
}

// ── The Calendar (slot O12): round 2's month grid and weekend cards ──────────
//
// One page a month, laid out in UTC: each session sits in its UTC day's cell and prints its UTC
// time. The theme's script (wp-theme/paddock/assets/js/paddock.js) moves every session to the
// reader's own day and time, marks today, greys what has run and adds the controls (the views
// and the Filters tab); without it the UTC page stands. Only classes and data-* attributes carry the
// layout, so the site's content filter keeps all of it, and nothing in the markup depends on the
// hour it was written, so a page changes only when its data does.

/** A round's own dates (rounds.json) and its host, for the calendar's bands and cards. */
export interface CalendarRound {
  round: number;
  name: string;
  /** YYYY-MM-DD, the event's local dates. */
  startDate: string;
  endDate: string;
  /** The host circuit's name (lib/circuits.ts), or null when none is known. */
  venue: string | null;
  /** The season grid's name for the round (rounds.json `place`). */
  place?: string;
  /** The circuits.json key of the outline the theme carries for the host (wp-theme/paddock/assets/circuits), if any. */
  outline?: string | null;
  /** The host's circuits.json key and IANA zone, whenever the venue matched one (O19: the weekend pages' map,
   *  forecast and track time); null for a rally or an unmatched venue. */
  circuit?: string | null;
  tz?: string;
}

/** How far the calendar reaches either side of the current month. */
const CALENDAR_MONTHS = 12;
const DAY_MS = 86_400_000;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const MONTH = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long' });
/** A month's short name on a phone's step; en-GB's own short September is "Sept". */
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CLOCK_UTC = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
/** 0 for Monday to 6 for Sunday. */
const weekdayOf = (day: string): number => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
const shiftMonth = (ym: string, n: number): string => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const lastDayOf = (ym: string): string => addDays(`${shiftMonth(ym, 1)}-01`, -1);
const monthLabel = (ym: string): string => MONTH_YEAR.format(new Date(`${ym}-01T00:00:00Z`));
export const calendarMonthPath = (ym: string): string => `/calendar/${ym}/`;

/** A band's short name: "Grand Prix" as "GP", NASCAR's race by its track ("YellaWood 500 (Talladega)" → "Talladega"), no trailing "Round". */
export function bandLabel(slug: string, name: string): string {
  const place = /\(([^)]+)\)\s*$/.exec(name);
  if (slug === 'nascar-cup' && place) return place[1].replace(/\s+oval$/i, '').trim();
  return name.replace(/ Grand Prix\b/, ' GP').replace(/\s+Round$/, '').trim();
}

/** "23–25 October", or "30 October – 1 November" across two months. */
function spanLabel(from: string, to: string): string {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTH.format(b)}`
    : `${a.getUTCDate()} ${MONTH.format(a)} – ${b.getUTCDate()} ${MONTH.format(b)}`;
}

interface Placed {
  d: SeriesData;
  e: CalendarEntry;
}

interface Held {
  d: SeriesData;
  r: CalendarRound;
}

const chipLabel = (d: SeriesData): string => d.short ?? d.name;
const bySeries = (a: SeriesData, b: SeriesData): number => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name);
const slugAttr = (d: SeriesData): string => escapeHtml(d.slug);
const clock = (iso: string): string => `<span class="pd-t" data-utc="${escapeHtml(iso)}" data-f="t">${CLOCK_UTC.format(new Date(iso))}</span>`;

/** The Sessions filter's three kinds. A sprint is a race; sprint qualifying, a shootout, Superpole and the Fast Six are
 *  qualifying; practice also takes the weekend's other appointments (scrutineering, a pit walk, a ceremonial start).
 *  Brackets name the event, not the session: NLS's "Race 4h (NLS4 ADAC 24h Qualifiers)" is a race. */
export function sessionKind(session: string): 'practice' | 'qualifying' | 'race' {
  const s = session.replace(/\([^)]*\)/g, ' ').trim();
  if (/practice|^fp\s?\d|\bwarm|\btest\b|shakedown|\bfree\b|training|scrutineer|administrative|pit walk|track walk|grid formation|open grid|ceremonial|pit stop challenge/i.test(s)) return 'practice';
  if (/qualif|^q\d\b|shootout|hyperpole|superpole(?!\s+race)|^pole|fast six/i.test(s)) return 'qualifying';
  return 'race';
}

/** One session in the grid; `data-kind` is its filter, and without the script only qualifying and races show. */
function gridSession({ d, e }: Placed): string {
  return (
    `<span class="pd-cs pd-s-${slugAttr(d)}" data-s="${slugAttr(d)}" data-kind="${sessionKind(e.session)}" data-utc="${escapeHtml(e.start)}" data-end="${escapeHtml(e.end)}">` +
    `<b>${escapeHtml(`${chipLabel(d)} ${e.session}`)}</b> ${clock(e.start)}</span>`
  );
}

const CLOCK_AT_UTC = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** A round's race in its month bar (the operator, 21 Oct: "race in each bar"): its last race in running order, a race
 *  named after its event (NASCAR's, GT World's) reading Race; a rally, which has no race, its Power Stage. The script
 *  shows the time in the reader's zone. */
function bandRace(d: SeriesData, r: CalendarRound): string {
  const races = (d.calendar ?? [])
    .filter(e => e.round === r.round && !e.dateOnly && sessionKind(e.session) === 'race')
    .sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
  const race = d.slug === 'wrc' ? races.find(e => /power stage/i.test(e.session)) : races.pop();
  if (!race) return '';
  // Formula E's "Race (London R17) — Season Finale" reads Race; so does a name split by an en dash, a colon or a spaced hyphen.
  const name = race.session.replace(/(?:\s*[(—–:]|\s+-\s).*$/, '');
  const label = d.slug === 'wrc' ? 'Power Stage' : /^(race\b|grand prix|feature|sprint)/i.test(name) ? name : 'Race';
  return ` · <span class="pd-cal-race">${escapeHtml(label)} <span class="pd-t" data-utc="${escapeHtml(race.start)}" data-f="wt">${CLOCK_AT_UTC.format(new Date(race.start))}</span></span>`;
}

/** One week of the grid: the days, the rounds as bands packed into the fewest rows, then each day's sessions. */
function gridWeek(week: string[], ym: string, held: Held[], byDay: Map<string, Placed[]>): string {
  const first = week[0];
  const last = week[6];
  const rows: Array<Array<[number, number]>> = [];
  const bands = held
    .filter(({ r }) => r.endDate >= first && r.startDate <= last)
    .map(h => ({ ...h, a: h.r.startDate < first ? 0 : weekdayOf(h.r.startDate), b: h.r.endDate > last ? 6 : weekdayOf(h.r.endDate) }))
    .sort((x, y) => x.a - y.a || y.b - y.a - (x.b - x.a) || bySeries(x.d, y.d))
    .map(band => {
      let row = rows.findIndex(cols => cols.every(([a, b]) => band.b < a || band.a > b));
      if (row < 0) row = rows.push([]) - 1;
      rows[row].push([band.a, band.b]);
      return { ...band, row };
    });
  // style.css draws pd-b1…pd-b12 and pd-r1…pd-r12 (2026's busiest week holds 8). Past twelve the theme's script
  // packs the week itself; without it the extra rounds share the twelfth row.
  const cap = (n: number): number => Math.min(n, 12);
  const days = week.map((day, i) => {
    const cls = `pd-c${i + 1}${day.slice(0, 7) === ym ? '' : ' pd-out'}${i >= 4 ? ' pd-fss' : ''}`;
    return `<span class="pd-cal-bg ${cls}" data-date="${day}"></span><span class="pd-cal-dn ${cls}" data-date="${day}">${Number(day.slice(8))}</span>`;
  });
  const strips = bands.map(
    ({ d, r, a, b, row }) =>
      `<span class="pd-cal-band pd-s-${slugAttr(d)} pd-c${a + 1} pd-w${b - a + 1} pd-r${cap(row + 1)}" data-s="${slugAttr(d)}" data-from="${escapeHtml(r.startDate)}" data-to="${escapeHtml(r.endDate)}">${escapeHtml(`${chipLabel(d)} · ${bandLabel(d.slug, r.name)}`)}${bandRace(d, r)}</span>`,
  );
  const sessions = week.map((day, i) => `<div class="pd-cal-ses pd-c${i + 1}" data-date="${day}">${(byDay.get(day) ?? []).map(gridSession).join('')}</div>`);
  return `<div class="pd-cal-wk pd-b${cap(rows.length)}">${days.join('')}${strips.join('')}${sessions.join('')}</div>`;
}

/** The month as round 2's grid, Monday first, with the days either side that finish its weeks. A session
 *  whose UTC day falls outside the grid waits in a hidden spill, for a reader whose own day brings it in. */
function monthGrid(ym: string, start: string, end: string, placed: Placed[], held: Held[]): string {
  const byDay = new Map<string, Placed[]>();
  const spill: Placed[] = [];
  for (const p of placed) {
    const day = p.e.start.slice(0, 10);
    if (day >= start && day <= end) byDay.set(day, [...(byDay.get(day) ?? []), p]);
    else spill.push(p);
  }
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  const weeks: string[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(gridWeek(days.slice(i, i + 7), ym, held, byDay));
  return (
    `<div class="pd-cal-grid"><div class="pd-cal-dow">${DOW.map(d => `<span>${d}</span>`).join('')}</div>${weeks.join('')}` +
    (spill.length ? `<div class="pd-cal-spill" hidden>${spill.map(gridSession).join('')}</div>` : '') +
    '</div>'
  );
}

/** One round as a card: its series band, then its sessions by UTC day (the script regroups them by the reader's day). */
function weekendCard({ d, r }: Held): string {
  const list = (d.calendar ?? []).filter(e => e.round === r.round && !e.dateOnly);
  const byDay = new Map<string, CalendarEntry[]>();
  for (const e of list) byDay.set(e.start.slice(0, 10), [...(byDay.get(e.start.slice(0, 10)) ?? []), e]);
  const host = [r.venue, d.slug === 'f1' && list.some(e => /^sprint$/i.test(e.session)) ? 'sprint weekend' : null].filter(Boolean).join(' · ');
  const days = [...byDay].map(
    ([day, es]) =>
      `<div class="pd-wc-day" data-date="${escapeHtml(day)}"><span class="pd-wc-dl">${DOW[weekdayOf(day)]}</span><div class="pd-wc-ss">` +
      es.map(e => `<span class="pd-wc-s" data-kind="${sessionKind(e.session)}" data-utc="${escapeHtml(e.start)}" data-end="${escapeHtml(e.end)}"><b>${escapeHtml(e.session)}</b>${clock(e.start)}</span>`).join('') +
      '</div></div>',
  );
  return (
    `<article class="pd-wc pd-s-${slugAttr(d)}" data-s="${slugAttr(d)}"><header class="pd-wc-band"><small>${escapeHtml(d.name)} · Round ${r.round}</small>` +
    `<b>${escapeHtml(r.name.replace(/\s*\([^)]*\)\s*$/, ''))}</b>${host ? `<span>${escapeHtml(host)}</span>` : ''}<i class="pd-wc-num" aria-hidden="true"><b class="pd-wc-series">${escapeHtml(chipLabel(d))}</b>${r.round}</i></header>` +
    (list.length ? `<div class="pd-wc-days">${days.join('')}</div>` : '<p class="pd-wc-none">Times not published yet.</p>') +
    `<footer class="pd-wc-foot"><span>${list.length} session${list.length === 1 ? '' : 's'} · <span data-pd-zonename>UTC</span></span></footer></article>`
  );
}

/** The month's race weekends, Friday to Sunday, each round a card: the agenda, which a phone opens. */
function agenda(first: string, last: string, held: Held[]): string {
  const weekends = new Map<string, Held[]>();
  for (const h of held) {
    const monday = addDays(h.r.endDate, -weekdayOf(h.r.endDate));
    if (addDays(monday, 6) < first || addDays(monday, 4) > last) continue;
    weekends.set(monday, [...(weekends.get(monday) ?? []), h]);
  }
  if (weekends.size === 0) return '<section class="pd-cal-agenda"><p class="pd-cal-none">No race weekends this month.</p></section>';
  const groups = [...weekends].sort(([a], [b]) => a.localeCompare(b)).map(([monday, hs]) => {
    const [fri, sun] = [addDays(monday, 4), addDays(monday, 6)];
    const cards = [...hs].sort((x, y) => x.r.startDate.localeCompare(y.r.startDate) || bySeries(x.d, y.d)).map(weekendCard);
    return `<div class="pd-cal-wkend" data-from="${fri}" data-to="${sun}"><h2 class="pd-cal-wkh"><span>${spanLabel(fri, sun)}</span><small>${hs.length} event${hs.length === 1 ? '' : 's'}</small></h2>${cards.join('')}</div>`;
  });
  return `<section class="pd-cal-agenda">${groups.join('')}</section>`;
}

function calendarMonth(ym: string, months: string[], all: SeriesData[], path: string, title: string): Page {
  const first = `${ym}-01`;
  const last = lastDayOf(ym);
  const start = addDays(first, -weekdayOf(first));
  const end = addDays(last, 6 - weekdayOf(last));
  const ordered = [...all].sort(bySeries);
  const placed = ordered
    .flatMap(d => (d.calendar ?? []).filter(e => !e.dateOnly).map(e => ({ d, e })))
    .filter(({ e }) => e.start.slice(0, 10) >= addDays(start, -1) && e.start.slice(0, 10) <= addDays(end, 1))
    .sort((a, b) => (a.e.start < b.e.start ? -1 : a.e.start > b.e.start ? 1 : bySeries(a.d, b.d)));
  const held = ordered.flatMap(d => (d.rounds ?? []).map(r => ({ d, r }))).filter(({ r }) => r.endDate >= start && r.startDate <= end);
  const busy = new Set([
    ...held.filter(({ r }) => r.endDate >= first && r.startDate <= last).map(({ d }) => d.slug),
    ...placed.filter(({ e }) => e.start.slice(0, 10) >= first && e.start.slice(0, 10) <= last).map(({ d }) => d.slug),
  ]);
  const at = months.indexOf(ym);
  // The month is the page's title and each step names the month it opens (the operator, 22 Oct: "A with C"); the script
  // pins the steps in a slim bar once they have scrolled away. No step past the months the data reaches.
  const step = (m: string | undefined, rel: 'prev' | 'next'): string => {
    if (!m) return '';
    const day = new Date(`${m}-01T00:00:00Z`);
    const names = `<span class="pd-cal-full">${MONTH.format(day)}</span><span class="pd-cal-short">${MONTH_SHORT[day.getUTCMonth()]}</span>`;
    const label = `${rel === 'prev' ? 'Previous' : 'Next'} month: ${monthLabel(m)}`;
    return `<a class="pd-cal-step" rel="${rel}" href="${calendarMonthPath(m)}" aria-label="${label}">${rel === 'prev' ? `<i aria-hidden="true">‹</i>${names}` : `${names}<i aria-hidden="true">›</i>`}</a>`;
  };
  const shown = new Date(`${ym}-01T00:00:00Z`);
  const top =
    `<div class="pd-cal-top"><h1 class="pd-cal-h1"><small>Calendar</small> ${MONTH.format(shown)} <span>${shown.getUTCFullYear()}</span></h1>` +
    `<nav class="pd-cal-month" aria-label="Months">${step(at > 0 ? months[at - 1] : undefined, 'prev')}${step(at >= 0 ? months[at + 1] : undefined, 'next')}</nav>` +
    '<a class="pd-cal-today" href="/calendar/">Today</a><div class="pd-cal-ctl"><div class="pd-cal-views" data-pd-views></div><a class="pd-cal-emails" href="/subscribe/">Session emails</a></div></div>';
  const chips = ordered
    .filter(d => d.calendar?.length || d.rounds?.length)
    // data-name: the series' full name, for the Calendar tab's notice ("Formula 1 only") when a series page sends a reader here.
    .map(d => `<span class="pd-cal-chip pd-s-${slugAttr(d)}${busy.has(d.slug) ? '' : ' pd-dim'}" data-s="${slugAttr(d)}" data-name="${escapeHtml(d.name)}">${escapeHtml(chipLabel(d))}</span>`);
  const filter = `<div class="pd-cal-filter"><span class="pd-cal-lbl">Series</span>${chips.join('')}</div>`;
  const legend =
    '<p class="pd-cal-legend"><span class="pd-cal-lg">Event, across its days</span><span>Pick a week for its session times</span>' +
    '<span>Greyed: already run</span><span>Shaded: Friday to Sunday</span><span data-pd-calzone>Times in UTC</span></p>';
  const body = `<!-- wp:html -->\n<div class="pd-cal" data-month="${ym}">${top}${filter}${monthGrid(ym, start, end, placed, held)}${legend}${agenda(first, last, held)}</div>\n<!-- /wp:html -->`;
  return { path, title, body, template: 'page-wide' };
}

/** /calendar/ (this month) and one page for every month the feeds reach, up to a year either side, the months between included. */
export function calendarMonthPages(all: SeriesData[], now: Date): Page[] {
  const current = now.toISOString().slice(0, 7);
  const lo = shiftMonth(current, -CALENDAR_MONTHS);
  const hi = shiftMonth(current, CALENDAR_MONTHS);
  const seen = [current];
  for (const d of all) {
    for (const e of d.calendar ?? []) seen.push(e.start.slice(0, 7));
    for (const r of d.rounds ?? []) seen.push(r.startDate.slice(0, 7), r.endDate.slice(0, 7));
  }
  const reach = seen.filter(m => m >= lo && m <= hi).sort();
  const months: string[] = [];
  for (let m = reach[0]; m <= reach[reach.length - 1]; m = shiftMonth(m, 1)) months.push(m);
  return [
    calendarMonth(current, months, all, '/calendar/', 'Calendar'),
    ...months.map(m => calendarMonth(m, months, all, calendarMonthPath(m), `Calendar · ${monthLabel(m)}`)),
  ];
}

// ── The page as WordPress stores it ──────────────────────────────────────────

/** The publisher's mark, first in every page it owns: the hash of what it last wrote, and the address
 *  it wrote the page for, so a page WordPress gave another slug is still found as its own. */
export const MARKER = /^\s*<!-- paddock:sha256=([0-9a-f]{64})(?: path=(\/[a-z0-9/-]*))? -->/;

/** The template joins the hash only when a page names one, so every older page keeps its hash. */
export function hashOf(page: Pick<Page, 'title' | 'body' | 'template'>): string {
  const template = page.template ? `\ntemplate=${page.template}` : '';
  return createHash('sha256').update(`${page.title}\n${page.body}${template}`).digest('hex');
}

export function withMarker(body: string, hash: string, path: string): string {
  return `<!-- paddock:sha256=${hash} path=${path} -->\n${body}`;
}

/** A WordPress page as the REST API returns it with context=edit, flattened. */
export interface WpPageRow {
  id: number;
  slug: string;
  parent: number;
  status: string;
  content: string;
}

/** `at` is where the page lives now: its own path, or another address WordPress gave it. */
export type SyncStep =
  | { kind: 'create'; page: Page; hash: string }
  | { kind: 'update'; id: number; page: Page; hash: string; at: string }
  | { kind: 'same'; id: number; page: Page; at: string }
  | { kind: 'conflict'; id: number; page: Page };

/** Each page's path from its slug chain ("/series/f1/standings/"); the lowest id wins
 *  a duplicate path. A page whose parent is not in the list (trashed, or a cycle)
 *  has no known path and is left out. */
export function wpPaths(rows: WpPageRow[]): Map<string, WpPageRow> {
  const byId = new Map(rows.map(r => [r.id, r]));
  const out = new Map<string, WpPageRow>();
  for (const r of [...rows].sort((a, b) => a.id - b.id)) {
    const slugs: string[] = [];
    let cur: WpPageRow | undefined = r;
    let rooted = false;
    for (let depth = 0; cur && depth < 10; depth++) {
      slugs.unshift(cur.slug);
      if (!cur.parent) {
        rooted = true;
        break;
      }
      cur = byId.get(cur.parent);
    }
    if (!rooted) continue;
    const path = `/${slugs.join('/')}/`;
    if (!out.has(path)) out.set(path, r);
  }
  return out;
}

const depthOf = (path: string): number => path.split('/').filter(Boolean).length;

/** The pages whose path starts with `prefix` (the publisher's --only), with every page of `all` above them: a page is
 *  written under its parent, so /series/f1/ alone would fail on a site without /series/. */
export function onlyFamily(all: Page[], prefix: string): Page[] {
  // Several families at once, separated by commas ("/calendar/,/series/f1/"): the scheduled run keeps both current.
  const prefixes = prefix.split(',').filter(Boolean);
  const chosen = all.filter(p => prefixes.some(x => p.path.startsWith(x)));
  return all.filter(p => chosen.includes(p) || chosen.some(c => c.path !== p.path && c.path.startsWith(p.path)));
}

/** What to do with each desired page, parents before children. Only a page that
 *  carries the publisher's marker is ever updated; any other page at the same
 *  path is a conflict and is left alone. A page of ours that WordPress gave
 *  another slug is found by the path in its marker, so it is updated, never made twice. */
export function planSync(desired: Page[], existing: WpPageRow[]): SyncStep[] {
  const byPath = wpPaths(existing);
  const pathOf = new Map([...byPath].map(([path, row]) => [row.id, path]));
  const byMarkedPath = new Map<string, WpPageRow>();
  for (const row of [...existing].sort((a, b) => a.id - b.id)) {
    const marked = MARKER.exec(row.content)?.[2];
    if (marked && !byMarkedPath.has(marked)) byMarkedPath.set(marked, row);
  }
  return [...desired]
    .sort((a, b) => depthOf(a.path) - depthOf(b.path) || a.path.localeCompare(b.path))
    .map((page): SyncStep => {
      const hash = hashOf(page);
      const row = byPath.get(page.path) ?? byMarkedPath.get(page.path);
      if (!row) return { kind: 'create', page, hash };
      const mark = MARKER.exec(row.content);
      if (!mark) return { kind: 'conflict', id: row.id, page };
      const at = pathOf.get(row.id) ?? page.path;
      return mark[1] === hash ? { kind: 'same', id: row.id, page, at } : { kind: 'update', id: row.id, page, hash, at };
    });
}
