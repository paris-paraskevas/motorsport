import type { Session } from '@/lib/types';

export interface CalendarEntry {
  session: Session;
  color: string;
  seriesSlug: string;
  /** Series display name (e.g. "Formula 1") — used for the day view's
   *  order-by-series group headers. */
  seriesName: string;
}

export type CalendarViewMode = 'month' | 'week' | 'day';
