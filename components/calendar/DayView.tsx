'use client';

import { dayKeyOf } from '@/lib/calendar-grid';
import type { CalendarEntry } from './types';
import { SessionCard } from '@/components/SessionCard';

export function DayView({
  anchor,
  now,
  buckets,
  roundByKey,
}: {
  anchor: Date;
  now: Date;
  buckets: Map<string, CalendarEntry[]>;
  roundByKey?: Record<string, number>;
}) {
  const entries = (buckets.get(dayKeyOf(anchor)) ?? [])
    .slice()
    .sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  if (entries.length === 0) {
    return (
      <div className="border border-border bg-surface/40 p-8 text-center">
        <div className="text-sm text-text-faint">Nothing scheduled this day.</div>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      {entries.map(e => (
        <SessionCard
          key={`${e.seriesSlug}-${e.session.uid}`}
          session={e.session}
          color={e.color}
          round={roundByKey?.[`${e.seriesSlug}:${e.session.uid}`]}
          now={now}
        />
      ))}
    </div>
  );
}
