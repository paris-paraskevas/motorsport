// Publish the standings, results and calendars to WordPress (slot O10).
//
// The old loader (scripts/warm-live-data.mts) filled a database the Worker read;
// this runs the same production fetchers from a clean IP (GitHub Actions), keeps
// what they return as JSON on the `paddock-data` branch (the workflow commits it
// only when something changed: git history is the backup), and writes each
// finished page through the WordPress REST API. Readers only see finished pages.
//
// A feed that fails falls back to its last committed JSON and is marked STALE
// (lib/wp/health.ts decideFeed); a page is never written from an empty fetch, and
// only a page carrying the publisher's marker is ever overwritten.
//
//   npx tsx scripts/wp-publish.mts --dry-run --out .wp-out                       fetch and render to files; no WordPress
//   npx tsx scripts/wp-publish.mts --data paddock-data                           fetch, store, publish
//   npx tsx scripts/wp-publish.mts --from-ref origin/paddock-data --dry-run --out .wp-out   stored data only; no fetch
//   npx tsx scripts/wp-publish.mts --test-page                                   one draft page written and read back
//   add --only /calendar/ to any of these                                        one family of pages, the others left as they are
//
// Publishing needs WP_SITE_URL (an https origin), WP_USER and WP_APP_PASSWORD (an
// application password; never printed). Every log line starts with the run's
// correlation id and a phase code: F fetch · N decide · W write data · R render · P publish.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runStandingsHealth, HEALTH_SEASON } from '../lib/standings-health';
import { runResultsHealth } from '../lib/results-health';
import { listSeriesSlugs, loadSeries, loadSeriesMeta } from '../lib/series';
import { loadCuratedDrivers } from '../lib/series-content';
import { fetchF1SeasonSprints } from '../lib/results/f1';
import { fetchDTMSeasonResults } from '../lib/results/dtm';
import { fetchNascarCupSeasonResults } from '../lib/results/nascar-cup';
import { fetchNlsSeasonResults } from '../lib/results/nls';
import { fetchAllGtWorldSeasonRaces } from '../lib/results/gt-world';
import { fetchImsaSeasonResults } from '../lib/results/imsa';
import { fetchWecSeasonResults } from '../lib/results/wec';
import { fetchIndyCarSeasonResults } from '../lib/results/indycar';
import { matchCircuitEntry, normalise, venueCandidates } from '../lib/circuits';
import contentFs from '../lib/content-fs';
import type { CancelledRoundEntry, Series, SeriesRoundEntry } from '../lib/types';
import { ROUND2_SERIES, seriesFamily } from '../lib/wp/series';
import {
  calendarEntries,
  calendarMonthPages,
  escapeHtml,
  hashOf,
  heading,
  onlyFamily,
  paragraph,
  planSync,
  resultRounds,
  seriesIndexPage,
  seriesPages,
  standingsTables,
  tableBlock,
  withMarker,
  wpPaths,
  MARKER,
  type CalendarEntry,
  type CalendarRound,
  type Page,
  type ResultRound,
  type SeriesData,
  type Table,
  type WpPageRow,
} from '../lib/wp/render';
import { decideFeed, resultsShrank, statusPage, type FeedHealth, type FeedKind, type Fresh } from '../lib/wp/health';

const argv = process.argv.slice(2);
// An unknown argument, or a flag missing its value, stops the run: "--only" with nothing after it would publish every page.
for (let i = 0; i < argv.length; i++) {
  if (['--out', '--data', '--from-ref', '--only'].includes(argv[i])) {
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) {
      console.error(`${argv[i]} needs a value`);
      process.exit(1);
    }
    i++;
  } else if (!['--dry-run', '--test-page'].includes(argv[i])) {
    console.error(`unknown argument ${argv[i]}`);
    process.exit(1);
  }
}
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DRY = argv.includes('--dry-run');
const TEST = argv.includes('--test-page');
const OUT = opt('--out');
const DATA = opt('--data');
const FROM_REF = opt('--from-ref');
/** Only the pages whose path starts here ("/calendar/"): a page family goes live once its design does. */
const ONLY = opt('--only');

const RUN = process.env.GITHUB_RUN_ID ? `wp-publish#${process.env.GITHUB_RUN_ID}` : `local-${Date.now().toString(36)}`;
const log = (phase: string, msg: string): void => console.error(`${RUN} ${phase} ${msg}`);
const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

if (DRY && !OUT) {
  console.error('--dry-run needs --out <dir>');
  process.exit(1);
}
if (FROM_REF !== undefined && !/^[\w./-]+$/.test(FROM_REF)) {
  console.error('--from-ref takes a branch, tag or commit');
  process.exit(1);
}
if (ONLY !== undefined && !/^\/[a-z0-9/-]*$/.test(ONLY)) {
  console.error('--only takes a path that starts with /, such as /calendar/');
  process.exit(1);
}
// A stray DATA_SOURCE=db turns every fetcher into a reader of a database this job does not have.
if (process.env.DATA_SOURCE === 'db') {
  console.error('DATA_SOURCE=db is set: the fetchers would read a database instead of fetching. Unset it.');
  process.exit(1);
}

// ── WordPress ────────────────────────────────────────────────────────────────

interface WpRestPage {
  id: number;
  slug: string;
  parent: number;
  status: string;
  title?: { raw?: string };
  content?: { raw?: string };
}

function wordpress() {
  const site = (process.env.WP_SITE_URL ?? '').trim().replace(/\/+$/, '');
  const user = (process.env.WP_USER ?? '').trim();
  const password = (process.env.WP_APP_PASSWORD ?? '').trim();
  if (!site || !user || !password) return null;
  if (!/^https:\/\/[^/\s]+$/.test(site)) throw new Error('WP_SITE_URL must be an https origin with no path, e.g. https://example.com');
  const auth = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

  async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ json: unknown; totalPages: number }> {
    const res = await fetch(`${site}/wp-json/wp/v2/${path}`, {
      method,
      headers: { Authorization: auth, Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} /wp-json/wp/v2/${path.split('?')[0]} answered HTTP ${res.status}: ${text.slice(0, 200)}`);
    return { json: text ? (JSON.parse(text) as unknown) : null, totalPages: Number(res.headers.get('x-wp-totalpages') ?? '1') };
  }

  const toRow = (p: WpRestPage): WpPageRow => ({ id: p.id, slug: p.slug, parent: p.parent, status: p.status, content: p.content?.raw ?? '' });

  return {
    host: new URL(site).host,
    async listPages(): Promise<WpPageRow[]> {
      const rows: WpPageRow[] = [];
      for (let page = 1, total = 1; page <= total && page <= 50; page++) {
        const { json, totalPages } = await call(
          'GET',
          `pages?context=edit&status=publish,future,draft,pending,private&per_page=100&page=${page}&_fields=id,slug,parent,status,content`,
        );
        total = totalPages;
        for (const p of json as WpRestPage[]) rows.push(toRow(p));
      }
      return rows;
    },
    /** The new page's id and the slug WordPress gave it, which can differ from the one asked for. */
    async createPage(fields: { title: string; slug: string; parent: number; status: 'publish' | 'draft'; content: string; template?: string }): Promise<{ id: number; slug: string }> {
      const { json } = await call('POST', 'pages', fields);
      const page = json as Partial<WpRestPage> | null;
      if (typeof page?.id !== 'number') throw new Error('POST /wp-json/wp/v2/pages answered without a page id');
      return { id: page.id, slug: typeof page.slug === 'string' ? page.slug : '' };
    },
    async updatePage(id: number, fields: { title: string; content: string; status?: 'draft'; template?: string }): Promise<void> {
      await call('POST', `pages/${id}`, fields);
    },
    async getPage(id: number): Promise<WpRestPage> {
      const { json } = await call('GET', `pages/${id}?context=edit`);
      return json as WpRestPage;
    },
  };
}

type WordPress = NonNullable<ReturnType<typeof wordpress>>;

// ── The first live run: one draft page written and read back ────────────────

async function testPage(wp: WordPress): Promise<number> {
  const page: Page = {
    path: '/paddock-publisher-test/',
    title: 'Paddock publisher test',
    body: [
      heading('A test page'),
      paragraph('A table, a link and a name with markup in it, which must come back as text.'),
      tableBlock(['Pos', 'Driver'], [['1', 'Kimi <b>Antonelli</b> & "Co"'], ['2', { text: 'Series', href: '/series/' }]]),
    ].join('\n\n'),
  };
  const hash = hashOf(page);
  const content = withMarker(page.body, hash, page.path);
  const row = wpPaths(await wp.listPages()).get(page.path);
  if (row && !MARKER.test(row.content)) {
    log('P', `FAIL ${page.path} exists as page ${row.id} without the publisher's mark: left alone`);
    return 1;
  }
  const id = row ? row.id : (await wp.createPage({ title: page.title, slug: 'paddock-publisher-test', parent: 0, status: 'draft', content })).id;
  if (row) await wp.updatePage(id, { title: page.title, content, status: 'draft' });
  const back = await wp.getPage(id);
  const raw = back.content?.raw ?? '';
  const mark = MARKER.exec(raw);
  const checks: [string, boolean][] = [
    ['the page is a draft', back.status === 'draft'],
    ['the marker came back first, with the same hash and address', mark?.[1] === hash && mark?.[2] === page.path],
    ['the table came back', /<table[\s>]/.test(raw) && raw.includes('</table>')],
    ['the markup in a name stayed text', raw.includes(escapeHtml('Kimi <b>Antonelli</b> & "Co"'))],
    ['the link came back', raw.includes('<a href="/series/">Series</a>')],
  ];
  for (const [what, ok] of checks) log('P', `${ok ? 'PASS' : 'FAIL'} ${what}`);
  log('P', `test page ${id} on ${wp.host}: ${checks.every(([, ok]) => ok) ? 'PASS' : 'FAIL'}`);
  return checks.every(([, ok]) => ok) ? 0 : 1;
}

async function runTestPage(): Promise<number> {
  try {
    const wp = wordpress();
    if (!wp) {
      log('P', 'WP_SITE_URL, WP_USER and WP_APP_PASSWORD are needed for the test page');
      return 1;
    }
    return await testPage(wp);
  } catch (err) {
    log('P', `FAIL ${errorText(err)}`);
    return 1;
  }
}

// ── Stored data (the paddock-data branch) ────────────────────────────────────

const KINDS: FeedKind[] = ['standings', 'results', 'calendar'];
const relOf = (slug: string, kind: FeedKind): string => `${slug}/${kind}.json`;

function readStored<T>(rel: string): T | null {
  try {
    if (FROM_REF) {
      return JSON.parse(execFileSync('git', ['show', `${FROM_REF}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) as T;
    }
    if (!DATA) return null;
    const file = join(DATA, rel);
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
  } catch {
    return null;
  }
}

/** Writes the file only when its text changed; true when it did. */
function writeStored(rel: string, value: unknown): boolean {
  if (!DATA) return false;
  const file = join(DATA, rel);
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (existsSync(file) && readFileSync(file, 'utf8') === text) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return true;
}

/** YYYY-MM-DD of the last commit that changed a stored file, from git. */
function committedDay(rel: string): string | null {
  try {
    const args = FROM_REF ? ['log', '-1', '--format=%cs', FROM_REF, '--', rel] : ['-C', DATA ?? '.', 'log', '-1', '--format=%cs', '--', rel];
    const out = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : null;
  } catch {
    return null;
  }
}

/** Whether stored or fetched data can carry a page: the right shape, and not empty. */
const usable: Record<FeedKind, (v: unknown) => boolean> = {
  standings: v => Array.isArray(v) && v.length > 0 && v.every(t => Array.isArray((t as Table)?.rows) && (t as Table).rows.length > 0),
  results: v => Array.isArray(v) && v.length > 0 && v.every(r => Array.isArray((r as ResultRound)?.sessions)),
  calendar: v => Array.isArray(v) && v.length > 0 && v.every(e => typeof (e as CalendarEntry)?.start === 'string'),
};

// ── Fetch ────────────────────────────────────────────────────────────────────

/** A fetch with its own timeout, timed, never throwing. */
async function timed<T>(run: () => Promise<T>, ms: number): Promise<{ value: T | null; error?: string; ms: number }> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${ms / 1000}s`)), ms);
      }),
    ]);
    return { value, ms: Date.now() - started };
  } catch (err) {
    return { value: null, error: errorText(err), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

interface Fetched {
  standings: Map<string, Fresh<Table[]>>;
  results: Map<string, Fresh<ResultRound[]>>;
  calendar: Map<string, Fresh<CalendarEntry[]>>;
}

async function fetchEverything(slugs: string[], now: Date): Promise<Fetched> {
  const out: Fetched = { standings: new Map(), results: new Map(), calendar: new Map() };

  // Calendars first: the results fetchers below need each series' rounds and season.
  const series = new Map<string, Series | null>();
  await Promise.all(
    slugs.map(async slug => {
      const t = await timed(() => loadSeries(slug), 30_000);
      series.set(slug, t.value);
      if (!t.value) {
        out.calendar.set(slug, { data: null, error: t.error ?? 'no calendar' });
        log('F', `calendar ${slug} ERROR ${t.error ?? ''} ${t.ms}ms`);
        return;
      }
      const entries = calendarEntries(t.value, now);
      // A series with no feed (the ADAC 24h) is curated only, and always current.
      const failed = t.value.configured && t.value.stale;
      out.calendar.set(slug, { data: entries.length ? entries : null, partial: failed, error: failed ? 'calendar feed did not answer' : undefined });
      log('F', `calendar ${slug} ${failed ? 'CURATED-ONLY' : 'OK'} ${entries.length} sessions ${t.ms}ms`);
    }),
  );
  const roundsOf = (slug: string) => series.get(slug)?.rounds?.rounds ?? [];
  const seasonOf = (slug: string) => series.get(slug)?.meta.season ?? HEALTH_SEASON;

  // Standings: the health registry (13 series in parallel, 30 s each, lib/health-core.ts).
  for (const r of await runStandingsHealth()) {
    const tables = r.value === undefined ? [] : standingsTables(r.slug, r.value);
    out.standings.set(r.slug, {
      data: tables.length ? tables : null,
      partial: r.status === 'LOW',
      error: r.error ?? (tables.length ? undefined : `${r.status.toLowerCase()} answer`),
    });
    log('F', `standings ${r.slug} ${r.status} ${r.rows} rows ${r.ms}ms${r.error ? ` ${r.error}` : ''}`);
  }

  // Results: the registry in parallel, then the surfaces it does not reach one at a
  // time, as the old loader ran them (the politest-treated sources: a burst is what
  // gets an IP blocked, scripts/warm-live-data.mts:115-117).
  const registry = new Map((await runResultsHealth()).map(r => [r.slug, r]));
  for (const r of registry.values()) log('F', `results ${r.slug} ${r.status} ${r.rows} rows ${r.ms}ms${r.error ? ` ${r.error}` : ''}`);
  const setResults = (slug: string, payload: unknown, error?: string) => {
    const rounds = payload === null || payload === undefined ? [] : resultRounds(slug, payload, roundsOf(slug));
    out.results.set(slug, { data: rounds.length ? rounds : null, error: error ?? (rounds.length ? undefined : 'empty answer') });
  };
  for (const slug of ['f2', 'f3', 'motogp', 'wsbk', 'formula-e', 'wrc']) {
    const r = registry.get(slug);
    setResults(slug, r?.value ?? null, r?.error);
  }

  const extra = async (label: string, run: () => Promise<unknown>) => {
    const t = await timed(run, 120_000);
    const rows = Array.isArray(t.value) ? t.value.length : t.value ? 1 : 0;
    log('F', `results ${label} ${t.error ? 'ERROR' : rows ? 'OK' : 'EMPTY'} ${rows} items ${t.ms}ms${t.error ? ` ${t.error}` : ''}`);
    return t;
  };
  // F1: the Grand Prix list from the registry, the sprint list beside it.
  const sprints = await extra('f1-sprints', () => fetchF1SeasonSprints());
  const f1 = registry.get('f1');
  setResults('f1', f1?.value === undefined ? null : { races: f1.value, sprints: sprints.value ?? [] }, f1?.error);
  // IndyCar with the curated drivers, as the Results tab passes them (teams and names).
  const indycar = await extra('indycar', async () => fetchIndyCarSeasonResults({ drivers: await loadCuratedDrivers('indycar') }));
  setResults('indycar', indycar.value, indycar.error);
  const dtm = await extra('dtm', () => fetchDTMSeasonResults(seasonOf('dtm'), roundsOf('dtm')));
  setResults('dtm', dtm.value, dtm.error);
  const nascar = await extra('nascar-cup', () =>
    fetchNascarCupSeasonResults({ rounds: roundsOf('nascar-cup').map(r => ({ round: r.round, startDate: r.startDate, name: r.name })) }),
  );
  setResults('nascar-cup', nascar.value, nascar.error);
  const nls = await extra('nls', () => fetchNlsSeasonResults(seasonOf('nls')));
  setResults('nls', nls.value, nls.error);
  const gt = await extra('gt-world', () => fetchAllGtWorldSeasonRaces(seasonOf('gt-world')));
  setResults('gt-world', gt.value, gt.error);
  const imsa = await extra('imsa', () => fetchImsaSeasonResults());
  setResults('imsa', imsa.value, imsa.error);
  const wec = await extra('wec', () => fetchWecSeasonResults());
  setResults('wec', wec.value, wec.error);

  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────────

/** The commit time at a ref: the moment a re-rendered status page was checked. */
function refTime(ref: string): Date | null {
  try {
    const t = Date.parse(execFileSync('git', ['log', '-1', '--format=%cI', ref], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
    return Number.isFinite(t) ? new Date(t) : null;
  } catch {
    return null;
  }
}

/** content/series/<slug>/rounds.json through the content bundle: its rounds and its cancelled rounds, unchecked. */
function roundsFile(slug: string): { rounds: Partial<SeriesRoundEntry>[]; cancelled: Partial<CancelledRoundEntry>[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(contentFs.readFileSync(join(process.cwd(), 'content', 'series', slug, 'rounds.json')));
  } catch {
    return { rounds: [], cancelled: [] };
  }
  const file = Array.isArray(raw) ? null : (raw as { rounds?: unknown; cancelledRounds?: unknown } | null);
  const list: unknown = Array.isArray(raw) ? raw : file?.rounds;
  return {
    rounds: Array.isArray(list) ? (list as Partial<SeriesRoundEntry>[]) : [],
    cancelled: Array.isArray(file?.cancelledRounds) ? (file.cancelledRounds as Partial<CancelledRoundEntry>[]) : [],
  };
}

/** The circuits whose outline the theme carries (wp-theme/paddock/assets/circuits/<circuits.json key>.svg). */
function themeOutlines(): Set<string> {
  try {
    return new Set(readdirSync(join(process.cwd(), 'wp-theme', 'paddock', 'assets', 'circuits')).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4)));
  } catch {
    return new Set();
  }
}

/** A series' rounds from its content (no fetch; the content bundle, where the sessions come from too), each with
 *  its host: the curated venue as written (the matcher reads aliases inside names, so "Las Vegas Motor Speedway"
 *  would come back as the Strip Circuit), else the circuit the feed's location or the round's name matches
 *  (lib/circuits.ts), and the host's outline when the theme carries it. A curated venue takes an outline only
 *  from a circuit of that very name. A rally has no circuit; a cancelled round has no band or card. */
async function calendarRounds(list: Partial<SeriesRoundEntry>[], calendar: CalendarEntry[] | null, rally: boolean, outlines: ReadonlySet<string>): Promise<CalendarRound[]> {
  const out: CalendarRound[] = [];
  for (const r of list) {
    if (typeof r?.round !== 'number' || typeof r.startDate !== 'string' || typeof r.endDate !== 'string' || typeof r.name !== 'string') continue;
    if (r.cancelled) continue;
    let venue: string | null = null;
    let outline: string | null = null;
    if (!rally) {
      const location = calendar?.find(e => e.round === r.round && e.location)?.location;
      const hit = await matchCircuitEntry(...venueCandidates({ venue: r.venue, location, title: r.name }));
      const named = (s: string) => normalise(s) === normalise(r.venue ?? '');
      venue = r.venue ?? hit?.circuit.name ?? null;
      if (hit && outlines.has(hit.slug) && (!r.venue || named(hit.circuit.name) || hit.circuit.aliases.some(named))) outline = hit.slug;
    }
    out.push({ round: r.round, name: r.name, startDate: r.startDate, endDate: r.endDate, venue, ...(typeof r.place === 'string' ? { place: r.place } : {}), outline });
  }
  return out;
}

/** content/series/<slug>/overview.md without its front matter, or undefined. */
function aboutText(slug: string): string | undefined {
  try {
    return contentFs.readFileSync(join(process.cwd(), 'content', 'series', slug, 'overview.md')).replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, '');
  } catch {
    return undefined;
  }
}

/** Fetch (or read what is stored at --from-ref), decide every feed, keep the data, render the pages. */
async function build(now: Date): Promise<{ pages: Page[]; health: FeedHealth[] }> {
  const slugs = (await listSeriesSlugs()).sort();
  // listSeriesSlugs answers [] on any error, which would empty /series/, /calendar/ and /status/.
  if (slugs.length === 0) throw new Error('no series found under content/series');
  const names = new Map<string, string>();
  const chips = new Map<string, { short?: string; order?: number; rally: boolean; season?: number }>();
  for (const slug of slugs) {
    const meta = await loadSeriesMeta(slug);
    names.set(slug, meta.name);
    chips.set(slug, { short: meta.shortName, order: meta.order, rally: meta.category === 'rally', season: meta.season });
  }
  const outlines = themeOutlines();

  const fetched: Fetched | null = FROM_REF ? null : await fetchEverything(slugs, now);
  if (FROM_REF) log('F', `no fetch: rendering the data stored at ${FROM_REF}`);
  // Re-rendering stored data, each feed keeps the status its run recorded beside it.
  const recorded = FROM_REF ? readStored<FeedHealth[]>('health.json') : null;
  const recordedFor = (slug: string, kind: FeedKind): FeedHealth | undefined =>
    Array.isArray(recorded) ? recorded.find(h => h?.slug === slug && h?.kind === kind) : undefined;

  const health: FeedHealth[] = [];
  const all: SeriesData[] = [];
  let dataChanged = 0;
  for (const slug of slugs) {
    const d: SeriesData = { slug, name: names.get(slug) ?? slug, standings: null, results: null, calendar: null };
    const chip = chips.get(slug);
    if (chip?.short) d.short = chip.short;
    if (chip?.order !== undefined) d.order = chip.order;
    for (const kind of KINDS) {
      const rel = relOf(slug, kind);
      const previous = readStored<unknown>(rel);
      let fresh = fetched ? fetched[kind].get(slug) : undefined;
      // No such feed for this series (NLS and the ADAC 24h have no standings), or nothing usable stored at the ref.
      if (fetched ? fresh === undefined : previous === null || !usable[kind](previous)) continue;
      // A season answering with fewer races than the stored one is a short answer, not news.
      if (kind === 'results' && fresh && fresh.data !== null && usable.results(previous) && resultsShrank(fresh.data as ResultRound[], previous as ResultRound[])) {
        fresh = { ...fresh, partial: true, error: 'fewer races than stored' };
      }
      const r = recordedFor(slug, kind);
      const decision = fresh
        ? decideFeed<unknown>(fresh, previous, usable[kind])
        : { data: previous, status: r?.status === 'STALE' || r?.status === 'MISSING' ? r.status : ('OK' as const), note: typeof r?.note === 'string' ? r.note : '' };
      const changed = fresh !== undefined && decision.status === 'OK' && decision.data !== null && writeStored(rel, decision.data);
      if (changed) dataChanged++;
      if (kind === 'standings') d.standings = decision.data as Table[] | null;
      else if (kind === 'results') d.results = decision.data as ResultRound[] | null;
      else d.calendar = decision.data as CalendarEntry[] | null;
      let since: string | null = null;
      if (decision.data !== null) since = changed || (fresh && !DATA) ? now.toISOString().slice(0, 10) : committedDay(rel);
      const { status, note } = decision;
      health.push({ slug, name: d.name, kind, status, note, since });
      log('N', `${kind} ${slug} ${status}${note ? ` (${note})` : ''}${changed ? ' changed' : ''}`);
    }
    const file = roundsFile(slug);
    d.rounds = await calendarRounds(file.rounds, d.calendar, chip?.rally === true, outlines);
    if (ROUND2_SERIES.has(slug)) {
      d.season = chip?.season;
      d.about = aboutText(slug);
      d.teams = ((await loadCuratedDrivers(slug))?.teams ?? []).map(t => ({ name: t.name, colour: t.color, drivers: t.drivers.map(x => ({ name: x.name, code: x.code })) }));
      d.cancelled = file.cancelled.flatMap(c =>
        typeof c?.originalRound === 'number' && typeof c.name === 'string' ? [{ round: c.originalRound, name: c.name, ...(typeof c.place === 'string' ? { place: c.place } : {}) }] : [],
      );
    }
    all.push(d);
  }
  if (fetched) writeStored('health.json', health);
  log('W', DATA && fetched ? `${dataChanged} data files changed in ${DATA}` : 'no data written');

  const checkedAt = FROM_REF ? (refTime(FROM_REF) ?? now) : now;
  const pages: Page[] = [
    seriesIndexPage(all, now),
    ...calendarMonthPages(all, now),
    statusPage(health, checkedAt),
    ...all.flatMap(d => (ROUND2_SERIES.has(d.slug) ? seriesFamily(d) : seriesPages(d, now))),
  ];
  log('R', `${pages.length} pages`);
  return { pages, health };
}

/** Each page as a standalone file under `out`, at its own path, for a look in a browser. */
function writeDryRun(pages: Page[], out: string): void {
  for (const p of pages) {
    const file = join(out, p.path, 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      `<!doctype html><meta charset="utf-8"><title>${escapeHtml(p.title)}</title>` +
        '<style>body{font:16px/1.5 system-ui,sans-serif;max-width:64rem;margin:2rem auto;padding:0 1rem}' +
        'table{border-collapse:collapse;margin:.5rem 0 1.5rem}th,td{border:1px solid #ccc;padding:.25rem .6rem;text-align:left}</style>' +
        `<h1>${escapeHtml(p.title)}</h1>\n${p.body}\n`,
    );
  }
  writeFileSync(
    join(out, 'manifest.json'),
    `${JSON.stringify(pages.map(p => ({ path: p.path, title: p.title, hash: hashOf(p), bytes: Buffer.byteLength(p.body) })), null, 2)}\n`,
  );
  log('P', `dry run: ${pages.length} pages written to ${out}; WordPress not called`);
}

/** Every page to WordPress, parents first; false when a step failed, a page was not ours to
 *  write, or WordPress gave one of ours another address. */
async function publish(pages: Page[]): Promise<boolean> {
  let wp: WordPress | null = null;
  try {
    wp = wordpress();
  } catch (err) {
    log('P', errorText(err));
  }
  if (!wp) {
    log('P', 'WP_SITE_URL, WP_USER and WP_APP_PASSWORD are not all set: nothing published');
    return false;
  }
  const tally = { create: 0, update: 0, same: 0, conflict: 0, moved: 0, failed: 0 };
  const moved = (path: string, at: string) => {
    tally.moved++;
    log('P', `MOVED ${path} lives at ${at}: WordPress gave it another slug, as a page or file of the same name holds that one; free the name and the next run keeps writing it where it is`);
  };
  try {
    const existing = await wp.listPages();
    const ids = new Map<string, number>();
    for (const [path, row] of wpPaths(existing)) ids.set(path, row.id);
    for (const step of planSync(pages, existing)) {
      const { path, title } = step.page;
      if (step.kind === 'conflict') {
        tally.conflict++;
        const under = pages.some(p => p.path !== path && p.path.startsWith(path)) ? '; the pages below it are still written under it' : '';
        log('P', `CONFLICT ${path} is page ${step.id} without the publisher's mark: left alone${under}`);
        continue;
      }
      if (step.kind !== 'create') {
        // Children find a parent of ours by the address it was written for, wherever WordPress put it.
        ids.set(path, step.id);
        if (step.at !== path) moved(path, step.at);
      }
      if (step.kind === 'same') {
        tally.same++;
        continue;
      }
      const started = Date.now();
      try {
        const content = withMarker(step.page.body, step.hash, path);
        const template = step.page.template ? { template: step.page.template } : {};
        if (step.kind === 'create') {
          const segments = path.split('/').filter(Boolean);
          const slug = segments[segments.length - 1];
          const parentPath = segments.length > 1 ? `/${segments.slice(0, -1).join('/')}/` : null;
          const parent = parentPath === null ? 0 : ids.get(parentPath);
          if (parent === undefined) throw new Error(`its parent ${parentPath} does not exist`);
          const made = await wp.createPage({ title, slug, parent, status: 'publish', content, ...template });
          ids.set(path, made.id);
          if (made.slug !== slug) moved(path, `${parentPath ?? '/'}${made.slug}/`);
        } else {
          await wp.updatePage(step.id, { title, content, ...template });
        }
        tally[step.kind]++;
        log('P', `${step.kind} ${path} ${Date.now() - started}ms`);
      } catch (err) {
        tally.failed++;
        log('P', `FAILED ${step.kind} ${path}: ${errorText(err)}`);
      }
    }
  } catch (err) {
    tally.failed++;
    log('P', `FAILED listing the pages on ${wp.host}: ${errorText(err)}`);
  }
  log(
    'P',
    `${wp.host}: ${tally.create} created, ${tally.update} updated, ${tally.same} unchanged, ${tally.conflict} conflicts, ${tally.moved} moved, ${tally.failed} failed`,
  );
  return tally.failed === 0 && tally.conflict === 0 && tally.moved === 0;
}

async function main(): Promise<number> {
  const now = new Date();
  let built: { pages: Page[]; health: FeedHealth[] };
  try {
    built = await build(now);
  } catch (err) {
    log('=', `FAILED before publishing: ${errorText(err)}`);
    return 1;
  }
  const { health } = built;
  const pages = ONLY ? onlyFamily(built.pages, ONLY) : built.pages;
  if (ONLY) log('R', `--only ${ONLY}: ${pages.length} of ${built.pages.length} pages (${pages.map(p => p.path).join(' ')})`);
  if (ONLY && !pages.some(p => p.path.startsWith(ONLY))) {
    log('=', `FAILED: --only ${ONLY} matches no page`);
    return 1;
  }
  const counts = { OK: 0, STALE: 0, MISSING: 0 };
  for (const h of health) counts[h.status]++;
  let ok = !(health.length > 0 && health.every(h => h.status === 'MISSING'));
  if (DRY && OUT) writeDryRun(pages, OUT);
  else ok = (await publish(pages)) && ok;
  log('=', `feeds ${counts.OK} OK, ${counts.STALE} STALE, ${counts.MISSING} MISSING; ${pages.length} pages; exit ${ok ? 0 : 1}`);
  return ok ? 0 : 1;
}

// One exit point and no process.exit(): on Windows it can abort while handles are
// still closing (exit 127, IDEAS.md:127). The health registry's 30 s timers
// (lib/health-core.ts:59-64) have fired by the time the one-at-a-time fetches end.
process.exitCode = TEST ? await runTestPage() : await main();
