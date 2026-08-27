// Bing Webmaster Tools "Search — Bing" panel data for /admin. Reads an API key
// (BING_WEBMASTER_API_KEY) + the verified site (BING_SITE_URL — a full URL like
// "https://www.paddock-tracker.com"). Server-only + fail-soft: missing env or an
// API error → null → the admin shows a connect/unavailable state, never 500s.
// JSON/HTTP API with api-key auth; rows come back per-day per query/page, so we
// aggregate. The key must never reach the client (server env only).
//
// RESTORED VERBATIM in 0.334.75. This module was deleted in 0.334.27 as
// collateral alongside ga4.ts and gsc.ts, and it should not have been: it was
// always a bare `fetch`, so it carried NONE of the 653 KiB that removal bought
// back. Its two secrets were never removed from the Worker either, so it came
// back on with no configuration at all.
//
// Bing matters out of proportion to its click count: its index is what ChatGPT
// search reads, so this is the only panel that says anything about how AI
// answers see the site.

const BASE = 'https://ssl.bing.com/webmaster/api.svc/json';

export interface BingSearch {
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  topQueries: { query: string; clicks: number; impressions: number }[];
  topPages: { page: string; clicks: number; impressions: number }[];
}

export function isBingConfigured(): boolean {
  return Boolean(process.env.BING_WEBMASTER_API_KEY) && Boolean(process.env.BING_SITE_URL);
}

interface BingRow {
  Query?: string;
  Clicks?: number;
  Impressions?: number;
}

// Bing returns per-day rows per query/page — and GetPageStats puts the PAGE URL
// in the `Query` field. Collapse to one row per label, summed, clicks-desc.
export function aggregateBingRows(rows: BingRow[]): { label: string; clicks: number; impressions: number }[] {
  const m = new Map<string, { clicks: number; impressions: number }>();
  for (const r of rows) {
    const label = r.Query;
    if (typeof label !== 'string' || !label) continue;
    const prev = m.get(label) ?? { clicks: 0, impressions: 0 };
    m.set(label, {
      clicks: prev.clicks + (Number(r.Clicks) || 0),
      impressions: prev.impressions + (Number(r.Impressions) || 0),
    });
  }
  return [...m.entries()]
    .map(([label, v]) => ({ label, clicks: v.clicks, impressions: v.impressions }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}

async function call(method: string, key: string, site: string): Promise<BingRow[] | null> {
  try {
    const url = `${BASE}/${method}?siteUrl=${encodeURIComponent(site)}&apikey=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    const j = (await res.json()) as { d?: unknown };
    return Array.isArray(j?.d) ? (j.d as BingRow[]) : null; // error responses carry no `d`
  } catch {
    return null;
  }
}

export async function fetchBingSearch(): Promise<BingSearch | null> {
  const key = process.env.BING_WEBMASTER_API_KEY;
  const site = process.env.BING_SITE_URL;
  if (!key || !site) return null;
  const [traffic, queries, pages] = await Promise.all([
    call('GetRankAndTrafficStats', key, site),
    call('GetQueryStats', key, site),
    call('GetPageStats', key, site),
  ]);
  if (!traffic && !queries && !pages) return null; // all calls failed (bad key/site)
  const clicks = (traffic ?? []).reduce((s, r) => s + (Number(r.Clicks) || 0), 0);
  const impressions = (traffic ?? []).reduce((s, r) => s + (Number(r.Impressions) || 0), 0);
  const q = aggregateBingRows(queries ?? []);
  const p = aggregateBingRows(pages ?? []);
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    topQueries: q.slice(0, 10).map(x => ({ query: x.label, clicks: x.clicks, impressions: x.impressions })),
    topPages: p.slice(0, 8).map(x => ({ page: x.label, clicks: x.clicks, impressions: x.impressions })),
  };
}
