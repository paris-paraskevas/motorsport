'use client';

import { Suspense, useEffect, useState } from 'react';
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
  dayKeyOf,
  classifySession,
  tzLabel,
  SESSION_KINDS,
  type SessionKind,
} from '@/lib/calendar-grid';
import type { CalendarEntry, CalendarViewMode, CalendarWeekend, TimeMode } from './types';
import { CalendarToolbar, type LegendSeries } from './CalendarToolbar';
import { CalendarFilters } from './CalendarFilters';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';
import { WeekendsView } from './WeekendsView';

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

const PREFS_KEY = 'paddock:calendar-filters';

type CalendarViewProps = {
  items: CalendarEntry[];
  weekends: CalendarWeekend[];
  roundByKey?: Record<string, number>;
  serverNow: string;
};

// Root calendar. Owns the device clock, the followed-series filter, the view +
// anchor state, the series/session filters and the time zone mode. All
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

function CalendarInner({ items, weekends, roundByKey, serverNow }: CalendarViewProps) {
  const { followed, hydrated } = useFollowedSeries();
  const { now, clock } = useNow(serverNow);
  // Weekends is the default: an agenda answers "what's on this weekend?", which
  // is what people open a motorsport calendar for. The month grid is the
  // overview, one click away.
  const [view, setView] = useState<CalendarViewMode>('weekends');
  // null = follow `now`; otherwise the ms of a chosen local-midnight day (same
  // shape the in-page month <select> uses). The header's Calendar menu
  // deep-links to /calendar?m=YYYY-MM; reading it via useSearchParams (not a
  // one-time window read) re-seeds the anchor on EVERY navigation — clicking a
  // month while already on /calendar used to be a no-op because the old lazy
  // initializer never re-ran on a query-only soft nav.
  const monthParam = useSearchParams().get('m');
  const [anchorMs, setAnchorMs] = useState<number | null>(() => parseMonthParam(monthParam));
  // Re-seed when ?m= changes. Adjusting state during render (React's documented
  // pattern, as in HeaderNavMenu) — not an effect, so no cascading-render lint.
  const [lastMonthParam, setLastMonthParam] = useState(monthParam);
  if (monthParam !== lastMonthParam) {
    setLastMonthParam(monthParam);
    setAnchorMs(parseMonthParam(monthParam));
  }
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [types, setTypes] = useState<Set<SessionKind>>(() => new Set(SESSION_KINDS));
  const [seriesSel, setSeriesSel] = useState<Set<string> | null>(null); // null = all present
  const [timeMode, setTimeMode] = useState<TimeMode>('local');
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  // Persist filters per device (localStorage): load once on mount, then save on
  // change (gated on the load so defaults don't clobber stored prefs).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { types?: unknown; series?: unknown; timeMode?: unknown };
        if (Array.isArray(p.types)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- persisted-filter adoption after mount is the hydration-safe pattern
          setTypes(new Set(p.types.filter((t): t is SessionKind => SESSION_KINDS.includes(t as SessionKind))));
        }
        setSeriesSel(
          Array.isArray(p.series) ? new Set(p.series.filter((s): s is string => typeof s === 'string')) : null,
        );
        if (p.timeMode === 'utc' || p.timeMode === 'local') setTimeMode(p.timeMode);
      }
    } catch {
      /* ignore corrupt prefs */
    }
    setFiltersHydrated(true);
  }, []);
  useEffect(() => {
    if (!filtersHydrated) return;
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ types: [...types], series: seriesSel ? [...seriesSel] : null, timeMode }),
      );
    } catch {
      /* quota / disabled */
    }
  }, [types, seriesSel, timeMode, filtersHydrated]);

  // Gate on BOTH prefs (no other-series flash) AND the synced clock (so day
  // bucketing uses the device timezone, never the server's — no SSR mismatch).
  if (!hydrated || !clock) return <CalendarSkeleton />;

  const utc = timeMode === 'utc';
  const tz = tzLabel(now, clock, false);
  const anchor = anchorMs != null ? new Date(anchorMs) : startOfDay(now);
  const followedOnly = <T extends { seriesSlug: string }>(xs: T[]): T[] =>
    followed !== null ? xs.filter(x => followed.includes(x.seriesSlug)) : xs;

  const filtered = followedOnly(items);
  const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const monthOf = monthStart(anchor).getTime();
  const monthEnd = addMonths(monthStart(anchor), 1).getTime();
  const inMonth = (i: CalendarEntry) => {
    const t = i.session.start.getTime();
    return t >= monthOf && t < monthEnd;
  };

  const seriesShown = (slug: string) => seriesSel === null || seriesSel.has(slug);
  const typeShown = (title: string) => types.has(classifySession(title));
  const shown = filtered.filter(i => typeShown(i.session.title) && seriesShown(i.seriesSlug));
  // Buckets stay whole-season: the 42-cell month matrix legitimately shows the
  // tail of the previous month and the head of the next one.
  const buckets = bucketByDay(shown, utc);

  // Counts are scoped to the month in view. Season-wide numbers read as a lie
  // sitting next to "AUGUST 2026" — "ALL 1056" is the whole calendar, not August.
  // The legend itself is built from the followed set BEFORE the series filter, so
  // deselecting a series doesn't remove its own chip and strand it off-screen.
  const monthEntries = filtered.filter(i => inMonth(i) && typeShown(i.session.title));
  const legend: LegendSeries[] = [...new Map(monthEntries.map(i => [i.seriesSlug, i])).values()]
    .map(i => ({
      slug: i.seriesSlug,
      name: i.seriesName,
      color: i.color,
      count: monthEntries.filter(x => x.seriesSlug === i.seriesSlug).length,
    }))
    .sort((a, b) => b.count - a.count);
  const monthShown = monthEntries.filter(i => seriesShown(i.seriesSlug)).length;

  const filterActive =
    types.size !== SESSION_KINDS.length || (seriesSel !== null && seriesSel.size !== legend.length);

  const setAnchor = (d: Date) => setAnchorMs(startOfDay(d).getTime());
  const step = (n: number) => {
    if (view === 'week') setAnchor(addWeeks(anchor, n));
    else if (view === 'day') setAnchor(addDays(anchor, n));
    else setAnchor(addMonths(anchor, n)); // weekends + month both page by month
  };
  const selectDay = (d: Date) => {
    setAnchor(d);
    setView('day');
  };
  const toggleSeries = (slug: string) =>
    setSeriesSel(cur => {
      // First click on a chip while "all" is implicit means "only this one" —
      // the fast path people actually want from a legend.
      if (cur === null) return new Set(legend.map(s => s.slug).filter(s => s === slug));
      const next = new Set(cur);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next.size === legend.length ? null : next;
    });

  const label = view === 'week' ? weekLabel(anchor) : view === 'day' ? dayLabel(anchor) : monthLabel(anchor);
  // "Today" is a no-op when the anchor already IS today (and, in month view, when
  // the anchor sits anywhere in the current month).
  const atToday =
    view === 'month' || view === 'weekends'
      ? anchor.getFullYear() === now.getFullYear() && anchor.getMonth() === now.getMonth()
      : dayKeyOf(anchor) === dayKeyOf(now);

  // Weekends in the anchored month — the month nav drives every view, so ‹ ›
  // means the same thing wherever you are.
  const weekendsShown = followedOnly(weekends)
    .filter(w => seriesShown(w.seriesSlug))
    .map(w => ({ ...w, sessions: w.sessions.filter(s => typeShown(s.title)) }))
    .filter(w => w.sessions.length > 0)
    // A weekend belongs to the month it intersects, so a Jan-31→Feb-2 round
    // shows up in both rather than falling through the gap between them.
    .filter(w => {
      const first = w.sessions[0].start.getTime();
      const last = w.sessions[w.sessions.length - 1].start.getTime();
      return last >= monthOf && first < monthEnd;
    });

  const nextUp = shown.find(i => (i.session.dateOnly ? i.session.end > now : i.session.start > now));
  const nextRound = nextUp ? roundByKey?.[`${nextUp.seriesSlug}:${nextUp.session.uid}`] : undefined;

  // Month-picker options: every month spanned by the season's sessions, always
  // including now's month and the month currently in view (so the <select> value
  // always matches an option, even after arrowing past the season edge).
  const monthOptions = (() => {
    const times = items.map(i => i.session.start.getTime());
    const lo = monthStart(new Date(Math.min(now.getTime(), monthOf, ...times)));
    const hi = monthStart(new Date(Math.max(now.getTime(), monthOf, ...times)));
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
      <CalendarToolbar
        view={view}
        onView={setView}
        label={label}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={() => setAnchorMs(null)}
        atToday={atToday}
        monthOptions={monthOptions}
        currentMonthValue={monthOf}
        onPickMonth={ms => setAnchorMs(ms)}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen(o => !o)}
        filterActive={filterActive}
        next={nextUp}
        nextHref={
          nextUp
            ? nextRound
              ? `/series/${nextUp.seriesSlug}/weekend/${nextRound}`
              : `/series/${nextUp.seriesSlug}`
            : undefined
        }
        now={now}
        timeMode={timeMode}
        onTimeMode={setTimeMode}
        tz={tz}
        legend={legend}
        seriesSel={seriesSel}
        onToggleSeries={toggleSeries}
        onAllSeries={() => setSeriesSel(null)}
        totalShown={monthShown}
      />
      {filtersOpen && (
        <CalendarFilters
          initialTypes={types}
          onApply={setTypes}
          onClose={() => setFiltersOpen(false)}
        />
      )}
      {view === 'weekends' && (
        <WeekendsView weekends={weekendsShown} now={now} utc={utc} monthLabel={monthLabel(anchor)} />
      )}
      {view === 'month' && (
        <MonthView
          anchor={anchor}
          now={now}
          buckets={buckets}
          roundByKey={roundByKey}
          utc={utc}
          onSelectDay={selectDay}
        />
      )}
      {view === 'week' && (
        <WeekView
          anchor={anchor}
          now={now}
          buckets={buckets}
          roundByKey={roundByKey}
          utc={utc}
          onSelectDay={selectDay}
        />
      )}
      {view === 'day' && (
        <DayView anchor={anchor} now={now} buckets={buckets} roundByKey={roundByKey} utc={utc} />
      )}

      {/* Month footing — the old page ended at the 6th grid row and left a black
          void down to the footer. A summary anchors the page and doubles as the
          jump-off into the next rounds. */}
      <MonthFooting
        monthLabel={monthLabel(anchor)}
        sessions={monthShown}
        weekends={weekendsShown.length}
        series={new Set(weekendsShown.map(w => w.seriesSlug)).size}
        tz={utc ? 'UTC' : tz}
      />
    </>
  );
}

function MonthFooting({
  monthLabel,
  sessions,
  weekends,
  series,
  tz,
}: {
  monthLabel: string;
  sessions: number;
  weekends: number;
  series: number;
  tz: string;
}) {
  const stat = (value: number | string, label: string) => (
    <div key={label}>
      <div className="font-display text-2xl font-extrabold text-text tnum">{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">{label}</div>
    </div>
  );
  return (
    <section
      aria-label={`${monthLabel} summary`}
      className="mt-6 border border-border bg-surface px-4 py-4 md:px-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          {stat(sessions, 'Sessions')}
          {stat(weekends, 'Race weekends')}
          {stat(series, 'Series')}
          {stat(tz, 'Times in')}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
          {monthLabel}
        </span>
      </div>
    </section>
  );
}

// Mirrors the deck + a month grid's rough height to avoid layout shift while
// prefs + the clock resolve on the client.
function CalendarSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
      <div className="-mx-4 mb-5 h-20 border-t border-b-2 border-border-strong bg-surface md:-mx-6 lg:-mx-8" />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="h-10 w-56 bg-surface" />
        <div className="h-8 w-72 bg-surface" />
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-44 border border-border bg-surface/60" />
        ))}
      </div>
    </div>
  );
}
