'use client';

import { weekDays } from '@/lib/calendar-grid';
import type { CalendarEntry } from './types';
import { SessionPill } from './SessionPill';

export function WeekView({
  anchor,
  now,
  buckets,
  roundByKey,
  onSelectDay,
}: {
  anchor: Date;
  now: Date;
  buckets: Map<string, CalendarEntry[]>;
  roundByKey?: Record<string, number>;
  onSelectDay: (d: Date) => void;
}) {
  const days = weekDays(anchor, now);
  return (
    <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-7">
      {days.map(cell => {
        const entries = buckets.get(cell.key) ?? [];
        return (
          <div key={cell.key} className="bg-bg p-2">
            <button
              type="button"
              onClick={() => onSelectDay(cell.date)}
              className="mb-1 flex w-full items-baseline gap-1.5 text-left"
            >
              <span className={`font-display text-sm font-bold uppercase tracking-wide ${cell.isToday ? 'text-brand' : 'text-text'}`}>
                {new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(cell.date)}
              </span>
              <span className="font-mono text-xs tabular-nums text-text-muted">{cell.date.getDate()}</span>
            </button>
            {entries.length === 0 ? (
              <span className="font-mono text-[11px] text-text-faint">—</span>
            ) : (
              <div className="flex flex-col gap-0.5">
                {entries.map(e => (
                  <SessionPill
                    key={`${e.seriesSlug}-${e.session.uid}`}
                    entry={e}
                    round={roundByKey?.[`${e.seriesSlug}:${e.session.uid}`]}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
