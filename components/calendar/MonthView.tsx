'use client';

import Link from 'next/link';
import { buildMonthMatrix, classifySession, type DayCell } from '@/lib/calendar-grid';
import { seriesInk } from '@/lib/site';
import type { CalendarEntry } from './types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Short series codes for the cell lines (mock 6a register). Slugs not listed
// fall back to the slug uppercased.
const SERIES_CODE: Record<string, string> = {
  f1: 'F1',
  f2: 'F2',
  f3: 'F3',
  'formula-e': 'FE',
  indycar: 'INDY',
  motogp: 'MOTOGP',
  wsbk: 'WSBK',
  wec: 'WEC',
  imsa: 'IMSA',
  'gt-world': 'GTWCE',
  dtm: 'DTM',
  nls: 'NLS',
  wrc: 'WRC',
  'nascar-cup': 'NASCAR',
  'adac-ravenol-24h': 'ADAC',
};

function code(slug: string): string {
  return SERIES_CODE[slug] ?? slug.toUpperCase();
}

function timeLabel(session: CalendarEntry['session']): string {
  if (session.dateOnly) return 'TBC';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(session.start);
}

function cleanTitle(title: string): string {
  return title.replace(/^.*?[-–—:|]\s*/, '').trim() || title;
}

// One rendered line in a day cell: either a single session or a collapsed run
// of same-kind sessions ("Practice 1 · 2", "SS2 – SS10"). Deciders — anything
// qualifying- or race-like — are never collapsed and render bold (§4.2:
// "anything that decides something is always shown").
interface CellLine {
  key: string;
  seriesSlug: string;
  color: string;
  label: string;
  time: string;
  decides: boolean;
  href: string;
}

// Collapse a series' practice-like sessions on one day. WRC stages ("SS11 …")
// collapse to "SS11 – SS18"; numbered practice ("Free Practice 2") to
// "Practice 1 · 2" (or "1 – 3" when more than two); anything unnumbered stays
// a single line.
function collapseRuns(entries: CalendarEntry[], href: string): CellLine[] {
  const first = entries[0];
  const base = {
    seriesSlug: first.seriesSlug,
    color: first.color,
    time: timeLabel(first.session),
    decides: false,
    href,
  };
  if (entries.length === 1) {
    return [{ ...base, key: first.session.uid, label: cleanTitle(first.session.title) }];
  }
  const stageNums = entries
    .map(e => /\bSS\s*(\d+)/i.exec(e.session.title)?.[1])
    .filter((n): n is string => n != null)
    .map(Number);
  if (stageNums.length === entries.length) {
    const lo = Math.min(...stageNums);
    const hi = Math.max(...stageNums);
    return [{ ...base, key: `${first.session.uid}-run`, label: lo === hi ? `SS${lo}` : `SS${lo} – SS${hi}` }];
  }
  const practiceNums = entries
    .map(e => /practice\s*(\d+)|fp\s*(\d+)/i.exec(e.session.title))
    .map(m => (m ? Number(m[1] ?? m[2]) : null));
  if (practiceNums.every((n): n is number => n != null)) {
    const nums = [...(practiceNums as number[])].sort((a, b) => a - b);
    const label =
      nums.length > 2 && nums[nums.length - 1] - nums[0] === nums.length - 1
        ? `Practice ${nums[0]} – ${nums[nums.length - 1]}`
        : `Practice ${nums.join(' · ')}`;
    return [{ ...base, key: `${first.session.uid}-run`, label }];
  }
  // Mixed unnumbered practice-likes: keep them as individual lines.
  return entries.map(e => ({
    ...base,
    key: e.session.uid,
    time: timeLabel(e.session),
    label: cleanTitle(e.session.title),
  }));
}

// Summarise a day's entries into cell lines: per series, deciders stay
// individual (bold), practice-like runs collapse. Order follows clock time.
function summariseDay(entries: CalendarEntry[], roundByKey?: Record<string, number>): CellLine[] {
  const bySeries = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    const arr = bySeries.get(e.seriesSlug);
    if (arr) arr.push(e);
    else bySeries.set(e.seriesSlug, [e]);
  }
  const lines: CellLine[] = [];
  for (const [slug, list] of bySeries) {
    const round = roundByKey?.[`${slug}:${list[0].session.uid}`];
    const href = round ? `/series/${slug}/weekend/${round}` : `/series/${slug}`;
    const deciders = list.filter(e => {
      const k = classifySession(e.session.title);
      return k === 'qualifying' || k === 'race';
    });
    const rest = list.filter(e => !deciders.includes(e));
    if (rest.length > 0) lines.push(...collapseRuns(rest, href));
    for (const d of deciders) {
      lines.push({
        key: d.session.uid,
        seriesSlug: slug,
        color: d.color,
        label: cleanTitle(d.session.title),
        time: timeLabel(d.session),
        decides: true,
        href: roundByKey?.[`${slug}:${d.session.uid}`]
          ? `/series/${slug}/weekend/${roundByKey[`${slug}:${d.session.uid}`]}`
          : href,
      });
    }
  }
  return lines.sort((a, b) => (a.time === 'TBC' ? 1 : b.time === 'TBC' ? -1 : a.time.localeCompare(b.time)));
}

// A race weekend rendered as one labelled bar spanning its days in a week row
// (§4.2: "a Fri–Sun weekend is one object named once").
interface WeekBanner {
  key: string;
  label: string;
  color: string;
  href: string;
  start: number; // 0-based Monday column
  span: number;
}

function bannersForWeek(
  week: DayCell[],
  buckets: Map<string, CalendarEntry[]>,
  roundByKey?: Record<string, number>,
  roundNames?: Record<string, string>,
): WeekBanner[] {
  const groups = new Map<string, { name: string; color: string; slug: string; round: number; days: Set<number> }>();
  week.forEach((cell, idx) => {
    for (const e of buckets.get(cell.key) ?? []) {
      const round = roundByKey?.[`${e.seriesSlug}:${e.session.uid}`];
      if (!round) continue;
      const key = `${e.seriesSlug}:${round}`;
      let g = groups.get(key);
      if (!g) {
        g = { name: e.seriesName, color: e.color, slug: e.seriesSlug, round, days: new Set() };
        groups.set(key, g);
      }
      g.days.add(idx);
    }
  });
  return [...groups.entries()]
    .filter(([, g]) => g.days.size >= 2)
    .map(([key, g]) => {
      const start = Math.min(...g.days);
      const end = Math.max(...g.days);
      const roundName = roundNames?.[key];
      return {
        key,
        label: `${g.name} · ${roundName ?? `Round ${g.round}`} · R${g.round}`,
        color: g.color,
        href: `/series/${g.slug}/weekend/${g.round}`,
        start,
        span: end - start + 1,
      };
    })
    .sort((a, b) => a.start - b.start || b.span - a.span);
}

export function MonthView({
  anchor,
  now,
  buckets,
  roundByKey,
  roundNames,
  onSelectDay,
}: {
  anchor: Date;
  now: Date;
  buckets: Map<string, CalendarEntry[]>;
  roundByKey?: Record<string, number>;
  roundNames?: Record<string, string>;
  onSelectDay: (d: Date) => void;
}) {
  const cells = buildMonthMatrix(anchor, now);
  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-text">
        {WEEKDAYS.map(d => (
          <div key={d} className="px-1.5 pb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => {
        const banners = bannersForWeek(week, buckets, roundByKey, roundNames);
        return (
          <div key={wi}>
            {/* The weekend bars: one object, named once, spanning its days. */}
            {banners.length > 0 && (
              <div className="hidden md:block">
                {banners.map(b => (
                  <div key={b.key} className="grid grid-cols-7">
                    <Link
                      href={b.href}
                      style={{ gridColumn: `${b.start + 1} / span ${b.span}`, backgroundColor: seriesInk(b.color) }}
                      className="mx-[2px] mt-[2px] flex min-h-[22px] items-center truncate px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-bg transition-opacity duration-(--duration-fast) hover:opacity-90"
                    >
                      <span className="truncate">{b.label}</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-7 border-l border-border">
              {week.map(cell => {
                const entries = buckets.get(cell.key) ?? [];
                const lines = summariseDay(entries, roundByKey);
                // Cap the cell at three lines so the whole month fits a screen
                // (round-2 ⑥) — deciders always survive the cap (§4.2 rule),
                // the rest go behind "+N more", which opens the day view.
                const MAX_LINES = 3;
                let visible = lines;
                if (lines.length > MAX_LINES) {
                  const deciders = lines.filter(l => l.decides);
                  if (deciders.length >= MAX_LINES) {
                    visible = deciders;
                  } else {
                    let budget = MAX_LINES - deciders.length;
                    visible = lines.filter(l => l.decides || budget-- > 0);
                  }
                }
                const hiddenCount = lines.length - visible.length;
                return (
                  <div
                    key={cell.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectDay(cell.date)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectDay(cell.date);
                      }
                    }}
                    className={`flex min-h-[72px] cursor-pointer flex-col border-b border-r border-border px-[9px] pt-[6px] pb-[7px] transition-colors duration-(--duration-fast) hover:bg-surface md:min-h-[100px] ${
                      cell.inMonth ? '' : 'opacity-55'
                    } ${cell.isToday ? 'bg-surface-elevated shadow-[inset_0_0_0_2px_var(--brand)]' : ''}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className={`font-mono text-xs tabular-nums ${cell.isToday ? 'font-semibold text-brand' : 'text-text-muted'}`}>
                        {cell.date.getDate()}
                        {cell.isToday && <span className="ml-1.5 text-[9px] uppercase tracking-[0.14em]">Today</span>}
                      </span>
                      {entries.length > 0 && (
                        <span className="font-mono text-[10px] tabular-nums text-text-faint">{entries.length}</span>
                      )}
                    </div>
                    {/* md+: summarising lines, capped — deciders always shown,
                        one line each, the tail behind "+N more". */}
                    <div className="mt-1 hidden min-w-0 flex-col gap-[3px] md:flex">
                      {visible.map(l => (
                        <Link
                          key={l.key}
                          href={l.href}
                          onClick={e => e.stopPropagation()}
                          className="flex min-w-0 items-baseline gap-1.5 hover:underline"
                        >
                          <span aria-hidden="true" className="relative top-[1px] h-3 w-[3px] shrink-0 self-start" style={{ backgroundColor: l.color }} />
                          <span className="shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-text-faint">
                            {code(l.seriesSlug)}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate font-serif text-[12.5px] leading-[1.3] ${
                              l.decides ? 'font-semibold text-text' : 'text-text-muted'
                            }`}
                          >
                            {l.label}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-faint">{l.time}</span>
                        </Link>
                      ))}
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onSelectDay(cell.date);
                          }}
                          className="self-start font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-brand hover:text-text transition-colors duration-(--duration-fast)"
                        >
                          +{hiddenCount} more
                        </button>
                      )}
                    </div>
                    {/* mobile: colour dots (a 7-column grid can't carry text at 390px). */}
                    <div className="mt-1 flex flex-wrap gap-1 md:hidden">
                      {entries.slice(0, 6).map(e => (
                        <span
                          key={`${e.seriesSlug}-${e.session.uid}`}
                          role="img"
                          aria-label={`${e.seriesSlug}: ${e.session.title}`}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: e.color }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {/* Reading-it legend (mock 6a foot). */}
      <div className="mt-2 hidden flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint md:flex">
        <span className="font-semibold text-text-muted">Reading it</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-[9px] w-6" style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 70%, black)' }} />
          race weekend, spanning its days
        </span>
        <span>
          <span className="font-serif text-[11px] font-semibold normal-case tracking-normal text-text">Race</span> bold = a
          session that decides something
        </span>
        <span>the corner count = total sessions that day</span>
      </div>
    </div>
  );
}
