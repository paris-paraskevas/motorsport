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
}

/** Rows a results table keeps, and a series page's standings excerpt. */
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

/** Top ten of a single-class race. Position 0 (IndyCar's non-finishers) and 90+
 *  (DTM's synthetic DNF slots) are not classified places. */
function raceTable(title: string, entries: unknown, person: string): Table | null {
  if (!Array.isArray(entries)) return null;
  const lines = entries
    .filter(isObj)
    .map(e => ({ pos: num(e.position), name: str(e.driverName), team: str(e.team), time: str(e.time) || str(e.status), points: num(e.points) }))
    .filter((l): l is typeof l & { pos: number } => l.pos !== null && l.pos >= 1 && l.pos < 90 && l.name !== '')
    .sort((a, b) => a.pos - b.pos)
    .slice(0, TOP);
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

/** Top ten of one class (IMSA, WEC: lib/results/imsa.ts ImsaRaceEntry, wec.ts WecRaceEntry). */
function classTable(title: string, entries: unknown): Table | null {
  if (!Array.isArray(entries)) return null;
  const lines = entries
    .filter(isObj)
    .map(e => ({ pos: num(e.position), car: str(e.carNumber), drivers: str(e.drivers), team: str(e.team), gap: str(e.gap) || str(e.status) }))
    .filter((l): l is typeof l & { pos: number } => l.pos !== null && l.pos >= 1)
    .sort((a, b) => a.pos - b.pos)
    .slice(0, TOP);
  if (lines.length === 0) return null;
  return {
    title,
    columns: ['Pos', '#', 'Drivers', 'Team', 'Gap'],
    rows: lines.map(l => [String(l.pos), l.car, l.drivers, l.team, l.gap]),
  };
}

/** Top ten overall of a GT World race, every cup in one classification (lib/results/gt-world.ts). */
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
    .sort((a, b) => a.pos - b.pos)
    .slice(0, TOP);
  if (lines.length === 0) return null;
  return {
    title,
    columns: ['Pos', '#', 'Drivers', 'Team', 'Cup'],
    rows: lines.map(l => [String(l.pos), l.car, l.drivers, l.team, l.cup]),
  };
}

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

/** A season's results as rounds, oldest first, each race's top ten. The payload is
 *  whatever the series' fetcher returns: RaceResult[]; F2's { feature, sprint };
 *  F1's { races, sprints } (the Grand Prix list and the sprint list); IMSA's and
 *  WEC's per-class rounds; GT World's races. [] when nothing is usable. */
export function resultRounds(slug: string, payload: unknown, rounds: readonly SeriesRoundEntry[] = []): ResultRound[] {
  const byKey = new Map<string, ResultRound>();
  const add = (round: number | null, name: string, date: string | null, session: ResultSession) => {
    const key = round !== null ? `r${round}` : `e${name}`;
    let r = byKey.get(key);
    if (!r) {
      r = { round, name, date, sessions: [] };
      byKey.set(key, r);
    }
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
  }
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
      out.push({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        dateOnly: s.dateOnly === true,
        event,
        session: sessionName(s.title),
        round: w.round > 0 ? w.round : null,
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
}

export interface SeriesData {
  slug: string;
  name: string;
  /** null: no data, so no page. */
  standings: Table[] | null;
  results: ResultRound[] | null;
  calendar: CalendarEntry[] | null;
}

export const seriesPath = (slug: string, sub?: 'standings' | 'results' | 'calendar'): string =>
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
        parts.push(tableBlock(t.columns, t.rows));
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

const CALENDAR_DAYS = 30;

/** /calendar/: every series' sessions in the next 30 days. */
export function calendarPage(all: SeriesData[], now: Date): Page {
  const rows = all
    .flatMap(d => upcoming(d.calendar ?? [], now, CALENDAR_DAYS * 86_400_000).map(e => ({ d, e })))
    .sort((a, b) => (a.e.start < b.e.start ? -1 : a.e.start > b.e.start ? 1 : a.d.name.localeCompare(b.d.name)));
  const body = [
    paragraph(`Every session in the next ${CALENDAR_DAYS} days, in UTC and in Athens time.`),
    rows.length
      ? tableBlock(['Series', 'Event', 'Session', 'UTC', 'Athens'], rows.map(({ d, e }) => [{ text: d.name, href: seriesPath(d.slug) }, e.event, e.session, ...whenCells(e)]))
      : paragraph('No sessions are scheduled.'),
  ];
  return { path: '/calendar/', title: 'Calendar', body: body.join('\n\n') };
}

/** /series/: every series with a page, and its next session. */
export function seriesIndexPage(all: SeriesData[], now: Date): Page {
  const rows = all
    .filter(d => d.standings?.length || d.results?.length || d.calendar)
    .map(d => {
      const next = d.calendar ? upcoming(d.calendar, now)[0] : undefined;
      return [{ text: d.name, href: seriesPath(d.slug) }, next ? `${next.event} · ${next.session}` : '', next ? whenCells(next)[0] : ''] as Cell[];
    });
  return { path: '/series/', title: 'Series', body: tableBlock(['Series', 'Next session', 'UTC'], rows) };
}

// ── The page as WordPress stores it ──────────────────────────────────────────

/** The publisher's mark, first in every page it owns: the hash of what it last wrote, and the address
 *  it wrote the page for, so a page WordPress gave another slug is still found as its own. */
export const MARKER = /^\s*<!-- paddock:sha256=([0-9a-f]{64})(?: path=(\/[a-z0-9/-]*))? -->/;

export function hashOf(page: Pick<Page, 'title' | 'body'>): string {
  return createHash('sha256').update(`${page.title}\n${page.body}`).digest('hex');
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
