// Family A (O33): Formula 2, Formula 3, MotoGP, WorldSBK and DTM, two or three races a weekend (the Multi-Race Weekend
// Drafts, answered 25 Oct). Task 2.b's PR 2 keeps each round's practice and qualifying beside its races; its pages
// follow in PR 3. Pure: the publisher's family A block (scripts/wp-publish.mts) fetches, these turn answers into tables.

import * as cheerio from 'cheerio';
import type { FomResultRow } from '../results/fom-api';
import type { SessionClassificationEntry } from '../results/openf1';
import type { CalendarEntry, ResultRound, ResultSession, Table } from './render';

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
 *  (ResultSession.parts), and for a restarted race the restart's own result, which the fetcher never reads. So a
 *  run its API does not answer keeps a restarted race as it was stored. Only the season's own stored rounds count. */
export function wsbkCarried(fresh: readonly ResultRound[], stored: readonly ResultRound[] | null, season: number): ResultRound[] {
  const own = (stored ?? []).filter(r => r.date?.slice(0, 4) === String(season));
  return fresh.map(r => ({
    ...r,
    sessions: r.sessions.map(s => {
      const was = own.find(x => x.round === r.round)?.sessions.find(x => x.label === s.label);
      return was?.parts === undefined ? s : was.parts > 1 ? { ...s, tables: was.tables, parts: was.parts } : { ...s, parts: was.parts };
    }),
  }));
}

/** The rounds whose session list a run reads, the newest first: a round with a race not yet known to be one part or
 *  two, a round still being run (a restart is listed after its race's first part), and a round with a restarted
 *  race, whose result is read again each run. A finished round of races run once is never asked about again. */
export function wsbkDue(rounds: readonly ResultRound[], endOf: (round: number | null) => string | null | undefined, now: Date): ResultRound[] {
  const race = new Set(WSBK_RACES.map(([, label]) => label));
  return rounds.filter(r => r.round !== null && r.sessions.some(s => race.has(s.label) && (s.parts === undefined || s.parts > 1 || !roundOver(endOf(r.round) ?? r.date, now)))).reverse();
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

const formatRace = (ms: number): string => {
  const s = ms / 1000;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = (s - h * 3600 - m * 60).toFixed(3).padStart(6, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
};
const formatGap = (ms: number): string => (ms < 60_000 ? `${(ms / 1000).toFixed(3)}s` : `${Math.floor(ms / 60_000)}:${((ms % 60_000) / 1000).toFixed(3).padStart(6, '0')}`);

/** A WorldSBK race's results answer as the stored race table writes it (lib/results/wsbk.ts's own format: the winner's
 *  time, the others' gaps, a status where there is none), its points by wsbkPoints. */
export function wsbkRaceTable(title: string, env: unknown, superpole: boolean): Table | null {
  type Item = { id?: string; type?: string; attributes?: Record<string, unknown>; relationships?: Record<string, { data?: { id?: string } }> };
  const e = env as { data?: Item[]; included?: Item[] } | null;
  const inc = new Map((e?.included ?? []).map(x => [`${x.type}|${x.id}`, x.attributes ?? {}]));
  const of = (kinds: string[], id: string | undefined) => kinds.map(k => inc.get(`${k}|${id}`)).find(Boolean);
  const rows = (e?.data ?? [])
    .filter(x => x.type === 'results' && typeof x.attributes?.position === 'number')
    .map(x => {
      const rider = of(['rider', 'riders'], x.relationships?.rider?.data?.id);
      const team = of(['team', 'teams'], x.relationships?.team?.data?.id);
      const ms = typeof x.attributes?.time === 'number' && x.attributes.time > 0 ? x.attributes.time : null;
      return { pos: x.attributes?.position as number, name: `${rider?.name ?? ''} ${rider?.surname ?? ''}`.trim(), team: String(team?.name ?? ''), status: String(x.attributes?.status ?? ''), ms };
    })
    .filter(x => x.name !== '' && x.pos >= 1 && x.pos < 90)
    .sort((a, b) => a.pos - b.pos);
  if (rows.length < 8) return null;
  const win = rows.find(x => x.pos === 1)?.ms ?? null;
  const time = (x: (typeof rows)[number]) => (x.ms === null ? x.status : x.pos === 1 ? formatRace(x.ms) : win !== null && x.ms > win ? `+${formatGap(x.ms - win)}` : x.status);
  return { title, columns: ['Pos', 'Rider', 'Team', 'Time', 'Pts'], rows: rows.map(x => [String(x.pos), x.name, x.team, time(x), String(wsbkPoints(x.pos, x.status, superpole))]) };
}
