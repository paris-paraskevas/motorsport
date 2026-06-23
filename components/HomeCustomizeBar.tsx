'use client';

import { ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw, X } from 'lucide-react';
import { HOME_ELEMENTS, type HomeLayoutPrefs, type HomeElementId } from '@/lib/homeLayout';

const META = new Map(HOME_ELEMENTS.map(e => [e.id, e]));

// Customise-mode chrome for the home: per-block move up/down + show/hide, in the
// user's current order, with a reset. Dependency-light (up/down, no drag) — the
// home has three top-level blocks and this is touch- + keyboard-friendly.
export function HomeCustomizeBar({
  layout,
  move,
  toggleHidden,
  reset,
  onDone,
}: {
  layout: HomeLayoutPrefs;
  move: (id: HomeElementId, dir: -1 | 1) => void;
  toggleHidden: (id: HomeElementId) => void;
  reset: () => void;
  onDone: () => void;
}) {
  return (
    <div className="mb-6 border border-border bg-surface/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Customise your home</span>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-text"
        >
          Done <X size={13} />
        </button>
      </div>
      <ul className="divide-y divide-border">
        {layout.order.map((id, i) => {
          const hidden = layout.hidden.includes(id);
          const meta = META.get(id);
          return (
            <li key={id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${hidden ? 'text-text-faint line-through' : 'text-text'}`}>
                  {meta?.label ?? id}
                </span>
                {meta?.hint && <span className="block font-mono text-[10px] text-text-faint">{meta.hint}</span>}
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
        className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint hover:text-text-muted"
      >
        <RotateCcw size={12} /> Reset to default
      </button>
    </div>
  );
}
