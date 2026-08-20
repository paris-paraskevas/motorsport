import type { RaceResult } from '@/lib/types';
import { readResultsCache, writeResultsCache } from '@/lib/results-cache';
import { loadResultsOverrides } from '@/lib/series-content';
import { applyResultsOverrides } from '@/lib/results/overrides';
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
  // Winner's total time / others' gap string, exactly as the feed carries it
  // ("+15.080"). Optional — the home lead shows the winning margin from P2's
  // value only when it reads as a gap.
  time?: string;
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
    .map(e => ({ position: e.position, name: e.driverName, detail: e.team || undefined, time: e.time }));
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
      time: e.position === 1 ? e.elapsedTime : e.gap,
    }));
  if (podium.length === 0) return null;
  return {
    round: latest.round,
    raceName: latest.eventName,
    date: latest.dateEnd.toISOString(),
    podium,
  };
}

/** Stored in place of a podium when a lookup yields nothing (fetch failure or
 *  no finished race). Short-TTL negative cache: on the Worker the community
 *  data APIs block datacenter egress, so a cold series' fan-out is seconds of
 *  doomed, rate-limited fetches — and without this sentinel every ISR render
 *  re-paid it (the 2026-08-20 landing PSI stall). The warm paths pass `force`,
 *  which skips the read, so recovery is automatic once a fetch can succeed. */
const NO_PODIUM_SENTINEL = 'none';
const NO_PODIUM_TTL_SECONDS = 15 * 60;

/** Latest finished race + podium for a covered series, KV-cached + fail-soft.
 *  Returns null for unsupported series or on any fetch/parse failure; a null
 *  outcome is negative-cached for 15 minutes (NO_PODIUM_SENTINEL above). */
export async function fetchLatestPodium(
  slug: string,
  opts: { force?: boolean } = {},
): Promise<LatestRace | null> {
  if (!homeResultsSupported(slug)) return null;
  // v2: PodiumEntry gained `time` (the winning-margin source for the home
  // lead) — new key so stale-shaped cached values age out instead of hiding
  // the margin until the next warm-cron force.
  const key = `paddock:home:podium:v2:${slug}:${new Date().getUTCFullYear()}`;
  // The warm cron passes `force` to bypass the read-through and refresh the KV
  // on a timer (so the /api/just-missed request path never hits upstream cold).
  if (!opts.force) {
    const cached = await readResultsCache<LatestRace | typeof NO_PODIUM_SENTINEL>(key);
    if (cached === NO_PODIUM_SENTINEL) return null;
    if (cached) return cached;
  }
  try {
    let result: LatestRace | null;
    if (slug === 'wec') {
      // WEC uses a per-class rounds shape (not RaceResult[]) and the canonical
      // Results tab applies no overrides to it, so none are applied here either.
      result = await fetchWecLatest(Date.now());
    } else {
      // Apply the SAME curated results overrides the Results tab does before
      // extracting the podium, so the home "just missed" card can't drift from
      // the tab if a `results-overrides.json` is ever added (no-op for every
      // series today). KV-cached downstream — baking the override in before the
      // write is correct.
      const overrides = await loadResultsOverrides(slug).catch(() => null);
      const races = applyResultsOverrides(await FLAT_SOURCES[slug](), overrides);
      result = latestRaceFromFlat(races, Date.now());
    }
    if (result) await writeResultsCache(key, result);
    else await writeResultsCache(key, NO_PODIUM_SENTINEL, NO_PODIUM_TTL_SECONDS);
    return result;
  } catch {
    await writeResultsCache(key, NO_PODIUM_SENTINEL, NO_PODIUM_TTL_SECONDS);
    return null;
  }
}

/** First candidate whose latest race carries a podium, inside a hard time
 *  budget.
 *
 *  The landing's Last-time-out block streams behind Suspense, and React holds
 *  the ISR document stream open until it resolves — so the whole lookup chain
 *  races `budgetMs` and the block renders empty past it (its designed no-data
 *  state). Candidates are tried in order (most recent finished weekend first),
 *  capped at 3 as the block always was. `lookup` is injectable for tests only.
 */
export async function fetchFirstPodiumWithin(
  candidates: string[],
  budgetMs: number,
  lookup: (slug: string) => Promise<LatestRace | null> = fetchLatestPodium,
): Promise<LatestRace | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), budgetMs);
  });
  const first = (async () => {
    for (const slug of candidates.slice(0, 3)) {
      const race = await lookup(slug).catch(() => null);
      if (race && race.podium.length > 0) return race;
    }
    return null;
  })();
  try {
    return await Promise.race([first, expired]);
  } finally {
    clearTimeout(timer);
  }
}
