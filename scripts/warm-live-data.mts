// Warm EVERY series' live-data "last-good" caches (standings + results) from a
// NON-Cloudflare host. THE ONLY WRITER of the site's data.
//
// Community data APIs (jolpi.ca for F1, FOM/Pulselive/Wikipedia/motorsport.com/
// fiawec/Alkamel for the rest) rate-limit or block Cloudflare Workers' shared
// datacenter egress IPs, so the site's per-request fetch fails on Workers. The
// Worker therefore runs with `DATA_SOURCE=db` (see `isDbReadOnly` in
// lib/source-snapshot.ts): it READS the KV + Supabase `source_snapshot` tiers and
// never calls upstream, so whatever an API does at request time is irrelevant.
// This script runs the SAME production fetchers from a clean IP (a laptop or
// GitHub Actions) and their `withSourceSnapshot` / `withF1LastGood` wrappers
// persist each payload — which is what the site then serves.
//
// Two layers, deliberately:
//   1. runStandingsHealth / runResultsHealth — the registries the health
//      endpoint uses, so this can never drift from what the site fetches.
//   2. EXTRA_SURFACES below — the slots those registries don't cover (results
//      for the multi-class + content-coupled series, the F1 sprint/last-race
//      slots, the WRC chart series). Each entry MUST call the fetcher with the
//      same arguments the page passes: the snapshot key is per-surface, not
//      per-argument, so warming with different args would store a payload the
//      site doesn't want (IndyCar's curated-driver name normalisation is the
//      live example).
//
//   npx tsx --env-file=.env.production.local scripts/warm-live-data.mts
import { runStandingsHealth } from '../lib/standings-health';
import { runResultsHealth } from '../lib/results-health';
import { readSnapshot } from '../lib/source-snapshot';
import { betDb } from '../lib/betting/client';
import { loadSeries } from '../lib/series';
import { loadCuratedDrivers } from '../lib/series-content';
import { fetchF1SeasonSprints, fetchF1LastRace } from '../lib/results/f1';
import { fetchWRCSeasonChartPoints } from '../lib/results/wrc';
import { fetchDTMSeasonResults } from '../lib/results/dtm';
import { fetchNascarCupSeasonResults } from '../lib/results/nascar-cup';
import { fetchNlsSeasonResults } from '../lib/results/nls';
import { fetchAllGtWorldSeasonRaces } from '../lib/results/gt-world';
import { fetchImsaSeasonResults } from '../lib/results/imsa';
import { fetchWecSeasonResults } from '../lib/results/wec';
import { fetchIndyCarSeasonResults } from '../lib/results/indycar';
import { HOME_RESULTS_SLUGS, fetchLatestPodium } from '../lib/home-results';

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.error('KV_REST_API_URL / KV_REST_API_TOKEN missing — nothing to warm.');
  process.exit(1);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — the durable snapshot tier is the one the site reads. Aborting.');
  process.exit(1);
}
// A stray DATA_SOURCE=db in the runner's env would turn every fetcher below into
// a reader and this whole run into a no-op. Fail loudly instead of silently.
if (process.env.DATA_SOURCE === 'db') {
  console.error('DATA_SOURCE=db is set — the writer would read instead of fetch. Unset it for this run.');
  process.exit(1);
}

/** Row count for any payload shape the fetchers return (for the log only). */
function rowsOf(v: unknown): number {
  if (v == null) return 0;
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.feature) || Array.isArray(o.sprint)) {
      return (o.feature as unknown[] ?? []).length + (o.sprint as unknown[] ?? []).length;
    }
    return 1;
  }
  return 0;
}

console.error('=== standings (all series) ===');
const standings = await runStandingsHealth();
for (const r of standings) console.error(`  ${r.label.padEnd(14)} ${r.status.padEnd(8)} ${r.rows} rows`);

console.error('=== results (health registry) ===');
const results = await runResultsHealth();
for (const r of results) console.error(`  ${r.label.padEnd(14)} ${r.status.padEnd(8)} ${r.rows} rows`);

// Surfaces the two registries don't reach. Sequential: these are the politest-
// treated sources (Alkamel, fiawec CMS, SRO) and a burst is what gets an IP
// blocked in the first place.
const EXTRA_SURFACES: { label: string; run: () => Promise<unknown> }[] = [
  { label: 'f1 sprints', run: () => fetchF1SeasonSprints() },
  { label: 'f1 last race', run: () => fetchF1LastRace() },
  { label: 'wrc chart', run: () => fetchWRCSeasonChartPoints() },
  {
    // Same args the Results tab passes (curated drivers normalise the names).
    label: 'indycar (curated)',
    run: async () => fetchIndyCarSeasonResults({ drivers: await loadCuratedDrivers('indycar') }),
  },
  {
    label: 'dtm results',
    run: async () => {
      const series = await loadSeries('dtm');
      return fetchDTMSeasonResults(series.meta.season, series.rounds?.rounds);
    },
  },
  {
    label: 'nascar results',
    run: async () => {
      const series = await loadSeries('nascar-cup');
      const rounds = (series.rounds?.rounds ?? []).map(r => ({
        round: r.round,
        startDate: r.startDate,
        name: r.name,
      }));
      return fetchNascarCupSeasonResults({ rounds });
    },
  },
  {
    label: 'nls results',
    run: async () => {
      const series = await loadSeries('nls');
      return fetchNlsSeasonResults(series.meta.season);
    },
  },
  {
    label: 'gt-world results',
    run: async () => {
      const series = await loadSeries('gt-world');
      return fetchAllGtWorldSeasonRaces(series.meta.season);
    },
  },
  { label: 'imsa results', run: () => fetchImsaSeasonResults() },
  { label: 'wec results', run: () => fetchWecSeasonResults() },
];

console.error('=== results (extra surfaces) ===');
let extraOk = 0;
for (const surface of EXTRA_SURFACES) {
  const started = Date.now();
  try {
    const payload = await surface.run();
    const rows = rowsOf(payload);
    if (rows > 0) extraOk++;
    console.error(`  ${surface.label.padEnd(18)} ${(rows > 0 ? 'OK' : 'EMPTY').padEnd(8)} ${rows} rows  ${Date.now() - started}ms`);
  } catch (err) {
    console.error(`  ${surface.label.padEnd(18)} ${'ERROR'.padEnd(8)} ${err instanceof Error ? err.message : String(err)}`);
  }
}

// The landing's Last-time-out block (plus the /app and series-page podium
// cards) read `paddock:home:podium:v2:*` from KV. The in-worker warm-results
// cron can only rebuild those entries from already-seeded snapshots; writing
// them here from a clean IP makes the block reliably present, and pairs with
// the 0.321.2 negative cache (an empty outcome is sentinel-cached on the
// Worker so a cold series can never stall renders). `force` bypasses both
// caches so this always refreshes. Sequential — same politeness rule as
// EXTRA_SURFACES.
console.error('=== home podiums (landing "Last time out") ===');
let podiumOk = 0;
for (const slug of HOME_RESULTS_SLUGS) {
  const started = Date.now();
  try {
    const race = await fetchLatestPodium(slug, { force: true });
    if (race) podiumOk++;
    console.error(
      `  ${slug.padEnd(18)} ${(race ? 'OK' : 'EMPTY').padEnd(8)} ${race ? race.raceName : ''}  ${Date.now() - started}ms`,
    );
  } catch (err) {
    console.error(`  ${slug.padEnd(18)} ${'ERROR'.padEnd(8)} ${err instanceof Error ? err.message : String(err)}`);
  }
}

const sOk = standings.filter(r => r.status === 'OK' || r.status === 'LOW').length;
const rOk = results.filter(r => r.status === 'OK' || r.status === 'LOW').length;
console.error(
  `\nfetched: ${sOk}/${standings.length} standings + ${rOk}/${results.length} results` +
    ` + ${extraOk}/${EXTRA_SURFACES.length} extra surfaces + ${podiumOk}/${HOME_RESULTS_SLUGS.length} home podiums.`,
);

// PROVE the writes landed. Counting successful FETCHES was the bug: every
// snapshot write can fail (fail-soft by design, so a Supabase blip never breaks
// a render) while this script still printed "seeded 13/13" and the workflow went
// green. That masked two real outages in a row — quoted env values giving
// "Invalid supabaseUrl", then Node 20 giving "detected without native WebSocket
// support" — during which the site's only writer silently wrote nothing for
// hours. The DB is the product here, so a run that writes nothing must fail.
const durable = await readSnapshot<unknown>('f1:standings');
const { data: freshest } = await betDb()
  .from('source_snapshot')
  .select('source_key, fetched_at')
  .order('fetched_at', { ascending: false })
  .limit(1);
const newest = freshest?.[0]?.fetched_at ? Date.parse(String(freshest[0].fetched_at)) : 0;
const ageMin = newest ? Math.round((Date.now() - newest) / 60000) : Infinity;
console.error(
  `newest source_snapshot row: ${freshest?.[0]?.source_key ?? 'NONE'} (${
    Number.isFinite(ageMin) ? `${ageMin} min old` : 'never written'
  })`,
);

// A write from THIS run should be seconds old. 10 minutes of slack covers a slow
// full sweep; anything older means nothing was persisted.
if (durable == null || ageMin > 10) {
  console.error(
    'FAILED: no snapshot was written by this run. The fetches may have succeeded, but the' +
      ' DB the site reads was not updated. Check the [source] …:write:… lines above.',
  );
  process.exit(1);
}
console.error(`seeded OK: the DB the site reads was updated by this run.`);
process.exit(sOk + rOk + extraOk > 0 ? 0 : 1);
