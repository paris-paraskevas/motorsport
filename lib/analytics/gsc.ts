import { googleAccessToken, googleJson, readServiceAccount } from './google-auth';

// Google Search Console data for the console's Traffic tab. Restored in
// 0.334.75 against the REST surface, for the same reason as ga4.ts: the SDK was
// the 653 KiB, not the data.
//
// Reads a base64 service-account key (GSC_SA_KEY) and the property string
// (GSC_SITE_URL) EXACTLY as Search Console shows it — a domain property is
// "sc-domain:paddock-tracker.com", a URL-prefix property keeps its trailing
// slash. The API rejects a near-miss rather than guessing, so this value is not
// somewhere to be approximate.
//
// Server-only, fail-soft: null → the panel shows connect / unavailable.

const ENDPOINT = 'https://searchconsole.googleapis.com/webmasters/v3/sites';
const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

export interface GscSearch {
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number; // average
  topQueries: { query: string; clicks: number; impressions: number }[];
  topPages: { page: string; clicks: number }[];
}

export function isGscConfigured(): boolean {
  return Boolean(process.env.GSC_SITE_URL) && Boolean(process.env.GSC_SA_KEY);
}

interface QueryResponse {
  rows?: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[];
}

/** YYYY-MM-DD, `daysAgo` days back (UTC). */
function ymd(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export async function fetchGscSearch(days = 28): Promise<GscSearch | null> {
  const siteUrl = process.env.GSC_SITE_URL;
  const sa = readServiceAccount('GSC_SA_KEY');
  if (!siteUrl || !sa) return null;

  const token = await googleAccessToken(sa, SCOPES);
  if (!token) return null;

  const url = `${ENDPOINT}/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const startDate = ymd(days);
  // Search Console data settles about two days behind; ending at "today" would
  // report a collapse every morning that is just the data not having arrived.
  const endDate = ymd(2);

  const [totals, queries, pages] = await Promise.all([
    googleJson<QueryResponse>(url, token, { startDate, endDate, dimensions: [], rowLimit: 1 }),
    googleJson<QueryResponse>(url, token, { startDate, endDate, dimensions: ['query'], rowLimit: 10 }),
    googleJson<QueryResponse>(url, token, { startDate, endDate, dimensions: ['page'], rowLimit: 8 }),
  ]);

  if (!totals) return null;

  const t = totals.rows?.[0] ?? {};
  return {
    clicks: Math.round(t.clicks ?? 0),
    impressions: Math.round(t.impressions ?? 0),
    ctr: t.ctr ?? 0,
    position: t.position ?? 0,
    topQueries: (queries?.rows ?? []).map(r => ({
      query: r.keys?.[0] ?? '',
      clicks: Math.round(r.clicks ?? 0),
      impressions: Math.round(r.impressions ?? 0),
    })),
    topPages: (pages?.rows ?? []).map(r => ({
      page: r.keys?.[0] ?? '',
      clicks: Math.round(r.clicks ?? 0),
    })),
  };
}
