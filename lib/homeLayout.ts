// Per-user home (/app) layout prefs: the order of the home's top-level blocks
// and which are hidden. Phase-1 customizes the three top-level blocks (the
// schedule + news pair stays coupled as one block on desktop). Reordering is
// applied via CSS `order` on a flex column, so the DEFAULT order renders the
// home byte-identically — only a user who customizes sees a change.
//
// Nav-item and series-tab customization are deferred (phase 2/3).

export const HOME_LAYOUT_VERSION = 2;

export type HomeElementId = 'chyron' | 'just-missed' | 'schedule';

export interface HomeElementMeta {
  id: HomeElementId;
  label: string;
  hint: string;
  /** Whether the block can be collapsed (body tucked behind its header). The
   *  live/next chyron is show-or-hide only — never collapsed. */
  collapsible: boolean;
}

// Single source of element ids + default order + labels. Adding an element later
// is a one-line change here; reconcile() lights it up for existing users.
export const HOME_ELEMENTS: HomeElementMeta[] = [
  { id: 'chyron', label: 'Live / up next', hint: 'The broadcast strip — live session or the next countdown.', collapsible: false },
  { id: 'just-missed', label: 'Just missed', hint: 'The latest results from your series.', collapsible: true },
  { id: 'schedule', label: 'Schedule & news', hint: 'This week’s sessions and the Paddock wire.', collapsible: false },
];

const ALL_IDS = HOME_ELEMENTS.map(e => e.id);
const COLLAPSIBLE_IDS = HOME_ELEMENTS.filter(e => e.collapsible).map(e => e.id) as string[];

export interface HomeLayoutPrefs {
  version: number;
  order: HomeElementId[];
  hidden: HomeElementId[];
  collapsed: HomeElementId[];
}

// "Just missed" is collapsed by default (operator: home is busy — lead with
// what's next, tuck the retrospective behind one tap). Existing users with no
// stored `collapsed` field inherit this via reconcile().
export const DEFAULT_COLLAPSED: HomeElementId[] = ['just-missed'];

export const DEFAULT_HOME_LAYOUT: HomeLayoutPrefs = {
  version: HOME_LAYOUT_VERSION,
  order: [...ALL_IDS],
  hidden: [],
  collapsed: [...DEFAULT_COLLAPSED],
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
  for (const id of ALL_IDS) {
    if (!order.includes(id)) order.push(id);
  }
  const hidden = Array.isArray(stored?.hidden) ? dedupe(stored!.hidden.filter(isHomeElementId)) : [];
  // Absent `collapsed` (pre-v2 prefs) inherits the default-collapsed set; a present
  // array is honoured as-is, filtered to ids that are actually collapsible.
  const collapsed = Array.isArray(stored?.collapsed)
    ? dedupe(stored!.collapsed.filter(isHomeElementId)).filter(id => COLLAPSIBLE_IDS.includes(id))
    : [...DEFAULT_COLLAPSED];
  return { version: HOME_LAYOUT_VERSION, order, hidden, collapsed };
}

/** Validate + normalize an API payload; null when the shape is wrong. */
export function parseHomeLayout(body: unknown): HomeLayoutPrefs | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.order !== undefined && !Array.isArray(b.order)) return null;
  if (b.hidden !== undefined && !Array.isArray(b.hidden)) return null;
  if (b.collapsed !== undefined && !Array.isArray(b.collapsed)) return null;
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
