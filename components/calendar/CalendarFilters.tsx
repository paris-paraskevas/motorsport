'use client';

import { useState } from 'react';
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
  strong,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  dotColor?: string;
  strong?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm">
      <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 shrink-0 accent-brand" />
      {dotColor && (
        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
      )}
      <span className={`${checked ? 'text-text' : 'text-text-muted'}${strong ? ' font-semibold' : ''}`}>{label}</span>
    </label>
  );
}

// Calendar filters as a modal box (opened from the toolbar's Filters button).
// DRAFT model: edits stay local and the calendar does NOT change until Save
// commits them. Reset re-selects everything; Save applies + closes; the X /
// backdrop cancels (discards the draft). "Select all" lives in the Series
// accordion only (not Session), so picking one series no longer means
// unticking the other thirteen.
export function CalendarFilters({
  initialTypes,
  initialSeriesSel,
  series,
  onApply,
  onClose,
}: {
  initialTypes: Set<SessionKind>;
  initialSeriesSel: Set<string> | null; // null = all present
  series: { slug: string; color: string }[];
  onApply: (types: Set<SessionKind>, seriesSel: Set<string> | null) => void;
  onClose: () => void;
}) {
  const allSlugs = series.map(s => s.slug);
  const [draftTypes, setDraftTypes] = useState<Set<SessionKind>>(() => new Set(initialTypes));
  const [draftSeries, setDraftSeries] = useState<Set<string>>(() => new Set(initialSeriesSel ?? allSlugs));

  const toggleType = (k: SessionKind) =>
    setDraftTypes(cur => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const toggleSeries = (slug: string) =>
    setDraftSeries(cur => {
      const next = new Set(cur);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  const allSeriesSelected = allSlugs.length > 0 && draftSeries.size === allSlugs.length;
  const toggleAllSeries = () => setDraftSeries(allSeriesSelected ? new Set() : new Set(allSlugs));

  const reset = () => {
    setDraftTypes(new Set(['practice', 'qualifying', 'race']));
    setDraftSeries(new Set(allSlugs));
  };
  const save = () => {
    // Normalise "everything selected" back to the all-present sentinel (null) so
    // the filter stays "all" even if the present set later changes.
    const seriesSel = draftSeries.size === allSlugs.length ? null : new Set(draftSeries);
    onApply(new Set(draftTypes), seriesSel);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Calendar filters"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col border border-border bg-surface-elevated"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-display text-sm font-bold uppercase tracking-wide text-text">Filters</span>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <Accordion title="Session" titleClassName="font-display uppercase tracking-wide">
            <div>
              {TYPES.map(({ kind, label }) => (
                <CheckRow key={kind} label={label} checked={draftTypes.has(kind)} onToggle={() => toggleType(kind)} />
              ))}
            </div>
          </Accordion>
          {series.length > 1 && (
            <Accordion title="Series" titleClassName="font-display uppercase tracking-wide">
              <div>
                <CheckRow label="Select all" checked={allSeriesSelected} onToggle={toggleAllSeries} strong />
                <div className="my-1 border-t border-border/60" />
                <div className="grid grid-cols-2 gap-x-4">
                  {series.map(s => (
                    <CheckRow
                      key={s.slug}
                      label={s.slug.toUpperCase()}
                      checked={draftSeries.has(s.slug)}
                      onToggle={() => toggleSeries(s.slug)}
                      dotColor={s.color}
                    />
                  ))}
                </div>
              </div>
            </Accordion>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={reset}
            className="border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted transition-colors hover:text-text"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={save}
            className="bg-brand px-4 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-bg transition-opacity hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
