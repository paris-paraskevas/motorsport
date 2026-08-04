'use client';

import { useRef } from 'react';
import Link from 'next/link';
import {
  buildMonthMatrix,
  classifySession,
  groupIntoEvents,
  seriesCode,
  sessionTimeLabel,
} from '@/lib/calendar-grid';
import { seriesInk } from '@/lib/site';
import type { CalendarEntry } from './types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Motorsport happens Friday to Sunday. An even 7-column grid therefore spends
// four sevenths of its width — 57% — on columns that are empty most weeks, while
// the three that carry everything are the ones forced to truncate. Weekdays get
// 0.62fr, race days 1fr, so a Sunday cell is ~1.6× a Tuesday's.
const COLUMNS = 'repeat(4, minmax(0, 0.62fr)) repeat(3, minmax(0, 1fr))';

/** One series' presence on one day: `● F1 · Dutch GP · 2 sessions`, or the
 *  session itself when there's only one. This is what removes the "+N more"
 *  cliff — a 15-session Saturday across six series is six rows, not fifteen. */
function EventChip({
  event,
  utc,
  compact,
}: {
  event: ReturnType<typeof groupIntoEvents<CalendarEntry>>[number];
  utc: boolean;
  compact?: boolean;
}) {
  const href = event.round
    ? `/series/${event.seriesSlug}/weekend/${event.round}`
    : `/series/${event.seriesSlug}`;
  // A day with one session names it; a day with several says how many and lets
  // the weekend/day view carry the timetable. The race is always named, because
  // "RACE 16:00" is the reason anyone opened the month.
  const race = event.entries.find(e => classifySession(e.session.title) === 'race');
  const lead = event.entries.length === 1 ? event.entries[0] : race;
  const label = lead
    ? lead.session.title
    : `${event.entries.length} sessions`;
  const time = lead ? sessionTimeLabel(lead.session, utc) : '';
  const isRace = Boolean(race) && lead === race;

  return (
    <Link
      href={href}
      // A weekday column is ~134px on a laptop, so a long session name clips to a
      // stub ("WRC WR…"). The full text stays reachable on hover, and the cell
      // itself opens the day view where nothing is abbreviated.
      title={`${event.seriesName} — ${label}${time ? ` · ${time}` : ''}`}
      className="group/chip flex min-w-0 items-center gap-1.5 rounded-sm px-1 py-1 transition-colors duration-(--duration-fast) hover:bg-surface-elevated"
    >
      <span
        aria-hidden="true"
        className="h-3 w-[3px] shrink-0"
        style={{ backgroundColor: event.color }}
      />
      <span className="min-w-0 flex-1 truncate">
        {/* Codes, not full names. A phone's weekday column is ~38px, which clips
            "GT World Challenge" to nonsense, and even on a laptop the full name
            would eat the width the session name needs. The full name stays in the
            cell's aria-label, so nothing is lost to assistive tech; the agenda
            and the legend spell it out. */}
        <span
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: seriesInk(event.color) }}
        >
          {seriesCode(event.seriesSlug)}
        </span>
        {!compact && (
          <span
            className={`ml-1.5 ${
              isRace ? 'font-semibold text-text' : 'text-text-muted'
            } text-[13px]`}
          >
            {label}
          </span>
        )}
      </span>
      {/* No clock on a phone. A 390px viewport gives a weekend column ~51px, and
          with the time claiming its 38px the series code was squeezed to nothing —
          so a cell showed EITHER a code or a time, never both. The code always
          wins: "which series is on today" is the question a month grid answers,
          and the agenda (the default view) carries the timetable. */}
      {!compact && time && (
        <span
          className={`shrink-0 font-mono text-[11px] tnum ${
            isRace ? 'font-bold text-text' : 'text-text-muted'
          }`}
        >
          {time}
        </span>
      )}
      {!compact && !time && (
        <span className="shrink-0 font-mono text-[11px] text-text-faint tnum">
          {event.entries.length}
        </span>
      )}
    </Link>
  );
}

export function MonthView({
  anchor,
  now,
  buckets,
  roundByKey,
  utc,
  onSelectDay,
}: {
  anchor: Date;
  now: Date;
  buckets: Map<string, CalendarEntry[]>;
  roundByKey?: Record<string, number>;
  utc: boolean;
  onSelectDay: (d: Date) => void;
}) {
  const cells = buildMonthMatrix(anchor, now);
  const gridRef = useRef<HTMLDivElement>(null);
  const roundOf = (e: CalendarEntry) => roundByKey?.[`${e.seriesSlug}:${e.session.uid}`];

  // Roving-tabindex grid. The old markup made all 42 cells role="button" with
  // tabIndex=0 AND nested <Link> pills inside them — nested interactive content,
  // and 42 tab stops before the keyboard reached the page's content. Now the grid
  // is one tab stop and arrows move the focus, per the ARIA grid pattern.
  const focusCell = (index: number) => {
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${index}"]`);
    if (el) {
      el.tabIndex = 0;
      el.focus();
      for (const other of gridRef.current?.querySelectorAll<HTMLElement>('[data-cell]') ?? []) {
        if (other !== el) other.tabIndex = -1;
      }
    }
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number, date: Date) => {
    const move: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 7,
      ArrowUp: -7,
    };
    if (e.key in move) {
      const next = index + move[e.key];
      if (next >= 0 && next < cells.length) {
        e.preventDefault();
        focusCell(next);
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectDay(date);
    }
  };

  // The first in-month cell holds the tab stop, so Tab lands on the 1st rather
  // than on a greyed-out day from the previous month.
  const firstInMonth = cells.findIndex(c => c.inMonth);
  const todayIndex = cells.findIndex(c => c.isToday);
  const tabStop = todayIndex >= 0 ? todayIndex : Math.max(0, firstInMonth);

  return (
    <div className="border border-border bg-surface p-2 md:p-3">
      {/* Weekday header — race days are called out, since the columns beneath
          them are the ones that carry the sport. The Friday cell also opens the
          weekend boundary rule that runs down the grid. */}
      <div className="grid" style={{ gridTemplateColumns: COLUMNS }}>
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={`px-1.5 pb-1.5 font-mono text-xs uppercase tracking-[0.14em] ${
              i >= 4 ? 'font-bold text-text' : 'text-text-faint'
            } ${i === 4 ? 'border-l border-text-faint/60' : ''}`}
          >
            {d}
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label="Month grid"
        // Gap lines show the container through, so this IS the cell divider.
        // border-strong at full strength rather than 40% — 1.64:1 against the
        // panel instead of 1.42:1. Still short of the 3:1 WCAG wants of a
        // meaningful boundary, which is exactly why the weekend edge above gets a
        // real rule and the cells carry their own date numbers: the hairlines are
        // grouping, not the thing that identifies a day.
        className="grid gap-px bg-border-strong"
        style={{ gridTemplateColumns: COLUMNS }}
      >
        {cells.map((cell, index) => {
          const entries = buckets.get(cell.key) ?? [];
          const events = groupIntoEvents(entries, roundOf);
          // TWO fills, not four. The first cut tinted weekend columns, today and
          // adjacent months separately, and measuring the composited pixels showed
          // every step was below what an eye resolves — weekend vs weekday 1.107:1,
          // today 1.061:1, out-of-month 1.039:1 — while out-of-month came out
          // LIGHTER than in-month, so July and September read as lifted rather than
          // receded. --bg to --surface-elevated spans just 1.164:1 in total, so no
          // arrangement of these tokens can carry meaning; they exist to separate a
          // panel from a page, not 42 cells from each other.
          //
          // So the weekend is signalled by things that actually register: the column
          // width (0.62fr against 1fr), a boundary rule at the Thursday/Friday edge
          // in --text-faint (4.96:1 on the panel), and a full-strength header. Today
          // rides on its brand date badge (10.29:1). Adjacent months recede by
          // dimming their CONTENT while the cell keeps the darkest fill available —
          // opacity on the cell itself was what inverted them.
          const fill = cell.inMonth ? (cell.isToday ? 'bg-surface-elevated' : 'bg-surface') : 'bg-bg';
          const weekendEdge = index % 7 === 4 ? 'border-l border-text-faint/60' : '';
          return (
            <div
              key={cell.key}
              role="gridcell"
              data-cell={index}
              tabIndex={index === tabStop ? 0 : -1}
              aria-selected={cell.isToday}
              aria-label={`${cell.date.toDateString()}${
                entries.length ? `, ${entries.length} sessions` : ', nothing scheduled'
              }`}
              onKeyDown={e => onKeyDown(e, index, cell.date)}
              className={`flex min-h-[92px] flex-col p-1.5 align-top transition-colors duration-(--duration-fast) focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand md:min-h-[118px] ${fill} ${weekendEdge}`}
            >
              {/* Content wrapper carries the adjacent-month dimming. Putting the
                  opacity on the CELL faded its background toward the lighter
                  backdrop, which is how out-of-month ended up brighter than
                  in-month; dimming only what's inside keeps the fill honest. */}
              <div
                className={`flex flex-1 flex-col gap-1 ${cell.inMonth ? '' : 'opacity-45'}`}
              >
              <div className="flex items-baseline justify-between gap-1">
                {/* Day numbers were 12px --text-muted tucked in a corner. Today
                    was a 1px ring. Both now read at a glance. */}
                <button
                  type="button"
                  onClick={() => onSelectDay(cell.date)}
                  aria-label={`Open ${cell.date.toDateString()}`}
                  className={`-m-0.5 inline-flex min-w-[1.75rem] items-center justify-center p-0.5 font-mono text-base font-bold tnum transition-colors duration-(--duration-fast) ${
                    cell.isToday
                      ? 'bg-brand-fill text-tint-contrast'
                      : 'text-text hover:text-brand'
                  }`}
                >
                  {cell.date.getDate()}
                </button>
                {entries.length > 0 && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint tnum">
                    {entries.length}
                  </span>
                )}
              </div>

              {/* md+: named events. Six or more series on one day is rare enough
                  that a cap at 4 almost never bites, and when it does the
                  overflow is series-level, not 12 hidden sessions. */}
              <div className="hidden min-w-0 flex-col gap-0.5 md:flex">
                {events.slice(0, 4).map(ev => (
                  <EventChip key={ev.key} event={ev} utc={utc} />
                ))}
                {events.length > 4 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(cell.date)}
                    className="px-1 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted hover:text-text"
                  >
                    +{events.length - 4} series
                  </button>
                )}
              </div>

              {/* Mobile: text, not dots. The old phone layout rendered up to six
                  coloured circles and nothing else — a reader learned that
                  something was happening, in six colours, and had to tap to find
                  out what. Series code + count is compact AND says something. */}
              <div className="flex min-w-0 flex-col gap-0.5 md:hidden">
                {events.slice(0, 3).map(ev => (
                  <EventChip key={ev.key} event={ev} utc={utc} compact />
                ))}
                {events.length > 3 && (
                  <span className="px-1 font-mono text-[10px] text-text-faint tnum">
                    +{events.length - 3}
                  </span>
                )}
              </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
