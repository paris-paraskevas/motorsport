import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { Weekend } from '@/lib/types';
import { formatRelative } from '@/lib/date';
import { weekendIsLive, weekendLabel, weekendStartEnd } from '@/lib/weekend';

function formatShortRange(startISO: string, endISO: string): string {
  const start = new Date(startISO + 'T00:00:00Z');
  const end = new Date(endISO + 'T00:00:00Z');
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const monthShort = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${monthShort(start)}`;
  }
  return `${start.getUTCDate()} ${monthShort(start)} – ${end.getUTCDate()} ${monthShort(end)}`;
}

// Weekend hero on the timing-screen language (W1a, redesign 2026-06): flush
// border-y section, mono meta row, Saira display title with a series-color
// full stop — mirroring the series page header. The old back arrow is gone
// (operator 2026-06-11); the series name in the meta row still links to the
// series page, it just stops pretending to be navigation chrome.
export function WeekendHero({
  weekend,
  round,
  seriesSlug,
  seriesName,
  color,
}: {
  weekend: Weekend;
  round: number;
  seriesSlug: string;
  seriesName: string;
  color: string;
}) {
  const now = new Date();
  const { start, end } = weekendStartEnd(weekend);
  const isLive = weekendIsLive(weekend, now);
  const isPast = !isLive && end.getTime() < now.getTime();
  const location = weekend.sessions.find(s => s.location)?.location;
  const { title, subtitle } = weekendLabel(weekend, round);

  return (
    <section className="mb-8 border-y border-border py-5 md:py-6">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap font-mono text-[11px] uppercase tracking-[0.18em] font-semibold">
        <Link
          href={`/series/${seriesSlug}`}
          className="text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
        >
          {seriesName}
        </Link>
        <span className="text-border-strong">·</span>
        <span className="tabular-nums text-tint">Round {round}</span>
        {isLive && (
          <>
            <span className="text-border-strong">·</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.14em] px-2 py-0.5 bg-red-500/15 text-red-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 live-pulse" />
              live
            </span>
          </>
        )}
        {isPast && (
          <>
            <span className="text-border-strong">·</span>
            <span className="text-[10px] tracking-[0.14em] px-2 py-0.5 border border-border text-text-muted">
              past
            </span>
          </>
        )}
        {weekend.previousStartDate && weekend.previousEndDate && (
          <>
            <span className="text-border-strong">·</span>
            <span className="text-[10px] tracking-[0.14em] px-2 py-0.5 border border-brand/40 text-brand">
              rescheduled
            </span>
          </>
        )}
        {weekend.significance && weekend.significance.tier !== 'note' && (
          <>
            <span className="text-border-strong">·</span>
            <span className="text-[10px] tracking-[0.14em] px-2 py-0.5 border border-brand/40 text-brand">
              {weekend.significance.tier}
            </span>
          </>
        )}
      </div>

      <h1 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-[0.95] text-text">
        {title}
        <span style={{ color }}>.</span>
      </h1>
      {subtitle && (
        <p className="mt-1.5 text-text-muted text-base">{subtitle}</p>
      )}

      <div className="mt-4 flex items-baseline gap-4 flex-wrap">
        <time
          dateTime={start.toISOString().slice(0, 10)}
          className="text-lg md:text-xl font-semibold text-text tnum font-mono"
        >
          {weekend.dateRangeLabel}
        </time>
        {!isPast && (
          <span className="text-sm text-text-faint tnum font-mono">
            {isLive ? 'underway' : formatRelative(start)}
          </span>
        )}
      </div>

      {location && (
        <div className="mt-2 flex items-center gap-1.5 text-sm text-text-faint">
          <MapPin size={13} className="text-text-faint" />
          <span>{location}</span>
        </div>
      )}

      {weekend.previousStartDate && weekend.previousEndDate && (
        <p className="mt-3 text-sm text-brand/80 tnum font-mono">
          Rescheduled from {formatShortRange(weekend.previousStartDate, weekend.previousEndDate)}
          {weekend.rescheduleNote && (
            <span className="text-text-muted font-sans"> · {weekend.rescheduleNote}</span>
          )}
        </p>
      )}

      {weekend.significance?.note && (
        <p className="mt-4 text-sm text-brand/80 leading-relaxed">
          {weekend.significance.note}
        </p>
      )}
    </section>
  );
}
