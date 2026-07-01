import fs from 'fs/promises';
import path from 'path';
import type {
  Champion,
  CuratedDriversFile,
  ResultsOverridesFile,
  StandingsOverridesFile,
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
