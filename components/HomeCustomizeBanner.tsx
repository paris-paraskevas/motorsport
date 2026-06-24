'use client';

import { ArrowUp, ArrowDown, ChevronDown, ChevronRight, Eye, EyeOff, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { HOME_ELEMENTS, type HomeLayoutPrefs } from '@/lib/homeLayout';
import { useHomeLayout } from '@/lib/useHomeLayout';

const META = new Map(HOME_ELEMENTS.map(e => [e.id, e]));

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

// "Customise your home" banner for the Account page: a live preview next to the
// per-block controls (reorder, fold/expand the collapsible blocks, show/hide,
// reset). Works signed-out (localStorage) and signed-in (KV, cross-device) via
// useHomeLayout. Dependency-light (up/down, no drag) — three blocks.
export function HomeCustomizeBanner() {
  const { layout, move, toggleHidden, toggleCollapsed, reset } = useHomeLayout();
  return (
    <section className="mb-6 border border-border bg-surface/60 p-4">
      <div className="mb-1.5 flex items-center gap-2">
        <SlidersHorizontal size={14} className="text-text-muted" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-text">Customise your home</h2>
      </div>
      <p className="mb-4 font-mono text-[11px] leading-relaxed text-text-faint">
        Reorder, fold or hide the blocks on your home screen. Changes save instantly.
      </p>
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
                <li key={id} className="flex items-center gap-1.5 py-2.5">
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
          <button
            type="button"
            onClick={reset}
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint hover:text-text-muted"
          >
            <RotateCcw size={12} /> Reset to default
          </button>
        </div>
      </div>
    </section>
  );
}
