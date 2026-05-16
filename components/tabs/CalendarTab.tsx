import { Series } from '@/lib/types';
import { groupByWeekend } from '@/lib/group';
import { PastToggleSection } from '@/components/PastToggleSection';

export function CalendarTab({ series }: { series: Series }) {
  const now = new Date();
  const weekends = groupByWeekend(series.sessions, now, series.rounds).map(weekend => ({
    weekend,
    round: weekend.round,
  }));
  const pastWeekends = weekends.filter(w => w.weekend.isPast);
  const upcomingWeekends = weekends.filter(w => !w.weekend.isPast);
  const nextWeekendKey = upcomingWeekends[0]?.weekend.key;

  return (
    <PastToggleSection
      pastWeekends={pastWeekends}
      upcomingWeekends={upcomingWeekends}
      color={series.meta.color}
      seriesSlug={series.meta.slug}
      nextWeekendKey={nextWeekendKey}
    />
  );
}
