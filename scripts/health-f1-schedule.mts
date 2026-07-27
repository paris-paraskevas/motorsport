// F1 SCHEDULE CROSS-CHECK — diffs our rendered F1 weekend schedule (the ICS feed
// + curated sessions.json overrides) against OpenF1's OFFICIAL session times, to
// catch the wrong-DAY / wrong-TIME curation errors the count-based sessions-health
// monitor can't (right session count, wrong day). F1-ONLY: OpenF1 is F1's official
// timing source, and the other series have no machine-readable official timetable
// to diff against (their sites are SPA / bot-blocked — documented).
//
//   npx tsx scripts/health-f1-schedule.mts          # human report; exit 1 on a discrepancy
//   npx tsx scripts/health-f1-schedule.mts --json    # machine-readable
//
// LOCAL DIAGNOSTIC ONLY. Deliberately NOT wired into /api/cron/health: that runs
// on Vercel and a cron hitting OpenF1 is outbound datacenter code that must be
// verified on a preview first (the 0.12.12 NASCAR precedent). Folding this into
// the cron is a preview-gated follow-up.

import { loadSeries } from '../lib/series';
import { groupByWeekend } from '../lib/group';
import { weekendStartEnd } from '../lib/weekend';
import { fetchOpenF1WeekendSessions } from '../lib/results/openf1';
import { diffRoundSchedule } from '../lib/f1-schedule-crosscheck';

const SLUG = 'f1';
const JSON_OUT = process.argv.includes('--json');

interface Item {
  round: number;
  roundName: string;
  session: string;
  kind: string;
  ours: string;
  official: string;
}

const now = new Date();
const series = await loadSeries(SLUG);
const weekends = groupByWeekend(series.sessions, now, series.rounds).filter(w => w.isPast && w.round >= 1);

const items: Item[] = [];
let crossChecked = 0;
let comparedSessions = 0;

for (const w of weekends) {
  const { start, end } = weekendStartEnd(w);
  let official: Awaited<ReturnType<typeof fetchOpenF1WeekendSessions>> = [];
  try {
    official = await fetchOpenF1WeekendSessions(start, end);
  } catch {
    official = [];
  }
  // No OpenF1 coverage for this weekend (very old / not yet published) — can't
  // cross-check; skip rather than false-flag. crossChecked reports the honest count.
  if (official.length === 0) continue;
  crossChecked++;
  comparedSessions += w.sessions.length;
  const diffs = diffRoundSchedule(
    w.sessions.map(s => ({ title: s.title, start: s.start, dateOnly: s.dateOnly })),
    official.map(o => ({ name: o.session_name, dateStart: o.date_start })),
  );
  for (const d of diffs) {
    items.push({ round: w.round, roundName: w.roundName || `Round ${w.round}`, ...d });
  }
}

const summary = {
  checkedAt: now.toISOString(),
  series: SLUG,
  completedRounds: weekends.length,
  crossCheckedRounds: crossChecked,
  comparedSessions,
  discrepancies: items.length,
};

if (JSON_OUT) {
  console.log(JSON.stringify({ ...summary, items }, null, 2));
} else {
  console.log('\n  F1 schedule cross-check vs OpenF1 official times\n');
  console.log(
    `  ${weekends.length} completed rounds · ${crossChecked} cross-checked (OpenF1 coverage) · ${comparedSessions} sessions compared\n`,
  );
  if (items.length === 0) {
    console.log('  🟢 every cross-checked F1 session matches OpenF1 on day and time.');
  } else {
    for (const d of items) {
      console.log(`  🔴 R${d.round} ${d.roundName} · ${d.session} · ${d.kind}: ours ${d.ours} vs official ${d.official}`);
    }
    console.log(`\n  ✗ ${items.length} discrepancy(ies) — a curated F1 session disagrees with OpenF1.`);
  }
}

process.exit(items.length ? 1 : 0);
