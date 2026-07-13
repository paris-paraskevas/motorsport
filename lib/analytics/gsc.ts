import { searchconsole, auth } from '@googleapis/searchconsole';

// Google Search Console "Search" panel data for /admin. Reads a service-account
// key from a base64 env (GSC_SA_KEY) + the property (GSC_SITE_URL, e.g.
// "sc-domain:paddock-tracker.com"). Server-only. FAIL-SOFT: missing/invalid env
// or API error → null, so the admin shows "connect"/"unavailable", never 500s.
// The SA must be added as a user on the Search Console property.

export interface GscSearch {
  clicks: number;
  impressions: number;
  ctr: number; // 0..1
  position: number; // average
  topQueries: { query: string; clicks: number; impressions: number }[];
  topPages: { page: string; clicks: number }[];
}

function credentials(): { client_email: string; private_key: string } | null {
  const b64 = process.env.GSC_SA_KEY;
  if (!b64) return null;
  try {
    const j = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
    if (typeof j.client_email === 'string' && typeof j.private_key === 'string') {
      return { client_email: j.client_email, private_key: j.private_key };
    }
  } catch {
    /* malformed key */
  }
  return null;
}

export function isGscConfigured(): boolean {
  return Boolean(process.env.GSC_SITE_URL) && Boolean(process.env.GSC_SA_KEY);
}

// YYYY-MM-DD, `days` ago (UTC). GSC data lags ~2 days, so callers end at -2.
function ymd(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export async function fetchGscSearch(days = 28): Promise<GscSearch | null> {
  const siteUrl = process.env.GSC_SITE_URL;
  const creds = credentials();
  if (!siteUrl || !creds) return null;
  try {
    const authClient = new auth.GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    const client = searchconsole({ version: 'v1', auth: authClient });
    const startDate = ymd(days);
    const endDate = ymd(2); // GSC data settles ~2 days behind
    const query = async (dimensions: string[], rowLimit: number) => {
      const res = await client.searchanalytics.query({ siteUrl, requestBody: { startDate, endDate, dimensions, rowLimit } });
      return res.data.rows ?? [];
    };
    const [totalsRows, queryRows, pageRows] = await Promise.all([query([], 1), query(['query'], 10), query(['page'], 8)]);
    const t = totalsRows[0] ?? {};
    return {
      clicks: Math.round(t.clicks ?? 0),
      impressions: Math.round(t.impressions ?? 0),
      ctr: t.ctr ?? 0,
      position: t.position ?? 0,
      topQueries: queryRows.map(r => ({
        query: r.keys?.[0] ?? '',
        clicks: Math.round(r.clicks ?? 0),
        impressions: Math.round(r.impressions ?? 0),
      })),
      topPages: pageRows.map(r => ({ page: r.keys?.[0] ?? '', clicks: Math.round(r.clicks ?? 0) })),
    };
  } catch {
    return null;
  }
}
