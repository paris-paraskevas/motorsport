// F1 driver headshots, keyed by car number, sourced from OpenF1's /drivers
// endpoint (every driver row carries a `headshot_url`).
//
// ⚠️ LICENSING — read before reusing. OpenF1's DATA is CC BY-NC-SA 4.0, but the
// headshot images it links are Formula 1's official media and remain F1's
// copyright; the CC licence on the data does NOT license the images. Attribution
// ("Photo: Formula 1 via OpenF1") credits the source — it is not a usage grant.
// This module is intentionally the single, swappable place that produces the
// number→url map: to move to a Wikimedia / own-licensed source later, change
// only the body of `f1HeadshotsByNumber` (the call sites just consume the Map).
//
// Headshots are stable across a season, so ANY recent F1 session's /drivers
// serves the whole grid. We resolve the latest already-started session of the
// current year and reuse the EXISTING `getSessionDrivers` enrichment (which
// already exposes `headshotUrl`). The result is KV-cached for a week and fully
// fail-soft: any error yields an empty Map and the caller renders no image.

import { fetchOpenF1, OF1_REVALIDATE } from './client';
import { getSessionDrivers } from './drivers';
import type { OF1Session } from './types';
import {
  readResultsCache,
  writeResultsCache,
  OPENF1_DATASET_TTL_SECONDS,
} from '@/lib/results-cache';

/** KV key for the per-year headshot map. */
function headshotsCacheKey(year: number): string {
  return `paddock:openf1:f1-headshots:${year}`;
}

/**
 * Latest F1 session of `year` whose `date_start` is at or before now. Headshots
 * are season-stable, so the most recent started session is the freshest source
 * for the full grid. Returns null when the index is empty / unreachable.
 */
async function latestStartedSessionKey(year: number): Promise<number | null> {
  const sessions = await fetchOpenF1<OF1Session>(
    'sessions',
    { year },
    { revalidate: OF1_REVALIDATE.daily },
  );
  const now = Date.now();
  let best: OF1Session | null = null;
  let bestStart = -Infinity;
  for (const s of sessions) {
    const start = Date.parse(s.date_start);
    if (!Number.isFinite(start) || start > now) continue;
    if (start > bestStart) {
      bestStart = start;
      best = s;
    }
  }
  return best ? best.session_key : null;
}

/**
 * Map of F1 car number → official headshot URL (F1 media, via OpenF1 — see the
 * licensing note at the top of this file). KV-cached for a week; rebuilt from a
 * recent session's enriched drivers on a miss. Always resolves — an empty Map on
 * any failure so callers degrade silently (no image rather than a broken page).
 */
export async function f1HeadshotsByNumber(): Promise<Map<number, string>> {
  const year = new Date().getFullYear();

  // Warm path: a plain Record<number-as-string, url> in KV.
  try {
    const cached = await readResultsCache<Record<string, string>>(headshotsCacheKey(year));
    if (cached) {
      const map = new Map<number, string>();
      for (const [num, url] of Object.entries(cached)) {
        const n = Number(num);
        if (Number.isFinite(n) && url) map.set(n, url);
      }
      return map;
    }
  } catch {
    // fall through to a cold rebuild
  }

  try {
    const sessionKey = await latestStartedSessionKey(year);
    if (sessionKey == null) return new Map();

    const { byNumber } = await getSessionDrivers(sessionKey, 'f1');
    const map = new Map<number, string>();
    const record: Record<string, string> = {};
    for (const [num, driver] of byNumber) {
      if (driver.headshotUrl) {
        map.set(num, driver.headshotUrl);
        record[String(num)] = driver.headshotUrl;
      }
    }

    // Only persist a non-empty map; an empty result is likely a transient
    // upstream blip we don't want to pin for a week.
    if (map.size > 0) {
      await writeResultsCache(headshotsCacheKey(year), record, OPENF1_DATASET_TTL_SECONDS);
    }
    return map;
  } catch {
    return new Map();
  }
}
