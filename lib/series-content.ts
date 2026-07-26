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
