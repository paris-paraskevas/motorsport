'use client';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarViewMode } from './types';

const VIEWS: CalendarViewMode[] = ['month', 'week', 'day', 'season'];

export function CalendarToolbar({
  view,
  onView,
  label,
  onPrev,
  onNext,
  onToday,
  monthOptions,
  currentMonthValue,
  onPickMonth,
}: {
  view: CalendarViewMode;
  onView: (v: CalendarViewMode) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  monthOptions: { value: number; label: string }[];
  currentMonthValue: number;
  onPickMonth: (ms: number) => void;
}) {
  return (
    <div className="mb-4">
      {/* The nav bar follows the view (operator, image #9): its big centre
          label IS the current month / week range / day, and the arrows step by
          that same unit. A transparent <select> overlays the label so jumping
          to any month stays one native tap from every view. The season view
          is one scrolling surface with its own jump chips — no bar. */}
      {view !== 'season' && (
        <div className="flex items-stretch border-y border-border">
          <button
            type="button"
            onClick={onPrev}
            aria-label={`Previous ${view}`}
            className="border-r border-border px-3 py-2.5 text-text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none flex h-full items-center justify-center gap-1.5 px-3 text-center font-display text-base font-extrabold uppercase tracking-wide text-text md:text-lg">
              <span className="truncate">{label}</span>
              <ChevronDown size={13} aria-hidden className="shrink-0 text-text-faint" />
            </div>
            <select
              value={currentMonthValue}
              onChange={e => onPickMonth(Number(e.target.value))}
              aria-label="Jump to month"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              {monthOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onNext}
            aria-label={`Next ${view}`}
            className="border-l border-border px-3 py-2.5 text-text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="border-l border-border px-3 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors hover:bg-surface hover:text-text"
          >
            Today
          </button>
        </div>
      )}

      <div className="mt-2 flex">
        {VIEWS.map(v => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            aria-pressed={view === v}
            className={`-ml-px border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
              view === v ? 'border-text bg-text text-bg' : 'border-border text-text-muted hover:text-text'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
