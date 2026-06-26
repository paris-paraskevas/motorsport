'use client';

import { useState } from 'react';
import { dayKeyOf } from '@/lib/calendar-grid';
import type { CalendarEntry } from './types';
import { SessionCard } from '@/components/SessionCard';

type OrderBy = 'time' | 'series';

export function DayView({
  anchor,
  now,
  buckets,
  roundByKey,
}: {
  anchor: Date;
  now: Date;
  buckets: Map<string, CalendarEntry[]>;
  roundByKey?: Record<string, number>;
}) {
  const [orderBy, setOrderBy] = useState<OrderBy>('time');

  // Chronological is the base order (and the default); the series grouping below
  // reuses it, so each series' sessions stay time-sorted within their group.
  const entries = (buckets.get(dayKeyOf(anchor)) ?? [])
    .slice()
    .sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  if (entries.length === 0) {
    return (
      <div className="border border-border bg-surface/40 p-8 text-center">
        <div className="text-sm text-text-faint">Nothing scheduled this day.</div>
      </div>
    );
  }

  // Group the time-sorted entries by series, then order the groups by series
  // name so "by series" is predictable (same series order every day). On a
  // single-series day this is one group — "by series" then just adds its header,
  // still a visible change from the flat time list.
  const groups: { slug: string; name: string; color: string; entries: CalendarEntry[] }[] = [];
  const bySlug = new Map<string, (typeof groups)[number]>();
  for (const e of entries) {
    let g = bySlug.get(e.seriesSlug);
    if (!g) {
      g = { slug: e.seriesSlug, name: e.seriesName, color: e.color, entries: [] };
      bySlug.set(e.seriesSlug, g);
      groups.push(g);
    }
    g.entries.push(e);
  }
  groups.sort((a, b) => a.name.localeCompare(b.name));

  const card = (e: CalendarEntry) => (
    <SessionCard
      key={`${e.seriesSlug}-${e.session.uid}`}
      session={e.session}
      color={e.color}
      round={roundByKey?.[`${e.seriesSlug}:${e.session.uid}`]}
      now={now}
    />
  );

  const grouped = orderBy === 'series';

  return (
    <div>
      {/* Always present when the day has sessions (we returned early on empty) —
          the control belongs on the day screen regardless of how many series run. */}
      <div className="mb-3 flex items-center justify-end gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">Order by</span>
        <div className="flex">
          {(['time', 'series'] as OrderBy[]).map(o => (
            <button
              key={o}
              type="button"
              onClick={() => setOrderBy(o)}
              aria-pressed={orderBy === o}
              className={`-ml-px border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                orderBy === o ? 'border-text bg-text text-bg' : 'border-border text-text-muted hover:text-text'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {grouped ? (
        <div className="flex flex-col gap-5">
          {groups.map(g => (
            <section key={g.slug}>
              <div className="mb-1 flex items-center gap-2 border-b border-border pb-1">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">{g.name}</h3>
              </div>
              <div className="border-t border-border">{g.entries.map(card)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="border-t border-border">{entries.map(card)}</div>
      )}
    </div>
  );
}
