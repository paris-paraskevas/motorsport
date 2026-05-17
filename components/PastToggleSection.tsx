'use client';
import { useState } from 'react';
import { Weekend } from '@/lib/types';
import { WeekendBlock } from './WeekendBlock';

interface WeekendWithRound {
  weekend: Weekend;
  round: number;
}

export function PastToggleSection({
  pastWeekends,
  upcomingWeekends,
  color,
  seriesSlug,
  nextWeekendKey,
}: {
  pastWeekends: WeekendWithRound[];
  upcomingWeekends: WeekendWithRound[];
  color: string;
  seriesSlug: string;
  nextWeekendKey: string | undefined;
}) {
  const [showPast, setShowPast] = useState(false);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider text-text-faint font-semibold">Calendar</h2>
        {pastWeekends.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPast(v => !v)}
            className="text-xs text-text-faint hover:text-text-muted transition-colors duration-(--duration-fast)"
          >
            {showPast ? '− hide past' : '+ show past'}
          </button>
        )}
      </div>
      <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
        {showPast && pastWeekends.map(({ weekend, round }) => (
          <WeekendBlock
            key={weekend.key}
            weekend={weekend}
            round={round}
            seriesSlug={seriesSlug}
            color={color}
          />
        ))}
        {upcomingWeekends.map(({ weekend, round }) => (
          <WeekendBlock
            key={weekend.key}
            weekend={weekend}
            round={round}
            seriesSlug={seriesSlug}
            color={color}
            showNextTag={weekend.key === nextWeekendKey}
          />
        ))}
        {upcomingWeekends.length === 0 && !showPast && (
          <div className="text-text-faint text-sm">Nothing scheduled.</div>
        )}
      </div>
    </section>
  );
}
