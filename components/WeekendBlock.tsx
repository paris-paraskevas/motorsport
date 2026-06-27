import Link from 'next/link';
import { Session, Weekend } from '@/lib/types';
import { LocalTime } from '@/components/LocalTime';
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
  const weekendStartISO = weekend.sessions[0]?.start.toISOString().slice(0, 10);
  // Round 0 = no curated round covers this weekend (pre-season tests,
  // exhibitions). No weekend page exists for it, so render unlinked.
  const isChampionshipRound = round >= 1;
  const Wrapper: React.ElementType = isChampionshipRound ? Link : 'div';

  // Passed weekends collapse to a compact, clickable date + name row (no session
  // timetable, tags or footer) so the upcoming weekend stands out and the old
  // ones stay one tap away. The next/upcoming weekend keeps the full block below.
  if (weekend.isPast) {
    return (
      <Wrapper
        {...(isChampionshipRound ? { href: `/series/${seriesSlug}/weekend/${round}` } : {})}
        className={`relative block border-y border-border py-2.5 pl-5 pr-4 transition-colors duration-(--duration-fast) ${
          isChampionshipRound ? 'hover:bg-surface' : ''
        }`}
      >
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ backgroundColor: color, opacity: 0.5 }}
        />
        <div className="flex items-baseline gap-3 min-w-0">
          <time
            dateTime={weekendStartISO}
            className="shrink-0 text-[11px] uppercase tracking-wider text-text-faint font-medium font-mono tnum"
          >
            {weekend.dateRangeLabel}
          </time>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-muted">
            {hasNamedTitle ? title : `Round ${round}`}
          </span>
          {isChampionshipRound && (
            <span aria-hidden className="shrink-0 text-text-faint">
              →
            </span>
          )}
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      {...(isChampionshipRound
        ? { href: `/series/${seriesSlug}/weekend/${round}` }
        : {})}
      className={`relative block border-y border-border p-4 pl-5 transition-colors duration-(--duration-fast) ${
        isChampionshipRound ? 'hover:bg-surface' : ''
      } ${weekend.isPast ? 'opacity-50 hover:opacity-80' : ''}`}
    >
      {/* Series-color rule — the weekend's left edge. */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: color, opacity: weekend.isPast ? 0.5 : 1 }}
      />
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <time
          dateTime={weekendStartISO}
          className="text-xs uppercase tracking-wider text-text-muted font-medium font-mono tnum"
        >
          {weekend.dateRangeLabel}
        </time>
        <span className="ml-auto flex items-center gap-1.5">
          {showNextTag && (
            <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 bg-brand text-black font-bold">
              next
            </span>
          )}
          {weekend.previousStartDate && weekend.previousEndDate && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-brand/40 text-brand font-semibold font-mono">
              rescheduled
            </span>
          )}
          {weekend.label && (
            <span
              className="inline-flex items-center font-mono text-[10px] uppercase tracking-[0.12em] font-semibold px-2 py-0.5 border"
              style={{ borderColor: `${color}66`, color }}
            >
              {weekend.label}
            </span>
          )}
          {!weekend.label && weekend.significance && weekend.significance.tier !== 'note' && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-brand/40 text-brand font-semibold font-mono">
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
        <div className="text-[11px] text-brand/80 mb-2 tnum font-mono">
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
            {s.dateOnly ? (
              <span className="text-text-faint font-medium tabular-nums font-mono whitespace-nowrap">
                TBC
              </span>
            ) : (
              <time
                dateTime={s.start.toISOString()}
                className="text-text-faint font-medium tabular-nums font-mono whitespace-nowrap"
              >
                <LocalTime instant={s.start.getTime()} />
              </time>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-text-faint font-semibold">
        {isChampionshipRound ? (
          <>
            Round {round} <span aria-hidden>→</span>
          </>
        ) : (
          'Testing · non-championship'
        )}
      </div>
    </Wrapper>
  );
}
