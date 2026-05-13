import fs from 'fs/promises';
import path from 'path';
import { Series, SeriesMeta, SignificanceMap } from './types';
import { parseIcs, fetchIcsText } from './ics';
import { mergeSignificance } from './significance';
import { loadMarkdownAsHtml } from './content';

export async function loadSeriesFromDir(dir: string): Promise<Series> {
  const meta: SeriesMeta = JSON.parse(
    await fs.readFile(path.join(dir, 'meta.json'), 'utf-8'),
  );
  const configured = meta.icsUrl.trim() !== '';

  let icsText = '';
  let stale = false;
  if (configured) {
    try {
      icsText = await fetchIcsText(meta.icsUrl);
    } catch {
      icsText = await readFallback(dir);
      stale = true;
    }
  } else {
    icsText = await readFallback(dir);
    stale = true;
  }

  const rawSessions = parseIcs(icsText, meta.slug);

  let significanceMap: SignificanceMap = {};
  try {
    const raw = await fs.readFile(path.join(dir, 'significance.json'), 'utf-8');
    significanceMap = JSON.parse(raw);
  } catch {
    // sidecar optional
  }
  const sessions = mergeSignificance(rawSessions, significanceMap);

  const [overview, drivers, significance] = await Promise.all([
    loadMarkdownAsHtml(path.join(dir, 'overview.md')),
    loadMarkdownAsHtml(path.join(dir, 'drivers.md')),
    loadMarkdownAsHtml(path.join(dir, 'significance.md')),
  ]);

  return {
    meta,
    sessions,
    overview,
    drivers,
    significance,
    fetchedAt: new Date(),
    stale,
    configured,
  };
}

async function readFallback(dir: string): Promise<string> {
  try {
    return await fs.readFile(path.join(dir, 'fallback.ics'), 'utf-8');
  } catch {
    return '';
  }
}

const SERIES_ROOT = path.join(process.cwd(), 'content', 'series');

export async function listSeriesSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(SERIES_ROOT, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return [];
  }
}

export async function loadSeries(slug: string): Promise<Series> {
  return loadSeriesFromDir(path.join(SERIES_ROOT, slug));
}

export async function loadAllSeries(): Promise<Series[]> {
  const slugs = await listSeriesSlugs();
  return Promise.all(slugs.map(loadSeries));
}

export async function loadSeriesMeta(slug: string): Promise<SeriesMeta> {
  return JSON.parse(
    await fs.readFile(path.join(SERIES_ROOT, slug, 'meta.json'), 'utf-8'),
  );
}

export async function loadAllSeriesMeta(): Promise<SeriesMeta[]> {
  const slugs = await listSeriesSlugs();
  return Promise.all(slugs.map(loadSeriesMeta));
}
