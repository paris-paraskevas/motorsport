import type { Session } from '@/lib/types';

export interface CalendarEntry {
  session: Session;
  color: string;
  seriesSlug: string;
  /** Series display name (e.g. "Formula 1") — used for the day view's
   *  order-by-series group headers. */
  seriesName: string;
  /** The round the schedule places the session in (X6 C: resolved on the server, so the client carries no lookup
   *  keyed by the feed’s ids); absent for a session outside every round. */
  round?: number;
}

export type CalendarViewMode = 'month' | 'week' | 'day' | 'season';
