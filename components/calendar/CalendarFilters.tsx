'use client';

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

// Event-type + series filters for the calendar. Multi-select chips: a type/series
// shows when its chip is active; all active (the default) = everything. Sits
// below the M/W/D toolbar, behind a Filters toggle (default collapsed).
export function CalendarFilters({
  types,
  onToggleType,
  series,
  seriesShown,
  onToggleSeries,
}: {
  types: Set<SessionKind>;
  onToggleType: (k: SessionKind) => void;
  series: { slug: string; color: string }[];
  seriesShown: (slug: string) => boolean;
  onToggleSeries: (slug: string) => void;
}) {
  return (
    <div className="mb-4 space-y-2 border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">Type</span>
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
      {series.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">Series</span>
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
      )}
    </div>
  );
}
