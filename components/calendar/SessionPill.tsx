'use client';

import Link from 'next/link';
import type { CalendarEntry } from './types';

function timeLabel(session: CalendarEntry['session']): string {
  if (session.dateOnly) return 'TBC';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(session.start);
}

// Compact entry for dense month/week cells: series-color dot + time-or-TBC +
// truncated title, linking to the weekend (or series) page. stopPropagation so a
// pill click doesn't also trigger the day cell's "open day view".
export function SessionPill({ entry, round }: { entry: CalendarEntry; round?: number }) {
  const { session, color, seriesSlug } = entry;
  const href = round ? `/series/${seriesSlug}/weekend/${round}` : `/series/${seriesSlug}`;
  return (
    <Link
      href={href}
      onClick={e => e.stopPropagation()}
      className="flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-[11px] hover:bg-surface"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="shrink-0 font-mono tabular-nums text-text-muted">{timeLabel(session)}</span>
      <span className="min-w-0 truncate text-text">{session.title}</span>
    </Link>
  );
}
