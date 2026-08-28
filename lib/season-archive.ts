import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

/** Reader for the season snapshots written by `scripts/archive-season.mts`.
 *
 *  BUILD TIME ONLY, deliberately. These files live in `data/`, outside the
 *  `content/**` walk that `scripts/bundle-content.mts` inlines into the Worker
 *  — the 2026 archive alone is ~116 KiB gzipped against 687 KiB of headroom,
 *  and it grows by a season every year. So this uses the REAL `node:fs` rather
 *  than `lib/content-fs`: on workerd these reads throw, and that is the point.
 *  Every route built on this loader must be `force-static` with no revalidate,
 *  the same contract `/changelog` has with RELEASES.md.
 *
 *  A finished season never changes, so static is not a compromise here. */

const ROOT = path.join(process.cwd(), 'data', 'season-archive');

export interface ArchivedSession {
  title: string;
  start: string;
  end: string;
  location: string | null;
}

export interface ArchivedWeekend {
  round: number;
  /** Canonical name from rounds.json ("Canadian Grand Prix"). */
  roundName: string | null;
  /** Significance override, when the series set one. */
  label: string | null;
  dateRangeLabel: string;
  isPast: boolean;
  sessions: ArchivedSession[];
}

/** Per-part capture status. `none` means no fetcher exists for that series at
 *  all (ADAC results/standings, NLS standings) rather than a failed read — the
 *  distinction matters when reading an archive years later. */
export type CaptureStatus = 'ok' | 'empty' | 'failed' | 'none';

export interface SeasonArchive {
  season: number;
  series: string;
  seriesName: string;
  capturedAt: string;
  captured: { weekends: CaptureStatus; results: CaptureStatus; standings: CaptureStatus };
  weekends: ArchivedWeekend[];
  results: unknown;
  standings: unknown;
}

/** Seasons with at least one archived series, newest first. */
export async function listArchivedSeasons(): Promise<number[]> {
  try {
    const entries = await readdir(ROOT, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && /^\d{4}$/.test(e.name))
      .map(e => Number(e.name))
      .sort((a, b) => b - a);
  } catch {
    return [];
  }
}

/** Series slugs archived for a season, alphabetical. */
export async function listArchivedSeries(season: number): Promise<string[]> {
  try {
    const files = await readdir(path.join(ROOT, String(season)));
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''))
      .sort();
  } catch {
    return [];
  }
}

/** Per-process cache. These files are immutable for the life of a build — that
 *  is the whole premise of the archive — and without this the same season file
 *  is read and JSON-parsed once per `generateStaticParams` entry, once per
 *  `generateMetadata`, once per page render and once more for the sitemap:
 *  roughly 900 full parses of files up to a few hundred KB, where 15 would do.
 *
 *  That mattered. The 0.334.90 build FAILED on Cloudflare — `/` exceeded the
 *  60-second per-page export budget three times — after the page count went
 *  961 → 1188 on a builder with **3 workers** where this machine has 21. The
 *  wasted parsing was starving the network-bound pages. Caching is not a
 *  micro-optimisation here, it is the difference between a green build and a
 *  red one. */
const cache = new Map<string, SeasonArchive | null>();

/** One archived season for one series. Null when absent or unreadable — which
 *  on workerd is ALWAYS, by design. Callers are static routes. */
export async function loadSeasonArchive(
  season: number,
  slug: string,
): Promise<SeasonArchive | null> {
  const key = `${season}/${slug}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let value: SeasonArchive | null = null;
  try {
    const raw = await readFile(path.join(ROOT, String(season), `${slug}.json`), 'utf-8');
    const parsed = JSON.parse(raw) as SeasonArchive;
    value = parsed && Array.isArray(parsed.weekends) ? parsed : null;
  } catch {
    value = null;
  }
  // ONLY successes are cached. Memoising a null poisons the key for the life of
  // the process, so one transient read failure would 404 that page forever —
  // which is exactly what happened in `next dev`, where each route runs in its
  // own worker: the season page rendered while every archive weekend page 404'd.
  // A miss is cheap to retry; a cached miss is a permanent, silent outage.
  if (value) cache.set(key, value);
  return value;
}

/** Same reasoning as the archive cache above — this is called once per archive
 *  page for metadata, once more for the render, and again per sitemap entry. */
const liveCache = new Map<string, boolean>();

/** True while `season` is still the season the LIVE series pages serve.
 *
 *  While that holds, `/archive/<season>/<slug>/…` renders the same weekend as
 *  `/series/<slug>/weekend/<round>`, so the archive defers: noindex, canonical
 *  pointed at the live URL, and excluded from the sitemap. It becomes the
 *  canonical copy on its own the moment the series rolls to a new season — no
 *  code change and no backfill, because the rule is derived from `meta.season`
 *  rather than written down anywhere.
 *
 *  Exported so the pages and `lib/sitemap-data.ts` share one definition; a
 *  sitemap that submits a noindex URL earns "Submitted URL marked noindex". */
export async function isArchiveLiveSeason(slug: string, season: number): Promise<boolean> {
  const key = `${slug}@${season}`;
  const hit = liveCache.get(key);
  if (hit !== undefined) return hit;
  // Imported lazily: lib/series pulls the content bundle, and the archive
  // loader is also used by scripts that have no need for it.
  const { loadSeriesMeta } = await import('./series');
  const meta = await loadSeriesMeta(slug).catch(() => null);
  const value = meta?.season === season;
  liveCache.set(key, value);
  return value;
}

/** Every (season, slug) pair on disk — for generateStaticParams. */
export async function listArchivePairs(): Promise<{ season: number; slug: string }[]> {
  const out: { season: number; slug: string }[] = [];
  for (const season of await listArchivedSeasons()) {
    for (const slug of await listArchivedSeries(season)) out.push({ season, slug });
  }
  return out;
}
