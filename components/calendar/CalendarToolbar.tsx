'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarViewMode } from './types';

const VIEWS: CalendarViewMode[] = ['month', 'week', 'day'];

export function CalendarToolbar({
  view,
  onView,
  label,
  onPrev,
  onNext,
  monthOptions,
  currentMonthValue,
  onPickMonth,
  filtersOpen,
  onToggleFilters,
  filterActive,
}: {
  view: CalendarViewMode;
  onView: (v: CalendarViewMode) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  monthOptions: { value: number; label: string }[];
  currentMonthValue: number;
  onPickMonth: (ms: number) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  filterActive: boolean;
}) {
  return (
    <div className="mb-4">
      {/* Full-width month nav: ‹ [month dropdown] › — the dropdown jumps to any
          month in the season; the arrows step by the current view. */}
      <div className="flex items-stretch border-y border-border">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous"
          className="border-r border-border px-3 py-2.5 text-text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ChevronLeft size={16} />
        </button>
        <select
          value={currentMonthValue}
          onChange={e => onPickMonth(Number(e.target.value))}
          aria-label="Jump to month"
          className="min-w-0 flex-1 cursor-pointer bg-transparent px-3 py-2.5 text-center font-display text-base font-extrabold uppercase tracking-wide text-text transition-colors hover:bg-surface md:text-lg"
        >
          {monthOptions.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          className="border-l border-border px-3 py-2.5 text-text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* The precise week/day range when zoomed in (the month dropdown already
          carries the label in month view). */}
      {view !== 'month' && (
        <div className="mt-2 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex">
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFilters}
            aria-expanded={filtersOpen}
            className={`inline-flex items-center gap-1.5 border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
              filtersOpen ? 'border-text bg-text text-bg' : 'border-border text-text-muted hover:text-text'
            }`}
          >
            Filters
            {filterActive && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="active" />}
          </button>
        </div>
      </div>
    </div>
  );
}
