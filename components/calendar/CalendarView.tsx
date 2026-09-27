'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFollowedSeries } from '@/lib/useFollowedSeries';
import { useNow } from '@/lib/use-now';
import {
  bucketByDay,
  startOfDay,
  addDays,
  addWeeks,
  addMonths,
  monthLabel,
  weekLabel,
  dayLabel,
  classifySession,
} from '@/lib/calendar-grid';
import type { CalendarEntry, CalendarViewMode } from './types';
import { CalendarToolbar } from './CalendarToolbar';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { SeasonView } from './SeasonView';

// Parse a /calendar?m=YYYY-MM deep-link into the anchor's ms (local-midnight,
// the 1st of that month) — or null (follow `now`) when absent or malformed.
function parseMonthParam(m: string | null): number | null {
  const match = m ? /^(\d{4})-(\d{2})$/.exec(m) : null;
  if (match) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return new Date(Number(match[1]), month - 1, 1).getTime();
  }
  return null;
}

type CalendarViewProps = {
  items: CalendarEntry[];
  roundByKey?: Record<string, number>;
  roundNames?: Record<string, string>;
  serverNow: string;
  /** The Filters region's picks (P2.5 PR B): the series by name, the sessions by kind; null or absent narrows nothing. */
  seriesNames?: string[] | null;
  sessionKinds?: string[] | null;
};

// Root calendar (replaces the month-list FilteredSessions for /calendar). Owns
// the device clock, the followed-series filter, and the view + anchor state. All
// interactivity is client-side so the server route stays static/ISR.
//
// CalendarInner reads ?m= via useSearchParams; on a prerendered route that hook
// must sit under a Suspense boundary or the production build fails, so the
// public CalendarView wraps it. The skeleton is both the Suspense fallback and
// the inner pre-hydration state — no extra flash, and /calendar stays ○ Static.
export function CalendarView(props: CalendarViewProps) {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarInner {...props} />
    </Suspense>
  );
}

function CalendarInner({ items, roundByKey, roundNames, serverNow, seriesNames = null, sessionKinds = null }: CalendarViewProps) {
  const { followed, hydrated } = useFollowedSeries();
  const { now, clock } = useNow(serverNow);
  const [view, setView] = useState<CalendarViewMode>('month');
  // null = follow `now`; otherwise the ms of a chosen local-midnight day (same
  // shape the in-page month <select> uses). The header's Calendar menu
  // deep-links to /calendar?m=YYYY-MM; reading it via useSearchParams (not a
  // one-time window read) re-seeds the anchor on EVERY navigation — clicking a
  // month while already on /calendar used to be a no-op because the old lazy
  // initializer never re-ran on a query-only soft nav.
  const searchParams = useSearchParams();
  const monthParam = searchParams.get('m');
  const [anchorMs, setAnchorMs] = useState<number | null>(() => parseMonthParam(monthParam));
  // Re-seed when ?m= changes. Adjusting state during render (React's documented
  // pattern, as in HeaderNavMenu) — not an effect, so no cascading-render lint.
  const [lastMonthParam, setLastMonthParam] = useState(monthParam);
  if (monthParam !== lastMonthParam) {
    setLastMonthParam(monthParam);
    setAnchorMs(parseMonthParam(monthParam));
  }

  // The filters are the Filters region's (P2.5 PR B): its picks arrive as props from the address, so a filtered calendar is a
  // cached variant and a shareable link, and the region's chips replace the box this component drew; ?m= stays the calendar's own.

  // Gate on BOTH prefs (no other-series flash) AND the synced clock (so day
  // bucketing uses the device timezone, never the server's — no SSR mismatch).
  if (!hydrated || !clock) return <CalendarSkeleton />;

  const anchor = anchorMs != null ? new Date(anchorMs) : startOfDay(now);
  const filtered = followed !== null ? items.filter(i => followed.includes(i.seriesSlug)) : items;

  // The Filters region's picks, on top of the followed set: the series by name, the sessions by kind.
  const shown = filtered.filter(
    i => (sessionKinds === null || sessionKinds.includes(classifySession(i.session.title))) && (seriesNames === null || seriesNames.includes(i.seriesName)),
  );
  const buckets = bucketByDay(shown);

  const setAnchor = (d: Date) => setAnchorMs(startOfDay(d).getTime());
  const step = (n: number) => {
    if (view === 'month') setAnchor(addMonths(anchor, n));
    else if (view === 'week') setAnchor(addWeeks(anchor, n));
    else setAnchor(addDays(anchor, n));
  };
  const selectDay = (d: Date) => {
    setAnchor(d);
    setView('day');
  };

  const label =
    view === 'month' ? monthLabel(anchor)
    : view === 'week' ? weekLabel(anchor)
    : view === 'day' ? dayLabel(anchor)
    : 'Season';

  // Per-series last known round, for the season view's derived FINALE badge.
  const maxRoundBySlug: Record<string, number> = {};
  if (roundByKey) {
    for (const [k, r] of Object.entries(roundByKey)) {
      const slug = k.slice(0, k.indexOf(':'));
      if ((maxRoundBySlug[slug] ?? 0) < r) maxRoundBySlug[slug] = r;
    }
  }

  // Month-picker options: every month spanned by the season's sessions, always
  // including now's month and the month currently in view (so the <select> value
  // always matches an option, even after arrowing past the season edge).
  const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const currentMonthValue = monthStart(anchor).getTime();
  const monthOptions = (() => {
    const times = items.map(i => i.session.start.getTime());
    const lo = monthStart(new Date(Math.min(now.getTime(), currentMonthValue, ...times)));
    const hi = monthStart(new Date(Math.max(now.getTime(), currentMonthValue, ...times)));
    const opts: { value: number; label: string }[] = [];
    let cur = lo;
    for (let guard = 0; cur.getTime() <= hi.getTime() && guard < 60; guard++) {
      opts.push({ value: cur.getTime(), label: monthLabel(cur) });
      cur = addMonths(cur, 1);
    }
    return opts;
  })();

  return (
    <>
      <ThisWeekend items={filtered} now={now} roundByKey={roundByKey} roundNames={roundNames} />
      <CalendarToolbar
        view={view}
        onView={setView}
        label={label}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={() => setAnchorMs(null)}
        monthOptions={monthOptions}
        currentMonthValue={currentMonthValue}
        onPickMonth={ms => setAnchorMs(ms)}
      />
      {view === 'month' && (
        <MonthView anchor={anchor} now={now} buckets={buckets} roundByKey={roundByKey} roundNames={roundNames} onSelectDay={selectDay} />
      )}
      {view === 'week' && (
        <WeekView anchor={anchor} now={now} buckets={buckets} roundByKey={roundByKey} onSelectDay={selectDay} />
      )}
      {view === 'day' && <DayView anchor={anchor} now={now} buckets={buckets} roundByKey={roundByKey} />}
      {view === 'season' && (
        <SeasonView
          entries={shown}
          now={now}
          roundByKey={roundByKey}
          roundNames={roundNames}
          maxRoundBySlug={maxRoundBySlug}
        />
      )}
      {/* One subscribe line for the whole timeline (mocks #23/#25): webcal for
          calendar apps, the .ics as a plain download. */}
      <div className="mt-4 flex flex-wrap items-baseline justify-end gap-x-4 border-t border-border pt-3 font-mono text-10 font-semibold uppercase tracking-[0.14em]">
        <a href="webcal://paddock-tracker.com/api/calendar/all.ics" className="text-brand hover:underline">
          Subscribe to this calendar →
        </a>
        <a href="/api/calendar/all.ics" className="text-text-muted hover:text-text">
          .ics
        </a>
      </div>
    </>
  );
}

// "This weekend" pinned above the grid as raised cards (§4.2): every round
// with a session in the next four days (or live right now), one card each.
function ThisWeekend({
  items,
  now,
  roundByKey,
  roundNames,
}: {
  items: CalendarEntry[];
  now: Date;
  roundByKey?: Record<string, number>;
  roundNames?: Record<string, string>;
}) {
  const horizon = now.getTime() + 4 * 24 * 3600 * 1000;
  const groups = new Map<
    string,
    { slug: string; name: string; color: string; round: number; first: Date; last: Date }
  >();
  for (const e of items) {
    const start = e.session.start.getTime();
    const end = e.session.end.getTime();
    if (end < now.getTime() - 12 * 3600 * 1000 || start > horizon) continue;
    const round = roundByKey?.[`${e.seriesSlug}:${e.session.uid}`];
    if (!round) continue;
    const key = `${e.seriesSlug}:${round}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        slug: e.seriesSlug,
        name: e.seriesName,
        color: e.color,
        round,
        first: e.session.start,
        last: e.session.end,
      });
    } else {
      if (e.session.start < g.first) g.first = e.session.start;
      if (e.session.end > g.last) g.last = e.session.end;
    }
  }
  const cards = [...groups.entries()]
    .sort((a, b) => a[1].first.getTime() - b[1].first.getTime())
    .slice(0, 4);
  if (cards.length === 0) return null;
  const fmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <section aria-label="This weekend" className="mb-5">
      <div className="mb-2 flex items-baseline justify-between border-b border-text pb-1">
        <span className="font-mono text-10 font-semibold uppercase tracking-[0.18em] text-text-muted">
          This weekend
        </span>
      </div>
      {/* 2-up from the smallest phones: four full-width cards ate ~450px of a
          375px viewport before the grid even started (feedback board). */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.map(([key, g]) => (
          <Link
            key={key}
            href={`/series/${g.slug}/weekend/${g.round}`}
            className="flex min-h-11 items-center gap-2.5 border border-border-strong bg-surface-elevated px-3 py-2.5 transition-colors duration-(--duration-fast) hover:border-text"
          >
            <span aria-hidden="true" className="h-4 w-[3px] shrink-0" style={{ backgroundColor: g.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif text-15 font-semibold leading-tight text-text">
                {roundNames?.[key] ?? `${g.name} · Round ${g.round}`}
              </span>
              <span className="block truncate font-mono text-9 uppercase tracking-[0.12em] text-text-faint">
                {g.name} · {fmt.format(g.first)} – {fmt.format(g.last)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// Mirrors the toolbar + a month grid's rough height to avoid layout shift while
// prefs + the clock resolve on the client.
function CalendarSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="mb-4 h-11 w-full border-y border-border bg-surface/60" />
      <div className="grid grid-cols-7 border-l border-t border-border">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="min-h-[84px] border-b border-r border-border bg-surface/30 md:min-h-[112px]" />
        ))}
      </div>
    </div>
  );
}
