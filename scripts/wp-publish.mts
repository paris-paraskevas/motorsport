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
//
// Publishing needs WP_SITE_URL (an https origin), WP_USER and WP_APP_PASSWORD (an
// application password; never printed). Every log line starts with the run's
// correlation id and a phase code: F fetch · N decide · W write data · R render · P publish.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
import type { Series } from '../lib/types';
import {
  calendarEntries,
  calendarPage,
  escapeHtml,
  hashOf,
  heading,
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
  type Page,
  type ResultRound,
  type SeriesData,
  type Table,
  type WpPageRow,
} from '../lib/wp/render';
import { decideFeed, statusPage, type FeedHealth, type FeedKind, type Fresh } from '../lib/wp/health';

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DRY = argv.includes('--dry-run');
const TEST = argv.includes('--test-page');
const OUT = opt('--out');
const DATA = opt('--data');
const FROM_REF = opt('--from-ref');

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
    async createPage(fields: { title: string; slug: string; parent: number; status: 'publish' | 'draft'; content: string }): Promise<number> {
      const { json } = await call('POST', 'pages', fields);
      return (json as WpRestPage).id;
    },
    async updatePage(id: number, fields: { title: string; content: string; status?: 'draft' }): Promise<void> {
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
  const content = withMarker(page.body, hash);
  const row = wpPaths(await wp.listPages()).get(page.path);
  if (row && !MARKER.test(row.content)) {
    log('P', `FAIL ${page.path} exists as page ${row.id} without the publisher's mark: left alone`);
    return 1;
  }
  const id = row ? row.id : await wp.createPage({ title: page.title, slug: 'paddock-publisher-test', parent: 0, status: 'draft', content });
  if (row) await wp.updatePage(id, { title: page.title, content, status: 'draft' });
  const back = await wp.getPage(id);
  const raw = back.content?.raw ?? '';
  const checks: [string, boolean][] = [
    ['the page is a draft', back.status === 'draft'],
    ['the marker came back with the same hash', MARKER.exec(raw)?.[1] === hash],
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

/** Fetch (or read what is stored at --from-ref), decide every feed, keep the data, render the pages. */
async function build(now: Date): Promise<{ pages: Page[]; health: FeedHealth[] }> {
  const slugs = (await listSeriesSlugs()).sort();
  const names = new Map<string, string>();
  for (const slug of slugs) names.set(slug, (await loadSeriesMeta(slug)).name);

  const fetched: Fetched | null = FROM_REF ? null : await fetchEverything(slugs, now);
  if (FROM_REF) log('F', `no fetch: rendering the data stored at ${FROM_REF}`);

  const health: FeedHealth[] = [];
  const all: SeriesData[] = [];
  let dataChanged = 0;
  for (const slug of slugs) {
    const d: SeriesData = { slug, name: names.get(slug) ?? slug, standings: null, results: null, calendar: null };
    for (const kind of KINDS) {
      const rel = relOf(slug, kind);
      const previous = readStored<unknown>(rel);
      const fresh = fetched ? fetched[kind].get(slug) : undefined;
      // No such feed for this series (NLS and the ADAC 24h have no standings), or nothing stored at the ref.
      if (fetched ? fresh === undefined : previous === null) continue;
      // Rendering stored data there is no fetch: what is stored is the data, and it is OK.
      const decision = fresh ? decideFeed<unknown>(fresh, previous, usable[kind]) : { data: previous, status: 'OK' as const, note: '' };
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
    all.push(d);
  }
  if (fetched) writeStored('health.json', health);
  log('W', DATA && fetched ? `${dataChanged} data files changed in ${DATA}` : 'no data written');

  const pages: Page[] = [seriesIndexPage(all, now), calendarPage(all, now), statusPage(health, now), ...all.flatMap(d => seriesPages(d, now))];
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

/** Every page to WordPress, parents first; false when a step failed or a page was not ours to write. */
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
  const tally = { create: 0, update: 0, same: 0, conflict: 0, failed: 0 };
  try {
    const existing = await wp.listPages();
    const ids = new Map<string, number>();
    for (const [path, row] of wpPaths(existing)) ids.set(path, row.id);
    for (const step of planSync(pages, existing)) {
      const { path, title } = step.page;
      if (step.kind === 'same') {
        tally.same++;
        continue;
      }
      if (step.kind === 'conflict') {
        tally.conflict++;
        log('P', `CONFLICT ${path} is page ${step.id} without the publisher's mark: left alone`);
        continue;
      }
      const started = Date.now();
      try {
        const content = withMarker(step.page.body, step.hash);
        if (step.kind === 'create') {
          const segments = path.split('/').filter(Boolean);
          const parentPath = segments.length > 1 ? `/${segments.slice(0, -1).join('/')}/` : null;
          const parent = parentPath === null ? 0 : ids.get(parentPath);
          if (parent === undefined) throw new Error(`its parent ${parentPath} does not exist`);
          ids.set(path, await wp.createPage({ title, slug: segments[segments.length - 1], parent, status: 'publish', content }));
        } else {
          await wp.updatePage(step.id, { title, content });
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
  log('P', `${wp.host}: ${tally.create} created, ${tally.update} updated, ${tally.same} unchanged, ${tally.conflict} conflicts, ${tally.failed} failed`);
  return tally.failed === 0 && tally.conflict === 0;
}

async function main(): Promise<number> {
  const now = new Date();
  const { pages, health } = await build(now);
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
