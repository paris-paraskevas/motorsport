// The URL vocabulary of a Data region (P2.3; APEX: the Interactive Report's request syntax and its saved reports' links): what
// a reader's address may say about a table — `sort`, `cols`, `filter`, `view` — read leniently, bound to a shape, written
// canonically so one state is one cached variant, and the middleware's rule that serves a page carrying a state from its
// variant path. Client- and edge-safe: no server module, no React; the registry is import-pure.
import type { ColumnType, PresetColumn, Shape } from './presets';
import { CODE_PAGES } from './page-registry';

export type FilterOp = 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | 'in';
export interface ViewFilter {
  column: string;
  op: FilterOp;
  value: string;
}
export interface ViewState {
  sort?: { column: string; desc: boolean };
  /** The columns shown, an allow-list; absent draws the shape's own. */
  cols?: string[];
  filters: ViewFilter[];
  /** A saved view's key (PR B resolves it); carried as it is. */
  view?: string;
}
export const EMPTY_VIEW: ViewState = { filters: [] };
export const VIEW_KEYS = ['sort', 'cols', 'filter', 'view'] as const;
/** The variant path a page carrying a state is served from: `/__view/<state>/<path>`; no page can own it. */
export const VIEW_PREFIX = '/__view';
export const FILTERS_MAX = 4;
export const VALUE_MAX = 80;
/** The columns an allow-list may name; the widest shape has thirteen. */
export const COLS_MAX = 24;
/** The regions one address may carry a state for; a document with more draws its extra regions plain. */
export const PREFIXES_MAX = 6;
/** The longest canonical query the middleware turns into a variant; a longer one serves the plain page (the reviewer's cap on
 *  what a crafted address can mint into the cache). A full legitimate state — a sort, a dozen columns, four long filters, a
 *  view key — stays under 700. */
export const CANONICAL_MAX = 1024;
const OPS: readonly FilterOp[] = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in'];
const COLUMN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const VIEW_KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** A region's keys when a document holds several regions with controls: `r.<id>.sort`. */
const REGION_KEY = /^r\.([A-Za-z0-9][A-Za-z0-9_-]{0,79})\.(sort|cols|filter|view)$/;
const NUMERIC: ReadonlySet<ColumnType> = new Set(['number', 'position', 'percent', 'gap']);

export function isEmptyView(v: ViewState): boolean {
  return v.sort === undefined && (v.cols === undefined || v.cols.length === 0) && v.filters.length === 0 && v.view === undefined;
}

const params = (query: string | URLSearchParams): URLSearchParams => (typeof query === 'string' ? new URLSearchParams(query.startsWith('?') ? query.slice(1) : query) : query);

/** One condition as the vocabulary writes it — `column.op:value`, eq implicit — or the problem as text; the filters of an
 *  address and a region’s highlight rules (P2.4) read the same words. */
export function parseRule(raw: string): ViewFilter | string {
  const at = raw.indexOf(':');
  if (at < 0) return `filter is column.op:value: ${raw}`;
  const left = raw.slice(0, at);
  const value = raw.slice(at + 1);
  const dot = left.lastIndexOf('.');
  const column = dot < 0 ? left : left.slice(0, dot);
  const op = dot < 0 ? 'eq' : left.slice(dot + 1);
  if (!COLUMN.test(column)) return `filter names no column: ${raw}`;
  if (!(OPS as readonly string[]).includes(op)) return `filter has no such operator: ${raw}`;
  if (value === '') return `filter has no value: ${raw}`;
  if (value.length > VALUE_MAX) return `filter value over ${VALUE_MAX} characters: ${column}`;
  return { column, op: op as FilterOp, value };
}

/** One region's state as the address carries it (its keys under `prefix`, '' the bare ones): syntactic only, a malformed
 *  value dropped with a problem, an unknown key ignored (a reader's URL is not the writer's). */
export function parseViewState(query: string | URLSearchParams, prefix = ''): { value: ViewState; problems: string[] } {
  const q = params(query);
  const problems: string[] = [];
  const value: ViewState = { filters: [] };
  const sort = q.get(`${prefix}sort`);
  if (sort !== null) {
    const desc = sort.startsWith('-');
    const column = desc ? sort.slice(1) : sort;
    if (COLUMN.test(column)) value.sort = { column, desc };
    else problems.push(`sort names no column: ${sort}`);
  }
  if (q.has(`${prefix}cols`)) {
    const cols = [...new Set(q.getAll(`${prefix}cols`).flatMap(v => v.split(',')).map(v => v.trim()).filter(c => COLUMN.test(c)))];
    if (cols.length > COLS_MAX) problems.push(`cols beyond the ${COLS_MAX} allowed`);
    if (cols.length > 0) value.cols = cols.slice(0, COLS_MAX);
    else problems.push('cols names no column');
  }
  for (const raw of q.getAll(`${prefix}filter`)) {
    const f = parseRule(raw);
    if (typeof f === 'string') problems.push(f);
    else if (value.filters.length >= FILTERS_MAX) problems.push(`filter beyond the ${FILTERS_MAX} allowed: ${raw}`);
    else value.filters.push(f);
  }
  const view = q.get(`${prefix}view`);
  if (view !== null) {
    if (VIEW_KEY.test(view)) value.view = view;
    else problems.push(`view is not a key: ${view}`);
  }
  return { value, problems };
}

/** The operators a column's type honours: every one on a number, a position, a percent or a gap; equality and `in` on text,
 *  a badge, a link or a date; none on a picture. */
export function filterOps(c: PresetColumn): readonly FilterOp[] {
  if (c.type === 'image') return [];
  return NUMERIC.has(c.type) ? OPS : ['eq', 'ne', 'in'];
}
/** Whether a column's heading may sort: a picture and the share bar cannot. */
export const sortable = (c: PresetColumn): boolean => c.type !== 'image' && c.type !== 'percent';

/** A state against a shape: the sort on a sortable column, the columns within the shape (at least one), a filter's operator
 *  by its column's type; anything else dropped silently. */
export function bindViewState(state: ViewState, shape: Shape): ViewState {
  const out: ViewState = { filters: [] };
  const column = (key: string) => shape.columns.find(c => c.key === key);
  if (state.sort) {
    const c = column(state.sort.column);
    if (c && sortable(c)) out.sort = state.sort;
  }
  if (state.cols) {
    const cols = state.cols.filter(k => column(k) !== undefined);
    if (cols.length > 0) out.cols = cols;
  }
  out.filters = state.filters.filter(f => {
    const c = column(f.column);
    return c !== undefined && filterOps(c).includes(f.op);
  });
  if (state.view !== undefined) out.view = state.view;
  return out;
}

const canonicalFilters = (filters: readonly ViewFilter[]) => [...filters].sort((a, b) => a.column.localeCompare(b.column) || a.op.localeCompare(b.op) || a.value.localeCompare(b.value));

/** One canonical string per state — sort, cols, the filters sorted, view, under the region's prefix — so one state is one
 *  cached variant; '' for nothing. */
export function encodeViewState(state: ViewState, prefix = ''): string {
  const q = new URLSearchParams();
  if (state.sort) q.set(`${prefix}sort`, `${state.sort.desc ? '-' : ''}${state.sort.column}`);
  // The columns in one order whatever the address said: the shape's order draws them, so the order carries nothing.
  if (state.cols && state.cols.length > 0) q.set(`${prefix}cols`, [...state.cols].sort().join(','));
  for (const f of canonicalFilters(state.filters)) q.append(`${prefix}filter`, `${f.column}.${f.op}:${f.value}`);
  if (state.view !== undefined) q.set(`${prefix}view`, state.view);
  return q.toString();
}

/** The states an address carries, by region prefix ('' the bare one), each canonical; a prefix with nothing to say is left out. */
function groupsOf(search: string | URLSearchParams): Map<string, string> {
  const q = params(search);
  const prefixes = new Set<string>();
  for (const k of q.keys()) {
    if ((VIEW_KEYS as readonly string[]).includes(k)) prefixes.add('');
    else {
      const m = REGION_KEY.exec(k);
      if (m) prefixes.add(`r.${m[1]}.`);
    }
  }
  const out = new Map<string, string>();
  for (const p of [...prefixes].sort().slice(0, PREFIXES_MAX)) {
    const s = encodeViewState(parseViewState(q, p).value, p);
    if (s) out.set(p, s);
  }
  return out;
}

/** Every state an address carries as one canonical query string ('' for none): the bare state first, then the regions' by prefix. */
export function canonicalQuery(search: string | URLSearchParams): string {
  return [...groupsOf(search).values()].join('&');
}

/** The canonical parameters of every region but `except`, as a GET form's hidden inputs carry them. */
export function stateEntries(search: string | URLSearchParams, except: string): [string, string][] {
  const out: [string, string][] = [];
  for (const [p, s] of groupsOf(search)) if (p !== except) out.push(...new URLSearchParams(s).entries());
  return out;
}

/** The address for one region's next state: its keys replaced by `state` (or dropped when empty), every other region's kept
 *  as `others` (the address's query) carries them; the path alone when nothing is left. */
export function viewStateHref(path: string, state: ViewState, prefix = '', others = ''): string {
  const g = groupsOf(others);
  const own = encodeViewState(state, prefix);
  if (own) g.set(prefix, own);
  else g.delete(prefix);
  const s = [...g.keys()]
    .sort()
    .map(k => g.get(k)!)
    .join('&');
  return s ? `${path}?${s}` : path;
}

/** A heading's link: none → ascending → descending → none on its column, the rest of the state kept. */
export function sortHref(path: string, state: ViewState, column: string, prefix = '', others = ''): string {
  const current = state.sort?.column === column ? state.sort : undefined;
  const next: ViewState = { ...state };
  if (!current) next.sort = { column, desc: false };
  else if (!current.desc) next.sort = { column, desc: true };
  else delete next.sort;
  return viewStateHref(path, next, prefix, others);
}

// The middleware's rule. A page the code serves keeps its own query string (Home, the compare tool, a series page and its
// tabs); a row or composed page the catch-all serves is rewritten; the reserved parts of the site never are.
const EXCLUDED = ['/api', '/media', '/admin', '/preview', '/_next', '/serwist', '/sign-in', '/sign-up', VIEW_PREFIX];
const segments = (path: string): string[] => (path === '/' ? [] : path.replace(/\/$/, '').split('/').slice(1));
const CODE_SERVED: readonly string[][] = CODE_PAGES.filter(p => p.served !== 'rows').map(p => segments(p.path));

/** Whether a route file serves the path today: the registry's patterns without `served: 'rows'`, a `[part]` matching one segment. */
export function isCodeServed(pathname: string): boolean {
  const parts = segments(pathname);
  return CODE_SERVED.some(pattern => pattern.length === parts.length && pattern.every((seg, i) => seg.startsWith('[') || seg === parts[i]));
}

// The state rides in the variant path as base64url — an alphabet no router re-encodes or decodes (Next 16 hands a catch-all
// segment percent-encoded, a literal `=` included, and a percent-escaped form would be decoded once or not at all depending
// on the runtime); the catch-all decodes it back to the canonical query string.
const SEGMENT = /^[A-Za-z0-9_-]*$/;
export function encodeSegment(canonical: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(canonical)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** The canonical query a variant segment carries; null for a segment that is not one. */
export function decodeSegment(segment: string): string | null {
  if (!SEGMENT.test(segment)) return null;
  try {
    const bin = atob(segment.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (segment.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** The variant path to serve `pathname?search` from, or null: a plain address, an unknown key, an excluded prefix or a path the code serves. */
export function rewriteTarget(pathname: string, search: string): string | null {
  if (EXCLUDED.some(p => pathname === p || pathname.startsWith(`${p}/`))) return null;
  if (isCodeServed(pathname)) return null;
  const canonical = canonicalQuery(search);
  return canonical && canonical.length <= CANONICAL_MAX ? `${VIEW_PREFIX}/${encodeSegment(canonical)}${pathname}` : null;
}

// Saved views (P2.3 PR B; APEX: the saved reports of an Interactive Report, the designer-authored tiers alone): an Alternative
// of a region is one stored definition — the vocabulary's parameters, never a view key of its own — that a reader picks by
// ?view=<key>; the address's own parameters override it. The rules the editor and the write routes share live here, so what
// the editor lets through is what the route accepts.
export const VIEW_KEY_MAX = 40;
export const VIEW_NAME_MAX = 60;
export function isViewKey(key: unknown): key is string {
  return typeof key === 'string' && VIEW_KEY.test(key);
}
/** Why a saved view's key is refused, in plain words; null when it is fine. */
export function viewKeyProblem(key: string): string | null {
  if (!key.trim()) return 'needs a key';
  if (key.length > VIEW_KEY_MAX) return `a key is at most ${VIEW_KEY_MAX} characters`;
  if (!VIEW_KEY.test(key)) return 'a key is lower-case letters, digits and dashes, starting with a letter or digit';
  return null;
}
/** Why a saved view's name is refused, in plain words; null when it is fine. */
export function viewNameProblem(name: string): string | null {
  if (!name.trim()) return 'needs a name';
  if (name.length > VIEW_NAME_MAX) return `a name is at most ${VIEW_NAME_MAX} characters`;
  return null;
}
/** A state as a saved view stores it: the sort, the columns and the filters alone. */
export type ViewDefinition = Omit<ViewState, 'view'>;
export function definitionOf(state: ViewState): ViewDefinition {
  return { ...(state.sort ? { sort: state.sort } : {}), ...(state.cols && state.cols.length > 0 ? { cols: state.cols } : {}), filters: state.filters };
}
/** A stored definition read back, field by field; null for anything the vocabulary does not say (a row the parser cannot
 *  use is left out, never guessed at). */
export function parseViewDefinition(json: unknown): ViewDefinition | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const out: ViewDefinition = { filters: [] };
  if (o.sort !== undefined) {
    const s = o.sort as Record<string, unknown> | null;
    if (!s || typeof s !== 'object' || typeof s.column !== 'string' || !COLUMN.test(s.column) || typeof s.desc !== 'boolean') return null;
    out.sort = { column: s.column, desc: s.desc };
  }
  if (o.cols !== undefined) {
    if (!Array.isArray(o.cols) || o.cols.length === 0 || o.cols.length > COLS_MAX || o.cols.some(c => typeof c !== 'string' || !COLUMN.test(c))) return null;
    out.cols = [...new Set(o.cols as string[])];
  }
  if (o.filters !== undefined) {
    if (!Array.isArray(o.filters) || o.filters.length > FILTERS_MAX) return null;
    for (const f of o.filters) {
      const x = f as Record<string, unknown> | null;
      if (!x || typeof x !== 'object' || typeof x.column !== 'string' || !COLUMN.test(x.column) || typeof x.op !== 'string' || !(OPS as readonly string[]).includes(x.op) || typeof x.value !== 'string' || x.value === '' || x.value.length > VALUE_MAX) return null;
      out.filters.push({ column: x.column, op: x.op as FilterOp, value: x.value });
    }
  }
  return out;
}
/** The state a reader gets from a saved view: its definition, the address's own parameters over it (a sort, the columns or
 *  any filter the address names replace the view's), the view key kept for the controls. */
export function applySavedView(url: ViewState, saved: ViewDefinition | null): ViewState {
  if (!saved) return url;
  const sort = url.sort ?? saved.sort;
  const cols = url.cols ?? saved.cols;
  return { ...(sort ? { sort } : {}), ...(cols && cols.length > 0 ? { cols } : {}), filters: url.filters.length > 0 ? url.filters : saved.filters, ...(url.view !== undefined ? { view: url.view } : {}) };
}
