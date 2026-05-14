'use client';
import Link from 'next/link';
import type { Session } from '@/lib/types';
import { useFollowedSeries } from '@/lib/useFollowedSeries';
import { groupByDay } from '@/lib/group';
import { SessionCard } from './SessionCard';
import { DayHeader } from './DayHeader';

interface SessionEntry {
  session: Session;
  color: string;
  seriesSlug: string;
}

export function FilteredSessions({ items }: { items: SessionEntry[] }) {
  const { followed, hydrated } = useFollowedSeries();

  // Server-render + first client paint: show everything. After hydration,
  // apply the user's follow filter if configured.
  const filtered =
    hydrated && followed !== null
      ? items.filter(i => followed.includes(i.seriesSlug))
      : items;

  const colorByUid: Record<string, string> = {};
  filtered.forEach(i => {
    colorByUid[i.session.uid] = i.color;
  });

  const byDay = groupByDay(filtered.map(i => i.session));

  if (byDay.length === 0) {
    const isFiltered = followed !== null && followed.length < items.length;
    return (
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-8 text-center">
        <div className="text-zinc-300 text-base font-medium mb-1">
          Nothing scheduled
        </div>
        {isFiltered ? (
          <div className="text-zinc-500 text-sm">
            No upcoming sessions in your followed series.{' '}
            <Link
              href="/settings"
              className="text-zinc-300 underline underline-offset-2 hover:text-zinc-100"
            >
              Manage
            </Link>
            .
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">
            Nothing in the next window across the configured series.
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {byDay.map(day => (
        <div key={day.label} className="mb-3">
          <DayHeader label={day.label} count={day.sessions.length} />
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {day.sessions.map(s => (
              <SessionCard
                key={`${s.seriesSlug}-${s.uid}`}
                session={s}
                color={colorByUid[s.uid]}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
