'use client';
import { useState } from 'react';
import { Weekend } from '@/lib/types';
import { pickDefaultMonth } from '@/lib/months';
import { WeekendBlock } from './WeekendBlock';
import { MonthNavigator } from './MonthNavigator';

interface WeekendWithRound {
  weekend: Weekend;
  round: number;
}

function weekendMonthKey(weekend: Weekend): string {
  // weekend.key is dateKey(startDate) = 'YYYY-MM-DD'
  return weekend.key.slice(0, 7);
}

export function MonthScopedWeekends({
  weekends,
  color,
  seriesSlug,
  nextWeekendKey,
}: {
  weekends: WeekendWithRound[];
  color: string;
  seriesSlug: string;
  nextWeekendKey: string | undefined;
}) {
  const months = Array.from(
    new Set(weekends.map(w => weekendMonthKey(w.weekend))),
  ).sort();

  const [selectedMonthRaw, setSelectedMonth] = useState<string | null>(null);
  const selectedMonth =
    selectedMonthRaw && months.includes(selectedMonthRaw)
      ? selectedMonthRaw
      : pickDefaultMonth(months);

  if (months.length === 0 || selectedMonth === null) {
    return (
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-text-faint font-semibold mb-3">
          Calendar
        </h2>
        <div className="text-text-faint text-sm">Nothing scheduled.</div>
      </section>
    );
  }

  const inMonth = weekends.filter(
    w => weekendMonthKey(w.weekend) === selectedMonth,
  );

  return (
    <section className="mb-8">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        Calendar
      </h2>
      <MonthNavigator
        months={months}
        selected={selectedMonth}
        onChange={setSelectedMonth}
      />
      {inMonth.length === 0 ? (
        <div className="text-text-faint text-sm text-center py-8">
          Nothing in this month.
        </div>
      ) : (
        <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
          {inMonth.map(({ weekend, round }) => (
            <WeekendBlock
              key={weekend.key}
              weekend={weekend}
              round={round}
              seriesSlug={seriesSlug}
              color={color}
              showNextTag={weekend.key === nextWeekendKey}
            />
          ))}
        </div>
      )}
    </section>
  );
}
