import type { Series } from '@/lib/types';
import { fetchF1SeasonResults, fetchF1SeasonSprints } from '@/lib/results/f1';
import { loadResultsOverrides } from '@/lib/series-content';
import { applyResultsOverrides } from '@/components/tabs/ResultsTab';
import { buildStandingsAtRound } from '@/lib/season-trend';

function officialSiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'official site';
  }
}

// Point-in-time standings (W1b, operator 2026-06-11): the weekend page shows
// the championship AS IT STOOD at this GP — full driver and team tables
// frozen at that round, never refreshing to current. Computable only where
// results carry per-round points; F1 first (race + sprint feeds in hand),
// other per-round-points series follow via the same buildStandingsAtRound.
// Series without points in results keep the live link-out below.
export async function WeekendStandingsSnapshot({
  series,
  round,
  isPast,
}: {
  series: Series;
  round: number;
  isPast: boolean;
}) {
  const label = isPast ? `As of round ${round}` : `Going into round ${round}`;

  if (series.meta.slug === 'f1') {
    const [races, sprints, overrides] = await Promise.all([
      fetchF1SeasonResults(),
      fetchF1SeasonSprints(),
      loadResultsOverrides(series.meta.slug),
    ]);
    // A past weekend counts its own round; an upcoming one shows the table
    // drivers walk in with. Round 1 upcoming → nothing to show yet.
    const throughRound = isPast ? round : round - 1;
    if (throughRound < 1) return null;

    const merged = applyResultsOverrides(races, overrides);
    const snap = buildStandingsAtRound(merged, throughRound, sprints);
    if (snap.drivers.length === 0) return null;

    // The honest label reflects what was actually counted: if this round's
    // results haven't been published yet (or a round was cancelled), the
    // snapshot says so instead of pretending.
    const counted =
      snap.throughRound === throughRound
        ? label
        : `${label} · counted through round ${snap.throughRound}`;

    return (
      <section className="mb-8 border-y border-border py-4">
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
            Standings at this GP
          </h2>
          <span className="text-[10px] uppercase tracking-[0.14em] text-text-faint font-semibold font-mono">
            {counted}
          </span>
        </div>

        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 items-start">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted font-semibold mb-2">
              Drivers
            </div>
            <ul className="divide-y divide-border/60">
              {snap.drivers.map(d => (
                <li key={`${d.position}-${d.driverName}`} className="flex items-baseline gap-3 py-1.5">
                  <span className="w-5 text-text-faint text-xs font-mono tabular-nums text-right">
                    {d.position}
                  </span>
                  <span className="flex-1 min-w-0 text-text text-sm font-medium truncate">
                    {d.driverName}
                  </span>
                  <span className="text-text-muted text-xs truncate max-w-[8rem]">{d.team}</span>
                  <span className="text-text text-sm font-mono tabular-nums text-right w-10">
                    {d.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted font-semibold mb-2">
              Teams
            </div>
            <ul className="divide-y divide-border/60">
              {snap.constructors.map(c => (
                <li key={`${c.position}-${c.name}`} className="flex items-baseline gap-3 py-1.5">
                  <span className="w-5 text-text-faint text-xs font-mono tabular-nums text-right">
                    {c.position}
                  </span>
                  <span className="flex-1 min-w-0 text-text text-sm font-medium truncate">
                    {c.name}
                  </span>
                  <span className="text-text text-sm font-mono tabular-nums text-right w-10">
                    {c.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  if (!series.meta.officialStandingsUrl) return null;
  const host = officialSiteLabel(series.meta.officialStandingsUrl);
  return (
    <section className="mb-8 border-y border-border py-4">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
          Standings
        </h2>
        <span className="text-[10px] uppercase tracking-[0.14em] text-text-faint font-semibold font-mono">{label}</span>
      </div>
      <a
        href={series.meta.officialStandingsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block border border-border bg-surface/40 p-5 text-center text-text-muted text-sm hover:bg-surface hover:border-border-strong transition-colors duration-(--duration-fast)"
      >
        Live standings on {host} <span aria-hidden>→</span>
      </a>
    </section>
  );
}
