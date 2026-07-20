// Live health monitor for WEEKEND SESSION SCHEDULES (CLI). Sibling of
// health-standings / health-results. Flags rounds whose session list is
// anomalously thin vs the series' own norm — the failure the row-count monitors
// miss (a weekend rendering only "Free Practice 2").
//
//   npm run health:sessions           # human table; exit 1 if any schedule is thin
//   npx tsx scripts/health-sessions.mts --json   # machine-readable
//
// Any thin/empty schedule fails (exit 1) — for schedules, a thin round IS the
// defect we're catching, so there's no separate --strict tier.

import {
  runSessionsHealth,
  summarizeSessions,
  SESSIONS_HEALTH_SEASON,
  type SessionHealthStatus,
} from '../lib/sessions-health';

const JSON_OUT = process.argv.includes('--json');

const results = await runSessionsHealth();
const s = summarizeSessions(results);

if (JSON_OUT) {
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), season: SESSIONS_HEALTH_SEASON, ...s, results }, null, 2));
} else {
  const icon: Record<SessionHealthStatus, string> = { OK: '🟢', LOW: '🟡', EMPTY: '🔴', ERROR: '🔴' };
  console.log(`\n  Weekend schedule health — ${SESSIONS_HEALTH_SEASON} season\n`);
  for (const r of results) {
    const note = r.error
      ? r.error
      : r.completedRounds === 0
        ? 'no completed rounds yet'
        : r.thin.length
          ? `thin: ${r.thin.map(t => `R${t.round} ${t.name} (${t.sessions})`).join(', ')}  [median ${r.median}, floor ${r.floor}]`
          : `${r.completedRounds} rounds · median ${r.median} sessions`;
    console.log(`  ${icon[r.status]} ${r.status.padEnd(5)} ${r.label.padEnd(14)} ${String(r.ms + 'ms').padStart(7)}  ${note}`);
  }
  console.log(`\n  ${s.total} series · ${s.healthy} healthy · ${s.flagged} flagged`);
  if (s.flagged) console.log(`  ✗ FLAGGED: ${s.flaggedSlugs.join(', ')} — a weekend schedule looks incomplete/thin.`);
  else console.log(`  ✓ every series' weekend schedules look complete.`);
}

process.exit(s.flagged ? 1 : 0);
