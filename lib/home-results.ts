import type { RaceResult } from '@/lib/types';
import { readResultsCache, writeResultsCache } from '@/lib/results-cache';
import { fetchF1SeasonResults } from '@/lib/results/f1';
import { fetchF3SeasonResults } from '@/lib/results/f3';
import { fetchFormulaESeasonResults } from '@/lib/results/formula-e';
import { fetchIndyCarSeasonResults } from '@/lib/results/indycar';
import { fetchMotoGPSeasonResults } from '@/lib/results/motogp';
import { fetchWecSeasonResults } from '@/lib/results/wec';

/**
 * "Who won the last race" for the home's JUST MISSED block.
 *
 * Reuses the same season-results fetchers the Results tab renders, but returns
 * only the latest finished race's top-3 — so the home doesn't ship a season.
 * Coverage is the set whose fetcher exposes a single-class finishing order
 * (f1/f3/formula-e/indycar/motogp, flat RaceResult[]) plus WEC's overall
 * (Hypercar) order. Everything else (F2's custom shape, NASCAR/IMSA/GT-World/
 * WRC/DTM/WSBK/NLS — class-split, winners-only, or rounds-arg fetchers) has no
 * unambiguous flat podium here and renders as a "See results" link-out at the
 * call site.
 *
 * Each lookup is KV-cached on its small result (not the season), so a heavy
 * underlying fan-out — MotoGP re-fetches every round, no parser-level cache —
 * runs at most once per TTL instead of on every home render. Fail-soft
 * throughout: any error yields null and the card link-outs.
 */

export interface PodiumEntry {
  position: number; // 1..3
  // Driver name for single-seater/bike series; winning team for endurance,
  // where "who won" is a crew/car, not one driver.
  name: string;
  // Team (single-seater) or crew/car number (endurance). Optional.
  detail?: string;
}

export interface LatestRace {
  round: number;
  raceName: string;
  date: string; // ISO; race day (dateEnd for endurance ranges)
  podium: PodiumEntry[];
}

/** A "just missed" home card: the latest finished race for one series. Built
 *  on the /app server (meta + podium + highlight), filtered/capped client-side
 *  in HomeContent. Shared type so both ends agree on the shape. */
export interface JustMissedItem {
  seriesSlug: string;
  seriesName: string;
  color: string;
  raceName: string;
  date: string; // ISO
  round?: number;
  /** Top-3 for covered series; absent → the card link-outs to the results tab. */
  podium?: PodiumEntry[];
  /** YouTube highlight id (curated), when available. */
  highlight?: string;
  resultsHref: string;
}

// Covered series whose fetcher returns a flat, single-class RaceResult[].
const FLAT_SOURCES: Record<string, () => Promise<RaceResult[]>> = {
  f1: () => fetchF1SeasonResults(),
  f3: () => fetchF3SeasonResults(new Date().getUTCFullYear()),
  'formula-e': () => fetchFormulaESeasonResults(),
  indycar: () => fetchIndyCarSeasonResults({ drivers: null }),
  motogp: () => fetchMotoGPSeasonResults(new Date().getUTCFullYear()),
};

/** Every series the home "just missed" block can show a result for — the warm
 *  cron (app/api/cron/warm-results) loops this to pre-populate each one's KV. */
export const HOME_RESULTS_SLUGS: string[] = [...Object.keys(FLAT_SOURCES), 'wec'];

export function homeResultsSupported(slug: string): boolean {
  return slug in FLAT_SOURCES || slug === 'wec';
}

/** Latest finished race + top-3 from a flat RaceResult[] feed. Exported for
 *  unit testing the selection/podium logic without a network fetch. */
export function latestRaceFromFlat(races: RaceResult[], nowMs: number): LatestRace | null {
  const finished = races
    .map(r => ({ r, t: r.date instanceof Date ? r.date.getTime() : new Date(r.date).getTime() }))
    .filter(({ r, t }) => Number.isFinite(t) && t <= nowMs && r.results && r.results.length > 0)
    .sort((a, b) => b.t - a.t);
  const latest = finished[0]?.r;
  if (!latest) return null;
  const podium = latest.results
    .filter(e => e.position >= 1 && e.position <= 3)
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
    .map(e => ({ position: e.position, name: e.driverName, detail: e.team || undefined }));
  if (podium.length === 0) return null;
  return {
    round: latest.round,
    raceName: latest.raceName,
    date: (latest.date instanceof Date ? latest.date : new Date(latest.date)).toISOString(),
    podium,
  };
}

async function fetchWecLatest(nowMs: number): Promise<LatestRace | null> {
  const rounds = await fetchWecSeasonResults();
  const finished = rounds
    .filter(r => r.dateEnd.getTime() <= nowMs && (r.perClass.Hypercar?.length ?? 0) > 0)
    .sort((a, b) => b.dateEnd.getTime() - a.dateEnd.getTime());
  const latest = finished[0];
  if (!latest) return null;
  const podium = (latest.perClass.Hypercar ?? [])
    .filter(e => e.position >= 1 && e.position <= 3)
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
    .map(e => ({
      position: e.position,
      name: e.team || e.drivers || `Car #${e.carNumber}`,
      detail: e.drivers || (e.carNumber ? `#${e.carNumber}` : undefined),
    }));
  if (podium.length === 0) return null;
  return {
    round: latest.round,
    raceName: latest.eventName,
    date: latest.dateEnd.toISOString(),
    podium,
  };
}

/** Latest finished race + podium for a covered series, KV-cached + fail-soft.
 *  Returns null for unsupported series or on any fetch/parse failure. */
export async function fetchLatestPodium(
  slug: string,
  opts: { force?: boolean } = {},
): Promise<LatestRace | null> {
  if (!homeResultsSupported(slug)) return null;
  const key = `paddock:home:podium:${slug}:${new Date().getUTCFullYear()}`;
  // The warm cron passes `force` to bypass the read-through and refresh the KV
  // on a timer (so the /api/just-missed request path never hits upstream cold).
  if (!opts.force) {
    const cached = await readResultsCache<LatestRace>(key);
    if (cached) return cached;
  }
  try {
    const result =
      slug === 'wec'
        ? await fetchWecLatest(Date.now())
        : latestRaceFromFlat(await FLAT_SOURCES[slug](), Date.now());
    if (result) await writeResultsCache(key, result);
    return result;
  } catch {
    return null;
  }
}
