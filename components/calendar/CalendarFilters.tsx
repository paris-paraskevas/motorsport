'use client';

import { X } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import type { SessionKind } from '@/lib/calendar-grid';

const TYPES: { kind: SessionKind; label: string }[] = [
  { kind: 'practice', label: 'Practice' },
  { kind: 'qualifying', label: 'Qualifying' },
  { kind: 'race', label: 'Race' },
];

function chipClass(active: boolean): string {
  return `inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors duration-(--duration-fast) ${
    active ? 'border-text bg-text text-bg' : 'border-border text-text-muted hover:text-text'
  }`;
}

// Calendar filters as a modal box (opened from the toolbar's Filters button):
// collapsed-by-default Session + Series categories. Multi-select chips — a
// type/series shows when its chip is active; all active (the default) = all.
export function CalendarFilters({
  types,
  onToggleType,
  series,
  seriesShown,
  onToggleSeries,
  onClose,
}: {
  types: Set<SessionKind>;
  onToggleType: (k: SessionKind) => void;
  series: { slug: string; color: string }[];
  seriesShown: (slug: string) => boolean;
  onToggleSeries: (slug: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Calendar filters"
      onClick={onClose}
    >
      <div className="w-full max-w-md border border-border bg-surface-elevated" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-display text-sm font-bold uppercase tracking-wide text-text">Filters</span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>
        <div className="px-4">
          <Accordion title="Session" titleClassName="font-display uppercase tracking-wide">
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onToggleType(kind)}
                  aria-pressed={types.has(kind)}
                  className={chipClass(types.has(kind))}
                >
                  {label}
                </button>
              ))}
            </div>
          </Accordion>
          {series.length > 1 && (
            <Accordion title="Series" titleClassName="font-display uppercase tracking-wide">
              <div className="flex flex-wrap gap-1.5">
                {series.map(s => {
                  const active = seriesShown(s.slug);
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => onToggleSeries(s.slug)}
                      aria-pressed={active}
                      className={chipClass(active)}
                      style={active ? { borderColor: s.color } : undefined}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.slug.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
}
