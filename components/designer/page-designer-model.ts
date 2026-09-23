import {
  COLUMNS,
  LEGACY_BODY,
  POSITIONS,
  REGION_KIND_LABELS,
  conditionText,
  descendantsOf,
  isInside,
  isLegacyBody,
  overlappingRegions,
  parentOf,
  parsePageDocument,
  type ComponentRegion,
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
import { COMPONENTS, SPLITS, componentDefaults, componentId, findComponent, recipeRegions, settingsSummary, type ComponentDefinition } from '@/lib/design/components';
import { encodeSourceRef, parseSourceRef, sourceLabel, type SourceRef } from '@/lib/design/sources';
import { adoptRecipe } from '@/lib/design/composed-page';
import { DESTINATIONS, pageDest, resolveDestination, type PageDestinations } from '@/lib/design/destinations';
import type { PageRow } from '@/lib/design/pages';
import type { EditableAsset } from '@/lib/design/assets';
import { DEFAULT_REGION_TEMPLATE, regionTemplate, type RegionTemplateKey } from '@/lib/design/template-options';

// The Page Designer's model (Paddock Designer v2.4, docs/prototypes/paddock-
// designer-v2.4): what is selected, how the document changes, what the
// designer says about a page. Pure and client-safe, so the panes stay thin and
// the tests can drive it without a screen. The document format itself is
// lib/design/page-document.ts and does not change here.

export type SharedKey = 'doors' | 'footer' | 'bar';

/** One component: the page, a position, a shared component's tile, a region,
 *  a dynamic action, one effect of an action, or a read-only system step. What
 *  a message or a search hit points at. */
export type SingleSelection =
  | { kind: 'page' }
  | { kind: 'position'; id: Position }
  | { kind: 'shared'; id: SharedKey }
  | { kind: 'region'; id: string }
  | { kind: 'action'; id: string }
  | { kind: 'effect'; id: string; index: number }
  | { kind: 'proc'; id: string };

/** What the panes have selected: one component, or several regions at once
 *  (Ctrl+click; APEX shows their common attributes and an edit updates every
 *  one, UX map lines 39 and 54). A set holds two or more ids. */
export type Selection = SingleSelection | { kind: 'regions'; ids: string[] };

export const PAGE_SELECTION: SingleSelection = { kind: 'page' };

export function sameSelection(a: Selection, b: Selection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'page') return true;
  if (a.kind === 'regions' && b.kind === 'regions') return a.ids.length === b.ids.length && a.ids.every(id => b.ids.includes(id));
  if (a.kind === 'effect' && b.kind === 'effect') return a.id === b.id && a.index === b.index;
  return (a as { id: string }).id === (b as { id: string }).id;
}

/** Whether the selection includes a component: itself, or a region inside a
 *  set of regions. The tiles, the tree and the Component View highlight by this. */
export function selectionCovers(selection: Selection, sel: Selection): boolean {
  return sameSelection(selection, sel) || (selection.kind === 'regions' && sel.kind === 'region' && selection.ids.includes(sel.id));
}

/** Ctrl, Cmd or Shift+click on a region: it joins the selection or leaves it.
 *  A set left with one region is that region; the only selected region clicked
 *  again leaves the page selected; from anything but regions it is a plain select. */
export function toggleRegion(current: Selection, id: string): Selection {
  if (current.kind === 'region') return current.id === id ? PAGE_SELECTION : { kind: 'regions', ids: [current.id, id] };
  if (current.kind === 'regions') {
    const ids = current.ids.includes(id) ? current.ids.filter(x => x !== id) : [...current.ids, id];
    return ids.length === 1 ? { kind: 'region', id: ids[0] } : { kind: 'regions', ids };
  }
  return { kind: 'region', id };
}

/** The positions a page of the given kind may carry regions in: every one for
 *  a page made in the designer; every one but the Right Side Column for a page
 *  whose body the code still draws (that column waits for its own decision).
 *  Since the components programme (R2a) the Body is open on every page: the
 *  code's body is a component among the operator's regions. */
/** Whether a route file in the code still serves the page (the Right Side
 *  Column waits there; the transitional body belongs there). */
export function servedByFile(page: Pick<PageRow, 'kind' | 'served'>): boolean {
  return page.kind === 'code' && page.served !== 'rows';
}

export function openPositions(page: Pick<PageRow, 'kind' | 'served'>): readonly Position[] {
  return servedByFile(page) ? (['header', 'breadcrumb', 'body', 'footer', 'phonebar'] as const) : POSITIONS;
}

/** What a page opens with when its stored document has NO Body regions at all.
 *  A page whose route file still serves it: the transitional component (the
 *  code's body is then implicit, as the frame renders it), so the operator sees
 *  it, moves it and puts regions around it; saving writes it explicitly. A page
 *  served from rows whose route file has left: its default composition, the
 *  same components the site renders when nothing is published (R4.1). A page
 *  made in the designer, a document with Body regions already (named or SPLIT)
 *  is returned as it is: putting the transitional body back on a split page
 *  would draw the code's body again. */
export function withImplicitBody(doc: PageDocument, page: Pick<PageRow, 'kind' | 'served' | 'path'>): PageDocument {
  if (page.kind !== 'code') return doc;
  // A page served from rows: a transitional body left from before its route
  // file went adopts the recipe in its place, as the catch-all serves it.
  if (page.served === 'rows' && doc.regions.some(r => r.kind === 'component' && r.component === LEGACY_BODY)) {
    return { ...doc, regions: renumber(adoptRecipe(doc, page.path).regions) };
  }
  if (doc.regions.some(r => r.position === 'body')) return doc;
  if (page.served === 'rows') {
    const recipe = recipeRegions(page.path, doc.regions.map(r => r.id));
    return recipe.length ? { ...doc, regions: renumber([...doc.regions, ...recipe]) } : doc;
  }
  const id = nextComponentId(LEGACY_BODY, doc.regions.map(r => r.id));
  const body: ComponentRegion = { id, kind: 'component', component: LEGACY_BODY, settings: {}, title: '', position: 'body', seq: 5, column: 1, span: COLUMNS, newRow: true, authz: null, hidden: false };
  return { ...doc, regions: renumber([...doc.regions, body]) };
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
  // By tens within each group: a position at the page level, or inside one parent (P1.4).
  const next = new Map<string, number>();
  return sorted.map(r => {
    const key = `${r.position}|${parentOf(r) ?? ''}`;
    const seq = (next.get(key) ?? 0) + 10;
    next.set(key, seq);
    return r.seq === seq ? r : { ...r, seq };
  });
}

/** A fresh id for a region of a kind: text-1, photo-2, list-1, button-1, component-1. */
export function nextRegionId(kind: RegionKind, taken: readonly string[]): string {
  const base = kind === 'static' ? 'text' : kind === 'image' ? 'photo' : kind === 'list' ? 'list' : kind === 'button' ? 'button' : 'component';
  let n = 1;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** A fresh id for a component: `code-body` for the transitional one, else the
 *  key's last word (`home.wire` → `wire`, then `wire-2`). */
export function nextComponentId(key: string, taken: readonly string[]): string {
  return componentId(key, taken);
}

/** A fresh action id: action-1, action-2. */
export function nextActionId(taken: readonly string[]): string {
  let n = 1;
  while (taken.includes(`action-${n}`)) n++;
  return `action-${n}`;
}

/** What a new region of each kind starts with: Component Settings (Shared
 *  Components), read by the designer when it creates a region. */
export interface RegionDefaults {
  imageShowCaption: boolean;
  listStyle: 'links' | 'cards';
  buttonLabel: string;
  /** The template (the look, P1.1) a new region of each kind starts with; a component draws its own. */
  templates: Record<Exclude<RegionKind, 'component'>, RegionTemplateKey>;
}
export const SHIPPED_REGION_DEFAULTS: RegionDefaults = {
  imageShowCaption: true,
  listStyle: 'links',
  buttonLabel: 'Read more',
  templates: { static: 'standard', image: 'standard', list: 'standard', button: 'standard' },
};

export function newRegion(kind: RegionKind, position: Position, id: string, span = COLUMNS, defaults: RegionDefaults = SHIPPED_REGION_DEFAULTS): Region {
  // The kind's default template is stored on the region (APEX: a theme's component defaults apply at creation); Plain is absent. A band takes the whole row.
  const template = kind === 'component' ? DEFAULT_REGION_TEMPLATE : defaults.templates[kind];
  const look = template === DEFAULT_REGION_TEMPLATE ? {} : { template };
  const base = { id, title: '', position, seq: 1_000_000, column: 1, span: template === 'band' ? COLUMNS : span, newRow: true, authz: null, hidden: false, ...look };
  if (kind === 'static') return { ...base, kind, text: '' };
  if (kind === 'image') return { ...base, kind, assetId: '', alt: '', showCaption: defaults.imageShowCaption };
  if (kind === 'button') return { ...base, kind, label: defaults.buttonLabel, dest: null };
  if (kind === 'component') return { ...base, kind, component: LEGACY_BODY, settings: {} };
  return { ...base, kind, listKey: 'doors', style: defaults.listStyle };
}

/** A component from the catalogue placed on the page, its settings at their
 *  defaults; null for a key the catalogue does not have. */
export function addComponent(doc: PageDocument, key: string, where: Placement, components: readonly ComponentDefinition[] = COMPONENTS): { doc: PageDocument; id: string } | null {
  const spec = findComponent(key, components);
  if (!spec) return null;
  const id = nextComponentId(key, doc.regions.map(r => r.id));
  const region: ComponentRegion = { id, kind: 'component', component: spec.key, settings: componentDefaults(spec), title: '', position: where.position, seq: 1_000_000, column: 1, span: COLUMNS, newRow: true, authz: null, hidden: false };
  return { doc: placeRegion(doc, region, { ...where, newRow: where.newRow ?? true }), id };
}

/** The components that replace a page's transitional body, when the catalogue has them: one key per recipe entry. */
export function splitRecipe(path: string): readonly string[] | null {
  return SPLITS[path]?.map(e => (typeof e === 'string' ? e : e.component)) ?? null;
}

/**
 * Split a page: the transitional body gives way to the page's components, in
 * the recipe's order, where it sat. Home's "What it changed" and "What's next"
 * share a row as two halves, as the page shows them today. Nothing happens
 * without a recipe or without the transitional body.
 */
export function splitBody(doc: PageDocument, path: string): PageDocument | null {
  const legacy = doc.regions.find(isLegacyBody);
  if (!legacy) return null;
  const rest = doc.regions.filter(r => r.id !== legacy.id);
  // The recipe's regions take the body's seq plus fractions, so they sit where
  // it sat among the other regions; renumber tidies them into tens.
  const recipe = recipeRegions(path, rest.map(r => r.id)).map((r, i, all) => ({ ...r, position: legacy.position, seq: legacy.seq + (i + 1) / (all.length + 1), authz: legacy.authz }) as ComponentRegion);
  if (recipe.length === 0) return null;
  return { ...doc, regions: renumber([...rest, ...recipe]) };
}

/**
 * The region with its Source changed (P2.2's Source group; R7, the operator's report of 2026-09-23: changing a What it
 * changed region's Type to Results left its preset and view behind and Save refused twice). The ref is stored canonically
 * or removed; then every choice whose current option is bound to another source or series (the Data region's Preset, a
 * View that is a template) moves to the first option the new Source and Series offer, with what that pick brings (its
 * `sets`: the view, the rows, the card slots and zones) — the same rule as picking it by hand in the Attributes tab. The
 * Preset comes before the View in the definition, so the preset's own view lands before the View is checked. An option
 * still offered, a Source with nothing to offer, or a definition without a bound choice leave the settings as they are.
 */
export function withSourceChanged(region: ComponentRegion, next: SourceRef | null, spec: ComponentDefinition | null): ComponentRegion {
  const rest = { ...region };
  delete rest.source;
  const out: ComponentRegion = next ? { ...rest, source: encodeSourceRef(next) } : rest;
  if (!next || !spec) return out;
  const series = typeof next.params.series === 'string' ? next.params.series : null;
  const offered = (o: { only?: { source: string; series?: readonly string[] }; later?: string }) =>
    !o.later && (o.only === undefined || (o.only.source === next.source && (o.only.series === undefined || series === null || o.only.series.includes(series))));
  let settings = out.settings;
  for (const s of spec.settings) {
    if (s.kind !== 'choice' || !s.options?.some(o => o.only)) continue;
    const current = s.options.find(o => o.key === String(settings[s.key] ?? s.default));
    if (!current || offered(current)) continue;
    const first = s.options.find(offered);
    if (!first) continue;
    settings = { ...settings, ...(first.sets ?? {}), [s.key]: first.key };
  }
  return settings === out.settings ? out : { ...out, settings };
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
  /** Inside this region (P1.4: a sub region, in the parent's position and columns); null or absent is the page level. */
  parent?: string | null;
}

/** The region at a placement, its neighbours renumbered. A region never lands
 *  inside itself or inside a region it holds (the document comes back as it
 *  was); a region moved to another position takes everything inside it along. */
export function placeRegion(doc: PageDocument, region: Region, where: Placement): PageDocument {
  const parent = where.parent ?? null;
  const parentRegion = parent ? doc.regions.find(r => r.id === parent) : undefined;
  if (parent !== null && !parentRegion) return doc;
  if (parentRegion && doc.regions.some(r => r.id === region.id) && isInside(doc, parentRegion.id, region.id)) return doc;
  const position = parentRegion ? parentRegion.position : where.position;
  const rest = doc.regions.filter(r => r.id !== region.id);
  const siblings = rest.filter(r => r.position === position && parentOf(r) === parent);
  let seq: number;
  if (where.first) seq = (siblings[0]?.seq ?? 10) - 5;
  else if (where.after) seq = (siblings.find(r => r.id === where.after)?.seq ?? 0) + 5;
  else if (where.before) seq = (siblings.find(r => r.id === where.before)?.seq ?? 10) - 5;
  else seq = (siblings[siblings.length - 1]?.seq ?? 0) + 10;
  const column = where.column ?? 1;
  const span = Math.min(where.span ?? region.span, COLUMNS + 1 - column);
  const placed: Region = {
    ...region,
    position,
    seq,
    newRow: where.newRow ?? region.newRow,
    column,
    span: Math.max(1, span),
  };
  if (parent) placed.parent = parent;
  else delete placed.parent;
  const inside = position === region.position ? new Set<string>() : new Set(descendantsOf(doc, region.id));
  return { ...doc, regions: renumber([...rest.map(r => (inside.has(r.id) ? { ...r, position } : r)), placed]) };
}

export function addRegion(doc: PageDocument, kind: RegionKind, where: Placement, defaults: RegionDefaults = SHIPPED_REGION_DEFAULTS): { doc: PageDocument; id: string } {
  const id = nextRegionId(kind, doc.regions.map(r => r.id));
  const span = kind === 'button' ? 3 : COLUMNS;
  const region = newRegion(kind, where.position, id, span, defaults);
  // A band takes the whole row whatever the placement offered (P1.1).
  const placement: Placement = region.template === 'band' ? { ...where, newRow: true, column: 1, span: COLUMNS } : { ...where, newRow: where.newRow ?? true };
  return { doc: placeRegion(doc, region, placement), id };
}

/** Removing a region takes with it everything inside it (P1.4) and every
 *  trigger and effect that named any of them; an action left with no effect
 *  goes too, so the parser never sees a dangling name. */
export function removeRegion(doc: PageDocument, id: string): PageDocument {
  const gone = new Set([id, ...descendantsOf(doc, id)]);
  return {
    ...doc,
    regions: renumber(doc.regions.filter(r => !gone.has(r.id))),
    actions: doc.actions
      .filter(a => !('region' in a.when && gone.has(a.when.region)))
      .map(a => ({ ...a, do: a.do.filter(e => e.action === 'go' || !gone.has(e.region)) }))
      .filter(a => a.do.length > 0),
  };
}

/** A copy of a region and everything inside it (P1.4), with fresh ids and the
 *  parents remapped; beneath the original when no placement is given (the
 *  copy's title says so), else at the placement (Copy To, a Ctrl+drop). */
export function duplicateRegion(doc: PageDocument, id: string, where?: Placement): { doc: PageDocument; id: string } | null {
  const r = doc.regions.find(x => x.id === id);
  if (!r) return null;
  // Each id minted is taken before the next, so two children of one kind never share one.
  const taken = doc.regions.map(x => x.id);
  const fresh = new Map<string, string>();
  const mint = (x: Region) => {
    const nid = nextRegionId(x.kind, taken);
    taken.push(nid);
    fresh.set(x.id, nid);
    return nid;
  };
  const rootId = mint(r);
  const copies: Region[] = [{ ...r, id: rootId, title: r.title ? `${r.title} (copy)` : '', seq: r.seq + 5, newRow: true }];
  for (const did of descendantsOf(doc, id)) {
    const d = doc.regions.find(x => x.id === did)!;
    copies.push({ ...d, id: mint(d), parent: fresh.get(d.parent as string) as string });
  }
  const withCopies = { ...doc, regions: renumber([...doc.regions, ...copies]) };
  if (!where) return { doc: withCopies, id: rootId };
  return { doc: placeRegion(withCopies, withCopies.regions.find(x => x.id === rootId)!, where), id: rootId };
}

/** Swap a region with its neighbour among the siblings of its position and parent. */
export function moveRegion(doc: PageDocument, id: string, dir: -1 | 1): PageDocument {
  const ordered = renumber(doc.regions);
  const me = ordered.find(r => r.id === id);
  if (!me) return doc;
  const siblings = ordered.filter(r => r.position === me.position && parentOf(r) === parentOf(me));
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

/** The live row pages by id, as resolveDestination takes them (P1.12 B2). The
 *  designer's pages are the live ones; a code page is never a destination. */
export function pageDestinationsOf(pages: readonly PageRow[] = []): PageDestinations {
  return Object.fromEntries(pages.filter(p => p.kind === 'row' && !p.deletedAt).map(p => [p.id, { path: p.path, name: p.name }]));
}

/** The destinations a button or a `go` effect may name, by label: the
 *  catalogue's, then the row pages under their names (`group: 'Pages'`). */
export function goOptions(pages: readonly PageRow[] = []): { key: string; label: string; group?: 'Pages' }[] {
  const own = Object.entries(pageDestinationsOf(pages))
    .map(([id, p]) => ({ key: pageDest(id), label: p.name, group: 'Pages' as const }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...GO_OPTIONS, ...own];
}

/** What a destination key is called: the catalogue's label, a page's name, or
 *  the key itself when nothing answers (a page not live, or unknown here). */
export function destinationLabel(key: string | null, pages?: readonly PageRow[]): string {
  if (!key) return '';
  const d = resolveDestination(key, pages ? pageDestinationsOf(pages) : undefined);
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
  if (r.kind === 'component') return r.title || findComponent(r.component)?.name || r.component;
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

export function effectText(e: Effect, regions: readonly Region[], pages?: readonly PageRow[]): string {
  if (e.action === 'go') return `Navigate to Page · ${destinationLabel(e.dest, pages)}`;
  const r = regions.find(x => x.id === e.region);
  const target = r ? regionName(r) : e.region;
  const verb = e.action === 'show' ? 'Show' : e.action === 'hide' ? 'Hide' : e.action === 'toggle' ? 'Toggle visibility' : 'Scroll To';
  return `${verb} · ${target}`;
}

/** One line about a region's source, for its tile and the Component View. */
export function regionSummary(r: Region, assets: readonly EditableAsset[], lists: readonly { key: string; label: string }[], pages?: readonly PageRow[], components: readonly ComponentDefinition[] = COMPONENTS): string {
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
      return `“${r.label}”${r.dest ? ` → ${destinationLabel(r.dest, pages)}` : ' · fires dynamic actions only'}`;
    case 'component': {
      const spec = findComponent(r.component, components);
      if (!spec) return `Unknown component ${r.component}`;
      const summary = settingsSummary(spec, r.settings);
      // The Source (P2.1) leads the tile's line while one is picked.
      const ref = r.source ? parseSourceRef(r.source).value : null;
      return ref ? `${sourceLabel(ref)} · ${summary}` : summary;
    }
  }
}

// ------------------------------------------------------------------ messages

export interface DesignerMessage {
  level: 'err' | 'warn' | 'info';
  text: string;
  /** What a click selects; null for the page. */
  sel: SingleSelection;
  /** The property group to open. */
  group?: string;
}

const REGION_PROBLEM = /^region ([a-z0-9-]+):/;
const ACTION_PROBLEM = /^action ([a-z0-9-]+)(?:, effect (\d+))?:/;

/** What the Messages tab lists: the parser's problems (they hold Save) and the
 *  designer's own warnings and notes, in the prototype's manner. */
export function designerMessages(doc: PageDocument, page: PageRow, components: readonly ComponentDefinition[] = COMPONENTS): DesignerMessage[] {
  const out: DesignerMessage[] = [];
  const code = page.kind === 'code';
  const { problems } = parsePageDocument(doc, components);
  for (const p of problems) {
    const rm = p.match(REGION_PROBLEM);
    const am = p.match(ACTION_PROBLEM);
    if (rm) out.push({ level: 'err', text: p, sel: { kind: 'region', id: rm[1] }, group: 'Source' });
    else if (am) out.push({ level: 'err', text: p, sel: am[2] ? { kind: 'effect', id: am[1], index: Number(am[2]) - 1 } : { kind: 'action', id: am[1] }, group: am[2] ? 'Affected Elements' : 'When' });
    else out.push({ level: 'err', text: p, sel: PAGE_SELECTION });
  }
  // A warning, not an error: an empty page saves, runs and publishes as its
  // title alone, as an APEX page does (operator, 2026-09-09: "i should always
  // be able to run page").
  if (!code && !doc.regions.some(r => r.position === 'body' && !r.hidden && !r.commentedOut && !r.parent)) {
    out.push({ level: 'warn', text: 'The Body has no region showing. The page runs as its title alone.', sel: { kind: 'position', id: 'body' } });
  }
  const file = servedByFile(page);
  const legacies = doc.regions.filter(isLegacyBody);
  if (file && legacies.length > 1) {
    out.push({ level: 'err', text: 'The body as the code draws it is placed twice; a page has one.', sel: { kind: 'region', id: legacies[1].id }, group: 'Source' });
  }
  for (const r of doc.regions) {
    if (file && r.position === 'right') {
      out.push({ level: 'err', text: `${regionName(r)} sits in the ${PD_POSITION.right.label}, which waits for its own decision on a page whose body the code still draws. Move it to the Body or another position.`, sel: { kind: 'region', id: r.id }, group: 'Layout' });
    }
    if (!file && isLegacyBody(r)) {
      out.push({ level: 'err', text: `${regionName(r)}: this page has no body drawn by the code. Remove the component.`, sel: { kind: 'region', id: r.id }, group: 'Source' });
    }
    if (r.kind === 'static' && !r.text.trim()) out.push({ level: 'warn', text: `${regionName(r)} has no text yet.`, sel: { kind: 'region', id: r.id }, group: 'Source' });
    if (r.kind === 'image' && r.assetId && !r.alt.trim()) out.push({ level: 'info', text: `${regionName(r)} has no alternative text; screen readers will skip the photo.`, sel: { kind: 'region', id: r.id }, group: 'Source' });
    if (r.kind === 'button' && !r.dest && !doc.actions.some(a => 'region' in a.when && a.when.region === r.id)) {
      out.push({ level: 'warn', text: `Button “${r.label}” goes nowhere and no dynamic action listens to it.`, sel: { kind: 'region', id: r.id }, group: 'Source' });
    }
    if (r.hidden && !doc.actions.some(a => a.do.some(e => e.action !== 'go' && e.region === r.id))) {
      out.push({ level: 'warn', text: `${regionName(r)} is hidden at first and no dynamic action shows it.`, sel: { kind: 'region', id: r.id }, group: 'Advanced' });
    }
    // Comment Out (P1.11): a note, so Messages lists what the running page leaves out.
    if (r.commentedOut) out.push({ level: 'info', text: `${regionName(r)} is commented out and leaves the page when it runs.`, sel: { kind: 'region', id: r.id }, group: 'Configuration' });
    // A component whose choice is bound to a Source (P2.2: the Data region's Preset) draws nothing without one.
    if (r.kind === 'component' && !r.source) {
      const spec = findComponent(r.component, components);
      if (spec?.sources?.length && spec.settings.some(s => s.options?.some(o => o.only))) {
        out.push({ level: 'warn', text: `${regionName(r)} has no Source; it draws nothing until one is picked.`, sel: { kind: 'region', id: r.id }, group: 'Source' });
      }
    }
  }
  // Two regions declared on one row cannot share a column (R5, the operator's
  // walkthrough of 2026-09-10): the page wraps the later one; the document says
  // so, and holds Save, until it is fixed.
  for (const o of overlappingRegions(doc)) {
    const a = doc.regions.find(r => r.id === o.a);
    const b = doc.regions.find(r => r.id === o.b);
    if (!a || !b) continue;
    const where = o.from === o.to ? `column ${o.from}` : `columns ${o.from} to ${o.to}`;
    const holder = o.parent ? doc.regions.find(r => r.id === o.parent) : undefined;
    out.push({ level: 'err', text: `${regionName(b)} overlaps ${regionName(a)} on one row${holder ? ` inside ${regionName(holder)}` : ''} (${where}). Move it, or start a new row.`, sel: { kind: 'region', id: b.id }, group: 'Layout' });
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
  sel: SingleSelection;
  what: string;
  where: string;
  value: string;
}

/** Every attribute value of every component on the page, for Page Search.
 *  Match Case and Regular Expression as APEX offers them; a regular expression
 *  that does not parse finds nothing. */
export function searchPage(q: string, doc: PageDocument, page: PageRow, opts: { matchCase?: boolean; regex?: boolean; pages?: readonly PageRow[] } = {}): SearchHit[] {
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
  const scan = (sel: SingleSelection, what: string, fields: Record<string, string | number | boolean | null | undefined>) => {
    for (const [k, v] of Object.entries(fields)) {
      if (v === null || v === undefined || v === '') continue;
      const s = String(v);
      if (test(s) || test(k)) hits.push({ sel, what, where: k, value: s });
    }
  };
  scan(PAGE_SELECTION, `Page · ${page.name}`, { name: page.name, path: page.path, title: page.title, group: page.group, authorization: page.authz, comments: page.comments });
  for (const r of doc.regions) {
    const base = {
      name: regionName(r),
      type: REGION_KIND_LABELS[r.kind].label,
      position: PD_POSITION[r.position].label,
      column: r.column,
      span: r.span,
      // The look (P1.1), by its label; Plain is the absent default and is not a hit.
      look: r.template ? regionTemplate(r.template).label : null,
      // The parent (P1.4), by its name; the page level is not a hit.
      parent: r.parent ? regionName(doc.regions.find(x => x.id === r.parent) ?? r) : null,
      authorization: r.authz,
      hidden: r.hidden ? 'hidden at first' : null,
      commented: r.commentedOut ? 'commented out' : null,
      // The condition (P2.6) in APEX's words with its value; none is not a hit.
      condition: conditionText(r.condition) || null,
    };
    const src =
      r.kind === 'static'
        ? { text: r.text }
        : r.kind === 'image'
          ? { photo: r.assetId, alt: r.alt }
          : r.kind === 'list'
            ? { list: r.listKey, style: r.style }
            : r.kind === 'component'
              ? { component: findComponent(r.component)?.name ?? r.component, ...r.settings }
              : { label: r.label, destination: destinationLabel(r.dest, opts.pages) };
    scan({ kind: 'region', id: r.id }, `Region · ${regionName(r)}`, { ...base, ...src });
  }
  for (const a of doc.actions) {
    scan({ kind: 'action', id: a.id }, `Dynamic action · ${actionName(a)}`, { name: a.name, when: triggerText(a.when, doc.regions) });
    a.do.forEach((e, i) => scan({ kind: 'effect', id: a.id, index: i }, `Action · ${actionName(a)}`, { effect: effectText(e, doc.regions, opts.pages) }));
  }
  return hits;
}

// ---------------------------------------------------------- system processes

export interface SystemStep {
  id: string;
  point: 'before-header' | 'after-header' | 'before-regions' | 'after-regions' | 'before-footer' | 'after-footer';
  name: string;
  note: string;
}

/** What the site does at each point when it serves the page. Read-only: a
 *  change is a deploy. */
export function systemSteps(page: Pick<PageRow, 'kind' | 'served'>): SystemStep[] {
  if (!servedByFile(page)) {
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
    { id: 'route', point: 'before-header', name: 'Match the route', note: 'The route file is still in the code; the path stays until the page is fully composed.' },
    { id: 'frame', point: 'before-header', name: 'Read the page row', note: 'Title, index rule and scheme, once a minute; the code is the fallback.' },
    { id: 'session', point: 'before-header', name: 'Read the session when a scheme or a rule asks', note: 'A refused visitor meets the scheme’s message or the 404; a signed-in rule leaves its region out.' },
    { id: 'body', point: 'after-header', name: 'Render the components', note: 'The code’s body where its component sits; your regions before and after it, each under its rule.' },
    { id: 'revalidate', point: 'after-footer', name: 'Revalidate on save and publish', note: 'Saving the attributes or publishing refreshes the served page at once.' },
  ];
}

export const STEP_POINTS: { key: SystemStep['point']; label: string; phase: 'Pre-Rendering' | 'Post-Rendering' }[] = [
  // APEX's six points (P1.4); the site's steps sit at three of them today, the
  // others wait for rules and processes.
  { key: 'before-header', label: 'Before Header', phase: 'Pre-Rendering' },
  { key: 'after-header', label: 'After Header', phase: 'Pre-Rendering' },
  { key: 'before-regions', label: 'Before Regions', phase: 'Pre-Rendering' },
  { key: 'after-regions', label: 'After Regions', phase: 'Post-Rendering' },
  { key: 'before-footer', label: 'Before Footer', phase: 'Post-Rendering' },
  { key: 'after-footer', label: 'After Footer', phase: 'Post-Rendering' },
];
