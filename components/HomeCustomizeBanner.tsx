'use client';

import { useState, type ComponentType } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ChartBar,
  ChevronDown,
  ChevronRight,
  Clock,
  Crown,
  Eye,
  EyeOff,
  Flag,
  FlagTriangleRight,
  GripVertical,
  LayoutGrid,
  MapPin,
  Newspaper,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Timer,
} from 'lucide-react';
import {
  AVAILABLE_WIDGETS,
  HOME_ELEMENTS,
  type AvailableWidget,
  type HomeLayoutPrefs,
} from '@/lib/homeLayout';
import { useHomeLayout } from '@/lib/useHomeLayout';

const META = new Map(HOME_ELEMENTS.map(e => [e.id, e]));

// Resolve the descriptor's lucide export name to a component. Kept here (not in
// lib/homeLayout) so the data module stays React-free. Falls back to a neutral
// glyph if a name is ever mistyped.
const ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  Timer,
  FlagTriangleRight,
  MapPin,
  ChartBar,
  Crown,
  Newspaper,
  Clock,
  Flag,
};

// A live, schematic preview of the home — the blocks stacked in the user's order,
// hidden ones dropped, collapsed ones shown as a folded bar. Updates as they edit.
function HomePreview({ layout }: { layout: HomeLayoutPrefs }) {
  const visible = layout.order.filter(id => !layout.hidden.includes(id));
  return (
    <div className="space-y-1.5 rounded border border-border bg-bg/60 p-2" aria-hidden="true">
      {visible.length === 0 ? (
        <div className="py-6 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          Everything hidden
        </div>
      ) : (
        visible.map(id => {
          const meta = META.get(id);
          const collapsed = layout.collapsed.includes(id);
          return (
            <div key={id} className="rounded-sm border border-border/70 bg-surface px-2 py-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">
                  {meta?.label ?? id}
                </span>
                {collapsed && (
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-text-faint">folded</span>
                )}
              </div>
              {!collapsed && (
                <div className="mt-1.5 space-y-1">
                  <div className="h-1.5 w-3/4 rounded-sm bg-border" />
                  <div className="h-1.5 w-1/2 rounded-sm bg-border" />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// The per-block control list: reorder by dragging the ≡ handle (or up/down arrows
// — touch + keyboard friendly), fold/expand collapsible blocks, show/hide, reset.
// Shared by the inline banner and the dedicated /settings/customize page so both
// stay byte-identical in behaviour.
function BlockControls({ eligibleSeries = [] }: { eligibleSeries?: { slug: string; name: string }[] }) {
  const { layout, move, reorder, toggleHidden, toggleCollapsed, setSnapshotSeries, reset } = useHomeLayout();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const onDrop = (to: number) => {
    if (dragIndex === null || dragIndex === to) {
      setDragIndex(null);
      return;
    }
    const next = [...layout.order];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(to, 0, moved);
    reorder(next);
    setDragIndex(null);
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">Preview</div>
        <HomePreview layout={layout} />
      </div>
      <div>
        <ul className="divide-y divide-border">
          {layout.order.map((id, i) => {
            const hidden = layout.hidden.includes(id);
            const collapsed = layout.collapsed.includes(id);
            const meta = META.get(id);
            return (
              <li
                key={id}
                draggable
                onDragStart={e => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(i)); // Firefox needs data to start a drag
                }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(i)}
                onDragEnd={() => setDragIndex(null)}
                className={`flex items-center gap-1.5 py-2.5 ${dragIndex === i ? 'opacity-50' : ''}`}
              >
                <span
                  className="shrink-0 cursor-grab text-text-faint active:cursor-grabbing"
                  aria-hidden="true"
                >
                  <GripVertical size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${hidden ? 'text-text-faint line-through' : 'text-text'}`}>
                    {meta?.label ?? id}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => move(id, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${meta?.label ?? id} up`}
                  className="p-1 text-text-muted hover:text-text disabled:opacity-30"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => move(id, 1)}
                  disabled={i === layout.order.length - 1}
                  aria-label={`Move ${meta?.label ?? id} down`}
                  className="p-1 text-text-muted hover:text-text disabled:opacity-30"
                >
                  <ArrowDown size={15} />
                </button>
                {meta?.collapsible && (
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(id)}
                    disabled={hidden}
                    aria-label={collapsed ? `Expand ${meta?.label ?? id}` : `Fold ${meta?.label ?? id}`}
                    className="p-1 text-text-muted hover:text-text disabled:opacity-30"
                  >
                    {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleHidden(id)}
                  aria-label={hidden ? `Show ${meta?.label ?? id}` : `Hide ${meta?.label ?? id}`}
                  className="p-1 text-text-muted hover:text-text"
                >
                  {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </li>
            );
          })}
        </ul>
        {/* Per-widget config: which series the standings-snapshot widget shows.
            Only relevant when that widget is present + visible. */}
        {eligibleSeries.length > 0 &&
          layout.order.includes('standings-snapshot') &&
          !layout.hidden.includes('standings-snapshot') && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <label
                htmlFor="snapshot-series"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint"
              >
                Standings snapshot — series
              </label>
              <select
                id="snapshot-series"
                value={layout.config.snapshotSeries ?? ''}
                onChange={e => setSnapshotSeries(e.target.value)}
                className="border border-border bg-bg px-2 py-1 text-xs text-text"
              >
                <option value="">First series you follow</option>
                {eligibleSeries.map(s => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        <button
          type="button"
          onClick={reset}
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint hover:text-text-muted"
        >
          <RotateCcw size={12} /> Reset to default
        </button>
      </div>
    </div>
  );
}

// A discovery card for a not-yet-shipped widget. Display-only — no toggle is
// wired (the home doesn't render these yet). Purely advertises what's coming so
// the customise surface doubles as a roadmap.
function WidgetCard({ widget }: { widget: AvailableWidget }) {
  const Icon = ICONS[widget.icon] ?? Sparkles;
  return (
    <li className="relative flex gap-3 rounded border border-border bg-surface/40 p-3">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-text-muted">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="block text-sm font-semibold text-text">{widget.label}</span>
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-text-faint">{widget.blurb}</span>
      </span>
      <span
        className="shrink-0 self-start rounded-sm border border-border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-text-faint"
      >
        Coming soon
      </span>
    </li>
  );
}

// The widget-discovery gallery: a forward-looking menu of blocks a user could
// add to their home. Sourced from AVAILABLE_WIDGETS (UI-only descriptors); every
// card is "coming soon" until its widget ships into HomeContent + the pref shape.
function WidgetGallery() {
  return (
    <section className="mt-8">
      <div className="mb-1.5 flex items-center gap-2">
        <LayoutGrid size={14} className="text-text-muted" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-text">More widgets</h2>
      </div>
      <p className="mb-4 font-mono text-[11px] leading-relaxed text-text-faint">
        Blocks we’re building next. Pin them to your home as they land.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {AVAILABLE_WIDGETS.map(w => (
          <WidgetCard key={w.id} widget={w} />
        ))}
      </ul>
    </section>
  );
}

// "Customise your home" banner for the Account page: a live preview next to the
// per-block controls. Works signed-out (localStorage) and signed-in (KV,
// cross-device) via useHomeLayout. Retained for any inline embed; the primary
// home for these controls is now the /settings/customize page (HomeCustomizePanel).
export function HomeCustomizeBanner() {
  return (
    <section className="mb-6 border border-border bg-surface/60 p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <SlidersHorizontal size={14} className="text-text-muted" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-text">Customise your home</h2>
      </div>
      <p className="mb-4 font-mono text-[11px] leading-relaxed text-text-faint">
        Drag the handle to reorder (or use the arrows). Fold or hide any block. Changes save instantly.
      </p>
      <BlockControls />
    </section>
  );
}

// Full customise surface for the dedicated /settings/customize page: the live
// preview + per-block controls, then the widget-discovery gallery. Same hook,
// same persistence as the banner — just the richer, standalone presentation.
export function HomeCustomizePanel({
  eligibleSeries = [],
}: {
  eligibleSeries?: { slug: string; name: string }[];
}) {
  return (
    <div>
      <section>
        <div className="mb-1.5 flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-text-muted" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-text">Your home blocks</h2>
        </div>
        <p className="mb-4 font-mono text-[11px] leading-relaxed text-text-faint">
          Drag the handle to reorder (or use the arrows). Fold or hide any block. Changes save instantly.
        </p>
        <BlockControls eligibleSeries={eligibleSeries} />
      </section>
      <WidgetGallery />
    </div>
  );
}
