// Warm EVERY series' live-data "last-good" caches (standings + results) from a
// NON-Cloudflare host.
//
// Community data APIs (jolpi.ca for F1, FOM/Pulselive/Wikipedia/motorsport.com/
// fiawec for the rest) rate-limit or block Cloudflare Workers' shared datacenter
// egress IPs, so the site's per-request fetch fails on Workers and its KV +
// Supabase-snapshot last-good caches never seed -> standings/results render empty
// or stale. This runs the SAME production fetchers the health checks use (every
// series), from a clean IP (a laptop or GitHub Actions): each fetch succeeds and
// its `withLastGood`/snapshot writes the KV + snapshot the Cloudflare site reads.
// Schedule it (GitHub Actions, clean IPs) so the data stays fresh after every
// session. Reuses runStandingsHealth/runResultsHealth so it can never drift from
// the registries the site actually fetches.
//
//   npx tsx --env-file=<prod KV + Supabase env> scripts/warm-live-data.mts
import { runStandingsHealth } from '../lib/standings-health';
import { runResultsHealth } from '../lib/results-health';

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.error('KV_REST_API_URL / KV_REST_API_TOKEN missing — nothing to warm.');
  process.exit(1);
}

console.error('=== standings (all series) ===');
const standings = await runStandingsHealth();
for (const r of standings) console.error(`  ${r.label.padEnd(14)} ${r.status.padEnd(8)} ${r.rows} rows`);

console.error('=== results (all series) ===');
const results = await runResultsHealth();
for (const r of results) console.error(`  ${r.label.padEnd(14)} ${r.status.padEnd(8)} ${r.rows} rows`);

const sOk = standings.filter(r => r.status !== 'DOWN').length;
const rOk = results.filter(r => r.status !== 'DOWN').length;
console.error(`\nseeded: ${sOk}/${standings.length} standings + ${rOk}/${results.length} results caches written for the Cloudflare site.`);
// Exit non-zero only if EVERYTHING failed (a real outage from this host), so a
// scheduled run flags a genuine problem but tolerates one flaky source.
process.exit(sOk + rOk > 0 ? 0 : 1);
