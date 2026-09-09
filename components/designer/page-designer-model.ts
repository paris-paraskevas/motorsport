import {
  COLUMNS,
  POSITIONS,
  REGION_KIND_LABELS,
  parsePageDocument,
  type DynamicAction,
  type Effect,
  type EffectAction,
  type PageDocument,
  type Position,
  type Region,
  type RegionKind,
  type Trigger,
  type TriggerEvent,
} from '@/lib/design/page-document';
import { DESTINATIONS, resolveDestination } from '@/lib/design/destinations';
import type { PageRow } from '@/lib/design/pages';
import type { EditableAsset } from '@/lib/design/assets';

// The Page Designer's model (Paddock Designer v2.4, docs/prototypes/paddock-
// designer-v2.4): what is selected, how the document changes, what the
// designer says about a page. Pure and client-safe, so the panes stay thin and
// the tests can drive it without a screen. The document format itself is
// lib/design/page-document.ts and does not change here.

export type SharedKey = 'doors' | 'footer' | 'bar';

/** What the panes have selected: the page, a position, a shared component's
 *  tile, a region, a dynamic action, one effect of an action, or a read-only
 *  system step. */
export type Selection =
  | { kind: 'page' }
  | { kind: 'position'; id: Position }
  | { kind: 'shared'; id: SharedKey }
  | { kind: 'region'; id: string }
  | { kind: 'action'; id: string }
  | { kind: 'effect'; id: string; index: number }
  | { kind: 'proc'; id: string };

export const PAGE_SELECTION: Selection = { kind: 'page' };

export function sameSelection(a: Selection, b: Selection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'page') return true;
  if (a.kind === 'effect' && b.kind === 'effect') return a.id === b.id && a.index === b.index;
  return (a as { id: string }).id === (b as { id: string }).id;
}

/** The positions a page of the given kind may carry regions in: every one for
 *  a page made in the designer; around the code's body for a page the code
 *  serves (the Right Side Column waits for its own decision). */
export function openPositions(kind: 'row' | 'code'): readonly Position[] {
  return kind === 'row' ? POSITIONS : (['header', 'breadcrumb', 'footer', 'phonebar'] as const);
}

/** The positions as the Page Designer names them, the prototype's words. */
export const PD_POSITION: Record<Position, { label: string; note: string }> = {
  header: { label: 'Page Header', note: 'above the page title, full width' },
  breadcrumb: { label: 'Breadcrumb Bar', note: 'the strip under the title' },
  body: { label: 'Body', note: 'the twelve-column grid' },
  right: { label: 'Right Side Column', note: 'beside the body on wide screens; stacks under it on a phone' },
  footer: { label: 'Footer', note: 'above the site footer' },
  phonebar: { label: 'Phone Bar', note: 'the fixed bar on phones; one region at most' },
};

/** The shared components a page shows as locked tiles: edited once under
 *  Shared Components, never on a page. */
export const PD_SHARED: { key: SharedKey; position: string; label: string; sub: string; note: string; sc: string }[] = [
  { key: 'doors', position: 'Header', label: 'Navigation Menu', sub: 'the doors, the search, the date, the account', note: 'Shared · desktop and laptop', sc: 'doors' },
  { key: 'footer', position: 'Footer', label: 'Site footer', sub: 'the site and legal lists, the running version', note: 'Shared · every page', sc: 'footer-site' },
  { key: 'bar', position: 'Navigation Bar', label: 'Phone bar', sub: 'three to five cells, always visible on phones', note: 'Shared · phones only', sc: 'bar' },
];

export function sharedOf(key: SharedKey) {
  return PD_SHARED.find(s => s.key === key)!;
}

/** Column Span in the prototype's words. */
export function spanName(span: number): string {
  return span === 12 ? 'Full' : span === 6 ? 'Half' : span === 4 ? 'Third' : span === 8 ? 'Two thirds' : span === 3 ? 'Quarter' : `${span}/12`;
}

export const SPAN_CHOICES = [12, 8, 6, 4, 3] as const;

const ORDER: Record<string, number> = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));

/** Regions in position and sequence order, renumbered by tens within each position. */
export function renumber(regions: Region[]): Region[] {
  const sorted = [...regions].sort((a, b) => ORDER[a.position] - ORDER[b.position] || a.seq - b.seq);
  const next: Partial<Record<Position, number>> = {};
  return sorted.map(r => {
    const seq = (next[r.position] ?? 0) + 10;
    next[r.position] = seq;
    return r.seq === seq ? r : { ...r, seq };
  });
}

/** A fresh id for a region of a kind: text-1, photo-2, list-1, button-1. */
export function nextRegionId(kind: RegionKind, taken: readonly string[]): string {
  const base = kind === 'static' ? 'text' : kind === 'image' ? 'photo' : kind === 'list' ? 'list' : 'button';
  let n = 1;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** A fresh action id: action-1, action-2. */
export function nextActionId(taken: readonly string[]): string {
  let n = 1;
  while (taken.includes(`action-${n}`)) n++;
  return `action-${n}`;
}

export function newRegion(kind: RegionKind, position: Position, id: string, span = COLUMNS): Region {
  const base = { id, title: '', position, seq: 1_000_000, column: 1, span, newRow: true, authz: null, hidden: false };
  if (kind === 'static') return { ...base, kind, text: '' };
  if (kind === 'image') return { ...base, kind, assetId: '', alt: '', showCaption: true };
  if (kind === 'button') return { ...base, kind, label: 'Read more', dest: null };
  return { ...base, kind, listKey: 'doors', style: 'links' };
}

/** Where a dropped or created region lands. */
export interface Placement {
  position: Position;
  /** After this region, before this region, or first in the position. */
  after?: string | null;
  before?: string | null;
  first?: boolean;
  newRow?: boolean;
  column?: number;
  /** A cap on the span (the free columns of a row). */
  span?: number;
}

/** The region at a placement, its neighbours renumbered. */
export function placeRegion(doc: PageDocument, region: Region, where: Placement): PageDocument {
  const rest = doc.regions.filter(r => r.id !== region.id);
  const siblings = rest.filter(r => r.position === where.position);
  let seq: number;
  if (where.first) seq = (siblings[0]?.seq ?? 10) - 5;
  else if (where.after) seq = (siblings.find(r => r.id === where.after)?.seq ?? 0) + 5;
  else if (where.before) seq = (siblings.find(r => r.id === where.before)?.seq ?? 10) - 5;
  else seq = (siblings[siblings.length - 1]?.seq ?? 0) + 10;
  const column = where.column ?? 1;
  const span = Math.min(where.span ?? region.span, COLUMNS + 1 - column);
  const placed: Region = {
    ...region,
    position: where.position,
    seq,
    newRow: where.newRow ?? region.newRow,
    column,
    span: Math.max(1, span),
  };
  return { ...doc, regions: renumber([...rest, placed]) };
}

export function addRegion(doc: PageDocument, kind: RegionKind, where: Placement): { doc: PageDocument; id: string } {
  const id = nextRegionId(kind, doc.regions.map(r => r.id));
  const span = kind === 'button' ? 3 : COLUMNS;
  const region = newRegion(kind, where.position, id, span);
  return { doc: placeRegion(doc, region, { ...where, newRow: where.newRow ?? true }), id };
}

/** Removing a region takes with it every trigger and effect that named it; an
 *  action left with no effect goes too, so the parser never sees a dangling name. */
export function removeRegion(doc: PageDocument, id: string): PageDocument {
  return {
    ...doc,
    regions: renumber(doc.regions.filter(r => r.id !== id)),
    actions: doc.actions
      .filter(a => !('region' in a.when && a.when.region === id))
      .map(a => ({ ...a, do: a.do.filter(e => e.action === 'go' || e.region !== id) }))
      .filter(a => a.do.length > 0),
  };
}

export function duplicateRegion(doc: PageDocument, id: string): { doc: PageDocument; id: string } | null {
  const r = doc.regions.find(x => x.id === id);
  if (!r) return null;
  const nid = nextRegionId(r.kind, doc.regions.map(x => x.id));
  const copy: Region = { ...r, id: nid, title: r.title ? `${r.title} (copy)` : '', seq: r.seq + 5, newRow: true };
  return { doc: { ...doc, regions: renumber([...doc.regions, copy]) }, id: nid };
}

/** Swap a region with its neighbour in the same position. */
export function moveRegion(doc: PageDocument, id: string, dir: -1 | 1): PageDocument {
  const ordered = renumber(doc.regions);
  const me = ordered.find(r => r.id === id);
  if (!me) return doc;
  const siblings = ordered.filter(r => r.position === me.position);
  const i = siblings.findIndex(r => r.id === id);
  const other = siblings[i + dir];
  if (!other) return doc;
  return {
    ...doc,
    regions: renumber(ordered.map(r => (r.id === me.id ? { ...r, seq: other.seq } : r.id === other.id ? { ...r, seq: me.seq } : r))),
  };
}

export function patchRegion(doc: PageDocument, id: string, fn: (r: Region) => Region): PageDocument {
  return { ...doc, regions: renumber(doc.regions.map(r => (r.id === id ? fn(r) : r))) };
}

/** Column and span kept inside the twelve columns. */
export function clampLayout(column: number, span: number): { column: number; span: number } {
  const c = Math.min(COLUMNS, Math.max(1, Math.round(column) || 1));
  const s = Math.min(COLUMNS + 1 - c, Math.max(1, Math.round(span) || 1));
  return { column: c, span: s };
}

// ------------------------------------------------------------ dynamic actions

const GO_OPTIONS = Object.entries(DESTINATIONS)
  .filter(([, d]) => d.kind !== 'action')
  .map(([key, d]) => ({ key, label: d.label }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** The destinations a button or a `go` effect may name, by label. */
export function goOptions(): { key: string; label: string }[] {
  return GO_OPTIONS;
}

export function destinationLabel(key: string | null): string {
  if (!key) return '';
  const d = resolveDestination(key);
  return d ? d.label : key;
}

export function triggerFor(event: TriggerEvent, regions: readonly Region[], previous?: Trigger): Trigger {
  const firstRegion = regions[0]?.id ?? '';
  const region = previous && 'region' in previous ? previous.region : firstRegion;
  if (event === 'click' || event === 'visible') return { event, region };
  if (event === 'timer') return { event, seconds: 60 };
  return { event };
}

export function effectFor(action: EffectAction, regions: readonly Region[], previous?: Effect): Effect {
  if (action === 'go') return { action, dest: previous && previous.action === 'go' ? previous.dest : (GO_OPTIONS[0]?.key ?? 'home') };
  const region = previous && previous.action !== 'go' ? previous.region : (regions[0]?.id ?? '');
  return { action, region };
}

export function addAction(doc: PageDocument, when?: Trigger): { doc: PageDocument; id: string } {
  const id = nextActionId(doc.actions.map(a => a.id));
  const action: DynamicAction = { id, name: '', when: when ?? triggerFor('click', doc.regions), do: [effectFor('toggle', doc.regions)] };
  return { doc: { ...doc, actions: [...doc.actions, action] }, id };
}

export function patchAction(doc: PageDocument, id: string, fn: (a: DynamicAction) => DynamicAction): PageDocument {
  return { ...doc, actions: doc.actions.map(a => (a.id === id ? fn(a) : a)) };
}

export function removeAction(doc: PageDocument, id: string): PageDocument {
  return { ...doc, actions: doc.actions.filter(a => a.id !== id) };
}

/** What the tree, the Component View and the Layout call a region. */
export function regionName(r: Region): string {
  return r.title || (r.kind === 'button' ? r.label : r.id);
}

/** What the tree calls an action. */
export function actionName(a: DynamicAction): string {
  return a.name || a.id;
}

export function triggerText(t: Trigger, regions: readonly Region[]): string {
  const name = (id: string) => {
    const r = regions.find(x => x.id === id);
    return r ? regionName(r) : id;
  };
  switch (t.event) {
    case 'click':
      return `Click · ${name(t.region)}`;
    case 'visible':
      return `Scrolled into view · ${name(t.region)}`;
    case 'load':
      return 'Page Load';
    case 'timer':
      return `Timer · every ${t.seconds} s`;
  }
}

export function effectText(e: Effect, regions: readonly Region[]): string {
  if (e.action === 'go') return `Navigate to Page · ${destinationLabel(e.dest)}`;
  const r = regions.find(x => x.id === e.region);
  const target = r ? regionName(r) : e.region;
  const verb = e.action === 'show' ? 'Show' : e.action === 'hide' ? 'Hide' : e.action === 'toggle' ? 'Toggle visibility' : 'Scroll To';
  return `${verb} · ${target}`;
}

/** One line about a region's source, for its tile and the Component View. */
export function regionSummary(r: Region, assets: readonly EditableAsset[], lists: readonly { key: string; label: string }[]): string {
  switch (r.kind) {
    case 'static':
      return r.text.trim() ? r.text.trim().replace(/\s+/g, ' ').slice(0, 140) : 'Empty. Your words; {shortcut:key} inserts a shortcut.';
    case 'image': {
      const a = assets.find(x => x.id === r.assetId);
      return (a ? `Photo · ${a.caption || a.key}` : r.assetId ? `Photo · ${r.assetId.slice(0, 8)}` : 'No photo chosen yet') + (r.alt ? '' : ' · no alternative text');
    }
    case 'list': {
      const l = lists.find(x => x.key === r.listKey);
      return `${l ? l.label : r.listKey} · ${r.style === 'cards' ? 'cards' : 'links'}`;
    }
    case 'button':
      return `“${r.label}”${r.dest ? ` → ${destinationLabel(r.dest)}` : ' · fires dynamic actions only'}`;
  }
}

// ------------------------------------------------------------------ messages

export interface DesignerMessage {
  level: 'err' | 'warn' | 'info';
  text: string;
  /** What a click selects; null for the page. */
  sel: Selection;
  /** The property group to open. */
  group?: string;
}

const REGION_PROBLEM = /^region ([a-z0-9-]+):/;
const ACTION_PROBLEM = /^action ([a-z0-9-]+)(?:, effect (\d+))?:/;

/** What the Messages tab lists: the parser's problems (they hold Save) and the
 *  designer's own warnings and notes, in the prototype's manner. */
export function designerMessages(doc: PageDocument, page: PageRow): DesignerMessage[] {
  const out: DesignerMessage[] = [];
  const code = page.kind === 'code';
  const { problems } = parsePageDocument(doc);
  for (const p of problems) {
    const rm = p.match(REGION_PROBLEM);
    const am = p.match(ACTION_PROBLEM);
    if (rm) out.push({ level: 'err', text: p, sel: { kind: 'region', id: rm[1] }, group: 'Source' });
    else if (am) out.push({ level: 'err', text: p, sel: am[2] ? { kind: 'effect', id: am[1], index: Number(am[2]) - 1 } : { kind: 'action', id: am[1] }, group: am[2] ? 'Affected Elements' : 'When' });
    else out.push({ level: 'err', text: p, sel: PAGE_SELECTION });
  }
  if (!code && !doc.regions.some(r => r.position === 'body' && !r.hidden)) {
    out.push({ level: 'err', text: 'The Body has no region showing. The page would be empty.', sel: { kind: 'position', id: 'body' } });
  }
  for (const r of doc.regions) {
    if (code && (r.position === 'body' || r.position === 'right')) {
      out.push({ level: 'err', text: `${regionName(r)} sits in the ${PD_POSITION[r.position].label}, which the code owns on this page. Move it to the Page Header, the Breadcrumb Bar, the Footer or the Phone Bar.`, sel: { kind: 'region', id: r.id }, group: 'Layout' });
    }
    if (r.kind === 'static' && !r.text.trim()) out.push({ level: 'warn', text: `${regionName(r)} has no text yet.`, sel: { kind: 'region', id: r.id }, group: 'Source' });
    if (r.kind === 'image' && r.assetId && !r.alt.trim()) out.push({ level: 'info', text: `${regionName(r)} has no alternative text; screen readers will skip the photo.`, sel: { kind: 'region', id: r.id }, group: 'Source' });
    if (r.kind === 'button' && !r.dest && !doc.actions.some(a => 'region' in a.when && a.when.region === r.id)) {
      out.push({ level: 'warn', text: `Button “${r.label}” goes nowhere and no dynamic action listens to it.`, sel: { kind: 'region', id: r.id }, group: 'Source' });
    }
    if (r.hidden && !doc.actions.some(a => a.do.some(e => e.action !== 'go' && e.region === r.id))) {
      out.push({ level: 'warn', text: `${regionName(r)} is hidden at first and no dynamic action shows it.`, sel: { kind: 'region', id: r.id }, group: 'Advanced' });
    }
  }
  for (const a of doc.actions) {
    if (!a.name.trim()) out.push({ level: 'info', text: `Dynamic action ${a.id} has no name.`, sel: { kind: 'action', id: a.id }, group: 'Identification' });
  }
  return out;
}

/** The worst level per component, for the tree's and the tiles' markers. */
export function messageIndex(messages: readonly DesignerMessage[]): Record<string, 'err' | 'warn'> {
  const idx: Record<string, 'err' | 'warn'> = {};
  for (const m of messages) {
    if (m.level === 'info') continue;
    const key = m.sel.kind === 'page' ? 'page' : m.sel.kind === 'effect' ? `action:${m.sel.id}` : `${m.sel.kind}:${m.sel.id}`;
    if (m.level === 'err') idx[key] = 'err';
    else if (idx[key] !== 'err') idx[key] = 'warn';
  }
  return idx;
}

// ---------------------------------------------------------------- page search

export interface SearchHit {
  sel: Selection;
  what: string;
  where: string;
  value: string;
}

/** Every attribute value of every component on the page, for Page Search.
 *  Match Case and Regular Expression as APEX offers them; a regular expression
 *  that does not parse finds nothing. */
export function searchPage(q: string, doc: PageDocument, page: PageRow, opts: { matchCase?: boolean; regex?: boolean } = {}): SearchHit[] {
  const query = q.trim();
  if (!query) return [];
  let test: (s: string) => boolean;
  if (opts.regex) {
    try {
      const re = new RegExp(query, opts.matchCase ? '' : 'i');
      test = s => re.test(s);
    } catch {
      return [];
    }
  } else if (opts.matchCase) test = s => s.includes(query);
  else {
    const lower = query.toLowerCase();
    test = s => s.toLowerCase().includes(lower);
  }
  const hits: SearchHit[] = [];
  const scan = (sel: Selection, what: string, fields: Record<string, string | number | boolean | null | undefined>) => {
    for (const [k, v] of Object.entries(fields)) {
      if (v === null || v === undefined || v === '') continue;
      const s = String(v);
      if (test(s) || test(k)) hits.push({ sel, what, where: k, value: s });
    }
  };
  scan(PAGE_SELECTION, `Page · ${page.name}`, { name: page.name, path: page.path, title: page.title, group: page.group, authorization: page.authz, comments: page.comments });
  for (const r of doc.regions) {
    const base = { name: regionName(r), type: REGION_KIND_LABELS[r.kind].label, position: PD_POSITION[r.position].label, column: r.column, span: r.span, authorization: r.authz, hidden: r.hidden ? 'hidden at first' : null };
    const src =
      r.kind === 'static' ? { text: r.text } : r.kind === 'image' ? { photo: r.assetId, alt: r.alt } : r.kind === 'list' ? { list: r.listKey, style: r.style } : { label: r.label, destination: destinationLabel(r.dest) };
    scan({ kind: 'region', id: r.id }, `Region · ${regionName(r)}`, { ...base, ...src });
  }
  for (const a of doc.actions) {
    scan({ kind: 'action', id: a.id }, `Dynamic action · ${actionName(a)}`, { name: a.name, when: triggerText(a.when, doc.regions) });
    a.do.forEach((e, i) => scan({ kind: 'effect', id: a.id, index: i }, `Action · ${actionName(a)}`, { effect: effectText(e, doc.regions) }));
  }
  return hits;
}

// ---------------------------------------------------------- system processes

export interface SystemStep {
  id: string;
  point: 'before-header' | 'after-header' | 'after-footer';
  name: string;
  note: string;
}

/** What the site does at each point when it serves the page. Read-only: a
 *  change is a deploy. */
export function systemSteps(kind: 'code' | 'row'): SystemStep[] {
  if (kind === 'row') {
    return [
      { id: 'resolve', point: 'before-header', name: 'Resolve the revision', note: 'The newest published revision of this page, by its path; the 404 when none is live.' },
      { id: 'session', point: 'before-header', name: 'Read the session when a scheme asks', note: 'Only a page or region asking for a scheme reads the visitor; a public page stays a cached render.' },
      { id: 'refs', point: 'after-header', name: 'Load what the regions name', note: 'Shortcuts, photos and navigation lists, by key.' },
      { id: 'render', point: 'after-header', name: 'Render the regions', note: 'The six positions in the page template, a refused region as its message or nothing.' },
      { id: 'bind', point: 'after-footer', name: 'Bind the dynamic actions', note: 'In the browser, once the page has rendered.' },
      { id: 'revalidate', point: 'after-footer', name: 'Revalidate on publish', note: 'A publish refreshes the served page at once; otherwise every five minutes.' },
    ];
  }
  return [
    { id: 'route', point: 'before-header', name: 'Match the route', note: 'The code serves this path; the page cannot take another.' },
    { id: 'frame', point: 'before-header', name: 'Read the page row', note: 'Title, index rule and scheme, once a minute; the code is the fallback.' },
    { id: 'session', point: 'before-header', name: 'Read the session when a scheme asks', note: 'A refused visitor meets the scheme’s message or the 404.' },
    { id: 'body', point: 'after-header', name: 'Render the code’s body', note: 'The page’s own content, as its code writes it.' },
    { id: 'revalidate', point: 'after-footer', name: 'Revalidate on save', note: 'Saving the attributes refreshes the served page at once.' },
  ];
}

export const STEP_POINTS: { key: SystemStep['point']; label: string; phase: 'Pre-Rendering' | 'Post-Rendering' }[] = [
  { key: 'before-header', label: 'Before Header', phase: 'Pre-Rendering' },
  { key: 'after-header', label: 'After Header', phase: 'Pre-Rendering' },
  { key: 'after-footer', label: 'After Footer', phase: 'Post-Rendering' },
];
