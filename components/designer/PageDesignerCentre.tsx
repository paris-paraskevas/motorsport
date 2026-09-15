'use client';

import type { ReactNode } from 'react';
import { Boxes, Image as ImageIcon, List, MousePointerClick, Pilcrow } from 'lucide-react';
import { REGION_KIND_LABELS, type PageDocument, type Position, type RegionKind } from '@/lib/design/page-document';
import type { PageRow } from '@/lib/design/pages';
import type { EditableAsset } from '@/lib/design/assets';
import {
  PD_POSITION,
  actionName,
  destinationLabel,
  effectText,
  regionName,
  regionSummary,
  selectionCovers,
  showText,
  spanName,
  triggerText,
  type DesignerMessage,
  type SearchHit,
  type Selection,
} from './page-designer-model';
import type { Drag } from './PageDesignerLayout';
import type { MenuAt } from './DesignerMenu';

// The centre pane's other tabs and the gallery (Paddock Designer v2.4):
// Component View (every component as report rows, a row selects), Messages
// (what holds Save and what the designer noticed, a row selects and opens the
// group), Page Search (every attribute value on the page), Help (the focused
// property's help, else how the designer works), and beneath them the Gallery
// with Regions, Items (later), Buttons and Components (the pieces the code
// draws, R2a): drag a tile onto a yellow position, or double-click to add it
// to the Body.

export type CentreTab = 'layout' | 'cv' | 'msgs' | 'search' | 'help';
export type GalleryTab = 'regions' | 'items' | 'buttons' | 'components';

/** A component the gallery offers this page: the catalogue entry, in words. */
export interface ComponentTile {
  key: string;
  name: string;
  desc: string;
  /** A superseded component (the transitional body): listed under Show Legacy, tagged (P1.11). */
  legacy?: true;
  /** Why this page cannot take the tile; set, the tile is drawn with the reason and does nothing. */
  inert?: string;
}

export const CENTRE_TABS: { key: CentreTab; label: string; k?: string }[] = [
  { key: 'layout', label: 'Layout', k: 'Alt+5' },
  { key: 'cv', label: 'Component View' },
  { key: 'msgs', label: 'Messages' },
  { key: 'search', label: 'Page Search' },
  { key: 'help', label: 'Help', k: 'Alt+F1' },
];

const TH = 'whitespace-nowrap px-2.5 py-2 text-left font-mono text-9 font-medium uppercase tracking-[0.14em] text-text-faint';
const TD = 'px-2.5 py-2 align-top';

function Report({ title, cols, rows, selection, onSelect }: { title: string; cols: string[]; rows: { sel: Selection; cells: ReactNode[] }[]; selection: Selection; onSelect: (s: Selection) => void }) {
  return (
    <div>
      <h4 className="m-0 mb-1.5 font-mono text-9 font-medium uppercase tracking-[0.16em] text-text-faint">
        {title} · {rows.length}
      </h4>
      <div className="overflow-x-auto border border-border bg-surface">
        <table className="w-full border-collapse text-12">
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c} className={`${TH} ${c === 'Seq' ? 'text-right' : ''}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className={`${TD} text-text-faint`} colSpan={cols.length}>
                  None
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={i}
                className={`cursor-pointer border-t border-border ${selectionCovers(selection, r.sel) ? 'bg-edit-dim' : 'hover:bg-surface-elevated'}`}
                onClick={() => onSelect(r.sel)}
              >
                {r.cells.map((c, j) => (
                  <td key={j} className={`${TD} ${cols[j] === 'Seq' ? 'text-right font-mono tabular-nums text-text-faint' : 'text-text'}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ComponentView({
  doc,
  selection,
  assets,
  lists,
  onSelect,
}: {
  /** Kept for the caller; the view reads the document alone since the Body became the same on every page. */
  page?: PageRow;
  doc: PageDocument;
  selection: Selection;
  assets: EditableAsset[];
  lists: { key: string; label: string }[];
  onSelect: (s: Selection) => void;
}) {
  const AUTHZ: Record<string, string> = { public: 'Public', signed_in: 'Signed in', contributor: 'Contributor', administrator: 'Administrator' };
  const regions = doc.regions.map(r => ({
    sel: { kind: 'region', id: r.id } as Selection,
    cells: [
      String(r.seq),
      regionName(r),
      REGION_KIND_LABELS[r.kind].label,
      PD_POSITION[r.position].label,
      r.position === 'body' ? `col ${r.column} · ${spanName(r.span)}${r.newRow ? ' · new row' : ''}` : 'stacked',
      r.authz ? (AUTHZ[r.authz] ?? r.authz) : 'Public',
      showText(r) || 'Always',
      r.hidden ? 'hidden at first' : 'no',
    ],
  }));
  const buttons = doc.regions
    .filter(r => r.kind === 'button')
    .map(r => ({
      sel: { kind: 'region', id: r.id } as Selection,
      cells: [String(r.seq), r.kind === 'button' ? r.label : '', PD_POSITION[r.position].label, r.kind === 'button' && r.dest ? destinationLabel(r.dest) : 'dynamic actions only'],
    }));
  const actions = doc.actions.map((a, i) => ({
    sel: { kind: 'action', id: a.id } as Selection,
    cells: [String((i + 1) * 10), actionName(a), triggerText(a.when, doc.regions), a.do.map(e => effectText(e, doc.regions)).join(', ')],
  }));
  return (
    <div className="grid gap-4 px-4 pb-6 pt-3.5">
      <Report title="Regions" cols={['Seq', 'Name', 'Type', 'Position', 'Grid', 'Authorization', 'Shows', 'Hidden']} rows={regions} selection={selection} onSelect={onSelect} />
      <Report title="Buttons" cols={['Seq', 'Label', 'Position', 'Target']} rows={buttons} selection={selection} onSelect={onSelect} />
      <Report title="Dynamic Actions" cols={['Seq', 'Name', 'When', 'Actions']} rows={actions} selection={selection} onSelect={onSelect} />
      {doc.regions.length > 0 && (
        <p className="m-0 text-11 text-text-faint">Source: {doc.regions.map(r => `${regionName(r)}: ${regionSummary(r, assets, lists)}`).join(' · ').slice(0, 400)}</p>
      )}
    </div>
  );
}

export function MessagesTab({ messages, onPick }: { messages: DesignerMessage[]; onPick: (m: DesignerMessage) => void }) {
  if (messages.length === 0) return <p className="m-0 px-4 py-5 text-12 text-text-faint">No messages. Save, Publish and Save and Run Page are clear.</p>;
  return (
    <div className="pb-6 pt-2">
      {messages.map((m, i) => (
        <button
          key={i}
          type="button"
          className="flex w-full gap-2.5 border-b border-border px-4 py-2 text-left text-12 text-text-muted hover:bg-surface-elevated"
          onClick={() => onPick(m)}
        >
          <span className={`w-[52px] shrink-0 pt-[3px] font-mono text-8 uppercase tracking-[0.12em] ${m.level === 'err' ? 'text-negative' : m.level === 'warn' ? 'text-[color:var(--amber,#e0a52d)]' : 'text-positive'}`}>
            {m.level === 'err' ? 'Error' : m.level === 'warn' ? 'Warning' : 'Note'}
          </span>
          <span>
            {m.text}
            {m.group && <span className="mt-0.5 block font-mono text-10 text-text-faint">{m.group}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export interface SearchOptions {
  matchCase: boolean;
  regex: boolean;
}

export function PageSearchTab({
  query,
  onQuery,
  options,
  onOptions,
  hits,
  onPick,
}: {
  query: string;
  onQuery: (q: string) => void;
  /** APEX's Match Case and Regular Expression switches. */
  options: SearchOptions;
  onOptions: (o: SearchOptions) => void;
  hits: SearchHit[];
  onPick: (h: SearchHit) => void;
}) {
  const q = query.trim();
  const where = (value: string): number => {
    if (!q) return -1;
    if (options.regex) {
      try {
        const m = new RegExp(q, options.matchCase ? '' : 'i').exec(value);
        return m ? m.index : -1;
      } catch {
        return -1;
      }
    }
    return options.matchCase ? value.indexOf(q) : value.toLowerCase().indexOf(q.toLowerCase());
  };
  return (
    <div className="grid gap-2.5 px-4 py-3">
      <input
        type="search"
        value={query}
        placeholder="Search every attribute on this page"
        aria-label="Page search"
        className="border border-border-strong bg-bg px-2.5 py-1.5 text-13 text-text focus:border-edit focus:outline-none"
        onChange={e => onQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-4 text-12 text-text-muted">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={options.matchCase} onChange={e => onOptions({ ...options, matchCase: e.target.checked })} /> Match Case
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={options.regex} onChange={e => onOptions({ ...options, regex: e.target.checked })} /> Regular Expression
        </label>
      </div>
      {!q && <p className="m-0 py-3 text-12 text-text-faint">Searches every attribute of every component on this page: names, source text, destinations, positions, dynamic action settings.</p>}
      {q && hits.length === 0 && <p className="m-0 py-3 text-12 text-text-faint">Nothing on this page matches “{q}”.</p>}
      {hits.slice(0, 80).map((h, i) => {
        const at = where(h.value);
        return (
          <button key={i} type="button" className="border border-border bg-surface px-3 py-2 text-left text-12 text-text hover:border-edit" onClick={() => onPick(h)}>
            <span className="block font-mono text-10 text-text-faint">
              {h.what} · {h.where}
            </span>
            <span className="block">
              {at >= 0 ? (
                <>
                  {h.value.slice(Math.max(0, at - 40), at)}
                  <mark className="bg-edit-dim text-text">{h.value.slice(at, at + q.length)}</mark>
                  {h.value.slice(at + q.length, at + q.length + 80)}
                </>
              ) : (
                h.value.slice(0, 120)
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const HOW: [string, string][] = [
  ['Layout', 'The page as a schematic of template positions. Regions are tiles on a twelve-column ruler; their width is Column Span, their order is Sequence. Drag a tile’s header to move it; yellow tiles show where it may land.'],
  ['Gallery', 'Regions, Items, Buttons and Components. Drag a tile onto a yellow drop position, or double-click to add it to the Body. A component is a piece the code draws, with its settings and its rule; a page whose body the code still draws carries it as one component until it is split. Items arrive with a later step.'],
  ['Rendering tree', 'Everything the page renders, in order: Pre-Rendering steps, Components by position, Post-Rendering. Right-click a node for its actions.'],
  ['Property Editor', 'Grouped attributes of the selection. Filter narrows them; Show Common hides the rarely used ones. Click a label for its help.'],
  ['Dynamic Actions', 'Behaviour without code: When (an event on a region or the page) then Actions (show, hide, toggle, scroll to, go), each chosen from lists. The running page executes them.'],
  ['Save · Publish · Save and Run Page', 'Save writes a draft revision (Alt+F7); problems in Messages hold it. Publish makes the newest revision live. Save and Run Page opens a draft in a new tab wearing the developer toolbar (Alt+F8).'],
  ['Shared Components', 'Navigation Menu, Navigation Bar, footer, themes, security, lists and photos. They appear on pages as locked tiles; edit them once, they change everywhere.'],
];

export function HelpTab({ helpFor, helpText, selected }: { helpFor: string | null; helpText: string | null; selected: string }) {
  return (
    <div className="max-w-[720px] px-5 pb-6 pt-4 text-13 leading-relaxed text-text-muted">
      {helpFor && helpText ? (
        <>
          <span className="mb-2 block font-mono text-9 uppercase tracking-[0.16em] text-text-faint">Property help</span>
          <h3 className="m-0 mb-1.5 text-16 font-semibold text-text">{helpFor}</h3>
          <p className="m-0 mb-2.5">{helpText}</p>
          <h4 className="m-0 mb-1 mt-4 text-13 font-semibold text-text">Where it applies</h4>
          <p className="m-0">Selected: {selected}. Click another property’s label to read about it, or press Alt+F1 with a field focused.</p>
        </>
      ) : (
        <>
          <span className="mb-2 block font-mono text-9 uppercase tracking-[0.16em] text-text-faint">Paddock Developer</span>
          <h3 className="m-0 mb-1.5 text-16 font-semibold text-text">How the designer works</h3>
          {HOW.map(([t, p]) => (
            <div key={t}>
              <h4 className="m-0 mb-1 mt-4 text-13 font-semibold text-text">{t}</h4>
              <p className="m-0">{p}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const GALLERY_REGIONS: { kind: RegionKind; icon: ReactNode; name: string; desc: string }[] = [
  { kind: 'static', icon: <Pilcrow size={14} />, name: 'Static Content', desc: 'Your words; a shortcut inserts a house-style line.' },
  { kind: 'image', icon: <ImageIcon size={14} />, name: 'Image', desc: 'One of your photos, with its caption and credit.' },
  { kind: 'list', icon: <List size={14} />, name: 'List', desc: 'One of the navigation lists, as links or cards.' },
];
const GALLERY_BUTTONS: { kind: RegionKind; icon: ReactNode; name: string; desc: string }[] = [
  { kind: 'button', icon: <MousePointerClick size={14} />, name: 'Button', desc: 'Goes to a page or a link, fires dynamic actions, or both.' },
];

export function Gallery({
  tab,
  onTab,
  disabled,
  components,
  onAdd,
  onAddComponent,
  onAddTo,
  onAddComponentTo,
  onDragStart,
  onContext,
  showLegacy,
  onShowLegacy,
  tooltips = true,
}: {
  tab: GalleryTab;
  onTab: (t: GalleryTab) => void;
  /** Read-only: tiles are shown and inert. */
  disabled: boolean;
  /** The components this page may take, from the catalogue; with Show Legacy on, the legacy ones too, inert where the page cannot take them. */
  components: ComponentTile[];
  /** Show Legacy (P1.11; APEX: the Gallery's legacy toggle), on the Components tab. */
  showLegacy: boolean;
  onShowLegacy: (on: boolean) => void;
  onAdd: (kind: RegionKind) => void;
  onAddComponent: (key: string) => void;
  /** Add To a named position (APEX: the Gallery's context menu, the UX map lines 17 and 53). */
  onAddTo: (kind: RegionKind, position: Position) => void;
  onAddComponentTo: (key: string, position: Position) => void;
  onDragStart: (drag: Drag) => void;
  /** A right-click on a tile: the designer opens the menu with Add To and the positions. */
  onContext: (at: MenuAt, tile: { name: string; addTo: (position: Position) => void }) => void;
  /** Utilities › Show › Tooltips: off removes the tiles' hover tips. */
  tooltips?: boolean;
}) {
  type Tile = { id: string; icon: ReactNode; name: string; desc: string; drag: Drag; add: () => void; addTo: (position: Position) => void; legacy?: true; inert?: string };
  const tiles: Tile[] =
    tab === 'regions'
      ? GALLERY_REGIONS.map(t => ({ id: t.kind, icon: t.icon, name: t.name, desc: t.desc, drag: { type: 'gallery', kind: t.kind }, add: () => onAdd(t.kind), addTo: (pos: Position) => onAddTo(t.kind, pos) }))
      : tab === 'buttons'
        ? GALLERY_BUTTONS.map(t => ({ id: t.kind, icon: t.icon, name: t.name, desc: t.desc, drag: { type: 'gallery', kind: t.kind }, add: () => onAdd(t.kind), addTo: (pos: Position) => onAddTo(t.kind, pos) }))
        : tab === 'components'
          ? components.map(c => ({
              id: c.key,
              icon: <Boxes size={14} />,
              name: c.name,
              desc: c.desc,
              drag: { type: 'component', key: c.key },
              add: () => onAddComponent(c.key),
              addTo: (pos: Position) => onAddComponentTo(c.key, pos),
              legacy: c.legacy,
              inert: c.inert,
            }))
          : [];
  const hint =
    tab === 'items'
      ? 'Items arrive with a later step: selects, toggles, a month picker, a search field'
      : tab === 'components'
        ? 'Pieces the code draws, with settings and a rule'
        : 'Drag onto a yellow position, double-click to add to the Body, or right-click for Add To';
  return (
    <div className="min-w-0 border-t border-border-strong bg-surface" aria-label="Gallery">
      <div className="flex items-center border-b border-border">
        {(['regions', 'items', 'buttons', 'components'] as GalleryTab[]).map(t => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            className={`h-7 border-r border-border px-3 font-mono text-9 uppercase tracking-[0.12em] ${tab === t ? 'text-text shadow-[inset_0_-2px_0_var(--amber,#e0a52d)]' : 'text-text-faint hover:text-text'}`}
            onClick={() => onTab(t)}
          >
            {t === 'regions' ? 'Regions' : t === 'items' ? 'Items' : t === 'buttons' ? 'Buttons' : 'Components'}
            {t === 'items' && <span className="ml-1.5 normal-case tracking-normal">later</span>}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3 pr-3 font-mono text-9 tracking-[0.06em] text-text-faint">
          {/* APEX: the Gallery lists the supported components; the legacy ones show under a toggle (P1.11). */}
          {tab === 'components' && (
            <label className="flex items-center gap-1.5 uppercase tracking-[0.12em] hover:text-text">
              <input type="checkbox" checked={showLegacy} onChange={e => onShowLegacy(e.target.checked)} />
              Show Legacy
            </label>
          )}
          <span>{hint}</span>
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto px-3 pb-2.5 pt-2">
        {tiles.map(t => {
          // Read-only, or a tile this page cannot take (P1.11): drawn, and every handler off.
          const off = disabled || t.inert !== undefined;
          return (
            <div
              key={t.id}
              role="button"
              tabIndex={off ? -1 : 0}
              aria-disabled={off}
              aria-label={`Gallery: ${t.name}`}
              title={disabled ? 'Read-only here' : t.inert ? t.inert : tooltips ? 'Drag onto the layout · double-click to add · right-click for Add To' : undefined}
              draggable={!off}
              className={`grid w-[112px] shrink-0 gap-1 border border-border-strong bg-bg px-2 py-1.5 ${off ? 'opacity-50' : 'cursor-grab hover:border-edit'}`}
              onDragStart={e => {
                if (off) return e.preventDefault();
                e.dataTransfer.setData('text/plain', t.id);
                onDragStart(t.drag);
              }}
              onDoubleClick={() => !off && t.add()}
              onContextMenu={e => {
                if (off) return;
                e.preventDefault();
                onContext({ x: e.clientX, y: e.clientY }, { name: t.name, addTo: t.addTo });
              }}
              onKeyDown={e => {
                if (!off && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  t.add();
                }
              }}
            >
              <span className="flex items-center justify-between text-text-muted">
                {t.icon}
                {t.legacy && <span className="font-mono text-8 uppercase tracking-[0.12em] text-text-faint">legacy</span>}
              </span>
              <span className="text-11 font-semibold leading-tight text-text">{t.name}</span>
              <span className="text-10 leading-snug text-text-faint">{t.inert ?? t.desc}</span>
            </div>
          );
        })}
        {tiles.length === 0 && <p className="m-0 py-2 text-11 text-text-faint">{tab === 'components' ? 'Every component this page can take is already on it.' : 'Nothing to drag yet.'}</p>}
      </div>
    </div>
  );
}
