import 'server-only';
import path from 'path';
import { SERIES_OPTIONS, findSource, sourceLabel, type SourceColumn, type SourceFresh, type SourceParams, type SourceRef } from './sources';
import type { SnapshotMeta } from '@/lib/source-snapshot';

// The reader behind the catalogue (the components programme, P2.1): one
// readSource for the thirteen, each through the loader the code already has,
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

type Answer = { rows: SourceRow[]; tier: SourceTier; run?: SourceRun | null; meta?: SnapshotMeta | null };
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

/** The standings of a series the rows tier cannot hold whole: GT World's three
 *  cups, IMSA's and WEC's classes (one row per class and kind, in the order the
 *  tabs draw them) and WRC's co-drivers and manufacturers; read from the
 *  snapshot each fetcher keeps (the loader warms every key). Null for the ten
 *  flat series, which read the rows tier; an empty snapshot is no rows. */
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
  if (series === 'wrc') {
    const { fetchWRCStandings } = await import('@/lib/standings/wrc');
    const s = await fetchWRCStandings();
    if (!s) return [];
    return [
      ...s.drivers.map(d => driverRow(d, null)),
      ...s.coDrivers.map(c => ({ kind: 'co-driver', position: c.position, name: c.coDriverName, code: null, team: c.team || null, points: c.points, wins: null, class: null }) as SourceRow),
      ...s.manufacturers.map(m => teamRow('manufacturer', m.position, m.name, m.points, m.wins, null)),
    ];
  }
  return null;
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
    // The class families and WRC (P2.2) read the snapshot the tabs read: the rows tier holds drivers and constructors alone, no class, no co-drivers.
    const family = await familyStandings(series, season);
    if (family) return { tier: 'snapshot', rows: family, run: null, meta: await metaFor(keys) };
    const { readCurrentStandingsWithRun } = await import('@/lib/standing-rows');
    const current = await readCurrentStandingsWithRun(series, season);
    if (current) {
      const rows: SourceRow[] = [
        ...current.standings.drivers.map(d => ({ kind: 'driver', position: d.position, name: d.driverName, code: d.driverCode ?? null, team: d.team || null, points: d.points, wins: d.wins ?? null, class: null })),
        ...current.standings.constructors.map(c => ({ kind: 'constructor', position: c.position, name: c.name, code: null, team: null, points: c.points, wins: c.wins ?? null, class: null })),
      ];
      return { tier: 'rows', rows, run: await readRun(current.runId) };
    }
    const { fetchFullDriverStandings } = await import('@/lib/standings/brief');
    const drivers = await fetchFullDriverStandings(series, season);
    return {
      tier: 'snapshot',
      rows: (drivers ?? []).map(d => ({ kind: 'driver', position: d.position, name: d.driverName, code: d.driverCode ?? null, team: d.team || null, points: d.points, wins: d.wins ?? null, class: null })),
      run: null,
      meta: await metaFor(keys),
    };
  },
  async results(params, keys) {
    // The season parameter offers the one the loader warms, which is the one the dispatch reads; when the archive brings earlier seasons, the dispatch takes it.
    const [{ loadSeries }, { loadSnapshotSource }] = await Promise.all([import('@/lib/series'), import('@/components/weekend/WeekendStandingsSnapshot')]);
    const series = await loadSeries(String(params.series));
    const snapshot = await loadSnapshotSource(series);
    const races = [...(snapshot?.races ?? []), ...(snapshot?.extras ?? [])];
    const rows: SourceRow[] = races.flatMap(r =>
      r.results.map(e => ({ round: r.round, race: r.raceName, date: iso(r.date), circuit: str(r.circuit), position: e.position, driver: e.driverName, code: e.driverCode ?? null, team: str(e.team), status: str(e.status), time: e.time ?? null, points: e.points })),
    );
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
    const { publishedPosts } = await import('@/lib/blog');
    const all = await publishedPosts();
    const series = params.series ? String(params.series) : null;
    const count = num(params.count) ?? 10;
    const rows: SourceRow[] = all
      .filter(p => !series || p.seriesSlug === series || p.tags.includes(series))
      .slice(0, count)
      .map(p => ({ slug: p.slug, title: p.title, summary: p.summary, series: p.seriesSlug, author: p.authorName, published: p.publishedAt, hero: p.heroImage, link: `/blog/${p.slug}` }));
    return { tier: 'db', rows };
  },
  async news(params, keys) {
    const { fetchAggregatedNews } = await import('@/lib/news');
    const per = num(params.per) ?? 3;
    const items = await fetchAggregatedNews(per);
    return { tier: 'snapshot', rows: items.map(i => ({ title: i.title, link: i.link, source: hostOf(i.link), published: iso(i.pubDate), series: i.seriesSlug })), run: null, meta: await metaFor(keys) };
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
    const provenance: SourceProvenance = { ref, label, tier: out.tier, keys, rows: out.rows.length, ms: round(performance.now() - t) };
    if (out.run !== undefined) provenance.run = out.run;
    if (out.meta !== undefined) provenance.meta = out.meta;
    return { columns: source.columns, rows, total: out.rows.length, provenance };
  } catch (err) {
    return { columns: source.columns, rows: [], total: 0, provenance: { ref, label, tier: TIER_OF_FRESH[source.fresh], keys, rows: 0, ms: round(performance.now() - t), error: err instanceof Error ? err.message : String(err) } };
  }
}
