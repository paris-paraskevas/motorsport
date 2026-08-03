import type { Session } from '@/lib/types';

export interface CalendarEntry {
  session: Session;
  color: string;
  seriesSlug: string;
  /** Series display name (e.g. "Formula 1") — used for the day view's
   *  order-by-series group headers. */
  seriesName: string;
}

export type CalendarViewMode = 'weekends' | 'month' | 'week' | 'day';

/** Which zone the calendar renders clock times in. Local is the device zone;
 *  UTC is the neutral reference every official timetable is published in.
 *  Track-local is deliberately absent — Session carries a free-text `location`,
 *  not a venue timezone, so it would need a per-circuit tz sidecar first. */
export type TimeMode = 'local' | 'utc';

/** One race weekend of one series, flattened for the weekends view. Built
 *  server-side from groupByWeekend (lib/group.ts) — the SAME resolution the
 *  per-series Calendar tab and the ICS feed use, so the three can't disagree. */
export interface CalendarWeekend {
  /** `<seriesSlug>:<weekend.key>` — unique across series. */
  key: string;
  seriesSlug: string;
  seriesName: string;
  color: string;
  round: number;
  /** Canonical round name from rounds.json ("Dutch Grand Prix") when curated. */
  roundName?: string;
  dateRangeLabel: string;
  location?: string;
  isPast: boolean;
  rescheduleNote?: string;
  sessions: Session[];
}
