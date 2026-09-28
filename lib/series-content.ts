import fs from '@/lib/content-fs';
import path from 'path';
import type {
  Champion,
  CuratedDriversFile,
  ResultsOverridesFile,
  StandingsOverridesFile,
  WrcStageResultsFile,
} from './types';

const SERIES_ROOT = path.join(process.cwd(), 'content', 'series');

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadCuratedDrivers(slug: string): Promise<CuratedDriversFile | null> {
  return readJsonIfExists<CuratedDriversFile>(
    path.join(SERIES_ROOT, slug, 'drivers.json'),
  );
}

export function loadCuratedChampions(slug: string): Promise<Champion[] | null> {
  return readJsonIfExists<Champion[]>(
    path.join(SERIES_ROOT, slug, 'champions.json'),
  );
}

/** Per-season enrichment for the generated "who won the YYYY championship"
 *  answers (content/series/<slug>/champion-notes.json), keyed by year-as-string.
 *
 *  Why it exists: those pages were built from champions.json alone, so every one
 *  of the 488 said the same three things with the names swapped — the shape
 *  Google's AdSense review called low-value content (audit 2026-08-20). Each note
 *  adds what the data cannot: where and when the title was actually clinched, and
 *  the one thing that season is remembered for. Same gate as bios.json: absent
 *  file or absent year → the page renders exactly as before, so a series can be
 *  enriched a wave at a time. */
export function loadChampionNotes(slug: string): Promise<ChampionNotesFile | null> {
  return readJsonIfExists<ChampionNotesFile>(
    path.join(SERIES_ROOT, slug, 'champion-notes.json'),
  );
}

/** One season's enrichment: a short lead clause, the authored paragraph, and the
 *  primary references each claim was checked against (RULE #1 trail, rendered on
 *  the page so the answer is traceable).
 *
 *  Exactly ONE lead field is set, and which one is set decides the label the page
 *  renders. Three exist because one shape cannot describe every family honestly
 *  (operator decision, 2026-08-26):
 *
 *  - `clinched` — a championship whose deciding round is sourced. The default,
 *    and what all 166 notes written to date use.
 *  - `season` — a championship whose deciding round NO source records. Sourced
 *    clinch rounds thin out sharply before about 1990: below it the record is
 *    race results without championship context. Rather than guess a round or
 *    leave ~90 pages thin, these say what the season was and say plainly that
 *    the deciding round is not recorded.
 *  - `race` — a family that is a single race rather than a championship (ADAC
 *    24h, NLS), where "where the title was settled" is meaningless. */
export interface ChampionNote {
  clinched?: string;
  season?: string;
  race?: string;
  note: string;
  sources?: string[];
}

/** Sidecar shape: year-as-string → note. */
export type ChampionNotesFile = Record<string, ChampionNote>;

/** Authored enrichment for the two generated "most titles" record answers
 *  (content/series/<slug>/record-notes.json).
 *
 *  Why it exists: those pages are derived wholly from champions.json — the
 *  holder, the count, the multiple-winners list — so all 23 of them read as one
 *  page with the names swapped, and at a measured 42–81 rendered words they were
 *  the thinnest cohort on the site (audit 2026-08-27), thinner than the who-won
 *  pages the 2026-08-20 AdSense review flagged. Unlike who-won they had no
 *  authored-note mechanism at all, which was a structural gap rather than a
 *  backlog.
 *
 *  Same fail-soft gate as champion-notes.json: absent file, or absent half,
 *  leaves the page rendering exactly as it did, so a series can be enriched on
 *  its own. Keyed by HALF ("drivers" / "teams") rather than by year, so the V8
 *  integer-key reordering that governs champion-notes.json does not apply here
 *  and JSON.stringify is safe to write these with. */
export function loadRecordNotes(slug: string): Promise<RecordNotesFile | null> {
  return readJsonIfExists<RecordNotesFile>(
    path.join(SERIES_ROOT, slug, 'record-notes.json'),
  );
}

/** One record page's enrichment: a short lead clause rendered as "The record: …",
 *  the authored paragraph, and the primary references each claim was checked
 *  against (RULE #1 trail, rendered on the page).
 *
 *  What the note carries is what the data cannot: when the record was set and
 *  what it displaced, who is closest and what they would need, whether the run
 *  was consecutive, and the one thing that makes it hard to beat. */
export interface RecordNote {
  lead: string;
  note: string;
  sources?: string[];
}

/** Sidecar shape, one entry per record page the series generates. `drivers` is
 *  present only where the driver/rider record is ≥ 2 and `teams` only where the
 *  constructor record is ≥ 2, because below that the generator emits no page at
 *  all — a note for a page that never renders is dead content, and
 *  lib/record-notes-integrity.test.ts fails on one. */
export interface RecordNotesFile {
  drivers?: RecordNote;
  teams?: RecordNote;
}

/** Authored per-weekend enrichment (content/series/<slug>/weekend-notes.json).
 *
 *  Why the key is `"<season>-<round>"` and not a round number: the live weekend
 *  URL `/series/<slug>/weekend/<round>` carries NO season, and `weekendFor`
 *  resolves the round against whatever season `meta.season` currently is. A note
 *  keyed by round alone would silently reattach to a different race every
 *  January — the staleness class that put a false claim on twelve Formula E
 *  pages in 0.334.54. Keyed by season it is permanent, and the same note serves
 *  the live page now and `/archive/<season>/<slug>/weekend/<round>` forever.
 *
 *  The hyphen also matters: a bare `"2026"` key is integer-like, and V8 orders
 *  integer-like keys ascending regardless of insertion order, which is what
 *  mangled champion-notes.json in session 38. `"2026-15"` is a plain string key,
 *  so ordinary JSON.stringify is safe here.
 *
 *  Same fail-soft gate as every other sidecar: absent file or absent key and the
 *  page renders exactly as it does today. */
export function loadWeekendNotes(slug: string): Promise<WeekendNotesFile | null> {
  return readJsonIfExists<WeekendNotesFile>(
    path.join(SERIES_ROOT, slug, 'weekend-notes.json'),
  );
}

/** One race weekend's authored note. `lead` renders as "The race: …"; `note` is
 *  what the classification cannot say — how it was won and what it changed. */
export interface WeekendNote {
  lead: string;
  note: string;
  sources?: string[];
}

/** Sidecar shape: "<season>-<round>" → note. */
export type WeekendNotesFile = Record<string, WeekendNote>;

/** The key for a weekend note. One definition, because a mismatch between the
 *  writer and the reader fails silently — the page just renders unenriched. */
export function weekendNoteKey(season: number, round: number): string {
  return `${season}-${round}`;
}

/** Whether a race weekend carries an authored note with text (R14, 2026-09-28): the page is indexed and the sitemap
 *  advertises it only then; without one the page is a schedule, a classification and headlines. One reader for the
 *  route's robots rule and the sitemap, so they cannot drift. */
export function hasWeekendNote(notes: WeekendNotesFile | null | undefined, season: number, round: number): boolean {
  const note = notes?.[weekendNoteKey(season, round)];
  return typeof note?.note === 'string' && note.note.trim().length > 0;
}

/** Curated WRC per-stage classifications (content/series/wrc/stage-results.json).
 *  The rally results feed is winners-only, so the full per-stage field lives
 *  here as curated content (RULE #1: eWRC + wrc.com). Null when the file is
 *  absent. */
export function loadWrcStageResults(): Promise<WrcStageResultsFile | null> {
  return readJsonIfExists<WrcStageResultsFile>(
    path.join(SERIES_ROOT, 'wrc', 'stage-results.json'),
  );
}

/** One curated historic-team entry: a plausible heritage `color`, plus an
 * optional `page` slug when the team happens to have a /teams/<slug> profile
 * (historic teams usually don't — then the consumer colours text only). `note`
 * is curation provenance, ignored at read time. */
export interface HistoricTeamColor {
  color: string;
  page?: string;
  note?: string;
}

/** Sidecar shape: slugified-team-name → heritage colour. Underscore-prefixed
 * keys (e.g. `_comment`) are file-level metadata; only `teams` is read. */
interface HistoricTeamColorsFile {
  teams?: Record<string, HistoricTeamColor>;
}

/** Curated heritage colours for pre-current-grid champion constructors, so
 * historic Champions-tab rows get a team colour too. Returns a slug→entry map
 * (empty when the series has no sidecar). */
export async function loadHistoricTeamColors(
  slug: string,
): Promise<Record<string, HistoricTeamColor>> {
  const file = await readJsonIfExists<HistoricTeamColorsFile>(
    path.join(SERIES_ROOT, slug, 'historic-team-colors.json'),
  );
  return file?.teams ?? {};
}

/** One curated driver portrait: a free-licensed image (Wikimedia Commons) plus
 * the attribution its licence requires. `by` is the Commons author (sometimes a
 * username); `license` is the short name (e.g. "CC BY-SA 4.0"); `source` links
 * the Commons file page. */
export interface DriverPortrait {
  src: string;
  license: string;
  by: string;
  source: string;
}

/** Sidecar shape: slugified-driver-name → portrait. Underscore-prefixed keys
 * (e.g. `_comment`) are file-level metadata; only `drivers` is read. */
interface DriverPortraitsFile {
  drivers?: Record<string, DriverPortrait>;
}

/** Curated driver portraits (free-licensed Commons images) for /drivers/<slug>.
 * Returns a slug→entry map (empty when the series has no sidecar). Preferred
 * over the F1-only OpenF1 headshots, which are F1 official media and not
 * CC-licensed. */
export async function loadDriverPortraits(
  slug: string,
): Promise<Record<string, DriverPortrait>> {
  const file = await readJsonIfExists<DriverPortraitsFile>(
    path.join(SERIES_ROOT, slug, 'portraits.json'),
  );
  return file?.drivers ?? {};
}

/** One curated, original driver bio for /drivers/<slug> — an authored, RULE #1
 * fact-checked replacement for the Wikipedia-intro fallback. `paragraphs` is the
 * prose (evergreen career + identity ONLY — no live-season stats; the page renders
 * live form separately, and volatile figures would go stale on the ISR page).
 * `sources` are the primary references it was checked against (kept for the
 * reviewer / fact-check trail; not rendered). */
export interface DriverBio {
  paragraphs: string[];
  sources?: string[];
}

/** Sidecar shape: slugified-driver-name → bio. Underscore-prefixed keys
 * (e.g. `_comment`) are file-level metadata; only `drivers` is read. */
interface DriverBiosFile {
  drivers?: Record<string, DriverBio>;
}

/** Curated driver bios (content/series/<slug>/bios.json) for /drivers/<slug>.
 * Returns a slug→entry map (empty when the series has no sidecar). Preferred
 * over the Wikipedia-intro bio, which stays as the fail-soft fallback for
 * drivers without a curated entry. */
export async function loadDriverBios(
  slug: string,
): Promise<Record<string, DriverBio>> {
  const file = await readJsonIfExists<DriverBiosFile>(
    path.join(SERIES_ROOT, slug, 'bios.json'),
  );
  return file?.drivers ?? {};
}

/** One declared car upgrade: the component, its primary reason (Performance /
 * Reliability / Circuit-specific + sub-reason), and a short factual detail. */
export interface UpgradeItem {
  component: string;
  reason: string;
  detail: string;
}
/** A team's upgrade submission for a weekend. */
export interface TeamUpgrades {
  team: string;
  items: UpgradeItem[];
}
/** One round's curated upgrades, from the FIA Car Presentation Submissions doc. */
export interface RoundUpgrades {
  gp: string;
  date: string;
  doc: number;
  teams: TeamUpgrades[];
}

/** Curated per-weekend F1 car upgrades (from the official FIA Car Presentation
 * Submissions PDF; see docs/research/2026-07-06-f1-upgrades-data-source.md).
 * F1-only. Returns null when the round has no curated entry. */
export async function loadF1Upgrades(round: number): Promise<RoundUpgrades | null> {
  const file = await readJsonIfExists<Record<string, RoundUpgrades>>(
    path.join(SERIES_ROOT, 'f1', 'upgrades.json'),
  );
  const entry = file?.[String(round)];
  return entry && typeof entry === 'object' && Array.isArray(entry.teams) ? entry : null;
}

/** The most recent curated F1 round that has upgrades (highest round number with
 *  a non-empty teams list), plus its round number — for the opt-in home widget.
 *  null when nothing is curated. */
export async function loadLatestF1Upgrades(): Promise<(RoundUpgrades & { round: number }) | null> {
  const file = await readJsonIfExists<Record<string, RoundUpgrades>>(
    path.join(SERIES_ROOT, 'f1', 'upgrades.json'),
  );
  if (!file) return null;
  const rounds = Object.keys(file)
    .filter(k => /^\d+$/.test(k))
    .map(Number)
    .sort((a, b) => b - a);
  for (const r of rounds) {
    const e = file[String(r)];
    if (e && typeof e === 'object' && Array.isArray(e.teams) && e.teams.length > 0) {
      return { ...e, round: r };
    }
  }
  return null;
}

export function loadResultsOverrides(
  slug: string,
): Promise<ResultsOverridesFile | null> {
  return readJsonIfExists<ResultsOverridesFile>(
    path.join(SERIES_ROOT, slug, 'results-overrides.json'),
  );
}

export function loadStandingsOverrides(
  slug: string,
): Promise<StandingsOverridesFile | null> {
  return readJsonIfExists<StandingsOverridesFile>(
    path.join(SERIES_ROOT, slug, 'standings-overrides.json'),
  );
}
