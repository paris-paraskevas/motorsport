'use client';

import { buildMonthMatrix } from '@/lib/calendar-grid';
import type { CalendarEntry } from './types';
import { SessionPill } from './SessionPill';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthView({
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
  const cells = buildMonthMatrix(anchor, now);
  return (
    <div>
      <div className="grid grid-cols-7">
        {WEEKDAYS.map(d => (
          <div key={d} className="px-1 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-l border-t border-border">
        {cells.map(cell => {
          const entries = buckets.get(cell.key) ?? [];
          return (
            <div
              key={cell.key}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay(cell.date)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDay(cell.date);
                }
              }}
              className={`flex min-h-[84px] cursor-pointer flex-col gap-1 border-b border-r border-border p-1.5 align-top transition-colors hover:bg-surface md:min-h-[112px] ${
                cell.inMonth ? '' : 'bg-bg opacity-50'
              } ${cell.isToday ? 'ring-1 ring-inset ring-brand' : ''}`}
            >
              <span className={`font-mono text-xs tabular-nums ${cell.isToday ? 'text-brand' : 'text-text-muted'}`}>
                {cell.date.getDate()}
              </span>
              {/* md+: full pills */}
              <div className="hidden min-w-0 flex-col gap-0.5 md:flex">
                {entries.slice(0, 3).map(e => (
                  <SessionPill
                    key={`${e.seriesSlug}-${e.session.uid}`}
                    entry={e}
                    round={roundByKey?.[`${e.seriesSlug}:${e.session.uid}`]}
                  />
                ))}
                {entries.length > 3 && (
                  <span className="px-1 font-mono text-[10px] text-text-faint">+{entries.length - 3} more</span>
                )}
              </div>
              {/* mobile: colour dots only */}
              <div className="flex flex-wrap gap-1 md:hidden">
                {entries.slice(0, 6).map(e => (
                  <span
                    key={`${e.seriesSlug}-${e.session.uid}`}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: e.color }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
