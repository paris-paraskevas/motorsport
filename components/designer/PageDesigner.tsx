'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Layers, Lock, Maximize2, Minimize2, Play, Plus, Puzzle, Redo2, RefreshCw, Search, TriangleAlert, Undo2, Wrench, Zap } from 'lucide-react';
import { EMPTY_DOCUMENT, RECOVERY_DAYS, SHORTCUT_TOKEN, daysLeft, isLegacyBody, parsePageDocument, type PageDocument, type Position, type RegionKind } from '@/lib/design/page-document';
import { COMPONENTS } from '@/lib/design/components';
import type { PageRow } from '@/lib/design/pages';
import type { PageDetail } from '@/lib/design/page-revisions';
import type { EditableAsset } from '@/lib/design/assets';
import type { EditableAuthzScheme } from '@/lib/design/authz';
import type { EditableBuildOption } from '@/lib/design/build-options';
import type { TemplatePresets } from '@/lib/design/template-options';
import type { EditableShortcut } from '@/lib/design/shortcuts';
import {
  PAGE_SELECTION,
  PD_POSITION,
  SHIPPED_REGION_DEFAULTS,
  addAction,
  addComponent,
  addRegion,
  splitBody,
  withImplicitBody,
  designerMessages,
  duplicateRegion,
  effectFor,
  messageIndex,
  moveRegion,
  openPositions,
  patchAction,
  patchRegion,
  placeRegion,
  regionName,
  removeAction,
  removeRegion,
  sameSelection,
  searchPage,
  toggleRegion,
  type DesignerMessage,
  type Placement,
  type RegionDefaults,
  type Selection,
  type SharedKey,
} from './page-designer-model';
import { PageDesignerLayout, type Drag } from './PageDesignerLayout';
import { LEFT_TABS, PageDesignerTree, treeKeys, type LeftTab } from './PageDesignerTree';
import { CENTRE_TABS, ComponentView, Gallery, HelpTab, MessagesTab, PageSearchTab, type CentreTab, type ComponentTile, type GalleryTab } from './PageDesignerCentre';
import { PropertyPane } from './PropertyPane';
import { attrsOf, attrsProblem, groupsFor, type AttrsDraft, type PropsContext } from './PageDesignerProperties';
import { Menu, Sheet, Toasts, anchorOf, useToasts, type MenuAt, type MenuEntry } from './DesignerMenu';
import { CreatePageDialog } from './CreatePageDialog';
import { PageGroupsSheet, type PageFilter } from './PagesList';
import { SITE_URL } from '@/lib/site';

// The Page Designer (Paddock Designer v2.4, docs/prototypes/paddock-designer-
// v2.4, the `#pd` screen): the toolbar, then three panes. Left, four tabs:
// Rendering, Dynamic Actions, Processing, Page Shared Components. Centre:
// Layout, Component View, Messages, Page Search, Help, with the Gallery beneath.
// Right: the Property Editor for the selection. Every change is a working copy
// with undo and redo until Save writes a draft revision, Publish makes the
// newest revision live, or Save and Run Page opens a draft wearing the developer
// toolbar; a page's attributes save with it through their own route. The
// parser that refuses a bad document on the server runs here as you edit, so
// Save is held with the reasons in Messages rather than refused after the
// round trip. The keyboard set is APEX's Alt set: Alt+1…6, Alt+F1, Alt+F7,
// Alt+F8, Alt+F11, Alt+Shift+F1, Alt+Shift+PgUp/PgDn, Shift+F10, Del, Esc,
// with Ctrl+Z / Ctrl+Y for undo and redo. No Ctrl chords, no palette.

const TB =
  'inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap border border-border-strong px-2.5 text-12 text-text-muted transition-colors duration-(--duration-fast) hover:border-text-muted hover:text-text disabled:cursor-default disabled:opacity-40 disabled:hover:border-border-strong disabled:hover:text-text-muted';
const TB_PRIMARY = `${TB} border-edit text-edit hover:bg-edit-dim hover:text-text`;
// Its own list, not TB's: two text colours in one class string race in the stylesheet's order.
const TB_RUN =
  'inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap border border-edit bg-edit px-2.5 text-12 font-medium text-white transition-[filter] duration-(--duration-fast) hover:brightness-110 disabled:cursor-default disabled:opacity-40 disabled:hover:brightness-100';
const IB =
  'grid h-[30px] w-[30px] shrink-0 place-items-center border border-transparent text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:bg-surface-elevated hover:text-text disabled:cursor-default disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent aria-pressed:border-edit aria-pressed:text-edit';
const GRP = 'flex h-[30px] items-center gap-1 border-r border-border pr-2 mr-0.5 last:border-r-0';

type Busy = 'save' | 'publish' | 'run' | 'delete' | 'reinstate' | 'purge' | null;
/** The one browser tab Save and Run opens and reuses (the operator, 2026-09-10: the same working tab every time). */
const RUN_TAB = 'paddock-run';
type SheetKind = 'finder' | 'export' | 'history' | 'shortcuts' | 'delete' | 'purge' | null;

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

/** What the designer remembers about its panes, per browser profile (APEX
 *  remembers the pane layout per user): the mode, the two Show toggles, the
 *  splitter widths. Read through useSyncExternalStore, so the server and the
 *  hydration render see the defaults and the client switches right after,
 *  without a state write inside an effect (the repo's pattern, LocalTime.tsx). */
interface LayoutMemory {
  paneMode?: 'three' | 'two';
  tooltips?: boolean;
  layoutView?: boolean;
  lw?: string;
  rw?: string;
}
const LAYOUT_KEY = 'paddock-developer.page-designer';
const EMPTY_MEMORY: LayoutMemory = {};
const layoutListeners = new Set<() => void>();
let memoryCache: { raw: string | null; value: LayoutMemory } = { raw: null, value: EMPTY_MEMORY };
function parseLayoutMemory(raw: string | null): LayoutMemory {
  if (!raw) return EMPTY_MEMORY;
  try {
    const m = JSON.parse(raw) as Record<string, unknown>;
    const px = (v: unknown) => (typeof v === 'string' && /^[0-9]{2,4}px$/.test(v) ? v : undefined);
    const out: LayoutMemory = {};
    if (m.paneMode === 'two' || m.paneMode === 'three') out.paneMode = m.paneMode;
    if (typeof m.tooltips === 'boolean') out.tooltips = m.tooltips;
    if (typeof m.layoutView === 'boolean') out.layoutView = m.layoutView;
    if (px(m.lw)) out.lw = px(m.lw);
    if (px(m.rw)) out.rw = px(m.rw);
    return out;
  } catch {
    return EMPTY_MEMORY;
  }
}
/** The snapshot: the same object while the stored string is the same. */
function readLayoutMemory(): LayoutMemory {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LAYOUT_KEY);
  } catch {
    raw = null;
  }
  if (raw !== memoryCache.raw) memoryCache = { raw, value: parseLayoutMemory(raw) };
  return memoryCache.value;
}
function writeLayoutMemory(patch: LayoutMemory): void {
  const next: Record<string, unknown> = { ...readLayoutMemory(), ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  try {
    if (Object.keys(next).length > 0) window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(LAYOUT_KEY);
  } catch {
    /* no storage: the layout lives for the page's life */
  }
  layoutListeners.forEach(l => l());
}
function subscribeLayout(listener: () => void): () => void {
  layoutListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    layoutListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
function useLayoutMemory(): LayoutMemory {
  return useSyncExternalStore(subscribeLayout, readLayoutMemory, () => EMPTY_MEMORY);
}

export function PageDesigner({
  detail,
  pages,
  readOnly: readOnlyProp,
  lists,
  listCounts,
  assets,
  schemes,
  buildOptions,
  templates,
  shortcuts,
  themeDefault = 'Paper',
  regionDefaults = SHIPPED_REGION_DEFAULTS,
  initialRegion = null,
  onSaved,
  onOpenPage,
  onBack,
  onWorkspace,
  onCreated,
  onDeleted,
  onReinstated,
  onPurged,
}: {
  detail: PageDetail;
  /** What a new region starts with (Component Settings). */
  regionDefaults?: RegionDefaults;
  /** Every page of the application, for the finder and the page stepper. */
  pages: PageRow[];
  readOnly: boolean;
  /** The navigation lists a List region may name. */
  lists: { key: string; label: string }[];
  /** How many entries each list holds, for the shared tiles. */
  listCounts: Record<string, number>;
  assets: EditableAsset[];
  schemes?: EditableAuthzScheme[];
  /** The Build Options with their statuses, for the Configuration group; absent shows plain labels. */
  buildOptions?: EditableBuildOption[];
  /** The region templates' Template Option presets (P1.2), for the Appearance group; absent reads as shipped. */
  templates?: TemplatePresets;
  shortcuts: EditableShortcut[];
  themeDefault?: string;
  /** A region to open on, from `?region=` on the address (P1.7: Quick Edit lands on the region); the page when absent or unknown. */
  initialRegion?: string | null;
  /** The detail as stored after a save, a publish or a reload. */
  onSaved: (detail: PageDetail) => void;
  onOpenPage: (id: string) => void;
  /** Back to the pages list; with a filter, the list opens on that group (Create › Page Group…, P1.10). */
  onBack: (filter?: PageFilter) => void;
  /** Shared Components, optionally straight to one catalogue entry. */
  onWorkspace: (ws: 'shared', sc?: string) => void;
  onCreated: (page: PageRow) => void;
  /** The page was moved to Deleted through the route (P1.12): the row as stored now; the shell lists it under Deleted and leaves the designer. */
  onDeleted: (page: PageRow) => void;
  /** A deleted page reinstated through the route: the row as stored now; the designer stays on it, editable again. */
  onReinstated: (page: PageRow) => void;
  /** A deleted page removed for good through the route; the shell drops it and leaves the designer. */
  onPurged: (id: string) => void;
}) {
  const { page, live, newest, revisions } = detail;
  const code = page.kind === 'code';
  // A route file in the code still draws this page's body (the transitional
  // body belongs there); a page served from rows, made here or split, has none.
  const routeFile = code && page.served !== 'rows';
  const pageId = page.id ?? '';
  // A deleted page (P1.12) opens read-only: nothing on it changes until it is
  // reinstated. The production gate keeps its own name (readOnlyProp) for the
  // two actions a deleted page still takes, Reinstate and Delete permanently.
  const deletedAt = page.deletedAt ?? null;
  const readOnly = readOnlyProp || deletedAt !== null;
  // What names this page (P1.12 B2, rule 10), for the Advanced group and the Delete Page sheet.
  const named = [...detail.namedBy.lists, ...detail.namedBy.pages];
  const number = page.id ? page.id.slice(0, 8) : 'no row';
  const uid = useId();
  // A page whose body the code still draws opens with that body as one
  // component in its Body (R2a), in the stored copy too, so nothing reads as
  // unsaved until the operator changes something.
  const stored = withImplicitBody(newest?.document ?? EMPTY_DOCUMENT, page);

  const [doc, setDoc] = useState<PageDocument>(stored);
  const [past, setPast] = useState<PageDocument[]>([]);
  const [future, setFuture] = useState<PageDocument[]>([]);
  const [seenNewest, setSeenNewest] = useState<string | null>(newest?.id ?? null);
  const [attrs, setAttrs] = useState<AttrsDraft>(() => attrsOf(page));
  const [seenStamp, setSeenStamp] = useState<string>(`${page.id}:${page.updatedAt}`);
  const [selection, setSelection] = useState<Selection>(() =>
    initialRegion && stored.regions.some(r => r.id === initialRegion) ? { kind: 'region', id: initialRegion } : PAGE_SELECTION,
  );
  const [leftTab, setLeftTab] = useState<LeftTab>('rend');
  const [cTab, setCTab] = useState<CentreTab>('layout');
  const [gTab, setGTab] = useState<GalleryTab>('regions');
  // Show Legacy (P1.11; APEX: the Gallery lists the supported components unless
  // the legacy toggle is on): a moment of the gallery, not a preference.
  const [showLegacy, setShowLegacy] = useState(false);
  const [treeQuery, setTreeQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpts, setSearchOpts] = useState({ matchCase: false, regex: false });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hideEmpty, setHideEmpty] = useState(false);
  const [showCols, setShowCols] = useState(false);
  // The pane layout (APEX: Utilities › Layout and Utilities › Show; the UX map
  // lines 14–16 and 26), remembered per browser profile under LAYOUT_KEY.
  const memory = useLayoutMemory();
  const paneMode = memory.paneMode ?? 'three';
  const tooltips = memory.tooltips ?? true;
  const layoutView = memory.layoutView ?? true;
  const setPaneMode = (mode: 'three' | 'two') => writeLayoutMemory({ paneMode: mode });
  const setTooltips = (on: boolean) => writeLayoutMemory({ tooltips: on });
  const setLayoutView = (on: boolean) => writeLayoutMemory({ layoutView: on });
  // Expand is a moment, not a preference: the centre alone until Restore.
  const [expandedLayout, setExpandedLayout] = useState(false);
  // Display from Here (the Layout tab's menu, UX map lines 47–48): the region the tab shows alone.
  const [layoutRoot, setLayoutRoot] = useState<string | null>(null);
  const rootLive = layoutRoot !== null && doc.regions.some(r => r.id === layoutRoot) ? layoutRoot : null;
  const [drag, setDrag] = useState<Drag | null>(null);
  // A drag begins one task after its dragstart (R5b). Chromium aborts a native
  // drag whose source's DOM changes while dragstart is still being handled
  // (Chromium bug 168544; the react-dnd thread on it): setting the drag here
  // at once drew the yellow drop tiles inside that handler, and every drag
  // ended before it began. The token keeps a drag that ended first (or that
  // dropped) from being set afterwards.
  const dragToken = useRef(0);
  const beginDrag = (d: Drag) => {
    const token = ++dragToken.current;
    window.setTimeout(() => {
      if (dragToken.current === token) setDrag(d);
    }, 0);
  };
  const endDrag = () => {
    dragToken.current++;
    setDrag(null);
  };
  const [menu, setMenu] = useState<{ at: MenuAt; entries: MenuEntry[] } | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [creating, setCreating] = useState(false);
  // Create › Page Group… (P1.10): the pages list's sheet, opened here on the page's group.
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [finderQuery, setFinderQuery] = useState('');
  const [finderRecent, setFinderRecent] = useState(false);
  const [status, setStatus] = useState<{ text: string; cls?: 'ok' | 'bad' } | null>(null);
  const [conflict, setConflict] = useState<PageDetail | null>(null);
  const [focusGroup, setFocusGroup] = useState<{ title: string; n: number } | null>(null);
  const [renameTick, setRenameTick] = useState(0);
  const [helpFor, setHelpFor] = useState<{ label: string; text: string | null } | null>(null);
  const [numInput, setNumInput] = useState(number);
  const { toasts, toast } = useToasts();
  const filterRef = useRef<HTMLInputElement>(null);
  const panesRef = useRef<HTMLDivElement>(null);
  const createBtn = useRef<HTMLButtonElement>(null);
  const utilBtn = useRef<HTMLButtonElement>(null);

  // A new newest revision (after a save or a reload) replaces the working copy;
  // a moved row replaces the attributes draft: adjusted during render.
  if ((newest?.id ?? null) !== seenNewest) {
    setSeenNewest(newest?.id ?? null);
    setDoc(stored);
    setPast([]);
    setFuture([]);
  }
  if (`${page.id}:${page.updatedAt}` !== seenStamp) {
    setSeenStamp(`${page.id}:${page.updatedAt}`);
    setAttrs(attrsOf(page));
    setNumInput(number);
  }

  const parsed = parsePageDocument(doc);
  const docDirty = JSON.stringify(doc) !== JSON.stringify(stored);
  // Where a new region goes when nothing narrower is chosen: the Body, on every
  // page since the components programme opened it (R2a).
  const home: Position = 'body';
  const open = openPositions(page);
  // The components this page may take (P1.11: the Gallery's Show Legacy). A
  // legacy component is listed where the page can take it, a code page whose
  // route file still draws its body and holds none yet; with Show Legacy on it
  // is listed everywhere, inert with the reason where the page cannot take it.
  const legacyReason = !routeFile ? 'this page is served from rows; the code draws no body here' : doc.regions.some(isLegacyBody) ? 'this page already holds its body' : null;
  const componentTiles: ComponentTile[] = COMPONENTS.filter(c => !c.legacy || legacyReason === null || showLegacy).map(c => ({
    key: c.key,
    name: c.name,
    desc: c.holds,
    ...(c.legacy ? { legacy: true as const, ...(legacyReason ? { inert: legacyReason } : {}) } : {}),
  }));
  const attrsDirty = JSON.stringify(attrs) !== JSON.stringify(attrsOf(page));
  const dirty = docDirty || attrsDirty;
  const unpublishedNewest = newest !== null && newest.id !== (live?.id ?? null);
  const messages: DesignerMessage[] = designerMessages(doc, page);
  if (newest && newest.problems.length > 0) {
    messages.unshift({ level: 'warn', text: `The stored document had problems the reader worked around: ${newest.problems.join('; ')}. Saving writes the usable part.`, sel: PAGE_SELECTION });
  }
  const attrsBad = attrsProblem(attrs);
  if (attrsBad) messages.unshift({ level: 'err', text: `Page attributes: ${attrsBad}.`, sel: PAGE_SELECTION, group: 'Identification' });
  const errors = messages.filter(m => m.level === 'err');
  const markers = messageIndex(messages);
  const schemeOptions = (schemes ?? []).map(s => ({ key: s.key, label: s.label, type: s.type as string }));
  const schemeList = schemeOptions.length ? schemeOptions : [
    { key: 'public', label: 'Public', type: 'public' },
    { key: 'signed_in', label: 'Signed in', type: 'signed_in' },
    { key: 'contributor', label: 'Contributor', type: 'author' },
    { key: 'administrator', label: 'Administrator', type: 'role' },
  ];
  const shared: Record<SharedKey, string> = {
    doors: `${listCounts.doors ?? 0} doors`,
    footer: `${(listCounts['footer-site'] ?? 0) + (listCounts['footer-legal'] ?? 0)} links`,
    bar: `${listCounts.bar ?? 0} cells`,
  };
  // A selection whose component went away falls back to the page; a set of
  // regions keeps the ones still on the page, and one left is that region.
  const effective: Selection = ((): Selection => {
    if (selection.kind === 'regions') {
      const ids = selection.ids.filter(id => doc.regions.some(r => r.id === id));
      if (ids.length === 0) return PAGE_SELECTION;
      if (ids.length === 1) return { kind: 'region', id: ids[0] };
      return ids.length === selection.ids.length ? selection : { kind: 'regions', ids };
    }
    return (selection.kind === 'region' && !doc.regions.some(r => r.id === selection.id)) ||
      (selection.kind === 'action' && !doc.actions.some(a => a.id === selection.id)) ||
      (selection.kind === 'effect' && !doc.actions.find(a => a.id === selection.id)?.do[selection.index])
      ? PAGE_SELECTION
      : selection;
  })();

  useEffect(() => {
    if (renameTick > 0) {
      const el = document.getElementById(`${uid}-rname`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }
  }, [renameTick, uid]);
  useEffect(() => {
    // The same as endDrag, on the ref and the setter alone, so the listener lives once.
    const end = () => {
      dragToken.current++;
      setDrag(null);
    };
    document.addEventListener('dragend', end);
    return () => document.removeEventListener('dragend', end);
  }, []);

  const select = (sel: Selection, opts?: { group?: string; rename?: boolean; tab?: CentreTab; toggle?: boolean }) => {
    // Ctrl, Cmd or Shift with the click adds a region to the selection or takes it out (APEX: several components selected, UX map lines 39 and 54).
    setSelection(opts?.toggle && sel.kind === 'region' ? toggleRegion(effective, sel.id) : sel);
    if (opts?.group) setFocusGroup(f => ({ title: opts.group!, n: (f?.n ?? 0) + 1 }));
    if (opts?.rename) setRenameTick(t => t + 1);
    if (opts?.tab) setCTab(opts.tab);
  };
  const commit = (next: PageDocument, label: string) => {
    setPast(p => [...p.slice(-79), doc]);
    setFuture([]);
    setDoc(next);
    setStatus({ text: label, cls: 'ok' });
  };
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast(p => p.slice(0, -1));
    setFuture(f => [doc, ...f]);
    setDoc(prev);
    setStatus({ text: 'Undone.' });
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture(f => f.slice(1));
    setPast(p => [...p, doc]);
    setDoc(next);
    setStatus({ text: 'Redone.' });
  };

  const act: PropsContext['act'] = {
    addRegion: (kind, position) => {
      if (readOnly) return;
      const r = addRegion(doc, kind, { position: open.includes(position) ? position : home }, regionDefaults);
      commit(r.doc, `${kind === 'button' ? 'Button' : kind === 'static' ? 'Static Content' : kind === 'image' ? 'Image' : kind === 'component' ? 'Component' : 'List'} created. Its attributes are in the Property Editor.`);
      select({ kind: 'region', id: r.id });
    },
    addComponent: (key, position) => {
      if (readOnly) return;
      const r = addComponent(doc, key, { position: open.includes(position) ? position : home });
      if (!r) return;
      commit(r.doc, 'Component placed. Its settings and its rule are in the Property Editor.');
      select({ kind: 'region', id: r.id });
    },
    splitBody: () => {
      if (readOnly) return;
      const next = splitBody(doc, page.path);
      if (!next) return;
      commit(next, 'Split into components. Each has its settings and its rule; Save, then Publish, and the page renders from them.');
      const first = next.regions.find(r => r.position === 'body');
      if (first) select({ kind: 'region', id: first.id });
    },
    duplicate: id => {
      const r = duplicateRegion(doc, id);
      if (!r) return;
      commit(r.doc, 'Duplicated.');
      select({ kind: 'region', id: r.id });
    },
    move: (id, dir) => commit(moveRegion(doc, id, dir), dir < 0 ? 'Moved up.' : 'Moved down.'),
    remove: id => {
      const r = doc.regions.find(x => x.id === id);
      commit(removeRegion(doc, id), `${r ? regionName(r) : 'Region'} deleted.`);
      setSelection(PAGE_SELECTION);
    },
    removeAction: id => {
      commit(removeAction(doc, id), 'Dynamic action deleted.');
      setSelection(PAGE_SELECTION);
    },
    addEffect: actionId => {
      commit(patchAction(doc, actionId, a => ({ ...a, do: [...a.do, effectFor('show', doc.regions)] })), 'Action added.');
      const a = doc.actions.find(x => x.id === actionId);
      select({ kind: 'effect', id: actionId, index: a ? a.do.length : 0 });
    },
    removeEffect: (actionId, index) => {
      commit(patchAction(doc, actionId, a => ({ ...a, do: a.do.filter((_, j) => j !== index) })), 'Action deleted.');
      select({ kind: 'action', id: actionId });
    },
  };
  /** Several regions at once (a Ctrl+click set): one commit, the page selected after. */
  const removeRegions = (ids: readonly string[]) => {
    if (readOnly) return;
    commit(ids.reduce((d, id) => removeRegion(d, id), doc), `${ids.length} regions deleted.`);
    setSelection(PAGE_SELECTION);
  };
  const createAction = (whenOf?: { region: string }) => {
    if (readOnly) return;
    if (doc.regions.length === 0) {
      toast('Add a region first.', 'bad');
      return;
    }
    const r = addAction(doc, whenOf ? { event: 'click', region: whenOf.region } : undefined);
    commit(r.doc, 'Dynamic action created. Set When, then add actions.');
    setLeftTab('da');
    select({ kind: 'action', id: r.id });
  };
  const onDrop = (d: Drag, where: Placement) => {
    endDrag();
    if (readOnly) return;
    if (d.type === 'gallery') {
      const r = addRegion(doc, d.kind, where, regionDefaults);
      commit(r.doc, 'Region created. Its attributes are in the Property Editor.');
      select({ kind: 'region', id: r.id });
      return;
    }
    if (d.type === 'component') {
      const r = addComponent(doc, d.key, where);
      if (!r) return;
      commit(r.doc, 'Component placed. Its settings and its rule are in the Property Editor.');
      select({ kind: 'region', id: r.id });
      return;
    }
    const r = doc.regions.find(x => x.id === d.id);
    if (!r) return;
    commit(placeRegion(doc, r, where), `${regionName(r)} moved.`);
    select({ kind: 'region', id: r.id });
  };
  const toggleExpanded = (key: string) => setExpanded(e => ({ ...e, [key]: e[key] === false }));
  const expandAll = (open: boolean) => setExpanded(open ? {} : Object.fromEntries(treeKeys(doc).map(k => [k, false])));

  // ------------------------------------------------------------- saving
  async function putAttrs(): Promise<boolean> {
    const res = await fetch(`/api/admin/design/pages/${pageId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: attrs.name.trim(),
        title: attrs.title.trim() || null,
        group: attrs.group,
        authz: attrs.authz || 'public',
        indexable: attrs.indexable,
        comments: attrs.comments.trim() || null,
        updatedAt: page.updatedAt,
      }),
    });
    if (res.status === 409) {
      const d = (await res.json().catch(() => ({}))) as { current?: PageDetail };
      if (d.current) setConflict(d.current);
      else setStatus({ text: 'This page was saved again after you loaded it. Reload the page.', cls: 'bad' });
      return false;
    }
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus({ text: d.error ?? `Not saved (HTTP ${res.status}).`, cls: 'bad' });
      return false;
    }
    return true;
  }
  async function postRevision(action: 'draft' | 'publish'): Promise<string | null | false> {
    const res = await fetch(`/api/admin/design/pages/${pageId}/revisions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ document: parsed.value, action, base: action === 'publish' ? (live?.id ?? null) : (newest?.id ?? null) }),
    });
    if (res.status === 409) {
      const d = (await res.json().catch(() => ({}))) as { current?: PageDetail | null };
      if (d.current) setConflict(d.current);
      else setStatus({ text: 'This page was published again after you loaded it. Reload the page.', cls: 'bad' });
      return false;
    }
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus({ text: d.error ?? `Not saved (HTTP ${res.status}).`, cls: 'bad' });
      return false;
    }
    const saved = (await res.json().catch(() => ({}))) as { revision?: { id?: string } };
    return saved.revision?.id ?? null;
  }
  async function reload(): Promise<boolean> {
    const fresh = await fetch(`/api/admin/design/pages/${pageId}`, { cache: 'no-store' });
    if (!fresh.ok) {
      setStatus({ text: `Saved, but the page could not be reloaded (HTTP ${fresh.status}).`, cls: 'bad' });
      return false;
    }
    onSaved((await fresh.json()) as PageDetail);
    return true;
  }
  const blocked = (): boolean => {
    if (errors.length > 0) {
      setCTab('msgs');
      setStatus({ text: `Not saved: ${errors.length} error${errors.length > 1 ? 's' : ''}. See Messages.`, cls: 'bad' });
      toast(`Save failed · ${errors[0].text}`, 'bad');
      return true;
    }
    return false;
  };
  async function save() {
    if (busy || readOnly || !pageId || blocked()) return;
    if (!dirty) {
      toast('Nothing to save.');
      return;
    }
    setBusy('save');
    try {
      if (attrsDirty && !(await putAttrs())) return;
      let rev: string | null = null;
      if (docDirty) {
        const r = await postRevision('draft');
        if (r === false) return;
        rev = r;
      }
      if (!(await reload())) return;
      setStatus({ text: `Page ${number} saved${rev ? ` · draft ${rev.slice(0, 8)}` : ''}. ${code && !rev ? 'The site follows within a minute.' : 'Publish makes it live.'}`, cls: 'ok' });
      toast('Saved', 'ok');
    } catch {
      setStatus({ text: 'Network error. Try again.', cls: 'bad' });
    } finally {
      setBusy(null);
    }
  }
  async function publish() {
    if (busy || readOnly || !pageId || blocked()) return;
    if (!docDirty && !unpublishedNewest && !attrsDirty) {
      toast('The live revision is already the newest.');
      return;
    }
    setBusy('publish');
    try {
      if (attrsDirty && !(await putAttrs())) return;
      if (docDirty || unpublishedNewest) {
        const r = await postRevision('publish');
        if (r === false) return;
      }
      if (!(await reload())) return;
      setStatus({ text: `Published · ${when(new Date().toISOString())}. Readers see it now.`, cls: 'ok' });
      toast('Published', 'ok');
    } catch {
      setStatus({ text: 'Network error. Try again.', cls: 'bad' });
    } finally {
      setBusy(null);
    }
  }
  /** The page's address on the site. Absolute, always: on the admin-only dev.
   *  host a relative path is the designer again, not the site (operator,
   *  2026-09-09: "saving and running a page throws me into not found errors").
   *  A local server runs its own page, not production's. */
  const runUrl = () => {
    const local = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
    return `${local ? window.location.origin : SITE_URL}${page.path}`;
  };
  /** APEX: Save and Run Page saves and runs the page. Ours publishes first (the
   *  operator, 2026-09-10: "publish should be in save and run"), so the working
   *  tab shows what readers get from now on; Save alone keeps a draft. The tab
   *  is one named browsing context, reused on every run (APEX: the runtime tab;
   *  the operator, 2026-09-10), which is why there is no `noopener`: a named
   *  target is reused only by an opener that keeps the name. Run is never
   *  refused: an empty page publishes as its title alone (operator, 2026-09-09). */
  async function saveAndRun() {
    if (busy || readOnly || blocked()) return;
    if (page.path.includes('[')) {
      toast('This route needs a slug; open one of its pages from the site.', 'bad');
      return;
    }
    // Nothing changed and nothing unpublished (a page with no revision yet included): the page runs as it is.
    if (!dirty && !unpublishedNewest) {
      window.open(runUrl(), RUN_TAB)?.focus();
      return;
    }
    setBusy('run');
    try {
      if (attrsDirty && !(await putAttrs())) return;
      if (docDirty || unpublishedNewest || !newest) {
        const r = await postRevision('publish');
        if (r === false) return;
      }
      if (!(await reload())) return;
      setStatus({ text: `Published · ${when(new Date().toISOString())}. Running.`, cls: 'ok' });
      window.open(runUrl(), RUN_TAB)?.focus();
    } catch {
      setStatus({ text: 'Network error. Try again.', cls: 'bad' });
    } finally {
      setBusy(null);
    }
  }

  // ------------------------------------------------------------ toolbar
  const openable = pages.filter(p => p.id);
  // The finder's search reads number, name, path and group; Recently edited
  // keeps the ten pages with the newest stamp (APEX's third tab).
  const finderWords = finderQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const finderPages = (finderRecent ? [...openable].filter(p => p.updatedAt).sort((a, b) => (a.updatedAt! < b.updatedAt! ? 1 : a.updatedAt! > b.updatedAt! ? -1 : 0)).slice(0, 10) : openable).filter(p =>
    finderWords.every(w => `${p.id!.slice(0, 8)} ${p.name} ${p.path} ${p.group ?? ''}`.toLowerCase().includes(w)),
  );

  /** Delete Page (P1.12): a page made here moves to Deleted with its revisions, reinstatable for RECOVERY_DAYS; the row's route says no to a code page. */
  async function deletePage() {
    setBusy('delete');
    try {
      const res = await fetch(`/api/admin/design/pages/${pageId}`, { method: 'DELETE' });
      const body = (await res.json().catch(() => ({}))) as { error?: string; page?: PageRow };
      if (!res.ok) {
        toast(body.error ?? `The page could not be deleted (HTTP ${res.status}).`, 'bad');
        return;
      }
      setSheet(null);
      onDeleted(body.page ?? { ...page, deletedAt: new Date().toISOString(), deletedBy: null });
    } catch {
      toast('Network error. Try again.', 'bad');
    } finally {
      setBusy(null);
    }
  }
  /** Reinstate (P1.12): the one write a deleted page takes; the page comes back as it was. */
  async function reinstatePage() {
    setBusy('reinstate');
    try {
      const res = await fetch(`/api/admin/design/pages/${pageId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'reinstate' }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; page?: PageRow };
      if (!res.ok || !body.page) {
        toast(body.error ?? `The page could not be reinstated (HTTP ${res.status}).`, 'bad');
        return;
      }
      setStatus({ text: 'Reinstated. The page is live at its address again.', cls: 'ok' });
      onReinstated(body.page);
    } catch {
      toast('Network error. Try again.', 'bad');
    } finally {
      setBusy(null);
    }
  }
  /** Delete permanently (P1.12): removed for good through the route, refused while a live page names it. */
  async function purgePage() {
    setBusy('purge');
    try {
      const res = await fetch(`/api/admin/design/pages/${pageId}?purge=1`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast(body.error ?? `The page could not be removed (HTTP ${res.status}).`, 'bad');
        return;
      }
      setSheet(null);
      onPurged(pageId);
    } catch {
      toast('Network error. Try again.', 'bad');
    } finally {
      setBusy(null);
    }
  }
  const at = openable.findIndex(p => p.id === page.id);
  const step = (dir: -1 | 1) => {
    if (openable.length === 0) return;
    const j = (at + dir + openable.length) % openable.length;
    onOpenPage(openable[j].id!);
  };
  const openByNumber = () => {
    const q = numInput.trim().toLowerCase();
    const hit = openable.find(p => p.id!.startsWith(q)) ?? openable.find(p => p.name.toLowerCase() === q);
    if (hit && hit.id) onOpenPage(hit.id);
    else {
      toast(`No page ${numInput}`, 'bad');
      setNumInput(number);
    }
  };
  // Create › Developer Comment (APEX: the page's Comments attribute, "internal
  // notes to other developers"): the page selected, the Advanced group opened,
  // the Comments field focused once the pane has drawn it (the pane opens a
  // focused group during the render; the text picker's pattern for the focus).
  const developerComment = () => {
    select(PAGE_SELECTION, { group: 'Advanced' });
    requestAnimationFrame(() => document.getElementById(`${uid}-comments`)?.focus());
  };
  // APEX: the toolbar's Create menu, UX map (page-designer-toolbar): Page, Copy
  // Page, Breadcrumb Region, Shared Component, Page Group, Developer Comment,
  // Issue, in that order (P1.10). Copy Page arrives with Phase 4; Breadcrumb
  // Region waits for the Breadcrumb component (the ledger's changes line of
  // 2026-09-15 on the slot's "P2.17"); Issue has no counterpart, APEX's Team
  // Development is not planned. Below the separator, OURS: APEX creates
  // regions from the tree and the gallery and dynamic actions from the tree;
  // the designer offers them here as well.
  const createMenu = (): MenuEntry[] => [
    { label: 'Page…', run: () => setCreating(true) },
    { label: 'Copy Page', sub: 'arrives with Phase 4', disabled: true, run: () => {} },
    { label: 'Breadcrumb Region', sub: 'until the Breadcrumb component', disabled: true, run: () => {} },
    { label: 'Shared Component…', run: () => onWorkspace('shared') },
    { label: 'Page Group…', run: () => setGroupsOpen(true) },
    { label: 'Developer Comment', sub: 'the page’s Comments', run: developerComment },
    { label: 'Issue', sub: 'no counterpart', disabled: true, run: () => {} },
    '-',
    { head: 'Region' },
    ...(['static', 'image', 'list', 'button'] as RegionKind[]).map(k => ({
      label: k === 'static' ? 'Static Content' : k === 'image' ? 'Image' : k === 'list' ? 'List' : 'Button',
      sub: effective.kind === 'position' && open.includes(effective.id) ? `in ${PD_POSITION[effective.id].label}` : `in ${PD_POSITION[home].label}`,
      disabled: readOnly,
      run: () => act.addRegion(k, effective.kind === 'position' ? effective.id : home),
    })),
    '-',
    { label: 'Dynamic Action', sub: effective.kind === 'region' ? 'click on this region' : undefined, disabled: readOnly, run: () => createAction(effective.kind === 'region' ? { region: effective.id } : undefined) },
  ];
  const utilitiesMenu = (): MenuEntry[] => [
    {
      label: 'Advisor',
      sub: 'runs every check',
      run: () => {
        setCTab('msgs');
        toast(messages.length ? `${messages.length} finding${messages.length > 1 ? 's' : ''} · see Messages` : 'Advisor: nothing to report', errors.length ? 'bad' : 'ok');
      },
    },
    { label: 'Show Layout Columns', checked: showCols, run: () => setShowCols(v => !v) },
    { label: 'Hide Empty Positions', checked: hideEmpty, run: () => setHideEmpty(v => !v) },
    // APEX: Utilities › Show (UX map line 26). Text Messages Picker is absent: ours, no messages picker exists yet.
    {
      label: 'Show',
      items: [
        { label: 'Tooltips', checked: tooltips, run: () => setTooltips(!tooltips) },
        {
          label: 'Layout View',
          checked: layoutView,
          run: () => {
            const next = !layoutView;
            setLayoutView(next);
            if (next) setCTab('layout');
            else if (cTab === 'layout') setCTab('cv');
          },
        },
      ],
    },
    // APEX: Utilities › Layout (UX map lines 14–16). Two Pane Mode hides the left pane.
    {
      label: 'Layout',
      items: [
        { label: 'Two Pane Mode', checked: paneMode === 'two', run: () => setPaneMode('two') },
        { label: 'Three Pane Mode', checked: paneMode === 'three', run: () => setPaneMode('three') },
        '-',
        { label: 'Reset Layout', k: 'Alt+F11', run: resetLayout },
      ],
    },
    '-',
    { label: 'Expand All', run: () => expandAll(true) },
    { label: 'Collapse All', run: () => expandAll(false) },
    '-',
    { label: 'Export Page (JSON)', run: () => setSheet('export') },
    { label: 'History', sub: `${revisions.length} revision${revisions.length === 1 ? '' : 's'}`, run: () => setSheet('history') },
    { label: 'Keyboard Shortcuts', k: 'Alt+Shift+F1', run: () => setSheet('shortcuts') },
    '-',
    // A deleted page (P1.12) offers the two actions it still takes in Delete Page's place.
    ...(deletedAt !== null
      ? ([
          { label: 'Reinstate', sub: 'brings the page back as it was', disabled: readOnlyProp || busy !== null, run: () => void reinstatePage() },
          { label: 'Delete permanently…', sub: 'removes it for good, now', disabled: readOnlyProp || busy !== null, run: () => setSheet('purge') },
        ] as MenuEntry[])
      : ([
          {
            label: 'Delete Page…',
            sub: routeFile ? 'the route file is still in the code' : code ? 'the page is still in the code’s registry' : `${revisions.length} revision${revisions.length === 1 ? '' : 's'} go with it`,
            disabled: readOnly || code,
            run: () => setSheet('delete'),
          },
        ] as MenuEntry[])),
  ];
  const contextMenu = (atPos: MenuAt, picked: Selection) => {
    // A right-click on a region inside a set of regions acts on the whole set.
    const sel: Selection = picked.kind === 'region' && effective.kind === 'regions' && effective.ids.includes(picked.id) ? effective : picked;
    const entries: MenuEntry[] = [];
    const tail: MenuEntry[] = ['-', { label: 'Expand All', run: () => expandAll(true) }, { label: 'Collapse All', run: () => expandAll(false) }, { label: 'Help', k: 'Alt+F1', run: () => setCTab('help') }];
    if (sel.kind === 'region') {
      const r = doc.regions.find(x => x.id === sel.id);
      if (!r) return;
      const siblings = doc.regions.filter(x => x.position === r.position);
      const i = siblings.findIndex(x => x.id === r.id);
      entries.push(
        { head: regionName(r) },
        { label: 'Create Region below', sub: 'Static Content', disabled: readOnly, run: () => {
          const a = addRegion(doc, 'static', { position: r.position, after: r.id, newRow: true }, regionDefaults);
          commit(a.doc, 'Static Content created. Its attributes are in the Property Editor.');
          select({ kind: 'region', id: a.id });
        } },
        { label: 'Create Dynamic Action', sub: 'click on this region', disabled: readOnly, run: () => createAction({ region: r.id }) },
        '-',
        { label: 'Duplicate', disabled: readOnly, run: () => act.duplicate(r.id) },
        { label: 'Move Up', disabled: readOnly || i <= 0, run: () => act.move(r.id, -1) },
        { label: 'Move Down', disabled: readOnly || i >= siblings.length - 1, run: () => act.move(r.id, 1) },
        { label: r.hidden ? 'Show at first' : 'Hide at first', sub: r.hidden ? '' : 'a dynamic action shows it', disabled: readOnly, run: () => commit(patchRegion(doc, r.id, x => ({ ...x, hidden: !x.hidden })), r.hidden ? 'Shown at first.' : 'Hidden at first.') },
        // APEX: Comment Out / Uncomment (run 13): the region stays with all it holds and leaves the page when it runs (P1.11).
        {
          label: r.commentedOut ? 'Uncomment' : 'Comment Out',
          sub: r.commentedOut ? '' : 'excluded when the page runs',
          disabled: readOnly,
          run: () =>
            commit(
              patchRegion(doc, r.id, x => {
                const next: typeof x = { ...x };
                delete next.commentedOut;
                return r.commentedOut ? next : { ...next, commentedOut: true };
              }),
              r.commentedOut ? `${regionName(r)} uncommented.` : `${regionName(r)} commented out.`,
            ),
        },
        '-',
        { label: 'Delete', k: 'Del', disabled: readOnly, run: () => act.remove(r.id) },
      );
    } else if (sel.kind === 'position') {
      entries.push({ head: sel.id }, { label: 'Create Region here', sub: 'Static Content', disabled: readOnly || !open.includes(sel.id), run: () => act.addRegion('static', sel.id) });
    } else if (sel.kind === 'page') {
      entries.push(
        { head: `Page ${number}` },
        { label: 'Create Region', sub: `Static Content in ${PD_POSITION[home].label}`, disabled: readOnly, run: () => act.addRegion('static', home) },
        { label: 'Create Dynamic Action', sub: 'on page load', disabled: readOnly, run: () => createAction() },
      );
    } else if (sel.kind === 'shared') {
      entries.push({ head: 'Shared component' }, { label: 'Edit in Shared Components', run: () => onWorkspace('shared') });
    } else if (sel.kind === 'action') {
      const a = doc.actions.find(x => x.id === sel.id);
      if (!a) return;
      entries.push({ head: a.name || a.id }, { label: 'Create TRUE Action', disabled: readOnly, run: () => act.addEffect(a.id) }, '-', { label: 'Delete', k: 'Del', disabled: readOnly, run: () => act.removeAction(a.id) });
    } else if (sel.kind === 'effect') {
      const a = doc.actions.find(x => x.id === sel.id);
      if (!a) return;
      entries.push({ head: 'Action' }, { label: 'Back to the dynamic action', run: () => select({ kind: 'action', id: a.id }) }, '-', { label: 'Delete', k: 'Del', disabled: readOnly || a.do.length <= 1, run: () => act.removeEffect(a.id, sel.index) });
    } else if (sel.kind === 'regions') {
      entries.push({ head: `${sel.ids.length} regions` }, { label: 'Delete', k: 'Del', disabled: readOnly, run: () => removeRegions(sel.ids) });
    } else {
      entries.push({ head: 'System process' }, { label: 'System process · read-only', disabled: true, run: () => {} });
    }
    setMenu({ at: atPos, entries: [...entries, ...tail] });
  };
  const deleteSelection = () => {
    if (readOnly) return;
    if (effective.kind === 'region') act.remove(effective.id);
    else if (effective.kind === 'regions') removeRegions(effective.ids);
    else if (effective.kind === 'action') act.removeAction(effective.id);
    else if (effective.kind === 'effect') {
      const a = doc.actions.find(x => x.id === effective.id);
      if (a && a.do.length > 1) act.removeEffect(effective.id, effective.index);
    }
  };
  // Reset Layout (APEX: Utilities › Layout › Reset Layout, UX map line 14): the
  // pane widths, the pane mode and the expanded centre return to the defaults,
  // and the remembered layout is forgotten. Alt+F11 is ours.
  const resetLayout = () => {
    panesRef.current?.style.removeProperty('--lw');
    panesRef.current?.style.removeProperty('--rw');
    setExpandedLayout(false);
    // The widths and the mode only (UX map line 14): Tooltips and Layout View are Show's, not Layout's.
    writeLayoutMemory({ paneMode: undefined, lw: undefined, rw: undefined });
    toast('Layout reset');
  };
  // The remembered splitter widths land on the grid once it exists; a release
  // of a splitter writes them back (the splitters call rememberWidths).
  const rememberWidths = () => {
    const style = panesRef.current?.style;
    writeLayoutMemory({ lw: style?.getPropertyValue('--lw') || undefined, rw: style?.getPropertyValue('--rw') || undefined });
  };
  useEffect(() => {
    const m = readLayoutMemory();
    if (m.lw) panesRef.current?.style.setProperty('--lw', m.lw);
    if (m.rw) panesRef.current?.style.setProperty('--rw', m.rw);
  }, []);
  /** A hover tip, unless Utilities › Show › Tooltips is off. */
  const tip = (text: string | undefined) => (tooltips ? text : undefined);
  // The Layout tab's menu (APEX, UX map lines 47–48).
  const layoutMenu = (): MenuEntry[] => [
    {
      label: 'Display from Here',
      sub: effective.kind === 'region' ? regionName(doc.regions.find(r => r.id === effective.id) ?? doc.regions[0]) : 'select a region',
      disabled: effective.kind !== 'region',
      run: () => {
        if (effective.kind === 'region') setLayoutRoot(effective.id);
      },
    },
    { label: 'Display from Page', disabled: rootLive === null, run: () => setLayoutRoot(null) },
  ];

  // ----------------------------------------------------------- keyboard
  // One listener for the designer's life, reading the latest handler through a
  // ref that is written after each render.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  const onKey = (e: KeyboardEvent) => {
    const tag = document.activeElement?.tagName ?? '';
    const inField = /INPUT|TEXTAREA|SELECT/.test(tag);
    if (menu || sheet || conflict || creating) return;
    if (e.altKey && e.shiftKey && e.key === 'F1') return void (e.preventDefault(), setSheet('shortcuts'));
    if (e.altKey && e.key === 'F1') return void (e.preventDefault(), setCTab('help'));
    if (e.altKey && e.key === 'F7') return void (e.preventDefault(), save());
    if (e.altKey && e.key === 'F8') return void (e.preventDefault(), saveAndRun());
    if (e.altKey && e.key === 'F11') return void (e.preventDefault(), resetLayout());
    if (e.altKey && e.shiftKey && (e.key === 'PageUp' || e.key === 'PageDown')) return void (e.preventDefault(), step(e.key === 'PageUp' ? -1 : 1));
    if (e.altKey && !e.shiftKey && /^[1-6]$/.test(e.key)) {
      e.preventDefault();
      const n = Number(e.key);
      if (n <= 4) {
        setLeftTab(LEFT_TABS[n - 1].key);
        setPaneMode('three');
      }
      else if (n === 5) setCTab('layout');
      else filterRef.current?.focus();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !inField && e.key.toLowerCase() === 'z') return void (e.preventDefault(), undo());
    if ((e.ctrlKey || e.metaKey) && !inField && e.key.toLowerCase() === 'y') return void (e.preventDefault(), redo());
    if (e.shiftKey && e.key === 'F10') return void (e.preventDefault(), contextMenu({ x: window.innerWidth - 400, y: 120 }, effective));
    if (e.key === 'Escape' && !inField) return void (effective.kind !== 'page' && select(PAGE_SELECTION));
    if (e.key === 'Delete' && !inField) deleteSelection();
  };
  useEffect(() => {
    keys.current = onKey;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keys.current(e);
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // ----------------------------------------------------------- splitters
  const splitter = (side: 'left' | 'right') => {
    let start: { x: number; w: number } | null = null;
    const cssVar = side === 'left' ? '--lw' : '--rw';
    const fallback = side === 'left' ? 282 : 372;
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={side === 'left' ? 'Resize the left pane' : 'Resize the right pane'}
        title={tip('Drag to resize · Alt+F11 resets the layout')}
        className="z-[3] cursor-col-resize bg-border-strong hover:bg-edit"
        onPointerDown={e => {
          const panes = panesRef.current;
          if (!panes) return;
          start = { x: e.clientX, w: parseFloat(getComputedStyle(panes).getPropertyValue(cssVar)) || fallback };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          if (!start || !panesRef.current) return;
          const dx = e.clientX - start.x;
          const w = Math.max(side === 'left' ? 200 : 280, Math.min(side === 'left' ? 520 : 640, start.w + (side === 'left' ? dx : -dx)));
          panesRef.current.style.setProperty(cssVar, `${w}px`);
        }}
        onPointerUp={() => {
          start = null;
          rememberWidths();
        }}
        onPointerCancel={() => {
          start = null;
        }}
      />
    );
  };

  // ------------------------------------------------------------- panes
  const ctx: PropsContext = {
    page,
    doc,
    stored,
    readOnly,
    schemes: schemeList,
    assets,
    lists,
    pages,
    namedBy: detail.namedBy,
    shortcuts,
    buildOptions: Object.fromEntries((buildOptions ?? []).map(b => [b.key, b.status])),
    templates,
    shared,
    attrs,
    attrsStored: attrsOf(page),
    setAttrs: fn => setAttrs(d => fn(d)),
    commit,
    select: sel => select(sel),
    openShared: sc => onWorkspace('shared', sc),
    act,
    fieldId: name => `${uid}-${name}`,
  };
  const pe = groupsFor(ctx, effective);
  const usedShortcuts = [...new Set(doc.regions.flatMap(r => (r.kind === 'static' ? [...r.text.matchAll(SHORTCUT_TOKEN)].map(m => m[1]) : [])))];
  const usage = {
    theme: themeDefault,
    schemes: [...new Set([page.authz ?? 'public', ...doc.regions.map(r => r.authz ?? 'public')])].map(k => schemeList.find(s => s.key === k)?.label ?? k),
    shortcuts: usedShortcuts,
    assets: [...new Set(doc.regions.flatMap(r => (r.kind === 'image' && r.assetId ? [r.assetId] : [])))],
    lists: [...new Set(doc.regions.flatMap(r => (r.kind === 'list' ? [lists.find(l => l.key === r.listKey)?.label ?? r.listKey] : [])))],
  };
  const hits = searchPage(searchQuery, doc, page, { ...searchOpts, pages });
  const statusText = status
    ? status.text
    : deletedAt !== null
      ? `Deleted ${when(deletedAt)} · read-only until reinstated`
    : readOnly
      ? 'Read-only here: edits are made on production.'
      : dirty
        ? `Unsaved changes${newest ? ` · revision ${newest.id.slice(0, 8)}` : ''}`
        : newest
          ? `Revision ${newest.id.slice(0, 8)} · ${newest.publishedAt ? 'live' : 'draft'} from ${when(newest.createdAt)}${live && newest.id !== live.id ? ` · live from ${when(live.publishedAt ?? live.createdAt)}` : ''}`
          : code
            ? `Page ${number} · stored ${page.updatedAt ? when(page.updatedAt) : 'no row'}`
            : 'No revision yet · saved';
  const selectedName = pe.head.name;

  return (
    <div className={`grid h-full min-h-0 ${deletedAt !== null ? 'grid-rows-[44px_auto_minmax(0,1fr)]' : 'grid-rows-[44px_minmax(0,1fr)]'} text-12-5 text-text`} aria-label="Page Designer">
      {/* ---------------------------------------------------------- toolbar */}
      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden border-b border-border-strong bg-surface px-2.5">
        <div className={GRP}>
          {/* Called without the click event: onBack's argument is a group filter (Create › Page Group…), never the event. */}
          <button type="button" className={IB} title={tip('Application home')} aria-label="Back to all pages" onClick={() => onBack()}>
            <ArrowLeft size={14} />
          </button>
          <div className="flex h-[30px] items-center border border-border-strong">
            <input
              type="text"
              value={numInput}
              aria-label="Page number"
              title={tip('Page number · type and press Enter')}
              className="h-[28px] w-[84px] border-r border-border-strong bg-bg px-2 text-center font-mono text-12 text-text focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--edit)]"
              onChange={e => setNumInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && openByNumber()}
            />
            <span className="max-w-[220px] truncate px-2.5 text-12 font-semibold text-text" title={tip(page.path)}>
              {page.name}
            </span>
            <button type="button" className="grid h-[28px] w-7 place-items-center border-l border-border-strong text-text-muted hover:bg-surface-elevated hover:text-text" title={tip('Page Finder')} aria-label="Page Finder" onClick={() => setSheet('finder')}>
              <Search size={12} />
            </button>
            <button type="button" className="grid h-[28px] w-7 place-items-center border-l border-border-strong text-text-muted hover:bg-surface-elevated hover:text-text" title={tip('Previous page (Alt+Shift+PgUp)')} aria-label="Previous page" onClick={() => step(-1)}>
              <ChevronLeft size={12} />
            </button>
            <button type="button" className="grid h-[28px] w-7 place-items-center border-l border-border-strong text-text-muted hover:bg-surface-elevated hover:text-text" title={tip('Next page (Alt+Shift+PgDn)')} aria-label="Next page" onClick={() => step(1)}>
              <ChevronRight size={12} />
            </button>
          </div>
          <button
            type="button"
            className={`${IB} relative`}
            title={tip(messages.length ? `Show Messages · ${messages.length}` : 'Show Messages · none')}
            aria-label="Show Messages"
            onClick={() => setCTab('msgs')}
          >
            <TriangleAlert size={13} className={errors.length ? 'text-negative' : messages.length ? 'text-[color:var(--amber,#e0a52d)]' : ''} />
            {messages.length > 0 && <span className="absolute -right-0.5 -top-0.5 font-mono text-8 text-text-muted">{messages.length}</span>}
          </button>
          <button
            type="button"
            className={IB}
            aria-pressed="true"
            title={tip(`Page lock · the revision you loaded is checked on every save${newest ? `: ${newest.id.slice(0, 8)}` : ''}`)}
            aria-label="Page lock"
            onClick={() => toast('Every save checks the revision you loaded; a newer one refuses your save and offers Reload.')}
          >
            <Lock size={13} />
          </button>
        </div>
        <div className={GRP}>
          <button type="button" className={IB} title={tip('Undo (Ctrl+Z)')} aria-label="Undo" disabled={past.length === 0} onClick={undo}>
            <Undo2 size={14} />
          </button>
          <button type="button" className={IB} title={tip('Redo (Ctrl+Y)')} aria-label="Redo" disabled={future.length === 0} onClick={redo}>
            <Redo2 size={14} />
          </button>
        </div>
        <div className={GRP}>
          <button ref={createBtn} type="button" className={TB} aria-haspopup="menu" onClick={() => setMenu({ at: anchorOf(createBtn.current), entries: createMenu() })}>
            <Plus size={13} /> Create <span className="text-10 text-text-faint">▾</span>
          </button>
          <button ref={utilBtn} type="button" className={TB} aria-haspopup="menu" onClick={() => setMenu({ at: anchorOf(utilBtn.current), entries: utilitiesMenu() })}>
            <Wrench size={13} /> Utilities <span className="text-10 text-text-faint">▾</span>
          </button>
          <button type="button" className={TB} title={tip('Shared Components')} onClick={() => onWorkspace('shared')}>
            <Puzzle size={13} /> Shared Components
          </button>
        </div>
        <span className={`min-w-0 flex-1 truncate text-right font-mono text-10 ${status?.cls === 'bad' ? 'text-negative' : status?.cls === 'ok' ? 'text-positive' : 'text-text-faint'}`} role="status">
          {statusText}
        </span>
        <div className={GRP}>
          <button type="button" className={TB_PRIMARY} title={tip('Save (Alt+F7)')} disabled={readOnly || busy !== null || !dirty} onClick={() => void save()}>
            {busy === 'save' ? <RefreshCw size={13} className="animate-spin" /> : null}
            Save
          </button>
          <button
            type="button"
            className={TB_PRIMARY}
            title={tip('Publish the newest revision')}
            disabled={readOnly || busy !== null || (!docDirty && !unpublishedNewest && !attrsDirty)}
            onClick={() => void publish()}
          >
            {busy === 'publish' ? <RefreshCw size={13} className="animate-spin" /> : null}
            Publish
          </button>
          <button type="button" className={TB_RUN} title={tip('Save and Run Page (Alt+F8)')} disabled={readOnly || busy !== null} onClick={() => void saveAndRun()}>
            {busy === 'run' ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
            Save and Run Page
          </button>
        </div>
      </div>

      {/* A deleted page's banner (P1.12): what happened, the window, the way back. */}
      {deletedAt !== null && (
        <div role="note" aria-label="Deleted page" className="flex min-w-0 items-center gap-2 border-b border-border-strong bg-edit-dim px-3 py-1.5 text-12 text-text">
          <TriangleAlert size={13} className="shrink-0 text-[color:var(--amber,#e0a52d)]" />
          <span className="min-w-0 truncate">
            Deleted on {when(deletedAt).slice(0, 10)} by {page.deletedBy ?? 'an administrator'} ·{' '}
            {daysLeft(deletedAt) === 0 ? 'past its recovery window, can be removed for good' : `${daysLeft(deletedAt)} of ${RECOVERY_DAYS} days left`} · read-only until reinstated (Utilities › Reinstate)
          </span>
        </div>
      )}

      {/* ------------------------------------------------------------ panes */}
      <div
        ref={panesRef}
        className="grid min-h-0 min-w-0"
        data-panes={expandedLayout ? 'expanded' : paneMode}
        style={{ gridTemplateColumns: expandedLayout ? 'minmax(0, 1fr)' : paneMode === 'two' ? 'minmax(0, 1fr) 5px var(--rw, 372px)' : 'var(--lw, 282px) 5px minmax(0, 1fr) 5px var(--rw, 372px)' }}
      >
        {paneMode === 'three' && !expandedLayout && (
          <>
        <div className="flex min-h-0 min-w-0 flex-col bg-surface">
          <div className="flex border-b border-border bg-surface-elevated" role="tablist" aria-label="Left pane">
            {LEFT_TABS.map((t, i) => {
              const Icon = [Layers, Zap, RefreshCw, Puzzle][i];
              const n = t.key === 'da' ? doc.actions.length : 0;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={leftTab === t.key}
                  aria-label={t.label}
                  title={tip(`${t.label} (${t.k})`)}
                  className={`relative h-[34px] flex-1 border-r border-border last:border-r-0 ${leftTab === t.key ? 'bg-surface text-text shadow-[inset_0_-2px_0_var(--amber,#e0a52d)]' : 'text-text-faint hover:text-text'}`}
                  onClick={() => setLeftTab(t.key)}
                >
                  <Icon size={14} className="mx-auto" />
                  {n > 0 && <span className="absolute right-1.5 top-1 font-mono text-8 text-[color:var(--amber,#e0a52d)]">{n}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
            <input
              type="search"
              value={treeQuery}
              placeholder="Filter this tree"
              aria-label="Filter the tree"
              className="h-7 min-w-0 flex-1 border border-border-strong bg-bg px-2 text-12 text-text focus:border-edit focus:outline-none"
              onChange={e => setTreeQuery(e.target.value)}
            />
            <button type="button" className="grid h-7 w-7 place-items-center border border-transparent text-text-muted hover:border-border-strong hover:text-text" title={tip('Expand all')} aria-label="Expand all" onClick={() => expandAll(true)}>
              <Maximize2 size={12} />
            </button>
            <button type="button" className="grid h-7 w-7 place-items-center border border-transparent text-text-muted hover:border-border-strong hover:text-text" title={tip('Collapse all')} aria-label="Collapse all" onClick={() => expandAll(false)}>
              <Minimize2 size={12} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <PageDesignerTree
              page={page}
              doc={doc}
              tab={leftTab}
              query={treeQuery}
              selection={effective}
              markers={markers}
              expanded={expanded}
              shared={shared}
              usage={usage}
              pages={pages}
              onToggle={toggleExpanded}
              onSelect={(sel, opts) => select(sel, { toggle: opts?.toggle })}
              onContext={contextMenu}
              onDragStart={beginDrag}
              onTab={setLeftTab}
              onCreateAction={() => createAction()}
              onOpenShared={sc => onWorkspace('shared', sc)}
              readOnly={readOnly}
            />
          </div>
        </div>
        {splitter('left')}
          </>
        )}

        <div className="grid min-h-0 min-w-0 grid-rows-[34px_minmax(0,1fr)_auto] bg-bg">
          <div className="flex overflow-x-auto border-b border-border bg-surface-elevated" role="tablist" aria-label="Centre pane">
            {(layoutView ? CENTRE_TABS : CENTRE_TABS.filter(t => t.key !== 'layout')).map(t => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={cTab === t.key}
                title={tip(t.k)}
                className={`h-[34px] whitespace-nowrap border-r border-border px-3 font-mono text-9 uppercase tracking-[0.12em] ${cTab === t.key ? 'bg-bg text-text shadow-[inset_0_-2px_0_var(--amber,#e0a52d)]' : 'text-text-faint hover:text-text'}`}
                onClick={() => setCTab(t.key)}
              >
                {t.label}
                {t.key === 'msgs' && (
                  <span className={`ml-1.5 rounded-lg border px-1.5 normal-case tracking-normal ${errors.length ? 'border-negative text-negative' : messages.length ? 'border-[color:var(--amber,#e0a52d)] text-[color:var(--amber,#e0a52d)]' : 'border-border-strong text-text-faint'}`}>
                    {messages.length}
                  </span>
                )}
              </button>
            ))}
            <span className="flex-1" />
            <button type="button" className={`px-3 font-mono text-9 uppercase tracking-[0.1em] ${hideEmpty ? 'text-edit' : 'text-text-faint hover:text-text'}`} aria-pressed={hideEmpty} onClick={() => setHideEmpty(v => !v)}>
              Hide empty positions
            </button>
            {cTab === 'layout' && (
              // APEX: the Layout tab's menu, right side of the tab (UX map line 48).
              <button
                type="button"
                className={`px-3 font-mono text-9 uppercase tracking-[0.1em] ${rootLive !== null ? 'text-edit' : 'text-text-faint hover:text-text'}`}
                aria-haspopup="menu"
                title={tip('Display from Here · Display from Page')}
                onClick={e => setMenu({ at: anchorOf(e.currentTarget), entries: layoutMenu() })}
              >
                Layout ▾
              </button>
            )}
            {/* APEX: Expand grows the Layout tab to fill the designer; Restore returns (UX map line 46). */}
            <button
              type="button"
              className={`px-3 font-mono text-9 uppercase tracking-[0.1em] ${expandedLayout ? 'text-edit' : 'text-text-faint hover:text-text'}`}
              aria-pressed={expandedLayout}
              aria-label={expandedLayout ? 'Restore the panes' : 'Expand the Layout tab'}
              title={tip(expandedLayout ? 'Restore the panes' : 'Expand the Layout tab')}
              onClick={() => setExpandedLayout(v => !v)}
            >
              {expandedLayout ? 'Restore' : 'Expand'}
            </button>
          </div>
          <div className="min-h-0 min-w-0 overflow-auto" onDragOver={e => drag && e.preventDefault()}>
            {cTab === 'layout' && (
              <PageDesignerLayout
                page={page}
                doc={doc}
                selection={effective}
                markers={markers}
                assets={assets}
                lists={lists}
                pages={pages}
                shared={shared}
                hideEmpty={hideEmpty}
                showCols={showCols}
                drag={drag}
                readOnly={readOnly}
                onSelect={(sel, opts) => select(sel, { rename: opts?.rename, group: opts?.rename ? 'Identification' : undefined, toggle: opts?.toggle })}
                onContext={contextMenu}
                onDragStart={beginDrag}
                onDrop={onDrop}
                onEditShared={sc => onWorkspace('shared', sc)}
                root={rootLive}
              />
            )}
            {cTab === 'cv' && <ComponentView page={page} doc={doc} selection={effective} assets={assets} lists={lists} pages={pages} onSelect={sel => select(sel)} />}
            {cTab === 'msgs' && <MessagesTab messages={messages} onPick={m => select(m.sel, { group: m.group })} />}
            {cTab === 'search' && <PageSearchTab query={searchQuery} onQuery={setSearchQuery} options={searchOpts} onOptions={setSearchOpts} hits={hits} onPick={h => select(h.sel)} />}
            {cTab === 'help' && <HelpTab helpFor={helpFor?.label ?? null} helpText={helpFor?.text ?? null} selected={selectedName} />}
          </div>
          <Gallery
            tab={gTab}
            onTab={setGTab}
            disabled={readOnly}
            components={componentTiles}
            showLegacy={showLegacy}
            onShowLegacy={setShowLegacy}
            tooltips={tooltips}
            onAdd={kind => act.addRegion(kind, home)}
            onAddComponent={key => act.addComponent(key, home)}
            onAddTo={(kind, pos) => act.addRegion(kind, pos)}
            onAddComponentTo={(key, pos) => act.addComponent(key, pos)}
            onDragStart={beginDrag}
            onContext={(at, t) =>
              // APEX: the Gallery's context menu, Add To, then the location (UX map lines 17 and 53).
              setMenu({
                at,
                entries: [{ head: t.name }, { label: 'Add To', items: openPositions(page).map(pos => ({ label: PD_POSITION[pos].label, disabled: readOnly, run: () => t.addTo(pos) })) }],
              })
            }
          />
        </div>
        {!expandedLayout && (
          <>
        {splitter('right')}

        <PropertyPane
          head={pe.head}
          groups={pe.groups}
          attributes={pe.attributes}
          focusGroup={focusGroup}
          filterRef={filterRef}
          onHelpFor={(label, text) => setHelpFor(label ? { label, text } : null)}
        />
          </>
        )}
      </div>

      {menu && <Menu at={menu.at} entries={menu.entries} onClose={() => setMenu(null)} />}
      <Toasts items={toasts} />

      {creating && (
        <CreatePageDialog
          pages={pages}
          onClose={() => setCreating(false)}
          onCreated={p => {
            setCreating(false);
            onCreated(p);
          }}
        />
      )}
      {groupsOpen && (
        // The page's group as the Property Editor's draft shows it (Identification › Page Group), saved or not.
        <PageGroupsSheet
          pages={pages}
          current={attrs.group}
          onShow={f => {
            setGroupsOpen(false);
            onBack(f);
          }}
          onClose={() => setGroupsOpen(false)}
        />
      )}
      {conflict && (
        <Sheet
          title="This page was saved again after you loaded it"
          sub="Reload to see what is stored now; your unsaved changes are dropped."
          buttons={[{ label: 'Keep editing' }, { label: 'Reload', primary: true, run: () => onSaved(conflict) }]}
          onClose={() => setConflict(null)}
        >
          <p className="m-0 px-[18px] py-3 text-12 text-text-muted">
            The newest revision is now {conflict.newest ? conflict.newest.id.slice(0, 8) : 'none'}; the row was stored {conflict.page.updatedAt ? when(conflict.page.updatedAt) : 'at an unknown time'}.
          </p>
        </Sheet>
      )}
      {sheet === 'finder' && (
        <Sheet title="Page Finder" sub="Every page in application 100." onClose={() => setSheet(null)}>
          <div className="flex items-center gap-2 border-b border-border-strong bg-surface px-[18px] py-2.5">
            <input
              type="search"
              autoFocus
              value={finderQuery}
              placeholder="Search by number, name or path"
              aria-label="Search pages"
              className="h-[32px] w-full max-w-[420px] border border-border-strong bg-bg px-2.5 text-13 text-text focus:border-edit focus:outline-none"
              onChange={e => setFinderQuery(e.target.value)}
            />
            <span className="flex-1" />
            <div className="flex border border-border-strong" role="group" aria-label="Which pages">
              {(
                [
                  [false, 'All pages'],
                  [true, 'Recently edited'],
                ] as [boolean, string][]
              ).map(([recent, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={finderRecent === recent}
                  className={`h-[30px] px-3 text-12 ${finderRecent === recent ? 'bg-edit-dim font-semibold text-text' : 'text-text-muted hover:text-text'}`}
                  onClick={() => setFinderRecent(recent)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            {finderPages.length === 0 && <p className="m-0 px-[18px] py-4 text-13 text-text-faint">No page matches.</p>}
            {finderPages.map(p => (
              <button
                key={p.id}
                type="button"
                className={`flex w-full items-baseline gap-2.5 border-b border-border px-[18px] py-2 text-left text-13 text-text hover:bg-surface-elevated ${p.id === page.id ? 'bg-surface-elevated shadow-[inset_2px_0_0_var(--edit)]' : ''}`}
                onClick={() => {
                  setSheet(null);
                  if (p.id !== page.id) onOpenPage(p.id!);
                }}
              >
                <span className="font-mono text-11 text-text-faint">{p.id!.slice(0, 8)}</span>
                <span className="font-semibold">{p.name}</span>
                <span className="text-12 text-text-muted">{p.group ?? ''}</span>
                <span className="ml-auto whitespace-nowrap font-mono text-10 text-text-faint">{p.path}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet === 'delete' && (
        <Sheet
          title="Delete Page"
          sub={`${page.name} · ${page.path}`}
          onClose={() => setSheet(null)}
          buttons={[{ label: 'Cancel' }, { label: 'Delete this page', danger: true, disabled: busy !== null, run: () => void deletePage() }]}
        >
          <p className="m-0 px-[18px] py-3 text-13 text-text">
            The page moves to Deleted: readers find nothing at {page.path} from then on, and its address stays reserved. Reinstate it from the pages list within {RECOVERY_DAYS} days;
            after that it can be removed for good, with its {revisions.length} revision{revisions.length === 1 ? '' : 's'}. The header, the footer and the phone bar are shared and stay.
          </p>
          {named.length > 0 && (
            <p className="m-0 px-[18px] pb-3 text-13 text-text">
              Named by {named.join(' · ')}. Their entries and buttons show nothing while the page is deleted and come back with Reinstate; Delete permanently is refused while a live page names it.
            </p>
          )}
        </Sheet>
      )}
      {sheet === 'purge' && (
        <Sheet
          title="Delete permanently"
          sub={`${page.name} · ${page.path}`}
          onClose={() => setSheet(null)}
          buttons={[{ label: 'Cancel' }, { label: 'Delete permanently', danger: true, disabled: busy !== null, run: () => void purgePage() }]}
        >
          <p className="m-0 px-[18px] py-3 text-13 text-text">
            The page is removed for good with its {revisions.length} revision{revisions.length === 1 ? '' : 's'}, and {page.path} is free for a new page. A menu entry naming it goes with it.
            Refused while a live page names it. This cannot be undone.
          </p>
        </Sheet>
      )}
      {sheet === 'export' && (
        <Sheet title={`Page ${number} as JSON`} sub="The document the newest revision stores, with your unsaved changes." onClose={() => setSheet(null)}>
          <textarea readOnly aria-label="Page document" className="min-h-[50vh] w-full border-0 bg-bg p-3 font-mono text-11 text-text focus:outline-none" value={JSON.stringify({ page: { id: page.id, path: page.path, name: page.name }, document: doc }, null, 2)} />
        </Sheet>
      )}
      {sheet === 'history' && (
        <Sheet title="History" sub="Revisions are rows, never overwritten; the live one is what readers see." onClose={() => setSheet(null)}>
          <dl className="m-0 grid grid-cols-[150px_1fr] gap-x-2.5 gap-y-1.5 px-[18px] py-3 text-12">
            <dt className="text-text-faint">Newest revision</dt>
            <dd className="m-0 font-mono">{newest ? `${newest.id.slice(0, 8)} · ${newest.publishedAt ? 'live' : 'draft'}` : 'none'}</dd>
            <dt className="text-text-faint">Live revision</dt>
            <dd className="m-0 font-mono">{live ? live.id.slice(0, 8) : 'none'}</dd>
            <dt className="text-text-faint">Unsaved</dt>
            <dd className="m-0">{dirty ? 'yes' : 'no'}</dd>
            <dt className="text-text-faint">Undo · redo steps</dt>
            <dd className="m-0 font-mono">
              {past.length} · {future.length}
            </dd>
          </dl>
          <table className="w-full border-collapse border-t border-border text-12">
            <thead>
              <tr className="text-left text-text-faint">
                <th className="px-[18px] py-1.5 font-mono text-9 font-medium uppercase tracking-[0.14em]">Saved</th>
                <th className="px-2.5 py-1.5 font-mono text-9 font-medium uppercase tracking-[0.14em]">State</th>
                <th className="px-2.5 py-1.5 font-mono text-9 font-medium uppercase tracking-[0.14em]">By</th>
                <th className="px-2.5 py-1.5 font-mono text-9 font-medium uppercase tracking-[0.14em]">Revision</th>
              </tr>
            </thead>
            <tbody>
              {revisions.length === 0 && (
                <tr>
                  <td className="px-[18px] py-2 text-text-faint" colSpan={4}>
                    None yet.
                  </td>
                </tr>
              )}
              {revisions.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-[18px] py-1.5 font-mono text-11 text-text-muted">{when(r.createdAt)}</td>
                  <td className="px-2.5 py-1.5 text-text">{r.publishedAt ? (live && live.id === r.id ? 'live' : 'published, superseded') : 'draft'}</td>
                  <td className="px-2.5 py-1.5 font-mono text-11 text-text-faint">{r.author ? r.author.slice(0, 12) : '—'}</td>
                  <td className="px-2.5 py-1.5 font-mono text-9 text-text-faint">{r.id.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sheet>
      )}
      {sheet === 'shortcuts' && (
        <Sheet title="Keyboard Shortcuts" sub="APEX's Page Designer bindings, the Alt set." onClose={() => setSheet(null)}>
          <ShortcutsList />
        </Sheet>
      )}
    </div>
  );
}

function ShortcutsList() {
  const rows: [string, string[]][] = [
    ['Actions', []],
    ['Save', ['Alt+F7']],
    ['Save and Run Page', ['Alt+F8']],
    ['Undo · Redo', ['Ctrl+Z', 'Ctrl+Y']],
    ['Help for the focused property', ['Alt+F1']],
    ['Keyboard shortcuts', ['Alt+Shift+F1']],
    ['Previous · next page', ['Alt+Shift+PgUp', 'Alt+Shift+PgDn']],
    ['Reset Layout', ['Alt+F11']],
    ['Context menu for the selection', ['Shift+F10']],
    ['Delete the selected component', ['Del']],
    ['Select the page', ['Esc']],
    ['Go to', []],
    ['Rendering', ['Alt+1']],
    ['Dynamic Actions', ['Alt+2']],
    ['Processing', ['Alt+3']],
    ['Page Shared Components', ['Alt+4']],
    ['Layout', ['Alt+5']],
    ['Property Editor filter', ['Alt+6']],
  ];
  const items: ReactNode[] = rows.map(([label, keys]) =>
    keys.length === 0 ? (
      <h4 key={label} className="col-span-full m-0 mb-0.5 mt-2.5 font-mono text-9 font-medium uppercase tracking-[0.16em] text-text-faint">
        {label}
      </h4>
    ) : (
      <div key={label} className="flex justify-between gap-3 border-b border-border py-1.5 text-12 text-text-muted">
        <span>{label}</span>
        <span className="whitespace-nowrap">
          {keys.map(k => (
            <kbd key={k} className="ml-1 border border-border-strong bg-bg px-1.5 py-0.5 font-mono text-10 text-text">
              {k}
            </kbd>
          ))}
        </span>
      </div>
    ),
  );
  return <div className="grid grid-cols-2 gap-x-7 px-[18px] py-3">{items}</div>;
}

export { sameSelection };
export type { Position };
