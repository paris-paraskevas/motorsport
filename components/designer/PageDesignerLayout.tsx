'use client';

import type { DragEvent, MouseEvent, ReactNode } from 'react';
import { Boxes, Image as ImageIcon, List, Lock, MousePointerClick, Pilcrow, Puzzle, type LucideIcon } from 'lucide-react';
import { COLUMNS, POSITIONS, REGION_KIND_LABELS, rowsAt, type PageDocument, type Position, type Region, type RegionKind } from '@/lib/design/page-document';
import type { PageRow } from '@/lib/design/pages';
import type { EditableAsset } from '@/lib/design/assets';
import {
  PD_POSITION,
  PD_SHARED,
  regionName,
  regionSummary,
  sameSelection,
  showText,
  spanName,
  type Placement,
  type Selection,
  type SharedKey,
} from './page-designer-model';

// The Layout tab (Paddock Designer v2.4, docs/prototypes/paddock-designer-v2.4,
// renderLayout): the page as a schematic of its template's positions. Shared
// components sit in locked positions (the Header's Navigation Menu, the Footer,
// the Navigation Bar); the page's own positions carry region tiles, the Body on
// a twelve-column ruler with the tiles at their column and span. A tile's header
// drags; yellow drop tiles show where it may land. Since the components
// programme (R2a) the Body is the same on every page: a page whose body the
// code still draws carries it as one component tile among the operator's
// regions; only the Right Side Column waits there. Nothing here renders the
// page; it draws what the document says.

export type Drag = { type: 'gallery'; kind: RegionKind } | { type: 'region'; id: string } | { type: 'component'; key: string };

export const KIND_ICON: Record<RegionKind, LucideIcon> = { static: Pilcrow, image: ImageIcon, list: List, button: MousePointerClick, component: Boxes };

const AUTHZ_LABEL: Record<string, string> = { public: 'Public', signed_in: 'Signed in', contributor: 'Contributor', administrator: 'Administrator' };

export function PageDesignerLayout({
  page,
  doc,
  selection,
  markers,
  assets,
  lists,
  shared,
  hideEmpty,
  showCols,
  drag,
  readOnly,
  onSelect,
  onContext,
  onDragStart,
  onDrop,
  onEditShared,
}: {
  page: PageRow;
  doc: PageDocument;
  selection: Selection;
  /** The worst message per component, `region:<id>`. */
  markers: Record<string, 'err' | 'warn'>;
  assets: EditableAsset[];
  lists: { key: string; label: string }[];
  /** One line under each shared tile: the entries of the list it shows. */
  shared: Record<SharedKey, string>;
  hideEmpty: boolean;
  showCols: boolean;
  drag: Drag | null;
  readOnly: boolean;
  onSelect: (sel: Selection, opts?: { rename?: boolean }) => void;
  onContext: (at: { x: number; y: number }, sel: Selection) => void;
  onDragStart: (drag: Drag) => void;
  onDrop: (drag: Drag, where: Placement) => void;
  /** Edit on a shared tile: the entry opens in Shared Components. */
  onEditShared: (sc: string) => void;
}) {
  // A route file in the code still draws the body: the Right Side Column waits there.
  const code = page.kind === 'code' && page.served !== 'rows';
  const number = page.id ? page.id.slice(0, 8) : 'no row';
  const isSel = (s: Selection) => sameSelection(selection, s);
  const ctx = (sel: Selection) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContext({ x: e.clientX, y: e.clientY }, sel);
  };
  const dropping = drag !== null && !readOnly;

  const dropTile = (label: string, where: Placement, style?: React.CSSProperties) =>
    dropping ? (
      <div
        key={`drop:${where.position}:${where.after ?? ''}:${where.before ?? ''}:${where.first ? 'first' : ''}:${where.newRow ? 'row' : 'same'}`}
        role="button"
        tabIndex={-1}
        aria-label={`Drop here: ${label}`}
        className="flex min-h-[34px] items-center justify-center border border-dashed border-[color:var(--amber,#e0a52d)] bg-[color:var(--edit-dim)] px-2.5 py-2 text-center font-mono text-9 uppercase tracking-[0.12em] text-text-muted"
        style={style}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          if (drag) onDrop(drag, where);
        }}
      >
        {label}
      </div>
    ) : null;

  const tile = (r: Region, style?: React.CSSProperties) => {
    const sel: Selection = { kind: 'region', id: r.id };
    const Icon = KIND_ICON[r.kind];
    const mark = markers[`region:${r.id}`];
    const selected = isSel(sel);
    return (
      <div
        key={r.id}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${REGION_KIND_LABELS[r.kind].label}: ${regionName(r)}`}
        data-sel={`region:${r.id}`}
        className={`flex min-w-0 flex-col border bg-bg text-left ${selected ? 'border-edit shadow-[0_0_0_1px_var(--edit)]' : 'border-border-strong hover:border-text-faint'} ${r.hidden ? 'border-dashed' : ''}`}
        style={style}
        onClick={e => {
          e.stopPropagation();
          onSelect(sel);
        }}
        onDoubleClick={e => {
          e.stopPropagation();
          onSelect(sel, { rename: true });
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(sel);
          }
        }}
        onContextMenu={ctx(sel)}
      >
        <div
          draggable={!readOnly}
          className={`flex min-w-0 cursor-grab items-center gap-1.5 border-b border-border px-2 py-1.5 ${selected ? 'bg-edit-dim' : 'bg-surface-elevated'}`}
          onDragStart={e => {
            e.stopPropagation();
            e.dataTransfer.setData('text/plain', r.id);
            e.dataTransfer.effectAllowed = 'move';
            onDragStart({ type: 'region', id: r.id });
          }}
        >
          <Icon size={11} className="shrink-0 text-text-faint" />
          <span className="min-w-0 truncate text-12 font-semibold text-text">{regionName(r)}</span>
          <span className="whitespace-nowrap font-mono text-8 uppercase tracking-[0.12em] text-text-faint">{REGION_KIND_LABELS[r.kind].label}</span>
          {r.authz && r.authz !== 'public' && <span className="whitespace-nowrap font-mono text-8 uppercase tracking-[0.12em] text-text-faint">{AUTHZ_LABEL[r.authz] ?? r.authz}</span>}
          {r.hidden && <span className="whitespace-nowrap font-mono text-8 uppercase tracking-[0.12em] text-text-faint">hidden at first</span>}
          {showText(r) && <span className="whitespace-nowrap font-mono text-8 uppercase tracking-[0.12em] text-[color:var(--amber,#e0a52d)]">{showText(r)}</span>}
          {mark && <span className={`h-2 w-2 shrink-0 rounded-full ${mark === 'err' ? 'bg-negative' : 'bg-[color:var(--amber,#e0a52d)]'}`} aria-label={mark === 'err' ? 'error' : 'warning'} />}
          <span className="ml-auto whitespace-nowrap font-mono text-9 text-text-faint">{r.seq}</span>
        </div>
        <div className="grid gap-1.5 px-2 pb-2 pt-1.5">
          <div className="border border-dashed border-border-strong px-2 pb-1.5 pt-1">
            <div className="flex justify-between gap-2 font-mono text-8 uppercase tracking-[0.14em] text-text-faint">
              <span>Region Body</span>
              <span>{r.position === 'body' ? spanName(r.span) : ''}</span>
            </div>
            <div className="mt-0.5 truncate text-11 text-text-muted">{regionSummary(r, assets, lists)}</div>
          </div>
        </div>
      </div>
    );
  };

  const sharedTile = (key: SharedKey) => {
    const s = PD_SHARED.find(x => x.key === key)!;
    const sel: Selection = { kind: 'shared', id: key };
    const selected = isSel(sel);
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Shared component: ${s.label}`}
        className={`flex min-w-0 cursor-pointer items-center gap-3 border bg-surface px-2.5 py-2 text-12 text-text-muted ${selected ? 'border-edit shadow-[0_0_0_1px_var(--edit)]' : 'border-border-strong hover:border-text-muted'}`}
        onClick={() => onSelect(sel)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(sel);
          }
        }}
        onContextMenu={ctx(sel)}
      >
        <Puzzle size={12} className="shrink-0 text-text-faint" />
        <span className="font-semibold text-text">{s.label}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-10 text-text-faint">{shared[key]}</span>
        <span className="whitespace-nowrap border border-border-strong px-1.5 py-0.5 font-mono text-8 uppercase tracking-[0.12em] text-text-faint">{s.note}</span>
        <button
          type="button"
          className="ml-2 whitespace-nowrap border border-border-strong px-2 py-1 font-mono text-9 uppercase tracking-[0.12em] text-text-muted hover:border-text-muted hover:text-text"
          onClick={e => {
            e.stopPropagation();
            onEditShared(s.sc);
          }}
        >
          Edit
        </button>
      </div>
    );
  };

  const position = (opts: { label: string; count?: number | null; locked?: boolean; later?: boolean; sel?: Selection; children: ReactNode }) => {
    const empty = opts.count === 0;
    if (hideEmpty && empty && !dropping && !opts.locked && !opts.later) return null;
    const selected = opts.sel ? isSel(opts.sel) : false;
    return (
      <div className={`relative mx-3 my-2.5 min-w-0 border ${opts.locked ? 'border-solid bg-surface-elevated' : 'border-dashed'} border-border-strong ${empty && !dropping ? 'opacity-70' : ''}`}>
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 font-mono text-9 uppercase tracking-[0.16em] ${selected ? 'text-edit' : 'text-text-faint'} ${opts.sel ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={opts.sel ? () => onSelect(opts.sel!) : undefined}
          onContextMenu={opts.sel ? ctx(opts.sel) : undefined}
        >
          <span>{opts.label}</span>
          {opts.count !== undefined && opts.count !== null && <span className="tracking-normal">{opts.count ? opts.count : 'empty'}</span>}
          {opts.later && <span className="tracking-normal">later</span>}
          {opts.locked && <Lock size={10} className="ml-auto" aria-label="Shared component, edited under Shared Components" />}
        </div>
        <div className={`min-w-0 ${opts.locked ? 'px-2.5 pb-2' : 'px-2 pb-2'}`}>{opts.children}</div>
      </div>
    );
  };

  const stack = (pos: Position) => {
    const regs = doc.regions.filter(r => r.position === pos);
    const last = regs[regs.length - 1];
    return (
      <div className="grid gap-1.5 pt-1.5">
        {regs.map(r => tile(r))}
        {dropTile(`Region · ${PD_POSITION[pos].label}`, { position: pos, after: last ? last.id : null, newRow: true })}
      </div>
    );
  };

  const body = () => {
    const regs = doc.regions.filter(r => r.position === 'body');
    const rows = rowsAt(doc, 'body');
    const cells: ReactNode[] = [];
    const first = regs[0];
    cells.push(dropTile('Body · first row', { position: 'body', first: true, newRow: true }, { gridColumn: '1 / span 12', gridRow: 1 }));
    rows.forEach((row, ri) => {
      const gridRow = 2 * (ri + 1);
      let used = 0;
      for (const r of row) {
        cells.push(tile(r, { gridColumn: `${r.column} / span ${r.span}`, gridRow, minHeight: 64 }));
        used = Math.max(used, r.column + r.span - 1);
      }
      const last = row[row.length - 1];
      const free = COLUMNS - used;
      if (free >= 2) {
        cells.push(
          dropTile(`Same row · ${free} col${free > 1 ? 's' : ''}`, { position: 'body', after: last.id, newRow: false, column: used + 1, span: Math.min(free, 6) }, { gridColumn: `${used + 1} / span ${free}`, gridRow }),
        );
      }
      cells.push(dropTile('New row', { position: 'body', after: last.id, newRow: true, column: 1 }, { gridColumn: '1 / span 12', gridRow: gridRow + 1 }));
    });
    return (
      <>
        <div className="mt-0.5 grid grid-cols-12 gap-1 px-2">
          {Array.from({ length: COLUMNS }, (_, i) => (
            <span key={i} className="border-b border-border-strong pb-0.5 text-center font-mono text-8 text-text-faint">
              {i + 1}
            </span>
          ))}
        </div>
        <div
          className="grid min-w-0 grid-cols-12 gap-1 px-2 pt-1.5"
          style={
            showCols
              ? { backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 calc((100% - 44px) / 12), var(--border) calc((100% - 44px) / 12) calc((100% - 44px) / 12 + 4px))', backgroundOrigin: 'content-box' }
              : undefined
          }
        >
          {cells}
        </div>
        {regs.length === 0 && !dropping && (
          <p className="m-0 px-3.5 py-4 text-12 leading-relaxed text-text-faint">
            Nothing in the Body. Drag a region from the gallery onto the yellow position, or double-click a gallery tile.
          </p>
        )}
        {first && null}
      </>
    );
  };

  const count = (pos: Position) => doc.regions.filter(r => r.position === pos).length;
  const pageSel: Selection = { kind: 'page' };

  return (
    <div className="min-w-0 px-4 pb-6 pt-3.5" onClick={e => e.target === e.currentTarget && onSelect(pageSel)}>
      <div className={`min-w-0 border border-border-strong bg-surface ${isSel(pageSel) ? 'shadow-[inset_0_0_0_2px_var(--edit)]' : ''}`}>
        <div
          className="flex cursor-pointer items-center justify-between gap-2.5 border-b border-border bg-surface-elevated px-3 py-2 text-12 text-text-muted hover:bg-surface"
          onClick={() => onSelect(pageSel)}
          onContextMenu={ctx(pageSel)}
        >
          <span>
            Page template · <b className="font-semibold text-text">Paddock Standard</b>
          </span>
          <span className="font-mono text-11">
            Page {number} · {page.path} · Normal{page.authz && page.authz !== 'public' ? ` · ${AUTHZ_LABEL[page.authz] ?? page.authz}` : ''}
          </span>
        </div>

        {position({ label: 'Header', locked: true, children: <div className="pt-1.5">{sharedTile('doors')}</div> })}

        {position({ label: PD_POSITION.header.label, count: count('header'), sel: { kind: 'position', id: 'header' }, children: stack('header') })}
        {position({ label: PD_POSITION.breadcrumb.label, count: count('breadcrumb'), sel: { kind: 'position', id: 'breadcrumb' }, children: stack('breadcrumb') })}

        {position({ label: 'Body', count: count('body'), sel: { kind: 'position', id: 'body' }, children: body() })}

        {position({
          label: PD_POSITION.right.label,
          count: code ? null : count('right'),
          sel: code ? undefined : { kind: 'position', id: 'right' },
          children: code ? <p className="m-0 px-1 pt-1.5 text-11 text-text-faint">Empty while the code still draws this page’s body; whether regions of yours may sit beside it is a decision still to be made.</p> : stack('right'),
        })}

        {position({ label: 'Inline Dialogs', later: true, children: <p className="m-0 px-1 pt-1 text-11 text-text-faint">Modal regions a page can open. Arrives with a later step.</p> })}

        {position({ label: PD_POSITION.footer.label, count: count('footer'), sel: { kind: 'position', id: 'footer' }, children: stack('footer') })}
        {position({ label: 'Footer', locked: true, children: <div className="pt-1.5">{sharedTile('footer')}</div> })}

        {position({ label: PD_POSITION.phonebar.label, count: count('phonebar'), sel: { kind: 'position', id: 'phonebar' }, children: stack('phonebar') })}
        {position({ label: 'Navigation Bar', locked: true, children: <div className="pt-1.5">{sharedTile('bar')}</div> })}
      </div>
    </div>
  );
}

/** The position keys the Layout draws for a document, in order. */
export const LAYOUT_POSITIONS: readonly Position[] = POSITIONS;

/** Stop a drag that never dropped (the browser fires dragend on the source). */
export function onDragEndCapture(e: DragEvent, end: () => void) {
  e.stopPropagation();
  end();
}
