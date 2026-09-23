import 'server-only';
import path from 'path';
import { cache } from 'react';
import { HOME_RESULTS_SERIES, HOME_SERIES_OPTION, LATEST_RESULT_OPTION, SERIES_OPTIONS, findSource, sourceLabel, type SourceColumn, type SourceFresh, type SourceParams, type SourceRef } from './sources';
import type { SnapshotMeta } from '@/lib/source-snapshot';
import type { RaceResult, RaceResultEntry, Series } from '@/lib/types';

// The reader behind the catalogue (the components programme, P2.1): one
// readSource for the fourteen, each through the loader the code already has,
// answering rows shaped by the source's columns and a provenance the Debug
// trace prints (the tier, the loader keys, the run or the snapshot's meta).
//
// THE RULE THIS FILE ENFORCES: a read never throws. A reader that fails
// answers no rows and the reason in words; an unwarmed slot answers no rows
// and no reason. The standings source reads the rows tier (standing_current,
// with its run) first and the snapshot tier after, drivers only.
//
// THE IMPORTS ARE DYNAMIC ON PURPOSE, as component-render's are: this module
// is reached from the renderers, which every route's chunk carries; a reader's
// graph loads only when a region actually names its source.
//
// THE LATEST RESULT (P2.24 B2): the Results source's Series "Home's series"
// and the Standings source's "Latest result" are resolved here, not read: the
// newest finished race across the series Home ranks (Home's own rule,
// lib/home-model.ts), once per request, so the Podium and the Leader templates
// are functions of their rows and the flip (PR C) serves Home's HTML.

export type SourceRow = Record<string, string | number | boolean | null>;
export type SourceTier = 'rows' | 'snapshot' | 'content' | 'db' | 'live';

export interface SourceRun {
  id: string;
  status: string;
  finished: string | null;
  rows: number;
  runner: string | null;
}

export interface SourceProvenance {
  ref: SourceRef;
  label: string;
  tier: SourceTier;
  /** The loader keys behind the pick (source_run and source_snapshot). */
  keys: string[];
  /** Rows the reader answered before any limit. */
  rows: number;
  ms: number;
  /** The rows tier's run, when the rows came from it; null when the tier was read and had none to name. */
  run?: SourceRun | null;
  /** The snapshot tier's meta for the first key the loader wrote (F fetch, W write). */
  meta?: SnapshotMeta | null;
  /** Why there are no rows, when a reader failed. */
  error?: string;
}

export interface SourceRead {
  columns: readonly SourceColumn[];
  rows: SourceRow[];
  /** Rows before the limit. */
  total: number;
  provenance: SourceProvenance;
}

/** A reader's answer; `keys` when the loader keys that mattered are known only once read (the Latest result's resolved series). */
type Answer = { rows: SourceRow[]; tier: SourceTier; run?: SourceRun | null; meta?: SnapshotMeta | null; keys?: string[] };
type Reader = (params: SourceParams, keys: string[]) => Promise<Answer>;

const TIER_OF_FRESH: Readonly<Record<SourceFresh, SourceTier>> = { loader: 'snapshot', content: 'content', db: 'db', live: 'live' };

const iso = (d: unknown): string | null => (d instanceof Date ? (Number.isNaN(d.getTime()) ? null : d.toISOString()) : typeof d === 'string' && d ? d : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const seriesDir = (slug: string) => path.join(process.cwd(), 'content', 'series', slug);
const hostOf = (link: string): string | null => {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

/** The snapshot tier's meta for the first key the loader wrote; null when none. */
async function metaFor(keys: string[]): Promise<SnapshotMeta | null> {
  if (keys.length === 0) return null;
  const { readSnapshotMeta } = await import('@/lib/source-snapshot');
  const all = await readSnapshotMeta();
  for (const k of keys) if (all[k]) return all[k];
  return null;
}

/** The rows tier's run by id: what wrote the rows, when, how many. Null without an id or a row. */
async function readRun(runId: string | null): Promise<SourceRun | null> {
  if (!runId) return null;
  const { betDb, isBettingConfigured } = await import('@/lib/betting/client');
  if (!isBettingConfigured()) return null;
  const { data, error } = await betDb().from('source_run').select('id, status, finished_at, rows_written, runner').eq('id', runId).limit(1);
  const row = !error && Array.isArray(data) ? (data as Record<string, unknown>[])[0] : undefined;
  if (!row) return null;
  return { id: String(row.id), status: String(row.status), finished: row.finished_at == null ? null : String(row.finished_at), rows: Number(row.rows_written) || 0, runner: row.runner == null ? null : String(row.runner) };
}

const driverRow = (d: { position: number; driverName: string; driverCode?: string; team?: string; points: number; wins?: number }, cls: string | null, kind: 'driver' | 'co-driver' = 'driver'): SourceRow => ({
  kind,
  position: d.position,
  name: d.driverName,
  code: d.driverCode ?? null,
  team: d.team || null,
  points: d.points,
  wins: d.wins ?? null,
  class: cls,
});
const teamRow = (kind: 'team' | 'manufacturer' | 'constructor', position: number, name: string, points: number, wins: number | undefined, cls: string | null): SourceRow => ({ kind, position, name, code: null, team: null, points, wins: wins ?? null, class: cls });

/** WRC's tables beyond the drivers': the co-drivers and the manufacturers, which
 *  the rows tier never held, from the snapshot the tab reads (`standings:wrc`,
 *  warmed by the loader); the drivers' rows too, for a read with no rows tier. */
async function wrcSnapshotRows(): Promise<{ drivers: SourceRow[]; extra: SourceRow[] }> {
  const { fetchWRCStandings } = await import('@/lib/standings/wrc');
  const s = await fetchWRCStandings();
  if (!s) return { drivers: [], extra: [] };
  return {
    drivers: s.drivers.map(d => driverRow(d, null)),
    extra: [
      ...s.coDrivers.map(c => ({ kind: 'co-driver', position: c.position, name: c.coDriverName, code: null, team: c.team || null, points: c.points, wins: null, class: null }) as SourceRow),
      ...s.manufacturers.map(m => teamRow('manufacturer', m.position, m.name, m.points, m.wins, null)),
    ],
  };
}

/** The standings of a class family, which the rows tier cannot hold: GT World's
 *  three cups, IMSA's and WEC's classes, one row per class and kind in the order
 *  the tabs draw them, from the snapshot each fetcher keeps (the loader warms
 *  every key). Null for every other series, which read the rows tier; an empty
 *  snapshot is no rows. */
async function familyStandings(series: string, season: number): Promise<SourceRow[] | null> {
  if (series === 'gt-world') {
    const { fetchGtWorldStandings } = await import('@/lib/standings/gt-world');
    const s = await fetchGtWorldStandings(season);
    if (!s) return [];
    const cups = [
      ['Overall', s.overall],
      ['Sprint Cup', s.sprint],
      ['Endurance Cup', s.endurance],
    ] as const;
    return cups.flatMap(([cls, sec]) => [...sec.drivers.map(d => driverRow(d, cls)), ...sec.teams.map(t => teamRow('team', t.position, t.name, t.points, t.wins, cls))]);
  }
  if (series === 'imsa') {
    const { fetchImsaStandings, IMSA_CLASSES } = await import('@/lib/standings/imsa');
    const s = await fetchImsaStandings();
    if (!s) return [];
    return IMSA_CLASSES.flatMap(cls => [
      ...(s.drivers[cls] ?? []).map(d => driverRow({ position: d.position, driverName: d.driverName, points: d.points }, cls)),
      ...(s.teams[cls] ?? []).map(t => teamRow('team', t.position, t.team, t.points, undefined, cls)),
      ...(s.manufacturers[cls] ?? []).map(m => teamRow('manufacturer', m.position, m.manufacturer, m.points, undefined, cls)),
    ]);
  }
  if (series === 'wec') {
    const { fetchWecStandings, WEC_CLASSES } = await import('@/lib/standings/wec');
    const s = await fetchWecStandings();
    if (!s) return [];
    return WEC_CLASSES.flatMap(cls => [
      ...(s.drivers[cls] ?? []).map(d => driverRow(d, cls)),
      ...(s.teams[cls] ?? []).map(t => teamRow('team', t.position, t.team, t.points, undefined, cls)),
      ...(s.manufacturers[cls] ?? []).map(m => teamRow('manufacturer', m.position, m.manufacturer, m.points, undefined, cls)),
    ]);
  }
  return null;
}

type WeekendOf = (round: number | null) => string | null;
type CarEntry = { position: number; carNumber: string; team: string; drivers: string; vehicle: string; manufacturer: string; laps: number; status: string; gap: string };

/** A flat series' classified entry as a results row (RaceResult, lib/types.ts): the session the dispatch's arrays name. */
const raceRow = (r: RaceResult, e: RaceResultEntry, session: string, weekend: WeekendOf): SourceRow => ({
  round: r.round,
  race: r.raceName,
  raceId: null,
  date: iso(r.date),
  circuit: str(r.circuit),
  class: null,
  session,
  position: e.position,
  driver: e.driverName,
  code: e.driverCode ?? null,
  car: null,
  team: str(e.team),
  vehicle: null,
  manufacturer: null,
  laps: null,
  status: str(e.status),
  time: e.time ?? null,
  gap: null,
  points: e.points,
  weekend: weekend(r.round),
});
/** A sportscar entry (IMSA's and WEC's timing exports carry no points): the car, its crew, its vehicle and the gap. */
const carRow = (round: number, race: string, date: string | null, circuit: string | null, cls: string, e: CarEntry, gap: string, weekend: WeekendOf): SourceRow => ({
  round,
  race,
  raceId: null,
  date,
  circuit,
  class: cls,
  session: 'race',
  position: e.position,
  driver: e.drivers || null,
  code: null,
  car: e.carNumber,
  team: e.team,
  vehicle: e.vehicle || null,
  manufacturer: e.manufacturer || null,
  laps: e.laps,
  status: str(e.status),
  time: null,
  gap: gap || null,
  points: null,
  weekend: weekend(round),
});
/** GT World's cups in the order the tab draws them (ResultsTab.tsx GT_WORLD_CUP_ORDER), and the label it gives each (its gtWorldCupLabel, not exported). */
const GT_WORLD_CUPS = ['pro', 'gold', 'silver', 'bronze'] as const;
const cupLabel = (cup: string) => (cup === 'pro' ? 'Pro Cup' : cup === 'gold' ? 'Gold Cup' : cup === 'silver' ? 'Silver Cup' : cup === 'bronze' ? 'Bronze Cup' : 'Unclassified');

/** What one series' results read is given: the season, the series (its rounds, its snapshot) and the weekend-page rule. */
type ResultsAsk = { season: number; series: Series; weekend: WeekendOf };
type ResultsReader = (ask: ResultsAsk) => Promise<SourceRow[]>;
/** A flat series' races as rows, the session named for every entry. */
const flatRows = (races: readonly RaceResult[], session: string, weekend: WeekendOf): SourceRow[] => races.flatMap(r => r.results.map(e => raceRow(r, e, session, weekend)));

/** The results reader of one series, its graph loaded (P2.2 B1). Eight series come through the weekend snapshot's dispatch,
 *  whose arrays name the session: `extras` are sprints (F1's, F2's), F2's races are its feature races, and every other race
 *  is "race", MotoGP's and WSBK's sprint and Superpole races included, as the tab lists them under Season results (a
 *  compromise: the column is exact for F1 and F2 and "race" for the other series' sessions). WRC and DTM read the real
 *  fetchers the tab uses: the dispatch answers those two from the chart-points fetchers, whose rows are synthetic. NLS answers
 *  one winner per round; IMSA and WEC one row per round, class and entry (the WEC class leader's empty gap is its race time,
 *  the tab's rule); GT World one per race, cup and entry. Every snapshot is one the loader warms.
 *
 *  Loading the graph and reading are two steps on purpose: a fan-out across series (the Latest result, P2.24 B2) loads each
 *  graph in turn and reads together. Concurrent dynamic imports of one module are several loads of it, and the test runner's
 *  mock registry hands the real module to every import but the first while the first is in flight. */
async function resultsReader(slug: string): Promise<ResultsReader> {
  if (slug === 'wrc') {
    const { fetchWRCSeasonResults } = await import('@/lib/results/wrc');
    return async ({ season, weekend }) => flatRows(await fetchWRCSeasonResults(season), 'race', weekend);
  }
  if (slug === 'dtm') {
    const { fetchDTMSeasonResults } = await import('@/lib/results/dtm');
    return async ({ season, series, weekend }) => flatRows(await fetchDTMSeasonResults(season, series.rounds?.rounds), 'race', weekend);
  }
  if (slug === 'nls') {
    const { fetchNlsSeasonResults } = await import('@/lib/results/nls');
    return async ({ season, weekend }) => flatRows(await fetchNlsSeasonResults(season), 'race', weekend);
  }
  if (slug === 'imsa') {
    const [{ fetchImsaSeasonResults }, { IMSA_CLASSES }] = await Promise.all([import('@/lib/results/imsa'), import('@/lib/standings/imsa')]);
    return async ({ weekend }) => (await fetchImsaSeasonResults()).flatMap(r => IMSA_CLASSES.flatMap(cls => (r.perClass[cls] ?? []).map(e => carRow(r.round, r.eventName, iso(r.date), str(r.circuit), cls, e, e.gap, weekend))));
  }
  if (slug === 'wec') {
    const { fetchWecSeasonResults, WEC_RESULT_CLASSES } = await import('@/lib/results/wec');
    return async ({ weekend }) => (await fetchWecSeasonResults()).flatMap(r => WEC_RESULT_CLASSES.flatMap(cls => (r.perClass[cls] ?? []).map(e => carRow(r.round, r.eventName, iso(r.dateEnd), null, cls, e, e.position === 1 && !e.gap ? e.elapsedTime : e.gap, weekend))));
  }
  if (slug === 'gt-world') {
    const { fetchAllGtWorldSeasonRaces } = await import('@/lib/results/gt-world');
    return async ({ season, weekend }) =>
      (await fetchAllGtWorldSeasonRaces(season)).flatMap(race =>
        GT_WORLD_CUPS.flatMap(cup =>
          race.entries
            .filter(e => e.cup === cup)
            .map(
              (e): SourceRow => ({
                round: race.round ?? null,
                race: `${race.eventName} ${race.raceName}`,
                raceId: race.raceId,
                date: null,
                circuit: null,
                class: cupLabel(cup),
                session: 'race',
                position: e.position,
                driver: e.drivers.join(' · '),
                code: null,
                car: e.carNumber,
                team: e.team,
                vehicle: e.car || null,
                manufacturer: null,
                laps: e.laps ?? null,
                status: null,
                time: e.time ?? null,
                gap: e.gap || e.time || null,
                points: null,
                weekend: weekend(race.round ?? null),
              }),
            ),
        ),
      );
  }
  const { loadSnapshotSource } = await import('@/components/weekend/WeekendStandingsSnapshot');
  return async ({ series, weekend }) => {
    const snapshot = await loadSnapshotSource(series);
    return [...flatRows(snapshot?.races ?? [], slug === 'f2' ? 'feature' : 'race', weekend), ...flatRows(snapshot?.extras ?? [], 'sprint', weekend)];
  };
}

type SeriesModule = typeof import('@/lib/series');
type GroupModule = typeof import('@/lib/group');
type BriefModule = typeof import('@/lib/standings/brief');
/** The graph one series' results read needs, loaded before the read: the series loader and the weekend grouping (the link
 *  column, the season's end), the drivers' standings (the champion when the season is complete), the series' own reader. */
type ResultsGraph = { loadSeries: SeriesModule['loadSeries']; groupByWeekend: GroupModule['groupByWeekend']; leader: BriefModule['fetchFullDriverStandings']; read: ResultsReader };
async function resultsGraph(slug: string): Promise<ResultsGraph> {
  const [{ loadSeries }, { groupByWeekend }, { fetchFullDriverStandings }, read] = await Promise.all([import('@/lib/series'), import('@/lib/group'), import('@/lib/standings/brief'), resultsReader(slug)]);
  return { loadSeries, groupByWeekend, leader: fetchFullDriverStandings, read };
}

/** The series' facts every Results row carries (P2.24 B2), Home's own rules (lib/home-model.ts, the What it changed step): its
 *  name and colour; `final` when the season has no weekend still to run (never for a single event); `champion`, when final,
 *  the drivers' standings' leader through the brief's dispatch, which answers null for a series without a drivers' championship. */
async function seriesFacts(graph: ResultsGraph, series: Series, weekends: readonly { isPast: boolean; sessions: readonly { end: Date }[] }[], season: number, now: Date): Promise<{ seriesName: string; colour: string; final: boolean; champion: string | null }> {
  const final = !series.meta.singleEvent && weekends.length > 0 && !weekends.some(w => !w.isPast && w.sessions.some(x => x.end >= now));
  const champion = final ? ((await graph.leader(series.meta.slug, season))?.[0]?.driverName ?? null) : null;
  return { seriesName: series.meta.name, colour: series.meta.color, final, champion };
}

/** One championship's results rows through its loaded graph, the series' facts on each: the Results reader's whole answer for a series. */
async function seriesResults(graph: ResultsGraph, slug: string, season: number): Promise<{ series: Series; rows: SourceRow[] }> {
  const series = await graph.loadSeries(slug);
  const now = new Date();
  // The round's weekend page, where the sessions group one for that round (the Results tab's rule); a link column, never a typed address.
  const weekends = graph.groupByWeekend(series.sessions, now, series.rounds);
  const rounds = new Set(weekends.map(w => w.round));
  const weekend = (round: number | null) => (round !== null && rounds.has(round) ? `/series/${slug}/weekend/${round}` : null);
  const facts = await seriesFacts(graph, series, weekends, season, now);
  const rows = (await graph.read({ season, series, weekend })).map(r => ({ ...r, ...facts }));
  return { series, rows };
}

/** Home's name for a podium entry (lib/home-results.ts): a sportscar entry (a car number) by its team, a flat one by its driver. */
const podiumName = (r: SourceRow): string | null => (str(r.car) ? str(r.team) ?? str(r.driver) ?? `Car #${String(r.car)}` : str(r.driver));

/** The newest finished race across `slugs`, Home's rule for its Latest result (lib/home-model.ts, the result step, with
 *  lib/home-results.ts): each series read as the Results source reads it, then Home's shape of it (a flat series' race
 *  sessions, never a sprint; WEC's Hypercar class), the rows dated and not after now; a series' newest race is the rows of its
 *  latest date (a race keyed by its round and name within the series, a tie keeping the first in row order); across series the
 *  latest date wins and a tie the earlier series in the order given (Home's stable sort). A series whose read throws is skipped,
 *  as Home's per-series lookup fails soft. Exported for the tests. */
export async function latestRaceAcross(slugs: readonly string[], season: number): Promise<{ slug: string; rows: SourceRow[]; winner: string | null } | null> {
  const now = Date.now();
  const at = (r: SourceRow) => (typeof r.date === 'string' ? Date.parse(r.date) : Number.NaN);
  // The graphs in turn (resultsReader's rule), then the reads together; a series whose graph fails to load is skipped like one whose read throws.
  const graphs: (ResultsGraph | null)[] = [];
  for (const slug of slugs) graphs.push(await resultsGraph(slug).catch(() => null));
  const hits = await Promise.all(
    slugs.map(async (slug, i) => {
      try {
        const graph = graphs[i];
        if (!graph) return null;
        const { rows } = await seriesResults(graph, slug, season);
        const shape = slug === 'wec' ? (r: SourceRow) => r.class === 'Hypercar' : (r: SourceRow) => r.session === 'race';
        const finished = rows.filter(r => shape(r) && Number.isFinite(at(r)) && at(r) <= now);
        const first = finished.reduce<SourceRow | null>((m, r) => (m === null || at(r) > at(m) ? r : m), null);
        if (!first) return null;
        const key = (r: SourceRow) => `${r.round ?? ''}|${r.race ?? ''}`;
        return { slug, date: at(first), rows: finished.filter(r => key(r) === key(first)) };
      } catch {
        return null;
      }
    }),
  );
  const best = hits.reduce<(typeof hits)[number]>((m, h) => (h && (!m || h.date > m.date) ? h : m), null);
  if (!best) return null;
  const p1 = best.rows.find(r => r.position === 1);
  return { slug: best.slug, rows: best.rows, winner: p1 ? podiumName(p1) : null };
}
/** Once per request (React's cache, as raceWeekendNow): the Podium and the Leader on one page share the resolution. */
const latestHomeRace = cache((season: number) => latestRaceAcross(HOME_RESULTS_SERIES, season));

/** One championship's standings: the rows tier with its run first, the snapshot tier after (the class families and WRC's extra
 *  tables from the snapshots the tabs read). */
async function standingsRows(series: string, season: number, keys: string[]): Promise<Answer> {
  // The class families (P2.2: GT World's cups, IMSA's and WEC's classes) read the snapshot the tabs read: the rows tier holds no class.
  const family = await familyStandings(series, season);
  if (family) return { tier: 'snapshot', rows: family, run: null, meta: await metaFor(keys) };
  const { readCurrentStandingsWithRun } = await import('@/lib/standing-rows');
  const current = await readCurrentStandingsWithRun(series, season);
  // WRC's co-drivers and manufacturers (P2.2) are not in the rows tier (lib/standing-rows.ts maps drivers alone): they join
  // from the snapshot the tab reads, beside the drivers' rows and their run; without the rows tier the snapshot answers whole.
  const wrc = series === 'wrc' ? await wrcSnapshotRows() : null;
  if (current) {
    const rows: SourceRow[] = [
      ...current.standings.drivers.map(d => driverRow(d, null)),
      ...current.standings.constructors.map(c => teamRow('constructor', c.position, c.name, c.points, c.wins, null)),
      ...(wrc?.extra ?? []),
    ];
    return { tier: 'rows', rows, run: await readRun(current.runId), ...(wrc ? { meta: await metaFor(keys) } : {}) };
  }
  if (wrc) return { tier: 'snapshot', rows: [...wrc.drivers, ...wrc.extra], run: null, meta: await metaFor(keys) };
  const { fetchFullDriverStandings } = await import('@/lib/standings/brief');
  const drivers = await fetchFullDriverStandings(series, season);
  return { tier: 'snapshot', rows: (drivers ?? []).map(d => driverRow(d, null)), run: null, meta: await metaFor(keys) };
}

const READERS: Readonly<Record<string, Reader>> = {
  async series() {
    const { loadAllSeriesMeta } = await import('@/lib/series');
    const all = await loadAllSeriesMeta();
    return { tier: 'content', rows: all.map(m => ({ slug: m.slug, name: m.name, category: m.category, colour: m.color, season: m.season, configured: m.icsUrl.trim() !== '' })) };
  },
  async season(params) {
    const [{ loadAllSeriesMeta }, { loadRounds }] = await Promise.all([import('@/lib/series'), import('@/lib/rounds-loader')]);
    const all = (await loadAllSeriesMeta()).filter(m => !params.series || m.slug === params.series);
    const today = new Date().toISOString().slice(0, 10);
    const rows = await Promise.all(
      all.map(async m => {
        const file = await loadRounds(seriesDir(m.slug));
        const rounds = file?.rounds ?? [];
        const starts = rounds.map(r => r.startDate).sort();
        const ends = rounds.map(r => r.endDate).sort();
        const first = starts[0] ?? null;
        const last = ends[ends.length - 1] ?? null;
        return { series: m.slug, season: m.season, rounds: rounds.length, first, last, underWay: first !== null && last !== null && today >= first && today <= last };
      }),
    );
    return { tier: 'content', rows };
  },
  async standings(params, keys) {
    const series = String(params.series);
    const season = Number(params.season);
    // The Latest result (P2.24 B2): the championship of the newest race across Home's series through the same path, every row
    // with the series' name and colour, the race winner's flag on the winner's driver row and the season's end; nothing for a
    // series without a drivers' championship (Home draws no What it changed for it) or when no race has finished.
    if (series === LATEST_RESULT_OPTION.key) {
      const hit = await latestHomeRace(season);
      const { isEligibleStandingsSeries } = await import('@/lib/standings/brief');
      if (!hit || !isEligibleStandingsSeries(hit.slug)) return { tier: 'snapshot', rows: [], run: null, meta: null };
      const own = findSource('standings')?.loaderKeys?.({ series: hit.slug, season }) ?? [];
      const out = await standingsRows(hit.slug, season, own);
      const facts = hit.rows[0];
      return { ...out, keys: own, rows: out.rows.map(r => ({ ...r, seriesName: facts.seriesName ?? null, colour: facts.colour ?? null, winner: r.kind === 'driver' && hit.winner !== null && r.name === hit.winner, final: facts.final ?? null })) };
    }
    // One championship: its name and colour from the content; no race context, so no winner and no season's end.
    const [out, metas] = await Promise.all([standingsRows(series, season, keys), import('@/lib/series').then(m => m.loadAllSeriesMeta())]);
    const m = metas.find(x => x.slug === series);
    return { ...out, rows: out.rows.map(r => ({ ...r, seriesName: m?.name ?? null, colour: m?.color ?? null, winner: null, final: null })) };
  },
  async results(params, keys) {
    // The season parameter offers the one the loader warms, which is the one the fetchers read; when the archive brings earlier seasons, they take it.
    const slug = String(params.series);
    const season = Number(params.season);
    // Home's series (P2.24 B2): the newest finished race across the series Home ranks, that race's rows alone, the provenance the
    // resolved series' keys; nothing when no series has a finished race.
    if (slug === HOME_SERIES_OPTION.key) {
      const hit = await latestHomeRace(season);
      if (!hit) return { tier: 'snapshot', rows: [], run: null, meta: null };
      const own = findSource('results')?.loaderKeys?.({ series: hit.slug, season }) ?? [];
      return { tier: 'snapshot', rows: hit.rows, run: null, meta: await metaFor(own), keys: own };
    }
    const { rows } = await seriesResults(await resultsGraph(slug), slug, season);
    return { tier: 'snapshot', rows, run: null, meta: await metaFor(keys) };
  },
  async rounds(params) {
    const { loadRounds } = await import('@/lib/rounds-loader');
    const file = await loadRounds(seriesDir(String(params.series)));
    const rows: SourceRow[] = [
      ...(file?.rounds ?? []).map(r => ({ round: r.round, name: r.name, start: r.startDate, end: r.endDate, location: r.venue ?? r.countryCode ?? null, status: r.cancelled ? 'cancelled' : r.previousStartDate ? 'rescheduled' : 'scheduled' })),
      ...(file?.cancelledRounds ?? []).map(c => ({ round: c.originalRound, name: c.name, start: c.originalStartDate, end: c.originalEndDate, location: null, status: 'cancelled' })),
    ];
    return { tier: 'content', rows };
  },
  async sessions(params) {
    const { loadSeries } = await import('@/lib/series');
    const series = await loadSeries(String(params.series));
    return {
      tier: 'live',
      rows: series.sessions.map(s => ({ uid: s.uid, title: s.title, start: iso(s.start), end: iso(s.end), location: s.location ?? null, dateOnly: s.dateOnly === true, significance: s.significance?.note ?? null })),
    };
  },
  async weekends(params) {
    const [{ loadAllSeries, loadSeries }, { groupByWeekend }, { weekendLabel, weekendStartEnd }] = await Promise.all([import('@/lib/series'), import('@/lib/group'), import('@/lib/weekend')]);
    const slug = params.series ? String(params.series) : null;
    const all = slug ? [await loadSeries(slug)] : await loadAllSeries();
    const count = num(params.count) ?? 10;
    const now = new Date();
    // Home's What's next (lib/home-model.ts, P2.24 B1): every series' weekends not past with a session still to end, the
    // nearest first session first; a series whose grouping throws yields none, as Home's does.
    const coming = all.flatMap(s => {
      try {
        return groupByWeekend(s.sessions, now, s.rounds)
          .filter(w => !w.isPast && w.sessions.some(x => x.end >= now))
          .map(w => ({ s, w, ...weekendStartEnd(w) }));
      } catch {
        return [];
      }
    });
    const rows: SourceRow[] = coming
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, count)
      .map(({ s, w, start, end }) => ({ series: s.meta.slug, seriesName: s.meta.name, colour: s.meta.color, round: w.round, title: weekendLabel(w, w.round).title, start: iso(start), end: iso(end), dates: w.dateRangeLabel, weekend: `/series/${s.meta.slug}/weekend/${w.round}` }));
    return { tier: 'live', rows };
  },
  async drivers(params) {
    const { loadCuratedDrivers } = await import('@/lib/series-content');
    const file = await loadCuratedDrivers(String(params.series));
    return { tier: 'content', rows: (file?.teams ?? []).flatMap(t => t.drivers.map(d => ({ name: d.name, code: d.code ?? null, number: d.number ?? null, team: t.name, colour: t.color ?? null }))) };
  },
  async teams(params) {
    const { loadCuratedDrivers } = await import('@/lib/series-content');
    const file = await loadCuratedDrivers(String(params.series));
    return { tier: 'content', rows: (file?.teams ?? []).map(t => ({ name: t.name, colour: t.color ?? null, drivers: t.drivers.map(d => d.name).join(', '), count: t.drivers.length })) };
  },
  async posts(params) {
    const [{ publishedPosts, readMinutes }, { loadAllSeriesMeta }] = await Promise.all([import('@/lib/blog'), import('@/lib/series')]);
    const [all, metas] = await Promise.all([publishedPosts(), loadAllSeriesMeta()]);
    const byslug = new Map(metas.map(m => [m.slug, m]));
    const series = params.series ? String(params.series) : null;
    const count = num(params.count) ?? 10;
    // The first row is Home's lead (P2.24 A): fetchHomeBlogLead's order, the stamped by their stamp, newest first, the never
    // stamped last, the creation as the tie-break; the row's Published is that stamp, the creation when there is none.
    const stamp = (p: { publishedAt: string | null }) => (p.publishedAt ? new Date(p.publishedAt).getTime() : null);
    const created = (p: { createdAt: string }) => new Date(p.createdAt).getTime();
    const rows: SourceRow[] = all
      .filter(p => !series || p.seriesSlug === series || p.tags.includes(series))
      .sort((a, b) => {
        const sa = stamp(a);
        const sb = stamp(b);
        if (sa === null || sb === null) return sa === sb ? created(b) - created(a) : sa === null ? 1 : -1;
        return sb - sa || created(b) - created(a);
      })
      .slice(0, count)
      .map(p => {
        const m = p.seriesSlug ? byslug.get(p.seriesSlug) : undefined;
        return { slug: p.slug, title: p.title, summary: p.summary, series: p.seriesSlug, author: p.authorName, published: p.publishedAt ?? p.createdAt, hero: p.heroImage, link: `/blog/${p.slug}`, seriesName: m?.name ?? null, colour: m?.color ?? null, minutes: readMinutes(p.body) };
      });
    return { tier: 'db', rows };
  },
  async news(params, keys) {
    const [{ fetchAggregatedNews }, { loadAllSeriesMeta }] = await Promise.all([import('@/lib/news'), import('@/lib/series')]);
    const per = num(params.per) ?? 3;
    const [items, metas] = await Promise.all([fetchAggregatedNews(per), loadAllSeriesMeta()]);
    const byslug = new Map(metas.map(m => [m.slug, m]));
    // Newest first, as Home's wire orders them (P2.24 A); the series' name and colour as buildWire resolves them, nulls for a series it does not know.
    const rows: SourceRow[] = items
      .slice()
      .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
      .map(i => {
        const m = byslug.get(i.seriesSlug);
        return { title: i.title, link: i.link, source: hostOf(i.link), published: iso(i.pubDate), series: i.seriesSlug, seriesName: m?.name ?? null, colour: m?.color ?? null };
      });
    return { tier: 'snapshot', rows, run: null, meta: await metaFor(keys) };
  },
  async authors() {
    const { listAuthors } = await import('@/lib/authors');
    return { tier: 'db', rows: (await listAuthors()).map(a => ({ slug: a.slug, name: a.displayName, role: a.roleTitle, bio: a.bio, links: a.links.length })) };
  },
  async releases() {
    const { loadReleaseGroups, releasesFilePath } = await import('@/app/(app)/changelog/releases');
    const groups = await loadReleaseGroups(releasesFilePath());
    return { tier: 'content', rows: groups.map(g => ({ release: g.label, versions: g.versionSpan, dates: g.dateRange, entries: g.entries.length })) };
  },
  async tracks() {
    const { loadCircuits } = await import('@/lib/circuits');
    const circuits = await loadCircuits();
    return { tier: 'content', rows: Object.entries(circuits).map(([slug, c]) => ({ slug, name: c.name, country: c.countryCode ?? null, lat: c.lat, lon: c.lon })) };
  },
};

const round = (ms: number) => Math.round(ms * 10) / 10;

/**
 * Read a source by its ref: the rows shaped by its columns, the total before
 * `limit`, and where they came from. Never throws.
 */
export async function readSource(ref: SourceRef, opts: { limit?: number } = {}): Promise<SourceRead> {
  const t = performance.now();
  const source = findSource(ref.source);
  const label = sourceLabel(ref, SERIES_OPTIONS.map(o => ({ slug: o.key, name: o.label })));
  const keys = source?.loaderKeys?.(ref.params) ?? [];
  if (!source) return { columns: [], rows: [], total: 0, provenance: { ref, label, tier: 'content', keys, rows: 0, ms: round(performance.now() - t), error: 'Source must name a source from the catalogue' } };
  const reader = READERS[source.key];
  try {
    const out = await reader(ref.params, keys);
    const rows = opts.limit === undefined ? out.rows : out.rows.slice(0, Math.max(0, opts.limit));
    const provenance: SourceProvenance = { ref, label, tier: out.tier, keys: out.keys ?? keys, rows: out.rows.length, ms: round(performance.now() - t) };
    if (out.run !== undefined) provenance.run = out.run;
    if (out.meta !== undefined) provenance.meta = out.meta;
    return { columns: source.columns, rows, total: out.rows.length, provenance };
  } catch (err) {
    return { columns: source.columns, rows: [], total: 0, provenance: { ref, label, tier: TIER_OF_FRESH[source.fresh], keys, rows: 0, ms: round(performance.now() - t), error: err instanceof Error ? err.message : String(err) } };
  }
}
