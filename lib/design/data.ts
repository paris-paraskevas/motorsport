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
import { DATA_SERVICES, findDataService, type DataService, type DataState } from './data-services';

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
export interface DataOverview {
  key: string;
  state: DataState;
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
}

const present = (name: string): boolean => Boolean(process.env[name]);
const fmt = (n: number): string => Math.round(n).toLocaleString('en-GB');
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const day = (iso: string | number | null | undefined): string => {
  if (iso === null || iso === undefined) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toISOString().replace('T', ' ').slice(0, 16) + 'Z';
};

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

interface Run {
  source: string;
  status: string;
  rows: number;
  started: string | null;
  finished: string | null;
}

/** The loader's newest run per source (Phase 0's source_run), newest first. */
async function loadRuns(): Promise<{ newest: Run[]; last24h: number } | null> {
  if (!isBettingConfigured()) return null;
  const { data, error } = await betDb()
    .from('source_run')
    .select('source_key, status, rows_written, started_at, finished_at')
    .order('started_at', { ascending: false })
    .limit(300);
  if (error || !Array.isArray(data)) return null;
  const seen = new Map<string, Run>();
  let last24h = 0;
  const since = Date.now() - 86_400_000;
  for (const raw of data as Record<string, unknown>[]) {
    const run: Run = {
      source: String(raw.source_key),
      status: String(raw.status),
      rows: Number(raw.rows_written) || 0,
      started: raw.started_at == null ? null : String(raw.started_at),
      finished: raw.finished_at == null ? null : String(raw.finished_at),
    };
    if (run.started && new Date(run.started).getTime() >= since) last24h += 1;
    if (!seen.has(run.source)) seen.set(run.source, run);
  }
  return { newest: [...seen.values()].sort((a, b) => a.source.localeCompare(b.source)), last24h };
}

const runsTable = (newest: Run[]): DataTable => ({
  title: 'Loads · the newest run per source',
  cols: ['Source', 'Result', 'Rows', 'Finished'],
  rows: newest.map(r => [r.source, r.status, fmt(r.rows), day(r.finished ?? r.started)]),
});

type Partial = Pick<DataOverview, 'kpis' | 'series' | 'breakdowns'> & { note?: string; state?: DataState };

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
    return {
      kpis,
      series: null,
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
    const runs = await loadRuns();
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
    if (runs) {
      const ok = runs.newest.filter(r => r.status === 'ok').length;
      kpis.push({ label: 'Loads · 24h', value: fmt(runs.last24h) }, { label: 'Sources ok', value: `${ok} / ${runs.newest.length}` });
    }
    return {
      kpis,
      series: null,
      breakdowns: [
        { title: 'Tables · rows', cols: ['Table', 'Rows'], rows: tables.map(t => [t, c(t)]) },
        ...(runs ? [runsTable(runs.newest)] : []),
      ],
      note: runs ? undefined : 'The loader’s runs could not be read.',
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
      breakdowns: [],
    };
  },
  async push() {
    if (!present('KV_REST_API_URL') || !present('KV_REST_API_TOKEN')) {
      return { kpis: [{ label: 'Subscriptions', value: '—', note: 'the key-value store is not readable here' }], series: null, breakdowns: [], note: 'Sends are not recorded; a send is only a cron response.' };
    }
    const subs = await listSubscriptions();
    return {
      kpis: [
        { label: 'Subscriptions', value: fmt(subs.length) },
        { label: 'Sends recorded', value: 'no', note: 'a send is only a cron response' },
      ],
      series: null,
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
      breakdowns: [],
    };
  },
  async upstream() {
    const runs = await loadRuns();
    if (!runs) return { kpis: [{ label: 'Sources', value: '—' }], series: null, breakdowns: [], note: 'The loader’s runs could not be read.' };
    const ok = runs.newest.filter(r => r.status === 'ok').length;
    const failed = runs.newest.filter(r => r.status === 'failed').length;
    return {
      kpis: [
        { label: 'Sources ok', value: `${ok} / ${runs.newest.length}` },
        { label: 'Failed', value: fmt(failed) },
        { label: 'Loads · 24h', value: fmt(runs.last24h) },
      ],
      series: null,
      breakdowns: [runsTable(runs.newest)],
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
  } else if (state === 'connect') {
    value = { ...base, note: 'Not connected: the credentials named under Connection are not held by this Worker.' };
  }
  memo.set(key, { at: Date.now(), value });
  return value;
}
