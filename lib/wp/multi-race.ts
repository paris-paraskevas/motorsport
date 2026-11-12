// Family A (O33): Formula 2, Formula 3, MotoGP, WorldSBK and DTM, two or three races a weekend (the Multi-Race Weekend
// Drafts, answered 25 Oct). Task 2.b's PR 2 keeps each round's practice and qualifying beside its races; its pages
// follow in PR 3. Pure: the publisher's family A block (scripts/wp-publish.mts) fetches, these turn answers into tables.

import * as cheerio from 'cheerio';
import type { FomResultRow } from '../results/fom-api';
import type { SessionClassificationEntry } from '../results/openf1';
import type { CalendarEntry, ResultRound, Table } from './render';

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
