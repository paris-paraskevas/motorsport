// Family C's data (slot O34): FIA WEC, IMSA and GT World Challenge, every session of a round, each car's crew from its
// own race and every name spelled as the series' drivers.json spells it (the operator's answers C2 and All 3 of 25 Oct,
// and the correction that day: never a car's crew from drivers.json). Pure, as render.ts: the sources' pages and files
// in, the stored shapes out. The publisher (scripts/wp-publish.mts, family C's block) fetches and keeps them; the pages
// that read them join this file in O34's second PR.
//
// Every table keeps C2's columns: Pos, No. (the car number without its "#"), Crew (the drivers joined by ", "), Team,
// then the session's own (a race's Laps, Time and Gap; a timed session's best lap as Time, then Laps and Gap; GT World's
// Cup after the team). The Crew column also tells a round stored in this shape from one stored before it (inShape).

import * as cheerio from 'cheerio';
import type { SeriesRoundEntry } from '@/lib/types';
import type { ResultRound, ResultSession, Table } from './render';

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
        const gap = clean(e.gap_first) || (status && !/^classified$/i.test(status) ? status : '');
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
 *  cannot spell). Asked once; kept. */
export interface WecCrews {
  races: Record<string, Record<string, string[]>>;
  drivers: Record<string, { card: string; name?: string }>;
}

export const emptyCrews = (): WecCrews => ({ races: {}, drivers: {} });

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

/** The car pages a run reads: every car in a stored round's tables whose crew for that race is not yet kept, the newest
 *  round first. */
export function wecCarsDue(rounds: readonly ResultRound[], raceIds: ReadonlyMap<number, number>, crews: WecCrews): { raceId: number; car: string }[] {
  const out: { raceId: number; car: string }[] = [];
  const seen = new Set<string>();
  for (const r of [...rounds].sort((a, b) => (b.round ?? 0) - (a.round ?? 0))) {
    const raceId = raceIdOf(raceIds, r);
    if (raceId === undefined) continue;
    for (const t of [...r.sessions, ...(r.others ?? [])].flatMap(s => s.tables)) {
      const car = t.columns.indexOf('No.');
      if (car < 0 || !t.columns.includes(CREW)) continue;
      for (const row of t.rows) {
        const key = `${raceId}|${row[car]}`;
        if (!row[car] || seen.has(key) || crews.races[String(raceId)]?.[row[car]]) continue;
        seen.add(key);
        out.push({ raceId, car: row[car] });
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
 * "DSQ") after the classified places, marked so in Pos. Null when the session has no row.
 */
export function gtTable(html: string, title: string, spell: (name: string) => string | null): Table | null {
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
        const name = GT_COLUMN[h] ?? h.replace(/(^|\s)(\p{Ll})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
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
 * file's shape. A round settled and stored is never asked again.
 */
export function roundsDue(rounds: readonly Pick<SeriesRoundEntry, 'round' | 'startDate' | 'endDate'>[], stored: readonly ResultRound[] | null, now: Date, max: number, settleDays = 7): number[] {
  const today = now.toISOString().slice(0, 10);
  const kept = new Map((stored ?? []).filter(r => r.round !== null).map(r => [r.round as number, r]));
  return rounds
    .filter(r => r.startDate <= today && (dayAfter(r.endDate, settleDays) >= today || !inShape(kept.get(r.round))))
    .sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0))
    .slice(0, Math.max(0, max))
    .map(r => r.round);
}

/** A fetched round from its sessions in running order: the races its `sessions`, the rest its `others`; named and dated
 *  as rounds.json names and dates it, as the Calendar does. */
export function fetchedRound(entry: Pick<SeriesRoundEntry, 'round' | 'name' | 'endDate'>, sessions: readonly (ResultSession & { race: boolean })[]): ResultRound {
  const strip = ({ label, tables }: ResultSession): ResultSession => ({ label, tables });
  const races = sessions.filter(s => s.race).map(strip);
  const others = sessions.filter(s => !s.race).map(strip);
  return { round: entry.round, name: entry.name, date: entry.endDate, sessions: races, ...(others.length ? { others } : {}) };
}

/** The fetched rounds over the stored ones, oldest first: a fetched session replaces the stored session of its label, a
 *  stored session the fetch did not bring back is kept (a failed request never loses a table), and every other round
 *  stays as stored. */
export function mergeRounds(fresh: readonly ResultRound[], stored: readonly ResultRound[] | null): ResultRound[] {
  const key = (r: ResultRound): string => (r.round !== null ? `r${r.round}` : `e${r.name}`);
  const out = new Map((stored ?? []).map(r => [key(r), r]));
  const over = (a: readonly ResultSession[] | undefined, b: readonly ResultSession[] | undefined): ResultSession[] => {
    const labels = new Set((b ?? []).map(s => s.label));
    return [...(b ?? []), ...(a ?? []).filter(s => !labels.has(s.label))];
  };
  for (const f of fresh) {
    const s = out.get(key(f));
    const others = over(s?.others, f.others);
    out.set(key(f), { ...f, sessions: over(s?.sessions, f.sessions), ...(others.length ? { others } : {}) });
  }
  return [...out.values()].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.round ?? 0) - (b.round ?? 0));
}
