import { Series } from '@/lib/types';
import { groupByWeekend } from '@/lib/group';
import { MonthScopedWeekends } from '@/components/MonthScopedWeekends';
import { CancelledRoundsSection } from '@/components/CancelledRounds';

export function CalendarTab({ series }: { series: Series }) {
  const now = new Date();
  const weekends = groupByWeekend(series.sessions, now, series.rounds).map(
    weekend => ({
      weekend,
      round: weekend.round,
    }),
  );
  const nextWeekendKey = weekends.find(w => !w.weekend.isPast)?.weekend.key;

  return (
    <>
      <MonthScopedWeekends
        weekends={weekends}
        color={series.meta.color}
        seriesSlug={series.meta.slug}
        nextWeekendKey={nextWeekendKey}
      />
      <CancelledRoundsSection
        cancelledRounds={series.rounds?.cancelledRounds}
      />
    </>
  );
}
