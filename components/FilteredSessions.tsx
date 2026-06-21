'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Session } from '@/lib/types';
import { useFollowedSeries } from '@/lib/useFollowedSeries';
import { useNow } from '@/lib/use-now';
import { groupByDay } from '@/lib/group';
import { monthKey, pickDefaultMonth } from '@/lib/months';
import { SessionCard } from './SessionCard';
import { DayHeader } from './DayHeader';
import { MonthNavigator } from './MonthNavigator';

interface SessionEntry {
  session: Session;
  color: string;
  seriesSlug: string;
}

export function FilteredSessions({
  items,
  roundByKey,
  serverNow,
}: {
  items: SessionEntry[];
  roundByKey?: Record<string, number>;
  serverNow: string;
}) {
  const { followed, hydrated } = useFollowedSeries();
  const { now } = useNow(serverNow);
  const [selectedMonthRaw, setSelectedMonth] = useState<string | null>(null);

  // Until followed-series prefs resolve on the client, render a skeleton — never
  // the unfiltered list. The page is statically cached/user-agnostic, so the SSR
  // HTML can't know the user's series; without this gate it paints EVERY series,
  // then the post-hydration filter yanks the non-followed ones away (the
  // personalization flash). Skeleton → your series, never other-series data.
  // Guests resolve from localStorage in ~1 frame; signed-in from the local mirror.
  if (!hydrated) return <SessionsSkeleton />;

  const filtered =
    followed !== null
      ? items.filter(i => followed.includes(i.seriesSlug))
      : items;

  const months = Array.from(
    new Set(filtered.map(i => monthKey(i.session.start))),
  ).sort();

  const selectedMonth =
    selectedMonthRaw && months.includes(selectedMonthRaw)
      ? selectedMonthRaw
      : pickDefaultMonth(months);

  if (months.length === 0 || selectedMonth === null) {
    const isFiltered = followed !== null && followed.length < items.length;
    return (
      <div className="border border-border bg-surface/40 p-8 text-center">
        <div className="text-text text-base font-medium mb-1">
          Nothing scheduled
        </div>
        {isFiltered ? (
          <div className="text-text-faint text-sm">
            No upcoming sessions in your followed series.{' '}
            <Link
              href="/settings"
              className="text-text-muted underline underline-offset-2 hover:text-text"
            >
              Manage
            </Link>
            .
          </div>
        ) : (
          <div className="text-text-faint text-sm">
            Nothing in the next window across the configured series.
          </div>
        )}
      </div>
    );
  }

  const colorByUid: Record<string, string> = {};
  filtered.forEach(i => {
    colorByUid[i.session.uid] = i.color;
  });

  const inMonth = filtered.filter(
    i => monthKey(i.session.start) === selectedMonth,
  );
  const byDay = groupByDay(inMonth.map(i => i.session));

  return (
    <>
      <MonthNavigator
        months={months}
        selected={selectedMonth}
        onChange={setSelectedMonth}
      />
      {byDay.length === 0 ? (
        <div className="border border-border bg-surface/40 p-8 text-center">
          <div className="text-text-faint text-sm">
            Nothing in this month.
          </div>
        </div>
      ) : (
        byDay.map(day => (
          <div key={day.label} className="mb-4">
            <DayHeader label={day.label} count={day.sessions.length} />
            {/* Flat timing rows: each card carries its own bottom rule, the
                container closes the top. gap-x only — vertical rhythm comes
                from the rules, not gaps. */}
            <div className="border-t border-border grid md:grid-cols-2 xl:grid-cols-3 gap-x-8">
              {day.sessions.map(s => (
                <SessionCard
                  key={`${s.seriesSlug}-${s.uid}`}
                  session={s}
                  color={colorByUid[s.uid]}
                  round={roundByKey?.[`${s.seriesSlug}:${s.uid}`]}
                  now={now}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}

// Shown until followed-series prefs resolve on the client, in place of the
// unfiltered list — so the cached page never paints other series then yanks
// them. Roughly matches the month-nav + day-group height to avoid layout shift.
function SessionsSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="mb-4 h-8 w-full max-w-md bg-surface" />
      {[0, 1].map(g => (
        <div key={g} className="mb-4">
          <div className="mb-2 h-5 w-40 bg-surface" />
          <div className="grid grid-cols-1 gap-x-8 border-t border-border md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 border-b border-border bg-surface/60" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
