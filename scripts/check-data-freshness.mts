/**
 * Is the site's data still arriving?
 *
 *   npx tsx scripts/check-data-freshness.mts
 *   MAX_SNAPSHOT_AGE_HOURS=1 npx tsx scripts/check-data-freshness.mts   # see it fail
 *
 * Exits 1 when the newest `source_snapshot` row is older than the threshold.
 *
 * WHY THIS EXISTS SEPARATELY FROM warm-live-data. The failure alerting added in
 * 0.334.101 watches the WORKFLOW: it opens an issue when a run fails. It cannot
 * see the failure that actually cost five days — a workflow that stops being
 * scheduled at all, or one nobody looks at. A job that never runs raises nothing.
 *
 * So this watches the DATA instead, from its own schedule. It catches every
 * version of "the writer stopped", including the ones the workflow-level alert
 * is blind to, because it asks the only question that matters to a reader: is
 * what the site is serving still fresh?
 *
 * Two independent schedules both dying silently is a far smaller risk than one,
 * and that residual is accepted rather than chased — the alternative is an
 * external monitor, which is a service, an account and a bill.
 */
import { betDb } from '../lib/betting/client';

// Deliberately generous. The workflow DECLARES */20 but GitHub throttles cron on
// shared runners, and the real cadence is ~5 runs a day with observed gaps of 3
// to 11 hours. A tighter threshold would fire on a healthy-but-throttled day,
// and an alert that cries wolf is one people learn to ignore — which is the
// failure this whole line of work exists to prevent. 12 hours sits beyond the
// worst observed gap, so it only speaks when something is genuinely wrong; the
// five-day outage would have been caught inside its first day.
//
// Overridable so the ALARM path can be exercised against real data without
// editing code. A threshold nobody has seen fire is a threshold nobody trusts.
const MAX_AGE_HOURS = Number(process.env.MAX_SNAPSHOT_AGE_HOURS ?? 12);

/**
 * Returns the process exit code. Structured with early returns so each failure
 * genuinely STOPS: a draft of this set `process.exitCode` inline and fell
 * through, which meant an empty table printed its error and then
 * "OK: data is arriving" directly underneath it.
 *
 * `process.exitCode` rather than `process.exit()`, because the Supabase client
 * keeps a handle open and tearing it down mid-flight trips a libuv assertion on
 * Windows and reports 127 instead of 1.
 */
async function check(): Promise<number> {
  const { data, error } = await betDb()
    .from('source_snapshot')
    .select('source_key, fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1);

  // Cannot answer the question, so do not pretend to. Failing on an unreachable
  // database is correct: a monitor that goes quiet when it cannot see is worse
  // than one that says so.
  if (error) {
    console.error(`FAILED: could not read source_snapshot — ${error.message}`);
    return 1;
  }

  const row = data?.[0];
  if (!row?.fetched_at) {
    console.error('FAILED: source_snapshot is EMPTY. The site has no data of its own.');
    return 1;
  }

  const ageMs = Date.now() - Date.parse(String(row.fetched_at));
  const ageHours = ageMs / 3_600_000;
  const pretty = ageHours < 1 ? `${Math.round(ageMs / 60000)} min` : `${ageHours.toFixed(1)} h`;
  console.log(`newest snapshot: ${row.source_key} — ${pretty} old (threshold ${MAX_AGE_HOURS} h)`);

  if (ageHours > MAX_AGE_HOURS) {
    console.error(
      `FAILED: the site's data is ${pretty} old. warm-live-data is the only writer, so it has` +
        ` either stopped running or stopped succeeding. Check:\n` +
        `  gh run list --workflow warm-live-data.yml --limit 5`,
    );
    return 1;
  }

  console.log('OK: data is arriving.');
  return 0;
}

process.exitCode = await check();
