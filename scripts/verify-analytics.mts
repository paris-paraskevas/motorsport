// Local verification for the GA4 + GSC admin integrations. Exercises the real
// Google APIs with the service-account creds from the env and prints AGGREGATE
// counts only (never the key, never PII). Run with the SA key + property/site in
// the env, e.g.:
//   GA4_PROPERTY_ID=... GA4_SA_KEY=$(base64 -w0 key.json) \
//   GSC_SITE_URL=sc-domain:... GSC_SA_KEY=$(base64 -w0 key.json) \
//   npx tsx scripts/verify-analytics.mts
import { fetchGa4Traffic, isGa4Configured } from '@/lib/analytics/ga4';
import { fetchGscSearch, isGscConfigured } from '@/lib/analytics/gsc';

console.log('GA4 configured:', isGa4Configured());
const ga4 = await fetchGa4Traffic(30);
if (!ga4) console.log('GA4 → null (unconfigured or API error)');
else
  console.log(
    `GA4 30d → users=${ga4.users} sessions=${ga4.sessions} pageViews=${ga4.pageViews}; topPages=${ga4.topPages.length} topCountries=${ga4.topCountries.length}; sample page: ${ga4.topPages[0]?.path ?? 'n/a'}`,
  );

console.log('GSC configured:', isGscConfigured());
const gsc = await fetchGscSearch(28);
if (!gsc) console.log('GSC → null (unconfigured or API error)');
else
  console.log(
    `GSC 28d → clicks=${gsc.clicks} impressions=${gsc.impressions} ctr=${(gsc.ctr * 100).toFixed(1)}% pos=${gsc.position.toFixed(1)}; topQueries=${gsc.topQueries.length} topPages=${gsc.topPages.length}; sample query: ${gsc.topQueries[0]?.query ?? 'n/a'}`,
  );
