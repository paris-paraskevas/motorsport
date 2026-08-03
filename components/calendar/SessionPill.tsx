'use client';

import Link from 'next/link';
import { classifySession, sessionTimeLabel } from '@/lib/calendar-grid';
import { seriesInk } from '@/lib/site';
import type { CalendarEntry } from './types';

// Compact entry for the week view's day columns: series-colour spine, time (or
// "TBC"), and the session title, linking to the weekend page.
//
// Type scale is deliberately 13px, not the old 11px. The tokens were never the
// readability problem — --text-muted measures 7.85:1 on the page background —
// but 11px body text in a dense grid is unreadable regardless of ratio, and the
// colleague review flagged exactly this.
export function SessionPill({
  entry,
  round,
  utc,
}: {
  entry: CalendarEntry;
  round?: number;
  utc?: boolean;
}) {
  const { session, color, seriesSlug, seriesName } = entry;
  const href = round ? `/series/${seriesSlug}/weekend/${round}` : `/series/${seriesSlug}`;
  const isRace = classifySession(session.title) === 'race';
  return (
    <Link
      href={href}
      className="flex min-w-0 items-baseline gap-1.5 rounded-sm px-1 py-1 transition-colors duration-(--duration-fast) hover:bg-surface-elevated"
    >
      <span
        aria-hidden="true"
        className="mt-1 h-3 w-[3px] shrink-0 self-start"
        style={{ backgroundColor: color }}
      />
      <span className="min-w-0 flex-1">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: seriesInk(color) }}
        >
          {seriesName}
        </span>
        <span
          className={`block truncate text-[13px] ${
            isRace ? 'font-semibold text-text' : 'text-text-muted'
          }`}
        >
          {session.title}
        </span>
      </span>
      <span
        className={`shrink-0 font-mono text-[11px] tnum ${
          isRace ? 'font-bold text-text' : 'text-text-muted'
        }`}
      >
        {sessionTimeLabel(session, utc)}
      </span>
    </Link>
  );
}
