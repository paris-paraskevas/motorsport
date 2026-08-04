'use client';

import { weekDays } from '@/lib/calendar-grid';
import type { CalendarEntry } from './types';
import { SessionPill } from './SessionPill';

export function WeekView({
  anchor,
  now,
  buckets,
  roundByKey,
  utc,
  onSelectDay,
}: {
  anchor: Date;
  now: Date;
  buckets: Map<string, CalendarEntry[]>;
  roundByKey?: Record<string, number>;
  utc: boolean;
  onSelectDay: (d: Date) => void;
}) {
  const days = weekDays(anchor, now);
  return (
    <div className="border border-border bg-surface p-2 md:p-3">
      <div className="grid grid-cols-1 gap-px bg-border-strong md:grid-cols-7">
        {days.map(cell => {
          const entries = buckets.get(cell.key) ?? [];
          // No weekend tint here either: --surface to --surface-elevated is a
          // 1.06:1 step, so it added an invisible third state and nothing else.
          // Every column already carries its own day header, which is what tells
          // you it's a Saturday.
          return (
            <div
              key={cell.key}
              className={`p-2 ${cell.isToday ? 'bg-surface-elevated' : 'bg-surface'}`}
            >
              <button
                type="button"
                onClick={() => onSelectDay(cell.date)}
                className="mb-1.5 flex w-full items-baseline gap-1.5 border-b-2 border-border-strong pb-1 text-left"
              >
                <span
                  className={`font-display text-sm font-extrabold uppercase tracking-wide ${
                    cell.isToday ? 'text-brand' : 'text-text'
                  }`}
                >
                  {new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(cell.date)}
                </span>
                <span className="font-mono text-sm font-bold text-text-muted tnum">
                  {cell.date.getDate()}
                </span>
                {entries.length > 0 && (
                  <span className="ml-auto font-mono text-[10px] text-text-faint tnum">
                    {entries.length}
                  </span>
                )}
              </button>
              {entries.length === 0 ? (
                <span className="px-1 font-mono text-xs text-text-faint">—</span>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {entries.map(e => (
                    <SessionPill
                      key={`${e.seriesSlug}-${e.session.uid}`}
                      entry={e}
                      round={roundByKey?.[`${e.seriesSlug}:${e.session.uid}`]}
                      utc={utc}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
