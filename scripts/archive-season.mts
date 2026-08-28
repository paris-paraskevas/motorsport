/**
 * Capture a season's weekends, sessions, results and standings to
 * `data/season-archive/<season>/<slug>.json`.
 *
 * WHY THIS EXISTS, and why it is time-sensitive.
 *
 * `/series/<slug>/weekend/<round>` carries no season. `weekendFor` resolves the
 * round against `series.sessions`, which `loadSeriesFromDir` windows to
 * `meta.season`. So when the 2027 calendar lands, `/series/f1/weekend/15`
 * silently becomes 2027's round 15 and the 2026 page is unreachable — nothing
 * 404s, it just shows a different race.
 *
 * Fixing the URL alone would serve empty pages, because the data does not
 * survive either. Measured 2026-08-28:
 *   - `rounds.json` and `sessions.json` are single-season files.
 *   - Sessions come from a LIVE ICS feed. **The F1 feed carries 2026 only** —
 *     60 entries, no history. MotoGP (2010–), WSBK (2011–) and NASCAR (2010–)
 *     do carry history, but at roughly one entry per ROUND, so the practice /
 *     qualifying / race breakdown is not in them either.
 *   - `fallback.ics` is an 80-byte stub, so there is no snapshot to fall back on.
 *
 * So the schedule is the irreplaceable part and it has a deadline: whatever is
 * not captured before the feeds roll over is gone. Results and standings are
 * lower-risk — Wikipedia keeps per-season pages and several fetchers already
 * take a season argument — but they are captured here too, because a page
 * showing a schedule with no result is not worth serving (operator decision,
 * 2026-08-28: archive schedule + results + standings).
 *
 * WHERE IT WRITES, and why not `content/`.
 * `scripts/bundle-content.mts` walks `content/**` and inlines every text file
 * into the Worker script. The bundle is already 1.74 MB against 687 KiB of
 * remaining headroom, so a season archive under `content/` would be charged to
 * every request. `data/` is outside that walk. It stays readable at BUILD time
 * in Node — the same contract that lets `/changelog` read RELEASES.md — which
 * is exactly right for archive pages, since a finished season never changes and
 * its routes can be `force-static`.
 *
 * Usage: `npx tsx scripts/archive-season.mts [season]`  (default 2026)
 * Read-only against upstreams. Writes nothing but local files.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadSeries, listSeriesSlugs } from '../lib/series';
import { loadCuratedDrivers } from '../lib/series-content';
import { groupByWeekend } from '../lib/group';

// Results fetchers — the same imports lib/results-health.ts and
// scripts/warm-live-data.mts use, rather than re-deriving the dispatch.
import { fetchF1SeasonResults } from '../lib/results/f1';
import { fetchF2SeasonResults } from '../lib/results/f2';
import { fetchF3SeasonResults } from '../lib/results/f3';
import { fetchFormulaESeasonResults } from '../lib/results/formula-e';
import { fetchMotoGPSeasonResults } from '../lib/results/motogp';
import { fetchWsbkSeasonResults } from '../lib/results/wsbk';
import { fetchWRCSeasonResults } from '../lib/results/wrc';
import { fetchIndyCarSeasonResults } from '../lib/results/indycar';
import { fetchDTMSeasonResults } from '../lib/results/dtm';
import { fetchNascarCupSeasonResults } from '../lib/results/nascar-cup';
import { fetchNlsSeasonResults } from '../lib/results/nls';
import { fetchAllGtWorldSeasonRaces } from '../lib/results/gt-world';
import { fetchImsaSeasonResults } from '../lib/results/imsa';
import { fetchWecSeasonResults } from '../lib/results/wec';

// Standings fetchers — mirrors lib/standings-health.ts.
import { fetchF1Standings } from '../lib/standings/f1';
import { fetchF2Standings } from '../lib/standings/f2';
import { fetchF3Standings } from '../lib/standings/f3';
import { fetchFormulaEStandings } from '../lib/standings/formula-e';
import { fetchMotoGPStandings } from '../lib/standings/motogp';
import { fetchWsbkStandings } from '../lib/standings/wsbk';
import { fetchWRCStandings } from '../lib/standings/wrc';
import { fetchIndyCarStandings } from '../lib/standings/indycar';
import { fetchDTMStandings } from '../lib/standings/dtm';
import { fetchNascarCupStandings } from '../lib/standings/nascar-cup';
import { fetchGtWorldStandings } from '../lib/standings/gt-world';
import { fetchImsaStandings } from '../lib/standings/imsa';
import { fetchWecStandings } from '../lib/standings/wec';

const season = Number(process.argv[2] ?? 2026);
const OUT_DIR = path.join(process.cwd(), 'data', 'season-archive', String(season));

type Fetcher = () => Promise<unknown>;
/** DTM and NASCAR need the curated round list, and IndyCar needs the curated
 *  drivers to normalise names — the same arguments the Results tab and
 *  scripts/warm-live-data.mts pass. So results fetchers take the loaded series
 *  rather than being nullary. */
type ResultsFetcher = (series: Awaited<ReturnType<typeof loadSeries>>) => Promise<unknown>;

const RESULTS: Record<string, ResultsFetcher> = {
  f1: () => fetchF1SeasonResults(),
  f2: () => fetchF2SeasonResults(season),
  f3: () => fetchF3SeasonResults(season),
  'formula-e': () => fetchFormulaESeasonResults(),
  motogp: () => fetchMotoGPSeasonResults(season),
  wsbk: () => fetchWsbkSeasonResults(season),
  wrc: () => fetchWRCSeasonResults(season),
  indycar: async () => fetchIndyCarSeasonResults({ drivers: await loadCuratedDrivers('indycar') }),
  nls: () => fetchNlsSeasonResults(season),
  'gt-world': () => fetchAllGtWorldSeasonRaces(season),
  imsa: () => fetchImsaSeasonResults(),
  wec: () => fetchWecSeasonResults(),
  dtm: s => fetchDTMSeasonResults(s.meta.season, s.rounds?.rounds),
  'nascar-cup': s =>
    fetchNascarCupSeasonResults({
      rounds: (s.rounds?.rounds ?? []).map(r => ({
        round: r.round,
        startDate: r.startDate,
        name: r.name,
      })),
    }),
};

const STANDINGS: Record<string, Fetcher> = {
  f1: () => fetchF1Standings(),
  f2: () => fetchF2Standings(),
  f3: () => fetchF3Standings(),
  'formula-e': () => fetchFormulaEStandings(),
  motogp: () => fetchMotoGPStandings(season),
  wsbk: () => fetchWsbkStandings(season),
  wrc: () => fetchWRCStandings(),
  indycar: () => fetchIndyCarStandings(),
  dtm: () => fetchDTMStandings(),
  'nascar-cup': () => fetchNascarCupStandings(),
  'gt-world': () => fetchGtWorldStandings(season),
  imsa: () => fetchImsaStandings(),
  wec: () => fetchWecStandings(),
};

/** Rows in whatever shape a fetcher returned — for the capture report, so a
 *  silently-empty payload is visible rather than recorded as a success. */
function rowsOf(v: unknown): number {
  if (v == null) return 0;
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'object') {
    return Object.values(v as Record<string, unknown>).reduce<number>(
      (n, x) => n + (Array.isArray(x) ? x.length : x && typeof x === 'object' ? 1 : 0),
      0,
    );
  }
  return 0;
}

async function attempt(label: string, fn: (() => Promise<unknown>) | undefined) {
  if (!fn) return { status: 'none' as const, rows: 0, data: null };
  try {
    const data = await fn();
    const rows = rowsOf(data);
    return { status: rows > 0 ? ('ok' as const) : ('empty' as const), rows, data };
  } catch (e) {
    console.error(`  ! ${label}: ${(e as Error).message.slice(0, 90)}`);
    return { status: 'failed' as const, rows: 0, data: null };
  }
}

mkdirSync(OUT_DIR, { recursive: true });

// A fixed instant, so `groupByWeekend`'s past/upcoming split is reproducible
// within one run rather than drifting between the first series and the last.
const capturedAt = new Date();
const slugs = (await listSeriesSlugs()).sort();
const report: string[] = [];

for (const slug of slugs) {
  const series = await loadSeries(slug).catch(() => null);
  if (!series) {
    report.push(`${slug.padEnd(18)} SERIES LOAD FAILED`);
    continue;
  }

  const weekends = groupByWeekend(series.sessions, capturedAt, series.rounds).map(w => ({
    round: w.round,
    // roundName is the canonical name from rounds.json ("Canadian Grand Prix");
    // label is the significance override. Keep both — the archive is the last
    // copy, so it should not choose between them on our behalf.
    roundName: w.roundName ?? null,
    label: w.label ?? null,
    dateRangeLabel: w.dateRangeLabel,
    isPast: w.isPast,
    sessions: w.sessions.map(s => ({
      title: s.title,
      start: s.start instanceof Date ? s.start.toISOString() : s.start,
      end: s.end instanceof Date ? s.end.toISOString() : s.end,
      location: s.location ?? null,
    })),
  }));
  const sessionCount = weekends.reduce((n, w) => n + w.sessions.length, 0);

  const resultsFn = RESULTS[slug];
  const results = await attempt(`${slug} results`, resultsFn ? () => resultsFn(series) : undefined);
  const standings = await attempt(`${slug} standings`, STANDINGS[slug]);

  writeFileSync(
    path.join(OUT_DIR, `${slug}.json`),
    `${JSON.stringify(
      {
        season,
        series: slug,
        seriesName: series.meta.name,
        capturedAt: capturedAt.toISOString(),
        // Honest per-part status: 'ok' | 'empty' | 'failed' | 'none'. A reader
        // of this file must be able to tell a season with no results from a
        // capture that could not reach the source.
        captured: {
          weekends: weekends.length > 0 ? 'ok' : 'empty',
          results: results.status,
          standings: standings.status,
        },
        weekends,
        results: results.data,
        standings: standings.data,
      },
      null,
      1,
    )}\n`,
  );

  report.push(
    `${slug.padEnd(18)} weekends ${String(weekends.length).padStart(3)}  sessions ${String(sessionCount).padStart(4)}` +
      `  results ${results.status.padEnd(7)}${String(results.rows).padStart(5)}` +
      `  standings ${standings.status.padEnd(7)}${String(standings.rows).padStart(4)}`,
  );
}

console.error(`\n  Season ${season} archive -> ${path.relative(process.cwd(), OUT_DIR)}\n`);
for (const line of report) console.error(`  ${line}`);
console.error('');
