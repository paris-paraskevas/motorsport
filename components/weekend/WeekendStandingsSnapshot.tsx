import type { RaceResult, Series } from '@/lib/types';
import { fetchF1SeasonResults, fetchF1SeasonSprints } from '@/lib/results/f1';
import { fetchF2SeasonResults } from '@/lib/results/f2';
import { fetchF3SeasonResults } from '@/lib/results/f3';
import { fetchFormulaESeasonResults } from '@/lib/results/formula-e';
import { fetchIndyCarSeasonResults } from '@/lib/results/indycar';
import { fetchMotoGPSeasonResults } from '@/lib/results/motogp';
import { fetchNascarCupSeasonResults } from '@/lib/results/nascar-cup';
import { fetchWsbkSeasonResults } from '@/lib/results/wsbk';
import { fetchWRCSeasonChartPoints } from '@/lib/results/wrc';
import { fetchDTMSeasonChartData } from '@/lib/results/dtm';
import { loadCuratedDrivers, loadResultsOverrides } from '@/lib/series-content';
import { applyResultsOverrides } from '@/components/tabs/ResultsTab';
import { buildStandingsAtRound } from '@/lib/season-trend';

function officialSiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'official site';
  }
}

// A winners-only race (single entry carrying just the winner) would silently
// undercount everyone else in a cumulative snapshot — same trust rule as the
// trend chart. Any counted race in that shape disqualifies the series from
// the frozen table; the page falls back to the live link-out.
function hasWinnersOnly(races: RaceResult[]): boolean {
  return races.some(
    r => r.results.length === 1 && /^(race\s+)?winner$/i.test(r.results[0].status),
  );
}

export interface SnapshotSource {
  races: RaceResult[];
  extras?: RaceResult[];
  // Whether a per-team sum IS that series' teams' championship. True for
  // F1/F2/F3/FE (constructors = both cars), MotoGP/WSBK (teams' = both
  // riders), DTM (teams' = both drivers). False where the official team /
  // owner / manufacturers' table uses different math (NASCAR owner points,
  // WRC manufacturers' best-two, IndyCar engine manufacturers).
  showTeams: boolean;
}

// One adapter per per-round-points series — the same feeds the results tab
// renders. Series absent here (WEC / IMSA / GTWC / NLS / ADAC) carry no
// points in their results and can never have an honest frozen table; they
// keep the live link-out.
export async function loadSnapshotSource(series: Series): Promise<SnapshotSource | null> {
  const slug = series.meta.slug;
  switch (slug) {
    case 'f1': {
      const [races, sprints, overrides] = await Promise.all([
        fetchF1SeasonResults(),
        fetchF1SeasonSprints(),
        loadResultsOverrides(slug),
      ]);
      return { races: applyResultsOverrides(races, overrides), extras: sprints, showTeams: true };
    }
    case 'f2': {
      const [data, overrides] = await Promise.all([
        fetchF2SeasonResults(series.meta.season),
        loadResultsOverrides(slug),
      ]);
      return {
        races: applyResultsOverrides(data.feature, overrides),
        extras: applyResultsOverrides(data.sprint, overrides),
        showTeams: true,
      };
    }
    case 'f3': {
      const [races, overrides] = await Promise.all([
        fetchF3SeasonResults(series.meta.season),
        loadResultsOverrides(slug),
      ]);
      return { races: applyResultsOverrides(races, overrides), showTeams: true };
    }
    case 'formula-e': {
      const [races, overrides] = await Promise.all([
        fetchFormulaESeasonResults(),
        loadResultsOverrides(slug),
      ]);
      return { races: applyResultsOverrides(races, overrides), showTeams: true };
    }
    case 'indycar': {
      const [drivers, overrides] = await Promise.all([
        loadCuratedDrivers(slug),
        loadResultsOverrides(slug),
      ]);
      const races = await fetchIndyCarSeasonResults({ drivers });
      return { races: applyResultsOverrides(races, overrides), showTeams: false };
    }
    case 'motogp': {
      const [races, overrides] = await Promise.all([
        fetchMotoGPSeasonResults(series.meta.season),
        loadResultsOverrides(slug),
      ]);
      return { races: applyResultsOverrides(races, overrides), showTeams: true };
    }
    case 'wsbk': {
      const [races, overrides] = await Promise.all([
        fetchWsbkSeasonResults(series.meta.season),
        loadResultsOverrides(slug),
      ]);
      return { races: applyResultsOverrides(races, overrides), showTeams: true };
    }
    case 'nascar-cup': {
      const rounds =
        series.rounds?.rounds.map(r => ({
          round: r.round,
          startDate: r.startDate,
          name: r.name,
        })) ?? [];
      if (rounds.length === 0) return null;
      const [races, overrides] = await Promise.all([
        fetchNascarCupSeasonResults({ rounds }),
        loadResultsOverrides(slug),
      ]);
      return { races: applyResultsOverrides(races, overrides), showTeams: false };
    }
    case 'wrc':
      // The chart-points table (per-driver per-round sub-totals) reconciles
      // to the standings tab by construction — the per-rally articles don't.
      return { races: await fetchWRCSeasonChartPoints(series.meta.season), showTeams: false };
    case 'dtm':
      return { races: await fetchDTMSeasonChartData(), showTeams: true };
    default:
      return null;
  }
}

// Point-in-time standings (W1b, operator 2026-06-11): the weekend page shows
// the championship AS IT STOOD at this round — full driver (and where the
// sum model is the real championship, team) tables frozen at that round,
// never refreshing to current. Multi-race rounds (F3/MotoGP/WSBK sprints in
// the main array) inflate the internal wins tie-breaker only — wins aren't
// displayed and points are exact.
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

  const source = await loadSnapshotSource(series);

  if (source && source.races.length > 0) {
    // A past weekend counts its own round; an upcoming one shows the table
    // drivers walk in with. Round 1 upcoming → nothing to show yet.
    const throughRound = isPast ? round : round - 1;
    if (throughRound < 1) return null;

    const counted = source.races.filter(r => r.round <= throughRound);
    if (hasWinnersOnly(counted)) {
      return <LinkOutFallback series={series} label={label} />;
    }

    const snap = buildStandingsAtRound(source.races, throughRound, source.extras);
    if (snap.drivers.length === 0) return null;

    // The honest label reflects what was actually counted: if this round's
    // results haven't been published yet (or a round was cancelled), the
    // snapshot says so instead of pretending.
    const countedLabel =
      snap.throughRound === throughRound
        ? label
        : `${label} · counted through round ${snap.throughRound}`;

    return (
      <section className="mb-8 border-y border-border py-4">
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
            Standings at this round
          </h2>
          <span className="text-[10px] uppercase tracking-[0.14em] text-text-faint font-semibold font-mono">
            {countedLabel}
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

          {source.showTeams && snap.constructors.length > 0 ? (
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
          ) : null}
        </div>
      </section>
    );
  }

  return <LinkOutFallback series={series} label={label} />;
}

function LinkOutFallback({ series, label }: { series: Series; label: string }) {
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
