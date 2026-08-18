'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useFollowedSeries } from '@/lib/useFollowedSeries';

// "You follow" leads the Account page (design handoff §4.11c): the followed
// series as chips with tint bars, a dashed "+ Add" chip into the editor, and
// the consequence stated plainly. Device-local follows via useFollowedSeries;
// null = following everything.
export function FollowedChips({
  series,
}: {
  series: Array<{ slug: string; name: string; color: string }>;
}) {
  const { followed, hydrated } = useFollowedSeries();
  if (!hydrated) return <div aria-hidden="true" className="h-24 animate-pulse border-y border-border bg-surface/40" />;

  const bySlug = new Map(series.map(s => [s.slug, s]));
  const picked = followed === null ? [] : followed.map(s => bySlug.get(s)).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <section aria-label="You follow" className="border-t border-border py-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">You follow</h2>
        <span className="font-mono text-[10px] tabular-nums text-text-faint">
          {followed === null ? 'everything' : picked.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {followed === null ? (
          <p className="text-sm text-text-muted">
            Everything — all {series.length} championships. Pick favourites to focus the site.
          </p>
        ) : (
          picked.map(s => (
            <Link
              key={s.slug}
              href="/settings/series"
              className="inline-flex min-h-11 items-center gap-2 border border-border-strong px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text transition-colors duration-(--duration-fast) hover:border-text"
            >
              <span aria-hidden="true" className="h-[13px] w-[3px] shrink-0" style={{ backgroundColor: s.color }} />
              {s.name}
            </Link>
          ))
        )}
        <Link
          href="/settings/series"
          className="inline-flex min-h-11 items-center border border-dashed border-border-strong px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text hover:text-text"
        >
          {followed === null ? 'Choose series' : '+ Add'}
        </Link>
      </div>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-text-faint">
        The calendar and the wire narrow to these · stored on this device
      </p>
    </section>
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
