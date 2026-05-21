import { ChevronDown } from 'lucide-react';
import type {
  Series,
  RaceResult,
  RaceResultEntry,
  ResultsOverridesFile,
} from '@/lib/types';
import { fetchF1SeasonResults, fetchF1SeasonSprints } from '@/lib/results/f1';
import { fetchF2SeasonResults } from '@/lib/results/f2';
import { fetchF3SeasonResults } from '@/lib/results/f3';
import { fetchFormulaESeasonResults } from '@/lib/results/formula-e';
import { fetchIndyCarSeasonResults } from '@/lib/results/indycar';
import { fetchMotoGPSeasonResults } from '@/lib/results/motogp';
import { fetchNascarCupSeasonResults } from '@/lib/results/nascar-cup';
import { fetchWsbkSeasonResults } from '@/lib/results/wsbk';
import { fetchWRCSeasonResults } from '@/lib/results/wrc';
import { loadCuratedDrivers, loadResultsOverrides } from '@/lib/series-content';
import { buildSeasonTrendData } from '@/lib/season-trend';
import { SeasonTrendChart } from '@/components/SeasonTrendChart';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

const SOURCE_URL = 'https://github.com/jolpica/jolpica-f1';
const FORMULA_E_SOURCE_URL =
  'https://en.wikipedia.org/wiki/2025%E2%80%9326_Formula_E_World_Championship';
const NASCAR_SOURCE_URL = 'https://en.wikipedia.org/wiki/2026_NASCAR_Cup_Series';

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
  // Winners-only mode: some parsers (FE pre-classification-scrape, WRC's
  // calendar-row parse) emit a single RaceResultEntry per race carrying just
  // the winner. Expanding into the per-entry accordion then shows a misleading
  // "1 Winner 25" 1-row classification. Detect that shape and render a flat
  // row instead of an expandable <details>. Status discriminator is permissive
  // — FE uses 'Race winner', WRC uses 'Winner'; both signal incomplete data.
  const isWinnersOnly =
    race.results.length === 1 && /^(race\s+)?winner$/i.test(race.results[0].status);

  if (isWinnersOnly) {
    return (
      <div className="flex items-baseline gap-3 py-2">
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
      </div>
    );
  }

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

function SeasonResultsPanel({
  races,
  heading = 'Season results',
  preserveOrder = false,
}: {
  races: RaceResult[];
  heading?: string;
  // When true, caller has already ordered the array — don't resort (WSBK
  // emits R1 / SP / R2 per round and wants R2 last per weekend).
  preserveOrder?: boolean;
}) {
  // Most recent round first. Within a round (F2/F3 ship Feature + Sprint
  // sharing one round number) the Feature race surfaces first because it
  // pays more points and is the headline weekend winner most readers expect.
  const sorted = preserveOrder
    ? races
    : [...races].sort((a, b) => {
        if (b.round !== a.round) return b.round - a.round;
        const aFeature = /feature/i.test(a.raceName);
        const bFeature = /feature/i.test(b.raceName);
        if (aFeature && !bFeature) return -1;
        if (!aFeature && bFeature) return 1;
        return 0;
      });
  return (
    <section className="rounded-xl bg-surface/40 border border-border/60 p-4">
      <h2 className="text-text-muted text-sm uppercase tracking-[0.14em] font-semibold mb-3">
        {heading}
      </h2>
      <ul className="divide-y divide-border/60">
        {sorted.map((r, idx) => (
          // raceName participates in the key because some series (WSBK, F2,
          // F3) emit multiple RaceResults per round (Race 1 / Superpole / Race
          // 2 — or Feature / Sprint) sharing the same round number.
          <li key={`${r.round}-${r.raceName}`} className="py-1">
            <RoundRow race={r} defaultOpen={idx === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="text-center">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-faint hover:text-text-muted text-xs transition-colors duration-(--duration-fast)"
      >
        Source: {label} →
      </a>
    </div>
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
    const [races, sprints, overrides] = await Promise.all([
      fetchF1SeasonResults(),
      fetchF1SeasonSprints(),
      loadResultsOverrides(series.meta.slug),
    ]);
    if (races.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    const merged = applyResultsOverrides(races, overrides);
    // Sprint points fold into the same x-axis round as the parent race.
    // SeasonResultsPanel below keeps showing GPs only — adding sprint cards
    // would clutter the panel; the chart math is what users need fixed.
    const trend = buildSeasonTrendData(merged, sprints);
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
        <SourceLink href={SOURCE_URL} label="jolpi.ca (Ergast mirror)" />
      </div>
    );
  }

  if (series.meta.slug === 'f2') {
    const [data, overrides] = await Promise.all([
      fetchF2SeasonResults(series.meta.season),
      loadResultsOverrides(series.meta.slug),
    ]);
    if (data.feature.length === 0 && data.sprint.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    const feature = applyResultsOverrides(data.feature, overrides);
    const sprint = applyResultsOverrides(data.sprint, overrides);
    return (
      <div className="space-y-4">
        {feature.length > 0 ? (
          <SeasonResultsPanel races={feature} heading="Feature races" />
        ) : null}
        {sprint.length > 0 ? (
          <SeasonResultsPanel races={sprint} heading="Sprint races" />
        ) : null}
        <SourceLink
          href="https://www.fiaformula2.com/Results"
          label="fiaformula2.com"
        />
      </div>
    );
  }

  if (series.meta.slug === 'f3') {
    const [races, overrides] = await Promise.all([
      fetchF3SeasonResults(series.meta.season),
      loadResultsOverrides(series.meta.slug),
    ]);
    if (races.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    const merged = applyResultsOverrides(races, overrides);
    return (
      <div className="space-y-4">
        <SeasonResultsPanel races={merged} />
        <SourceLink
          href="https://www.fiaformula3.com/Results"
          label="fiaformula3.com"
        />
      </div>
    );
  }

  if (series.meta.slug === 'indycar') {
    const [drivers, overrides] = await Promise.all([
      loadCuratedDrivers(series.meta.slug),
      loadResultsOverrides(series.meta.slug),
    ]);
    const races = await fetchIndyCarSeasonResults({ drivers });
    if (races.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    const merged = applyResultsOverrides(races, overrides);
    return (
      <div className="space-y-4">
        <SeasonResultsPanel races={merged} />
        <SourceLink
          href="https://en.wikipedia.org/wiki/2026_IndyCar_Series"
          label="en.wikipedia.org (2026 IndyCar Series)"
        />
      </div>
    );
  }

  if (series.meta.slug === 'formula-e') {
    const [races, overrides] = await Promise.all([
      fetchFormulaESeasonResults(),
      loadResultsOverrides(series.meta.slug),
    ]);
    if (races.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    const merged = applyResultsOverrides(races, overrides);
    // Trend chart removed in 0.11.11 (was restored in 0.11.6/0.11.8). The
    // per-event Wikipedia article scrape only succeeds for rounds whose
    // articles include full classification tables — at session checkpoint
    // that meant Berlin R7/R8 and Monaco R9/R10 fell back to winners-only,
    // so the chart underreported each driver's points by ~30-40pts vs the
    // standings tab (e.g. Evans 89/128). Per the cross-cutting invariant
    // in CHANGELOG.md, a chart whose totals disagree with the standings
    // tab erodes trust; better to drop it until either Wikipedia editors
    // catch up on the missing per-event articles OR
    // `content/series/formula-e/results-overrides.json` curates the
    // affected rounds manually (5-source rule). The flat-row accordion
    // continues to render whatever per-round data we have.
    const heading =
      merged.some(r => r.results.length > 1) &&
      merged.every(r => r.results.length > 1)
        ? 'Season results'
        : 'Race results — partial classification';
    return (
      <div className="space-y-4">
        <SeasonResultsPanel races={merged} heading={heading} />
        <SourceLink
          href={FORMULA_E_SOURCE_URL}
          label="en.wikipedia.org (2025–26 Formula E)"
        />
      </div>
    );
  }

  if (series.meta.slug === 'nascar-cup') {
    const rounds =
      series.rounds?.rounds.map(r => ({
        round: r.round,
        startDate: r.startDate,
        name: r.name,
      })) ?? [];
    if (rounds.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    const [races, overrides] = await Promise.all([
      fetchNascarCupSeasonResults({ rounds }),
      loadResultsOverrides(series.meta.slug),
    ]);
    if (races.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    const merged = applyResultsOverrides(races, overrides);
    return (
      <div className="space-y-4">
        <SeasonResultsPanel races={merged} />
        <SourceLink
          href={NASCAR_SOURCE_URL}
          label="Wikipedia (2026 NASCAR Cup Series)"
        />
      </div>
    );
  }

  if (series.meta.slug === 'wrc') {
    const [races, overrides] = await Promise.all([
      fetchWRCSeasonResults(series.meta.season),
      loadResultsOverrides(series.meta.slug),
    ]);
    if (races.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    const merged = applyResultsOverrides(races, overrides);
    // No SeasonTrendChart: WRC's calendar-table parse emits one winner entry
    // per rally (driver / co-driver / team), not a full top-10 classification.
    // Adding a chart with winners-only data would violate the cross-series
    // chart-vs-standings invariant (see CHANGELOG 0.11.5 header). When per-
    // rally Wikipedia pages or wrc.com classification data lands, restore.
    return (
      <div className="space-y-4">
        <SeasonResultsPanel races={merged} heading="Rally winners by round" />
        <SourceLink
          href="https://en.wikipedia.org/wiki/2026_World_Rally_Championship"
          label="en.wikipedia.org (2026 WRC)"
        />
      </div>
    );
  }

  if (series.meta.slug === 'motogp') {
    const [races, overrides] = await Promise.all([
      fetchMotoGPSeasonResults(series.meta.season),
      loadResultsOverrides(series.meta.slug),
    ]);
    if (races.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    const merged = applyResultsOverrides(races, overrides);
    return (
      <div className="space-y-4">
        <SeasonResultsPanel races={merged} preserveOrder />
        <SourceLink
          href="https://www.motogp.com/en/Results+Statistics"
          label="motogp.com"
        />
      </div>
    );
  }

  if (series.meta.slug === 'wsbk') {
    const [races, overrides] = await Promise.all([
      fetchWsbkSeasonResults(series.meta.season),
      loadResultsOverrides(series.meta.slug),
    ]);
    if (races.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    const merged = applyResultsOverrides(races, overrides);
    return (
      <div className="space-y-4">
        <SeasonResultsPanel races={merged} preserveOrder />
        <SourceLink href="https://www.worldsbk.com/en/results" label="worldsbk.com" />
      </div>
    );
  }

  if (!series.meta.officialStandingsUrl) {
    return <PlaceholderTab tabLabel="Results" />;
  }

  return <LinkOutCard officialStandingsUrl={series.meta.officialStandingsUrl} />;
}
