// Enriched driver metadata for a session: OpenF1 /drivers (headshot, 3-letter
// acronym, per-season team colour) merged over the curated
// content/series/f1/drivers.json (clean names + a fallback when OpenF1 has no
// row, e.g. an unavailable/very old session). team_colour from OpenF1 has no
// leading '#'.

import { fetchOpenF1, OF1_REVALIDATE } from './client';
import type { OF1Driver } from './types';
import { loadCuratedDrivers } from '@/lib/series-content';

export interface EnrichedDriver {
  number: number;
  code: string; // "VER"
  name: string; // "Max Verstappen"
  team: string;
  teamColour: string; // "#RRGGBB"
  headshotUrl?: string;
}

export interface SessionDrivers {
  list: EnrichedDriver[]; // sorted by car number
  byNumber: Map<number, EnrichedDriver>;
}

const FALLBACK_COLOUR = '#888888';

function withHash(colour?: string | null): string | undefined {
  const t = colour?.trim();
  if (!t) return undefined;
  return t.startsWith('#') ? t : `#${t}`;
}

/** "Charles LECLERC" → "Charles Leclerc" (OpenF1 SHOUTs the surname). */
function tidyName(name: string): string {
  return name
    .split(/\s+/)
    .map(w => (/^[\p{Lu}]{2,}$/u.test(w) ? w[0] + w.slice(1).toLowerCase() : w))
    .join(' ');
}

async function curatedByNumber(slug: string): Promise<Map<number, EnrichedDriver>> {
  const curated = await loadCuratedDrivers(slug);
  const map = new Map<number, EnrichedDriver>();
  if (!curated) return map;
  for (const team of curated.teams) {
    for (const d of team.drivers) {
      if (typeof d.number !== 'number') continue;
      map.set(d.number, {
        number: d.number,
        code: d.code ?? '',
        name: d.name,
        team: team.name,
        teamColour: withHash(team.color) ?? FALLBACK_COLOUR,
      });
    }
  }
  return map;
}

/**
 * Enriched drivers for a session. Prefers OpenF1 for the per-session
 * acronym/team/colour/headshot, and the curated file for clean display names
 * (falling back to a tidied OpenF1 full_name). If OpenF1 returns nothing, the
 * curated grid is used wholesale so charts still label correctly.
 */
export async function getSessionDrivers(
  sessionKey: number,
  slug = 'f1',
): Promise<SessionDrivers> {
  const [rows, curated] = await Promise.all([
    fetchOpenF1<OF1Driver>(
      'drivers',
      { session_key: sessionKey },
      { revalidate: OF1_REVALIDATE.immutable },
    ),
    curatedByNumber(slug),
  ]);

  const byNumber = new Map<number, EnrichedDriver>();

  for (const r of rows) {
    const fallback = curated.get(r.driver_number);
    byNumber.set(r.driver_number, {
      number: r.driver_number,
      code: r.name_acronym || fallback?.code || `#${r.driver_number}`,
      name: fallback?.name || tidyName(r.full_name),
      team: r.team_name || fallback?.team || '',
      teamColour: withHash(r.team_colour) || fallback?.teamColour || FALLBACK_COLOUR,
      headshotUrl: r.headshot_url || undefined,
    });
  }

  // OpenF1 unavailable → fall back to the curated grid so labels still work.
  if (byNumber.size === 0) {
    curated.forEach((driver, number) => byNumber.set(number, driver));
  }

  const list = Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
  return { list, byNumber };
}
