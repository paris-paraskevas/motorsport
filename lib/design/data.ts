import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import { betDb, isBettingConfigured } from '@/lib/betting/client';
import { fetchGa4Traffic, isGa4Configured } from '@/lib/analytics/ga4';
import { fetchGscSearch, isGscConfigured } from '@/lib/analytics/gsc';
import { fetchBingSearch, isBingConfigured } from '@/lib/analytics/bing';
import {
  WORKERS_INCLUDED_REQUESTS,
  fetchBillableUsage,
  fetchWorkerUsage,
  isCloudflareBillingConfigured,
  isCloudflareUsageConfigured,
} from '@/lib/analytics/cloudflare';
import { kv } from '@/lib/kv';
import { listSubscriptions } from '@/lib/push-store';
import { INDEXNOW_KEY } from '@/lib/site';
import { DATA_SERVICES, findDataService, type DataService, type DataState, type DataTone } from './data-services';

// The Data workspace's figures (Phase 4 of the designer plan, PR 4.1): one
// overview per service, read through the readers the code already has
// (lib/analytics/*, Clerk, Supabase, the key-value store) and nothing new.
//
// THE RULE THIS FILE ENFORCES: nothing here throws and nothing here writes. A
// reader that fails or answers nothing lands the card in `error` with a plain
// note; a credential is reported by presence and never by value. An overview is
// kept for a minute per process so opening the workspace twice does not ask
// Google twice; the Refresh button passes `fresh` and reads again.

export interface DataKpi {
  label: string;
  value: string;
  note?: string;
}
export interface DataTable {
  title: string;
  cols: string[];
  rows: string[][];
}
/** The one figure a card shows large, with its unit and one line of context. */
export interface DataHeadline {
  value: string;
  unit: string;
  context: string;
}
export interface DataOverview {
  key: string;
  state: DataState;
  /** The reader's own verdict; absent means nothing to flag. */
  tone?: DataTone;
  headline?: DataHeadline;
  fetchedAt: string;
  kpis: DataKpi[];
  /** Oldest first, one point a day, when the reader gives a series. */
  series: { label: string; points: number[] } | null;
  breakdowns: DataTable[];
  /** The credentials the connection needs, by name, and whether each is present. */
  connection: { name: string; present: boolean }[];
  /** Why the figures are missing or partial, in plain words. */
  note?: string;
}
export interface DataIndexEntry {
  key: string;
  state: DataState;
  fetchedAt: string | null;
}

const MEMO_MS = 60_000;
const memo = new Map<string, { at: number; value: DataOverview }>();

export function resetDataMemo(): void {
  memo.clear();
  runsMemo.clear();
}

const present = (name: string): boolean => Boolean(process.env[name]);
const fmt = (n: number): string => Math.round(n).toLocaleString('en-GB');
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const day = (iso: string | number | null | undefined): string => {
  if (iso === null || iso === undefined) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toISOString().replace('T', ' ').slice(0, 16) + 'Z';
};
const clock = (iso: string | null | undefined): string => (iso ? day(iso).slice(11) : '—');

/** The last seven points against the seven before, in words; the fallback when the series is too short. */
function weekChange(points: number[], fallback: string): string {
  if (points.length < 14) return fallback;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const last = sum(points.slice(-7));
  const before = sum(points.slice(-14, -7));
  if (before === 0) return fallback;
  const change = Math.round(((last - before) / before) * 100);
  if (change === 0) return 'Level with the week before';
  return `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)}% on the week before`;
}

/** The state a card starts in, from the credentials' presence and the readers' own guards. */
export function serviceState(s: DataService): DataState {
  if (s.tier === 'own') return 'own';
  if (s.tier === 'cred') return 'connect';
  switch (s.key) {
    case 'ga4':
      return isGa4Configured() ? 'live' : 'connect';
    case 'gsc':
      return isGscConfigured() ? 'live' : 'connect';
    case 'bing':
      return isBingConfigured() ? 'live' : 'connect';
    case 'cf':
      return isCloudflareUsageConfigured() || isCloudflareBillingConfigured() ? 'live' : 'connect';
    case 'sb':
      return isBettingConfigured() ? 'live' : 'connect';
    default:
      return s.cred.every(present) ? 'live' : 'connect';
  }
}

export function connectionOf(s: DataService): { name: string; present: boolean }[] {
  return s.cred.map(name => ({ name, present: present(name) }));
}

/** Every service with its state now and when its figures were last read here. */
export function loadDataIndex(): DataIndexEntry[] {
  return DATA_SERVICES.map(s => ({ key: s.key, state: serviceState(s), fetchedAt: memo.get(s.key)?.value.fetchedAt ?? null }));
}

// The loader (scripts/warm-live-data.mts) runs every 20 minutes from GitHub
// Actions (.github/workflows/warm-live-data.yml) and writes each source under a
// source_run row; a source whose newest ok run is older than three of those
// cycles has missed its loads and is STALE. Runs older than 30 days are pruned
// by the loader itself (pruneStandingRuns), the newest ok run of every source
// excepted.
export const LOADER_PERIOD_MINUTES = 20;
export const STALE_AFTER_MINUTES = LOADER_PERIOD_MINUTES * 3 + 5;

export interface RunRow {
  id: string;
  source: string;
  status: string;
  rows: number;
  started: string | null;
  finished: string | null;
  runner: string | null;
  error: string | null;
}
export type SourceState = 'fine' | 'running' | 'failed' | 'stale' | 'never';
export interface SourceRow {
  key: string;
  label: string;
  state: SourceState;
  /** The newest run of any outcome. */
  newest: RunRow | null;
  /** When the newest ok run finished; null when none is in reach. */
  lastOk: string | null;
}
export interface RunsLog {
  fetchedAt: string;
  periodMinutes: number;
  staleAfterMinutes: number;
  sources: SourceRow[];
  /** Newest first, as many as asked for. */
  runs: RunRow[];
  last24h: { runs: number; failed: number };
}

const toRun = (raw: Record<string, unknown>): RunRow => ({
  id: raw.id == null ? '' : String(raw.id),
  source: String(raw.source_key),
  status: String(raw.status),
  rows: Number(raw.rows_written) || 0,
  started: raw.started_at == null ? null : String(raw.started_at),
  finished: raw.finished_at == null ? null : String(raw.finished_at),
  runner: raw.runner == null ? null : String(raw.runner),
  error: raw.error == null ? null : String(raw.error),
});

/** The state a source is in, from its newest run and its newest ok run. */
export function sourceState(newest: RunRow | null, lastOk: string | null, now = Date.now()): SourceState {
  if (!newest) return 'never';
  if (newest.status === 'running') return 'running';
  if (newest.status === 'failed') return 'failed';
  if (!lastOk || now - new Date(lastOk).getTime() > STALE_AFTER_MINUTES * 60_000) return 'stale';
  return 'fine';
}

const SOURCE_WORD: Record<SourceState, string> = { fine: 'fine', running: 'running', failed: 'failed', stale: 'stale', never: 'never ran' };

const runsTable = (sources: SourceRow[]): DataTable => ({
  title: 'Loads · the newest run per source',
  cols: ['Source', 'State', 'Rows', 'Finished'],
  rows: sources.map(s => [s.label, SOURCE_WORD[s.state], s.newest ? fmt(s.newest.rows) : '—', day(s.newest?.finished ?? s.newest?.started)]),
});

/** How the loader is doing, for a card: the counts, the colour and the words for the trouble. */
function loaderVerdict(log: RunsLog): { fine: number; total: number; trouble: string; tone: DataTone; lastRun: string | null } {
  const n = (state: SourceState) => log.sources.filter(s => s.state === state).length;
  const fine = n('fine') + n('running');
  const failed = n('failed');
  const stale = n('stale');
  const never = n('never');
  const total = log.sources.length;
  const trouble = [failed ? `${failed} failed` : '', stale ? `${stale} stale` : '', never ? `${never} never ran` : ''].filter(Boolean).join(' · ');
  const tone: DataTone = total > 0 && fine === 0 ? 'bad' : failed + stale + never > 0 ? 'warn' : 'ok';
  const newest = log.runs[0];
  return { fine, total, trouble, tone, lastRun: newest ? (newest.finished ?? newest.started) : null };
}

const RUNS_LIMIT = { min: 50, max: 1000, default: 200 };
const runsMemo = new Map<number, { at: number; value: RunsLog }>();

/**
 * The runs page: every source with its state, the newest runs, and the last
 * day's counts. Kept for a minute per limit; `fresh` reads again. Null when the
 * tables cannot be read.
 */
export async function loadRunsLog(opts: { fresh?: boolean; limit?: number } = {}): Promise<RunsLog | null> {
  if (!isBettingConfigured()) return null;
  const limit = Math.min(RUNS_LIMIT.max, Math.max(RUNS_LIMIT.min, Math.trunc(opts.limit ?? RUNS_LIMIT.default) || RUNS_LIMIT.default));
  const hit = runsMemo.get(limit);
  if (hit && !opts.fresh && Date.now() - hit.at < MEMO_MS) return hit.value;
  const db = betDb();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [sources, newest, oks, dayAll, dayFailed] = await Promise.all([
    db.from('source').select('key, label').order('key'),
    db.from('source_run').select('id, source_key, status, rows_written, started_at, finished_at, runner, error').order('started_at', { ascending: false }).limit(limit),
    db.from('source_run').select('source_key, finished_at').eq('status', 'ok').order('finished_at', { ascending: false }).limit(300),
    db.from('source_run').select('*', { count: 'exact', head: true }).gte('started_at', since),
    db.from('source_run').select('*', { count: 'exact', head: true }).gte('started_at', since).eq('status', 'failed'),
  ]);
  if (sources.error || newest.error || oks.error || !Array.isArray(sources.data) || !Array.isArray(newest.data) || !Array.isArray(oks.data)) return null;
  const runs = (newest.data as Record<string, unknown>[]).map(toRun);
  const newestBySource = new Map<string, RunRow>();
  for (const r of runs) if (!newestBySource.has(r.source)) newestBySource.set(r.source, r);
  const lastOkBySource = new Map<string, string>();
  for (const raw of oks.data as Record<string, unknown>[]) {
    const key = String(raw.source_key);
    if (!lastOkBySource.has(key) && raw.finished_at != null) lastOkBySource.set(key, String(raw.finished_at));
  }
  // A source the newest runs no longer reach still has a newest run somewhere:
  // one small indexed read each, only for those.
  const labels = new Map((sources.data as Record<string, unknown>[]).map(s => [String(s.key), String(s.label ?? s.key)] as const));
  for (const r of runs) if (!labels.has(r.source)) labels.set(r.source, r.source);
  const missing = [...labels.keys()].filter(k => !newestBySource.has(k));
  const found = await Promise.all(
    missing.map(k => db.from('source_run').select('id, source_key, status, rows_written, started_at, finished_at, runner, error').eq('source_key', k).order('started_at', { ascending: false }).limit(1)),
  );
  found.forEach((res, i) => {
    const row = Array.isArray(res.data) ? (res.data as Record<string, unknown>[])[0] : undefined;
    if (row) newestBySource.set(missing[i], toRun(row));
  });
  const now = Date.now();
  const sourcesOut: SourceRow[] = [...labels.entries()]
    .map(([key, label]) => {
      const n = newestBySource.get(key) ?? null;
      const lastOk = lastOkBySource.get(key) ?? (n?.status === 'ok' ? n.finished : null);
      return { key, label, state: sourceState(n, lastOk, now), newest: n, lastOk };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const value: RunsLog = {
    fetchedAt: new Date(now).toISOString(),
    periodMinutes: LOADER_PERIOD_MINUTES,
    staleAfterMinutes: STALE_AFTER_MINUTES,
    sources: sourcesOut,
    runs,
    last24h: { runs: dayAll.error ? 0 : (dayAll.count ?? 0), failed: dayFailed.error ? 0 : (dayFailed.count ?? 0) },
  };
  runsMemo.set(limit, { at: now, value });
  return value;
}

type Partial = Pick<DataOverview, 'kpis' | 'series' | 'breakdowns'> & { note?: string; state?: DataState; tone?: DataTone; headline?: DataHeadline };

const readers: Record<string, () => Promise<Partial>> = {
  async ga4() {
    const t = await fetchGa4Traffic(28);
    if (!t) return { kpis: [], series: null, breakdowns: [], state: 'error', note: 'The reader answered nothing: the key, the property id or the API refused.' };
    return {
      kpis: [
        { label: 'Users · 28d', value: fmt(t.users) },
        { label: 'Sessions', value: fmt(t.sessions) },
        { label: 'Page views', value: fmt(t.pageViews) },
      ],
      series: { label: 'Users · daily · last 28 days', points: t.trend },
      headline: { value: fmt(t.users), unit: 'visitors · 28 days', context: weekChange(t.trend, `${fmt(t.sessions)} sessions`) },
      breakdowns: [
        { title: 'Top pages · 28d · page path × views', cols: ['Page', 'Views'], rows: t.topPages.map(p => [p.path, fmt(p.views)]) },
        { title: 'Countries · 28d · country × users', cols: ['Country', 'Users'], rows: t.topCountries.map(c => [c.country, fmt(c.users)]) },
      ],
    };
  },
  async gsc() {
    const s = await fetchGscSearch(28);
    if (!s) return { kpis: [], series: null, breakdowns: [], state: 'error', note: 'The reader answered nothing: the key, the property or the API refused.' };
    return {
      kpis: [
        { label: 'Clicks · 28d', value: fmt(s.clicks) },
        { label: 'Impressions', value: fmt(s.impressions) },
        { label: 'CTR', value: pct(s.ctr) },
        { label: 'Avg position', value: s.position.toFixed(1) },
      ],
      series: null,
      headline: { value: fmt(s.clicks), unit: 'clicks · 28 days', context: `${fmt(s.impressions)} impressions · ${pct(s.ctr)} clicked` },
      breakdowns: [
        { title: 'Top queries · query × clicks, impressions', cols: ['Query', 'Clicks', 'Impressions'], rows: s.topQueries.map(q => [q.query, fmt(q.clicks), fmt(q.impressions)]) },
        { title: 'Top pages · page × clicks', cols: ['Page', 'Clicks'], rows: s.topPages.map(p => [p.page, fmt(p.clicks)]) },
      ],
      note: 'The reader returns totals; no daily series yet.',
    };
  },
  async bing() {
    const b = await fetchBingSearch();
    if (!b) return { kpis: [], series: null, breakdowns: [], state: 'error', note: 'The reader answered nothing: the key, the site or the API refused.' };
    return {
      kpis: [
        { label: 'Clicks', value: fmt(b.clicks) },
        { label: 'Impressions', value: fmt(b.impressions) },
        { label: 'CTR', value: pct(b.ctr) },
      ],
      series: null,
      headline: { value: fmt(b.clicks), unit: 'clicks', context: `${fmt(b.impressions)} impressions · what ChatGPT search reads` },
      breakdowns: [
        { title: 'Top queries · query × clicks, impressions', cols: ['Query', 'Clicks', 'Impressions'], rows: b.topQueries.map(q => [q.query, fmt(q.clicks), fmt(q.impressions)]) },
        { title: 'Top pages · page × clicks, impressions', cols: ['Page', 'Clicks', 'Impressions'], rows: b.topPages.map(p => [p.page, fmt(p.clicks), fmt(p.impressions)]) },
      ],
      note: 'Dates arrive in a format the reader does not parse, so no daily series yet.',
    };
  },
  async cf() {
    const [usage, billing] = await Promise.all([
      isCloudflareUsageConfigured() ? fetchWorkerUsage(30) : Promise.resolve(null),
      isCloudflareBillingConfigured() ? fetchBillableUsage(30) : Promise.resolve(null),
    ]);
    if (!usage && !billing) return { kpis: [], series: null, breakdowns: [], state: 'error', note: 'Neither reader answered: the tokens or the API refused.' };
    const kpis: DataKpi[] = [];
    if (usage) {
      kpis.push(
        { label: 'Requests · 30d', value: fmt(usage.requests), note: `of ${fmt(WORKERS_INCLUDED_REQUESTS)} a month included` },
        { label: 'Errors', value: fmt(usage.errors), note: usage.requests > 0 ? pct(usage.errors / usage.requests) : undefined },
        { label: 'Subrequests · 30d', value: fmt(usage.subrequests) },
      );
    }
    if (billing) {
      kpis.push({ label: 'Usage charges', value: `${billing.total.toFixed(2)} ${billing.currency}`, note: 'usage-based only; the plan’s fixed fee is not in it' });
    }
    const notes: string[] = [];
    if (!usage) notes.push(isCloudflareUsageConfigured() ? 'The usage reader answered nothing.' : 'The analytics token is not held: no usage figures.');
    if (!billing) notes.push(isCloudflareBillingConfigured() ? 'The billing reader answered nothing.' : 'The billing token is not held: no charges.');
    // Errors above half a percent of requests colour the card amber, above two
    // percent red; the operator's thresholds to move, not the readers'.
    const errorShare = usage && usage.requests > 0 ? usage.errors / usage.requests : 0;
    const tone: DataTone = errorShare > 0.02 ? 'bad' : errorShare > 0.005 ? 'warn' : 'ok';
    const headline: DataHeadline = usage
      ? { value: fmt(usage.requests), unit: 'requests · 30 days', context: `${pct(errorShare)} errors · ${fmt(WORKERS_INCLUDED_REQUESTS)} a month included` }
      : { value: `${billing!.total.toFixed(2)} ${billing!.currency}`, unit: 'usage charges · 30 days', context: 'The plan’s fixed fee is not in it' };
    return {
      kpis,
      series: null,
      tone,
      headline,
      breakdowns: billing
        ? [{ title: 'Usage-based charges · by service', cols: ['Service', 'Quantity', 'Cost'], rows: billing.services.map(s => [s.name, `${fmt(s.quantity)} ${s.unit}`.trim(), `${s.cost.toFixed(2)} ${billing.currency}`]) }]
        : [],
      note: notes.length ? notes.join(' ') : undefined,
    };
  },
  async clerk() {
    const client = await clerkClient();
    const [count, list] = await Promise.all([client.users.getCount(), client.users.getUserList({ limit: 25, orderBy: '-created_at' })]);
    const now = Date.now();
    const recent = list.data;
    const within = (days: number) => recent.filter(u => now - u.createdAt <= days * 86_400_000).length;
    const capped = recent.length === 25 ? ' · among the 25 newest' : '';
    return {
      kpis: [
        { label: 'Accounts', value: fmt(count) },
        { label: 'Sign-ups · 7d', value: fmt(within(7)), note: capped || undefined },
        { label: 'Sign-ups · 28d', value: fmt(within(28)), note: capped || undefined },
      ],
      series: null,
      headline: { value: fmt(count), unit: 'accounts', context: `${fmt(within(7))} new this week` },
      breakdowns: [
        {
          title: 'Recent sign-ups · the newest accounts',
          cols: ['When', 'Role'],
          rows: recent.map(u => [day(u.createdAt), typeof u.publicMetadata?.role === 'string' ? u.publicMetadata.role : 'reader']),
        },
      ],
    };
  },
  async sb() {
    const tables = ['page', 'page_revision', 'list', 'list_entry', 'asset', 'shortcut', 'setting', 'authz_scheme', 'theme'];
    const counts = await Promise.all(
      tables.map(async t => {
        const { count, error } = await betDb().from(t).select('*', { count: 'exact', head: true });
        return error ? null : (count ?? 0);
      }),
    );
    const log = await loadRunsLog();
    const c = (t: string) => {
      const n = counts[tables.indexOf(t)];
      return n === null ? '—' : fmt(n);
    };
    const kpis: DataKpi[] = [
      { label: 'Pages', value: c('page') },
      { label: 'Revisions', value: c('page_revision') },
      { label: 'Lists', value: c('list') },
      { label: 'Photos', value: c('asset') },
      { label: 'Shortcuts', value: c('shortcut') },
      { label: 'Settings', value: c('setting') },
    ];
    const verdict = log ? loaderVerdict(log) : null;
    if (log && verdict) {
      kpis.push({ label: 'Loads · 24h', value: fmt(log.last24h.runs) }, { label: 'Sources ok', value: `${verdict.fine} / ${verdict.total}` });
    }
    return {
      kpis,
      series: null,
      tone: verdict?.tone,
      headline:
        log && verdict
          ? { value: `${verdict.fine} / ${verdict.total}`, unit: 'sources fine', context: verdict.lastRun ? `The loader last ran ${clock(verdict.lastRun)}` : 'The loader has not run yet' }
          : { value: c('page'), unit: 'pages', context: `${c('page_revision')} revisions · ${c('list')} lists` },
      breakdowns: [
        { title: 'Tables · rows', cols: ['Table', 'Rows'], rows: tables.map(t => [t, c(t)]) },
        ...(log ? [runsTable(log.sources)] : []),
      ],
      note: log ? undefined : 'The loader’s runs could not be read.',
    };
  },
  async upstash() {
    const [size, subs] = await Promise.all([kv.dbsize(), listSubscriptions()]);
    return {
      kpis: [
        { label: 'Keys', value: fmt(size) },
        { label: 'Push subscriptions', value: fmt(subs.length) },
      ],
      series: null,
      headline: { value: fmt(size), unit: 'keys', context: `${fmt(subs.length)} push subscriptions among them` },
      breakdowns: [],
    };
  },
  async push() {
    if (!present('KV_REST_API_URL') || !present('KV_REST_API_TOKEN')) {
      return {
        kpis: [{ label: 'Subscriptions', value: '—', note: 'the key-value store is not readable here' }],
        series: null,
        headline: { value: '—', unit: 'subscriptions', context: 'The key-value store is not readable here' },
        breakdowns: [],
        note: 'Sends are not recorded; a send is only a cron response.',
      };
    }
    const subs = await listSubscriptions();
    return {
      kpis: [
        { label: 'Subscriptions', value: fmt(subs.length) },
        { label: 'Sends recorded', value: 'no', note: 'a send is only a cron response' },
      ],
      series: null,
      headline: { value: fmt(subs.length), unit: 'subscriptions', context: 'Sends are not recorded yet' },
      breakdowns: [],
    };
  },
  async idx() {
    return {
      kpis: [
        { label: 'Key file', value: INDEXNOW_KEY ? 'present' : 'missing', note: 'public by design' },
        { label: 'Submissions recorded', value: 'no', note: 'run by hand with npm run indexnow:submit' },
      ],
      series: null,
      tone: INDEXNOW_KEY ? 'ok' : 'warn',
      headline: { value: INDEXNOW_KEY ? 'present' : 'missing', unit: 'key file', context: 'Submissions are run by hand and not recorded' },
      breakdowns: [],
    };
  },
  async upstream() {
    const log = await loadRunsLog();
    if (!log) {
      return {
        kpis: [{ label: 'Sources', value: '—' }],
        series: null,
        tone: 'bad',
        headline: { value: '—', unit: 'loads · 24 hours', context: 'The loader’s runs could not be read' },
        breakdowns: [],
        note: 'The loader’s runs could not be read.',
      };
    }
    const { fine, total, trouble, tone } = loaderVerdict(log);
    return {
      kpis: [
        { label: 'Sources ok', value: `${fine} / ${total}` },
        { label: 'Failed · 24h', value: fmt(log.last24h.failed) },
        { label: 'Loads · 24h', value: fmt(log.last24h.runs) },
      ],
      series: null,
      tone,
      headline: { value: fmt(log.last24h.runs), unit: 'loads · 24 hours', context: `${fine} of ${total} sources fine${trouble ? ` · ${trouble}` : ''}` },
      breakdowns: [runsTable(log.sources)],
    };
  },
};

/** One service's overview, from its reader when it is live, kept for a minute. Null for an unknown key. */
export async function loadDataOverview(key: string, opts: { fresh?: boolean } = {}): Promise<DataOverview | null> {
  const service = findDataService(key);
  if (!service) return null;
  const hit = memo.get(key);
  if (hit && !opts.fresh && Date.now() - hit.at < MEMO_MS) return hit.value;
  const state = serviceState(service);
  const base: DataOverview = { key, state, fetchedAt: new Date().toISOString(), kpis: [], series: null, breakdowns: [], connection: connectionOf(service) };
  let value = base;
  const reader = readers[key];
  if (reader && (state === 'live' || state === 'own')) {
    try {
      const part = await reader();
      value = { ...base, ...part, state: part.state ?? state };
    } catch (err) {
      value = { ...base, state: 'error', note: `The reader failed: ${err instanceof Error ? err.message : 'unknown'}` };
    }
    if (value.state === 'error' && !value.headline) value = { ...value, headline: { value: '—', unit: '', context: value.note ?? 'The reader did not answer' } };
  } else if (state === 'connect') {
    const n = service.cred.length;
    value = {
      ...base,
      headline: { value: '—', unit: '', context: n ? `Not connected · ${n} credential${n === 1 ? '' : 's'} to add` : 'Not connected' },
      note: 'Not connected: the credentials named under Connection are not held by this Worker.',
    };
  }
  memo.set(key, { at: Date.now(), value });
  return value;
}
