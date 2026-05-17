import { ChevronDown } from 'lucide-react';
import type {
  Series,
  RaceResult,
  RaceResultEntry,
  ResultsOverridesFile,
} from '@/lib/types';
import { fetchF1SeasonResults } from '@/lib/results/f1';
import { loadResultsOverrides } from '@/lib/series-content';
import { buildSeasonTrendData } from '@/lib/season-trend';
import { SeasonTrendChart } from '@/components/SeasonTrendChart';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

const SOURCE_URL = 'https://github.com/jolpica/jolpica-f1';

function applyResultsOverrides(
  races: RaceResult[],
  overrides: ResultsOverridesFile | null,
): RaceResult[] {
  if (!overrides) return races;
  return races.map(race => {
    const patches = overrides[String(race.round)];
    if (!patches || patches.length === 0) return race;
    const patched: RaceResultEntry[] = race.results.map(entry => {
      const o = patches.find(p => p.driverName === entry.driverName);
      if (!o) return entry;
      return {
        ...entry,
        position: o.position ?? entry.position,
        points: o.points ?? entry.points,
        status: o.status ?? entry.status,
        time: o.time ?? entry.time,
      };
    });
    return { ...race, results: patched.sort((a, b) => a.position - b.position) };
  });
}

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
    <div className="rounded-xl bg-surface/40 border border-border/60 p-6 text-center">
      <div className="text-text-muted text-sm">{message}</div>
    </div>
  );
}

function ResultRow({ entry }: { entry: RaceResultEntry }) {
  return (
    <li className="flex items-baseline gap-3 py-2">
      <span className="w-6 text-text-faint text-sm font-mono tabular-nums text-right">
        {entry.position}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-text text-sm font-medium truncate">
            {entry.driverName}
          </span>
          {entry.driverCode ? (
            <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint bg-border/60 px-1.5 py-0.5 rounded font-mono">
              {entry.driverCode}
            </span>
          ) : null}
        </div>
        <div className="text-text-muted text-xs truncate">{entry.team}</div>
      </div>
      <span className="text-text-muted text-[11px] font-mono tabular-nums text-right w-20 truncate">
        {entry.time ?? entry.status}
      </span>
      <span className="text-text text-sm font-mono tabular-nums text-right w-10">
        {entry.points}
      </span>
    </li>
  );
}

function RoundRow({ race, defaultOpen }: { race: RaceResult; defaultOpen: boolean }) {
  const winner = race.results.find(r => r.position === 1) ?? race.results[0];
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex items-baseline gap-3 py-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="w-6 text-text-faint text-sm font-mono tabular-nums text-right">
          {race.round}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-text text-sm font-medium truncate">{race.raceName}</div>
          <div className="text-text-faint text-xs truncate">
            {formatDate(race.date)}
            {winner ? ` · winner: ${winner.driverName}` : ''}
            {winner ? ` (${winner.team})` : ''}
          </div>
        </div>
        <ChevronDown
          size={16}
          className="text-text-faint transition-transform group-open:rotate-180 shrink-0"
        />
      </summary>
      <ul className="ml-9 mt-2 mb-2 divide-y divide-border/60 border-l border-border/60 pl-3">
        {race.results.slice(0, 10).map(entry => (
          <ResultRow key={`${entry.position}-${entry.driverName}`} entry={entry} />
        ))}
      </ul>
    </details>
  );
}

function SeasonResultsPanel({ races }: { races: RaceResult[] }) {
  const sorted = [...races].sort((a, b) => b.round - a.round);
  return (
    <section className="rounded-xl bg-surface/40 border border-border/60 p-4">
      <h2 className="text-text-muted text-sm uppercase tracking-[0.14em] font-semibold mb-3">
        Season results
      </h2>
      <ul className="divide-y divide-border/60">
        {sorted.map((r, idx) => (
          <li key={r.round} className="py-1">
            <RoundRow race={r} defaultOpen={idx === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinkOutCard({ officialStandingsUrl }: { officialStandingsUrl: string }) {
  const label = hostnameOf(officialStandingsUrl);
  return (
    <div className="rounded-xl bg-surface/40 border border-border/60 p-6 text-center">
      <p className="text-text-muted text-sm mb-4">
        Race-by-race results are on the official site.
      </p>
      <a
        href={officialStandingsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-border hover:bg-border-strong text-text text-sm font-medium transition-colors duration-(--duration-fast)"
      >
        {label} <span aria-hidden>→</span>
      </a>
    </div>
  );
}

export async function ResultsTab({ series }: { series: Series }) {
  if (series.meta.slug === 'f1') {
    const [races, overrides] = await Promise.all([
      fetchF1SeasonResults(),
      loadResultsOverrides(series.meta.slug),
    ]);
    if (races.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    const merged = applyResultsOverrides(races, overrides);
    const trend = buildSeasonTrendData(merged);
    return (
      <div className="space-y-4">
        <section className="rounded-xl bg-surface/40 border border-border/60 p-4">
          <h2 className="text-text-muted text-sm uppercase tracking-[0.14em] font-semibold mb-3">
            Drivers&apos; season trend
          </h2>
          <SeasonTrendChart
            data={trend.data}
            drivers={trend.drivers}
            totalsByDriver={trend.totalsByDriver}
          />
        </section>
        <SeasonResultsPanel races={merged} />
        <div className="text-center">
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-faint hover:text-text-muted text-xs transition-colors duration-(--duration-fast)"
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
