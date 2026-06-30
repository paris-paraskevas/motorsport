import type { DriverStanding } from '@/lib/types';
import { fetchUpstream } from '@/lib/fetch-upstream';

export type { DriverStanding };

// MotoGP Pulselive API. Same vendor family as WSBK (`lib/standings/wsbk.ts`)
// but a different envelope shape — MotoGP returns plain JSON arrays/objects
// directly (no JSON:API `data`/`included`), so the parse is simpler than
// WSBK's relationship-walk pattern.
//
// Endpoint chain (verified live 2026-05-21):
//   GET /motogp/v1/results/seasons
//     → [{id, year, current}]
//   GET /motogp/v1/results/standings?seasonUuid=<X>&categoryUuid=<MOTOGP>
//     → {classification: [{position, rider:{full_name,...}, team:{name},
//        constructor:{name}, points, race_wins, sprint_wins, ...}]}
//
// Manufacturers' Championship is intentionally NOT modelled. FIM rules
// award each manufacturer the best-placed rider's points per race (not a
// sum of all riders), and Pulselive does not expose a constructors
// standings endpoint (both /standings/constructor and /standings/constructors
// 404). Computing it client-side requires per-race classification fan-out,
// which is out of scope for v1 — confirmed with the operator in Phase 1.
const API_BASE = 'https://api.motogp.pulselive.com';
const MOTOGP_CATEGORY_UUID = 'e8c110ad-64aa-4e8e-8a86-f2f152f6a942';

// 2026 MotoGP grid is 22 riders. Floor catches the case where Pulselive
// returns an empty / partial response (auth wall, schema drift, mid-deploy);
// StandingsTab falls back to "temporarily unavailable" placeholder.
const MIN_RIDERS = 15;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

interface PulseliveSeason {
  id: string;
  year: number;
  current: boolean;
}

interface PulseliveRider {
  full_name?: string;
  number?: number;
}

interface PulseliveTeam {
  name?: string;
}

interface PulseliveStandingsRow {
  position?: number;
  rider?: PulseliveRider;
  team?: PulseliveTeam;
  points?: number;
  race_wins?: number;
}

interface PulseliveStandingsResponse {
  classification?: PulseliveStandingsRow[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetchUpstream(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Pulselive's seasonUuid is per-year and not derivable; resolve at runtime
// so a year rollover doesn't silently break. The category UUID is documented
// as stable across all 2007-2026 seasons in the same response.
export async function resolveMotoGPSeasonUuid(year: number): Promise<string | null> {
  const seasons = await fetchJson<PulseliveSeason[]>(
    `${API_BASE}/motogp/v1/results/seasons`,
  );
  if (!Array.isArray(seasons)) return null;
  const match = seasons.find(s => s?.year === year);
  return match?.id ?? null;
}

export const MOTOGP_API_BASE = API_BASE;
export const MOTOGP_CATEGORY_UUID_EXPORT = MOTOGP_CATEGORY_UUID;

export async function fetchMotoGPStandings(year: number): Promise<{
  drivers: DriverStanding[];
} | null> {
  const seasonUuid = await resolveMotoGPSeasonUuid(year);
  if (!seasonUuid) return null;

  const resp = await fetchJson<PulseliveStandingsResponse>(
    `${API_BASE}/motogp/v1/results/standings?seasonUuid=${seasonUuid}` +
      `&categoryUuid=${MOTOGP_CATEGORY_UUID}`,
  );
  if (!resp?.classification) return null;

  const drivers: DriverStanding[] = [];
  for (const row of resp.classification) {
    const position = row?.position;
    const points = row?.points;
    const driverName = row?.rider?.full_name;
    const team = row?.team?.name;
    if (typeof position !== 'number' || !Number.isFinite(position)) continue;
    if (typeof points !== 'number' || !Number.isFinite(points)) continue;
    if (!driverName || !team) continue;

    const wins =
      typeof row?.race_wins === 'number' && Number.isFinite(row.race_wins)
        ? row.race_wins
        : undefined;

    drivers.push({
      position,
      driverName,
      team,
      points,
      wins,
    });
  }

  if (drivers.length < MIN_RIDERS) return null;
  return { drivers: drivers.sort((a, b) => a.position - b.position) };
}
