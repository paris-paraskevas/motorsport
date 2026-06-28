// Server-only OpenF1 client (api.openf1.org/v1). Historical data (sessions
// older than ~30 min) is free + needs no auth; live data (the paid Sponsor
// window) is out of scope for Phase 1. Every endpoint returns a JSON array, so
// `fetchOpenF1` always resolves to an array — `[]` on any error — and callers
// degrade gracefully rather than throwing.
//
// Rate limits are tight (3 req/s free). ALL app traffic must go through this
// proxy + the durable caches above it; never let the browser hit OpenF1
// directly per-user. Verify any new server-side path on a Vercel PREVIEW, not
// just localhost — datacenter egress can behave differently (CLAUDE.md rule).
//
// Extends the original narrow client in lib/results/openf1.ts; that one stays
// as-is for the per-session results path until a later consolidation.

const BASE = 'https://api.openf1.org/v1';

/**
 * Cache horizons for the Next.js data cache. Completed sessions are immutable,
 * so historical fetches cache hard; the sessions/meetings indexes refresh
 * daily (OpenF1 updates them at midnight UTC); `short` is for
 * recently-completed / near-live-window historical reads.
 */
export const OF1_REVALIDATE = {
  immutable: 7 * 24 * 60 * 60, // a finished session never changes
  daily: 24 * 60 * 60, // sessions/meetings indexes
  short: 5 * 60,
} as const;

export type OpenF1Query = Record<string, string | number | boolean | undefined>;

type OpenF1FilterOp = '>=' | '<=' | '>' | '<' | '=';

/**
 * Build an operator filter clause for OpenF1's range syntax, e.g.
 * `op('date', '>=', iso)` → `date>=2024-09-01T13%3A00%3A00`. The value is
 * percent-encoded; the field + operator are left literal to match OpenF1's
 * documented query format.
 */
export function op(field: string, operator: OpenF1FilterOp, value: string | number): string {
  return `${field}${operator}${encodeURIComponent(String(value))}`;
}

/**
 * Typed GET against an OpenF1 endpoint.
 *
 * @param endpoint  bare endpoint name, e.g. "laps", "car_data", "drivers"
 * @param query     equality params (`driver_number=1&session_key=9999`)
 * @param filters   raw operator clauses from `op()` (date ranges etc.)
 * @param revalidate  Next data-cache horizon (default `OF1_REVALIDATE.short`)
 * @returns the rows, or `[]` on non-2xx / network / parse error
 */
export async function fetchOpenF1<T>(
  endpoint: string,
  query: OpenF1Query = {},
  {
    filters = [],
    revalidate = OF1_REVALIDATE.short,
  }: { filters?: string[]; revalidate?: number } = {},
): Promise<T[]> {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      parts.push(`${key}=${encodeURIComponent(String(value))}`);
    }
  }
  parts.push(...filters);
  const qs = parts.length ? `?${parts.join('&')}` : '';

  try {
    const res = await fetch(`${BASE}/${endpoint}${qs}`, { next: { revalidate } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}
