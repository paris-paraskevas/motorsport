'use client';

import Link from 'next/link';
import type { CalendarEntry } from './types';

// The season timeline (design handoff §4.2 / panel 5a, operator images #24-25):
// one weekend per block so a Fri–Sun stays whole and the series racing
// alongside each other sit together — the whole season scrolls as one surface,
// month headers marking the way. Badges are derived, never asserted: DOUBLE
// when one series runs two rounds in the same window, FINALE on a series' last
// known round, per-row date chips when rows inside a window don't share its
// exact dates.

interface WeekendRow {
  slug: string;
  name: string;
  color: string;
  rounds: number[]; // 1 entry normally; 2 for a double-header
  first: Date;
  last: Date;
  roundName: string | null;
  finale: boolean;
}

interface WeekendWindow {
  start: Date;
  end: Date;
  rows: WeekendRow[];
}

const DAY_MS = 24 * 3600 * 1000;
const FMT_RANGE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const FMT_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long' });

function rangeLabel(a: Date, b: Date): string {
  const sameDay = a.toDateString() === b.toDateString();
  if (sameDay) return FMT_RANGE.format(a);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${FMT_RANGE.format(b)}`;
  return `${FMT_RANGE.format(a)} – ${FMT_RANGE.format(b)}`;
}

export function SeasonView({
  entries,
  now,
  roundByKey,
  roundNames,
  maxRoundBySlug,
}: {
  entries: CalendarEntry[];
  now: Date;
  roundByKey?: Record<string, number>;
  roundNames?: Record<string, string>;
  maxRoundBySlug: Record<string, number>;
}) {
  // 1 — weekend groups per slug:round.
  const groups = new Map<string, WeekendRow>();
  for (const e of entries) {
    const round = roundByKey?.[`${e.seriesSlug}:${e.session.uid}`];
    if (round == null || round < 1) continue;
    const key = `${e.seriesSlug}:${round}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        slug: e.seriesSlug,
        name: e.seriesName,
        color: e.color,
        rounds: [round],
        first: e.session.start,
        last: e.session.end,
        roundName: roundNames?.[key] ?? null,
        finale: maxRoundBySlug[e.seriesSlug] === round,
      });
    } else {
      if (e.session.start < g.first) g.first = e.session.start;
      if (e.session.end > g.last) g.last = e.session.end;
    }
  }

  // 2 — merge a series' rounds that share a window into one row (double-headers),
  //     then bucket rows into overlapping weekend windows.
  const sorted = [...groups.values()].sort((a, b) => a.first.getTime() - b.first.getTime());
  const windows: WeekendWindow[] = [];
  for (const row of sorted) {
    const w = windows.find(
      x => row.first.getTime() <= x.end.getTime() + DAY_MS && row.last.getTime() >= x.start.getTime() - DAY_MS,
    );
    if (!w) {
      windows.push({ start: row.first, end: row.last, rows: [row] });
      continue;
    }
    const twin = w.rows.find(r => r.slug === row.slug);
    if (twin) {
      twin.rounds = [...twin.rounds, ...row.rounds].sort((a, b) => a - b);
      if (row.first < twin.first) twin.first = row.first;
      if (row.last > twin.last) twin.last = row.last;
      twin.finale = twin.finale || row.finale;
      if (!twin.roundName && row.roundName) twin.roundName = row.roundName;
    } else {
      w.rows.push(row);
    }
    if (row.first < w.start) w.start = row.first;
    if (row.last > w.end) w.end = row.last;
  }

  const past = windows.filter(w => w.end.getTime() < now.getTime());
  const upcoming = windows.filter(w => w.end.getTime() >= now.getTime());

  // 3 — month sections over the upcoming timeline.
  const sections = new Map<string, { label: string; windows: WeekendWindow[] }>();
  for (const w of upcoming) {
    const key = `${w.start.getFullYear()}-${String(w.start.getMonth() + 1).padStart(2, '0')}`;
    const s = sections.get(key);
    if (s) s.windows.push(w);
    else sections.set(key, { label: FMT_MONTH.format(w.start), windows: [w] });
  }

  const jump = (key: string) => {
    document.getElementById(`season-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const subLabel = (w: WeekendWindow) => {
    if (w.rows.length >= 3) return `${['', '', '', 'three', 'four', 'five', 'six'][w.rows.length] ?? w.rows.length} series`;
    const exact = w.rows.every(
      r => r.first.toDateString() === w.start.toDateString() && r.last.toDateString() === w.end.toDateString(),
    );
    return exact ? 'weekend' : 'overlapping';
  };

  return (
    <section aria-label="The season as one timeline">
      {/* Jump-to chips scroll the one surface — month buttons never page it,
          so "behind you" stays reachable at the foot (§4.2/5a). */}
      <div className="mb-4 flex flex-wrap items-baseline gap-1.5">
        <span className="mr-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-faint">
          Jump to
        </span>
        {[...sections.keys()].map(key => (
          <button
            key={key}
            type="button"
            onClick={() => jump(key)}
            className="border border-border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text hover:text-text"
          >
            {sections.get(key)!.label.slice(0, 3)}
          </button>
        ))}
      </div>

      {[...sections.entries()].map(([key, s]) => (
        <div key={key} id={`season-${key}`} className="mb-8 scroll-mt-20">
          <div className="mb-1 flex items-baseline gap-3 border-b border-text pb-1">
            <h2 className="font-serif text-[24px] font-semibold leading-none text-text">{s.label}</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
              {s.windows.length} weekend{s.windows.length === 1 ? '' : 's'}
            </span>
          </div>
          {s.windows.map((w, wi) => (
            <div key={wi} className="flex gap-4 border-b border-border py-3">
              <div className="w-24 shrink-0 pt-0.5 sm:w-28">
                <div className="font-mono text-[12px] font-semibold tabular-nums text-text">
                  {rangeLabel(w.start, w.end)}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">{subLabel(w)}</div>
              </div>
              <div className="min-w-0 flex-1">
                {w.rows.map(r => {
                  const rowRange = rangeLabel(r.first, r.last);
                  const windowRange = rangeLabel(w.start, w.end);
                  return (
                    <Link
                      key={`${r.slug}:${r.rounds[0]}`}
                      href={`/series/${r.slug}/weekend/${r.rounds[0]}`}
                      className="group flex min-h-10 items-baseline gap-3 py-1 transition-colors duration-(--duration-fast) hover:bg-surface"
                    >
                      <span aria-hidden="true" className="relative top-[2px] h-3.5 w-[3px] shrink-0 self-start" style={{ backgroundColor: r.color }} />
                      <span className="w-24 shrink-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted sm:w-28">
                        {r.name}
                      </span>
                      <span className="w-12 shrink-0 font-mono text-[10px] tabular-nums text-text-faint">
                        R{r.rounds.join('·')}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-serif text-[16px] font-semibold text-text group-hover:underline">
                        {r.roundName ?? `Round ${r.rounds[0]}`}
                      </span>
                      {r.rounds.length > 1 && (
                        <span className="shrink-0 border border-brand px-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-brand">
                          Double
                        </span>
                      )}
                      {r.finale && (
                        <span className="shrink-0 border border-brand px-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-brand">
                          Finale
                        </span>
                      )}
                      {rowRange !== windowRange && (
                        <span className="hidden shrink-0 border border-border px-1.5 font-mono text-[9px] tabular-nums text-text-muted sm:inline">
                          {rowRange}
                        </span>
                      )}
                      <span aria-hidden="true" className="shrink-0 font-mono text-[10px] text-text-faint">→</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      {past.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          <span className="font-semibold">Behind you</span>
          {past.slice(-2).reverse().flatMap(w =>
            w.rows.slice(0, 1).map(r => (
              <Link
                key={`${r.slug}:${r.rounds[0]}`}
                href={`/series/${r.slug}/weekend/${r.rounds[0]}`}
                className="text-text-muted hover:text-text"
              >
                {rangeLabel(w.start, w.end)} · {r.roundName ?? `${r.name} R${r.rounds[0]}`} →
              </Link>
            )),
          )}
        </div>
      )}
    </section>
  );
}
