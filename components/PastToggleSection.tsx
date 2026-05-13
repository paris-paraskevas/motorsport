'use client';
import { useState } from 'react';
import { Weekend } from '@/lib/types';
import { WeekendBlock } from './WeekendBlock';

export function PastToggleSection({
  pastWeekends,
  upcomingWeekends,
  color,
  nextWeekendKey,
}: {
  pastWeekends: Weekend[];
  upcomingWeekends: Weekend[];
  color: string;
  nextWeekendKey: string | undefined;
}) {
  const [showPast, setShowPast] = useState(false);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500">Calendar</h2>
        {pastWeekends.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPast(v => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            {showPast ? '− hide past' : '+ show past'}
          </button>
        )}
      </div>
      <div className="space-y-6">
        {showPast && pastWeekends.map(w => (
          <WeekendBlock key={w.key} weekend={w} color={color} />
        ))}
        {upcomingWeekends.map(w => (
          <WeekendBlock
            key={w.key}
            weekend={w}
            color={color}
            showNextTag={w.key === nextWeekendKey}
          />
        ))}
        {upcomingWeekends.length === 0 && !showPast && (
          <div className="text-zinc-600 text-sm">Nothing scheduled.</div>
        )}
      </div>
    </section>
  );
}
