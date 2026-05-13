import { Series } from '@/lib/types';
import { groupByWeekend } from '@/lib/group';
import { PastToggleSection } from '@/components/PastToggleSection';

export function CalendarTab({ series }: { series: Series }) {
  const now = new Date();
  const weekends = groupByWeekend(series.sessions, now);
  const pastWeekends = weekends.filter(w => w.isPast);
  const upcomingWeekends = weekends.filter(w => !w.isPast);
  const nextWeekendKey = upcomingWeekends[0]?.key;

  return (
    <PastToggleSection
      pastWeekends={pastWeekends}
      upcomingWeekends={upcomingWeekends}
      color={series.meta.color}
      nextWeekendKey={nextWeekendKey}
    />
  );
}
