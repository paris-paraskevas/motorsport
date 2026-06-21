// Live scraper health monitor for standings (CLI).
//
// Runs each series' REAL production standings fetcher against its live source
// and checks the result is sane — not null, not empty, at/above an expected row
// floor. Catches what the frozen test fixtures can't: a source site quietly
// changing layout so a parser returns blank/partial data mid-season. The rules
// live in lib/standings-health.ts so this and the /api/cron/health route agree.
//
//   npm run health:standings              # human table; exit 1 if any source is DOWN
//   npx tsx scripts/health-standings.mts --strict   # also fail on LOW (degraded)
//   npx tsx scripts/health-standings.mts --json     # machine-readable
//
// Exit 0 = all healthy; 1 = a source is DOWN (ERROR/EMPTY), or (with --strict) LOW.

import { runStandingsHealth, summarize, HEALTH_SEASON, type HealthStatus } from '../lib/standings-health';

const STRICT = process.argv.includes('--strict');
const JSON_OUT = process.argv.includes('--json');

const results = (await runStandingsHealth()).sort((a, b) => a.label.localeCompare(b.label));
const s = summarize(results);

if (JSON_OUT) {
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), season: HEALTH_SEASON, ...s, results }, null, 2));
} else {
  const icon: Record<HealthStatus, string> = { OK: '🟢', LOW: '🟡', EMPTY: '🔴', ERROR: '🔴' };
  console.log(`\n  Standings source health — ${HEALTH_SEASON} season\n`);
  for (const r of results) {
    const note = r.error ? r.error : r.status === 'LOW' ? `only ${r.rows} rows (floor ${r.min})` : `${r.rows} rows`;
    console.log(`  ${icon[r.status]} ${r.status.padEnd(5)} ${r.label.padEnd(12)} ${String(r.ms + 'ms').padStart(7)}  ${note}  ·  ${r.source}`);
  }
  console.log(`\n  ${s.total} sources · ${s.healthy} healthy · ${s.low} degraded · ${s.down} down`);
  if (s.down) console.log(`  ✗ DOWN: ${s.downSlugs.join(', ')} — a parser likely broke or the source changed.`);
  else if (s.low) console.log(`  ⚠ DEGRADED: ${s.lowSlugs.join(', ')} — check before trusting these tables.`);
  else console.log(`  ✓ every live standings source parsed cleanly.`);
}

process.exit(s.down || (STRICT && s.low) ? 1 : 0);
