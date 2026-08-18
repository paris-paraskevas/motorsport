'use client';

import { useState } from 'react';

// Calendar filters as an inline chip row, applied ON TAP (design handoff §4.2:
// "Today saying 'just F1' costs five actions: open modal → expand accordion →
// deselect all → select F1 → Save" — the modal, the draft state and the Save
// button are gone). Two groups:
//   · ALL SESSIONS / RACES ONLY — a radio pair over the session-type filter.
//   · Series chips — tap a series while everything is shown to focus JUST it;
//     tap more to add them; tapping the last selected one returns to all.
// The first few series show as chips; "+N more" expands the rest in place.
export function CalendarChips({
  racesOnly,
  onRacesOnly,
  series,
  seriesSel,
  onToggleSeries,
}: {
  racesOnly: boolean;
  onRacesOnly: (v: boolean) => void;
  series: { slug: string; color: string }[];
  seriesSel: Set<string> | null; // null = all
  onToggleSeries: (slug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? series : series.slice(0, 4);
  const hidden = series.length - visible.length;

  const chipBase =
    'inline-flex min-h-9 items-center gap-2 border px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors duration-(--duration-fast)';
  const on = 'border-text bg-surface-elevated text-text';
  const off = 'border-border-strong text-text-muted hover:text-text';

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Calendar filters">
      <button type="button" aria-pressed={!racesOnly} onClick={() => onRacesOnly(false)} className={`${chipBase} ${!racesOnly ? on : off}`}>
        All sessions
      </button>
      <button type="button" aria-pressed={racesOnly} onClick={() => onRacesOnly(true)} className={`${chipBase} ${racesOnly ? on : off}`}>
        Races only
      </button>
      <span aria-hidden="true" className="h-5 w-px bg-border-strong" />
      {visible.map(s => {
        const active = seriesSel !== null && seriesSel.has(s.slug);
        return (
          <button
            key={s.slug}
            type="button"
            aria-pressed={active}
            onClick={() => onToggleSeries(s.slug)}
            className={`${chipBase} ${active ? on : off}`}
          >
            <span aria-hidden="true" className="h-[13px] w-[3px] shrink-0" style={{ backgroundColor: s.color }} />
            {s.slug.replace(/-/g, ' ')}
          </button>
        );
      })}
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className={`${chipBase} ${off}`}>
          + {hidden} more
        </button>
      )}
      {expanded && series.length > 4 && (
        <button type="button" onClick={() => setExpanded(false)} className={`${chipBase} ${off}`}>
          Fewer
        </button>
      )}
    </div>
  );
}
