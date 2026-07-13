import { BetaAnalyticsDataClient } from '@google-analytics/data';

// GA4 "Traffic" panel data for /admin. Reads a service-account key from a base64
// env (GA4_SA_KEY) + the numeric property id (GA4_PROPERTY_ID). Server-only.
// FAIL-SOFT: any missing/invalid env or API error returns null, so the admin
// shows a "connect" / "unavailable" state and never 500s. The SA must have the
// GA4 property granted Viewer.

export interface Ga4Traffic {
  users: number;
  sessions: number;
  pageViews: number;
  topPages: { path: string; views: number }[];
  topCountries: { country: string; users: number }[];
}

// Parse the base64 SA JSON into just the two fields the client needs. Never logs.
function credentials(): { client_email: string; private_key: string } | null {
  const b64 = process.env.GA4_SA_KEY;
  if (!b64) return null;
  try {
    const j = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as Record<string, unknown>;
    if (typeof j.client_email === 'string' && typeof j.private_key === 'string') {
      return { client_email: j.client_email, private_key: j.private_key };
    }
  } catch {
    /* malformed key — treat as unconfigured */
  }
  return null;
}

export function isGa4Configured(): boolean {
  return Boolean(process.env.GA4_PROPERTY_ID) && Boolean(process.env.GA4_SA_KEY);
}

const num = (v: string | null | undefined): number => Number(v ?? 0) || 0;

export async function fetchGa4Traffic(days = 30): Promise<Ga4Traffic | null> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const creds = credentials();
  if (!propertyId || !creds) return null;
  try {
    const client = new BetaAnalyticsDataClient({ credentials: creds });
    const property = `properties/${propertyId}`;
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }];
    const [totals, pages, countries] = await Promise.all([
      client.runReport({
        property,
        dateRanges,
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 8,
      }),
      client.runReport({
        property,
        dateRanges,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 6,
      }),
    ]);
    const t = totals[0].rows?.[0]?.metricValues ?? [];
    return {
      users: num(t[0]?.value),
      sessions: num(t[1]?.value),
      pageViews: num(t[2]?.value),
      topPages: (pages[0].rows ?? []).map(r => ({
        path: r.dimensionValues?.[0]?.value ?? '',
        views: num(r.metricValues?.[0]?.value),
      })),
      topCountries: (countries[0].rows ?? []).map(r => ({
        country: r.dimensionValues?.[0]?.value ?? '',
        users: num(r.metricValues?.[0]?.value),
      })),
    };
  } catch {
    return null;
  }
}
