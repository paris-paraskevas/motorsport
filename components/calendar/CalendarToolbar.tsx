'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { seriesInk } from '@/lib/site';
import { seriesCode, sessionTimeLabel } from '@/lib/calendar-grid';
import type { CalendarEntry, CalendarViewMode, TimeMode } from './types';

const VIEWS: { mode: CalendarViewMode; label: string }[] = [
  { mode: 'weekends', label: 'Weekends' },
  { mode: 'month', label: 'Month' },
  { mode: 'week', label: 'Week' },
  { mode: 'day', label: 'Day' },
];

const TIME_MODES: { mode: TimeMode; label: string }[] = [
  { mode: 'local', label: 'Local' },
  { mode: 'utc', label: 'UTC' },
];

/** Live countdown to the next session. Owns its own 1s tick so the rest of the
 *  calendar re-renders on the minute; the first render derives from the parent's
 *  clock so SSR and hydration agree. Mirrors HomeContent's Countdown. */
function Countdown({ to, initialNow }: { to: Date; initialNow: Date }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);
  const ms = Math.max(0, to.getTime() - now.getTime());
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor(ms / 3_600_000) % 24;
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1_000) % 60;
  return (
    <span className="font-mono tnum tracking-tight">
      {d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`}
    </span>
  );
}

export interface LegendSeries {
  slug: string;
  name: string;
  color: string;
  count: number;
}

// The calendar's control deck. Three tiers, densest first:
//   1. UP NEXT — a full-bleed band in the /app chyron idiom. The page never used
//      to answer "what's on next", which is the first thing anyone opens a
//      calendar for.
//   2. The month cluster — arrows sit AGAINST the label, not at the container's
//      far edges (at 1440px that was a ~1300px eye-journey per month step), plus
//      the Today button the 0.78.0 toolbar dropped.
//   3. The series legend, which doubles as the filter. Fifteen series were
//      encoded as colour with no key anywhere on the page; this is the Paddock
//      Wire chip bar doing both jobs at once.
export function CalendarToolbar({
  view,
  onView,
  label,
  onPrev,
  onNext,
  onToday,
  atToday,
  monthOptions,
  currentMonthValue,
  onPickMonth,
  filtersOpen,
  onToggleFilters,
  filterActive,
  next,
  nextHref,
  now,
  timeMode,
  onTimeMode,
  tz,
  legend,
  seriesSel,
  onToggleSeries,
  onAllSeries,
  totalShown,
}: {
  view: CalendarViewMode;
  onView: (v: CalendarViewMode) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  atToday: boolean;
  monthOptions: { value: number; label: string }[];
  currentMonthValue: number;
  onPickMonth: (ms: number) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  filterActive: boolean;
  next?: CalendarEntry;
  nextHref?: string;
  now: Date;
  timeMode: TimeMode;
  onTimeMode: (m: TimeMode) => void;
  tz: string;
  legend: LegendSeries[];
  seriesSel: Set<string> | null;
  onToggleSeries: (slug: string) => void;
  onAllSeries: () => void;
  totalShown: number;
}) {
  const utc = timeMode === 'utc';
  const chip =
    'border px-3 py-1.5 font-mono text-[11px] leading-none uppercase tracking-[0.12em] transition-colors duration-(--duration-fast)';
  const chipOn = 'border-text bg-text text-bg';
  const chipOff = 'border-border text-text-muted hover:border-border-strong hover:text-text';

  return (
    <div className="mb-6">
      {/* ── UP NEXT ─────────────────────────────────────────────────────────
          Full-bleed against the page gutters (PAGE_WIDE is p-4/md:p-6/lg:p-8),
          same negative-margin trick the /app chyron uses. Safe here because the
          band spans the full content width. */}
      {next && (
        <section
          aria-label="Next session"
          className="relative -mx-4 mb-5 border-t border-b-2 border-border-strong bg-surface px-4 py-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8"
        >
          {/* Series-coloured rail — identity before any text is read. A raw hex
              on a fill is the sanctioned use (lib/site.ts); text goes through
              seriesInk. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ backgroundColor: next.color }}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center bg-brand-fill px-2 py-1 font-mono text-[10px] leading-none font-bold uppercase tracking-[0.2em] text-tint-contrast">
              Up next
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: next.color }}
              />
              <span
                className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: seriesInk(next.color) }}
              >
                {next.seriesName}
              </span>
            </span>
            <Link
              href={nextHref ?? `/series/${next.seriesSlug}`}
              className="inline-flex min-w-0 basis-full items-center gap-1.5 text-text transition-colors duration-(--duration-fast) hover:text-brand md:flex-1 md:basis-auto"
            >
              <span className="min-w-0 truncate text-base font-semibold tracking-tight md:text-lg">
                {next.session.title}
              </span>
              <ArrowUpRight size={13} aria-hidden="true" className="shrink-0 opacity-60" />
            </Link>
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-muted tnum">
              {next.session.dateOnly
                ? 'Date set · time TBC'
                : `${new Intl.DateTimeFormat('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    ...(utc ? { timeZone: 'UTC' } : {}),
                  }).format(next.session.start)} ${sessionTimeLabel(next.session, utc)} ${tz}`}
            </span>
            {!next.session.dateOnly && (
              <span className="font-mono text-sm font-bold uppercase tracking-[0.08em] text-brand">
                <Countdown to={next.session.start} initialNow={now} />
              </span>
            )}
          </div>
        </section>
      )}

      {/* ── Month cluster + view switcher ───────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-1.5">
          <div className="flex items-stretch border border-border">
            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous"
              className="border-r border-border px-2.5 py-2 text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface hover:text-text"
            >
              <ChevronLeft size={16} />
            </button>
            {/* Native select so the month jump stays one tap on a phone. Sized to
                its content and pinned beside the arrows — the old full-width bar
                put the chevron a screen away from the label it belonged to. */}
            <select
              value={currentMonthValue}
              onChange={e => onPickMonth(Number(e.target.value))}
              aria-label="Jump to month"
              className="cursor-pointer bg-transparent px-2 py-2 text-center font-display text-lg font-extrabold uppercase tracking-wide text-text transition-colors duration-(--duration-fast) hover:bg-surface md:text-xl"
            >
              {monthOptions.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next"
              className="border-l border-border px-2.5 py-2 text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface hover:text-text"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={onToday}
            disabled={atToday}
            className={`${chip} ${atToday ? 'border-border text-text-faint' : chipOff} disabled:cursor-default`}
          >
            Today
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex">
            {VIEWS.map(v => (
              <button
                key={v.mode}
                type="button"
                onClick={() => onView(v.mode)}
                aria-pressed={view === v.mode}
                className={`${chip} -ml-px ${view === v.mode ? chipOn : chipOff}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onToggleFilters}
            aria-expanded={filtersOpen}
            className={`${chip} inline-flex items-center gap-1.5 ${filtersOpen ? chipOn : chipOff}`}
          >
            <SlidersHorizontal size={12} aria-hidden="true" />
            Sessions
            {filterActive && (
              <span className="h-1.5 w-1.5 rounded-full bg-brand-fill" aria-label="active" />
            )}
          </button>
        </div>
      </div>

      {/* The week/day range, which the month select can't carry once you're
          zoomed in past a month. */}
      {(view === 'week' || view === 'day') && (
        <div className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-text-muted">
          {label}
        </div>
      )}

      {/* ── Series legend / filter + timezone ───────────────────────────── */}
      {legend.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onAllSeries}
              aria-pressed={seriesSel === null}
              className={`border px-2 py-1 font-mono text-[11px] leading-none font-bold uppercase tracking-[0.14em] transition-colors duration-(--duration-fast) ${
                seriesSel === null ? chipOn : chipOff
              }`}
            >
              All {totalShown}
            </button>
            {legend.map(s => {
              const on = seriesSel === null || seriesSel.has(s.slug);
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => onToggleSeries(s.slug)}
                  aria-pressed={on}
                  title={s.name}
                  aria-label={`${s.name}, ${s.count} sessions`}
                  className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px] leading-none uppercase tracking-[0.12em] transition-colors duration-(--duration-fast) ${
                    on
                      ? 'border-border-strong text-text'
                      : 'border-border text-text-faint hover:text-text-muted'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color, opacity: on ? 1 : 0.35 }}
                  />
                  {/* Fifteen full series names wrap into a wall on a phone, so the
                      chip bar drops to codes there and spells them out from sm up.
                      The accessible name is always the full one. */}
                  <span aria-hidden="true" className="sm:hidden">{seriesCode(s.slug)}</span>
                  <span aria-hidden="true" className="hidden sm:inline">{s.name}</span>
                  <span aria-hidden="true" className="tnum text-text-faint">{s.count}</span>
                </button>
              );
            })}
          </div>

          {/* Times-in control — a global motorsport calendar that never said
              which zone its clock times were in. */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
              Times in
            </span>
            <div className="flex">
              {TIME_MODES.map(t => (
                <button
                  key={t.mode}
                  type="button"
                  onClick={() => onTimeMode(t.mode)}
                  aria-pressed={timeMode === t.mode}
                  className={`-ml-px border px-2 py-1 font-mono text-[11px] leading-none uppercase tracking-[0.12em] transition-colors duration-(--duration-fast) ${
                    timeMode === t.mode ? chipOn : chipOff
                  }`}
                >
                  {t.mode === 'local' ? tz : 'UTC'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
