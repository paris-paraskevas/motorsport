import { betDb, isBettingConfigured } from '@/lib/betting/client';

// Anonymous element-relative click + impression heatmap, backed by the Postgres
// `heatmap_event` table (rebuild of the old KV 24x24 viewport-grid model, which
// could not name WHICH element got clicks, mixed breakpoints, and ignored scroll).
// One row per raw event; the `heatmap_element_stats` view aggregates them so the
// /admin panel can rank HOT elements (most clicks) and DEAD elements (seen but
// never clicked — the wasted-space / sponsorship signal). NO PII: only a same-site
// path, an element id / compact selector, and a coarse in-element ratio.
//
// FAIL-SOFT everywhere. Capture (recordEvents) and the reads (rankedElements /
// heatmapAdminOverview) must never throw into the caller and must tolerate the
// table/view not yet existing on prod — this module ships BEFORE the migration is
// applied, in which case capture no-ops and the admin shows its empty state.
// `betDb()` is the shared service-role Supabase client (named for betting but used
// by every server table); RLS-on + no-policies means only it can touch the table.

/** Accept only clean same-site app paths: strip query/hash, lowercase, cap length,
 *  whitelist chars. Returns null for anything else (prevents unbounded/garbage rows
 *  from arbitrary client input). */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let p = raw.split('?')[0].split('#')[0].trim().toLowerCase();
  if (!p.startsWith('/')) return null;
  if (p.length > 1) p = p.replace(/\/+$/, ''); // drop trailing slash (keep bare "/")
  if (p.length > 80 || !/^\/[a-z0-9/_-]*$/.test(p)) return null;
  return p || '/';
}

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';
export type EventKind = 'click' | 'impression' | 'scroll' | 'rage' | 'dead';
export type Pointer = 'mouse' | 'touch';
// Anonymous per-pageview segments: entry source + new/returning.
export type Source = 'direct' | 'organic' | 'referral' | 'campaign' | 'internal';
export type Visitor = 'new' | 'returning';

export interface HeatmapEvent {
  path: string;
  kind: EventKind;
  elementId?: string;
  selector?: string;
  relX?: number;
  relY?: number;
  value?: number; // scroll depth 0..1 (kind='scroll')
  breakpoint: Breakpoint;
  viewportW?: number;
  viewportH?: number;
  pointer?: Pointer;
  source?: Source;
  visitor?: Visitor;
}

// Shared read filters for the /admin heatmap: a breakpoint, a segment (source /
// visitor) and a created_at date window. All optional — unset means "all".
export interface HeatmapReadOpts {
  breakpoint?: Breakpoint;
  source?: Source;
  visitor?: Visitor;
  from?: string;
  to?: string;
}

export interface ElementRank {
  elementId: string;
  clicks: number;
  impressions: number;
  ctr: number; // clicks / impressions when impressions > 0, else 0
}

const BREAKPOINTS = new Set<string>(['mobile', 'tablet', 'desktop']);
const KINDS = new Set<string>(['click', 'impression', 'scroll', 'rage', 'dead']);
const POINTERS = new Set<string>(['mouse', 'touch']);
const SOURCES = new Set<string>(['direct', 'organic', 'referral', 'campaign', 'internal']);
const VISITORS = new Set<string>(['new', 'returning']);
const MAX_EVENTS = 250; // per-batch cap (well under sendBeacon's 64 KiB)
const ELEMENT_ID_MAX = 128;
const SELECTOR_MAX = 200;
const SMALLINT_MAX = 32767; // Postgres smallint upper bound for viewport dims

function clampRatio(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(1, n));
}

function clampDim(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  const r = Math.round(n);
  return r >= 0 && r <= SMALLINT_MAX ? r : undefined;
}

function capString(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s.slice(0, max) : undefined;
}

/**
 * Validate + clamp a raw client envelope `{ path, breakpoint, viewportW, viewportH,
 * pointer, events: [{ kind, elementId?, selector?, relX?, relY? }] }` into row-shaped
 * HeatmapEvents. Drops the whole batch on a bad path/breakpoint; drops individual
 * events with a bad kind or that identify nothing (no elementId AND no selector);
 * clamps ratios to 0..1, viewport dims to a smallint, caps strings, and caps the
 * batch to MAX_EVENTS. Lives here (not in the route) so it is unit-testable offline.
 */
export function sanitizeEvents(envelope: unknown): HeatmapEvent[] {
  if (!envelope || typeof envelope !== 'object') return [];
  const env = envelope as Record<string, unknown>;
  const path = normalizePath(env.path);
  const bp = env.breakpoint;
  if (!path || typeof bp !== 'string' || !BREAKPOINTS.has(bp)) return [];
  if (!Array.isArray(env.events)) return [];

  const breakpoint = bp as Breakpoint;
  const viewportW = clampDim(env.viewportW);
  const viewportH = clampDim(env.viewportH);
  const pointer =
    typeof env.pointer === 'string' && POINTERS.has(env.pointer) ? (env.pointer as Pointer) : undefined;
  const source = typeof env.source === 'string' && SOURCES.has(env.source) ? (env.source as Source) : undefined;
  const visitor = typeof env.visitor === 'string' && VISITORS.has(env.visitor) ? (env.visitor as Visitor) : undefined;

  const out: HeatmapEvent[] = [];
  for (const raw of env.events.slice(0, MAX_EVENTS)) {
    if (!raw || typeof raw !== 'object') continue;
    const ev = raw as Record<string, unknown>;
    if (typeof ev.kind !== 'string' || !KINDS.has(ev.kind)) continue;
    const kind = ev.kind as EventKind;
    if (kind === 'scroll') {
      // A scroll reading identifies the PATH, not an element: it needs a depth
      // value, not an anchor. Everything else falls through to the element path.
      const value = clampRatio(ev.value);
      if (value === undefined) continue;
      out.push({ path, kind, value, breakpoint, viewportW, viewportH, pointer, source, visitor });
      continue;
    }
    const elementId = capString(ev.elementId, ELEMENT_ID_MAX);
    const selector = capString(ev.selector, SELECTOR_MAX);
    if (!elementId && !selector) continue; // click / rage / dead must identify something
    out.push({
      path,
      kind,
      elementId,
      selector,
      relX: clampRatio(ev.relX),
      relY: clampRatio(ev.relY),
      breakpoint,
      viewportW,
      viewportH,
      pointer,
      source,
      visitor,
    });
  }
  return out;
}

/**
 * Bulk-insert a batch of already-sanitized events. Fail-soft: no-op when Supabase
 * is unconfigured, and both a returned `{ error }` (e.g. the table isn't applied on
 * prod yet) and any thrown error are swallowed — capture is best-effort and must
 * never surface to the ingest path.
 */
export async function recordEvents(events: HeatmapEvent[]): Promise<void> {
  if (!isBettingConfigured()) return;
  if (!Array.isArray(events) || events.length === 0) return;
  const rows = events.map(e => ({
    path: e.path,
    kind: e.kind,
    element_id: e.elementId ?? null,
    selector: e.selector ?? null,
    rel_x: e.relX ?? null,
    rel_y: e.relY ?? null,
    value: e.value ?? null,
    breakpoint: e.breakpoint,
    viewport_w: e.viewportW ?? null,
    viewport_h: e.viewportH ?? null,
    pointer: e.pointer ?? null,
    source: e.source ?? null,
    visitor: e.visitor ?? null,
  }));
  try {
    const { error } = await betDb().from('heatmap_event').insert(rows);
    if (!error) return;
    // A pending migration (a new kind OR a new column — value/source/visitor)
    // fails the whole batch atomically. Retry with ONLY the original (#544)
    // columns + legacy kinds, so click/impression capture never regresses while
    // any later migration is still pending.
    const core = events
      .filter(e => e.kind === 'click' || e.kind === 'impression')
      .map(e => ({
        path: e.path,
        kind: e.kind,
        element_id: e.elementId ?? null,
        selector: e.selector ?? null,
        rel_x: e.relX ?? null,
        rel_y: e.relY ?? null,
        breakpoint: e.breakpoint,
        viewport_w: e.viewportW ?? null,
        viewport_h: e.viewportH ?? null,
        pointer: e.pointer ?? null,
      }));
    if (core.length > 0) await betDb().from('heatmap_event').insert(core);
  } catch {
    // Supabase unreachable — never break the ingest path.
  }
}

interface StatRow {
  element_id: string | null;
  clicks: number | null;
  impressions: number | null;
}

/** Split raw stat rows (already scoped to one path[/breakpoint]) into hot/dead lists.
 *  Rows are aggregated by element id first, so the same id spanning breakpoints (when
 *  no breakpoint filter is applied) collapses into one rank. */
function splitRanks(rows: StatRow[], deadMinImpressions: number): { hot: ElementRank[]; dead: ElementRank[] } {
  const byId = new Map<string, { clicks: number; impressions: number }>();
  for (const r of rows) {
    const id = r.element_id;
    if (!id) continue;
    const prev = byId.get(id) ?? { clicks: 0, impressions: 0 };
    byId.set(id, {
      clicks: prev.clicks + (Number(r.clicks) || 0),
      impressions: prev.impressions + (Number(r.impressions) || 0),
    });
  }
  const ranks: ElementRank[] = [...byId.entries()].map(([elementId, v]) => ({
    elementId,
    clicks: v.clicks,
    impressions: v.impressions,
    ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
  }));
  const hot = ranks.filter(r => r.clicks > 0).sort((a, b) => b.clicks - a.clicks);
  const dead = ranks
    .filter(r => r.clicks === 0 && r.impressions >= deadMinImpressions)
    .sort((a, b) => b.impressions - a.impressions);
  return { hot, dead };
}

/**
 * Ranked hot/dead elements for one path (optionally scoped to a breakpoint).
 * Fail-soft to `{ hot: [], dead: [] }` when unconfigured, the path is invalid, or
 * the view read errors/throws. `deadMinImpressions` (default 20) is the minimum
 * impressions before a never-clicked element counts as a dead zone.
 */
export async function rankedElements(
  rawPath: string,
  opts: { breakpoint?: Breakpoint; deadMinImpressions?: number } = {},
): Promise<{ hot: ElementRank[]; dead: ElementRank[] }> {
  const empty = { hot: [] as ElementRank[], dead: [] as ElementRank[] };
  if (!isBettingConfigured()) return empty;
  const path = normalizePath(rawPath);
  if (!path) return empty;
  const deadMin = opts.deadMinImpressions ?? 20;
  try {
    let query = betDb()
      .from('heatmap_element_stats')
      .select('element_id, clicks, impressions')
      .eq('path', path);
    if (opts.breakpoint) query = query.eq('breakpoint', opts.breakpoint);
    const { data, error } = await query;
    if (error || !data) return empty;
    return splitRanks(data as StatRow[], deadMin);
  } catch {
    return empty;
  }
}

export interface HeatmapPathPanel {
  path: string;
  total: number; // total clicks across the shown breakpoints (sort key + KPI)
  breakpoints: { breakpoint: Breakpoint; hot: ElementRank[]; dead: ElementRank[] }[];
}

interface OverviewRow extends StatRow {
  path: string;
  breakpoint: string;
}

/**
 * One-query overview for /admin: every tracked path, each broken down by breakpoint
 * into hot/dead lists. Fail-soft to `[]`. Enumerates paths itself (the per-path
 * `rankedElements` cannot), so the admin needs no separate path-listing call.
 * Paths are ordered by total clicks; empty when there is no data (or pre-migration).
 */
export async function heatmapAdminOverview(
  opts: { deadMinImpressions?: number; maxPaths?: number } = {},
): Promise<HeatmapPathPanel[]> {
  if (!isBettingConfigured()) return [];
  const deadMin = opts.deadMinImpressions ?? 20;
  const maxPaths = opts.maxPaths ?? 8;
  try {
    const { data, error } = await betDb()
      .from('heatmap_element_stats')
      .select('path, breakpoint, element_id, clicks, impressions');
    if (error || !data) return [];
    const rows = data as OverviewRow[];

    // Group rows by path, then by breakpoint.
    const byPath = new Map<string, Map<Breakpoint, StatRow[]>>();
    for (const r of rows) {
      if (!r.path || typeof r.breakpoint !== 'string' || !BREAKPOINTS.has(r.breakpoint)) continue;
      const bp = r.breakpoint as Breakpoint;
      let bpMap = byPath.get(r.path);
      if (!bpMap) {
        bpMap = new Map();
        byPath.set(r.path, bpMap);
      }
      const list = bpMap.get(bp) ?? [];
      list.push(r);
      bpMap.set(bp, list);
    }

    const order: Breakpoint[] = ['mobile', 'tablet', 'desktop'];
    const panels: HeatmapPathPanel[] = [];
    for (const [path, bpMap] of byPath) {
      const breakpoints: HeatmapPathPanel['breakpoints'] = [];
      let total = 0;
      for (const bp of order) {
        const list = bpMap.get(bp);
        if (!list) continue;
        const { hot, dead } = splitRanks(list, deadMin);
        if (hot.length === 0 && dead.length === 0) continue;
        total += hot.reduce((s, r) => s + r.clicks, 0);
        breakpoints.push({ breakpoint: bp, hot, dead });
      }
      if (breakpoints.length > 0) panels.push({ path, total, breakpoints });
    }
    panels.sort((a, b) => b.total - a.total);
    return panels.slice(0, maxPaths);
  } catch {
    return [];
  }
}

export interface ClickPoint {
  elementId?: string; // data-heatmap-id anchor (preferred), else undefined
  selector?: string; // re-resolvable CSS path when there's no elementId
  relX: number; // bucketed 0..1 ratio within the anchor element
  relY: number;
  weight: number; // number of clicks collapsed into this bucket
}

// Coarse grid for bucketing in-element click ratios: many clicks on the same spot
// collapse into one weighted point, capping the overlay payload. 1/50 per axis.
const POINT_BUCKETS = 50;

/**
 * Positioned click points for one path (optionally a breakpoint / date window),
 * for the /admin overlay. Reads the raw `heatmap_event` table — the stats view
 * drops both rel coords AND selector-only (untagged) clicks — keeps click rows
 * carrying an in-element ratio, and buckets them per anchor (element_id OR
 * selector) onto a coarse grid. Each point keeps its anchor so the overlay can
 * RE-RESOLVE it on the live page and position the blob precisely. Fail-soft [].
 * NOTE: reads up to a row cap and buckets in JS — fine at current volume; Phase 3
 * moves range/segment aggregation into a Postgres RPC for scale.
 */
export async function clickPoints(
  rawPath: string,
  opts: HeatmapReadOpts & { limit?: number } = {},
): Promise<ClickPoint[]> {
  if (!isBettingConfigured()) return [];
  const path = normalizePath(rawPath);
  if (!path) return [];
  try {
    let query = betDb()
      .from('heatmap_event')
      .select('element_id, selector, rel_x, rel_y')
      .eq('path', path)
      .eq('kind', 'click')
      .not('rel_x', 'is', null)
      .not('rel_y', 'is', null);
    if (opts.breakpoint) query = query.eq('breakpoint', opts.breakpoint);
    if (opts.source) query = query.eq('source', opts.source);
    if (opts.visitor) query = query.eq('visitor', opts.visitor);
    if (opts.from) query = query.gte('created_at', opts.from);
    if (opts.to) query = query.lte('created_at', opts.to);
    query = query.order('created_at', { ascending: false }).limit(opts.limit ?? 2000);
    const { data, error } = await query;
    if (error || !data) return [];
    return bucketClickPoints(data as RawClickRow[]);
  } catch {
    return [];
  }
}

interface RawClickRow {
  element_id: string | null;
  selector: string | null;
  rel_x: number | null;
  rel_y: number | null;
}

/**
 * Pure bucketer (extracted for unit testing): collapse raw click rows onto the
 * coarse in-element grid — one weighted ClickPoint per (anchor, cell). An
 * `element_id` anchor wins over a `selector`; rows without an anchor or a numeric
 * ratio are dropped; out-of-range ratios clamp into 0..1.
 */
export function bucketClickPoints(rows: RawClickRow[]): ClickPoint[] {
  const buckets = new Map<string, ClickPoint>();
  for (const r of rows) {
    const elementId = r.element_id ?? undefined;
    const selector = elementId ? undefined : r.selector ?? undefined;
    if ((!elementId && !selector) || typeof r.rel_x !== 'number' || typeof r.rel_y !== 'number') continue;
    const bx = Math.round(Math.max(0, Math.min(1, r.rel_x)) * POINT_BUCKETS) / POINT_BUCKETS;
    const by = Math.round(Math.max(0, Math.min(1, r.rel_y)) * POINT_BUCKETS) / POINT_BUCKETS;
    const key = `${elementId ?? ''}|${selector ?? ''}|${bx}|${by}`;
    const prev = buckets.get(key);
    if (prev) prev.weight += 1;
    else buckets.set(key, { elementId, selector, relX: bx, relY: by, weight: 1 });
  }
  return [...buckets.values()];
}

// ── Phase 2 signals: scroll depth + rage/dead-click frustration ──────────────

export interface ScrollStats {
  sample: number; // number of scroll readings
  reached: number[]; // reached[i] = fraction (0..1) who scrolled to >= (i+1)*10%
}

/** Pure: turn a list of per-pageview max-scroll depths (0..1) into a reach curve —
 *  reached[i] is the fraction who got at least (i+1)*10% down the page. */
export function bucketScrollDepths(values: number[]): ScrollStats {
  const sample = values.length;
  const reached: number[] = [];
  for (let i = 1; i <= 10; i++) {
    const threshold = i / 10 - 1e-9;
    reached.push(sample === 0 ? 0 : values.filter(v => v >= threshold).length / sample);
  }
  return { sample, reached };
}

/**
 * Scroll-depth reach curve for one path (optionally a breakpoint), for the /admin
 * overlay's scroll mode. Reads raw 'scroll' events (each a pageview's furthest
 * depth) and buckets them into the reach curve. Fail-soft to an empty curve.
 */
export async function scrollStats(
  rawPath: string,
  opts: HeatmapReadOpts = {},
): Promise<ScrollStats> {
  const empty = bucketScrollDepths([]);
  if (!isBettingConfigured()) return empty;
  const path = normalizePath(rawPath);
  if (!path) return empty;
  try {
    let query = betDb()
      .from('heatmap_event')
      .select('value')
      .eq('path', path)
      .eq('kind', 'scroll')
      .not('value', 'is', null);
    if (opts.breakpoint) query = query.eq('breakpoint', opts.breakpoint);
    if (opts.source) query = query.eq('source', opts.source);
    if (opts.visitor) query = query.eq('visitor', opts.visitor);
    if (opts.from) query = query.gte('created_at', opts.from);
    if (opts.to) query = query.lte('created_at', opts.to);
    const { data, error } = await query.limit(5000);
    if (error || !data) return empty;
    const values = (data as { value: number | null }[])
      .map(r => r.value)
      .filter((v): v is number => typeof v === 'number');
    return bucketScrollDepths(values);
  } catch {
    return empty;
  }
}

export interface FrustrationItem {
  anchor: string; // element_id (preferred) or selector
  count: number;
}
export interface FrustrationSignals {
  rage: FrustrationItem[]; // rapid repeat-clicks in one spot
  dead: FrustrationItem[]; // clicks on non-interactive space
}

interface FrustrationRow {
  kind: string;
  element_id: string | null;
  selector: string | null;
}

/** Pure: tally rage + dead rows per anchor (element_id ?? selector), each list
 *  sorted by count desc. */
export function aggregateFrustration(rows: FrustrationRow[]): FrustrationSignals {
  const tally = (kind: string): FrustrationItem[] => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.kind !== kind) continue;
      const anchor = r.element_id ?? r.selector;
      if (!anchor) continue;
      m.set(anchor, (m.get(anchor) ?? 0) + 1);
    }
    return [...m.entries()].map(([anchor, count]) => ({ anchor, count })).sort((a, b) => b.count - a.count);
  };
  return { rage: tally('rage'), dead: tally('dead') };
}

/**
 * Rage + dead-click tallies for one path (optionally a breakpoint), for the
 * /admin frustration lists. Reads raw 'rage'/'dead' rows and aggregates per
 * anchor. Fail-soft to empty lists.
 */
export async function frustrationSignals(
  rawPath: string,
  opts: HeatmapReadOpts = {},
): Promise<FrustrationSignals> {
  const empty: FrustrationSignals = { rage: [], dead: [] };
  if (!isBettingConfigured()) return empty;
  const path = normalizePath(rawPath);
  if (!path) return empty;
  try {
    let query = betDb()
      .from('heatmap_event')
      .select('kind, element_id, selector')
      .eq('path', path)
      .in('kind', ['rage', 'dead']);
    if (opts.breakpoint) query = query.eq('breakpoint', opts.breakpoint);
    if (opts.source) query = query.eq('source', opts.source);
    if (opts.visitor) query = query.eq('visitor', opts.visitor);
    if (opts.from) query = query.gte('created_at', opts.from);
    if (opts.to) query = query.lte('created_at', opts.to);
    const { data, error } = await query.limit(5000);
    if (error || !data) return empty;
    return aggregateFrustration(data as FrustrationRow[]);
  } catch {
    return empty;
  }
}

// Everything the /admin overlay shows for one path+breakpoint, in one call: the
// click points, the scroll reach curve, and the rage/dead frustration tallies.
export interface OverlayData {
  clicks: ClickPoint[];
  scroll: ScrollStats;
  rage: FrustrationItem[];
  dead: FrustrationItem[];
}

export async function overlayData(
  path: string,
  opts: HeatmapReadOpts = {},
): Promise<OverlayData> {
  const [clicks, scroll, frustration] = await Promise.all([
    clickPoints(path, opts),
    scrollStats(path, opts),
    frustrationSignals(path, opts),
  ]);
  return { clicks, scroll, rage: frustration.rage, dead: frustration.dead };
}
