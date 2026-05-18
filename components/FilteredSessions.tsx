'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Session } from '@/lib/types';
import { useFollowedSeries } from '@/lib/useFollowedSeries';
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
}: {
  items: SessionEntry[];
  roundByKey?: Record<string, number>;
}) {
  const { followed, hydrated } = useFollowedSeries();

  const filtered =
    hydrated && followed !== null
      ? items.filter(i => followed.includes(i.seriesSlug))
      : items;

  const months = Array.from(
    new Set(filtered.map(i => monthKey(i.session.start))),
  ).sort();

  const [selectedMonthRaw, setSelectedMonth] = useState<string | null>(null);
  const selectedMonth =
    selectedMonthRaw && months.includes(selectedMonthRaw)
      ? selectedMonthRaw
      : pickDefaultMonth(months);

  if (months.length === 0 || selectedMonth === null) {
    const isFiltered = followed !== null && followed.length < items.length;
    return (
      <div className="rounded-2xl bg-surface/60 border border-border p-8 text-center">
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
        <div className="rounded-2xl bg-surface/60 border border-border p-8 text-center">
          <div className="text-text-faint text-sm">
            Nothing in this month.
          </div>
        </div>
      ) : (
        byDay.map(day => (
          <div key={day.label} className="mb-3">
            <DayHeader label={day.label} count={day.sessions.length} />
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {day.sessions.map(s => (
                <SessionCard
                  key={`${s.seriesSlug}-${s.uid}`}
                  session={s}
                  color={colorByUid[s.uid]}
                  round={roundByKey?.[`${s.seriesSlug}:${s.uid}`]}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
