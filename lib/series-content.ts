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
