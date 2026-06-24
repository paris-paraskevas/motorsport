'use client';

import { useState } from 'react';
import { Filter } from 'lucide-react';
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
  // null = follow `now`; otherwise the ms of a chosen local-midnight day.
  const [anchorMs, setAnchorMs] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [types, setTypes] = useState<Set<SessionKind>>(() => new Set(['practice', 'qualifying', 'race']));
  const [seriesSel, setSeriesSel] = useState<Set<string> | null>(null); // null = all present

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

  const toggleType = (k: SessionKind) =>
    setTypes(cur => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const toggleSeries = (slug: string) =>
    setSeriesSel(cur => {
      const base = cur ?? new Set(present.map(p => p.slug));
      const next = new Set(base);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
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

  return (
    <>
      <CalendarToolbar
        view={view}
        onView={setView}
        label={label}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={() => setAnchorMs(null)}
      />
      <div className="mb-3 -mt-1">
        <button
          type="button"
          onClick={() => setFiltersOpen(o => !o)}
          aria-expanded={filtersOpen}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
        >
          <Filter size={13} />
          Filters
          {filterActive && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-label="filters active" />}
        </button>
      </div>
      {filtersOpen && (
        <CalendarFilters
          types={types}
          onToggleType={toggleType}
          series={present}
          seriesShown={seriesShown}
          onToggleSeries={toggleSeries}
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
