// Live scraper health monitor for RESULTS (CLI). Sibling of health-standings.
//
//   npm run health:results              # human table; exit 1 if any source is DOWN
//   npx tsx scripts/health-results.mts --strict   # also fail on LOW (degraded)
//   npx tsx scripts/health-results.mts --json      # machine-readable
//
// Results grade OK / EMPTY / ERROR (no magnitude floor — they accumulate across
// a season). Exit 0 = all parsed; 1 = a results source returned nothing/threw.

import { runResultsHealth, summarize, RESULTS_HEALTH_SEASON, type HealthStatus } from '../lib/results-health';

const STRICT = process.argv.includes('--strict');
const JSON_OUT = process.argv.includes('--json');

const results = (await runResultsHealth()).sort((a, b) => a.label.localeCompare(b.label));
const s = summarize(results);

if (JSON_OUT) {
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), season: RESULTS_HEALTH_SEASON, ...s, results }, null, 2));
} else {
  const icon: Record<HealthStatus, string> = { OK: '🟢', LOW: '🟡', EMPTY: '🔴', ERROR: '🔴' };
  console.log(`\n  Results source health — ${RESULTS_HEALTH_SEASON} season\n`);
  for (const r of results) {
    const note = r.error ? r.error : `${r.rows} rows`;
    console.log(`  ${icon[r.status]} ${r.status.padEnd(5)} ${r.label.padEnd(12)} ${String(r.ms + 'ms').padStart(7)}  ${note}  ·  ${r.source}`);
  }
  console.log(`\n  ${s.total} sources · ${s.healthy} healthy · ${s.down} down`);
  if (s.down) console.log(`  ✗ DOWN: ${s.downSlugs.join(', ')} — a results parser returned nothing or threw.`);
  else console.log(`  ✓ every live results source parsed cleanly.`);
}

process.exit(s.down || (STRICT && s.low) ? 1 : 0);
