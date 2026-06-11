'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { monthLabel } from '@/lib/months';

interface Props {
  months: string[];
  selected: string;
  onChange: (key: string) => void;
}

export function MonthNavigator({ months, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const idx = months.indexOf(selected);
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < months.length - 1;

  return (
    <div className="flex items-stretch mb-6 border-y border-border">
      <button
        type="button"
        onClick={() => hasPrev && onChange(months[idx - 1])}
        disabled={!hasPrev}
        aria-label="Previous month"
        className="px-3 py-2.5 text-text-muted hover:bg-surface hover:text-text disabled:opacity-30 disabled:cursor-not-allowed border-r border-border transition-colors duration-(--duration-fast)"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="relative flex-1 sm:flex-none">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex h-full w-full sm:w-44 items-center justify-between gap-1.5 px-4 font-display text-base font-extrabold uppercase tracking-wide text-text hover:bg-surface transition-colors duration-(--duration-fast)"
        >
          <span>{monthLabel(selected)}</span>
          <ChevronDown size={14} className="text-text-faint" />
        </button>
        {open && (
          <>
            <div
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-30"
              aria-hidden="true"
            />
            <div
              role="listbox"
              className="absolute left-0 top-full z-40 max-h-64 min-w-full overflow-y-auto border border-border bg-surface-elevated shadow-2xl shadow-black/40"
            >
              {months.map(k => (
                <button
                  key={k}
                  type="button"
                  role="option"
                  aria-selected={k === selected}
                  onClick={() => {
                    onChange(k);
                    setOpen(false);
                  }}
                  className={`block w-full whitespace-nowrap border-l-2 px-4 py-2 text-left font-mono text-xs uppercase tracking-[0.12em] transition-colors duration-(--duration-fast) hover:bg-surface ${
                    k === selected
                      ? 'border-brand font-semibold text-text'
                      : 'border-transparent text-text-muted'
                  }`}
                >
                  {monthLabel(k)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => hasNext && onChange(months[idx + 1])}
        disabled={!hasNext}
        aria-label="Next month"
        className="px-3 py-2.5 text-text-muted hover:bg-surface hover:text-text disabled:opacity-30 disabled:cursor-not-allowed border-x border-border transition-colors duration-(--duration-fast)"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
