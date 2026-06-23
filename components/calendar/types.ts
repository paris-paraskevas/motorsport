import type { Session } from '@/lib/types';

export interface CalendarEntry {
  session: Session;
  color: string;
  seriesSlug: string;
}

export type CalendarViewMode = 'month' | 'week' | 'day';
