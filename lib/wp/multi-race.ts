// Family A (O33): Formula 2, Formula 3, MotoGP, WorldSBK and DTM, two or three races a weekend (the Multi-Race Weekend
// Drafts, answered 25 Oct). Task 2.b's PR 2 keeps each round's practice and qualifying beside its races; PR 3 draws
// its pages, the kit at the end of this file. Pure: the publisher's family A block (scripts/wp-publish.mts) fetches,
// these turn answers into tables and the stored tables into pages.

import * as cheerio from 'cheerio';
import type { FomResultRow } from '../results/fom-api';
import type { SessionClassificationEntry } from '../results/openf1';
import { built, escapeHtml, seasonPath, seriesPath, sessionKind, sessionSlug, type CalendarEntry, type FamilyKit, type Page, type ResultRound, type ResultSession, type SeriesData, type SeriesTeam, type Table } from './render';
import { codeOf, col, htmlBlock, outline, raceWins, seriesChampions, seriesStandings, standingsBlock, teamLabel, tick, type WinCount } from './series';
import {
  aside,
  bar,
  classTable,
  credit,
  forecast,
  forecastBox,
  nextRound,
  nothingUsed,
  resultTabs,
  seasonPage,
  section,
  sessionBand,
  sessionCard,
  sessionPath,
  strip,
  trackDay,
  trackTime,
  trackWeekday,
  weekendBand,
  weekendOf,
  yours,
  type BarEntry,
  type TabPanel,
  type Used,
  type Weekend,
} from './weekend';

/** A real place: no field reaches 100, and FOM writes 666 and 66666 for a driver without one. */
const placed = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n < 100;

/** A timed session from FOM's own rows (Formula 2 and 3: practice, qualifying): the placed drivers in order, then the
 *  rest under the place FOM displays for them ("NC", "DQ"), each with its time as FOM writes it: a best lap, or behind
 *  practice's leader the gap. FOM's "666" and "66666" are its markers for no place. */
export function fomTable(title: string, rows: readonly FomResultRow[]): Table | null {
  const lines = rows
    .map(r => ({
      pos: /^\d+$/.test(r.positionNumber ?? '') ? Number(r.positionNumber) : null,
      shown: (r.displayPosition ?? '').trim(),
      name: r.driverFirstName && r.driverLastName ? `${r.driverFirstName} ${r.driverLastName}` : (r.driverShortName ?? ''),
      team: r.teamName ?? '',
      time: (r.displayTime ?? '').trim(),
    }))
    .filter(l => l.name.trim() !== '');
  const top = lines.filter(l => placed(l.pos)).sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  if (!top.length) return null;
  const rest = lines.filter(l => !placed(l.pos));
  return {
    title,
    columns: ['Pos', 'Driver', 'Team', 'Time'],
    rows: [...top.map(l => [String(l.pos), l.name, l.team, l.time]), ...rest.map(l => [l.shown, l.name, l.team, l.time])],
  };
}

/** A timed session from a fetcher's classification (MotoGP, WorldSBK: practice, qualifying, Superpole, warm-up): the
 *  placed riders in order with their time, else their gap; then anyone unplaced under the status the fetcher gives. */
export function timedTable(title: string, entries: readonly SessionClassificationEntry[], person: 'Driver' | 'Rider'): Table | null {
  const named = entries.filter(e => e.driverName.trim() !== '');
  const top = named.filter(e => placed(e.position)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (!top.length) return null;
  const rest = named.filter(e => !placed(e.position));
  return {
    title,
    columns: ['Pos', person, 'Team', 'Time'],
    rows: [...top.map(e => [String(e.position), e.driverName, e.team, e.time ?? e.gap ?? '']), ...rest.map(e => [e.status ?? '', e.driverName, e.team, e.time ?? ''])],
  };
}

/** A qualifying FOM gives by number (`session=1`, `session=2`) under the timetable's name: a group ("Qualifying A",
 *  "Group B - Qualifying") as "Qualifying Group A"; a weekend's second qualifying (Baku, Madrid) as "Qualifying 2". */
export function fomQualifyingLabel(shortName: string | undefined, n: number): string {
  const group = /(?:^|\s)([AB])(?:\s|$)/.exec(shortName ?? '')?.[1];
  return group ? `Qualifying Group ${group}` : `Qualifying ${n}`;
}

/** A round is over a day after its last day: from then a session its source answered for with nothing is kept as
 *  "no classification" and not asked for again. */
export const roundOver = (endDate: string | null | undefined, now: Date): boolean => Boolean(endDate) && Date.parse(`${endDate}T23:59:59Z`) + 86_400_000 < now.getTime();

/** Each round dated by its last day, as the series' rounds.json gives it; a round it does not name keeps its date.
 *  A round's date is its last race's, and two fetchers give another: DTM's a placeholder, WorldSBK's every race its
 *  round's first day (lib/results/wsbk.ts). */
export function datedByLastDay(rounds: readonly ResultRound[], entries: readonly { round: number; endDate: string }[]): ResultRound[] {
  return rounds.map(r => {
    const end = entries.find(e => e.round === r.round)?.endDate;
    return end ? { ...r, date: end } : r;
  });
}

/** An API's answer for a session's classification as its table: undefined when there was no answer, or none in the
 *  shape of a list (a call that failed reaches here as null); null when the API answered with an empty list, its
 *  own word for no classification; else the table `draw` makes of the rows, undefined when it can make none. */
export function answered(rows: unknown, draw: (rows: unknown[]) => Table | null): Table | null | undefined {
  if (!Array.isArray(rows)) return undefined;
  if (!rows.length) return null;
  return draw(rows) ?? undefined;
}

/** Why a timed session is kept without a table, if it is: "called off" when its API lists it cancelled; "no
 *  classification" when it lists it finished, answered with none (`table` null) and its round is over. A call that
 *  failed (`table` undefined) is never kept: it is asked again next run. */
export function sessionNone(status: string, table: Table | null | undefined, over: boolean): string | undefined {
  if (/cancel/i.test(status)) return 'called off';
  return table === null && over && /finish/i.test(status) ? 'no classification' : undefined;
}

/** The timed sessions a run asks a fetcher for: in the calendar under one of `names`, ended over an hour ago, not yet
 *  held by their round, the newest first, at most `max`. */
export function sessionsWanted(rounds: readonly ResultRound[], calendar: readonly CalendarEntry[], names: ReadonlySet<string>, now: Date, max: number): CalendarEntry[] {
  const held = new Set(rounds.flatMap(r => (r.others ?? []).map(o => `${r.round}|${o.label}`)));
  return calendar
    .filter(e => e.round !== null && !e.dateOnly && names.has(e.session) && Date.parse(e.end) + 3_600_000 <= now.getTime())
    .filter(e => !held.has(`${e.round}|${e.session}`))
    .sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
    .slice(0, Math.max(0, max));
}

// ── DTM (motorsport.com's result pages) ──────────────────────────────────────

/** A DTM time as motorsport.com writes it, minutes after an apostrophe ("1:50'55.938", "+1'00.591"), with colons. */
export const dtmTime = (time: string): string => time.replace(/'/g, ':');

export interface DtmRow {
  /** The place, or the page's own word for none ("dq", "dnf"). */
  pos: string;
  name: string;
  team: string;
  /** The row's own time: a lap, or a race's total; the page writes the gap above it. */
  time: string;
}

/** A session page's classification on motorsport.com (practice, qualifying, a grid, a race), every row in its order. */
export function dtmRows(html: string): DtmRow[] {
  const $ = cheerio.load(html);
  return $('table.ms-table--result')
    .first()
    .find('tbody tr')
    .map((_, tr) => {
      const r = $(tr);
      const cell = r.find('.ms-table_field--result_driver_id').first();
      const lines = r.find('.ms-table_field--time p');
      return {
        pos: r.find('.ms-table_field--pos').first().text().trim(),
        name: (cell.find('.name-short').first().text() || cell.find('.name').first().text()).replace(/\s+/g, ' ').trim(),
        team: cell.find('.team').first().text().replace(/\s+/g, ' ').trim(),
        time: dtmTime((lines.length ? lines.last().text() : r.find('.ms-table_field--time').first().text()).replace(/\s+/g, ' ').trim()),
      };
    })
    .get()
    .filter(x => x.name !== '');
}

/** The session links a DTM event page lists (?st=FP1, Q1, … Q4 at the Norisring, GRID1). */
export function dtmSessions(html: string): string[] {
  const $ = cheerio.load(html);
  return [...new Set($('a[href*="?st="]').map((_, a) => ($(a).attr('href') ?? '').split('st=')[1] ?? '').get())].filter(Boolean);
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "Oct 9, 2026" as 2026-10-09, by its parts: Date.parse reads it in the machine's own time zone, a day early east of
 *  Greenwich. */
const isoDay = (text: string): string | null => {
  const m = /^([A-Za-z]{3})[A-Za-z]*\.? (\d{1,2}), (\d{4})$/.exec(text.trim());
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  return m && month >= 0 ? `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
};

/** What a DTM event page on motorsport.com says of itself: the session its table shows (the tab marked current: an
 *  address naming a session the event does not have shows another's table), the event's own days, the one range the
 *  page prints ("Oct 9, 2026 to Oct 11, 2026"), and whether it carries a results table at all. Null where the page
 *  does not say. A page's rows are kept only when session and days are what was asked for, and a session is taken
 *  to have no classification only on a page that says so in these words: should motorsport.com change its pages,
 *  nothing is read from them rather than something wrong. */
export function dtmShown(html: string): { session: string | null; start: string | null; end: string | null; table: boolean } {
  const $ = cheerio.load(html);
  const session = /[?&]st=([A-Za-z0-9]+)/.exec($('.ms-tab-menu__item.current a[href*="?st="]').first().attr('href') ?? '')?.[1] ?? null;
  const range = /^([A-Z][a-z]{2,8}\.? \d{1,2}, \d{4})(?: to ([A-Z][a-z]{2,8}\.? \d{1,2}, \d{4}))?$/;
  const printed = [...new Set($('span').map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(t => range.test(t)))];
  const m = printed.length === 1 ? range.exec(printed[0]) : null;
  const start = m ? isoDay(m[1]) : null;
  const end = m ? isoDay(m[2] ?? m[1]) : null;
  const table = $('table.ms-table--result').length > 0;
  return start && end ? { session, start, end, table } : { session, start: null, end: null, table };
}

/** A weekend's qualifying groups as rounds.json names their pages (`qualifyingGroups`): { "Qualifying 1": { "A":
 *  "Q1", "B": "Q2" }, … }, beside its comment and sources. */
export type DtmGroups = Record<string, unknown>;

const groupPage = (groups: DtmGroups | undefined, qualifying: string, group: string): string | null => {
  const named = groups?.[qualifying];
  const st = named && typeof named === 'object' ? (named as Record<string, unknown>)[group] : undefined;
  return typeof st === 'string' && st !== '' ? st : null;
};

/** The page of its event a DTM session is read from (the address's ?st=): a practice by its number; a qualifying its
 *  own page, or at a weekend that qualified in groups the grid they made; a group the page rounds.json names. */
export function dtmPageCode(label: string, grouped: boolean, groups?: DtmGroups): string | null {
  const practice = /^Free Practice (\d)$/.exec(label);
  if (practice) return `FP${practice[1]}`;
  const qualifying = /^Qualifying ([12])$/.exec(label);
  if (qualifying) return `${grouped ? 'GRID' : 'Q'}${qualifying[1]}`;
  const group = /^(Qualifying [12]) Group ([AB])$/.exec(label);
  return group ? groupPage(groups, group[1], group[2]) : null;
}

/** The page a DTM session is asked from, by what is known of its event: its ?st=, from the event's own tabs once a
 *  page of it was read this run (`tabs`: a weekend that qualified in groups lists a Q3), till then from rounds.json.
 *  Null when those tabs list no such session, or no groups for a group's: the event has none. Undefined when
 *  rounds.json names no page for it. */
export function dtmAsk(label: string, groups: DtmGroups | undefined, tabs: readonly string[] | undefined): string | null | undefined {
  const st = dtmPageCode(label, tabs ? tabs.includes('Q3') : Boolean(groups), groups);
  if (!st) return undefined;
  return tabs && (!tabs.includes(st) || (/ Group [AB]$/.test(label) && !tabs.includes('Q3'))) ? null : st;
}

/** What the page fetched at `st` gives for a session, with the event's tabs as they are now known. Its table; null
 *  when the page shows that session with nobody placed; 'again' when it is the event's first page this run and its
 *  tabs would have led to ask another page, or none; undefined when the page does not say what it shows (no tab
 *  marked, another session's table, no results table). Only null ever becomes "no classification": a page that
 *  cannot be read is never taken for a session without one. */
export function dtmRead(
  label: string,
  st: string,
  html: string,
  groups: DtmGroups | undefined,
  tabs: readonly string[] | undefined,
): { tabs: readonly string[] | undefined; table: Table | null | undefined | 'again' } {
  const shown = dtmShown(html);
  if (shown.session === null) return { tabs, table: undefined };
  const listed = tabs ?? dtmSessions(html);
  if (!tabs && dtmAsk(label, groups, listed) !== st) return { tabs: listed, table: 'again' };
  if (shown.session !== st) return { tabs: listed, table: undefined };
  return { tabs: listed, table: dtmTable(label, dtmRows(html)) ?? (shown.table ? null : undefined) };
}

/** The DTM sessions a run asks motorsport.com for, each by itself: every practice and qualifying of the timetable
 *  that ended over an hour ago and its round does not hold, and where rounds.json names a qualifying's groups, each
 *  group of a qualifying that has ended; the newest first. So a session waits until it has run (a round's second
 *  qualifying is the morning after its first race), and one whose page did not answer is asked again next run. */
export function dtmWanted(
  rounds: readonly ResultRound[],
  calendar: readonly CalendarEntry[],
  groupsOf: (round: number) => DtmGroups | undefined,
  now: Date,
): { round: number; label: string; event: string }[] {
  const held = new Set(rounds.flatMap(r => (r.others ?? []).map(o => `${r.round}|${o.label}`)));
  return calendar
    .filter(e => e.round !== null && !e.dateOnly && /^(Free Practice \d|Qualifying [12])$/.test(e.session) && Date.parse(e.end) + 3_600_000 <= now.getTime())
    .sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
    .flatMap(e => {
      const round = e.round as number;
      const groups = groupsOf(round);
      const labels = [e.session, ...['A', 'B'].filter(g => groupPage(groups, e.session, g)).map(g => `${e.session} Group ${g}`)];
      return labels.filter(label => !held.has(`${round}|${label}`)).map(label => ({ round, label, event: e.event }));
    });
}

/** DTM's qualifying points (rules.md: 3-2-1 to the top three of each qualifying; a qualifying in groups, the top three
 *  of the grid they make), checked against the official table before they are kept. */
export const DTM_QUALIFYING_POINTS = [3, 2, 1] as const;

/** A DTM session as a table: placed rows in order, the rest under the page's word; `points` adds a Pts column. */
export function dtmTable(title: string, rows: readonly DtmRow[], points: readonly number[] = []): Table | null {
  const placed = rows.filter(r => /^\d+$/.test(r.pos)).sort((a, b) => Number(a.pos) - Number(b.pos));
  if (!placed.length) return null;
  const rest = rows.filter(r => !/^\d+$/.test(r.pos));
  const pts = (i: number) => (points.length ? [i < points.length ? String(points[i]) : ''] : []);
  return {
    title,
    columns: ['Pos', 'Driver', 'Team', 'Time', ...(points.length ? ['Pts'] : [])],
    rows: [...placed.map((r, i) => [r.pos, r.name, r.team, r.time, ...pts(i)]), ...rest.map(r => [r.pos.toUpperCase(), r.name, r.team, r.time, ...(points.length ? [''] : [])])],
  };
}

/** DTM's races whose winner's line shows a gap, not a time: the car ahead of him was taken out of the classification
 *  after the race (Oschersleben 2026's second race). Each takes the winner's own time as an earlier run read it from
 *  the race's page, so that page is asked for once; `pending` names the races no run has read yet. Only the season's
 *  own stored rounds count, and only a stored line for the same winner. */
export function dtmWinnersTimes(rounds: readonly ResultRound[], stored: readonly ResultRound[] | null, season: number): { rounds: ResultRound[]; pending: { round: number; label: string }[] } {
  const pending: { round: number; label: string }[] = [];
  const out = rounds.map(r => ({
    ...r,
    sessions: r.sessions.map(s => {
      const t = s.tables[0];
      const time = t?.columns.indexOf('Time') ?? -1;
      const driver = t?.columns.indexOf('Driver') ?? -1;
      if (r.round === null || !t || time < 0 || driver < 0 || !/^\+/.test(t.rows[0]?.[time] ?? '')) return s;
      const was = (stored ?? []).find(x => x.round === r.round && x.date?.slice(0, 4) === String(season))?.sessions.find(x => x.label === s.label)?.tables[0];
      const own = was && was.rows[0]?.[was.columns.indexOf('Driver')] === t.rows[0][driver] ? (was.rows[0][was.columns.indexOf('Time')] ?? '') : '';
      if (own === '' || /^\+/.test(own)) {
        pending.push({ round: r.round, label: s.label });
        return s;
      }
      return withWinnerTime(s, own);
    }),
  }));
  return { rounds: out, pending };
}

/** A race with its winner's own time in place of the gap its first line shows. */
export function withWinnerTime(session: ResultSession, time: string): ResultSession {
  const t = session.tables[0];
  const at = t?.columns.indexOf('Time') ?? -1;
  if (!t || at < 0) return session;
  return { ...session, tables: [{ ...t, rows: t.rows.map((row, k) => (k === 0 ? row.map((v, c) => (c === at ? time : v)) : row)) }, ...session.tables.slice(1)] };
}

/** A DTM weekend's scoring sessions in the order they run. */
const DTM_RUNNING = ['Qualifying 1', 'Race 1', 'Qualifying 2', 'Race 2'];

/** DTM's qualifying points, worked out afresh each run from the places stored (3-2-1 to each qualifying's top three;
 *  a qualifying in groups, its grid's) and kept as far as the official table bears them out: through the last
 *  session, in running order, at which every driver's total of races and qualifying equals the table's. So a table a
 *  race behind its results takes no earlier round's points away; totals that are equal at no session leave every
 *  qualifying without points; and without a table this run the stored tables stay as they are. `report` says which. */
export function dtmQualifyingPoints(rounds: ResultRound[], table: Table | undefined): { rounds: ResultRound[]; report: string } {
  if (!table) return { rounds, report: "no official table this run: qualifying's points stay as they were stored" };
  const qualifying = (label: string) => label === 'Qualifying 1' || label === 'Qualifying 2';
  const strip = (t: Table): Table => (t.columns.includes('Pts') ? { ...t, columns: t.columns.filter(c => c !== 'Pts'), rows: t.rows.map(row => row.filter((_, c) => t.columns[c] !== 'Pts')) } : t);
  const award = (t: Table): Table => {
    const bare = strip(t);
    const placed = bare.rows.filter(row => /^\d+$/.test(row[0] ?? '')).map(row => Number(row[0])).sort((a, b) => a - b);
    const top = new Map(placed.slice(0, DTM_QUALIFYING_POINTS.length).map((p, i) => [p, DTM_QUALIFYING_POINTS[i]]));
    return { ...bare, columns: [...bare.columns, 'Pts'], rows: bare.rows.map(row => [...row, /^\d+$/.test(row[0] ?? '') && top.has(Number(row[0])) ? String(top.get(Number(row[0]))) : '']) };
  };
  const rank = (label: string) => (DTM_RUNNING.includes(label) ? DTM_RUNNING.indexOf(label) : DTM_RUNNING.length);
  const scoring = rounds.flatMap((r, at) =>
    [...r.sessions, ...(r.others ?? []).filter(s => qualifying(s.label))]
      .map((s, i) => ({ s, i }))
      .sort((a, b) => rank(a.s.label) - rank(b.s.label) || a.i - b.i)
      .map(({ s }) => {
        const t = s.tables[0] && qualifying(s.label) ? award(s.tables[0]) : s.tables[0];
        const name = t?.columns.indexOf('Driver') ?? -1;
        const pts = t?.columns.indexOf('Pts') ?? -1;
        return { at, round: r.round, label: s.label, points: t && name >= 0 && pts >= 0 ? t.rows.map(row => [row[name], Number(row[pts]) || 0] as const) : [] };
      }),
  );
  const name = table.columns.indexOf('Driver');
  const pts = table.columns.indexOf('Pts');
  const sum = new Map<string, number>();
  const off = () => table.rows.filter(row => (sum.get(row[name]) ?? 0) !== Number(row[pts]));
  let good = off().length ? -1 : 0;
  scoring.forEach((s, i) => {
    for (const [driver, p] of s.points) sum.set(driver, (sum.get(driver) ?? 0) + p);
    if (!off().length) good = i + 1;
  });
  const kept = new Set(scoring.slice(0, Math.max(good, 0)).filter(s => qualifying(s.label)).map(s => `${s.at}|${s.label}`));
  const out = rounds.map((r, at) => (r.others ? { ...r, others: r.others.map(s => (qualifying(s.label) ? { ...s, tables: s.tables.map(kept.has(`${at}|${s.label}`) ? award : strip) } : s)) } : r));
  const all = rounds.every(r => !r.sessions.length || (r.others ?? []).filter(s => qualifying(s.label)).length === 2);
  const wrong = off();
  const last = scoring[good - 1];
  const report =
    good === scoring.length
      ? `${table.rows.length} of ${table.rows.length} drivers' totals equal the official table with qualifying's points`
      : good >= 0
        ? `the official table equals the results ${last ? `through R${last.round} ${last.label}` : 'before the first session'}, ${scoring.length - good} session${scoring.length - good === 1 ? '' : 's'} behind them: qualifying's points kept through it`
        : `${table.rows.length - wrong.length} of ${table.rows.length} drivers' totals equal the official table with qualifying's points${all ? '' : ' (the qualifying of some rounds not held yet)'}; kept without them (not ${wrong.map(row => `${row[name]} ${sum.get(row[name]) ?? 0} for ${row[pts]}`).join(', ')})`;
  return { rounds: out, report };
}

/** A name as drivers.json spells it, from a source's short form: a name a driver lists under `also` (motorsport.com's
 *  "P. Maximilian" for Maximilian Paul), else the one driver whose surname and first initial match ("M. Engel"); a
 *  name it cannot spell one way stays as the source wrote it. */
export function initialsSpeller(roster: readonly { name: string; also?: readonly string[] }[]): (name: string) => string {
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return name => {
    const listed = roster.filter(d => (d.also ?? []).some(a => fold(a) === fold(name)));
    if (listed.length === 1) return listed[0].name;
    const m = /^(\p{L})\.\s+(.+)$/u.exec(name.trim());
    if (!m) return name;
    const hits = roster.filter(d => {
      const parts = d.name.trim().split(/\s+/);
      return fold(parts.slice(1).join(' ')) === fold(m[2]) && fold(parts[0]).startsWith(fold(m[1]));
    });
    return hits.length === 1 ? hits[0].name : name;
  };
}

/** A season's DTM events on motorsport.com, a round each in the order of their ids: an event page's picker lists the
 *  other events and its session tabs name its own; other links on the page (five more Hockenheim pages on 2026's)
 *  are not the season's events. */
export function dtmEvents(html: string, season: number): string[] {
  const $ = cheerio.load(html);
  const slug = new RegExp(`^/dtm/results/${season}/([a-z0-9-]+-[0-9]+)/`);
  const hrefs = [...$('a.msnt-select__option--event, a.msnt-select__option').map((_, a) => $(a).attr('href') ?? '').get(), ...$('a[href*="?st="]').map((_, a) => $(a).attr('href') ?? '').get()];
  return [...new Set(hrefs.flatMap(h => slug.exec(h)?.[1] ?? []))].sort((a, b) => Number(a.split('-').pop()) - Number(b.split('-').pop()));
}

// ── WorldSBK's races ─────────────────────────────────────────────────────────

/** WorldSBK's races as its API names them, each with its label here; the Superpole Race pays its own scale. */
export const WSBK_RACES: readonly (readonly [short: string, label: string, superpole: boolean])[] = [
  ['RC1', 'Race 1', false],
  ['SPRC', 'Superpole Race', true],
  ['RC2', 'Race 2', false],
];

/** This run's WorldSBK rounds with what earlier runs learned of each race: how many sessions its API holds for it
 *  (ResultSession.parts), and the table read from its own result (ResultSession.from; for a restarted race the
 *  restart's), which the old fetcher's never replaces: it reads the API's times as milliseconds. So a run its API does
 *  not answer keeps a race as it was stored. Only the season's own stored rounds count. */
export function wsbkCarried(fresh: readonly ResultRound[], stored: readonly ResultRound[] | null, season: number): ResultRound[] {
  const own = (stored ?? []).filter(r => r.date?.slice(0, 4) === String(season));
  return fresh.map(r => ({
    ...r,
    sessions: r.sessions.map(s => {
      const was = own.find(x => x.round === r.round)?.sessions.find(x => x.label === s.label);
      if (was?.parts === undefined) return s;
      return was.from !== undefined || was.parts > 1 ? { ...s, tables: was.tables, parts: was.parts, ...(was.from !== undefined ? { from: was.from } : {}) } : { ...s, parts: was.parts };
    }),
  }));
}

/** The rounds whose session list a run reads, the newest first: a round with a race not yet known to be one part or
 *  two, not yet read from its own result, or classified again since (`again`, wsbkReclassified's "round|label"), a
 *  round still being run (a restart is listed after its race's first part), and a round with a restarted race, whose
 *  result is read again each run. A finished round of races run once, read and not classified again is not asked
 *  about again. */
export function wsbkDue(rounds: readonly ResultRound[], endOf: (round: number | null) => string | null | undefined, now: Date, again: ReadonlySet<string> = new Set()): ResultRound[] {
  const race = new Set(WSBK_RACES.map(([, label]) => label));
  return rounds.filter(r => r.round !== null && r.sessions.some(s => race.has(s.label) && (s.parts === undefined || s.from === undefined || s.parts > 1 || again.has(`${r.round}|${s.label}`) || !roundOver(endOf(r.round) ?? r.date, now)))).reverse();
}

/** The WorldSBK races, as "round|label", whose table read from its own result (`from`) no longer lists the riders in
 *  the order of the old fetcher's table, which every run reads afresh at no extra call: the race was classified again
 *  since (an exclusion, a penalty that cost a place), so it is read again. A restarted race is read again each run
 *  anyway; the old fetcher's table is its first part. A penalty that changes a gap and no place is not seen once the
 *  round is over. */
export function wsbkReclassified(rounds: readonly ResultRound[], fresh: readonly ResultRound[]): Set<string> {
  const order = (t: Table | undefined) => {
    const rider = t?.columns.indexOf('Rider') ?? -1;
    return t && rider >= 0 ? t.rows.map(row => `${row[0]}|${row[rider]}`).join(';') : '';
  };
  const out = new Set<string>();
  for (const r of rounds)
    for (const s of r.sessions) {
      const now = fresh.find(x => x.round === r.round)?.sessions.find(x => x.label === s.label)?.tables[0];
      if (s.from !== undefined && s.parts === 1 && now && order(now) !== order(s.tables[0])) out.add(`${r.round}|${s.label}`);
    }
  return out;
}

/** WorldSBK's rounds as sessionsWanted should count what they hold: a practice, Superpole or warm-up stored with a
 *  table and no `from` was drawn by the old fetcher's reader, which reads the API's laps as milliseconds (Jerez
 *  2026's Superpole leader, 1'36.643, as 2:16.643), so it is asked for again, once: the table read then replaces it.
 *  A session kept without a table (called off, no classification) stays held. */
export function wsbkHeld(rounds: readonly ResultRound[]): ResultRound[] {
  return rounds.map(r => (r.others ? { ...r, others: r.others.filter(s => !s.tables.length || s.from !== undefined) } : r));
}

/** A retirement scores nothing: every race table with no points beside a rider whose Time names him retired, not
 *  classified, not started or excluded (the old fetcher pays one inside the top fifteen). */
export function wsbkScored(rounds: readonly ResultRound[]): ResultRound[] {
  return rounds.map(r => ({
    ...r,
    sessions: r.sessions.map(s => ({
      ...s,
      tables: s.tables.map(t => {
        const time = t.columns.indexOf('Time');
        const pts = t.columns.indexOf('Pts');
        return time < 0 || pts < 0 ? t : { ...t, rows: t.rows.map(row => (/^(retired|not classified|dns|dnq|dsq|exc)/i.test(row[time] ?? '') ? row.map((v, i) => (i === pts ? '0' : v)) : row)) };
      }),
    })),
  }));
}

/** WorldSBK's scales (content/series/wsbk/rules.md, Points): Races 1 and 2 pay fifteen, the Superpole Race nine. */
const WSBK_RACE = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const WSBK_SUPERPOLE = [12, 9, 7, 6, 5, 4, 3, 2, 1];

/** A WorldSBK race's points by place: a rider the API lists classified scores, one retired, excluded or not started
 *  does not (the old fetcher paid a retirement inside the top fifteen: Magny-Cours 2026's first Race 1). */
export function wsbkPoints(pos: number, status: string, superpole: boolean): number {
  if (!/^classified$/i.test(status.trim())) return 0;
  return (superpole ? WSBK_SUPERPOLE : WSBK_RACE)[pos - 1] ?? 0;
}

/** A time as WorldSBK's API writes it, in milliseconds: its digits are the minutes, the seconds and the thousandths run
 *  together (Jerez 2026's first race, 3309762, is "Time of Race 33'09.762" in its official classification,
 *  resources.worldsbk.com/files/results/2026/JER/SBK/001/CLA/Results.pdf; a lap of 1'36.643 is 136643). Null for no
 *  time: 0, anything not a whole number, or digits whose seconds reach 60. */
export function wsbkMs(time: unknown): number | null {
  if (typeof time !== 'number' || !Number.isInteger(time) || time <= 0) return null;
  const seconds = Math.floor(time / 1000) % 100;
  return seconds < 60 ? (Math.floor(time / 100_000) * 60 + seconds) * 1000 + (time % 1000) : null;
}

/** A WorldSBK results answer's rows in their places: each rider's names, team, status, time (wsbkMs) and laps. */
function wsbkAnswer(env: unknown) {
  type Item = { id?: string; type?: string; attributes?: Record<string, unknown>; relationships?: Record<string, { data?: { id?: string } }> };
  const e = env as { data?: Item[]; included?: Item[] } | null;
  const inc = new Map((e?.included ?? []).map(x => [`${x.type}|${x.id}`, x.attributes ?? {}]));
  const of = (kinds: string[], id: string | undefined) => kinds.map(k => inc.get(`${k}|${id}`)).find(Boolean);
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  return (e?.data ?? [])
    .filter(x => x.type === 'results' && typeof x.attributes?.position === 'number')
    .map(x => {
      const rider = of(['rider', 'riders'], x.relationships?.rider?.data?.id);
      const team = of(['team', 'teams'], x.relationships?.team?.data?.id);
      const laps = x.attributes?.laps;
      return { pos: x.attributes?.position as number, given: text(rider?.name), surname: text(rider?.surname), team: text(team?.name), status: text(x.attributes?.status), ms: wsbkMs(x.attributes?.time), laps: typeof laps === 'number' ? laps : null };
    })
    .sort((a, b) => a.pos - b.pos);
}

const formatRace = (ms: number): string => {
  const s = ms / 1000;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = (s - h * 3600 - m * 60).toFixed(3).padStart(6, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
};
const formatGap = (ms: number): string => (ms < 60_000 ? `${(ms / 1000).toFixed(3)}s` : `${Math.floor(ms / 60_000)}:${((ms % 60_000) / 1000).toFixed(3).padStart(6, '0')}`);

/** A WorldSBK practice's, Superpole's or warm-up's results answer as its stored table, drawn as the old fetcher's
 *  reader drew one (lib/results/wsbk.ts parseSessionClassification, then timedTable: each placed rider's best lap,
 *  the leader's own and the others' gaps to it; DNS, DSQ or DNF for a rider with no place), but its laps read by
 *  wsbkMs: that reader reads them as milliseconds. Null under eight riders, as it, and when the first-placed rider
 *  has no time: no one set one, and an answer of none never replaces a table held (riderSessions). */
export function wsbkTimedTable(title: string, env: unknown): Table | null {
  const rows = wsbkAnswer(env).filter(x => x.given !== '' && x.surname !== '' && x.team !== '');
  const top = rows.find(x => x.pos === 1)?.ms ?? null;
  if (rows.length < 8 || top === null) return null;
  const entries: SessionClassificationEntry[] = rows.map(x => {
    const status = x.status === '' || /classified|finished/i.test(x.status) ? undefined : /^dns/i.test(x.status) ? 'DNS' : /excl|dsq|dnq/i.test(x.status) ? 'DSQ' : 'DNF';
    return {
      position: x.pos,
      driverName: `${x.given} ${x.surname}`.trim(),
      team: x.team,
      ...(x.ms === null ? {} : x.pos === 1 || x.ms <= top ? { time: formatRace(x.ms) } : { gap: `+${formatGap(x.ms - top)}` }),
      ...(status ? { status } : {}),
    };
  });
  return timedTable(title, entries, 'Rider');
}

/** A WorldSBK race's results answer as its stored table: the winner's time and the others' gaps to him, as its
 *  official classification prints them (resources.worldsbk.com's Results.pdf), its times read by wsbkMs. A rider the
 *  answer classifies laps down reads them ("+4 Laps"); one not classified, or with no time, reads his status. The
 *  riders on the winner's lap cross the line in their order: from the first timed below the one ahead of him, they
 *  were classified where an intermediate last timed them (Magny-Cours 2026's second race, "1 Sector" to "3 Sectors"
 *  in its classification, which the answer cannot say), and they read their status too. Its points by wsbkPoints.
 *  Null under eight riders, and when the winner has no time: a classification without one is none. */
export function wsbkRaceTable(title: string, env: unknown, superpole: boolean): Table | null {
  const rows = wsbkAnswer(env)
    .map(x => ({ ...x, name: `${x.given} ${x.surname}`.trim() }))
    .filter(x => x.name !== '' && x.pos >= 1 && x.pos < 90);
  const win = rows.find(x => x.pos === 1);
  if (rows.length < 8 || !win || win.ms === null) return null;
  const won = win.ms;
  const laps = win.laps;
  let ahead = won;
  let line = true;
  const time = (x: (typeof rows)[number]): string => {
    if (x === win) return formatRace(won);
    if (!/^classified$/i.test(x.status.trim())) return x.status;
    const down = x.laps !== null && laps !== null ? laps - x.laps : 0;
    if (down > 0) return `+${down} Lap${down === 1 ? '' : 's'}`;
    if (x.ms === null) return x.status;
    line &&= x.ms >= ahead;
    ahead = x.ms;
    return line && x.ms > won ? `+${formatGap(x.ms - won)}` : x.status;
  };
  return { title, columns: ['Pos', 'Rider', 'Team', 'Time', 'Pts'], rows: rows.map(x => [String(x.pos), x.name, x.team, time(x), String(wsbkPoints(x.pos, x.status, superpole))]) };
}

// ── The pages (O33's PR 3): family A's kit ────────────────────────────────────
//
// As drawn on Multi-Race Weekend Drafts (L, O, W, X; A1 to A6 and All 1 to 4 answered 25 Oct), the three drawings
// answered on 12 Nov ("All five", "As drawn", "Name the champion") and the answers of 24 Nov ("Greyed, as drawn",
// "Clinched in …"). Formula 1's parts and pages with each series' words: the timetable's names in the bar and the
// addresses, the stored races behind them (the label bridge), one results table with tabs, every point counted.

const esc = escapeHtml;

/** A race as a series names it: its stored label, its timetable's name (the bar's and its page's), its tab, its
 *  column in the weekend's points, and its name in a line ("Sprint", "Feature Race 1"). */
interface Race {
  label: string;
  page: string;
  tab: string;
  col: string;
  name: string;
}

/** What one points item is worth and how its words count it ("two Sprint Races at 10"). */
interface Scale {
  /** The timetable's sessions that carry it. */
  on: RegExp;
  points: number;
  one: string;
  many: string;
}

/** A family A series' words and scales. */
interface Words {
  person: 'Driver' | 'Rider';
  races: readonly Race[];
  /** Sessions beside the races that pay points (DTM's qualifying), by their stored label: their column. */
  paying?: readonly { label: string; col: string }[];
  /** At the track's Format (default 7). */
  format: (odd: boolean) => string;
  /** Points left (the plan's table, each scale checked against the series' 2026 regulations): in running order, the
   *  races', then the bonuses'. */
  scales: readonly Scale[];
  /** A round's scoring sessions where its timetable names none yet: the standard weekend. */
  weekend: readonly string[];
  /** The title box's word for champions.json's constructorChampion, and the Champions page's words. */
  teams: string;
  champions: { person: 'driver' | 'rider'; title: string; team: string };
}

const FEATURE = (n: string): Race => ({ label: `Feature${n ? ` ${n}` : ''}`, page: `Feature Race${n ? ` ${n}` : ''}`, tab: `Feature Race${n ? ` ${n}` : ''}`, col: n ? `FR${n}` : 'Feature', name: `Feature Race${n ? ` ${n}` : ''}` });
const FORMULA_RACES: readonly Race[] = [{ label: 'Sprint', page: 'Sprint Race', tab: 'Sprint Race', col: 'Sprint', name: 'Sprint' }, FEATURE(''), FEATURE('1'), FEATURE('2')];
const formulaScales = (sprint: number): Scale[] => [
  { on: /^sprint race$/i, points: sprint, one: 'Sprint Race', many: 'Sprint Races' },
  { on: /^feature race( \d)?$/i, points: 25, one: 'Feature Race', many: 'Feature Races' },
  { on: /^qualifying( \d)?$/i, points: 2, one: 'Feature pole', many: 'Feature poles' },
  { on: /^(sprint|feature) race( \d)?$/i, points: 1, one: 'fastest lap', many: 'fastest laps' },
];
const numbered = (label: string, col: string): Race => ({ label, page: label, tab: label, col, name: label });

const WORDS: Readonly<Record<string, Words>> = {
  f2: {
    person: 'Driver',
    races: FORMULA_RACES,
    format: odd => (odd ? 'Two qualifying sessions, three races' : 'Sprint and Feature'),
    scales: formulaScales(10),
    weekend: ['Qualifying', 'Sprint Race', 'Feature Race'],
    teams: "Teams'",
    champions: { person: 'driver', title: 'teams', team: 'team' },
  },
  f3: {
    person: 'Driver',
    races: FORMULA_RACES,
    format: odd => (odd ? 'Two qualifying sessions, three races' : 'Sprint and Feature'),
    scales: formulaScales(10),
    weekend: ['Qualifying', 'Sprint Race', 'Feature Race'],
    teams: "Teams'",
    champions: { person: 'driver', title: 'teams', team: 'team' },
  },
  motogp: {
    person: 'Rider',
    races: [numbered('Sprint', 'Sprint'), { label: 'Grand Prix', page: 'Race', tab: 'Grand Prix', col: 'GP', name: 'Grand Prix' }],
    format: () => 'Sprint and Grand Prix',
    scales: [
      { on: /^sprint$/i, points: 12, one: 'Sprint', many: 'Sprints' },
      { on: /^race$/i, points: 25, one: 'Grand Prix', many: 'Grands Prix' },
    ],
    weekend: ['Sprint', 'Race'],
    teams: "Constructors'",
    champions: { person: 'rider', title: 'constructors', team: 'manufacturer' },
  },
  wsbk: {
    person: 'Rider',
    races: [numbered('Race 1', 'R1'), numbered('Superpole Race', 'SPR'), numbered('Race 2', 'R2')],
    format: () => 'Race 1, Superpole Race and Race 2',
    scales: [
      { on: /^race [12]$/i, points: 25, one: 'race', many: 'races' },
      { on: /^superpole race$/i, points: 12, one: 'Superpole Race', many: 'Superpole Races' },
    ],
    weekend: ['Race 1', 'Superpole Race', 'Race 2'],
    teams: "Manufacturers'",
    champions: { person: 'rider', title: 'manufacturers', team: 'manufacturer' },
  },
  dtm: {
    person: 'Driver',
    races: [numbered('Race 1', 'R1'), numbered('Race 2', 'R2')],
    paying: [
      { label: 'Qualifying 1', col: 'Q1' },
      { label: 'Qualifying 2', col: 'Q2' },
    ],
    format: () => 'Two races, a qualifying before each',
    scales: [
      { on: /^race [12]$/i, points: 25, one: 'race', many: 'races' },
      { on: /^qualifying [12]$/i, points: 3, one: 'qualifying', many: 'qualifyings' },
    ],
    weekend: ['Qualifying 1', 'Race 1', 'Qualifying 2', 'Race 2'],
    teams: "Manufacturers'",
    champions: { person: 'driver', title: 'manufacturers', team: 'team' },
  },
};

/** The series' words; a series of family A without its own reads as Formula 2's. */
const wordsOf = (slug: string): Words => WORDS[slug] ?? WORDS.f2;
const raceBy = (slug: string, name: string): Race | undefined => wordsOf(slug).races.find(r => r.label === name || r.page === name);

/** A race's name in a line, or short (FamilyKit.raceName): by its stored label or its timetable name. */
export function raceName(d: SeriesData, label: string, short = false): string {
  const r = raceBy(d.slug, label);
  return r ? (short ? r.col : r.name) : label;
}

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** "the Sprint", "the Feature Race", but "Feature Race 1" and "Race 2". */
const the = (name: string): string => (/\d$/.test(name) ? name : `the ${name}`);
const NUMBER = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const inWords = (n: number): string => NUMBER[n] ?? String(n);
const andList = (items: readonly string[]): string => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : (items[0] ?? ''));

// ── A weekend's pages: the timetable's sessions, each with its stored one ─────

type Kind = 'practice' | 'qualifying' | 'race';

/** One page of a weekend: a session of the timetable, by its name (a qualifying run in two groups is one page, its
 *  groups' entries together), with its stored classification. */
export interface Unit {
  page: string;
  kind: Kind;
  entries: CalendarEntry[];
  /** Its stored session's label (Sprint Race → Sprint, Race → Grand Prix). */
  label: string;
  /** Its classification: a grouped qualifying's grid, stored (DTM's) or made by the series' rule (F2's and F3's). */
  table: Table | null;
  /** A qualifying's groups, each its own table. */
  groups: { name: string; table: Table }[];
  /** Why its stored session holds no table ("called off", "no classification"). */
  none?: string;
}

/** A unit on the weekend's bar: run; still to run; ended with no results (`none`); not stored though a later one is;
 *  called off (`x`). */
export type UnitState = 'run' | 'up' | 'none' | 'unstored' | 'x';

const GROUP = /^(.+?) Group ([AB])$/;

/** A lap as seconds ("1:21.876" → 81.876); Infinity for anything else. */
function seconds(time: string): number {
  const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(time.trim());
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : Infinity;
}

/**
 * The order two qualifying groups make, by the rule of Formula 2's and Formula 3's sporting regulations for a
 * qualifying run in two groups: the faster group's fastest takes pole, and its drivers the odd places, the other
 * group's the even ones, each group in its own order; those a group did not place follow, unplaced.
 */
export function groupsGrid(a: Table, b: Table): Table {
  const placed = (t: Table) => t.rows.filter(r => /^\d+$/.test(r[0] ?? ''));
  const rest = (t: Table) => t.rows.filter(r => !/^\d+$/.test(r[0] ?? ''));
  const time = (t: Table) => seconds(placed(t)[0]?.[col(t.columns, 'Time')] ?? '');
  const [first, second] = time(a) <= time(b) ? [a, b] : [b, a];
  const name = (t: Table) => (t === a ? 'A' : 'B');
  const rows: string[][] = [];
  for (let i = 0; i < Math.max(placed(first).length, placed(second).length); i++) {
    for (const t of [first, second]) {
      const row = placed(t)[i];
      if (row) rows.push([String(rows.length + 1), ...row.slice(1), name(t)]);
    }
  }
  for (const t of [a, b]) for (const row of rest(t)) rows.push([...row, name(t)]);
  return { title: 'Qualifying', columns: [...a.columns, 'Group'], rows };
}

/** A table without a column that is empty on every row (motorsport.com's grid of DTM's two groups gives no time). */
function filled(t: Table): Table {
  const keep = t.columns.map((c, i) => ['Pos', 'Driver', 'Rider', 'Team'].includes(c) || t.rows.some(r => (r[i] ?? '') !== ''));
  return keep.every(Boolean) ? t : { ...t, columns: t.columns.filter((_, i) => keep[i]), rows: t.rows.map(r => r.filter((_, i) => keep[i])) };
}

/** The stored session a unit shows, by label: its table and its mark of none. */
function storedOf(w: Weekend, label: string): ResultSession | undefined {
  return [...(w.result?.sessions ?? []), ...(w.result?.others ?? [])].find(s => s.label === label);
}

/**
 * A weekend's units in running order: each timetable session under its own name, a group with its qualifying
 * ("Qualifying Group A" joins "Qualifying"), each paired with its stored session by the label bridge; a stored group
 * (DTM's "Qualifying 1 Group A") joins its qualifying. `left` names a stored session no unit shows, for the log.
 */
export function unitsOf(w: Weekend): { units: Unit[]; left: string[] } {
  const words = wordsOf(w.d.slug);
  const units: Unit[] = [];
  for (const e of w.sessions) {
    const page = GROUP.exec(e.session)?.[1] ?? e.session;
    const known = units.find(u => u.page === page);
    if (known) {
      known.entries.push(e);
      continue;
    }
    const race = words.races.find(r => r.page === page);
    units.push({ page, kind: race ? 'race' : sessionKind(page), entries: [e], label: race?.label ?? page, table: null, groups: [] });
  }
  const shown = new Set<string>();
  for (const u of units) {
    const s = storedOf(w, u.label);
    if (s) shown.add(s.label);
    if (s?.none && !s.tables.length) u.none = s.none;
    const own = s?.tables[0]?.rows.length ? filled(s.tables[0]) : null;
    const groups = ['A', 'B'].flatMap(g => {
      const x = storedOf(w, `${u.page} Group ${g}`);
      if (x) shown.add(x.label);
      const t = x?.tables[0];
      return t?.rows.length ? [{ name: `Group ${g}`, table: t }] : [];
    });
    u.groups = groups;
    u.table = own ?? (groups.length === 2 ? groupsGrid(groups[0].table, groups[1].table) : null);
  }
  const left = [...(w.result?.sessions ?? []), ...(w.result?.others ?? [])].filter(s => !shown.has(s.label)).map(s => `${s.label}: stored, not in the timetable`);
  return { units, left };
}

const runOf = (u: Unit): boolean => u.table !== null || u.groups.length > 0;

/** Each unit's state (the operator's "Greyed, as drawn", 24 Nov): run once stored; called off when its stored session
 *  or rounds.json says so; no results when its stored session or rounds.json's noResults says so; not stored once a
 *  later unit is run; else still to run. A page follows its data, never the hour it is written. */
export function unitStates(w: Weekend, units: readonly Unit[]): UnitState[] {
  const named = (list: readonly { session: string }[] | undefined, u: Unit) =>
    (list ?? []).some(c => sessionSlug(c.session) === sessionSlug(u.page) || u.entries.some(e => sessionSlug(c.session) === sessionSlug(e.session)));
  return units.map((u, i) => {
    if (runOf(u)) return 'run';
    if (u.none === 'called off' || named(w.r.calledOff, u)) return 'x';
    if (u.none !== undefined || named(w.r.noResults, u)) return 'none';
    return units.slice(i + 1).some(runOf) ? 'unstored' : 'up';
  });
}

/** A unit's table's first row's name, its code ("MIY") and its team. */
function leader(u: Unit): { name: string; team: string } | null {
  const t = u.table ?? u.groups[0]?.table;
  const row = t?.rows[0];
  if (!t || !row) return null;
  return { name: row[col(t.columns, 'Driver', 'Rider')] ?? '', team: row[col(t.columns, 'Team')] ?? '' };
}

/** The bar (O): the Overview, then each unit with its day at the track and its leader's code once run; greyed with
 *  "no results" or "not stored", struck through "called off", dashed with your time while still to run. */
function unitBar(w: Weekend, units: readonly Unit[], states: readonly UnitState[], current: Unit | null): string {
  const entries: BarEntry[] = [{ label: 'Overview', note: 'the weekend', href: w.path, current: current === null }];
  units.forEach((u, i) => {
    const e = u.entries[0];
    const day = e ? `${esc(trackWeekday(w, e.start))} · ` : '';
    const href = sessionPath(w, u.page);
    const state = states[i];
    const lead = leader(u);
    if (state === 'run') entries.push({ label: u.page, note: `${day}${esc(lead ? codeOf(w.d, lead.name) : '')}`.replace(/ · $/, ''), href, current: u === current });
    else if (state === 'up') entries.push({ label: u.page, note: e ? `${yours(e.start, 'wt')}<span class="pd-vh"> · still to run</span>` : 'still to run', href, current: u === current, state: 'up' });
    else entries.push({ label: u.page, note: `${day}${state === 'x' ? 'called off' : state === 'none' ? 'no results' : 'not stored'}`, state: state === 'x' ? 'x' : 'off' });
  });
  return bar(w, entries);
}

/** The line a greyed card and a session's page say for a unit without a classification (#1206's words). */
function noneLine(w: Weekend, u: Unit, state: UnitState): string {
  if (state === 'x') {
    const c = w.r.calledOff?.find(x => sessionSlug(x.session) === sessionSlug(u.page));
    return c ? c.note : 'Called off.';
  }
  if (state === 'none') {
    const why = w.r.noResults?.find(x => sessionSlug(x.session) === sessionSlug(u.page))?.note.replace(/[.\s]+$/, '') ?? '';
    return why ? `${why}: no results are available for this session.` : 'No results are available for this session.';
  }
  return 'No results are stored for this session.';
}

// ── The weekend's points (A1, A2): a column a race ───────────────────────────

export interface RoundPoints {
  /** The columns: each paying session in running order ("Sprint", "Feature"; DTM's "Q1", "R1", "Q2", "R2"). */
  cols: string[];
  rows: { name: string; team: string; pts: (number | null)[]; total: number }[];
}

/** Every driver who scored at a round, a column a paying session in its running order, by the weekend's total; equal
 *  totals by the points of the earliest session first (as drawn in O and X). */
export function roundPoints(d: SeriesData, r: ResultRound): RoundPoints {
  const words = wordsOf(d.slug);
  const paying = [
    ...r.sessions.map(s => ({ s, col: raceBy(d.slug, s.label)?.col ?? s.label })),
    ...(r.others ?? []).filter(s => (words.paying ?? []).some(p => p.label === s.label) && s.tables[0]?.rows.length).map(s => ({ s, col: words.paying?.find(p => p.label === s.label)?.col ?? s.label })),
  ];
  const start = (label: string): string => (d.calendar ?? []).find(e => e.round === r.round && e.session === (raceBy(d.slug, label)?.page ?? label))?.start ?? '';
  const ordered = paying.every(p => start(p.s.label)) ? [...paying].sort((a, b) => (start(a.s.label) < start(b.s.label) ? -1 : start(a.s.label) > start(b.s.label) ? 1 : 0)) : paying;
  const by = new Map<string, { name: string; team: string; pts: (number | null)[] }>();
  ordered.forEach(({ s }, i) => {
    const t = s.tables[0];
    if (!t) return;
    const name = col(t.columns, 'Driver', 'Rider');
    const team = col(t.columns, 'Team');
    const pts = col(t.columns, 'Pts', 'Points');
    if (name < 0 || pts < 0) return;
    for (const row of t.rows) {
      const p = Number.parseFloat(row[pts] ?? '');
      if (!(p > 0)) continue;
      const x = by.get(row[name]) ?? { name: row[name], team: team >= 0 ? (row[team] ?? '') : '', pts: ordered.map(() => null) };
      x.pts[i] = p;
      by.set(row[name], x);
    }
  });
  const rows = [...by.values()].map(x => ({ ...x, total: x.pts.reduce<number>((n, p) => n + (p ?? 0), 0) }));
  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    for (let i = 0; i < ordered.length; i++) {
      const diff = (b.pts[i] ?? 0) - (a.pts[i] ?? 0);
      if (diff) return diff;
    }
    return 0;
  });
  return { cols: ordered.map(p => p.col), rows };
}

/** The weekend's points as a table: Pos, the person, the team, a column a session, the total; "–" where none. */
function pointsTable(d: SeriesData, p: RoundPoints): string {
  if (!p.rows.length) return '';
  const person = wordsOf(d.slug).person;
  const head = `<tr><th class="p">Pos</th><th class="d">${person}</th><th class="tm">Team</th>${p.cols.map(c => `<th class="n">${esc(c)}</th>`).join('')}<th class="n tot">Total</th></tr>`;
  const body = p.rows
    .map(
      (x, i) =>
        `<tr><td class="p">${i + 1}</td><td class="d">${tick(d, x.team)}<b>${esc(codeOf(d, x.name))}</b><span>${esc(x.name)}</span></td><td class="tm">${esc(teamLabel(x.team))}</td>` +
        `${x.pts.map(v => `<td class="n">${v === null ? '–' : v}</td>`).join('')}<td class="n tot">${x.total}</td></tr>`,
    )
    .join('');
  return `<div class="pd-wk-scroll"><table class="pd-wk-tbl pd-wk-pts pd-fa-pts"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/** The Results page's fold (A2): the weekend's points, a column a race. */
export function multiRaceFold(d: SeriesData, r: ResultRound): string {
  return pointsTable(d, roundPoints(d, r));
}

// ── The Overview ─────────────────────────────────────────────────────────────

/** The strip's Final line once every race of the timetable is stored or called off (O, X, round 18 as drawn). */
function finalLine(w: Weekend, units: readonly Unit[], states: readonly UnitState[]): string | null {
  const races = units.map((u, i) => ({ u, s: states[i] })).filter(x => x.u.kind === 'race');
  if (!races.length || races.some(x => x.s !== 'run' && x.s !== 'x')) return null;
  const run = races.filter(x => x.s === 'run').map(x => x.u);
  const off = races.filter(x => x.s === 'x').map(x => x.u);
  const name = (u: Unit) => raceName(w.d, u.label);
  const who = (u: Unit) => leader(u)?.name ?? '';
  const notes = off.map(u => esc(w.r.calledOff?.find(c => sessionSlug(c.session) === sessionSlug(u.page))?.note ?? `${capital(the(name(u)))} was called off.`));
  if (!run.length) return notes.join(' ');
  const last = run[run.length - 1];
  if (off.length) return `${notes.join(' ')} <b>${esc(who(last))}</b> won ${esc(the(name(last)))}.`;
  const earlier = run.slice(0, -1).reverse();
  const lead = `<b>${esc(who(last))}</b> won ${esc(the(name(last)))}`;
  if (!earlier.length) return lead;
  if (earlier.length === 1) {
    const [e] = earlier;
    return who(e) === who(last) ? `${lead}, and ${esc(the(name(e)))} too` : `${lead}, and ${esc(the(name(e)))} went to ${esc(who(e))}`;
  }
  const same = earlier.filter(e => who(e) === who(last));
  const others = earlier.filter(e => who(e) !== who(last));
  const head = same.length ? `<b>${esc(who(last))}</b> won ${esc(andList([the(name(last)), ...same.map(e => the(name(e)))]))}` : lead;
  return others.length ? `${head}; ${others.map(e => `${esc(who(e))} ${esc(the(name(e)))}`).join(', ')}` : head;
}

/** The results table with tabs (A1): the weekend's points first (Both races, or All three races), then a tab a race
 *  with its top ten and the way to every driver on its page; a weekend whose other races were called off, its one race
 *  without tabs. */
function resultsBody(w: Weekend, units: readonly Unit[], states: readonly UnitState[]): { hint: string; body: string } {
  const races = units.filter((u, i) => u.kind === 'race' && states[i] === 'run');
  const all = (u: Unit) => `<p class="pd-wk-links"><a class="pd-wk-link" href="${sessionPath(w, u.page)}">All ${u.table?.rows.length ?? 0} on the race's page</a></p>`;
  const one = (u: Unit) => (u.table ? `${classTable(w, u.table, 10)}${all(u)}` : '');
  if (races.length === 1) {
    const [u] = races;
    return { hint: `${esc(capital(the(raceName(w.d, u.label))))}, the weekend's only race`, body: one(u) };
  }
  const count = races.length;
  const first = count === 2 ? 'Both races' : `All ${inWords(count)} races`;
  const points = w.result ? pointsTable(w.d, roundPoints(w.d, { ...w.result, sessions: w.result.sessions.filter(s => races.some(u => u.label === s.label)) })) : '';
  const panels: TabPanel[] = [{ tab: [first], body: points }, ...races.map(u => ({ tab: [raceBy(w.d.slug, u.label)?.tab ?? u.page], body: one(u) }))];
  return { hint: `${count === 2 ? 'Both races' : `All ${inWords(count)} races`} together, or one race at a time`, body: resultTabs(panels) };
}

/** A unit's card (default 9): three rows in practice and warm-up, ten in qualifying, Superpole and a race; greyed, with
 *  its line, without a classification. */
function unitCard(w: Weekend, u: Unit, state: UnitState, used: Used): string {
  const e = u.entries[0];
  if (!e) return '';
  const entry = { ...e, session: u.page };
  if (state === 'run') return sessionCard(w, entry, used, { table: u.table ?? u.groups[0]?.table ?? null, rows: u.kind === 'practice' ? 3 : 10 });
  return sessionCard(w, entry, used, { table: null, page: false, empty: noneLine(w, u, state), rows: u.kind === 'practice' ? 3 : 10 });
}

/** The sessions still to run in the order they run, by the track's day: your time and the track's, the forecast, a
 *  way to each one's page (a group's to its qualifying's). */
function aheadRows(w: Weekend, units: readonly Unit[], used: Used): string {
  const days = new Map<string, string[]>();
  const parts = units.flatMap(u => u.entries.map(e => ({ u, e }))).sort((a, b) => (a.e.start < b.e.start ? -1 : a.e.start > b.e.start ? 1 : 0));
  for (const { u, e } of parts) {
    const day = trackDay(w, e.start);
    days.set(day, [
      ...(days.get(day) ?? []),
      `<a class="pd-wk-row" href="${sessionPath(w, u.page)}"><span class="pd-wk-when"><b>${yours(e.start, 'wt')}</b><small>Track ${trackTime(w, e.start)}</small></span>` +
        `<span class="pd-wk-name">${esc(e.session)}</span>${forecast(w, e.start, used) || '<span class="pd-wk-wx"></span>'}<span class="pd-wk-go"><span class="t">Its page</span> →</span></a>`,
    ]);
  }
  return [...days].map(([day, rows]) => `<h3 class="pd-wk-day">${esc(day)}</h3><div class="pd-wk-rows">${rows.join('')}</div>`).join('');
}

/** Baku's and Madrid's weekends (X): two qualifying sessions and two Feature Races. */
const oddWeekend = (units: readonly Unit[]): boolean => units.filter(u => /^qualifying \d$/i.test(u.page)).length === 2 && units.filter(u => /^feature race \d$/i.test(u.page)).length === 2;

/** The band's tag (default 6). */
function tags(units: readonly Unit[]): string[] {
  if (oddWeekend(units)) return ['Two qualifying sessions and two Feature Races'];
  return units.some(u => u.groups.length > 0 || u.entries.some(e => GROUP.test(e.session))) ? ['Qualifying in two groups'] : [];
}

/** A round's Overview (L, O, X): after its races, the results table with tabs and the earlier sessions' cards; before
 *  and during, the sessions done so far and those still to come, as Formula 1's; beside them the championship, the
 *  track and the next round; under them the circuit's outline, small. */
function overviewPage(w: Weekend, units: readonly Unit[], states: readonly UnitState[]): Page {
  const used = nothingUsed();
  const final = finalLine(w, units, states);
  const after = final !== null;
  const parts: string[] = [];
  const done = units.filter((u, i) => states[i] !== 'up' && !(after && u.kind === 'race'));
  const ahead = units.filter((_, i) => states[i] === 'up');
  if (after) {
    const { hint, body } = resultsBody(w, units, states);
    parts.push(section('Results', hint, body));
    if (done.length) parts.push(section('Earlier in the weekend', 'Each session’s leading results, in the order they ran', `<div class="pd-sc-grid">${done.map(u => unitCard(w, u, states[units.indexOf(u)], used)).join('')}</div>`));
  } else {
    if (done.length) parts.push(section('Done so far', 'Each finished session’s leading results', `<div class="pd-sc-grid">${done.map(u => unitCard(w, u, states[units.indexOf(u)], used)).join('')}</div>`));
    if (ahead.length) {
      const note =
        '<p class="pd-wk-note">A session’s forecast is for its start while it is within ten days: the rain over that hour, or over six hours when it is further off. Each session’s results join this page after it ends.</p>';
      parts.push(section(done.length ? 'Still to come' : 'The weekend', 'The track’s days: your time, the track’s underneath', aheadRows(w, ahead, used) + note));
    }
    if (!units.length) parts.push(section('The weekend', '', '<p class="pd-wk-empty">The weekend’s session times are not published yet; they appear here as soon as they are.</p>'));
  }
  const toRun = ahead.flatMap(u => u.entries).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const facts: [string, string][] = [['Format', wordsOf(w.d.slug).format(oddWeekend(units))]];
  const circuit = w.r.outline ? `<section class="pd-fa-cm"><h2>The circuit</h2>${w.r.venue ? `<p class="pd-wk-hint">${esc(w.r.venue)}</p>` : ''}${outline(w.r.outline, ' pd-fa-ol')}</section>` : '';
  const body =
    `<div class="pd-wkp pd-s-${esc(w.d.slug)}">${weekendBand(w, { tags: tags(units) })}${strip(toRun.length ? { ...w, sessions: toRun } : w, final)}${unitBar(w, units, states, null)}` +
    `<div class="pd-wk-main"><div class="pd-wk-col">${parts.join('')}</div>${aside(w, after, { facts })}</div>${circuit}${credit(used)}</div>`;
  return { path: w.path, title: `${w.r.name} ${w.season}`, body: htmlBlock(body), template: 'page-wide' };
}

// ── A session's page ─────────────────────────────────────────────────────────

/** A unit's band: one timed session, the shared one under the unit's name; a qualifying in two groups, each group's
 *  start at the track, then the first in the reader's time. */
function unitBand(w: Weekend, u: Unit): string {
  const [first] = u.entries;
  if (!first) return '';
  if (u.entries.length === 1) return sessionBand(w, { ...first, session: u.page });
  const parts = u.entries.map(e => `${esc(GROUP.exec(e.session)?.[2] ? `Group ${GROUP.exec(e.session)?.[2]}` : e.session)} ${trackTime(w, e.start)}`);
  return (
    `<section class="pd-ss-band"><div class="pd-ss-band-in"><p class="pd-wk-crumb"><a href="${seriesPath(w.d.slug)}">${esc(w.d.name)}</a> › <a href="${seasonPath(w.d.slug, w.season)}">${w.season}</a> › ` +
    `<a href="${w.path}">Round ${w.r.round} · ${esc(w.r.name)}</a></p><h1>${esc(u.page)}</h1><p class="pd-ss-sub">${esc(trackDay(w, first.start))} · ${parts.join(' · ')} at the track, from ${yours(first.start, 'wt')} your time</p></div></section>`
  );
}

/** A unit's own page (L): its classification, every driver or rider, time and points; a qualifying in two groups, the
 *  order they make, then each group (A3); before it runs, its forecast. */
function unitPage(w: Weekend, units: readonly Unit[], states: readonly UnitState[], u: Unit): Page {
  const used = nothingUsed();
  const e = u.entries[0];
  const parts: string[] = [];
  if (u.groups.length) {
    const grid = u.table ? `<h3 class="pd-fa-part">The order the two groups make <small>All ${u.table.rows.length}</small></h3>${classTable(w, u.table)}` : '';
    const groups = u.groups.map(g => `<h3 class="pd-fa-part">${esc(g.name)} <small>All ${g.table.rows.length}</small></h3>${classTable(w, g.table)}`).join('');
    parts.push(section('Classification', u.table ? 'The order the two groups make, then each group’s times' : 'Each group’s times', grid + groups));
  } else if (u.table) {
    parts.push(section('Classification', `All ${u.table.rows.length}, as classified`, classTable(w, u.table)));
  } else {
    parts.push(section('Classification', '', '<p class="pd-wk-empty">Not run yet. Its results join this page when it ends.</p>'));
  }
  const side = !runOf(u) && e ? forecastBox(w, e, used) : '';
  const body =
    `<div class="pd-wkp pd-s-${esc(w.d.slug)}">${unitBand(w, u)}${unitBar(w, units, states, u)}` +
    `<div class="pd-wk-main"><div class="pd-wk-col">${parts.join('')}</div><aside class="pd-wk-aside">${side}${nextRound(w)}</aside></div>${credit(used)}</div>`;
  return { path: sessionPath(w, u.page), title: `${w.r.name} ${w.season}: ${u.page}`, body: htmlBlock(body), template: 'page-wide' };
}

// ── Standings: points left, wins, the head ───────────────────────────────────

/** A stored session of the round with a classification, by its label. */
const storedIn = (r: ResultRound | undefined, label: string): boolean =>
  [...(r?.sessions ?? []), ...(r?.others ?? [])].some(s => (s.label === label || s.label.startsWith(`${label} Group `)) && (s.tables[0]?.rows.length ?? 0) > 0);

/**
 * The points one driver can still score (the operator's "All five", 12 Nov: every point counted), by the series'
 * scales: each timetable session of a round still to run carries its items (F2's Feature Race its 25 and its fastest
 * lap's 1, its qualifying the Feature pole's 2). A session is run once it, or a later one of its round, is stored, or
 * once it is called off; a round's sessions without times count as well, and a round without a timetable counts the
 * series' standard weekend.
 */
export function multiRaceLeft(d: SeriesData): { points: number; scales: string[] } {
  const words = wordsOf(d.slug);
  const count = words.scales.map(() => 0);
  for (const r of d.rounds ?? []) {
    const stored = (d.results ?? []).find(x => x.round === r.round);
    const timed = [...new Set((d.calendar ?? []).filter(e => e.round === r.round).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)).map(e => GROUP.exec(e.session)?.[1] ?? e.session))];
    const names = timed.length || stored ? timed : words.weekend;
    const labelOf = (name: string) => raceBy(d.slug, name)?.label ?? name;
    const off = (name: string) => (r.calledOff ?? []).some(c => sessionSlug(c.session) === sessionSlug(name)) || [...(stored?.sessions ?? []), ...(stored?.others ?? [])].some(s => s.label === labelOf(name) && s.none === 'called off');
    names.forEach((name, i) => {
      if (off(name) || names.slice(i).some(n => storedIn(stored, labelOf(n)))) return;
      words.scales.forEach((s, k) => {
        if (s.on.test(name)) count[k]++;
      });
    });
  }
  const points = words.scales.reduce((n, s, k) => n + s.points * count[k], 0);
  return { points, scales: words.scales.flatMap((s, k) => (count[k] ? [`${inWords(count[k])} ${count[k] === 1 ? s.one : s.many} at ${s.points}`] : [])) };
}

/** Race wins by a driver or a team: every race stored but a sprint, Formula 1's rule; a round called off wins none. */
export function multiRaceWins(d: SeriesData): WinCount {
  const drivers = new Map<string, number>();
  const teams = new Map<string, number>();
  const fold = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const r of d.results ?? []) {
    for (const s of r.sessions) {
      const t = s.tables[0];
      if (/^sprint/i.test(s.label) || !t?.rows[0]) continue;
      const name = t.rows[0][col(t.columns, 'Driver', 'Rider')] ?? '';
      const team = t.rows[0][col(t.columns, 'Team')] ?? '';
      drivers.set(name, (drivers.get(name) ?? 0) + 1);
      if (team) teams.set(fold(team), (teams.get(fold(team)) ?? 0) + 1);
    }
  }
  return { driver: name => drivers.get(name) ?? 0, team: team => teams.get(fold(team)) ?? 0 };
}

const AT_DAY = (tz: string | undefined, iso: string, part: 'day' | 'weekday'): string => {
  const o: Intl.DateTimeFormatOptions = part === 'day' ? { day: 'numeric', month: 'long' } : { weekday: 'long' };
  try {
    return new Intl.DateTimeFormat('en-GB', { ...o, timeZone: tz || 'UTC' }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('en-GB', { ...o, timeZone: 'UTC' }).format(new Date(iso));
  }
};

/** The Standings head as of the table, in Formula 1's words: after a round run ("Standings after round 21"), or after
 *  the round's latest race stored ("Standings after the round 21 Sprint"), and when the next points are scored. */
export function multiRaceHead(d: SeriesData): { title: string; line: string } {
  const wins = raceWins(d);
  const stored = (d.results ?? []).filter(r => r.round !== null && r.sessions.some(s => (s.tables[0]?.rows.length ?? 0) > 0)).sort((a, b) => (b.round ?? 0) - (a.round ?? 0))[0];
  if (!stored || stored.round === null) return { title: 'Standings', line: 'No race has run yet this season.' };
  const n = stored.round;
  const cr = d.rounds?.find(r => r.round === n);
  const name = cr?.name ?? stored.name;
  const timed = (round: number, page: string) => (d.calendar ?? []).find(e => e.round === round && !e.dateOnly && e.session === page);
  let title: string;
  let line: string;
  if (wins.has(n)) {
    title = `Standings after round ${n}`;
    const day = wins.get(n)?.date ?? cr?.endDate ?? '';
    line = [esc(name), /^\d{4}-\d{2}-\d{2}$/.test(day) ? AT_DAY('UTC', `${day}T12:00:00Z`, 'day') : ''].filter(Boolean).join(', ');
  } else {
    const last = [...stored.sessions].reverse().find(s => (s.tables[0]?.rows.length ?? 0) > 0);
    const race = raceName(d, last?.label ?? '');
    const at = timed(n, raceBy(d.slug, last?.label ?? '')?.page ?? '');
    title = `Standings after the round ${n} ${race}`;
    line = [`${esc(name)} ${esc(race)}`, at ? AT_DAY(cr?.tz, at.start, 'day') : ''].filter(Boolean).join(', ');
  }
  const next = (d.rounds ?? []).find(r => !wins.has(r.round));
  if (next) {
    const mine = (d.results ?? []).find(r => r.round === next.round);
    const scoring = (d.calendar ?? [])
      .filter(e => e.round === next.round && !e.dateOnly && wordsOf(d.slug).scales.some(s => s.points > 2 && s.on.test(e.session)))
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
      .find(e => !storedIn(mine, raceBy(d.slug, e.session)?.label ?? e.session));
    const main = raceBy(d.slug, scoring?.session ?? '') === wordsOf(d.slug).races.find(r => r.label === 'Grand Prix');
    const day = scoring ? AT_DAY(next.tz, scoring.start, 'weekday') : '';
    if (scoring && day) line += `<span class="pd-st-next"> · next update after ${day}'s ${esc(next.name)}${main ? '' : ` ${esc(scoring.session)}`}</span>`;
  }
  return { title, line };
}

// ── The kit ──────────────────────────────────────────────────────────────────

/** What family A's kit needs from the publisher beyond SeriesData. */
export interface MultiRaceOptions {
  /** The publisher's log: a weekend's stored sessions that pair with no page, those not stored, the grids made. */
  log?: (line: string) => void;
}

/** Family A's weekend pages: its season, each round's Overview and a page for each session run or still to run; a
 *  session greyed (no results, not stored, called off) has none. */
function multiRacePages(d: SeriesData, o: MultiRaceOptions): Page[] {
  if (!built(d, 'weekends') || !d.season || !d.rounds?.length) return [];
  const season = d.season;
  const pages: Page[] = [seasonPage(d, season, { raceName: label => raceName(d, label) })];
  for (const r of d.rounds) {
    const w = weekendOf(d, season, r);
    const { units, left } = unitsOf(w);
    const states = unitStates(w, units);
    const lines = [...left, ...units.flatMap((u, i) => (states[i] === 'unstored' ? [`${u.page}: not stored`] : u.groups.length === 2 && !storedOf(w, u.label)?.tables.length ? [`${u.page}: the order made from its two groups`] : []))];
    for (const line of lines) o.log?.(`${d.slug} R${r.round} ${line}`);
    pages.push(overviewPage(w, units, states), ...units.flatMap((u, i) => (states[i] === 'run' || states[i] === 'up' ? [unitPage(w, units, states, u)] : [])));
  }
  return pages;
}

/** Family A's kit (O33's registry, scripts/wp-publish.mts): its weekends, its Results fold, its race names, and
 *  Formula 1's Standings, Champions and Overview block with each series' words. */
export function multiRaceKit(o: MultiRaceOptions = {}): FamilyKit {
  return {
    weekendPages: d => multiRacePages(d, o),
    resultsFold: multiRaceFold,
    raceName,
    overviewStandings: d => standingsBlock(d, { person: wordsOf(d.slug).person, wins: multiRaceWins }),
    standingsPage: d => seriesStandings(d, { person: wordsOf(d.slug).person, wins: multiRaceWins, left: multiRaceLeft, head: multiRaceHead, tables: true, title: { teams: wordsOf(d.slug).teams } }),
    championsPage: d => seriesChampions(d, { ...wordsOf(d.slug).champions, left: x => multiRaceLeft(x).points }),
  };
}

// ── The roster's spellings (O33's PR 3, the publisher's line beside family C's) ──

/** A team of drivers.json as the publisher reads it: its colour, its drivers, and `also`, the other names a result
 *  writes for it (a team renamed mid-season: MotoGP's "Trackhouse MotoGP Team" before it became "SuperFile Trackhouse
 *  MotoGP Team"). */
export interface RosterTeam {
  name: string;
  colour?: string;
  also?: readonly string[];
  /** A driver's `also`: the names a feed writes for them (WorldSBK's "Thomas Bridewell" for Tommy Bridewell). */
  drivers: { name: string; code?: string; number?: number; also?: readonly string[] }[];
}

/** A name with its accents, case and the letters NFD keeps whole (ı, ł, ø) folded, so "Rafael Camara" finds "Rafael
 *  Câmara" and "Toprak Razgatlioglu" "Toprak Razgatlıoğlu"; dashes as one. */
export function foldName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ł/g, 'l')
    .replace(/ø/g, 'o')
    .replace(/đ/g, 'd')
    .replace(/ß/g, 'ss')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Family A's data as its pages read it (default 17): every driver's or rider's name in the results and the standings
 * spelled as drivers.json writes it (the feeds drop the accents: "Marc Marquez"), or as a name a driver lists under
 * `also`, a name the roster does not hold kept as written; and the teams with, for each team name a result or the
 * standings write that the roster names otherwise
 * (its name folded, or listed under `also`), an entry under that name with the roster team's colour and drivers, so the
 * shared ticks, tiles and rows find its colour. `grey` names each team name that finds none, for the log.
 */
export function spelledAsRoster(
  data: Pick<SeriesData, 'results' | 'standings'>,
  roster: readonly RosterTeam[],
): { results: ResultRound[] | null; standings: Table[] | null; teams: SeriesTeam[]; grey: string[] } {
  const people = new Map<string, string>();
  for (const t of roster) for (const x of t.drivers) for (const n of [x.name, ...(x.also ?? [])]) people.set(foldName(n), x.name);
  const spell = (name: string): string => people.get(foldName(name)) ?? name;
  const respell = (t: Table): Table => {
    const at = col(t.columns, 'Driver', 'Rider');
    return at < 0 ? t : { ...t, rows: t.rows.map(row => row.map((v, i) => (i === at ? spell(v) : v))) };
  };
  const results = data.results?.map(r => ({ ...r, sessions: r.sessions.map(s => ({ ...s, tables: s.tables.map(respell) })), ...(r.others ? { others: r.others.map(s => ({ ...s, tables: s.tables.map(respell) })) } : {}) })) ?? null;
  const standings = data.standings?.map(respell) ?? null;
  const teams: SeriesTeam[] = roster.map(t => ({ name: t.name, ...(t.colour ? { colour: t.colour } : {}), drivers: t.drivers }));
  const exact = new Set(teams.map(t => t.name.toLowerCase()));
  const grey: string[] = [];
  const written = new Set<string>();
  const tables = [...(results ?? []).flatMap(r => [...r.sessions, ...(r.others ?? [])].flatMap(s => s.tables)), ...(standings ?? [])];
  for (const t of tables) {
    const at = col(t.columns, 'Team');
    for (const row of at < 0 ? [] : t.rows) if (row[at]) written.add(row[at]);
  }
  for (const name of written) {
    if (exact.has(name.toLowerCase())) continue;
    const key = foldName(name);
    const own = roster.find(t => foldName(t.name) === key || (t.also ?? []).some(a => foldName(a) === key));
    if (!own) {
      grey.push(name);
      continue;
    }
    teams.push({ name, ...(own.colour ? { colour: own.colour } : {}), drivers: own.drivers });
    exact.add(name.toLowerCase());
  }
  return { results, standings, teams, grey: grey.sort() };
}
