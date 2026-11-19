// Family C (slot O34): FIA WEC, IMSA and GT World Challenge. First its data: every session of a round, each car's crew
// from its own race and every name spelled as the series' drivers.json spells it (the operator's answers C2 and All 3 of
// 25 Oct, and the correction that day: never a car's crew from drivers.json); the sources' pages and files in, the stored
// shapes out, which the publisher (scripts/wp-publish.mts, family C's block) fetches and keeps. Then its pages (the kit,
// at the end): the season, each round's Overview and a page a session, from the stored shapes. Pure, as render.ts.
//
// Every table keeps C2's columns: Pos, No. (the car number without its "#"), Crew (the drivers joined by ", "), Team,
// then the session's own: a race's Laps, Time (its total) and Gap; a timed session's best lap as Time, then Laps and Gap;
// GT World's Cup after the team, then its columns as it writes them, a race's best lap as "Best lap" (GT World gives no
// total time). The Crew column also tells a round stored in this shape from one stored before it (inShape).

import * as cheerio from 'cheerio';
import type { SeriesRoundEntry } from '@/lib/types';
import { built, escapeHtml, sessionKind, type CalendarEntry, type FamilyKit, type Page, type ResultRound, type ResultSession, type SeriesData, type SeriesTeam, type Table } from './render';
import { col, htmlBlock, teamLabel, tick } from './series';
import {
  aside,
  bar,
  credit,
  forecast,
  forecastBox,
  longDates,
  nextRound,
  nothingUsed,
  resultTabs,
  seasonPage,
  section,
  sessionBand,
  sessionPath,
  strip,
  tabAnchor,
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

export const CREW = 'Crew';
const RACE_COLUMNS = ['Pos', 'No.', CREW, 'Team', 'Laps', 'Time', 'Gap'];
const TIMED_COLUMNS = ['Pos', 'No.', CREW, 'Team', 'Time', 'Laps', 'Gap'];

const clean = (s: string | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** A place as a classification writes it: a number, or the mark of a car it lists unclassified (GT World's "NC" and
 *  "DSQ" under the classified places); null for anything else. */
const place = (s: string): string | null => (/^\d+$/.test(s) && Number(s) >= 1 ? String(Number(s)) : /^(NC|DNF|DNS|DSQ|DQ|EX|RET)$/i.test(s) ? s.toUpperCase() : null);

/** The classified places in order, then the cars listed unclassified in the order listed. */
const byPlace = (a: string[], b: string[]): number => {
  const [x, y] = [a[0], b[0]].map(p => (/^\d+$/.test(p) ? Number(p) : Number.MAX_SAFE_INTEGER));
  return x - y;
};

// ── Names ────────────────────────────────────────────────────────────────────

/** A name's words for comparing two spellings: case and accents dropped, the letters NFD keeps whole (ø, æ, œ, ß, ł, đ)
 *  written plainly, the words sorted, so "Gounon Jules" and "Jules Gounon" compare equal and "Sørensen" meets "Sorensen". */
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
export function nameSpeller(spellings: readonly string[]): (name: string) => string | null {
  const byKey = new Map<string, string | null>();
  for (const s of spellings) {
    const key = nameKey(s);
    if (!key) continue;
    byKey.set(key, byKey.has(key) && byKey.get(key) !== s ? null : s);
  }
  return name => byKey.get(nameKey(name)) ?? null;
}

/** A name written entirely in capitals, in ordinary case ("JOSÉ MARÍA LÓPEZ" → "José María López"); any other unchanged. */
export function tidyCaps(name: string): string {
  if (/\p{Ll}/u.test(name)) return name;
  return name.toLowerCase().replace(/(^|[\s'-])(\p{Ll})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** A season's lines of team-names.json as a lookup by the name's words (nameKey), so a team a kept round already
 *  carries in its new spelling ("VISTA AF Corse") still finds the line written for the feed's ("VISTA AF CORSE") when
 *  that line's spelling changes; null for a team with no line. */
export function teamSpeller(lines: Readonly<Record<string, string>>): (name: string) => string | null {
  const byKey = new Map(Object.entries(lines).map(([from, to]) => [nameKey(from), to]));
  return name => byKey.get(nameKey(name)) ?? null;
}

/** A crew as the Crew column holds it: each name spelled by drivers.json when it matches, else as written, ", " apart. */
export function crewCell(names: readonly string[], spell: (name: string) => string | null): string {
  return names
    .map(clean)
    .filter(Boolean)
    .map(n => spell(n) ?? tidyCaps(n))
    .join(', ');
}

/** Every table of this shape spelled again, a run at a time, so an edit to drivers.json or team-names.json reaches the
 *  rounds already kept: each crew's names as drivers.json spells them, each team as team-names.json writes it. A name
 *  either file does not know stays as stored. */
export function respell(rounds: readonly ResultRound[], spell: (name: string) => string | null, team: (name: string) => string): ResultRound[] {
  const again = (s: ResultSession): ResultSession => ({
    ...s,
    tables: s.tables.map(t => {
      const crew = t.columns.indexOf(CREW);
      const club = t.columns.indexOf('Team');
      if (crew < 0) return t;
      const cell = (row: string[], i: number): string =>
        i === crew && row[i] ? row[i].split(', ').map(n => spell(n) ?? n).join(', ') : i === club ? team(row[i]) : row[i];
      return { ...t, rows: t.rows.map(row => row.map((_, i) => cell(row, i))) };
    }),
  });
  return rounds.map(r => ({ ...r, sessions: r.sessions.map(again), ...(r.others ? { others: r.others.map(again) } : {}) }));
}

// ── IMSA: Al Kamel's class results ───────────────────────────────────────────

export const IMSA_CLASSES = ['GTP', 'LMP2', 'GTD Pro', 'GTD'] as const;
const ALKAMEL_CLASS: Record<string, (typeof IMSA_CLASSES)[number]> = { GTP: 'GTP', LMP2: 'LMP2', GTDPRO: 'GTD Pro', GTD: 'GTD' };

interface AlkamelEntry {
  status?: string;
  position?: number;
  number?: string;
  team?: string;
  laps?: string;
  time?: string;
  elapsed_time?: string;
  gap_first?: string;
  drivers?: { firstname?: string; surname?: string }[];
}

/**
 * One IMSA session from Al Kamel's "05_Results by Class_<session>_….JSON", a table a class in IMSA's order (GTP, LMP2,
 * GTD Pro, GTD). A race's row reads its laps, its elapsed time and its gap to the class leader; a practice's or a
 * qualifying's its best lap, its laps and its gap. A car that did not finish classified shows its status where its gap
 * would be ("Not Started"); the class leader shows none. Null when the file holds no class IMSA races.
 */
export function alkamelSession(raw: string, label: string, race: boolean, spell: (name: string) => string | null, team: (name: string) => string): ResultSession | null {
  let data: { classifications?: { name?: string; classification?: AlkamelEntry[] }[] };
  try {
    data = JSON.parse(raw.replace(/^\uFEFF/, '')) as typeof data;
  } catch {
    return null;
  }
  const tables: Table[] = [];
  for (const cls of data.classifications ?? []) {
    const title = ALKAMEL_CLASS[clean(cls.name).toUpperCase()];
    if (!title) continue;
    const rows = (cls.classification ?? [])
      .filter(e => typeof e.position === 'number' && e.position >= 1)
      .sort((a, b) => (a.position as number) - (b.position as number))
      .map(e => {
        const crew = crewCell((e.drivers ?? []).map(d => `${clean(d.firstname)} ${clean(d.surname)}`), spell);
        const status = clean(e.status);
        // A car not classified shows its status, never the gap Al Kamel also gives it (Sebring's #79 "Not Started", not "338 Laps").
        const gap = status && !/^classified$/i.test(status) ? status : clean(e.gap_first);
        const head = [String(e.position), clean(e.number), crew, team(clean(e.team))];
        return race ? [...head, clean(e.laps), clean(e.elapsed_time), gap] : [...head, clean(e.time), clean(e.laps), gap];
      });
    if (rows.length) tables.push({ title, columns: race ? RACE_COLUMNS : TIMED_COLUMNS, rows });
  }
  tables.sort((a, b) => IMSA_CLASSES.indexOf(a.title as (typeof IMSA_CLASSES)[number]) - IMSA_CLASSES.indexOf(b.title as (typeof IMSA_CLASSES)[number]));
  return tables.length ? { label, tables } : null;
}

// ── WEC: fiawec.com's results component, car pages and driver pages ────────

export const WEC_CLASSES = ['Hypercar', 'LMP2', 'LMGT3'] as const;
export type WecClass = (typeof WEC_CLASSES)[number];
const WEC_CLASS: Record<string, WecClass> = { HYPERCAR: 'Hypercar', LMP2: 'LMP2', LMGT3: 'LMGT3' };

/** "FREE PRACTICE 3" → "Free Practice 3", "WARM-UP" → "Warm-up": fiawec.com writes its sessions in capitals. */
const sessionCase = (s: string): string => s.toLowerCase().replace(/(^|\s)(\p{Ll})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

/**
 * A session as fiawec.com's results component lists it, "QUALIFYING - LMP2 & LMGT3" or "FREE PRACTICE 2": its label
 * without the classes ("Qualifying") and the classes it covers (null: every class the round runs). Null for one it marks
 * CANCELLED (Fuji's qualifying and Hyperpole, called off for rain), which has no classification.
 */
export function wecSession(listed: string): { label: string; classes: WecClass[] | null; race: boolean } | null {
  const parts = listed.split(/\s+-\s+/).map(clean).filter(Boolean);
  if (parts.length === 0 || parts.some(p => /^cancell?ed$/i.test(p))) return null;
  const label = sessionCase(parts[0]);
  const classes = parts[1]
    ? parts[1]
        .split('&')
        .map(c => WEC_CLASS[clean(c).toUpperCase()])
        .filter((c): c is WecClass => c !== undefined)
    : null;
  return { label, classes: classes && classes.length ? classes : null, race: /^race$/i.test(label) };
}

/** The table's headings, lower case, in order. */
function headings($: cheerio.CheerioAPI): string[] {
  return $('table')
    .first()
    .find('thead th')
    .map((_, th) => clean($(th).text()).toLowerCase())
    .get();
}

/**
 * One class's table from a fiawec.com results component response: the position first, the car where its "#8" cell is
 * ("8"), the team beside it, then the columns after "Team" by their headings (a race's "Total time" its Time, a timed
 * session's "Best lap" its Time; "-" no gap). Anchored on the car's cell because the headings are not one a cell: the
 * pages of June 2026 had no "N°" heading over it. The Crew column is left empty for withWecCrews, since the table names
 * no driver. Null when the class has no row (a class that did not run the session).
 */
export function wecTable(html: string, title: string, race: boolean, team: (name: string) => string): Table | null {
  const $ = cheerio.load(html);
  const heads = headings($);
  const teamHead = heads.indexOf('team');
  if (teamHead < 0) return null;
  const after = (name: string): number => {
    const j = heads.indexOf(name);
    return j > teamHead ? j : -1;
  };
  const [jLaps, jTime, jGap] = [after('laps'), after(race ? 'total time' : 'best lap'), after('gap')];
  const rows: string[][] = [];
  $('table')
    .first()
    .find('tbody tr')
    .each((_, tr) => {
      const cells = $(tr)
        .find('td')
        .map((__, td) => clean($(td).text()))
        .get();
      const pos = place(cells[0] ?? '');
      const at = cells.findIndex(c => /^#\S+$/.test(c));
      if (pos === null || at < 0) return;
      // The team's cell follows the car's; a heading after "Team" is as far from its cell.
      const cell = (j: number): string => (j < 0 ? '' : (cells[j + at + 1 - teamHead] ?? ''));
      const gap = cell(jGap) === '-' ? '' : cell(jGap);
      const head = [pos, cells[at].slice(1), '', team(cells[at + 1] ?? '')];
      rows.push(race ? [...head, cell(jLaps), cell(jTime), gap] : [...head, cell(jTime), cell(jLaps), gap]);
    });
  rows.sort(byPlace);
  return rows.length ? { title, columns: race ? RACE_COLUMNS : TIMED_COLUMNS, rows } : null;
}

/** A car's crew on its fiawec.com car page for one race (`/en/car/<season>/<car>?race=<id>`): each driver's id and the
 *  name as the card writes it, surname first ("Gounon Jules"). */
export function wecCarCrew(html: string): { id: string; card: string }[] {
  const $ = cheerio.load(html);
  return $('a.card-driver')
    .map((_, a) => {
      const id = /\/driver\/\d{4}\/(\d+)/.exec($(a).attr('href') ?? '')?.[1] ?? '';
      const card = clean($(a).find('.py-4').first().text()) || clean($(a).find('img').attr('alt'));
      return id && card ? { id, card } : null;
    })
    .get()
    .filter((x): x is { id: string; card: string } => x !== null);
}

/** A driver's name in reading order from the driver's fiawec.com page, whose heading writes the given names apart:
 *  `<h1><small>Luis Felipe</small> Derani</h1>` → "Luis Felipe Derani". */
export function wecDriverName(html: string): string | null {
  const $ = cheerio.load(html);
  const h1 = $('h1').first();
  const given = clean(h1.find('small').first().text());
  const family = clean(h1.clone().children('small').remove().end().text());
  return given && family ? `${given} ${family}` : null;
}

/** wec/crews.json on the data branch: each race's crews by car, as the car pages list them, and each driver's name as
 *  the cards write it, with the name in reading order once the driver's own page was read (only for a name drivers.json
 *  cannot spell). A car's crew is read once, and once more after its race if it was first read before (`afterRace`: the
 *  cars read with the race classified), so a driver changed during the weekend is caught; then kept. */
export interface WecCrews {
  races: Record<string, Record<string, string[]>>;
  drivers: Record<string, { card: string; name?: string }>;
  afterRace?: Record<string, string[]>;
}

export const emptyCrews = (): WecCrews => ({ races: {}, drivers: {}, afterRace: {} });

/** A car's crew in a race, every driver named; null while a car page or a driver's name is still to be read. */
export function wecCrewNames(crews: WecCrews, raceId: number, car: string, spell: (name: string) => string | null): string[] | null {
  const ids = crews.races[String(raceId)]?.[car];
  if (!ids?.length) return null;
  const names = ids.map(id => {
    const d = crews.drivers[id];
    return d ? (spell(d.card) ?? (d.name ? (spell(d.name) ?? tidyCaps(d.name)) : null)) : null;
  });
  return names.every((n): n is string => n !== null) ? names : null;
}

const raceIdOf = (raceIds: ReadonlyMap<number, number>, r: ResultRound): number | undefined => (r.round === null ? undefined : raceIds.get(r.round));

/** Every WEC table's Crew column from the stored crews, the whole crew or nothing (never a guessed or half crew); a
 *  table stored before this shape is left as it was. */
export function withWecCrews(rounds: ResultRound[], raceIds: ReadonlyMap<number, number>, crews: WecCrews, spell: (name: string) => string | null): ResultRound[] {
  const fill = (raceId: number | undefined) => (s: ResultSession): ResultSession => ({
    ...s,
    tables: s.tables.map(t => {
      const crew = t.columns.indexOf(CREW);
      const car = t.columns.indexOf('No.');
      if (crew < 0 || car < 0 || raceId === undefined) return t;
      return { ...t, rows: t.rows.map(row => row.map((c, i) => (i === crew ? (wecCrewNames(crews, raceId, row[car], spell)?.join(', ') ?? '') : c))) };
    }),
  });
  return rounds.map(r => {
    const id = raceIdOf(raceIds, r);
    return { ...r, sessions: r.sessions.map(fill(id)), ...(r.others ? { others: r.others.map(fill(id)) } : {}) };
  });
}

/** The car pages a run reads, the newest round first: every car in a stored round's tables whose crew for that race is
 *  not yet kept, and, once the race has a classification, every car whose crew was read before it (`afterRace` true:
 *  the read that settles it). */
export function wecCarsDue(rounds: readonly ResultRound[], raceIds: ReadonlyMap<number, number>, crews: WecCrews): { raceId: number; car: string; afterRace: boolean }[] {
  const out: { raceId: number; car: string; afterRace: boolean }[] = [];
  const seen = new Set<string>();
  for (const r of [...rounds].sort((a, b) => (b.round ?? 0) - (a.round ?? 0))) {
    const raceId = raceIdOf(raceIds, r);
    if (raceId === undefined) continue;
    const ran = r.sessions.some(s => s.tables.some(t => t.columns.includes(CREW) && t.rows.length > 0));
    const after = new Set(crews.afterRace?.[String(raceId)] ?? []);
    for (const t of [...r.sessions, ...(r.others ?? [])].flatMap(s => s.tables)) {
      const car = t.columns.indexOf('No.');
      if (car < 0 || !t.columns.includes(CREW)) continue;
      for (const row of t.rows) {
        const key = `${raceId}|${row[car]}`;
        if (!row[car] || seen.has(key)) continue;
        if (crews.races[String(raceId)]?.[row[car]] && (!ran || after.has(row[car]))) continue;
        seen.add(key);
        out.push({ raceId, car: row[car], afterRace: ran });
      }
    }
  }
  return out;
}

/** The drivers whose own page a run reads: drivers.json cannot spell their card's name and their page was not read. */
export function wecDriversDue(crews: WecCrews, spell: (name: string) => string | null): string[] {
  return Object.entries(crews.drivers)
    .filter(([, d]) => !d.name && spell(d.card) === null)
    .map(([id]) => id);
}

// ── GT World: the event page's sessions and each session's table ────────────

const GT_RACE = /^(main race|race \d+)$/i;
/** The event page's options that are no session of the weekend's timetable: the race's hourly checkpoints ("Main Race
 *  after 2h 30"), the pit walks, Spa's parade and the test days before the event ("Official Paid Test Session 1",
 *  Barcelona's "Official test sessions"); the Bronze Test is the timetable's own and stays. */
const GT_SKIP = /\bafter\b|pit walk|parade|test session/i;

/** The sessions a GT World event page offers (its select of sessions), in running order (the page lists the latest
 *  first); a race is "Main Race" or "Race <n>". */
export function gtSessionOptions(html: string): { id: number; label: string; race: boolean }[] {
  const $ = cheerio.load(html);
  return $('select#filter_race_id option')
    .map((_, o) => ({ id: Number($(o).attr('value')), label: clean($(o).text()) }))
    .get()
    .filter(o => Number.isInteger(o.id) && o.id > 0 && o.label && !GT_SKIP.test(o.label))
    .map(o => ({ ...o, race: GT_RACE.test(o.label) }))
    .reverse();
}

/** GT World's headings → ours; "Car" (the model) is left out, any other heading kept as the site writes it. */
const GT_COLUMN: Record<string, string> = { pos: 'Pos', 'car #': 'No.', class: 'Cup', drivers: CREW, team: 'Team', 'avg time': 'Time' };

/**
 * A GT World session's classification, every cup in one table, read by its headings: Pos, No., Crew, Team, Cup, then
 * the session's own columns as the site writes them (Time, Laps, Gap; an endurance round's combined qualifying its
 * average as Time, then Time 1 to 4), a column left out when no row fills it; the cars it lists unclassified ("NC",
 * "DSQ") after the classified places, marked so in Pos. A race's "Time" is each car's best lap (Brands Hatch's Race 1:
 * the winner 1:24.132, second 1:24.020), so a race keeps it as "Best lap". Null when the session has no row.
 */
export function gtTable(html: string, title: string, race: boolean, spell: (name: string) => string | null): Table | null {
  const $ = cheerio.load(html);
  const heads = headings($);
  const iPos = heads.indexOf('pos');
  if (iPos < 0) return null;
  const lines: Map<string, string>[] = [];
  $('table')
    .first()
    .find('tbody tr')
    .each((_, tr) => {
      const cells = $(tr)
        .find('td')
        .map((__, td) => clean($(td).text()))
        .get();
      const pos = place(cells[iPos] ?? '');
      if (pos === null) return;
      const line = new Map<string, string>();
      heads.forEach((h, i) => {
        if (h === 'car') return;
        const name = race && h === 'time' ? 'Best lap' : (GT_COLUMN[h] ?? h.replace(/(^|\s)(\p{Ll})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase()));
        const value = cells[i] ?? '';
        line.set(name, name === CREW ? crewCell(value.split(','), spell) : name === 'Pos' ? pos : value);
      });
      lines.push(line);
    });
  if (lines.length === 0) return null;
  const fixed = ['Pos', 'No.', CREW, 'Team', 'Cup'];
  const rest = [...new Set(lines.flatMap(l => [...l.keys()]))].filter(c => !fixed.includes(c) && lines.some(l => l.get(c)));
  const columns = [...fixed, ...rest];
  const rows = lines.map(l => columns.map(c => l.get(c) ?? '')).sort(byPlace);
  return { title, columns, rows };
}

// ── What a run fetches, and what it keeps ────────────────────────────────────

/** A round stored in this file's shape: every table of it has a Crew column. */
export function inShape(r: ResultRound | undefined): boolean {
  const sessions = r ? [...r.sessions, ...(r.others ?? [])] : [];
  return sessions.length > 0 && sessions.every(s => s.tables.length > 0 && s.tables.every(t => t.columns.includes(CREW)));
}

const dayAfter = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * The rounds a run fetches, the newest first, at most `max`: those under way or over, and either still settling (over
 * less than `settleDays` ago, when classifications are amended and late sessions filed) or not yet stored in this
 * file's shape. A stored round stands for a round of rounds.json only when its date lies within that round's dates, so
 * last season's round of the same number never does. A round settled and stored is never asked again.
 */
export function roundsDue(rounds: readonly Pick<SeriesRoundEntry, 'round' | 'startDate' | 'endDate'>[], stored: readonly ResultRound[] | null, now: Date, max: number, settleDays = 7): number[] {
  const today = now.toISOString().slice(0, 10);
  const keptFor = (e: Pick<SeriesRoundEntry, 'round' | 'startDate' | 'endDate'>): ResultRound | undefined =>
    (stored ?? []).find(r => r.round === e.round && r.date !== null && r.date >= e.startDate && r.date <= e.endDate);
  return rounds
    .filter(r => r.startDate <= today && (dayAfter(r.endDate, settleDays) >= today || !inShape(keptFor(r))))
    .sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0))
    .slice(0, Math.max(0, max))
    .map(r => r.round);
}

/**
 * A round as one run fetched it, or null when that fetch was not whole: a request went unanswered or the run's time ran
 * out (`missed` names what), so the stored round stays as it was and the round stays due for the next run. A session
 * the source lists without a classification (a class that did not run it, a session called off) is no miss. The races
 * are its `sessions`, the rest its `others`, in running order; named and dated as rounds.json names and dates it.
 */
export function fetchedRound(
  entry: Pick<SeriesRoundEntry, 'round' | 'name' | 'endDate'>,
  sessions: readonly (ResultSession & { race: boolean })[],
  missed: readonly string[] = [],
): ResultRound | null {
  if (missed.length > 0 || sessions.length === 0) return null;
  const strip = ({ label, tables }: ResultSession): ResultSession => ({ label, tables });
  const races = sessions.filter(s => s.race).map(strip);
  const others = sessions.filter(s => !s.race).map(strip);
  return { round: entry.round, name: entry.name, date: entry.endDate, sessions: races, ...(others.length ? { others } : {}) };
}

/** `fresh` in its own order, each item combined with the stored item of its key, and the stored items `fresh` lacks kept
 *  where they stood, before the next item both lists hold. */
function mergeInOrder<T>(fresh: readonly T[], stored: readonly T[], key: (x: T) => string, combine: (f: T, s: T) => T): T[] {
  const inFresh = new Set(fresh.map(key));
  const storedBy = new Map(stored.map(x => [key(x), x]));
  const out: T[] = [];
  const done = new Set<string>();
  let i = 0;
  const take = (f: T): void => {
    const s = storedBy.get(key(f));
    out.push(s ? combine(f, s) : f);
    done.add(key(f));
  };
  for (const s of stored) {
    if (!inFresh.has(key(s))) out.push(s);
    else while (i < fresh.length && !done.has(key(s))) take(fresh[i++]);
  }
  while (i < fresh.length) take(fresh[i++]);
  return out;
}

const shaped = (t: Table): boolean => t.columns.includes(CREW);

/**
 * The fetched rounds over the stored ones, oldest first, the season's only: a stored round of another season is
 * dropped, as Formula 1's stored file keeps one season. A fetched round (whole, fetchedRound) replaces the stored round
 * of its number session by session in the fetch's running order, and inside a session table by table; a stored session
 * or class table the fetch did not bring back stays in its place, and one of the shape stored before this file's is
 * dropped. Every other round stays as stored.
 */
export function mergeRounds(fresh: readonly ResultRound[], stored: readonly ResultRound[] | null, season: number): ResultRound[] {
  const out = new Map((stored ?? []).filter(r => r.round !== null && r.date?.slice(0, 4) === String(season)).map(r => [r.round as number, r]));
  const session = (f: ResultSession, s: ResultSession): ResultSession => ({ ...f, tables: mergeInOrder(f.tables, s.tables.filter(shaped), t => t.title, t => t) });
  const sessions = (f: readonly ResultSession[], s: readonly ResultSession[]): ResultSession[] =>
    mergeInOrder(f, s.filter(x => x.tables.length > 0 && x.tables.every(shaped)), x => x.label, session);
  for (const f of fresh) {
    if (f.round === null) continue;
    const s = out.get(f.round);
    if (!s) {
      out.set(f.round, f);
      continue;
    }
    const others = sessions(f.others ?? [], s.others ?? []);
    out.set(f.round, { ...f, sessions: sessions(f.sessions, s.sessions), ...(others.length ? { others } : {}) });
  }
  return [...out.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.round ?? 0) - (b.round ?? 0));
}

// ── The pages (O34's second PR) ──────────────────────────────────────────────
//
// As drawn on Endurance Weekend Drafts (O the Overview, M four classes, G a Sprint Cup round, S the season, L the
// layouts) and answered on 25 Oct (C1 one table with a tab a class, C2 a car's number, its crew and its team, C3 one
// Qualifying page, C4 GT World's two rows of tabs, C5 the rounds called off), with PR 2's plan of 12 Nov for what the
// drawings leave open. A weekend's pages are its units: each practice, its qualifying (a page before each race on GT
// World's Sprint Cup rounds) and each race, the timetable's names paired with the stored labels by kind and order. WEC
// and IMSA store a table a class; GT World one table with a Cup column, drawn overall or a cup at a time.

const esc = escapeHtml;

type Kind = 'practice' | 'qualifying' | 'race';

/** One page of a weekend: a practice, the qualifying, or a race; the timetable's entries for it, in running order, and
 *  the stored sessions it shows. */
export interface Unit {
  label: string;
  kind: Kind;
  entries: CalendarEntry[];
  sessions: ResultSession[];
}

/** A unit on the weekend's bar: run (stored), called off, not stored (a unit after it is), or still to run. */
export type UnitState = 'run' | 'x' | 'off' | 'up';

/** A session called off once the timetable was set (rounds.json `calledOff` on its round, the name family A's data
 *  gives MotoGP's): the unit it names, the sentence readers see, and the page that says so. */
export interface CalledOff {
  session: string;
  note: string;
  source: string;
}

/** A round's `calledOff` in rounds.json: each entry whole, with an https source, or left out. */
export function sessionsCalledOff(round: unknown): CalledOff[] {
  const raw: unknown = typeof round === 'object' && round !== null && 'calledOff' in round ? round.calledOff : undefined;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c: unknown) => {
    const x: { session?: unknown; note?: unknown; source?: unknown } = typeof c === 'object' && c !== null ? c : {};
    return typeof x.session === 'string' && typeof x.note === 'string' && typeof x.source === 'string' && /^https:\/\/\S+$/.test(x.source) ? [{ session: x.session, note: x.note, source: x.source }] : [];
  });
}

/** The timetable's appointments that are no session on track. */
const NOT_A_SESSION = /pit walk|autograph|parade|scrutineer|administrative|track walk|grid walk|charity|lap of honour|talk show/i;
/** The classes a timetable writes into a session's name ("LMGT3 Qualifying"). */
const CLASS_WORDS = /\b(?:hypercar|lmgt3|lmp2|gtp|gtd pro|gtd)\b/gi;

/** A timetable name without its class, its brackets or Le Mans' prefix: "Le Mans Hyperpole 1 (LMP2 & LMGT3)" →
 *  "Hyperpole 1", "Practice 2 (Night)" → "Practice 2", "Sprint Race 1" → "Race 1". */
export function plainName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^\s*le mans\s+/i, '')
    .replace(CLASS_WORDS, ' ')
    .replace(/^\s*sprint\s+(?=race\b)/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Two names of one session compare equal: "Warm Up" and "Warm-up", "Practice 2 (Night)" and "Practice 2". */
const sessionKey = (name: string): string => plainName(name).toLowerCase().replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim();
const sameSession = (a: string, b: string): boolean => sessionKey(a) === sessionKey(b);

/** The Cup column of a GT World table; -1 for WEC's and IMSA's, a table a class. */
const cupAt = (t: Table): number => t.columns.indexOf('Cup');

/** A stored session with a car of this championship. GT World's site lists Paul Ricard's 2026 Free Practice 1 with
 *  another championship's 27 cars (classes AM and PRO-AM, older models), a cup GT World never names. */
function own(s: ResultSession): boolean {
  return s.tables.some(t => t.rows.length > 0 && (cupAt(t) < 0 || t.rows.some(r => / cup$/i.test(r[cupAt(t)] ?? ''))));
}

/** A Sprint Cup qualifying's number ("Qualifying 1 (Group A)", "Qualifying 1 - Group A", "Qualifying 1 Combined" →
 *  "1"); '' for none. */
const qualifyingNumber = (name: string): string => /^qualifying\s+(\d+)\b/i.exec(plainName(name))?.[1] ?? '';

/**
 * A weekend's units in running order, the timetable's sessions (Weekend.sessions) paired with the stored ones by kind
 * and order (PR 2's plan): a practice by its name, then a timetable practice without a number with the next numbered
 * one left ("Final Practice" is IMSA's Practice 3); every qualifying part on one Qualifying page, a Sprint Cup round's
 * by its number (a page before each race); the races by their name where the two share one, the rest in order. A
 * stored session the timetable does not name stands alone, after the units before it; `left` names each, for the
 * publisher's log.
 */
export function unitsOf(w: Weekend): { units: Unit[]; left: string[] } {
  const entries = w.sessions.filter(e => !NOT_A_SESSION.test(e.session));
  const races = new Set(w.result?.sessions ?? []);
  const stored = [...(w.result?.others ?? []), ...(w.result?.sessions ?? [])].filter(own);
  const kindOf = (s: ResultSession): Kind => (races.has(s) ? 'race' : sessionKind(s.label));
  const both = (k: Kind) => ({ cal: entries.filter(e => sessionKind(e.session) === k), st: stored.filter(s => kindOf(s) === k) });

  // "Sprint Race 2" is the stored Race 2 by its name, so a Race 2 stored without its Race 1 never takes Race 1's place
  // and page. Where no name is shared ("6 Hours of Fuji (Race)" and the stored Race) the races pair in order.
  const r = both('race');
  const unraced = [...r.st];
  const raceUnits: Unit[] = r.cal.map(e => ({ label: plainName(e.session), kind: 'race', entries: [e], sessions: [] }));
  for (const u of raceUnits) {
    const at = unraced.findIndex(s => sameSession(s.label, u.label));
    if (at >= 0) u.sessions.push(...unraced.splice(at, 1));
  }
  if (!raceUnits.some(u => u.sessions.length)) for (const u of raceUnits) u.sessions.push(...unraced.splice(0, 1));
  raceUnits.push(...unraced.map(s => ({ label: s.label, kind: 'race' as const, entries: [], sessions: [s] })));
  const count = raceUnits.length;
  for (const u of raceUnits) u.label = count === 1 ? 'Race' : (u.sessions[0]?.label ?? u.label);

  const q = both('qualifying');
  const pages = new Map<string, Unit>();
  const page = (name: string): Unit => {
    const n = count > 1 ? qualifyingNumber(name) : '';
    const u = pages.get(n) ?? { label: n ? `Qualifying ${n}` : 'Qualifying', kind: 'qualifying' as const, entries: [], sessions: [] };
    pages.set(n, u);
    return u;
  };
  for (const e of q.cal) page(e.session).entries.push(e);
  for (const s of q.st) page(s.label).sessions.push(s);

  const p = both('practice');
  const practice: Unit[] = [];
  for (const e of p.cal) {
    const u = practice.find(x => sameSession(x.label, e.session));
    if (u) u.entries.push(e);
    else practice.push({ label: plainName(e.session), kind: 'practice', entries: [e], sessions: [] });
  }
  const rest = [...p.st];
  const take = (u: Unit, at: number): void => {
    if (at < 0) return;
    const [s] = rest.splice(at, 1);
    u.sessions.push(s);
    u.label = s.label;
  };
  for (const u of practice) take(u, rest.findIndex(s => sameSession(s.label, u.label)));
  for (const u of practice) if (!u.sessions.length && /practice/i.test(u.label) && !/\d/.test(u.label)) take(u, rest.findIndex(s => /practice \d+$/i.test(s.label)));
  practice.push(...rest.map(s => ({ label: s.label, kind: 'practice' as const, entries: [], sessions: [s] })));

  // Running order by the timetable; a unit it does not time stays after the one before it in this list.
  const all = [...practice, ...pages.values(), ...raceUnits];
  const left = all.filter(u => u.sessions.length && !u.entries.length).map(u => `${u.label}: stored, not in the timetable`);
  const at = new Map<Unit, string>();
  let last = '';
  for (const u of all) {
    const s = u.entries[0]?.start;
    at.set(u, s ?? `${last}~`);
    if (s && s > last) last = s;
  }
  const order = (u: Unit): string => at.get(u) ?? '';
  return { units: all.sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0)), left };
}

/** Each unit's state: run once stored; called off when rounds.json says so; not stored once a later unit is; else
 *  still to run (the page follows its data, never the hour it is written). */
export function unitStates(units: readonly Unit[], off: readonly CalledOff[]): UnitState[] {
  const later = (i: number): boolean => units.slice(i + 1).some(u => u.sessions.length > 0);
  return units.map((u, i) =>
    u.sessions.length
      ? 'run'
      : off.some(c => sameSession(c.session, u.label) || u.entries.some(e => sameSession(c.session, e.session)))
        ? 'x'
        : later(i)
          ? 'off'
          : 'up',
  );
}

/**
 * The series' teams with the results' own names joined: drivers.json names a team by its car ("Toyota Gazoo Racing #8
 * (Hypercar)") where a result names it as the series writes it ("TOYOTA RACING"), so a result's team found no colour
 * (found by #1199's review). Each team a result names that the list does not joins it under that name with the colour
 * of its car's team in drivers.json, the first car of that name; the shared ticks, tiles and rows then draw it.
 */
export function withResultTeams(teams: readonly SeriesTeam[], results: readonly ResultRound[] | null): SeriesTeam[] {
  const colours = new Map<string, string>();
  for (const t of teams) {
    const car = /#(\S+)/.exec(t.name)?.[1];
    if (car && t.colour && !colours.has(car)) colours.set(car, t.colour);
  }
  const named = new Set(teams.map(t => t.name.toLowerCase()));
  const out = [...teams];
  for (const r of results ?? []) {
    for (const s of [...r.sessions, ...(r.others ?? [])]) {
      for (const t of s.tables) {
        for (const row of t.rows) {
          const name = cell(t, row, 'Team');
          const colour = colours.get(cell(t, row, 'No.'));
          if (!name || !colour || named.has(name.toLowerCase())) continue;
          named.add(name.toLowerCase());
          out.push({ name, colour, drivers: [] });
        }
      }
    }
  }
  return out;
}

// ── Classes and cups ─────────────────────────────────────────────────────────

/** IMSA writes its class GTD PRO (M); the stored title keeps Al Kamel's GTDPRO as "GTD Pro". */
const className = (title: string): string => (title === 'GTD Pro' ? 'GTD PRO' : title);
const CUP_ORDER = ['pro cup', 'gold cup', 'silver cup', 'bronze cup', 'pro-am cup'];
const cupRank = (cup: string): number => {
  const at = CUP_ORDER.indexOf(cup.toLowerCase());
  return at < 0 ? CUP_ORDER.length : at;
};
const cupName = (cup: string): string => cup.replace(/\s+cup$/i, '');

/** A class's table, or one cup's cars out of GT World's whole order. */
interface View {
  name: string;
  table: Table;
  /** A cup out of the whole order: its places within the cup, each car's overall place beside it. */
  cup: boolean;
}

/** A cup's cars in their order: Pos within the cup (an unclassified car keeps its mark), the overall place in place of
 *  the cup, and no gap, which GT World gives to the overall leader. */
function cupTable(t: Table, cup: string): Table {
  const pos = t.columns.indexOf('Pos');
  const c = cupAt(t);
  const gap = t.columns.indexOf('Gap');
  const keep = t.columns.map((_, i) => i).filter(i => i !== gap);
  let n = 0;
  const rows = t.rows
    .filter(r => r[c] === cup)
    .map(r => {
      const placed = /^\d+$/.test(r[pos] ?? '');
      const mine = placed ? String(++n) : (r[pos] ?? '');
      return keep.map(i => (i === pos ? mine : i === c ? (placed ? `P${r[pos]} overall` : (r[pos] ?? '')) : (r[i] ?? '')));
    });
  return { title: cup, columns: keep.map(i => (i === c ? 'Overall' : t.columns[i])), rows };
}

/** A session's views: WEC's and IMSA's classes, the top class first; GT World's whole order, then each cup in
 *  GT World's order (Pro, Gold, Silver, Bronze, then any other). */
function viewsOf(s: ResultSession): View[] {
  const tables = classTables(s);
  const whole = tables.find(t => cupAt(t) >= 0);
  if (!whole) return tables.map(t => ({ name: className(t.title), table: t, cup: false }));
  const cups = [...new Set(whole.rows.map(r => r[cupAt(whole)] ?? '').filter(Boolean))].sort((a, b) => cupRank(a) - cupRank(b));
  return [{ name: 'Overall', table: whole, cup: false }, ...cups.map(c => ({ name: cupName(c), table: cupTable(whole, c), cup: true }))];
}

/** A session's tables that hold a car, a class once: two tabs of one name would stop the publisher's whole run
 *  (resultTabs throws), every other series' pages with it. */
function classTables(s: ResultSession): Table[] {
  const filled = s.tables.filter(t => t.rows.length > 0);
  return filled.filter((t, i) => filled.findIndex(x => x.title === t.title) === i);
}

const cupSeries = (u: Unit | undefined): boolean => Boolean(u?.sessions.some(s => s.tables.some(t => cupAt(t) >= 0)));
/** A series whose races are kept overall with a cup a car (GT World), by any race it has stored. */
const cupSeriesOf = (d: SeriesData): boolean => (d.results ?? []).some(r => r.sessions.some(s => s.tables.some(t => cupAt(t) >= 0)));
/** A session's cars, every class's. */
const carsIn = (s: ResultSession): number => {
  const tables = classTables(s);
  const whole = tables.find(t => cupAt(t) >= 0);
  return whole ? whole.rows.length : tables.reduce((n, t) => n + t.rows.length, 0);
};
/** "17 cars", "1 car". */
const cars = (n: number): string => `${n} car${n === 1 ? '' : 's'}`;

/** A qualifying's combined order: GT World's "Qualifying Combined", or the session beside its groups that names none
 *  (Misano's "Qualifying 2" beside its Group A and Group B). */
function combinedOf(u: Unit): ResultSession | undefined {
  const grouped = u.sessions.some(x => /group/i.test(x.label));
  return u.sessions.find(x => /combined/i.test(x.label) || (grouped && !/group/i.test(x.label)));
}

/** The session a qualifying's pole is read from: its only one; else Spa's Superpole, a combined order, the last
 *  Hyperpole (WEC). None when its parts stand alone (Paul Ricard's three sessions, whose combined order GT World's
 *  site does not hold): no pole is guessed from a part. */
function decidingOf(u: Unit): ResultSession | undefined {
  const s = u.sessions;
  if (s.length < 2) return s[0];
  return s.find(x => /^superpole$/i.test(x.label)) ?? combinedOf(u) ?? [...s].reverse().find(x => /hyperpole/i.test(x.label));
}

/** A table's cell by its column's name. */
const cell = (t: Table, row: readonly string[], name: string): string => {
  const at = t.columns.indexOf(name);
  return at >= 0 ? (row[at] ?? '') : '';
};
/** "#8 TOYOTA RACING": the car and its team. */
const carLine = (t: Table, row: readonly string[]): string => [cell(t, row, 'No.') ? `#${cell(t, row, 'No.')}` : '', cell(t, row, 'Team')].filter(Boolean).join(' ');
/** The car leading a unit: the winner, the pole, the fastest in practice ("#8"); '' for none. */
function leadOf(u: Unit): string {
  const t = (u.kind === 'qualifying' ? decidingOf(u) : u.sessions[0])?.tables.find(x => x.rows.length > 0);
  const no = t ? cell(t, t.rows[0], 'No.') : '';
  return no ? `#${no}` : '';
}

// ── Tables ───────────────────────────────────────────────────────────────────

const FIXED = ['Pos', 'No.', CREW, 'Team'];
const figureClass = (c: string): string => (c === 'Laps' ? 'n' : c === 'Cup' || c === 'Overall' ? 'cup' : 't');
/** The figure a narrow table keeps at its edge, the first of these it holds (O34's check, 17 Nov): a race's gap (a cup's
 *  own table: its overall place), a practice's or a qualifying's time. */
const RACE_EDGE = ['Gap', 'Overall'];
const TIMED_EDGE = ['Time', 'Gap'];

/** C2's rows: the car's number large, every driver's full name, then the team; the session's own columns after them,
 *  or `only` those (the Overview's Gap, Cup or Overall). In a box too narrow for them (the theme's container queries)
 *  the team leaves, then every figure but the `edge` one (else the last) moves to a line under the crew, each named:
 *  "Laps 203 · Time 6:01:01.299", a cup or an overall place bare (the operator's "A · Under the crew", 17 Nov). */
function crewTable(t: Table, o: { limit?: number; only?: readonly string[]; edge?: readonly string[] } = {}): string {
  const [pos, no, crew, team] = FIXED.map(c => t.columns.indexOf(c));
  const figures = t.columns.map((_, i) => i).filter(i => !FIXED.includes(t.columns[i]) && (!o.only || o.only.includes(t.columns[i])));
  const edge = (o.edge ?? []).map(c => t.columns.indexOf(c)).find(i => figures.includes(i)) ?? figures[figures.length - 1];
  const moved = figures.filter(i => i !== edge);
  const kind = (i: number): string => `${figureClass(t.columns[i])}${moved.includes(i) ? ' mv' : ''}`;
  const sub = (row: readonly string[]): string => {
    const parts = moved.filter(i => (row[i] ?? '') !== '').map(i => (figureClass(t.columns[i]) === 'cup' ? esc(row[i]) : `${esc(t.columns[i])}&nbsp;${esc(row[i])}`));
    return parts.length ? `<span class="pd-ec-sub">${parts.join(' · ')}</span>` : '';
  };
  const head = `<tr><th class="p">Pos</th><th class="no">No.</th><th class="crew">Crew</th><th class="tm">Team</th>${figures.map(i => `<th class="${kind(i)}">${esc(t.columns[i])}</th>`).join('')}</tr>`;
  const body = t.rows
    .slice(0, o.limit ?? Infinity)
    .map(
      row =>
        `<tr><td class="p">${esc(row[pos] ?? '')}</td><td class="no">${row[no] ? `#${esc(row[no])}` : ''}</td><td class="crew">${esc(row[crew] ?? '')}${sub(row)}</td><td class="tm">${esc(row[team] ?? '')}</td>` +
        `${figures.map(i => `<td class="${kind(i)}">${esc(row[i] ?? '') || '–'}</td>`).join('')}</tr>`,
    )
    .join('');
  // Four figures or more (GT World's race overall, its qualifying with each driver's time) need a wider box.
  return `<div class="pd-wk-scroll"><table class="pd-wk-tbl pd-ec-tbl${figures.length >= 4 ? ' is-wide' : ''}"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/** A tab's name: a class with its cars ("Hypercar · 17 cars", C1); a cup or the whole order bare (G). */
const tabName = (v: View): string => (v.cup || v.name === 'Overall' ? v.name : `${v.name} · ${cars(v.table.rows.length)}`);

// ── The parts of a weekend's pages ───────────────────────────────────────────

/** A race's length: its timetable's, else the hours in its name (Le Mans' timetable gives its start alone). */
function lengthOf(w: Weekend, u: Unit | undefined): string {
  const e = u?.entries[0];
  let min = e ? Math.round((Date.parse(e.end) - Date.parse(e.start)) / 60_000) : 0;
  if (!(min > 0)) min = Number(/(\d+)\s*hours?\b/i.exec(w.r.name)?.[1] ?? 0) * 60;
  if (!(min > 0)) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} hour${h === 1 ? '' : 's'}` : '', m ? `${m} minute${m === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ');
}

const PARTICLES = /^(?:da|das|de|del|della|der|den|di|do|dos|du|la|le|ten|ter|van|von)$/i;
/** A driver's surname for the strip: from its first particle ("Nyck de Vries" → "de Vries", "Sheldon van der Linde" →
 *  "van der Linde"), with a suffix ("Dave Musial Jr." → "Musial Jr."), else the last word. */
export function surnameOf(name: string): string {
  const words = name.trim().split(/\s+/);
  const at = words.findIndex((x, i) => i > 0 && i < words.length - 1 && PARTICLES.test(x));
  if (at > 0) return words.slice(at).join(' ');
  const n = words.length;
  return n > 2 && /^(?:jr\.?|sr\.?|ii|iii|iv)$/i.test(words[n - 1]) ? words.slice(n - 2).join(' ') : words[n - 1];
}

/** The strip's Final line once every race is stored: the winning car, its team and its crew, then each class's or cup's
 *  winner (O, C1); a Sprint Cup round's winner of each race, the last first (G). Null until then. */
function finalLine(units: readonly Unit[]): string | null {
  const races = units.filter(u => u.kind === 'race');
  if (!races.length || races.some(u => !u.sessions.length)) return null;
  const won = (u: Unit): { t: Table; row: string[] } | null => {
    const t = viewsOf(u.sessions[0])[0]?.table;
    return t?.rows[0] ? { t, row: t.rows[0] } : null;
  };
  if (races.length > 1) {
    const [last, ...before] = [...races].reverse();
    const a = won(last);
    if (!a) return null;
    const rest = before.flatMap(u => {
      const b = won(u);
      return b ? [`${esc(carLine(b.t, b.row))} ${esc(u.label)}`] : [];
    });
    return `<b>${esc(carLine(a.t, a.row))}</b> won ${esc(last.label)}${rest.length ? `; ${rest.join('; ')}` : ''}`;
  }
  const views = viewsOf(races[0].sessions[0]);
  const top = views[0];
  if (!top?.table.rows[0]) return null;
  const row = top.table.rows[0];
  const crew = cell(top.table, row, CREW).split(', ').filter(Boolean).map(surnameOf);
  const winnerCup = cell(top.table, row, 'Cup');
  const others = views
    .slice(1)
    .filter(v => v.table.rows[0] && (!v.cup || v.table.title !== winnerCup))
    .map(v => `${esc(v.cup ? v.table.title : v.name)} to ${esc(carLine(v.table, v.table.rows[0]))}`);
  return `<b>${esc(carLine(top.table, row))}</b> won${crew.length ? ` (${esc(crew.join(', '))})` : ''}${others.length ? `; ${others.join(', ')}` : ''}`;
}

/** The weekend's bar: its Overview, then each unit with its day at the track and its leading car once run (O's "Race ·
 *  Sun · #8"); a unit not stored greyed, one called off struck through, one still to run dashed with your time. */
function unitBar(w: Weekend, units: readonly Unit[], states: readonly UnitState[], current: Unit | null): string {
  const entries: BarEntry[] = [{ label: 'Overview', note: 'the weekend', href: w.path, current: current === null }];
  units.forEach((u, i) => {
    const e = u.entries[0];
    const day = e ? `${esc(trackWeekday(w, e.start))} · ` : '';
    const href = sessionPath(w, u.label);
    const state = states[i];
    if (state === 'run') entries.push({ label: u.label, note: `${day}${esc(leadOf(u))}`.replace(/ · $/, ''), href, current: u === current });
    else if (state === 'up') entries.push({ label: u.label, note: e ? `${yours(e.start, 'wt')}<span class="pd-vh"> · still to run</span>` : 'still to run', href, current: u === current, state: 'up' });
    else entries.push({ label: u.label, note: `${day}${state === 'x' ? 'called off' : 'not stored'}`, state });
  });
  return bar(w, entries);
}

/** The Overview's results (C1, C4): a tab a class, the top ten with the gap and a way to every car on the race's page
 *  (O, M); GT World overall with the cup, the top ten, and each cup's first five with their overall places (G), a Sprint
 *  Cup round's races in a row of tabs over the classes, opening on the last race run, overall; a round of two races
 *  names its race in that row from its first, so Race 1's table never stands unnamed while Race 2 is to come. */
function resultsTabs(w: Weekend, races: readonly Unit[]): string {
  const two = races.length > 1;
  const panels: TabPanel[] = races
    .filter(u => u.sessions.length)
    .flatMap(u => {
      const e = u.entries[0];
      const race = e ? `${u.label} · ${trackWeekday(w, e.start)}` : u.label;
      return viewsOf(u.sessions[0]).map(v => {
        // A class's table, or GT World's whole order: every car of it is on the race's page, opened on its tab.
        const all = `<p class="pd-wk-links pd-ec-all"><a class="pd-wk-link" href="${sessionPath(w, u.label)}#${tabAnchor([tabName(v)])}">All ${v.table.rows.length} on the race's page</a></p>`;
        const body = v.cup ? crewTable(v.table, { limit: 5, only: ['Overall'] }) : `${crewTable(v.table, { limit: 10, only: [cupAt(v.table) >= 0 ? 'Cup' : 'Gap'] })}${all}`;
        return { tab: two ? [race, tabName(v)] : [tabName(v)], body };
      });
    });
  // The last race's first tab: Race 2 overall (C4).
  const last = panels[panels.length - 1]?.tab[0];
  const first = panels.find(p => p.tab[0] === last)?.tab[1];
  return resultTabs(panels, two && last && first ? { rows: ['Race', 'Class'], open: [last, first] } : {});
}

/** A unit's card in Earlier in the weekend: its time, yours and the track's, and each class's leader, the fastest car
 *  of each class in practice and each class's pole in qualifying (PR 2's plan); GT World's a cup at a time. */
function unitCard(w: Weekend, u: Unit): string {
  const s = u.kind === 'qualifying' ? decidingOf(u) : u.sessions[0];
  // A class or a cup a row; a qualifying whose parts stand alone, its parts' fastest cars.
  const leaders: { name: string; table: Table }[] = s
    ? viewsOf(s).filter((v, _, all) => v.cup || v.name !== 'Overall' || all.length === 1)
    : u.sessions.flatMap(x => viewsOf(x).slice(0, 1).map(v => ({ name: x.label, table: v.table })));
  // A combined order gives no lap: the car's own in the last of the unit's sessions that times it (its group's; at
  // Spa the last part of the Superpole it ran).
  const lapIn = (no: string): string => {
    for (const x of [...u.sessions].reverse()) {
      for (const t of x.tables) {
        const row = t.rows.find(r => cell(t, r, 'No.') === no);
        if (row && cell(t, row, 'Time')) return cell(t, row, 'Time');
      }
    }
    return '';
  };
  const rows = leaders
    .flatMap(v => {
      const row = v.table.rows[0];
      if (!row) return [];
      const no = cell(v.table, row, 'No.');
      const time = cell(v.table, row, 'Time') || cell(v.table, row, 'Best lap') || lapIn(no);
      // A class that set no lap (IMSA's GTD classes at Indianapolis, listed with 0 laps) has no fastest car to name.
      if (!time) return [];
      return [`<li><span class="c">${esc(v.name)}</span><b>${no ? `#${esc(no)}` : ''}</b><span class="nm">${esc(cell(v.table, row, CREW))}</span><span class="tt">${esc(time)}</span></li>`];
    })
    .join('');
  const e = u.entries[0];
  // A unit of several timed parts (a class or a group at a time) starts with its first; its page names each one's.
  const when = e ? `<p>${u.entries.length > 1 ? 'from ' : ''}${yours(e.start, 'wt')} your time · ${trackWeekday(w, e.start)} ${trackTime(w, e.start)} at the track</p>` : '';
  // Every car of the unit: a group's session holds half of them.
  const all = Math.max(0, ...u.sessions.map(carsIn));
  return (
    `<article class="pd-sc"><header><div><h3>${esc(u.label)}</h3>${when}</div></header>${rows ? `<ol class="pd-sc-rows pd-ec-rows">${rows}</ol>` : ''}` +
    `<a class="pd-sc-go" href="${sessionPath(w, u.label)}">All ${all} on its page →</a></article>`
  );
}

const byStart = (a: CalendarEntry, b: CalendarEntry): number => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);

/** The sessions still to run in the order they run, by the track's day: your time and the track's, the forecast, a way
 *  to each one's page (a class's part of a unit to that unit's). */
function aheadRows(w: Weekend, units: readonly Unit[], used: Used): string {
  const days = new Map<string, string[]>();
  const parts = units.flatMap(u => u.entries.map(e => ({ u, e }))).sort((a, b) => byStart(a.e, b.e));
  for (const { u, e } of parts) {
    const day = trackDay(w, e.start);
    days.set(day, [
      ...(days.get(day) ?? []),
      `<a class="pd-wk-row" href="${sessionPath(w, u.label)}"><span class="pd-wk-when"><b>${yours(e.start, 'wt')}</b><small>Track ${trackTime(w, e.start)}</small></span>` +
        `<span class="pd-wk-name">${esc(e.session)}</span>${forecast(w, e.start, used) || '<span class="pd-wk-wx"></span>'}<span class="pd-wk-go"><span class="t">Its page</span> →</span></a>`,
    ]);
  }
  return [...days].map(([day, rows]) => `<h3 class="pd-wk-day">${esc(day)}</h3><div class="pd-wk-rows">${rows.join('')}</div>`).join('');
}

/** A standings cell's drivers: WEC's in capitals and ", " apart; IMSA's one a cell (its official points files), or run
 *  together in the Wikipedia tables stored before them ("Nick Yelloly Renger van der Zande"); each spelled as the
 *  season's results spell it; a name the results do not hold kept, its capitals tidied. */
function driversIn(text: string, known: ReadonlyMap<string, string>): string[] {
  const spell = (n: string): string => known.get(nameKey(n)) ?? tidyCaps(n);
  if (text.includes(',')) return text.split(',').map(clean).filter(Boolean).map(spell);
  const words = text.split(/\s+/).filter(Boolean);
  // The fewest names the results know that run together make the cell.
  const best: (string[] | null)[] = [[], ...words.map(() => null)];
  for (let j = 1; j <= words.length; j++) {
    for (let i = 0; i < j; i++) {
      const name = known.get(nameKey(words.slice(i, j).join(' ')));
      const before = best[i];
      if (name && before && (!best[j] || before.length + 1 < (best[j]?.length ?? Infinity))) best[j] = [...before, name];
    }
  }
  return best[words.length] ?? [spell(text)];
}

/** The championship box (O): the top class's drivers as they stand, a crew a row with its car and team, from the
 *  stored standings (the latest, as the series publishes them); the Standings page is greyed until it is built. */
function champBox(w: Weekend): string {
  const t = (w.d.standings ?? []).find(x => / · drivers$/i.test(x.title));
  if (!t) return '';
  const [pos, name, pts] = ['Pos', 'Driver', 'Pts'].map(c => col(t.columns, c, ...(c === 'Pts' ? ['Points'] : [])));
  if (name < 0 || pts < 0) return '';
  // Every driver of the season's races: the spelling, and the car and team of the latest race each drove.
  const known = new Map<string, string>();
  const cars = new Map<string, { car: string; team: string }>();
  for (const r of [...(w.d.results ?? [])].sort((a, b) => (a.round ?? 0) - (b.round ?? 0))) {
    for (const s of r.sessions) {
      for (const x of s.tables) {
        for (const row of x.rows) {
          for (const n of cell(x, row, CREW).split(', ').filter(Boolean)) {
            known.set(nameKey(n), n);
            cars.set(nameKey(n), { car: cell(x, row, 'No.'), team: cell(x, row, 'Team') });
          }
        }
      }
    }
  }
  const rows: { pos: string; names: string[]; car: string; team: string; pts: number }[] = [];
  for (const row of t.rows) {
    const names = driversIn(row[name] ?? '', known);
    const drove = cars.get(nameKey(names[0] ?? '')) ?? { car: '', team: '' };
    const value = Number.parseFloat(row[pts] ?? '') || 0;
    const prev = rows[rows.length - 1];
    // GT World lists a crew's drivers a row each, level on points and place: one row for the car.
    if (prev && prev.pos === (row[pos] ?? '') && prev.pts === value && drove.car && prev.car === drove.car) prev.names.push(...names);
    else rows.push({ pos: row[pos] ?? '', names, car: drove.car, team: drove.team, pts: value });
  }
  const top = rows.slice(0, 5);
  if (!top.length) return '';
  const lead = top[0].pts;
  const cls = t.title.replace(/\s*·\s*drivers$/i, '');
  const title = cls.toLowerCase() === 'overall' ? 'Drivers overall, as they stand' : `${className(cls)} drivers, as they stand`;
  const more = built(w.d, 'standings') ? `<a class="pd-wk-more" href="/series/${esc(w.d.slug)}/standings/">Full standings →</a>` : '<span class="pd-wk-more is-off">Full standings →</span>';
  const items = top
    .map(
      (x, i) =>
        `<li><span class="p">${esc(x.pos)}</span>${tick(w.d, x.team)}<span class="d"><b>${esc(x.names.join(', '))}</b><small>${esc([x.car ? `#${x.car}` : '', teamLabel(x.team)].filter(Boolean).join(' '))}</small></span>` +
        `<span class="g">${i ? `−${Math.round((lead - x.pts) * 10) / 10}` : 'Leader'}</span><b class="pt">${x.pts}</b></li>`,
    )
    .join('');
  return `<section class="pd-wk-box pd-wk-champ"><h3>${esc(title)}</h3><ol>${items}</ol>${more}</section>`;
}

/** At the track's rows after the circuit, the country and the track time: the race's length and the classes (O); GT
 *  World's cup, its two one-hour races or its race's length, and the cups (G). */
function trackFacts(w: Weekend, units: readonly Unit[]): [string, string][] {
  const races = units.filter(u => u.kind === 'race');
  const stored = units.find(u => u.kind === 'race' && u.sessions.length) ?? units.find(u => u.sessions.length);
  const views = stored ? viewsOf(stored.sessions[0]) : [];
  const out: [string, string][] = [];
  if (cupSeriesOf(w.d)) {
    const lengths = new Set(races.map(u => lengthOf(w, u)));
    const each = lengths.size === 1 ? [...lengths][0] : '';
    if (races.length > 1) out.push(['Cup', `Sprint Cup: ${races.length === 2 ? 'two' : races.length} ${each === '1 hour' ? 'one-hour ' : ''}races`]);
    if (races.length === 1) out.push(['Cup', 'Endurance Cup']);
    if (races.length === 1 && each) out.push(['Race', each]);
    const cups = views.filter(v => v.cup).map(v => v.name);
    if (cups.length) out.push(['Cups', cups.join(', ')]);
    return out;
  }
  const length = lengthOf(w, races[races.length - 1]);
  if (length) out.push(['Race', length]);
  if (views.length) out.push(['Classes', views.map(v => v.name).join(', ')]);
  return out;
}

/** The called-off sessions' lines under Results, in the series' own words (the drafts' flag). */
const flags = (off: readonly CalledOff[]): string => off.map(c => `<p class="pd-ec-flag">${esc(c.note)}</p>`).join('');

/** A round's Overview (O, M, G): after a race, the results a class at a time and the earlier sessions' leaders; before,
 *  the sessions run so far and the rest by day with their forecasts; beside them the championship, the track and the
 *  next round. */
function overviewPage(w: Weekend, units: readonly Unit[], states: readonly UnitState[], off: readonly CalledOff[]): Page {
  const used = nothingUsed();
  const races = units.filter(u => u.kind === 'race');
  const raced = races.some(u => u.sessions.length);
  const run = units.filter(u => u.kind !== 'race' && u.sessions.length);
  const ahead = units.filter((_, i) => states[i] === 'up');
  const cups = cupSeriesOf(w.d);
  const leaders = `Each ${cups ? 'cup' : 'class'}’s fastest in practice and its pole in qualifying`;
  const parts: string[] = [];
  if (raced) {
    const last = [...races].reverse().find(u => u.sessions.length);
    const e = last?.entries[0];
    const hint =
      races.length > 1
        ? `A race, then overall or a cup; it opens on ${last?.label ?? 'the last race'} overall`
        : [e ? trackDay(w, e.start).split(' ')[0] : '', lengthOf(w, last), cups ? 'overall or a cup at a time' : 'a class at a time'].filter(Boolean).join(' · ');
    parts.push(section('Results', esc(hint), `${flags(off)}${resultsTabs(w, races)}`));
    if (run.length) parts.push(section('Earlier in the weekend', `${leaders}, in the order they ran`, `<div class="pd-sc-grid">${run.map(u => unitCard(w, u)).join('')}</div>`));
  } else {
    if (off.length) parts.push(section('Called off', '', flags(off)));
    if (run.length) parts.push(section('Done so far', leaders, `<div class="pd-sc-grid">${run.map(u => unitCard(w, u)).join('')}</div>`));
  }
  if (ahead.length) {
    const note =
      '<p class="pd-wk-note">A session’s forecast is for its start while it is within ten days: the rain over that hour, or over six hours when it is further off. Each session’s results join this page after it ends.</p>';
    parts.push(section(run.length || raced ? 'Still to come' : 'The weekend', 'The track’s days: your time, the track’s underneath', aheadRows(w, ahead, used) + note));
  }
  if (!units.length) parts.push(section('The weekend', '', '<p class="pd-wk-empty">The weekend’s session times are not published yet; they appear here as soon as they are.</p>'));
  // GT World's rounds count for one of its two cups: two races, the Sprint Cup's (G); one, the Endurance Cup's.
  const crumb = cups && races.length ? `Round ${w.r.round} of ${(w.d.rounds ?? []).length} · ${races.length > 1 ? 'Sprint' : 'Endurance'} Cup` : undefined;
  // The strip's Next line is read from the sessions still to run: the shared strip takes a session as run when a
  // stored one carries its timetable name, which family C's stored labels do not ("LMGT3 Qualifying", "Qualifying").
  const toRun = ahead.flatMap(u => u.entries).sort(byStart);
  const body =
    `<div class="pd-wkp pd-s-${esc(w.d.slug)}">${weekendBand(w, crumb ? { crumb } : {})}${strip(toRun.length ? { ...w, sessions: toRun } : w, finalLine(units))}${unitBar(w, units, states, null)}` +
    `<div class="pd-wk-main"><div class="pd-wk-col">${parts.join('')}</div>${aside(w, raced, { champ: null, before: champBox(w), facts: trackFacts(w, units) })}</div>${credit(used)}</div>`;
  return { path: w.path, title: `${w.r.name} ${w.season}`, body: htmlBlock(body), template: 'page-wide' };
}

/** A unit's classification: a tab a class (C1); a qualifying's parts inside each class's tab, Qualifying then Hyperpole
 *  (C3); GT World's sessions in a row over overall and the cups, opening on the combined order overall (C3, C4). */
function unitBody(u: Unit): { hint: string; body: string } {
  const cup = cupSeries(u);
  const edge = u.kind === 'race' ? RACE_EDGE : TIMED_EDGE;
  if (u.kind === 'qualifying' && u.sessions.length > 1) {
    if (cup) {
      const combined = combinedOf(u);
      const sessions = combined ? [combined, ...u.sessions.filter(s => s !== combined)] : u.sessions;
      const short = (s: ResultSession): string => (s === combined ? 'Combined' : s.label.replace(/^qualifying \d+\s*-\s*/i, ''));
      const panels = sessions.flatMap(s => viewsOf(s).map(v => ({ tab: [short(s), v.name], body: crewTable(v.table, { edge }) })));
      return { hint: 'A session, then overall or a cup', body: resultTabs(panels, { rows: ['Session', 'Class'], open: [short(sessions[0]), 'Overall'] }) };
    }
    const classes = [...new Set(u.sessions.flatMap(s => viewsOf(s).map(v => v.name)))];
    const panels = classes.map(name => {
      const parts = u.sessions.flatMap(s => {
        const v = viewsOf(s).find(x => x.name === name);
        return v ? [{ label: s.label, t: v.table }] : [];
      });
      const first = parts[0]?.t.rows.length ?? 0;
      const body = parts
        .map(({ label, t }, i) => `<h4 class="pd-ec-part">${esc(label)} <small>${i && t.rows.length < first ? `the top ${t.rows.length}` : cars(t.rows.length)}</small></h4>${crewTable(t, { edge })}`)
        .join('');
      return { tab: [`${name} · ${cars(first)}`], body };
    });
    return { hint: `A class at a time: ${u.sessions.map(s => s.label).join(', then ')}`, body: resultTabs(panels) };
  }
  const s = u.sessions[0];
  const panels = s ? viewsOf(s).map(v => ({ tab: [tabName(v)], body: crewTable(v.table, { edge }) })) : [];
  const what = u.kind === 'race' ? 'Every car, as classified' : 'Every car’s best lap';
  return { hint: `${what}, ${cup ? 'overall or a cup' : 'a class'} at a time`, body: resultTabs(panels) };
}

/** A unit's band. One timed session: the shared session band. Several (a class or a group at a time, Le Mans' two
 *  days): each one's own start at the track by day, under its timetable name, then the first in the reader's time, so
 *  no class's hour stands for another's. None: the round's dates. */
function unitBand(w: Weekend, u: Unit): string {
  const [first] = u.entries;
  if (first && u.entries.length === 1) return sessionBand(w, { ...first, session: u.label });
  const days = new Map<string, string[]>();
  for (const e of u.entries) days.set(trackDay(w, e.start), [...(days.get(trackDay(w, e.start)) ?? []), `${esc(e.session)} ${trackTime(w, e.start)}`]);
  const sub = first ? `${[...days].map(([day, parts]) => `${esc(day)} · ${parts.join(' · ')}`).join('; ')}, at the track; from ${yours(first.start, 'wt')} your time` : longDates(w.r.startDate, w.r.endDate);
  return (
    `<section class="pd-ss-band"><div class="pd-ss-band-in"><p class="pd-wk-crumb"><a href="/series/${esc(w.d.slug)}/">${esc(w.d.name)}</a> › <a href="/series/${esc(w.d.slug)}/${w.season}/">${w.season}</a> › ` +
    `<a href="${w.path}">Round ${w.r.round} · ${esc(w.r.name)}</a></p><h1>${esc(u.label)}</h1><p class="pd-ss-sub">${sub}</p></div></section>`
  );
}

/** A unit's own page: its classification, every car; before it runs, its forecast. */
function unitPage(w: Weekend, units: readonly Unit[], states: readonly UnitState[], u: Unit): Page {
  const used = nothingUsed();
  const e = u.entries[0];
  const parts: string[] = [];
  if (u.sessions.length) {
    const { hint, body } = unitBody(u);
    parts.push(section('Classification', esc(hint), body));
  } else {
    parts.push(section('Classification', '', '<p class="pd-wk-empty">Not run yet. Its results join this page when it ends.</p>'));
  }
  const side = !u.sessions.length && e ? forecastBox(w, e, used) : '';
  const body =
    `<div class="pd-wkp pd-s-${esc(w.d.slug)}">${unitBand(w, u)}${unitBar(w, units, states, u)}` +
    `<div class="pd-wk-main"><div class="pd-wk-col">${parts.join('')}</div><aside class="pd-wk-aside">${side}${nextRound(w)}</aside></div>${credit(used)}</div>`;
  return { path: sessionPath(w, u.label), title: `${w.r.name} ${w.season}: ${u.label}`, body: htmlBlock(body), template: 'page-wide' };
}

/** The Results page's fold (PR 2's plan): each class's winner, its car, its crew and its team; GT World's a cup at a
 *  time (the row above names the overall winner), a Sprint Cup round's a race at a time. Family C stores no points a
 *  race, so no points table. */
export function classWinners(_d: SeriesData, r: ResultRound): string {
  const races = r.sessions.filter(own);
  const cups = races.some(s => s.tables.some(t => cupAt(t) >= 0));
  const rows = races.flatMap(s =>
    viewsOf(s)
      .filter(v => v.cup || !cups)
      .flatMap(v => {
        const row = v.table.rows[0];
        if (!row) return [];
        const name = v.cup ? v.table.title : v.name;
        return [
          `<tr><td>${esc(races.length > 1 ? `${s.label} · ${name}` : name)}</td><td class="no">${cell(v.table, row, 'No.') ? `#${esc(cell(v.table, row, 'No.'))}` : ''}</td>` +
            `<td class="crew">${esc(cell(v.table, row, CREW))}</td><td class="tm">${esc(cell(v.table, row, 'Team'))}</td></tr>`,
        ];
      }),
  );
  return rows.length
    ? `<div class="pd-wk-scroll"><table class="pd-wk-tbl pd-ec-tbl pd-ec-wins"><thead><tr><th>${cups ? 'Cup' : 'Class'}</th><th class="no">No.</th><th class="crew">Crew</th><th class="tm">Team</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
    : '';
}

/** C5's line on a called-off round's tile (S): where it was first set and when it was called off, from its
 *  cancelledRounds entry in rounds.json (previousStartDate, previousEndDate, rescheduleStatus), which d.cancelled does
 *  not carry: "First set for 26–28 March; called off on 28 July". '' when the entry holds neither. */
export function calledOffLine(raw: unknown): string {
  const c: { previousStartDate?: unknown; previousEndDate?: unknown; rescheduleStatus?: unknown } = typeof raw === 'object' && raw !== null ? raw : {};
  const first = typeof c.previousStartDate === 'string' && typeof c.previousEndDate === 'string' ? `first set for ${longDates(c.previousStartDate, c.previousEndDate)}` : '';
  const line = [first, typeof c.rescheduleStatus === 'string' ? c.rescheduleStatus.trim() : ''].filter(Boolean).join('; ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** What a family C kit needs from the publisher beyond SeriesData. */
export interface EnduranceOptions {
  /** A called-off round's line on its tile (calledOffLine), read from rounds.json by the publisher. */
  offLine?: (slug: string, c: NonNullable<SeriesData['cancelled']>[number]) => string;
  /** A round's sessions called off (sessionsCalledOff), read from rounds.json by the publisher. */
  calledOff?: (slug: string, round: number) => readonly CalledOff[];
  /** The publisher's log, for a weekend's sessions that pair with nothing and those not stored. */
  log?: (line: string) => void;
}

/** Family C's weekend pages: its season, each round's Overview and a page for each unit run or still to run. */
function endurancePages(d: SeriesData, o: EnduranceOptions): Page[] {
  if (!built(d, 'weekends') || !d.season || !d.rounds?.length) return [];
  const season = d.season;
  const offLine = o.offLine;
  const pages: Page[] = [seasonPage(d, season, offLine ? { offLine: c => offLine(d.slug, c) } : {})];
  for (const r of d.rounds) {
    const w = weekendOf(d, season, r);
    const { units, left } = unitsOf(w);
    const off = o.calledOff?.(d.slug, r.round) ?? [];
    const states = unitStates(units, off);
    const dropped = [...(w.result?.others ?? []), ...(w.result?.sessions ?? [])]
      .filter(s => !own(s))
      .map(s => `${s.label}: ${s.tables.some(t => t.rows.length > 0) ? "another championship's cars" : 'no car stored'}, left out`);
    for (const line of [...left, ...dropped, ...units.filter((_, i) => states[i] === 'off').map(u => `${u.label}: not stored`)]) o.log?.(`${d.slug} R${r.round} ${line}`);
    pages.push(overviewPage(w, units, states, off), ...units.flatMap((u, i) => (states[i] === 'run' || states[i] === 'up' ? [unitPage(w, units, states, u)] : [])));
  }
  return pages;
}

/** Family C's kit (O33's registry, scripts/wp-publish.mts): its weekends, its Results fold, and no Overview standings
 *  block until its Standings are drawn (PR 3; Formula 1's drivers beside its constructors do not fit standings kept a
 *  class at a time). */
export function enduranceKit(o: EnduranceOptions = {}): FamilyKit {
  return { weekendPages: d => endurancePages(d, o), resultsFold: classWinners, overviewStandings: () => '' };
}
