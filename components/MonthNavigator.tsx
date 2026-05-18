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
    <div className="flex items-center justify-center gap-1 mb-6">
      <button
        type="button"
        onClick={() => hasPrev && onChange(months[idx - 1])}
        disabled={!hasPrev}
        aria-label="Previous month"
        className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-(--duration-fast)"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text hover:bg-surface rounded-lg transition-colors duration-(--duration-fast) min-w-[120px] justify-center"
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
              className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-40 bg-surface-elevated border border-border rounded-lg shadow-2xl shadow-black/40 max-h-64 overflow-y-auto min-w-[140px]"
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
                  className={`block w-full text-left px-3 py-2 text-sm whitespace-nowrap hover:bg-surface transition-colors duration-(--duration-fast) ${
                    k === selected
                      ? 'text-tint font-semibold'
                      : 'text-text'
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
        className="p-2 rounded-lg text-text-muted hover:bg-surface hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-(--duration-fast)"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
