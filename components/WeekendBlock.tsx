import Link from 'next/link';
import { Session, Weekend } from '@/lib/types';
import { formatLocal } from '@/lib/date';
import { weekendLabel } from '@/lib/weekend';

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

export function WeekendBlock({
  weekend,
  round,
  seriesSlug,
  color,
  showNextTag = false,
}: {
  weekend: Weekend;
  round: number;
  seriesSlug: string;
  color: string;
  showNextTag?: boolean;
}) {
  const { title, subtitle } = weekendLabel(weekend, round);
  const hasNamedTitle = title !== `Round ${round}`;

  return (
    <Link
      href={`/series/${seriesSlug}/weekend/${round}`}
      className={`block rounded-xl bg-surface/40 border border-border/60 p-4 transition-colors duration-(--duration-fast) hover:bg-surface hover:border-border-strong ${
        weekend.isPast ? 'opacity-50 hover:opacity-80' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-text-muted font-medium font-mono tnum">
          {weekend.dateRangeLabel}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {showNextTag && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-text text-bg font-semibold">
              next
            </span>
          )}
          {weekend.previousStartDate && weekend.previousEndDate && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold">
              rescheduled
            </span>
          )}
          {weekend.label && (
            <span
              className="inline-flex items-center text-[10px] uppercase tracking-[0.12em] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${color}26`, color }}
            >
              {weekend.label}
            </span>
          )}
          {!weekend.label && weekend.significance && weekend.significance.tier !== 'note' && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold">
              {weekend.significance.tier}
            </span>
          )}
        </span>
      </div>
      {hasNamedTitle && (
        <h3 className="text-text text-base font-semibold leading-tight mb-0.5">
          {title}
        </h3>
      )}
      {subtitle && (
        <div className="text-xs text-text-faint mb-2">{subtitle}</div>
      )}
      {!subtitle && hasNamedTitle && <div className="mb-2" />}
      {weekend.previousStartDate && weekend.previousEndDate && (
        <div className="text-[11px] text-amber-300/80 mb-2 tnum font-mono">
          Rescheduled from {formatShortRange(weekend.previousStartDate, weekend.previousEndDate)}
          {weekend.rescheduleNote && (
            <span className="text-text-faint font-sans"> · {weekend.rescheduleNote}</span>
          )}
        </div>
      )}
      <ul className="space-y-0.5">
        {weekend.sessions.map((s: Session) => (
          <li
            key={s.uid}
            className="flex items-center justify-between gap-3 text-sm py-1"
          >
            <span className="text-text-muted truncate">{s.title}</span>
            <span className="text-text-faint font-medium tabular-nums font-mono whitespace-nowrap">
              {s.dateOnly ? 'TBC' : formatLocal(s.start)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-text-faint font-semibold">
        Round {round} <span aria-hidden>→</span>
      </div>
    </Link>
  );
}
