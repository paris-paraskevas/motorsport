// The Data workspace's catalogue (Phase 4 of the designer plan, the approved
// prototype's Data screen): one entry per outside service the site talks to,
// in three tiers. `now` = the Worker already holds the credential and the code
// that reads the service (lib/analytics/*, Clerk, Supabase, the key-value
// store); `cred` = one more credential or an enablement the operator would
// create, so the card explains how and shows dashes until then; `own` = the
// vendor has no API to read, so the card shows what our own tables record.
//
// Client-safe: the workspace draws from it, the server loader (data.ts) reads
// the services it names. Credentials appear here by NAME only, never by value;
// the loader reports presence, nothing else. Every fact below states what the
// code does today; a new reader gets its entry in the same PR.

export type DataTier = 'now' | 'cred' | 'own';
/** What a card shows: figures, a connect note, our own records, or the reader's failure. */
export type DataState = 'live' | 'connect' | 'own' | 'error';

export interface DataService {
  key: string;
  name: string;
  /** The two-to-four letter tag on the card. */
  mono: string;
  tier: DataTier;
  api: { name: string; auth: string };
  /** The environment variables the connection needs, by name. */
  cred: readonly string[];
  /** Where the credential lives and which module reads it. */
  where: string;
  /** How to connect, for the `cred` tier. */
  steps?: readonly string[];
  /** What the API cannot tell, so nobody looks for it. */
  gaps: readonly string[];
  /** The 28-day chart's caption when the reader gives a daily series. */
  seriesLabel?: string;
  /** Freshness and limits, as the vendor documents them. */
  health: readonly [string, string][];
}

export const DATA_TIERS: readonly { tier: DataTier; label: string }[] = [
  { tier: 'now', label: 'Readable today · credentials already on the Worker' },
  { tier: 'cred', label: 'One more credential or an enablement' },
  { tier: 'own', label: 'No API · our own tables, or nothing' },
];

export const DATA_SERVICES: readonly DataService[] = [
  {
    key: 'ga4',
    name: 'Google Analytics 4',
    mono: 'GA4',
    tier: 'now',
    api: { name: 'GA4 Data API v1beta', auth: 'Service account (a signed JWT exchanged for an access token)' },
    cred: ['GA4_SA_KEY', 'GA4_PROPERTY_ID'],
    where: 'Worker secrets · lib/analytics/ga4.ts',
    gaps: ['Consent-gated: visitors who decline analytics are invisible', 'No same-day final data', 'Event-level data is not in the Data API'],
    seriesLabel: 'Users · daily',
    health: [['Data lag', 'Yesterday complete in the morning, UTC'], ['Window', '28 days'], ['Quota', 'Well inside the daily token allowance at one read a minute']],
  },
  {
    key: 'gsc',
    name: 'Google Search Console',
    mono: 'GSC',
    tier: 'now',
    api: { name: 'Search Console API v3', auth: 'The same service account, webmasters.readonly' },
    cred: ['GSC_SA_KEY', 'GSC_SITE_URL'],
    where: 'Worker secrets · lib/analytics/gsc.ts',
    gaps: ['Two to three days behind by design', 'Rare, anonymised queries are omitted', 'Crawl stats, index coverage and Web Vitals are dashboard-only'],
    health: [['Data lag', 'The window ends two days ago, so a morning never reads as a collapse'], ['Window', '28 days'], ['Quota', '1,200 queries a minute; the console makes three']],
  },
  {
    key: 'bing',
    name: 'Bing Webmaster Tools',
    mono: 'BING',
    tier: 'now',
    api: { name: 'Bing Webmaster API (JSON)', auth: 'API key per user, valid for every verified site' },
    cred: ['BING_WEBMASTER_API_KEY', 'BING_SITE_URL'],
    where: 'Worker secrets · lib/analytics/bing.ts',
    gaps: ['Query data refreshes weekly', 'Dates arrive in a format the reader does not parse, so no daily series yet', 'No device or country split on the stats calls'],
    health: [['Data lag', 'Traffic to yesterday; queries to last week’s cut'], ['Why it matters', 'Bing’s index is what ChatGPT search reads']],
  },
  {
    key: 'cf',
    name: 'Cloudflare · account',
    mono: 'CF',
    tier: 'now',
    api: { name: 'GraphQL Analytics API + billing REST', auth: 'Two tokens on purpose: Account Analytics:Read, Billing:Read' },
    cred: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_ANALYTICS_TOKEN', 'CLOUDFLARE_BILLING_TOKEN'],
    where: 'Worker secrets · lib/analytics/cloudflare.ts',
    gaps: ['The Worker’s bundle size is in no API (only wrangler deploy --dry-run)', 'The billable-usage endpoint reports usage-based charges only: the plan’s fixed fee is not in it'],
    health: [['Data lag', 'About two minutes'], ['Window', '30 days, the production Worker only'], ['Allowance', 'Workers Paid includes 10,000,000 requests a month']],
  },
  {
    key: 'clerk',
    name: 'Clerk',
    mono: 'CLK',
    tier: 'now',
    api: { name: 'Clerk Backend API', auth: 'The Worker’s secret key' },
    cred: ['CLERK_SECRET_KEY'],
    where: 'Worker secret · clerkClient() in the code',
    gaps: ['No sign-in, MAU or retention analytics via the API (dashboard only)', 'last_active_at is a high-water mark: past windows cannot be reconstructed'],
    health: [['Data lag', 'Live'], ['Read', 'The account count and the 25 newest accounts']],
  },
  {
    key: 'sb',
    name: 'Supabase · our tables',
    mono: 'SB',
    tier: 'now',
    api: { name: 'PostgREST via supabase-js', auth: 'The Worker’s service-role key' },
    cred: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    where: 'Worker secrets · lib/betting/client.ts',
    gaps: ['Database size and per-table sizes need the Management API (Supabase · platform)'],
    health: [['Data lag', 'Live'], ['Read', 'Row counts of the design tables and the loader’s newest run per source']],
  },
  {
    key: 'upstash',
    name: 'Upstash · the key-value store',
    mono: 'UPS',
    tier: 'now',
    api: { name: 'Upstash Redis REST', auth: 'The REST token the code already holds' },
    cred: ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    where: 'Worker secrets · lib/kv.ts',
    gaps: ['Throughput and latency series need the developer API key (not held)'],
    health: [['Data lag', 'Live'], ['Read', 'The key count and the push subscriptions']],
  },
  {
    key: 'cfzone',
    name: 'Cloudflare · zone',
    mono: 'ZONE',
    tier: 'cred',
    api: { name: 'GraphQL zone datasets + Web Analytics (RUM)', auth: 'Zone Analytics:Read token + zone id (new); RUM needs enabling on the zone' },
    cred: ['CLOUDFLARE_ZONE_ID', 'CLOUDFLARE_ZONE_ANALYTICS_TOKEN'],
    where: 'Not yet created',
    steps: ['Cloudflare dashboard → My Profile → API Tokens → Create Token: Zone · Zone Analytics · Read, for paddock-tracker.com', 'Copy the zone id from the zone’s Overview page', 'Add both as Worker secrets on the production Worker, then tell the designer to read them (a small PR)'],
    gaps: ['Sampled at high volume (exact at ours)', 'RUM processes in the US only'],
    health: [['Once connected', 'Edge requests, cache hit ratio, 5xx ratio, unique visitors, Core Web Vitals from real users']],
  },
  {
    key: 'cfdeploy',
    name: 'Cloudflare · deploys and builds',
    mono: 'BLD',
    tier: 'cred',
    api: { name: 'Workers REST: deployments, versions, Builds', auth: 'Workers Scripts:Read and Workers CI:Read tokens (new)' },
    cred: ['CLOUDFLARE_SCRIPTS_TOKEN', 'CLOUDFLARE_BUILDS_TOKEN'],
    where: 'Not yet created',
    steps: ['Create a token with Workers Scripts:Read on the account', 'Create a user-scoped token with Workers CI:Read', 'Add both as Worker secrets on the production Worker, then a small PR reads them'],
    gaps: ['The Worker’s size is not exposed by any API'],
    health: [['Once connected', 'The live version, the deploy timeline with commit messages, build outcomes and durations']],
  },
  {
    key: 'gha',
    name: 'GitHub Actions',
    mono: 'GHA',
    tier: 'cred',
    api: { name: 'GitHub REST · Actions', auth: 'Fine-grained token with Actions:Read on the repository (new)' },
    cred: ['GITHUB_ACTIONS_TOKEN'],
    where: 'Not yet a Worker secret; today the operator runs gh run list',
    steps: ['GitHub → Settings → Developer settings → Fine-grained tokens: repository paris-paraskevas/motorsport, Actions: Read', 'Add it as a Worker secret on the production Worker, then a small PR reads it'],
    gaps: ['Logs expire and need a second hop', 'Billable minutes only for private repositories'],
    health: [['Once connected', 'The loader’s runs (warm-live-data): the last run, its result, its duration, the cadence']],
  },
  {
    key: 'sbplat',
    name: 'Supabase · platform',
    mono: 'SBP',
    tier: 'cred',
    api: { name: 'Supabase Management API', auth: 'A scoped Management API token as a Worker secret (new; the laptop’s PAT stays on the laptop)' },
    cred: ['SUPABASE_MANAGEMENT_TOKEN'],
    where: 'Not yet created',
    steps: ['Supabase → Account → Access Tokens: a token for the project with read scopes only', 'Add it as a Worker secret on the production Worker, then a small PR reads it'],
    gaps: ['Egress and organisation billing are not in the v1 API'],
    health: [['Once connected', 'Database size, connections, API requests by service, slow queries']],
  },
  {
    key: 'push',
    name: 'Web Push',
    mono: 'WP',
    tier: 'own',
    api: { name: 'None to read: push services only answer each send', auth: 'VAPID keys (present)' },
    cred: ['VAPID_PRIVATE_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY'],
    where: 'Worker secrets · lib/push.ts; subscriptions live in the key-value store',
    gaps: ['No delivery or open receipts exist for web push', 'Nothing is persisted per send today; a send is only a cron response'],
    health: [['Read', 'The subscriptions stored, when the key-value store is readable']],
  },
  {
    key: 'idx',
    name: 'IndexNow',
    mono: 'IDX',
    tier: 'own',
    api: { name: 'Submission only', auth: 'A public key file on the site' },
    cred: [],
    where: 'lib/indexnow.ts; run by hand with npm run indexnow:submit',
    gaps: ['No indexing status from IndexNow; Bing Webmaster’s submission report is the nearest thing', 'Not scheduled: an automation on publish would be the obvious rule'],
    health: [['Read', 'Nothing yet: submissions are not recorded']],
  },
  {
    key: 'upstream',
    name: 'Upstream feeds · OpenF1, FOM, Open-Meteo, series sites',
    mono: 'UP',
    tier: 'own',
    api: { name: 'No usage or quota endpoints; limits documented and enforced by 429s', auth: 'Public, apart from FOM’s per-brand keys' },
    cred: [],
    where: 'Called only by the loader from GitHub’s IPs; the Worker runs DATA_SOURCE=db',
    gaps: ['No vendor quota endpoints', 'The per-request log does not exist; the loader keeps only the last outcome per source'],
    health: [['Read', 'The loader’s newest run per source: ok, failed, rows written, when']],
  },
];

export function findDataService(key: string): DataService | null {
  return DATA_SERVICES.find(s => s.key === key) ?? null;
}
