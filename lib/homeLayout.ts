// Per-user home (/app) layout prefs: the order of the home's top-level blocks
// and which are hidden. Phase-1 customizes the three top-level blocks (the
// schedule + news pair stays coupled as one block on desktop). Reordering is
// applied via CSS `order` on a flex column, so the DEFAULT order renders the
// home byte-identically — only a user who customizes sees a change.
//
// Nav-item and series-tab customization are deferred (phase 2/3).

export const HOME_LAYOUT_VERSION = 7;

export type HomeElementId =
  | 'chyron'
  | 'just-missed'
  | 'schedule'
  | 'news'
  | 'from-the-blog'
  | 'championship-leader'
  | 'standings-snapshot'
  | 'series-countdowns'
  | 'series-just-missed'
  | 'track-layout'
  | 'threads'
  | 'bets'
  | 'latest-decoded';

export interface HomeElementMeta {
  id: HomeElementId;
  label: string;
  hint: string;
  /** Whether the block can be collapsed (body tucked behind its header). The
   *  live/next chyron is show-or-hide only — never collapsed. */
  collapsible: boolean;
}

// Single source of element ids + default order + labels. Adding an element later
// is a one-line change here; reconcile() lights it up for existing users (their
// stored order gets the new id appended).
export const HOME_ELEMENTS: HomeElementMeta[] = [
  { id: 'chyron', label: 'Live / up next', hint: 'The broadcast strip — live session or the next countdown.', collapsible: false },
  { id: 'just-missed', label: 'Just missed', hint: 'The latest results from your series.', collapsible: true },
  { id: 'schedule', label: 'This week', hint: 'This week’s sessions across your series.', collapsible: true },
  { id: 'news', label: 'News', hint: 'The Paddock wire — latest motorsport.com headlines.', collapsible: true },
  { id: 'from-the-blog', label: 'From the blog', hint: 'The latest Paddock long-reads and explainers.', collapsible: true },
  { id: 'championship-leader', label: 'Championship leader', hint: 'Who’s leading each series you follow, and by how much.', collapsible: true },
  { id: 'standings-snapshot', label: 'Standings snapshot', hint: 'The top of the table for one series, refreshed each round.', collapsible: true },
  { id: 'series-countdowns', label: 'Series countdowns', hint: 'A separate next-session countdown for each series you follow.', collapsible: true },
  { id: 'series-just-missed', label: 'Series results', hint: 'The latest result for each series you follow, split out by series.', collapsible: true },
  { id: 'track-layout', label: 'Circuit map', hint: 'The track layout for the next round you follow (F1 for now).', collapsible: true },
  { id: 'threads', label: 'Paddock chatter', hint: 'The newest approved community threads — tap in to read or reply.', collapsible: true },
  { id: 'bets', label: 'Your bets & credits', hint: 'Your open bets, credit balance and the next market closing. Signed-in only.', collapsible: true },
  { id: 'latest-decoded', label: 'Latest Decoded', hint: 'The most recent F1 qualifying + race, deep-linked to the Decoder and Race Story.', collapsible: true },
];

const ALL_IDS = HOME_ELEMENTS.map(e => e.id);
const COLLAPSIBLE_IDS = HOME_ELEMENTS.filter(e => e.collapsible).map(e => e.id) as string[];

// ── Widget-discovery catalogue (UI-only) ────────────────────────────────────
// Descriptors for the "More widgets" gallery on /settings/customize. These are
// NOT part of HomeLayoutPrefs and never touch DEFAULT_HOME_LAYOUT or the home
// render path — they're a forward-looking menu of blocks a user might add. Each
// `status: 'coming-soon'` card is display-only (no toggle wired). When one ships
// it graduates to HOME_ELEMENTS + the pref shape; until then this list is the
// single place to curate what's advertised. `icon` is the lucide export name;
// the page maps it to a component (keeps this module free of React imports).
export type WidgetStatus = 'live' | 'coming-soon';

export interface AvailableWidget {
  /** Stable key for React lists; matches a HomeElementId once it ships. */
  id: string;
  label: string;
  blurb: string;
  /** lucide-react export name, resolved to a component by the gallery. */
  icon: string;
  status: WidgetStatus;
}

// Empty for now — every advertised widget has shipped into HOME_ELEMENTS. New
// "coming soon" descriptors go here to re-light the gallery; WidgetGallery
// renders nothing while this is empty.
export const AVAILABLE_WIDGETS: AvailableWidget[] = [];

/** Per-widget settings (distinct from order/hidden/collapsed). Each widget reads
 *  only the fields that apply to it and clamps numeric values to its own range,
 *  so reconcile validates types + broad sane bounds only. */
export interface WidgetSettings {
  /** Row spacing — applies to any widget. */
  density?: 'comfortable' | 'compact';
  /** Item count — just-missed / news / from-the-blog / series-just-missed / series-countdowns. */
  count?: number;
  /** Days shown — schedule (this week). */
  days?: number;
  /** Chosen series slug — standings-snapshot. */
  series?: string;
  /** Top-N rows — standings-snapshot. */
  rows?: number;
  /** Series subset (slugs) — championship-leader. Absent = all followed. */
  seriesSet?: string[];
}

/** Per-widget settings keyed by widget id. */
export type HomeWidgetConfig = Partial<Record<HomeElementId, WidgetSettings>>;

/** Read one widget's settings (never null). */
export function widgetSettings(config: HomeWidgetConfig, id: HomeElementId): WidgetSettings {
  return config[id] ?? {};
}

export interface HomeLayoutPrefs {
  version: number;
  order: HomeElementId[];
  hidden: HomeElementId[];
  collapsed: HomeElementId[];
  config: HomeWidgetConfig;
}

// "Just missed" is collapsed by default (operator: home is busy — lead with
// what's next, tuck the retrospective behind one tap). Existing users with no
// stored `collapsed` field inherit this via reconcile().
export const DEFAULT_COLLAPSED: HomeElementId[] = ['just-missed'];

// Widgets that graduate from the gallery start HIDDEN — they're opt-in, not
// forced onto an existing home (the home is deliberately lean). reconcile()
// default-hides each of these the first time a user's stored prefs meet it (the
// id isn't yet in their `order`); once it's there, their show/hide choice wins.
export const DEFAULT_HIDDEN: HomeElementId[] = ['from-the-blog', 'championship-leader', 'standings-snapshot', 'series-countdowns', 'series-just-missed', 'track-layout', 'threads', 'bets', 'latest-decoded'];
const DEFAULT_HIDDEN_SET = new Set<HomeElementId>(DEFAULT_HIDDEN);

export const DEFAULT_HOME_LAYOUT: HomeLayoutPrefs = {
  version: HOME_LAYOUT_VERSION,
  order: [...ALL_IDS],
  hidden: [...DEFAULT_HIDDEN],
  collapsed: [...DEFAULT_COLLAPSED],
  config: {},
};

function isHomeElementId(x: unknown): x is HomeElementId {
  return typeof x === 'string' && (ALL_IDS as string[]).includes(x);
}

function dedupe(ids: HomeElementId[]): HomeElementId[] {
  const seen = new Set<HomeElementId>();
  const out: HomeElementId[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

// Per-widget settings: keep valid-typed fields within broad sane bounds (each
// widget clamps to its own range on read). Drops junk.
function sanitizeSettings(raw: unknown): WidgetSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const s: WidgetSettings = {};
  if (r.density === 'compact' || r.density === 'comfortable') s.density = r.density;
  if (typeof r.count === 'number' && r.count >= 1 && r.count <= 50) s.count = Math.round(r.count);
  if (typeof r.days === 'number' && r.days >= 1 && r.days <= 14) s.days = Math.round(r.days);
  if (typeof r.rows === 'number' && r.rows >= 1 && r.rows <= 30) s.rows = Math.round(r.rows);
  if (typeof r.series === 'string') s.series = r.series;
  if (Array.isArray(r.seriesSet) && r.seriesSet.every(x => typeof x === 'string')) {
    s.seriesSet = r.seriesSet as string[];
  }
  return s;
}

// Build the per-widget config map, and MIGRATE the pre-v6 flat `snapshotSeries`
// field into config['standings-snapshot'].series so existing users don't lose
// their snapshot pick across the schema change.
function reconcileConfig(stored: unknown): HomeWidgetConfig {
  const c = stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  const out: HomeWidgetConfig = {};
  for (const id of ALL_IDS) {
    const s = sanitizeSettings(c[id]);
    if (Object.keys(s).length > 0) out[id] = s;
  }
  const legacySnapshot = typeof c.snapshotSeries === 'string' ? c.snapshotSeries : undefined;
  if (legacySnapshot && !out['standings-snapshot']?.series) {
    out['standings-snapshot'] = { ...(out['standings-snapshot'] ?? {}), series: legacySnapshot };
  }
  return out;
}

/**
 * Reconcile stored prefs against the live registry: keep known ids in their
 * stored order, append any registry ids missing from `order` (so a newly shipped
 * element appears for existing users without a migration), and drop unknown /
 * renamed ids. `hidden` is filtered to known ids. Always returns a complete,
 * valid layout — the read path never trusts stored `order` to be exhaustive.
 */
export function reconcileHomeLayout(stored: Partial<HomeLayoutPrefs> | null | undefined): HomeLayoutPrefs {
  const storedOrder = Array.isArray(stored?.order) ? stored!.order.filter(isHomeElementId) : [];
  const order = dedupe(storedOrder);
  const hidden = Array.isArray(stored?.hidden) ? dedupe(stored!.hidden.filter(isHomeElementId)) : [];
  for (const id of ALL_IDS) {
    if (!order.includes(id)) {
      order.push(id);
      // An opt-in widget the user has never seen (absent from their stored
      // order) starts hidden, so a newly-shipped block never barges onto an
      // existing home. Their later show/hide sticks (the id is then in order).
      if (DEFAULT_HIDDEN_SET.has(id) && !hidden.includes(id)) hidden.push(id);
    }
  }
  // Absent `collapsed` (pre-v2 prefs) inherits the default-collapsed set; a present
  // array is honoured as-is, filtered to ids that are actually collapsible.
  const collapsed = Array.isArray(stored?.collapsed)
    ? dedupe(stored!.collapsed.filter(isHomeElementId)).filter(id => COLLAPSIBLE_IDS.includes(id))
    : [...DEFAULT_COLLAPSED];
  const config = reconcileConfig(stored?.config);
  return { version: HOME_LAYOUT_VERSION, order, hidden, collapsed, config };
}

/** Validate + normalize an API payload; null when the shape is wrong. */
export function parseHomeLayout(body: unknown): HomeLayoutPrefs | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.order !== undefined && !Array.isArray(b.order)) return null;
  if (b.hidden !== undefined && !Array.isArray(b.hidden)) return null;
  if (b.collapsed !== undefined && !Array.isArray(b.collapsed)) return null;
  if (b.config !== undefined && (typeof b.config !== 'object' || Array.isArray(b.config))) return null;
  return reconcileHomeLayout(b as Partial<HomeLayoutPrefs>);
}

// ── localStorage (signed-out fallback, mirrors lib/follow.ts) ───────────────
const LS_KEY = 'paddock:home-layout';

export function getLocalHomeLayout(): HomeLayoutPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return reconcileHomeLayout(JSON.parse(raw) as Partial<HomeLayoutPrefs>);
  } catch {
    return null;
  }
}

export function setLocalHomeLayout(prefs: HomeLayoutPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / disabled — best effort */
  }
}
