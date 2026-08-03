'use client';

import Link from 'next/link';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { seriesInk } from '@/lib/site';
import { classifySession, localDayKey, sessionTimeLabel } from '@/lib/calendar-grid';
import type { Session } from '@/lib/types';
import type { CalendarWeekend } from './types';

// The agenda. A race weekend is the unit fans actually think in, and the unit
// lib/group.ts already models — so this view exists because the month grid was
// answering a question nobody asks ("what happens on the 19th?") while hiding
// the answer to the one everybody asks ("what's on this weekend?") behind a
// "+12 more" counter.
//
// Two properties the grid structurally cannot have:
//   * Nothing is ever truncated. The card grows to its sessions, so a 15-session
//     Saturday and an empty Tuesday both cost exactly what they're worth.
//   * It is mobile-native. Day columns collapse to a stack, and every row still
//     carries series, time and session name — where the month grid's phone
//     layout was six coloured dots and no text at all.

function dayLabelOf(d: Date, utc: boolean): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    ...(utc ? { timeZone: 'UTC' } : {}),
  })
    .format(d)
    .toUpperCase();
}

function groupSessionsByDay(
  sessions: Session[],
  utc: boolean,
): { key: string; label: string; sessions: Session[] }[] {
  const out: { key: string; label: string; sessions: Session[] }[] = [];
  const byKey = new Map<string, (typeof out)[number]>();
  for (const s of [...sessions].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const key = localDayKey(s, utc);
    let day = byKey.get(key);
    if (!day) {
      day = { key, label: dayLabelOf(s.start, utc), sessions: [] };
      byKey.set(key, day);
      out.push(day);
    }
    day.sessions.push(s);
  }
  return out;
}

function SessionRow({
  session,
  seriesSlug,
  round,
  utc,
  now,
}: {
  session: Session;
  seriesSlug: string;
  round: number;
  utc: boolean;
  now: Date;
}) {
  const isRace = classifySession(session.title) === 'race';
  const isLive = !session.dateOnly && session.start <= now && now <= session.end;
  const isPast = !isLive && session.end < now;
  return (
    <Link
      href={`/series/${seriesSlug}/weekend/${round}`}
      className={`flex items-baseline gap-2.5 border-b border-border/70 py-2 transition-colors duration-(--duration-fast) last:border-b-0 hover:bg-surface-elevated ${
        isPast ? 'opacity-50' : ''
      }`}
    >
      <span
        className={`shrink-0 font-mono tnum ${
          isRace ? 'text-sm font-bold text-text' : 'text-[13px] text-text-muted'
        }`}
      >
        {sessionTimeLabel(session, utc)}
      </span>
      <span
        className={`min-w-0 flex-1 truncate ${
          isRace
            ? 'font-display text-sm font-extrabold uppercase tracking-wide text-text'
            : 'text-[13px] text-text-muted'
        }`}
      >
        {session.title}
      </span>
      {isLive && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-live/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-live-pill">
          <span className="h-1.5 w-1.5 rounded-full bg-live live-pulse" />
          live
        </span>
      )}
    </Link>
  );
}

/** What to head the card with. rounds.json is the source when curated, but not
 *  every series has one — WRC's Rally del Paraguay has no entry and came through
 *  as round 0, which headed the card "ROUND 0". Those feeds carry the event name
 *  inside the session title instead ("WRC | Rally del Paraguay"), so fall back to
 *  that, then the venue, before ever showing a round number we don't trust. */
export function weekendTitle(weekend: CalendarWeekend): string {
  if (weekend.roundName) return weekend.roundName;
  const first = weekend.sessions[0]?.title?.trim() ?? '';
  const piped = first.includes('|') ? first.split('|').pop()!.trim() : '';
  if (piped) return piped;
  if (weekend.round > 0) return `Round ${weekend.round}`;
  return weekend.location?.split(',')[0].trim() || first || 'Race weekend';
}

function WeekendCard({ weekend, now, utc }: { weekend: CalendarWeekend; now: Date; utc: boolean }) {
  const days = groupSessionsByDay(weekend.sessions, utc);
  const href = `/series/${weekend.seriesSlug}/weekend/${weekend.round}`;
  const title = weekendTitle(weekend);
  // A one-day event in a three-column track left a stranded third-width column
  // rule under an otherwise empty row. Columns follow the day count instead.
  const dayCols =
    days.length === 1 ? '' : days.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <section
      aria-label={`${weekend.seriesName} — ${title}`}
      className="relative border border-border bg-surface p-4 md:p-5"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundColor: weekend.color, opacity: weekend.isPast ? 0.4 : 1 }}
      />

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: weekend.color }}
            />
            <span
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: seriesInk(weekend.color) }}
            >
              {weekend.seriesName}
            </span>
          </span>
          {/* The event name — the single biggest gap in the old grid, which
              rendered eight loose pills across three cells and never once said
              "Dutch Grand Prix". */}
          <h3 className="mt-1">
            <Link
              href={href}
              className="group inline-flex items-baseline gap-1.5 font-display text-xl font-extrabold uppercase tracking-wide text-text transition-colors duration-(--duration-fast) hover:text-brand md:text-2xl"
            >
              {title}
              <ArrowUpRight
                size={14}
                aria-hidden="true"
                className="shrink-0 opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-70"
              />
            </Link>
          </h3>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
          {/* Only when it's a real championship round — an uncurated series comes
              through as 0, and "ROUND 0" is worse than no badge. */}
          {weekend.round > 0 && (
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted tnum">
              Round {weekend.round}
            </span>
          )}
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted tnum">
            {weekend.dateRangeLabel}
          </span>
        </div>
      </div>

      {weekend.location && (
        <div className="mb-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">
          <MapPin size={11} aria-hidden="true" />
          <span className="font-sans normal-case tracking-normal">{weekend.location}</span>
        </div>
      )}
      {weekend.rescheduleNote && (
        <div className="mb-3 border-l-2 border-brand/50 pl-2 text-xs text-brand/80">
          {weekend.rescheduleNote}
        </div>
      )}

      {/* Day columns. A three-day weekend lands as Fri | Sat | Sun on a laptop;
          a WRC rally with a shakedown plus four days simply wraps to a second
          row instead of being clipped. Below sm it is one stack per day. */}
      <div className={`grid grid-cols-1 gap-x-5 gap-y-4 ${dayCols}`}>
        {days.map(day => (
          <div key={day.key} className="min-w-0">
            <div className="mb-1 border-b-2 border-border-strong pb-1 font-display text-sm font-extrabold uppercase tracking-wide text-text tnum">
              {day.label}
            </div>
            {day.sessions.map(s => (
              <SessionRow
                key={s.uid}
                session={s}
                seriesSlug={weekend.seriesSlug}
                round={weekend.round}
                utc={utc}
                now={now}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Passed weekends collapse to one row — readable, not a 50%-dimmed full card.
 *  Same trade WeekendBlock makes on the per-series calendar tab. */
function PastRow({ weekend }: { weekend: CalendarWeekend }) {
  return (
    <Link
      href={`/series/${weekend.seriesSlug}/weekend/${weekend.round}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-border bg-surface/50 px-3 py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: weekend.color, opacity: 0.5 }}
      />
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
        {weekend.seriesName}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-text-muted">
        {weekendTitle(weekend)}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint tnum">
        {weekend.dateRangeLabel}
      </span>
    </Link>
  );
}

export function WeekendsView({
  weekends,
  now,
  utc,
  monthLabel,
}: {
  weekends: CalendarWeekend[];
  now: Date;
  utc: boolean;
  monthLabel: string;
}) {
  if (weekends.length === 0) {
    return (
      <div className="border border-border bg-surface p-8 text-center">
        <div className="font-display text-lg font-extrabold uppercase tracking-wide text-text">
          Nothing scheduled
        </div>
        <p className="mt-1.5 text-sm text-text-muted">
          No race weekends match your filters in {monthLabel}.
        </p>
      </div>
    );
  }

  const upcoming = weekends.filter(w => !w.isPast);
  const past = weekends.filter(w => w.isPast);

  return (
    <div className="flex flex-col gap-4">
      {/* Two columns on a wide screen so a 15-series month reads as a board
          rather than one very long ribbon. */}
      {upcoming.length > 0 && (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {upcoming.map(w => (
            <WeekendCard key={w.key} weekend={w} now={now} utc={utc} />
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-faint">
              Already run
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col gap-1.5">
            {past.map(w => (
              <PastRow key={w.key} weekend={w} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
