/**
 * Diff every hand-entered session override against the series' own upstream ICS
 * feed, and report where they disagree.
 *
 *   npm run sessions:audit              -- every series with a feed
 *   npm run sessions:audit -- --series f1
 *   npm run sessions:audit -- --strict  -- exit 1 when anything disagrees
 *
 * WHY THIS EXISTS. On the 2026 Monza weekend the site showed Friday practice an
 * hour late and it was caught by a reader. The feed was not the problem: it
 * carried the correct instant, annotated with the track time, and a hand-entered
 * `sessions.json` override had replaced it with the standard European pattern
 * (13:30/17:00) that Monza happens not to follow. Every future round was then
 * checked this way and SIXTEEN more F1 sessions were wrong the same way, across
 * Baku, Singapore, Austin, Sao Paulo, Las Vegas and Lusail. All sixteen were
 * confirmed against the formula1.com race page for that round before being
 * corrected.
 *
 * WHAT IT CANNOT DO. Outside F1 the feeds are date-only, so for most series
 * there is nothing to diff against and the overrides remain the only source.
 * `--strict` is therefore a guard on the series that HAVE a timed feed, not a
 * proof that the schedule is right. And the feed is a third party: where it and
 * the official timetable disagree, the official timetable wins and the override
 * stays. Read a disagreement as "go and check", never as "apply the feed".
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SERIES_ROOT = path.join('content', 'series');
const DAY_MS = 86_400_000;

const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const onlySeries = (() => {
  const i = argv.indexOf('--series');
  return i >= 0 ? argv[i + 1] : null;
})();

interface FeedEvent {
  summary: string;
  startMs: number;
  type: string | null;
}

/** Enough of an ICS reader to compare instants. Unfold continuation lines
 *  first: a folded line begins with a space or a tab. */
function parseIcs(text: string): FeedEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const out: FeedEvent[] = [];
  let summary = '';
  let startMs = Number.NaN;
  let inEvent = false;

  for (const line of unfolded.split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      summary = '';
      startMs = Number.NaN;
      continue;
    }
    if (line === 'END:VEVENT') {
      if (inEvent && !Number.isNaN(startMs)) out.push({ summary, startMs, type: sessionType(summary) });
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(';')[0].toUpperCase();
    const value = line.slice(colon + 1);
    if (name === 'SUMMARY') summary = value;
    else if (name === 'DTSTART') {
      // Only UTC instants are comparable. A date-only or floating DTSTART is
      // skipped rather than guessed at.
      const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
      if (m) startMs = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
    }
  }
  return out;
}

/**
 * Canonical session type, matched MOST SPECIFIC FIRST and normalising the two
 * vocabularies onto one.
 *
 * We say "Sprint Qualifying" and "Sprint"; the F1 feed says "Sprint
 * Qualification" and "Sprint Race". A naive substring match therefore paired our
 * Sprint with the feed's Sprint QUALIFICATION and reported every sprint weekend
 * as ~20 hours wrong. Both of those were false alarms, and a guard that cries
 * wolf on two rounds is a guard nobody reads.
 */
const SESSION_TYPES: [RegExp, string][] = [
  [/sprint\s*(qualifying|qualification|shootout)/, 'sprint-qualifying'],
  [/sprint/, 'sprint'], // covers the feed's "Sprint Race" and our bare "Sprint"
  [/(free\s*)?practice\s*1\b/, 'practice-1'],
  [/(free\s*)?practice\s*2\b/, 'practice-2'],
  [/(free\s*)?practice\s*3\b/, 'practice-3'],
  [/feature\s*race\s*1\b/, 'feature-1'],
  [/feature\s*race\s*2\b/, 'feature-2'],
  [/feature\s*race/, 'feature'],
  [/qualifying\s*(group\s*)?a\b|qualifying\s*1\b/, 'qualifying-1'],
  [/qualifying\s*(group\s*)?b\b|qualifying\s*2\b/, 'qualifying-2'],
  [/qualif(ying|ication)/, 'qualifying'],
  [/practice/, 'practice'],
  [/race/, 'race'],
];
function sessionType(title: string): string | null {
  const t = (title || '').toLowerCase();
  for (const [re, canonical] of SESSION_TYPES) if (re.test(t)) return canonical;
  return null;
}

interface Row {
  series: string;
  round?: number;
  title: string;
  ours: string;
  feed?: string;
  offMin?: number;
}

async function feedText(slug: string, dir: string, icsUrl: string): Promise<string | null> {
  if (icsUrl.trim()) {
    try {
      const res = await fetch(icsUrl, { headers: { 'User-Agent': 'paddock-sessions-audit' } });
      if (res.ok) return await res.text();
      console.error(`  ! ${slug}: feed HTTP ${res.status}, using fallback.ics`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ! ${slug}: feed fetch failed (${msg}), using fallback.ics`);
    }
  }
  const fallback = path.join(dir, 'fallback.ics');
  return existsSync(fallback) ? readFileSync(fallback, 'utf8') : null;
}

async function main(): Promise<number> {
  const slugs = readdirSync(SERIES_ROOT)
    .filter((s) => existsSync(path.join(SERIES_ROOT, s, 'sessions.json')))
    .filter((s) => !onlySeries || s === onlySeries);

  if (slugs.length === 0) {
    console.error(`no series matched${onlySeries ? ` --series ${onlySeries}` : ''}`);
    return 1;
  }

  const differ: Row[] = [];
  let agree = 0;
  let unmatched = 0;

  for (const slug of slugs) {
    const dir = path.join(SERIES_ROOT, slug);
    const meta = JSON.parse(readFileSync(path.join(dir, 'meta.json'), 'utf8')) as { icsUrl?: string };
    const text = await feedText(slug, dir, meta.icsUrl ?? '');
    if (!text) {
      console.error(`  ! ${slug}: no feed and no fallback.ics, skipped`);
      continue;
    }
    const events = parseIcs(text);
    const { overrides = [] } = JSON.parse(readFileSync(path.join(dir, 'sessions.json'), 'utf8')) as {
      overrides?: { round?: number; sessions?: { title: string; start: string }[] }[];
    };

    for (const block of overrides) {
      for (const s of block.sessions ?? []) {
        const oursMs = Date.parse(s.start);
        if (Number.isNaN(oursMs)) continue;
        const type = sessionType(s.title);
        // Same session type within two days is unambiguous inside one weekend.
        const near = events.filter((e) => e.type === type && Math.abs(e.startMs - oursMs) < 2 * DAY_MS);
        if (near.length !== 1) {
          // Either the feed has dropped a past event, or it is date-only, or the
          // session is one we carry and it does not. Not a finding.
          unmatched++;
          continue;
        }
        const offMin = Math.round((oursMs - near[0].startMs) / 60_000);
        if (offMin === 0) {
          agree++;
          continue;
        }
        differ.push({
          series: slug,
          round: block.round,
          title: s.title,
          ours: s.start,
          feed: new Date(near[0].startMs).toISOString().replace('.000', ''),
          offMin,
        });
      }
    }
  }

  console.log(`\nagree ${agree} · disagree ${differ.length} · no comparable feed event ${unmatched}`);

  if (differ.length === 0) {
    console.log('every override with a comparable feed event matches it');
    return 0;
  }

  const bySeries = new Map<string, Row[]>();
  for (const r of differ) {
    const list = bySeries.get(r.series) ?? [];
    list.push(r);
    bySeries.set(r.series, list);
  }
  for (const [slug, list] of bySeries) {
    console.log(`\n${slug} — ${list.length} disagree with the feed:`);
    for (const r of list) {
      console.log(
        `  R${String(r.round ?? '?').padStart(2)} ${r.title.padEnd(24)} ours ${r.ours}  feed ${r.feed}  off ${String(r.offMin).padStart(5)}min`,
      );
    }
  }
  console.log('\nCheck each against the official timetable before changing anything.');
  console.log('The feed is a third party; where they disagree, the official timetable wins.');

  return STRICT ? 1 : 0;
}

process.exitCode = await main();
