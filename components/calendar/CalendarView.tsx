'use client';

import { useEffect, useState } from 'react';
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
  type SessionKind,
} from '@/lib/calendar-grid';
import type { CalendarEntry, CalendarViewMode } from './types';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarFilters } from './CalendarFilters';
import { MonthView } from './MonthView';
import { WeekView } from './WeekView';
import { DayView } from './DayView';

// Root calendar (replaces the month-list FilteredSessions for /calendar). Owns
// the device clock, the followed-series filter, and the view + anchor state. All
// interactivity is client-side so the server route stays static/ISR.
export function CalendarView({
  items,
  roundByKey,
  serverNow,
}: {
  items: CalendarEntry[];
  roundByKey?: Record<string, number>;
  serverNow: string;
}) {
  const { followed, hydrated } = useFollowedSeries();
  const { now, clock } = useNow(serverNow);
  const [view, setView] = useState<CalendarViewMode>('month');
  // null = follow `now`; otherwise the ms of a chosen local-midnight day. Seeded
  // lazily from the header's Calendar deep-link (/calendar?m=YYYY-MM) on the
  // first client render — guarded for SSR (window absent → null). Read here, not
  // via useSearchParams, so /calendar stays static. Same value shape the in-page
  // month <select> uses (monthStart(...).getTime()).
  const [anchorMs, setAnchorMs] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const m = new URLSearchParams(window.location.search).get('m');
      const match = m ? /^(\d{4})-(\d{2})$/.exec(m) : null;
      if (match) {
        const month = Number(match[2]);
        if (month >= 1 && month <= 12) return new Date(Number(match[1]), month - 1, 1).getTime();
      }
    } catch {
      /* ignore a malformed ?m= param */
    }
    return null;
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [types, setTypes] = useState<Set<SessionKind>>(() => new Set(['practice', 'qualifying', 'race']));
  const [seriesSel, setSeriesSel] = useState<Set<string> | null>(null); // null = all present
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  // Persist filters per device (localStorage): load once on mount, then save on
  // change (gated on the load so defaults don't clobber stored prefs).
  useEffect(() => {
    try {
      const raw = localStorage.getItem('paddock:calendar-filters');
      if (raw) {
        const p = JSON.parse(raw) as { types?: unknown; series?: unknown };
        if (Array.isArray(p.types)) {
          setTypes(new Set(p.types.filter((t): t is SessionKind => t === 'practice' || t === 'qualifying' || t === 'race')));
        }
        setSeriesSel(Array.isArray(p.series) ? new Set(p.series.filter((s): s is string => typeof s === 'string')) : null);
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
        'paddock:calendar-filters',
        JSON.stringify({ types: [...types], series: seriesSel ? [...seriesSel] : null }),
      );
    } catch {
      /* quota / disabled */
    }
  }, [types, seriesSel, filtersHydrated]);

  // Gate on BOTH prefs (no other-series flash) AND the synced clock (so day
  // bucketing uses the device timezone, never the server's — no SSR mismatch).
  if (!hydrated || !clock) return <CalendarSkeleton />;

  const anchor = anchorMs != null ? new Date(anchorMs) : startOfDay(now);
  const filtered = followed !== null ? items.filter(i => followed.includes(i.seriesSlug)) : items;

  // In-calendar event-type + series filters, on top of the followed set.
  const present = [...new Map(filtered.map(i => [i.seriesSlug, i.color])).entries()].map(([slug, color]) => ({ slug, color }));
  const allTypes = types.size >= 3; // default (all three) → also shows 'other' sessions
  const seriesShown = (slug: string) => seriesSel === null || seriesSel.has(slug);
  const shown = filtered.filter(
    i => (allTypes || types.has(classifySession(i.session.title))) && seriesShown(i.seriesSlug),
  );
  const buckets = bucketByDay(shown);

  // Filters are edited as a draft inside the modal and committed on Save; the
  // persistence effect then writes the committed values through.
  const applyFilters = (t: Set<SessionKind>, s: Set<string> | null) => {
    setTypes(t);
    setSeriesSel(s);
  };
  const filterActive = !allTypes || (seriesSel !== null && seriesSel.size !== present.length);

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

  const label = view === 'month' ? monthLabel(anchor) : view === 'week' ? weekLabel(anchor) : dayLabel(anchor);

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
      <CalendarToolbar
        view={view}
        onView={setView}
        label={label}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        monthOptions={monthOptions}
        currentMonthValue={currentMonthValue}
        onPickMonth={ms => setAnchorMs(ms)}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen(o => !o)}
        filterActive={filterActive}
      />
      {filtersOpen && (
        <CalendarFilters
          initialTypes={types}
          initialSeriesSel={seriesSel}
          series={present}
          onApply={applyFilters}
          onClose={() => setFiltersOpen(false)}
        />
      )}
      {view === 'month' && (
        <MonthView anchor={anchor} now={now} buckets={buckets} roundByKey={roundByKey} onSelectDay={selectDay} />
      )}
      {view === 'week' && (
        <WeekView anchor={anchor} now={now} buckets={buckets} roundByKey={roundByKey} onSelectDay={selectDay} />
      )}
      {view === 'day' && <DayView anchor={anchor} now={now} buckets={buckets} roundByKey={roundByKey} />}
    </>
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
