'use client';

import { X } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import type { SessionKind } from '@/lib/calendar-grid';

const TYPES: { kind: SessionKind; label: string }[] = [
  { kind: 'practice', label: 'Practice' },
  { kind: 'qualifying', label: 'Qualifying' },
  { kind: 'race', label: 'Race' },
];

// One filter option = a checkbox row (single brand accent, not a coloured fill).
// Series keep a small colour dot for identity, but the control itself is plain.
function CheckRow({
  label,
  checked,
  onToggle,
  dotColor,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  dotColor?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm">
      <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 shrink-0 accent-brand" />
      {dotColor && (
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
      )}
      <span className={checked ? 'text-text' : 'text-text-muted'}>{label}</span>
    </label>
  );
}

// Calendar filters as a modal box (opened from the toolbar's Filters button):
// collapsed-by-default Session + Series categories, as plain checkboxes — a
// type/series shows when ticked; all ticked (the default) = everything.
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
            <div>
              {TYPES.map(({ kind, label }) => (
                <CheckRow key={kind} label={label} checked={types.has(kind)} onToggle={() => onToggleType(kind)} />
              ))}
            </div>
          </Accordion>
          {series.length > 1 && (
            <Accordion title="Series" titleClassName="font-display uppercase tracking-wide">
              <div className="grid grid-cols-2 gap-x-4">
                {series.map(s => (
                  <CheckRow
                    key={s.slug}
                    label={s.slug.toUpperCase()}
                    checked={seriesShown(s.slug)}
                    onToggle={() => onToggleSeries(s.slug)}
                    dotColor={s.color}
                  />
                ))}
              </div>
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
}
