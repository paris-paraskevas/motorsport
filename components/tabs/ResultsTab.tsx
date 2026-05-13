import type { Series, RaceResult, RaceResultEntry, RaceSummary } from '@/lib/types';
import { fetchF1LastRace, fetchF1SeasonRaces } from '@/lib/results/f1';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

const SOURCE_URL = 'https://github.com/jolpica/jolpica-f1';

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'official site';
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-6 text-center">
      <div className="text-zinc-400 text-sm">{message}</div>
    </div>
  );
}

function LastRacePanel({ race }: { race: RaceResult }) {
  const top10: RaceResultEntry[] = race.results.slice(0, 10);
  return (
    <section className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-4">
      <div className="mb-3">
        <h2 className="text-zinc-200 text-sm uppercase tracking-[0.14em] font-semibold">
          Last race
        </h2>
        <div className="mt-1 flex items-baseline gap-2 flex-wrap">
          <span className="text-zinc-100 text-base font-medium">{race.raceName}</span>
          <span className="text-zinc-500 text-xs">{formatDate(race.date)}</span>
        </div>
        <div className="text-zinc-500 text-xs">{race.circuit}</div>
      </div>
      <ul className="divide-y divide-zinc-800/60">
        {top10.map(r => (
          <li
            key={`${r.position}-${r.driverName}`}
            className="flex items-baseline gap-3 py-2"
          >
            <span className="w-6 text-zinc-500 text-sm font-mono tabular-nums text-right">
              {r.position}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-zinc-100 text-sm font-medium truncate">
                  {r.driverName}
                </span>
                {r.driverCode ? (
                  <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                    {r.driverCode}
                  </span>
                ) : null}
              </div>
              <div className="text-zinc-400 text-xs truncate">{r.team}</div>
            </div>
            <span className="text-zinc-400 text-[11px] font-mono tabular-nums text-right w-20 truncate">
              {r.time ?? r.status}
            </span>
            <span className="text-zinc-100 text-sm font-mono tabular-nums text-right w-10">
              {r.points}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SeasonRacesPanel({ races }: { races: RaceSummary[] }) {
  const recent = [...races].sort((a, b) => b.round - a.round).slice(0, 10);
  return (
    <section className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-4">
      <h2 className="text-zinc-200 text-sm uppercase tracking-[0.14em] font-semibold mb-3">
        Season recent races
      </h2>
      <ul className="divide-y divide-zinc-800/60">
        {recent.map(r => (
          <li key={r.round} className="flex items-baseline gap-3 py-2">
            <span className="w-6 text-zinc-500 text-sm font-mono tabular-nums text-right">
              {r.round}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-zinc-100 text-sm font-medium truncate">
                {r.raceName}
              </div>
              <div className="text-zinc-500 text-xs truncate">
                {formatDate(r.date)}
                {r.winner ? ` · winner: ${r.winner}` : ''}
                {r.winnerTeam ? ` (${r.winnerTeam})` : ''}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinkOutCard({ officialStandingsUrl }: { officialStandingsUrl: string }) {
  const label = hostnameOf(officialStandingsUrl);
  return (
    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-6 text-center">
      <p className="text-zinc-300 text-sm mb-4">
        Race-by-race results are on the official site.
      </p>
      <a
        href={officialStandingsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium transition-colors"
      >
        {label} <span aria-hidden>→</span>
      </a>
    </div>
  );
}

export async function ResultsTab({ series }: { series: Series }) {
  if (series.meta.slug === 'f1') {
    const [lastRace, seasonRaces] = await Promise.all([
      fetchF1LastRace(),
      fetchF1SeasonRaces(),
    ]);
    if (!lastRace && seasonRaces.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    return (
      <div className="space-y-4">
        {lastRace ? <LastRacePanel race={lastRace} /> : null}
        {seasonRaces.length > 0 ? <SeasonRacesPanel races={seasonRaces} /> : null}
        <div className="text-center">
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-zinc-400 text-xs transition-colors"
          >
            Source: jolpi.ca (Ergast mirror) →
          </a>
        </div>
      </div>
    );
  }

  if (!series.meta.officialStandingsUrl) {
    return <PlaceholderTab tabLabel="Results" />;
  }

  return <LinkOutCard officialStandingsUrl={series.meta.officialStandingsUrl} />;
}
