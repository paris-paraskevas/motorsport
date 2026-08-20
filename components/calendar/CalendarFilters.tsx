'use client';

import { useState } from 'react';

// The filters live in one visible box (operator, 2026-08-20: "I prefer a
// filters box, like old paddock had. where you can 'select all' or unselect.
// also can select multiple leaving out multiple series"). Every series is a
// checkbox-style chip — nothing hidden behind "+N more" — with SELECT ALL /
// CLEAR shortcuts, so excluding a few series is untick-untick, not a re-pick.
// Still applied on tap: no draft state, no Save button (§4.2's win survives;
// only the tap-to-focus semantic is gone — checkboxes behave like checkboxes).
export function CalendarFilterBox({
  racesOnly,
  onRacesOnly,
  series,
  seriesSel,
  onToggleSeries,
  onSelectAll,
  onClear,
}: {
  racesOnly: boolean;
  onRacesOnly: (v: boolean) => void;
  series: { slug: string; color: string }[];
  seriesSel: Set<string> | null; // null = all on; empty set = none
  onToggleSeries: (slug: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const chipBase =
    'inline-flex min-h-9 items-center gap-2 border px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors duration-(--duration-fast)';
  const on = 'border-text bg-surface-elevated text-text';
  const off = 'border-border-strong text-text-muted hover:text-text';
  const activeCount = seriesSel === null ? series.length : seriesSel.size;
  const countLabel =
    activeCount === series.length ? 'all series' : activeCount === 0 ? 'no series' : `${activeCount} of ${series.length}`;
  // Fifteen chips are ~700px of a phone screen before the agenda starts, so
  // below md the box collapses to its summary line; md+ keeps it always open.
  const [openOnMobile, setOpenOnMobile] = useState(false);

  return (
    <section aria-label="Calendar filters" className="mb-4 border border-border-strong bg-surface px-3 pb-3 pt-2">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-1.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Filters · {countLabel}
        </span>
        <span className="flex items-baseline gap-x-4">
          <button
            type="button"
            onClick={onSelectAll}
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={onClear}
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-brand hover:underline"
          >
            Clear
          </button>
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint sm:inline">
            Applied as you tap
          </span>
          <button
            type="button"
            aria-expanded={openOnMobile}
            onClick={() => setOpenOnMobile(v => !v)}
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted hover:text-text md:hidden"
          >
            {openOnMobile ? 'Hide' : 'Edit'}
          </button>
        </span>
      </div>
      <div className={`${openOnMobile ? 'flex' : 'hidden'} flex-wrap items-center gap-2 md:flex`}>
        <span role="group" aria-label="Session type" className="contents">
          <button
            type="button"
            aria-pressed={!racesOnly}
            onClick={() => onRacesOnly(false)}
            className={`${chipBase} ${!racesOnly ? on : off}`}
          >
            All sessions
          </button>
          <button
            type="button"
            aria-pressed={racesOnly}
            onClick={() => onRacesOnly(true)}
            className={`${chipBase} ${racesOnly ? on : off}`}
          >
            Races only
          </button>
        </span>
        <span aria-hidden="true" className="h-5 w-px bg-border-strong" />
        <span role="group" aria-label="Series" className="contents">
          {series.map(s => {
            const active = seriesSel === null || seriesSel.has(s.slug);
            return (
              <button
                key={s.slug}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => onToggleSeries(s.slug)}
                className={`${chipBase} ${active ? on : off}`}
              >
                <span aria-hidden="true" className="h-[13px] w-[3px] shrink-0" style={{ backgroundColor: s.color }} />
                {s.slug.replace(/-/g, ' ')}
                {/* Fixed-width tick slot so chips keep their width on toggle. */}
                <span aria-hidden="true" className={`w-[11px] text-center ${active ? '' : 'text-transparent'}`}>
                  ✓
                </span>
              </button>
            );
          })}
        </span>
      </div>
    </section>
  );
}
