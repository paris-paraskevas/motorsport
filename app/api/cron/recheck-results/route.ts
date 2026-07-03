import { NextResponse } from 'next/server';
import { authorizeCronRequest, cronAuthFailureResponse } from '@/lib/cron-auth';
import { loadSeries } from '@/lib/series';
import { loadSnapshotSource } from '@/components/weekend/WeekendStandingsSnapshot';
import { readSnapshot, writeSnapshot } from '@/lib/source-snapshot';
import type { RaceResult } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// REPORT-ONLY late-penalty watchdog (.github/workflows/recheck-results.yml,
// weekly). Post-race classifications are treated as immutable across the app
// (7-day session-class KV, durable last-good snapshots) — but stewards'
// decisions land days later and silently invalidate what we've captured. This
// cron re-reads each supported series' season results feed, compares recently
// completed rounds against the previous run's recorded copy, and REPORTS any
// position / points / winner change:
//   - a structured `[recheck-results]` console.warn per changed race
//     (Vercel logs), and
//   - the run summary persisted under `recheck:results:last-run` in
//     `source_snapshot`, so the run's freshness surfaces automatically in
//     GET /api/cron/health's `sources` list (no health-route change needed)
//     and the payload stays durably inspectable.
// It NEVER mutates the user-serving caches (`paddock:results:*` KV, the
// `f1:*` / `standings:*` snapshots, session-class entries) — fixing a stale
// capture stays a deliberate operator action (results override / cache purge).
//
// Comparison baseline: this cron's own `recheck:results:<slug>` rows in
// `source_snapshot` — recorded on one run, diffed and advanced on the next, so
// each upstream change is reported exactly once. Diffing against the serving
// caches instead would be near-useless: they refresh within hours, so by the
// weekly tick they already equal upstream.
//
// Upstream politeness: one season-feed read per series (the same volume as a
// single Results-tab render, and it reuses the parsers' own KV caches), series
// processed sequentially, capped per run, with a soft wall-clock budget.
// Class-based feeds (WEC / IMSA / GTWC) and the chart-sub-total feeds
// (WRC / DTM) are out of scope for v1 — no flat per-round classification to
// diff; extend deliberately if their late-penalty churn proves to matter.

const SERIES_SLUGS = [
  'f1',
  'f2',
  'f3',
  'formula-e',
  'indycar',
  'motogp',
  'nascar-cup',
  'wsbk',
] as const;

// Rounds completed within this window get rechecked — stewards' documents and
// appeal outcomes land well within 5 weeks of the flag.
const WINDOW_DAYS = 35;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;
// Per-run caps (politeness + keeps the run inside maxDuration).
const MAX_SERIES_PER_RUN = 8;
const MAX_ROUNDS_PER_SERIES = 4;
// Stop starting new series once this much wall-clock has elapsed; the skipped
// ones are reported and picked up next week.
const TIME_BUDGET_MS = 45_000;

const baselineKey = (slug: string): string => `recheck:results:${slug}`;
const LAST_RUN_KEY = 'recheck:results:last-run';

interface BaselineEntry {
  driverName: string;
  position: number;
  points: number;
}

interface BaselineRace {
  round: number;
  raceName: string;
  date: string; // ISO — jsonb round-trips Dates to strings anyway
  entries: BaselineEntry[];
}

interface RecheckBaseline {
  season: number;
  capturedAt: string;
  races: BaselineRace[];
}

interface EntryChange {
  driver: string;
  change: 'moved' | 'added' | 'removed';
  from?: { position: number; points: number };
  to?: { position: number; points: number };
}

interface RaceDiff {
  slug: string;
  round: number;
  raceName: string;
  winnerChanged: boolean;
  winnerBefore?: string;
  winnerAfter?: string;
  changes: EntryChange[];
}

interface SeriesOutcome {
  slug: string;
  status: 'ok' | 'no-source' | 'error' | 'skipped-budget' | 'skipped-cap';
  inWindow: number;
  compared: number;
  primed: number;
  diffs: RaceDiff[];
}

const raceKey = (r: { round: number; raceName: string }): string =>
  `${r.round}::${r.raceName}`;

function toBaselineRace(r: RaceResult): BaselineRace {
  return {
    round: r.round,
    raceName: r.raceName,
    date: r.date.toISOString(),
    entries: r.results.map(e => ({
      driverName: e.driverName,
      position: e.position,
      points: e.points,
    })),
  };
}

function winnerOf(entries: BaselineEntry[]): string | undefined {
  return entries.find(e => e.position === 1)?.driverName;
}

/** Entry-level diff of one race vs its baseline. Null when identical. */
function diffRace(slug: string, current: BaselineRace, baseline: BaselineRace): RaceDiff | null {
  const before = new Map(baseline.entries.map(e => [e.driverName, e]));
  const changes: EntryChange[] = [];

  for (const e of current.entries) {
    const prev = before.get(e.driverName);
    if (!prev) {
      changes.push({
        driver: e.driverName,
        change: 'added',
        to: { position: e.position, points: e.points },
      });
    } else if (prev.position !== e.position || prev.points !== e.points) {
      changes.push({
        driver: e.driverName,
        change: 'moved',
        from: { position: prev.position, points: prev.points },
        to: { position: e.position, points: e.points },
      });
    }
    before.delete(e.driverName);
  }
  for (const gone of before.values()) {
    changes.push({
      driver: gone.driverName,
      change: 'removed',
      from: { position: gone.position, points: gone.points },
    });
  }

  if (changes.length === 0) return null;
  const winnerBefore = winnerOf(baseline.entries);
  const winnerAfter = winnerOf(current.entries);
  return {
    slug,
    round: current.round,
    raceName: current.raceName,
    winnerChanged: winnerBefore !== winnerAfter,
    winnerBefore,
    winnerAfter,
    changes,
  };
}

async function recheckSeries(slug: string, now: Date): Promise<SeriesOutcome> {
  const outcome: SeriesOutcome = {
    slug,
    status: 'ok',
    inWindow: 0,
    compared: 0,
    primed: 0,
    diffs: [],
  };

  const series = await loadSeries(slug);
  const source = await loadSnapshotSource(series);
  if (!source) {
    outcome.status = 'no-source';
    return outcome;
  }

  // Races (+ sprints/extras — late penalties hit those too) completed within
  // the window. Winners-only or empty stubs carry nothing diffable.
  const pool: RaceResult[] = [...source.races, ...(source.extras ?? [])].filter(r => {
    const t = r.date.getTime();
    return (
      Number.isFinite(t) &&
      t <= now.getTime() &&
      now.getTime() - t <= WINDOW_MS &&
      r.results.length > 1
    );
  });
  outcome.inWindow = pool.length;
  if (pool.length === 0) return outcome;

  // Most recent MAX_ROUNDS_PER_SERIES rounds only (a round can carry several
  // races — sprint weekends); the rest stay in the baseline for a later run.
  const roundsByRecency = [...new Set(pool.map(r => r.round))].sort((a, b) => {
    const dateOf = (round: number) =>
      Math.max(...pool.filter(r => r.round === round).map(r => r.date.getTime()));
    return dateOf(b) - dateOf(a);
  });
  const selectedRounds = new Set(roundsByRecency.slice(0, MAX_ROUNDS_PER_SERIES));
  const selected = pool.filter(r => selectedRounds.has(r.round)).map(toBaselineRace);

  const baseline = await readSnapshot<RecheckBaseline>(baselineKey(slug));
  // Season rollover (or first ever run): nothing comparable — prime and move on.
  const comparable =
    baseline && baseline.season === series.meta.season
      ? new Map(baseline.races.map(r => [raceKey(r), r]))
      : new Map<string, BaselineRace>();

  for (const race of selected) {
    const prev = comparable.get(raceKey(race));
    if (!prev) {
      outcome.primed++;
      continue;
    }
    outcome.compared++;
    const diff = diffRace(slug, race, prev);
    if (diff) outcome.diffs.push(diff);
  }

  // Advance the baseline: keep still-in-window races we didn't re-read this
  // run, replace the ones we did, drop everything older than the window. This
  // is the recheck's OWN ledger — not a user-serving cache.
  const merged = new Map<string, BaselineRace>();
  for (const r of comparable.values()) {
    const t = Date.parse(r.date);
    if (Number.isFinite(t) && now.getTime() - t <= WINDOW_MS) merged.set(raceKey(r), r);
  }
  for (const r of selected) merged.set(raceKey(r), r);
  await writeSnapshot<RecheckBaseline>(baselineKey(slug), {
    season: series.meta.season,
    capturedAt: now.toISOString(),
    races: [...merged.values()].sort((a, b) => a.round - b.round),
  });

  return outcome;
}

export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (auth !== 'ok') return cronAuthFailureResponse(auth);

  const startedAt = Date.now();
  const now = new Date();
  const outcomes: SeriesOutcome[] = [];

  try {
    const slugs = SERIES_SLUGS.slice(0, MAX_SERIES_PER_RUN);
    for (const slug of slugs) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        outcomes.push({
          slug, status: 'skipped-budget', inWindow: 0, compared: 0, primed: 0, diffs: [],
        });
        continue;
      }
      try {
        // Sequential on purpose — never fan out across every upstream at once.
        outcomes.push(await recheckSeries(slug, now));
      } catch (err) {
        console.error(`[recheck-results] ${slug} failed:`, err);
        outcomes.push({
          slug, status: 'error', inWindow: 0, compared: 0, primed: 0, diffs: [],
        });
      }
    }

    const allDiffs = outcomes.flatMap(o => o.diffs);
    for (const diff of allDiffs) {
      // Structured warning — greppable in Vercel logs, one line per changed race.
      console.warn(`[recheck-results] upstream change detected: ${JSON.stringify(diff)}`);
    }

    const summary = {
      checkedAt: now.toISOString(),
      differences: allDiffs.length,
      series: outcomes.map(o => ({
        slug: o.slug,
        status: o.status,
        inWindow: o.inWindow,
        compared: o.compared,
        primed: o.primed,
        changedRaces: o.diffs.map(d => ({
          round: d.round,
          raceName: d.raceName,
          winnerChanged: d.winnerChanged,
          changes: d.changes.length,
        })),
      })),
    };
    // Durable, health-visible record of the last run (freshness shows up in
    // /api/cron/health `sources`; payload readable via the snapshot table).
    await writeSnapshot(LAST_RUN_KEY, { ...summary, diffs: allDiffs });

    return NextResponse.json({ ok: true, ...summary, diffs: allDiffs });
  } catch (err) {
    console.error('GET /api/cron/recheck-results failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
