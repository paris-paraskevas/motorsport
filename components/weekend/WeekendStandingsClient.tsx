'use client';

import { useEffect, useState } from 'react';

// Client renderer for the Sessions tab's "Standings at this round" — fetches the
// cached /api/weekend/standings only when mounted (tab opened), so the weekend
// page render no longer fans out the season-results fetchers. Mirrors the markup
// of the old WeekendStandingsSnapshot server component.
interface DriverRow {
  position: number;
  driverName: string;
  team: string;
  points: number;
}
interface TeamRow {
  position: number;
  name: string;
  points: number;
}
type Snap =
  | { mode: 'table'; label: string; showTeams: boolean; drivers: DriverRow[]; constructors: TeamRow[] }
  | { mode: 'linkout'; label: string; url: string; host: string }
  | { mode: 'none' };

export function WeekendStandingsClient({ slug, round, isPast }: { slug: string; round: number; isPast: boolean }) {
  const [snap, setSnap] = useState<Snap | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/weekend/standings?series=${encodeURIComponent(slug)}&round=${round}&isPast=${isPast ? '1' : '0'}`)
      .then(r => r.json())
      .then((d: Snap) => {
        if (active) setSnap(d);
      })
      .catch(() => {
        if (active) setSnap({ mode: 'none' });
      });
    return () => {
      active = false;
    };
  }, [slug, round, isPast]);

  if (snap === null) return <div className="h-40 animate-pulse rounded-lg border border-white/10 bg-white/5" aria-hidden="true" />;
  if (snap.mode === 'none') return null;

  if (snap.mode === 'linkout') {
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">Standings</h3>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">{snap.label}</span>
        </div>
        <a
          href={snap.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block border border-border bg-surface/40 p-5 text-center text-sm text-text-muted transition-colors duration-(--duration-fast) hover:border-border-strong hover:bg-surface"
        >
          Live standings on {snap.host} <span aria-hidden>→</span>
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">Standings at this round</h3>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">{snap.label}</span>
      </div>
      <div className="grid items-start gap-x-8 gap-y-4 md:grid-cols-2">
        <div>
          <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Drivers</div>
          <ul className="divide-y divide-border/60">
            {snap.drivers.map(d => (
              <li key={`${d.position}-${d.driverName}`} className="flex items-baseline gap-3 py-1.5">
                <span className="w-5 text-right font-mono text-xs tabular-nums text-text-faint">{d.position}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{d.driverName}</span>
                <span className="max-w-[8rem] truncate text-xs text-text-muted">{d.team}</span>
                <span className="w-10 text-right font-mono text-sm tabular-nums text-text">{d.points}</span>
              </li>
            ))}
          </ul>
        </div>
        {snap.showTeams && snap.constructors.length > 0 ? (
          <div>
            <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">Teams</div>
            <ul className="divide-y divide-border/60">
              {snap.constructors.map(c => (
                <li key={`${c.position}-${c.name}`} className="flex items-baseline gap-3 py-1.5">
                  <span className="w-5 text-right font-mono text-xs tabular-nums text-text-faint">{c.position}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{c.name}</span>
                  <span className="w-10 text-right font-mono text-sm tabular-nums text-text">{c.points}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
