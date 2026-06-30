import type { DriverStanding, ConstructorStanding } from '@/lib/types';
import { fetchUpstream } from '@/lib/fetch-upstream';

export type { DriverStanding, ConstructorStanding };

// WorldSBK Pulselive API. Same Dorna/Pulselive family as MotoGP, but the
// host is `api.wsbk.pulselive.com` (NOT `api.worldsbk.pulselive.com` — that
// hostname does not resolve). Paths are namespaced with `wsbk-events/`,
// `wsbk-results/`, `wsbk-riders/` prefixes. Endpoint pattern surfaced from
// the worldsbk.com front-end bundle (standings widget, May 2026 probe).
const API_BASE = 'https://api.wsbk.pulselive.com';

// Standard 2026 WorldSBK grid is 24 full-time + 1-2 wildcards.
// Manufacturers' championship has 5-6 entries (one per OEM).
// Floors below catch structurally-broken responses (auth wall, schema
// drift) and force the StandingsTab to render the "temporarily unavailable"
// placeholder instead of shipping a half-empty table.
const MIN_RIDERS = 10;
const MIN_MANUFACTURERS = 3;

// JSON:API envelope returned by api.wsbk.pulselive.com. The standings
// endpoint already embeds relationship records under `included` — no
// `?include=` query string required. Auto-includes types `riders` + `teams`
// for the rider variant and `manufacturers` for the manufacturer variant.
interface JsonApiResource {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { type: string; id: string } }>;
}

interface JsonApiEnvelope {
  data?: JsonApiResource[];
  included?: JsonApiResource[];
}

function buildIncludedMap(
  included: JsonApiResource[] | undefined,
): Record<string, Record<string, JsonApiResource>> {
  const map: Record<string, Record<string, JsonApiResource>> = {};
  if (!Array.isArray(included)) return map;
  for (const item of included) {
    if (!item?.type || !item?.id) continue;
    if (!map[item.type]) map[item.type] = {};
    map[item.type][item.id] = item;
  }
  return map;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseRiderStandings(env: JsonApiEnvelope): DriverStanding[] | null {
  const rows = env?.data;
  if (!Array.isArray(rows)) return null;

  const included = buildIncludedMap(env.included);

  const out: DriverStanding[] = [];
  for (const row of rows) {
    if (!row || row.type !== 'rider-standings') continue;
    const position = asNumber(row.attributes?.position);
    const points = asNumber(row.attributes?.points);
    if (position == null || points == null) continue;

    const riderRef = row.relationships?.rider?.data;
    const teamRef = row.relationships?.team?.data;
    if (!riderRef?.id || !teamRef?.id) continue;

    const rider = included['riders']?.[riderRef.id];
    const team = included['teams']?.[teamRef.id];
    const givenName = asString(rider?.attributes?.name);
    const familyName = asString(rider?.attributes?.surname);
    const teamName = asString(team?.attributes?.name);
    if (!givenName || !familyName || !teamName) continue;

    out.push({
      position,
      driverName: `${givenName} ${familyName}`.trim(),
      team: teamName,
      points,
    });
  }

  if (out.length < MIN_RIDERS) return null;
  return out.sort((a, b) => a.position - b.position);
}

function parseManufacturerStandings(
  env: JsonApiEnvelope,
): ConstructorStanding[] | null {
  const rows = env?.data;
  if (!Array.isArray(rows)) return null;

  const included = buildIncludedMap(env.included);

  const out: ConstructorStanding[] = [];
  for (const row of rows) {
    if (!row || row.type !== 'manufacturer-standings') continue;
    const position = asNumber(row.attributes?.position);
    const points = asNumber(row.attributes?.points);
    if (position == null || points == null) continue;

    const mfrRef = row.relationships?.manufacturer?.data;
    if (!mfrRef?.id) continue;

    const mfr = included['manufacturers']?.[mfrRef.id];
    const name = asString(mfr?.attributes?.name);
    if (!name) continue;

    out.push({ position, name, points });
  }

  if (out.length < MIN_MANUFACTURERS) return null;
  return out.sort((a, b) => a.position - b.position);
}

function standingsUrl(year: number, category: string, kind: 'riders' | 'manufacturers'): string {
  return `${API_BASE}/wsbk-results/v1/seasons/${year}/categories/${category}/${kind}/standings`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetchUpstream(url, {
      headers: {
        Accept: 'application/json',
        // Pulselive's CloudFront returns 404/Incapsula for some non-browser
        // UAs and is sensitive to query strings; the no-query JSON path is
        // open to a stock UA + Accept header.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
      // Hourly revalidate — WorldSBK posts updated standings within minutes
      // of Race 2 finishing; an hour cap is fine for the standings tab.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Fetch the current-season WorldSBK riders' + manufacturers' championship
 * standings. Returns null when either feed is broken or under-populated —
 * StandingsTab will render its "temporarily unavailable" placeholder rather
 * than ship a half-empty table.
 *
 * The season is read from `content/series/wsbk/meta.json` at the call site;
 * this module accepts it as a parameter to keep the loader pure and easy to
 * test with fixtures.
 */
export async function fetchWsbkStandings(season: number): Promise<{
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
} | null> {
  const [ridersJson, mfrJson] = await Promise.all([
    fetchJson<JsonApiEnvelope>(standingsUrl(season, 'SBK', 'riders')),
    fetchJson<JsonApiEnvelope>(standingsUrl(season, 'SBK', 'manufacturers')),
  ]);
  if (!ridersJson || !mfrJson) return null;

  const drivers = parseRiderStandings(ridersJson);
  const constructors = parseManufacturerStandings(mfrJson);
  if (!drivers || !constructors) return null;

  return { drivers, constructors };
}
