import { googleAccessToken, googleJson, readServiceAccount } from './google-auth';

// GA4 audience data for the console's Traffic tab. Restored in 0.334.75 after
// 0.334.27 removed it with the SDK that made it expensive — this talks to the
// Data API's REST surface directly, so it costs the Worker nothing.
//
// Reads a base64 service-account key (GA4_SA_KEY) and the NUMERIC property id
// (GA4_PROPERTY_ID — from Analytics Admin → Property settings, not the G- id).
// Server-only, fail-soft: missing env or an API error returns null and the panel
// renders a connect / unavailable state rather than 500ing the console.

const ENDPOINT = 'https://analyticsdata.googleapis.com/v1beta';
const SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];

export interface Ga4Traffic {
  users: number;
  sessions: number;
  pageViews: number;
  topPages: { path: string; views: number }[];
  topCountries: { country: string; users: number }[];
  /** Daily users across the window, oldest first — the panel's sparkline. */
  trend: number[];
}

export function isGa4Configured(): boolean {
  return Boolean(process.env.GA4_PROPERTY_ID) && Boolean(process.env.GA4_SA_KEY);
}

interface ReportResponse {
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
}

const num = (v: string | undefined): number => Number(v ?? 0) || 0;

export async function fetchGa4Traffic(days = 28): Promise<Ga4Traffic | null> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const sa = readServiceAccount('GA4_SA_KEY');
  if (!propertyId || !sa) return null;

  const token = await googleAccessToken(sa, SCOPES);
  if (!token) return null;

  const url = `${ENDPOINT}/properties/${encodeURIComponent(propertyId)}:runReport`;
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }];

  const [totals, pages, countries, daily] = await Promise.all([
    googleJson<ReportResponse>(url, token, {
      dateRanges,
      metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
    }),
    googleJson<ReportResponse>(url, token, {
      dateRanges,
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 8,
    }),
    googleJson<ReportResponse>(url, token, {
      dateRanges,
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'totalUsers' }],
      orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      limit: 6,
    }),
    googleJson<ReportResponse>(url, token, {
      dateRanges,
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'totalUsers' }],
      // Ascending by date, so the sparkline reads left-to-right as time.
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: days + 1,
    }),
  ]);

  // Totals is the one call that must land; the rest degrade to empty lists so a
  // single quota'd sub-report does not blank the whole panel.
  if (!totals) return null;

  const t = totals.rows?.[0]?.metricValues ?? [];
  return {
    users: num(t[0]?.value),
    sessions: num(t[1]?.value),
    pageViews: num(t[2]?.value),
    topPages: (pages?.rows ?? []).map(r => ({
      path: r.dimensionValues?.[0]?.value ?? '',
      views: num(r.metricValues?.[0]?.value),
    })),
    topCountries: (countries?.rows ?? []).map(r => ({
      country: r.dimensionValues?.[0]?.value ?? '',
      users: num(r.metricValues?.[0]?.value),
    })),
    trend: (daily?.rows ?? []).map(r => num(r.metricValues?.[0]?.value)),
  };
}
