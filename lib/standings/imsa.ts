import { fetchUpstream } from '@/lib/fetch-upstream';
import { withSourceSnapshot } from '@/lib/source-snapshot';
import { fetchImsaRoundResults } from '@/lib/results/imsa';
import { loadTeamNames, officialTeamName } from '@/lib/series-content';
import manifest from '@/content/series/imsa/alkamel-rounds.json';

// IMSA WeatherTech SportsCar Championship has four classes that each award
// their own drivers' / teams' / manufacturers' titles. LMP2 is privateer-only
// (every car is the spec Oreca 07 / Gibson) so there is no LMP2 manufacturers'
// championship — see the audit doc `docs/research/per-series-source-audit.md`
// §8 and the championship-rules section on the official 2026 SSR PDF.
export type ImsaClass = 'GTP' | 'LMP2' | 'GTD Pro' | 'GTD';

export const IMSA_CLASSES: readonly ImsaClass[] = [
  'GTP',
  'LMP2',
  'GTD Pro',
  'GTD',
] as const;
export const IMSA_MANUFACTURER_CLASSES: readonly ImsaClass[] = [
  'GTP',
  'GTD Pro',
  'GTD',
] as const;

export interface ImsaDriverStanding {
  position: number;
  // One driver a row, as IMSA's points files list them: a car's crew-mates
  // share a place while their points are level; a page joins them into a crew
  // by their car (lib/wp/endurance.ts).
  driverName: string;
  points: number;
}

export interface ImsaTeamStanding {
  position: number;
  // e.g. "#7 Porsche Penske Motorsport": the car number and the team as the
  // points files name them, spelled by team-names.json; `car` is the model
  // that number last raced in the class, from the season's race files.
  team: string;
  car?: string;
  points: number;
}

export interface ImsaManufacturerStanding {
  position: number;
  manufacturer: string;
  points: number;
}

export interface ImsaStandings {
  drivers: Record<ImsaClass, ImsaDriverStanding[]>;
  teams: Record<ImsaClass, ImsaTeamStanding[]>;
  // LMP2 manufacturers' championship doesn't exist; the key is omitted rather
  // than included as an empty array so consumers can iterate
  // IMSA_MANUFACTURER_CLASSES safely.
  manufacturers: Partial<Record<ImsaClass, ImsaManufacturerStanding[]>>;
}

// Sanity floor across all four drivers' tables. IMSA's points files list a
// driver a row, crew-mates sharing a place: about 265 rows in 2026, 40 in GTP
// alone. 30 is the floor before we fail closed and let the StandingsTab render
// its placeholder rather than ship a misleadingly-partial table.
const MIN_TOTAL_DRIVER_ROWS = 30;

// IMSA's own championship points, as the data files its timing provider Al
// Kamel files beside the official points PDF after every round, on the open
// Apache index the results loader reads (lib/results/imsa.ts): in each event's
// WeatherTech folder, "POINTS DATA - Official/IWSC 08 GTDPRO Drivers.csv" and
// its ten siblings, "Pos;Participant;Points;…" a row; a teams file adds a Team
// column. No file names a car's model: the season's race files give it.
const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/csv,text/html,*/*',
};

/** Each class's files (IMSA awards no LMP2 manufacturers' title). */
const POINTS_FILES: Record<ImsaClass, { drivers: string; teams: string; manufacturers?: string }> = {
  GTP: { drivers: 'IWSC 01 GTP Drivers', teams: 'IWSC 02 GTP Teams', manufacturers: 'IWSC 03 GTP Manufacturers' },
  LMP2: { drivers: 'IWSC 04 LMP2 Drivers', teams: 'IWSC 05 LMP2 Teams' },
  'GTD Pro': { drivers: 'IWSC 08 GTDPRO Drivers', teams: 'IWSC 09 GTDPRO Teams', manufacturers: 'IWSC 10 GTDPRO Manufacturers' },
  GTD: { drivers: 'IWSC 11 GTD Drivers', teams: 'IWSC 12 GTD Teams', manufacturers: 'IWSC 13 GTD Manufacturers' },
};
const FILE_NAMES: string[] = IMSA_CLASSES.flatMap(c => [POINTS_FILES[c].drivers, POINTS_FILES[c].teams, ...(POINTS_FILES[c].manufacturers ? [POINTS_FILES[c].manufacturers] : [])]);

const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** A round's WeatherTech folder: its results URL cut after the championship's own segment
 *  (".../21_Road%20Atlanta/01_IMSA%20WeatherTech%20SportsCar%20Championship/"). Found by the
 *  championship's name, not by "WeatherTech": Laguna Seca's event folder is "09_Weathertech Raceway
 *  Laguna Seca". */
export function championshipFolder(url: string): string | null {
  const parts = url.split('/');
  const i = parts.findIndex(p => /sportscar championship/i.test(safeDecode(p)));
  return i < 0 ? null : `${parts.slice(0, i + 1).join('/')}/`;
}

/** The folders an Apache index lists, decoded ("POINTS DATA - Official"); not its parent or its sort links. */
export function indexFolders(html: string): string[] {
  return [...html.matchAll(/href="([^"?/][^"]*)\/"/g)].map(m => safeDecode(m[1]));
}

/** The points folder among a round's folders: the official one (VIR's is spelt "Offiical"), else the
 *  provisional one, else a plain "POINTS DATA" (Daytona's and Laguna Seca's); null before either is filed.
 *  An "Unofficial" folder is not the official one. */
export function pointsFolderOf(folders: readonly string[]): string | null {
  const points = folders.filter(f => /^points\s*data\b/i.test(f));
  return points.find(f => /\boffi/i.test(f)) ?? points.find(f => /provisional/i.test(f)) ?? points.find(f => /^points\s*data$/i.test(f.trim())) ?? null;
}

export interface PointsRow {
  position: number;
  /** A driver, a car number ("068") or a make, as the file writes it. */
  name: string;
  points: number;
  /** A teams file's Team column ("Car Blanche"); '' in the other files. */
  team: string;
}

/** A points file: a byte-order mark, the head "Pos;Participant;Points;…", then a participant a row. Null
 *  when the head or any row is not that: a file read wrongly (an error page answered with a 200) is no file. */
export function parsePointsCsv(text: string): PointsRow[] | null {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(l => l.trim() !== '');
  const head = (lines[0] ?? '').split(';');
  if (head[0] !== 'Pos' || head[1] !== 'Participant' || head[2] !== 'Points') return null;
  const teamAt = head.indexOf('Team');
  const rows: PointsRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(';');
    const [pos = '', name = '', points = ''] = cells;
    const position = Number(pos);
    const value = Number(points);
    if (!Number.isInteger(position) || position < 1 || points.trim() === '' || !Number.isFinite(value) || name.trim() === '') return null;
    rows.push({ position, name: name.trim(), points: value, team: teamAt < 0 ? '' : (cells[teamAt] ?? '').trim() });
  }
  return rows.length ? rows : null;
}

/** Each class's car models by number ("68" → "Aston Martin Vantage GT3 Evo"). */
type CarModels = Partial<Record<ImsaClass, ReadonlyMap<string, string>>>;

const byPosition = (a: { position: number }, b: { position: number }): number => a.position - b.position;

/** The standings from the eleven files as parsed (by name), each team spelled by `spell` (team-names.json) and given
 *  its car model; null unless every class reads whole. */
function standingsFromPoints(files: Readonly<Record<string, PointsRow[] | null>>, models: CarModels, spell: (team: string) => string): ImsaStandings | null {
  const drivers = {} as Record<ImsaClass, ImsaDriverStanding[]>;
  const teams = {} as Record<ImsaClass, ImsaTeamStanding[]>;
  const manufacturers: Partial<Record<ImsaClass, ImsaManufacturerStanding[]>> = {};
  for (const cls of IMSA_CLASSES) {
    const f = POINTS_FILES[cls];
    const d = files[f.drivers];
    const t = files[f.teams];
    if (!d || !t) return null;
    drivers[cls] = d.map(x => ({ position: x.position, driverName: x.name, points: x.points })).sort(byPosition);
    teams[cls] = t
      .map(x => ({ position: x.position, team: x.team ? `#${x.name} ${spell(x.team)}` : `#${x.name}`, car: models[cls]?.get(x.name) || undefined, points: x.points }))
      .sort(byPosition);
    if (f.manufacturers) {
      const m = files[f.manufacturers];
      if (!m) return null;
      manufacturers[cls] = m.map(x => ({ position: x.position, manufacturer: x.name, points: x.points })).sort(byPosition);
    }
  }
  if (IMSA_CLASSES.reduce((n, c) => n + drivers[c].length, 0) < MIN_TOTAL_DRIVER_ROWS) return null;
  return { drivers, teams, manufacturers };
}

async function readText(url: string): Promise<string | null> {
  try {
    const res = await fetchUpstream(url, {
      headers: FETCH_HEADERS,
      // Hourly, as the results loader: a round's official files are frozen once filed.
      next: { revalidate: 3600 },
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** The newest round's points folder: the season's rounds newest first, the first whose WeatherTech folder
 *  lists one (a round just raced files its points hours later). An index that cannot be read, or a round whose
 *  URL names no WeatherTech folder, ends the search, so an older round's points never stand in for the newest's. */
async function latestPointsFolder(): Promise<string | null> {
  const rounds = [...(manifest.rounds ?? [])].sort((a, b) => b.round - a.round);
  for (const r of rounds) {
    const base = championshipFolder(r.url);
    if (!base) return null;
    const html = await readText(base);
    if (html === null) return null;
    const folder = pointsFolderOf(indexFolders(html));
    if (folder) return `${base}${encodeURIComponent(folder)}/`;
  }
  return null;
}

/** Each class's car models for the numbers its teams file lists, from the season's race files read one at a time,
 *  newest first, until every number has one: the model each number last raced, without a burst of requests (the
 *  politeness scripts/warm-live-data.mts keeps for these hosts). Null when no race file answers, so a run that
 *  cannot read them keeps the stored tables rather than store teams without their cars. */
async function carModels(wanted: Readonly<Record<ImsaClass, readonly string[]>>): Promise<CarModels | null> {
  const out: Partial<Record<ImsaClass, Map<string, string>>> = {};
  const complete = (): boolean => IMSA_CLASSES.every(c => wanted[c].every(no => out[c]?.has(no)));
  let answered = false;
  for (const r of [...(manifest.rounds ?? [])].sort((a, b) => b.round - a.round)) {
    if (answered && complete()) break;
    const race = await fetchImsaRoundResults(r.url, r.round);
    if (!race) continue;
    answered = true;
    for (const cls of IMSA_CLASSES) {
      for (const e of race.perClass[cls] ?? []) {
        const known = (out[cls] ??= new Map<string, string>());
        if (e.vehicle && !known.has(e.carNumber)) known.set(e.carNumber, e.vehicle);
      }
    }
  }
  return answered ? out : null;
}

async function fetchImsaStandingsLive(): Promise<ImsaStandings | null> {
  const folder = await latestPointsFolder();
  if (!folder) return null;
  const texts = await Promise.all(FILE_NAMES.map(n => readText(`${folder}${encodeURIComponent(`${n}.csv`)}`)));
  const files = Object.fromEntries(FILE_NAMES.map((n, i) => [n, texts[i] === null ? null : parsePointsCsv(texts[i])]));
  if (FILE_NAMES.some(n => files[n] === null)) return null;
  try {
    const wanted = Object.fromEntries(IMSA_CLASSES.map(c => [c, (files[POINTS_FILES[c].teams] ?? []).map(x => x.name)])) as Record<ImsaClass, string[]>;
    const [models, names] = await Promise.all([carModels(wanted), loadTeamNames('imsa')]);
    if (!models) return null;
    const season = String(manifest.season);
    return standingsFromPoints(files, models, team => officialTeamName(names, season, team));
  } catch {
    return null;
  }
}

/**
 * Public IMSA standings fetch, wrapped in the durable `source_snapshot`
 * last-good. The live parse fails closed (null) unless every class populated, so
 * on Cloudflare — whose egress IPs the source blocks — this serves the last
 * payload the clean-IP warm cron wrote. Under `DATA_SOURCE=db` the snapshot is
 * read directly and the upstream page is never fetched.
 */
export async function fetchImsaStandings(): Promise<ImsaStandings | null> {
  return withSourceSnapshot<ImsaStandings | null>(
    'standings:imsa',
    fetchImsaStandingsLive,
    v => v == null || IMSA_CLASSES.every(c => (v.drivers[c]?.length ?? 0) === 0),
  );
}
