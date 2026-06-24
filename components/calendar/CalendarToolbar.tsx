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
  onToday,
  filtersOpen,
  onToggleFilters,
  onClearFilters,
  filterActive,
}: {
  view: CalendarViewMode;
  onView: (v: CalendarViewMode) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onClearFilters: () => void;
  filterActive: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-y-2 border-y border-border">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous"
          className="border-r border-border px-3 py-2.5 text-text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={onToday}
          className="border-r border-border px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors hover:bg-surface hover:text-text"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          className="border-r border-border px-3 py-2.5 text-text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ChevronRight size={16} />
        </button>
        <span className="ml-3 self-center font-display text-base font-extrabold uppercase tracking-wide text-text md:text-lg">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2 py-1.5 pr-1">
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
        {filterActive && (
          <button
            type="button"
            onClick={onClearFilters}
            className="border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors hover:text-text"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
