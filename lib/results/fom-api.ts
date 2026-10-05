import type { RaceResult, RaceResultEntry, DriverStanding, ConstructorStanding } from '@/lib/types';
import type { SessionClassification, SessionClassificationEntry } from '@/lib/results/openf1';
import { fetchUpstream } from '@/lib/fetch-upstream';
import { readResultsCache, writeResultsCache } from '@/lib/results-cache';
import { withSourceSnapshot } from '@/lib/source-snapshot';
import type { SeriesRoundEntry } from '@/lib/types';
import fs from '@/lib/content-fs';
import path from 'path';

export type { RaceResult, RaceResultEntry };

// Shared client for the FIA Formula 2 / Formula 3 results, which are served by
// the same FOM backend (api.formula1.com) as the F1 site. The public F2/F3
// websites are Next.js App-Router apps that render only ONE session server-side
// and load the rest client-side from this JSON API — so scraping the HTML would
// only ever yield the feature race (verified 2026-07-20). We call the API
// directly, exactly as the site's own client does. This is the same shape of
// source as the MotoGP/WSBK Pulselive parsers.
//
// ⚠ LANDMINE: the per-brand `apikey` values below are the PUBLIC keys embedded
// in each site's client bundle (flight config `"key":{"public":"…"}`). They are
// not secret, but they are not ours — if FOM rotates one, that series' results
// go EMPTY (health:results turns red) until the new key is re-scraped from
// https://www.fiaformula{2,3}.com. The parser is fail-soft (returns an empty
// bundle, never throws), so a rotation degrades to last-good KV cache rather
// than a crash. Keys verified working 2026-07-20 (points reconcile to the
// championship totals for all F2 + F3 drivers).
const API_BASE = 'https://api.formula1.com/v2/core-fom-results';
const API_KEYS: Record<FomBrand, string> = {
  f2: 'MsEALPOPbzgjZIWE6GmU2O69VKY8zZpi',
  f3: 'gGX8kMJ7NQmaRfrltWE0xrGgHaEfv1Cn',
};

// Concurrency cap for the per-meeting fan-out. Each completed meeting issues up
// to 4 session calls; capping meeting-level concurrency keeps in-flight
// requests modest and polite to the origin.
const MAX_CONCURRENT_MEETINGS = 4;

export type FomBrand = 'f2' | 'f3';

// ---- API response shapes (only the fields we read) ----------------------

export interface FomRaceSession {
  description?: string; // "SPRINT RACE" | "FEATURE RACE"
  sessionNumber?: number;
}

export interface FomMeeting {
  meetingKey?: number | string;
  meetingCountryName?: string;
  meetingLocation?: string;
  meetingStartDate?: string; // "2026-03-06"
  meetingEndDate?: string;
  raceSessions?: FomRaceSession[];
  url?: string;
}

export interface FomStandingRow {
  position?: string; // "1st", "2nd", …
  driverReference?: string;
  driverFirstName?: string;
  driverLastName?: string;
  driverShortName?: string;
  driverTLA?: string;
  championshipPoints?: number;
  // Per-round [sprint, feature] canonical points. Column index = round-1.
  // Validated: summing these equals championshipPoints for every driver, so
  // this — NOT the per-session `racePoints` field, which omits pole/fastest-lap
  // bonuses — is the canonical points source.
  points?: Array<Array<number | null>>;
}

export interface FomManifest {
  season?: string;
  meetings?: FomMeeting[];
  standings?: FomStandingRow[];
}

export interface FomResultRow {
  completionStatusCode?: string | null; // "OK" | "DNF" | "DSQ" | "DNS" | null (timed sessions)
  positionNumber?: string; // "1".."N" for classified, "666" sentinel for unclassified
  displayPosition?: string; // "1".. or "NC"/"DNF" for non-finishers
  racePoints?: number;
  driverReference?: string;
  driverFirstName?: string;
  driverLastName?: string;
  driverShortName?: string;
  driverTLA?: string;
  teamName?: string;
  displayTime?: string | null; // leader total ("56:05.248"), gap ("+1.669s"), or "DNF"
  gapToLeader?: string | null;
}

export interface FomSessionResponse {
  sessionResults?: {
    session?: string;
    shortName?: string;
    sessionType?: string;
    results?: FomResultRow[];
  };
  // Round metadata for the session's meeting (circuit/country/dates). NOTE the
  // API carries NO F2/F3 round number here — the only round number present
  // anywhere is the F1 GP number, which differs (F2/F3 skip some GPs). The
  // championship round is the meeting's index in the manifest (see below).
  meeting?: {
    circuitOfficialName?: string;
    meetingCountryName?: string;
    meetingLocation?: string;
    meetingEndDate?: string;
    meetingStartDate?: string;
  };
}

// ---- Fetch --------------------------------------------------------------

async function fetchFomJson<T>(brand: FomBrand, path: string): Promise<T | null> {
  try {
    const res = await fetchUpstream(`${API_BASE}/${brand}${path}`, {
      headers: {
        apikey: API_KEYS[brand],
        locale: 'en',
        Accept: 'application/json',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---- Points lookup ------------------------------------------------------

// Every race of a meeting, in the manifest's order: [sprint, feature] in an ordinary weekend, [sprint, feature 1,
// feature 2] when a race is carried over (Formula 2 at Baku and Formula 3 at Madrid in 2026). The cells of a driver's
// per-round `points` follow the same order, so a race's points are read at its own index.
type PointsLookup = Map<string, Array<Array<number | null>>>;
type SessionIndex = number; // the race's index among the meeting's race sessions: 0 = sprint, 1 = the (first) feature.

export function buildPointsLookup(standings: FomStandingRow[] | undefined): PointsLookup {
  const map: PointsLookup = new Map();
  for (const row of standings ?? []) {
    if (!row.driverReference || !Array.isArray(row.points)) continue;
    map.set(
      row.driverReference,
      row.points.map(cells => (Array.isArray(cells) ? cells.map(c => (typeof c === 'number' ? c : null)) : [])),
    );
  }
  return map;
}

// Rounds (1-indexed) with at least one non-null points cell — i.e. a race has
// happened. Data-driven so we fetch sessions only for meetings that ran, with
// no calendar/date logic. A mid-weekend round with a completed sprint but no
// feature yet still counts (its sprint column is non-null); the missing feature
// call simply returns nothing and is skipped.
export function completedRounds(standings: FomStandingRow[] | undefined): Set<number> {
  const out = new Set<number>();
  for (const row of standings ?? []) {
    row.points?.forEach((pair, i) => {
      if (Array.isArray(pair) && pair.some(c => c !== null)) out.add(i + 1);
    });
  }
  return out;
}

function pointsFor(
  lookup: PointsLookup,
  driverReference: string | undefined,
  round: number,
  session: SessionIndex,
): number {
  if (!driverReference) return 0;
  const val = lookup.get(driverReference)?.[round - 1]?.[session];
  return typeof val === 'number' ? val : 0;
}

// ---- Mapping ------------------------------------------------------------

function driverName(r: { driverFirstName?: string; driverLastName?: string; driverShortName?: string }): string | null {
  if (r.driverFirstName && r.driverLastName) return `${r.driverFirstName} ${r.driverLastName}`;
  return r.driverShortName ?? null;
}

function isClassified(r: FomResultRow): boolean {
  // Classified rows carry a numeric finishing position; unclassified rows use
  // the "666" sentinel (displayPosition then reads "NC"/"DNF"/…).
  return /^\d+$/.test(r.positionNumber ?? '') && r.positionNumber !== '666';
}

/**
 * Map a race session (feature or sprint) to a RaceResult. Finishing order and
 * status come from the session results; POINTS come from the canonical
 * per-round standings breakdown (matched by driverReference), never from the
 * session row's `racePoints` (which omits pole / fastest-lap bonuses).
 */
export function mapRaceResult(
  data: FomSessionResponse | null,
  round: number,
  kind: 'feature' | 'sprint',
  meeting: FomMeeting,
  points: PointsLookup,
  // The race's place among the meeting's race sessions and the feed's own name for it ("Feature Race 2"); the two-race
  // defaults when absent. `pointsRound` is the meeting's position in the manifest, which keys the points cells; it
  // equals `round` unless the curated calendar numbers the rounds differently (Formula 3 skipped its round 2 in 2026).
  session?: { index: number; name: string },
  pointsRound: number = round,
): RaceResult | null {
  const rows = data?.sessionResults?.results;
  if (!rows || rows.length === 0) return null;

  const m = data?.meeting;
  const country = m?.meetingCountryName ?? meeting.meetingCountryName ?? 'Round';
  const circuit =
    m?.circuitOfficialName ?? m?.meetingLocation ?? meeting.meetingLocation ?? country;
  const dateStr = m?.meetingEndDate ?? meeting.meetingEndDate ?? meeting.meetingStartDate;
  const date = dateStr ? new Date(`${dateStr}T00:00:00Z`) : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  const raceName = `${country} ${session?.name ?? (kind === 'feature' ? 'Feature Race' : 'Sprint Race')}`;
  const sessionIdx: SessionIndex = session?.index ?? (kind === 'feature' ? 1 : 0);

  const classified = rows
    .filter(isClassified)
    .sort((a, b) => Number(a.positionNumber) - Number(b.positionNumber));
  const unclassified = rows.filter(r => !isClassified(r));

  const entries: RaceResultEntry[] = [];
  const toEntry = (r: FomResultRow, position: number): RaceResultEntry | null => {
    const name = driverName(r);
    if (!name) return null;
    const finished = (r.completionStatusCode ?? 'OK') === 'OK';
    return {
      position,
      driverName: name,
      driverCode: r.driverTLA,
      team: r.teamName ?? 'Unknown',
      // "Finished" for classified finishers; the raw status code ("DNF"/"DSQ"/
      // "DNS") otherwise — falling back to the display label ("NC").
      status: finished ? 'Finished' : r.completionStatusCode || r.displayPosition || 'DNF',
      time: r.displayTime ?? undefined,
      points: pointsFor(points, r.driverReference, pointsRound, sessionIdx),
    };
  };

  for (const r of classified) {
    const e = toEntry(r, Number(r.positionNumber));
    if (e) entries.push(e);
  }
  // Unclassified rows get synthetic positions after the last classified one, in
  // source order, so table sorting stays well-defined.
  let next = classified.length + 1;
  for (const r of unclassified) {
    const e = toEntry(r, next++);
    if (e) entries.push(e);
  }

  if (entries.length === 0) return null;
  return { round, raceName, date, circuit, results: entries };
}

/**
 * Map a timed session (qualifying or practice) to a SessionClassification.
 * These sessions carry no points and no completion status; rows are ranked by
 * finishing position, with the best lap in `time` and gap-to-leader in `gap`.
 */
export function mapClassification(data: FomSessionResponse | null): SessionClassification | null {
  const rows = data?.sessionResults?.results;
  if (!rows || rows.length === 0) return null;

  const ranked = [...rows].sort(
    (a, b) => positionOrInf(a) - positionOrInf(b),
  );

  const entries: SessionClassificationEntry[] = [];
  for (const r of ranked) {
    const name = driverName(r);
    if (!name || !r.teamName) continue;
    const timed = isClassified(r);
    const gap = r.gapToLeader?.trim();
    entries.push({
      position: timed ? Number(r.positionNumber) : null,
      driverName: name,
      driverCode: r.driverTLA,
      team: r.teamName,
      time: r.displayTime ?? undefined,
      gap: gap && gap !== '0' ? (gap.startsWith('+') ? gap : `+${gap}`) : undefined,
      status: timed ? undefined : nonTimedStatus(r.completionStatusCode),
    });
  }
  if (entries.length === 0) return null;
  return { isQualifying: false, isRace: false, entries };
}

function positionOrInf(r: FomResultRow): number {
  return isClassified(r) ? Number(r.positionNumber) : Number.MAX_SAFE_INTEGER;
}

// SessionClassificationEntry.status is a strict union. A timed-session row that
// set no lap (positionNumber "666", displayPosition "NC") maps to DNS unless the
// API flags a specific retirement (DNF/DSQ).
function nonTimedStatus(code: string | null | undefined): 'DNS' | 'DNF' | 'DSQ' {
  return code === 'DNF' || code === 'DSQ' ? code : 'DNS';
}

// ---- Orchestration ------------------------------------------------------

export interface FomRoundClassification {
  round: number;
  data: SessionClassification;
}

export interface FomSeasonBundle {
  feature: RaceResult[];
  sprint: RaceResult[];
  qualifying: FomRoundClassification[];
  practice: FomRoundClassification[];
}

const EMPTY_BUNDLE: FomSeasonBundle = { feature: [], sprint: [], qualifying: [], practice: [] };

function bundleCacheKey(brand: FomBrand, season: number): string {
  return `paddock:results:fom:${brand}:season:${season}`;
}

async function mapWithLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
}

/**
 * Fetch a full F2/F3 season from the FOM API: one manifest call for the meeting
 * list + canonical points, then per-completed-round session fan-out. Fail-soft
 * throughout (empty bundle on any failure). Cached under a season key so the
 * fan-out runs at most once per 3-hour window.
 */
/** The feed's session description as a race name: "FEATURE RACE 2" → "Feature Race 2". */
function raceSessionName(description: string | undefined, kind: 'feature' | 'sprint'): string {
  const words = (description ?? '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return words || (kind === 'feature' ? 'Feature Race' : 'Sprint Race');
}

/** The site's round number of a meeting: the curated round whose dates overlap the meeting's (the feed opens a
 *  weekend a day before the curated calendar does, Monaco's Thursday), else the meeting's position in the feed. */
export function roundOfMeeting(meeting: FomMeeting, position: number, rounds?: readonly SeriesRoundEntry[]): number {
  const start = meeting.meetingStartDate;
  const end = meeting.meetingEndDate ?? start;
  if (start && end && rounds) {
    const hit = rounds.find(r => r.startDate <= end && start <= r.endDate);
    if (hit) return hit.round;
  }
  return position;
}

async function fetchFomSeasonLive(brand: FomBrand, season: number, rounds?: readonly SeriesRoundEntry[]): Promise<FomSeasonBundle> {
  const cacheKey = bundleCacheKey(brand, season);
  const cached = await readResultsCache<FomSeasonBundle>(cacheKey);
  if (cached) return cached;

  const manifest = await fetchFomJson<FomManifest>(
    brand,
    `/driver-standings-breakdown?season=${season}`,
  );
  const meetings = manifest?.meetings ?? [];
  if (meetings.length === 0) return EMPTY_BUNDLE;

  const points = buildPointsLookup(manifest?.standings);
  const done = completedRounds(manifest?.standings);
  const calendar = rounds ?? (await curatedRounds(brand));

  const bundle: FomSeasonBundle = { feature: [], sprint: [], qualifying: [], practice: [] };

  // Round = manifest index + 1 (the F2/F3 championship round; validated against
  // the points columns, which align 1:1 with meeting order).
  const targets = meetings
    .map((meeting, i) => ({ meeting, position: i + 1, round: roundOfMeeting(meeting, i + 1, calendar) }))
    .filter(({ position }) => done.has(position));

  await mapWithLimit(targets, MAX_CONCURRENT_MEETINGS, async ({ meeting, position, round }) => {
    const key = meeting.meetingKey;
    if (key == null) return;
    // Every race session of the meeting, in the feed's order; a third race (a feature carried over) is one more.
    const races = (meeting.raceSessions ?? [])
      .map((s, index) => ({ s, index, kind: /SPRINT/i.test(s.description ?? '') ? ('sprint' as const) : /FEATURE/i.test(s.description ?? '') ? ('feature' as const) : null }))
      .filter((r): r is { s: FomRaceSession; index: number; kind: 'feature' | 'sprint' } => r.kind !== null);

    const [raceData, qualData, pracData] = await Promise.all([
      Promise.all(races.map(r => fetchFomJson<FomSessionResponse>(brand, `/race?meeting=${key}&session=${r.s.sessionNumber}`))),
      fetchFomJson<FomSessionResponse>(brand, `/qualifying?meeting=${key}`),
      fetchFomJson<FomSessionResponse>(brand, `/practice?meeting=${key}&session=0`),
    ]);

    races.forEach((r, i) => {
      const mapped = mapRaceResult(raceData[i], round, r.kind, meeting, points, { index: r.index, name: raceSessionName(r.s.description, r.kind) }, position);
      if (mapped) (r.kind === 'feature' ? bundle.feature : bundle.sprint).push(mapped);
    });
    const q = mapClassification(qualData);
    if (q) bundle.qualifying.push({ round, data: q });
    const p = mapClassification(pracData);
    if (p) bundle.practice.push({ round, data: p });
  });

  const byRoundThenName = (a: RaceResult, b: RaceResult) => a.round - b.round || a.raceName.localeCompare(b.raceName);
  bundle.feature.sort(byRoundThenName);
  bundle.sprint.sort(byRoundThenName);
  bundle.qualifying.sort((a, b) => a.round - b.round);
  bundle.practice.sort((a, b) => a.round - b.round);

  if (bundle.feature.length > 0 || bundle.sprint.length > 0) {
    await writeResultsCache(cacheKey, bundle);
  }
  return bundle;
}

/**
 * Public season fetch (F2 + F3 results AND their weekend session pages), layered
 * over the durable `source_snapshot` last-good beneath the 3-hour KV window. The
 * KV tier is evictable and short; the snapshot is what keeps the tabs populated
 * on Cloudflare, whose egress IPs api.formula1.com rate-limits. Under
 * `DATA_SOURCE=db` the snapshot is read directly and the API is never called.
 *
 * `RaceResult.date` is a `Date`; jsonb stores it as an ISO string, so the read
 * path rehydrates it (the F2/F3 tabs call `.toLocaleDateString` on it).
 */
export async function fetchFomSeason(brand: FomBrand, season: number, rounds?: readonly SeriesRoundEntry[]): Promise<FomSeasonBundle> {
  const bundle = await withSourceSnapshot<FomSeasonBundle>(
    `results:fom:${brand}:${season}`,
    () => fetchFomSeasonLive(brand, season, rounds),
    v => v == null || (v.feature.length === 0 && v.sprint.length === 0),
  );
  return reviveBundleDates(bundle);
}

/** The curated calendar of the brand (content/series/<slug>/rounds.json, through the content file system the series
 *  loader reads), read when the caller passes none; nothing when the file is missing, so the meeting's position stands. */
async function curatedRounds(brand: FomBrand): Promise<readonly SeriesRoundEntry[] | undefined> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'content', 'series', brand, 'rounds.json'), 'utf-8');
    const parsed = JSON.parse(raw) as { rounds?: SeriesRoundEntry[] };
    return Array.isArray(parsed.rounds) ? parsed.rounds : undefined;
  } catch {
    return undefined;
  }
}

/** jsonb round-trips `Date` → ISO string; restore it on every race row. */
function reviveBundleDates(bundle: FomSeasonBundle | undefined): FomSeasonBundle {
  // The wrapper's catch can surface `undefined` (no snapshot, fetcher threw);
  // every caller destructures the bundle, so normalise to the empty shape.
  if (!bundle) return EMPTY_BUNDLE;
  const races = (rows: RaceResult[]): RaceResult[] =>
    rows.map(r => (r.date instanceof Date ? r : { ...r, date: new Date(r.date as unknown as string) }));
  return {
    ...bundle,
    feature: races(bundle.feature ?? []),
    sprint: races(bundle.sprint ?? []),
  };
}

// ---- Standings ----------------------------------------------------------

interface FomConstructorRow {
  position?: string;
  teamName?: string;
  championshipPoints?: number;
  points?: Array<Array<number | null>>;
}
interface FomConstructorManifest {
  standings?: FomConstructorRow[];
}

export interface FomStandings {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
}

// "1st" -> 1, "2nd" -> 2, …; null when unparseable (caller falls back to index).
function parseOrdinal(pos: string | undefined): number | null {
  const m = pos?.match(/\d+/);
  return m ? Number(m[0]) : null;
}

// Feature-race wins from the per-round [SR, FR] points: a Feature win scores
// >= 25 (25 base plus any pole / fastest-lap bonus). The best non-win — P2 (18)
// + pole (2) + FL (1) = 21 — stays below 25, so >= 25 uniquely identifies a win.
// (The pre-rewrite parser used == 25, which the bonus-inclusive FOM values
// would undercount.) Constructor wins are intentionally NOT derived this way:
// a team's per-round FR is its two cars combined, so >= 25 does not imply a win.
const FEATURE_WIN_MIN = 25;
function countFeatureWins(points: Array<Array<number | null>> | undefined): number {
  if (!Array.isArray(points)) return 0;
  // A feature win scores at least 25; no sprint cell can (a sprint win with the fastest lap is 11), so every cell of
  // a round counts, the carried-over third race included.
  return points.reduce((n, cells) => n + (Array.isArray(cells) ? cells.filter(c => typeof c === 'number' && c >= FEATURE_WIN_MIN).length : 0), 0);
}

// The driver-standings breakdown carries NO team, so join driverReference ->
// team from the latest completed round's feature race (which lists team per
// entry). A driver absent from that race (reserve / one-off) gets an empty team;
// StandingsTab hides the team column only when EVERY driver lacks one, so this
// degrades cleanly.
async function driverTeamMap(brand: FomBrand, meetings: FomMeeting[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const today = new Date().toISOString().slice(0, 10);
  const started = meetings.filter(m => (m.meetingStartDate ?? '') <= today && (m.raceSessions?.length ?? 0) > 0);
  const latest = started[started.length - 1];
  const feature = latest?.raceSessions?.find(s => /FEATURE/i.test(s.description ?? ''));
  if (!latest?.meetingKey || !feature) return map;
  const data = await fetchFomJson<FomSessionResponse>(brand, `/race?meeting=${latest.meetingKey}&session=${feature.sessionNumber}`);
  for (const r of data?.sessionResults?.results ?? []) {
    if (r.driverReference && r.teamName) map.set(r.driverReference, r.teamName);
  }
  return map;
}

/**
 * Driver + constructor championship standings from the FOM breakdown endpoints
 * (the same source the rebuilt fiaformula{2,3}.com standings pages use). Returns
 * null only when BOTH tables come back empty (source down), so the caller's
 * source-snapshot serves last-good. Position comes from the breakdown ordinal
 * ("1st") with an index fallback; driver team is joined from the latest race.
 */
export async function fetchFomStandings(brand: FomBrand, season: number): Promise<FomStandings | null> {
  const [driverBd, teamBd] = await Promise.all([
    fetchFomJson<FomManifest>(brand, `/driver-standings-breakdown?season=${season}`),
    fetchFomJson<FomConstructorManifest>(brand, `/constructor-standings-breakdown?season=${season}`),
  ]);
  const driverRows = driverBd?.standings ?? [];
  const teamRows = teamBd?.standings ?? [];
  if (driverRows.length === 0 && teamRows.length === 0) return null;

  const teamByDriver = await driverTeamMap(brand, driverBd?.meetings ?? []);

  const drivers: DriverStanding[] = [];
  driverRows.forEach((r, i) => {
    const name =
      r.driverFirstName && r.driverLastName ? `${r.driverFirstName} ${r.driverLastName}` : r.driverShortName;
    if (!name) return;
    drivers.push({
      position: parseOrdinal(r.position) ?? i + 1,
      driverName: name,
      driverCode: r.driverTLA,
      team: (r.driverReference && teamByDriver.get(r.driverReference)) || '',
      points: typeof r.championshipPoints === 'number' ? r.championshipPoints : 0,
      wins: countFeatureWins(r.points),
    });
  });

  const constructors: ConstructorStanding[] = [];
  teamRows.forEach((r, i) => {
    if (!r.teamName) return;
    constructors.push({
      position: parseOrdinal(r.position) ?? i + 1,
      name: r.teamName,
      points: typeof r.championshipPoints === 'number' ? r.championshipPoints : 0,
    });
  });

  drivers.sort((a, b) => a.position - b.position);
  constructors.sort((a, b) => a.position - b.position);
  return { drivers, constructors };
}
