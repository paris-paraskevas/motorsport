'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Trophy } from 'lucide-react';
import { useFollowedSeries } from '@/lib/useFollowedSeries';

// The Championships row with the live follow state as its sub-line — the
// standalone "You follow" block above the row list duplicated this row and
// read as three misaligned registers (operator, 2026-08-20: "dreadful.
// re organise"). One row now states what you follow AND is the way to change
// it. Device-local follows via useFollowedSeries; null = following everything.
export function ChampionshipsRow({
  series,
}: {
  series: Array<{ slug: string; name: string; color: string }>;
}) {
  const { followed, hydrated } = useFollowedSeries();
  const bySlug = new Map(series.map(s => [s.slug, s]));
  const picked =
    followed === null ? [] : followed.map(s => bySlug.get(s)).filter((x): x is NonNullable<typeof x> => !!x);

  const sub = !hydrated
    ? 'Choose the series you follow'
    : followed === null
      ? `Following everything — all ${series.length} championships. The calendar and the wire show them all.`
      : `Following ${picked.map(s => s.name).join(', ')} — the calendar and the wire narrow to these.`;
  const meta = !hydrated ? '' : followed === null ? 'everything' : `${picked.length} of ${series.length}`;

  return (
    <Link
      href="/settings/series"
      className="group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface"
    >
      <Trophy size={18} className="shrink-0 text-text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-text">Championships</span>
        <span className="block truncate text-xs text-text-faint">{sub}</span>
      </span>
      {meta && <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">{meta}</span>}
      <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
    </Link>
  );
}

// The time-zone row (§4.11c): every time in the app depends on it, and a wrong
// one silently breaks the product — so the Account page SHOWS the value the
// device is giving us. Client-only (the server has no device zone).
export function TimezoneRow() {
  const [tz, setTz] = useState<string | null>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- device-only value adopted once after mount (SSR has no zone)
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
    } catch {
      /* leave null */
    }
  }, []);
  return (
    <div className="flex items-center gap-3 border-b border-border py-4">
      <span aria-hidden="true" className="w-[18px] shrink-0 text-center font-mono text-[13px] text-text-muted">⌖</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-text">Time zone</span>
        <span className="block text-xs text-text-faint">Every time on the site is shown in it</span>
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">{tz ?? '—'}</span>
    </div>
  );
}
