'use client';

import Link from 'next/link';
import { useState, type ComponentType, type ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
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
  Lock,
  MapPin,
  Newspaper,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Timer,
} from 'lucide-react';
import {
  AVAILABLE_WIDGETS,
  HOME_ELEMENTS,
  SPINE_IDS,
  type AvailableWidget,
  type HomeElementId,
  type HomeLayoutPrefs,
} from '@/lib/homeLayout';
import { useHomeLayout } from '@/lib/useHomeLayout';
import { useFollowedSeries } from '@/lib/useFollowedSeries';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
// Per-widget numeric content control: which settings field, its label, and the
// allowed values. Widgets absent here have no numeric content setting.
const NUMERIC_SETTING: Partial<
  Record<HomeElementId, { field: 'count' | 'days' | 'rows'; label: string; values: number[]; def: number }>
> = {
  news: { field: 'count', label: 'Headlines', values: [5, 10, 20], def: 10 },
  'from-the-blog': { field: 'count', label: 'Posts', values: [2, 4, 6], def: 4 },
  schedule: { field: 'days', label: 'Days', values: [3, 7], def: 7 },
  'standings-snapshot': { field: 'rows', label: 'Rows', values: [3, 5, 10], def: 5 },
  'series-just-missed': { field: 'count', label: 'Series', values: [3, 5, 10], def: 5 },
  'series-countdowns': { field: 'count', label: 'Series', values: [3, 5, 10], def: 5 },
  'where-to-watch': { field: 'count', label: 'Sessions', values: [2, 4, 6, 8], def: 4 },
  'driver-spotlight': { field: 'count', label: 'Drivers', values: [1, 3, 6], def: 3 },
  social: { field: 'count', label: 'Leagues', values: [2, 3, 5], def: 3 },
};

// One sortable row in the block list — dnd-kit sortable (pointer + touch +
// keyboard). The drag listeners go on the ≡ handle (via the render prop) so the
// row's other buttons stay clickable, and the handle is the only drag target.
function SortableRow({
  id,
  children,
}: {
  id: HomeElementId;
  children: (handle: Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'>) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`py-2.5 ${isDragging ? 'relative z-10' : ''}`}
    >
      {children({ attributes, listeners })}
    </li>
  );
}

function BlockControls({ eligibleSeries = [] }: { eligibleSeries?: { slug: string; name: string }[] }) {
  const { isSignedIn } = useAuth();
  const { layout, reorder, toggleHidden, toggleCollapsed, setWidgetSetting, reset } = useHomeLayout();
  const { followed } = useFollowedSeries();
  const [openId, setOpenId] = useState<HomeElementId | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Customising the Home (reorder / hide / fold / per-widget settings) is a
  // free-account feature — a guest gets the fixed default layout, so show a
  // sign-in CTA instead of the controls. (useHomeLayout no-ops persistence for
  // guests, so nothing here could be saved anyway.)
  if (!isSignedIn) {
    return (
      <div className="border border-border bg-surface/40 px-6 py-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-faint">
          <Lock size={16} aria-hidden />
        </div>
        <p className="mx-auto max-w-sm text-sm text-text-muted">
          Rearrange your Home — reorder, fold or hide any block and pin extra widgets. It’s a free account feature.
        </p>
        <Link
          href="/sign-in"
          className="mt-4 inline-flex items-center gap-2 border border-border-strong bg-surface px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-text transition-colors duration-(--duration-fast) hover:border-brand"
        >
          Sign in to customise
        </Link>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          Free — an account keeps it free
        </p>
      </div>
    );
  }

  // The spine (Up-next + Just-missed) is fixed — it isn't listed below and can't
  // be reordered or hidden. Controls operate on the rest; every reorder
  // re-prepends the spine so it stays pinned to the top.
  const controllable = layout.order.filter(id => !(SPINE_IDS as readonly string[]).includes(id));

  const moveControllable = (id: HomeElementId, dir: -1 | 1) => {
    const i = controllable.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= controllable.length) return;
    const next = [...controllable];
    [next[i], next[j]] = [next[j], next[i]];
    reorder([...SPINE_IDS, ...next]);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = controllable.indexOf(active.id as HomeElementId);
    const to = controllable.indexOf(over.id as HomeElementId);
    if (from < 0 || to < 0) return;
    reorder([...SPINE_IDS, ...arrayMove(controllable, from, to)]);
  };

  // Eligible series the user actually follows (championship-leader subset picker).
  const followedEligible = eligibleSeries.filter(s => followed === null || followed.includes(s.slug));

  const pillClass = (active: boolean) =>
    `border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
      active ? 'border-text bg-text text-bg' : 'border-border text-text-muted hover:text-text'
    }`;

  // Inline per-widget settings panel: density (every widget) + its content control.
  const renderSettings = (id: HomeElementId) => {
    const s = layout.config[id] ?? {};
    const num = NUMERIC_SETTING[id];
    const leaderSet = id === 'championship-leader' ? s.seriesSet ?? null : null;
    return (
      <div className="mt-2 space-y-2 border-t border-border/60 pl-7 pt-2">
        <div className="flex items-center gap-2">
          <span className="w-16 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">Spacing</span>
          {(['comfortable', 'compact'] as const).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setWidgetSetting(id, { density: d })}
              aria-pressed={(s.density ?? 'comfortable') === d}
              className={pillClass((s.density ?? 'comfortable') === d)}
            >
              {d}
            </button>
          ))}
        </div>

        {num && (
          <label className="flex items-center gap-2">
            <span className="w-16 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">{num.label}</span>
            <select
              value={(s[num.field] as number | undefined) ?? num.def}
              onChange={e => setWidgetSetting(id, { [num.field]: Number(e.target.value) })}
              className="border border-border bg-bg px-2 py-1 text-xs text-text"
            >
              {num.values.map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}

        {id === 'standings-snapshot' && followedEligible.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="w-16 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">Series</span>
            <select
              value={s.series ?? ''}
              onChange={e => setWidgetSetting(id, { series: e.target.value })}
              className="border border-border bg-bg px-2 py-1 text-xs text-text"
            >
              <option value="">First you follow</option>
              {followedEligible.map(o => (
                <option key={o.slug} value={o.slug}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {id === 'championship-leader' && followedEligible.length > 0 && (
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
              Series <span className="text-text-faint/70">(default: all)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {followedEligible.map(o => {
                const on = leaderSet === null || leaderSet.includes(o.slug);
                return (
                  <button
                    key={o.slug}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const base = leaderSet ?? followedEligible.map(x => x.slug);
                      const next = on ? base.filter(x => x !== o.slug) : [...base, o.slug];
                      // all selected → clear (means "all"); else store the subset
                      setWidgetSetting(id, {
                        seriesSet: next.length === followedEligible.length ? undefined : next,
                      });
                    }}
                    className={pillClass(on)}
                  >
                    {o.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">Preview</div>
        <HomePreview layout={layout} />
      </div>
      <div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={controllable} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-border">
              {controllable.map((id, i) => {
                const hidden = layout.hidden.includes(id);
                const collapsed = layout.collapsed.includes(id);
                const meta = META.get(id);
                const open = openId === id;
                return (
                  <SortableRow key={id} id={id}>
                    {handle => (
                      <>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="shrink-0 cursor-grab touch-none text-text-faint active:cursor-grabbing"
                            aria-label={`Drag ${meta?.label ?? id} to reorder`}
                            {...handle.attributes}
                            {...handle.listeners}
                          >
                            <GripVertical size={15} />
                          </button>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm ${hidden ? 'text-text-faint line-through' : 'text-text'}`}>
                              {meta?.label ?? id}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => moveControllable(id, -1)}
                            disabled={i === 0}
                            aria-label={`Move ${meta?.label ?? id} up`}
                            className="p-1 text-text-muted hover:text-text disabled:opacity-30"
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveControllable(id, 1)}
                            disabled={i === controllable.length - 1}
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
                            onClick={() => setOpenId(open ? null : id)}
                            disabled={hidden}
                            aria-label={`Settings for ${meta?.label ?? id}`}
                            aria-expanded={open}
                            className={`p-1 hover:text-text disabled:opacity-30 ${open ? 'text-text' : 'text-text-muted'}`}
                          >
                            <Settings2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleHidden(id)}
                            aria-label={hidden ? `Show ${meta?.label ?? id}` : `Hide ${meta?.label ?? id}`}
                            className="p-1 text-text-muted hover:text-text"
                          >
                            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        {open && !hidden && renderSettings(id)}
                      </>
                    )}
                  </SortableRow>
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
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
  // Every advertised widget has shipped — nothing to gallery. Adding entries to
  // AVAILABLE_WIDGETS re-lights this section automatically.
  if (AVAILABLE_WIDGETS.length === 0) return null;
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
