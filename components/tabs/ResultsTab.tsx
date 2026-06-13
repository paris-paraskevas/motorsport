import Link from 'next/link';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import type {
  Series,
  RaceResult,
  RaceResultEntry,
  ResultsOverridesFile,
} from '@/lib/types';
import { groupByWeekend } from '@/lib/group';
import { fetchF1SeasonResults } from '@/lib/results/f1';
import { fetchF2SeasonResults } from '@/lib/results/f2';
import { fetchF3SeasonResults } from '@/lib/results/f3';
import { fetchFormulaESeasonResults } from '@/lib/results/formula-e';
import {
  fetchAllGtWorldSeasonRaces,
  type Cup,
  type GtWorldRaceResult,
  type GtWorldRaceResultEntry,
} from '@/lib/results/gt-world';
import { fetchImsaSeasonResults, type ImsaRaceEntry, type ImsaRoundResults } from '@/lib/results/imsa';
import {
  fetchWecSeasonResults,
  WEC_RESULT_CLASSES,
  type WecRoundResults,
} from '@/lib/results/wec';
import { fetchIndyCarSeasonResults } from '@/lib/results/indycar';
import { fetchMotoGPSeasonResults } from '@/lib/results/motogp';
import { fetchNascarCupSeasonResults } from '@/lib/results/nascar-cup';
import { fetchWsbkSeasonResults } from '@/lib/results/wsbk';
import { fetchWRCSeasonResults } from '@/lib/results/wrc';
import { IMSA_CLASSES } from '@/lib/standings/imsa';
import { loadCuratedDrivers, loadResultsOverrides } from '@/lib/series-content';
import { PlaceholderTab } from '@/components/tabs/PlaceholderTab';

const SOURCE_URL = 'https://github.com/jolpica/jolpica-f1';
const FORMULA_E_SOURCE_URL =
  'https://en.wikipedia.org/wiki/2025%E2%80%9326_Formula_E_World_Championship';
const NASCAR_SOURCE_URL = 'https://en.wikipedia.org/wiki/2026_NASCAR_Cup_Series';
const GT_WORLD_SOURCE_URL =
  'https://www.gt-world-challenge-europe.com/results/2026';

// Exported for StandingsTab, which builds the season-trend chart from the
// same override-patched results the accordion renders (0.26.0 chart move).
export function applyResultsOverrides(
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
    <div className="border border-border bg-surface/40 p-6 text-center">
      <div className="text-text-muted text-sm">{message}</div>
    </div>
  );
}

function ResultRow({ entry }: { entry: RaceResultEntry }) {
  return (
    <li className="flex items-baseline gap-3 py-2 break-inside-avoid">
      <span className="w-6 text-text-faint text-sm font-mono tabular-nums text-right">
        {entry.position}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-text text-sm font-medium truncate">
            {entry.driverName}
          </span>
          {entry.driverCode ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint border border-border px-1.5 py-0.5">
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

// Results-row v2 primitives (operator 2026-06-11: per-race layout redesign +
// clickable races). Three pieces shared by the generic / IMSA / GT World rows:
// a tint mono round chip, the race title — which links through to the round's
// weekend page when one exists — and a mono meta line with the winner in
// brand amber. The chevron remains the accordion control; activating a link
// inside <summary> follows the link without toggling the details element.

function RoundChip({ label }: { label: string }) {
  return (
    <span className="w-9 shrink-0 pt-1 text-right font-mono text-[11px] font-semibold tabular-nums text-tint">
      {label}
    </span>
  );
}

function RaceTitle({ name, href }: { name: string; href?: string }) {
  if (!href) {
    return (
      <span className="font-display text-[15px] font-bold uppercase tracking-wide leading-snug text-text">
        {name}
      </span>
    );
  }
  return (
    <Link href={href} className="group/wknd inline-block max-w-full">
      <span className="font-display text-[15px] font-bold uppercase tracking-wide leading-snug text-text underline-offset-4 group-hover/wknd:text-tint group-hover/wknd:underline transition-colors duration-(--duration-fast)">
        {name}
      </span>
      <ArrowUpRight
        size={13}
        aria-hidden
        className="ml-1 inline-block align-[-1px] text-text-faint group-hover/wknd:text-tint transition-colors duration-(--duration-fast)"
      />
      <span className="sr-only"> — open race weekend</span>
    </Link>
  );
}

function RowMeta({ date, winner }: { date?: Date; winner?: string }) {
  if (!date && !winner) return null;
  return (
    <div className="mt-0.5 sm:truncate font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
      {date ? formatDate(date) : null}
      {date && winner ? ' · ' : null}
      {winner ? (
        <>
          <span className="font-semibold text-brand">WIN</span>{' '}
          <span className="text-text-muted normal-case">{winner}</span>
        </>
      ) : null}
    </div>
  );
}

function RoundRow({ race, weekendHref }: { race: RaceResult; weekendHref?: string }) {
  const winner = race.results.find(r => r.position === 1) ?? race.results[0];
  const winnerLabel = winner ? `${winner.driverName} — ${winner.team}` : undefined;
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
      <div className="flex items-start gap-3 py-2.5">
        <RoundChip label={`R${race.round}`} />
        <div className="flex-1 min-w-0">
          <RaceTitle name={race.raceName} href={weekendHref} />
          <RowMeta date={race.date} winner={winnerLabel} />
        </div>
      </div>
    );
  }

  return (
    <details className="group">
      <summary className="flex items-start gap-3 py-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <RoundChip label={`R${race.round}`} />
        <div className="flex-1 min-w-0">
          <RaceTitle name={race.raceName} href={weekendHref} />
          <RowMeta date={race.date} winner={winnerLabel} />
        </div>
        <ChevronDown
          size={16}
          className="mt-1 text-text-faint transition-transform group-open:rotate-180 shrink-0"
        />
      </summary>
      <ul className="ml-2 sm:ml-9 mt-2 mb-2 divide-y divide-border/60 border-l border-border/60 pl-3 sm:columns-2 sm:gap-x-10">
        {race.results.map(entry => (
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
  seriesSlug,
  weekendRounds,
}: {
  races: RaceResult[];
  heading?: string;
  // When true, caller has already ordered the array — don't resort (WSBK
  // emits R1 / SP / R2 per round and wants R2 last per weekend).
  preserveOrder?: boolean;
  // When both are provided, rows whose round maps to a live weekend page
  // link through to /series/<slug>/weekend/<round>.
  seriesSlug?: string;
  weekendRounds?: Set<number>;
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
    <section className="border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        {heading}
      </h2>
      <ul className="divide-y divide-border/60">
        {sorted.map(r => (
          // raceName participates in the key because some series (WSBK, F2,
          // F3) emit multiple RaceResults per round (Race 1 / Superpole / Race
          // 2 — or Feature / Sprint) sharing the same round number.
          <li key={`${r.round}-${r.raceName}`} className="py-1">
            <RoundRow
              race={r}
              weekendHref={
                seriesSlug && weekendRounds?.has(r.round)
                  ? `/series/${seriesSlug}/weekend/${r.round}`
                  : undefined
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ImsaResultRow({ entry }: { entry: ImsaRaceEntry }) {
  // IMSA's Alkamel JSON doesn't carry championship points (it's a timing
  // export), so this row mirrors the F1-shape ResultRow above but replaces
  // the trailing points column with the gap-to-leader. Status surfaces only
  // when timing is absent (DNS / DNF entries).
  return (
    <li className="flex items-baseline gap-3 py-2 break-inside-avoid">
      <span className="w-6 text-text-faint text-sm font-mono tabular-nums text-right">
        {entry.position}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-text text-sm font-medium truncate">
            {entry.drivers || entry.team}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint border border-border px-1.5 py-0.5">
            #{entry.carNumber}
          </span>
        </div>
        <div className="text-text-muted text-xs truncate">
          {entry.team}
          {entry.vehicle ? ` · ${entry.vehicle}` : ''}
        </div>
      </div>
      <span className="text-text-muted text-[11px] font-mono tabular-nums text-right w-24 truncate">
        {entry.gap || entry.status}
      </span>
    </li>
  );
}

function ImsaSeasonResultsPanel({
  rounds,
  seriesSlug,
  weekendRounds,
}: {
  rounds: ImsaRoundResults[];
  seriesSlug?: string;
  weekendRounds?: Set<number>;
}) {
  // Flatten rounds × classes into one row per (round, class). IMSA_CLASSES
  // order (GTP → LMP2 → GTD Pro → GTD) drives within-round ordering, which
  // matches the same class-first grouping the standings tab uses
  // (`StandingsTab.tsx` lines 467+). Most recent round first.
  const items = [...rounds]
    .sort((a, b) => b.round - a.round)
    .flatMap(round =>
      IMSA_CLASSES.map(cls => ({
        round,
        cls,
        entries: round.perClass[cls] ?? [],
      })).filter(item => item.entries.length > 0),
    );

  return (
    <section className="border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        Season results
      </h2>
      <ul className="divide-y divide-border/60">
        {items.map(item => (
          <li key={`${item.round.round}-${item.cls}`} className="py-1">
            <ImsaRoundClassCard
              roundNumber={item.round.round}
              eventName={item.round.eventName}
              date={item.round.date}
              cls={item.cls}
              entries={item.entries}
              weekendHref={
                seriesSlug && weekendRounds?.has(item.round.round)
                  ? `/series/${seriesSlug}/weekend/${item.round.round}`
                  : undefined
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ImsaRoundClassCard({
  roundNumber,
  eventName,
  date,
  cls,
  entries,
  weekendHref,
}: {
  roundNumber: number;
  eventName: string;
  date: Date;
  // Display-only class label. ImsaClass for IMSA rounds; WEC reuses this
  // card with its own class names (Hypercar / LMP2 / LMGT3).
  cls: string;
  entries: ImsaRaceEntry[];
  weekendHref?: string;
}) {
  const winner = entries[0];
  const winnerLabel = winner
    ? winner.drivers
      ? `${winner.drivers} — ${winner.team}`
      : winner.team
    : undefined;
  return (
    <details className="group">
      <summary className="flex items-start gap-3 py-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <RoundChip label={`R${roundNumber}`} />
        <div className="flex-1 min-w-0">
          <RaceTitle name={`${eventName} — ${cls}`} href={weekendHref} />
          <RowMeta date={date} winner={winnerLabel} />
        </div>
        <ChevronDown
          size={16}
          className="mt-1 text-text-faint transition-transform group-open:rotate-180 shrink-0"
        />
      </summary>
      <ul className="ml-2 sm:ml-9 mt-2 mb-2 divide-y divide-border/60 border-l border-border/60 pl-3 sm:columns-2 sm:gap-x-10">
        {entries.map(entry => (
          <ImsaResultRow
            key={`${entry.position}-${entry.carNumber}`}
            entry={entry}
          />
        ))}
      </ul>
    </details>
  );
}

// FIA WEC — same flatten-rounds-×-classes shape as IMSA. WecRaceEntry is
// structurally compatible with ImsaRaceEntry (drivers may be empty when a
// crew isn't in the season standings — Le Mans one-offs, the LMP2 field),
// so the IMSA row + card components render WEC rounds unchanged. dateEnd is
// the display date: race day for the 6/8-hour rounds, the Sunday for Le Mans.
function WecSeasonResultsPanel({
  rounds,
  seriesSlug,
  weekendRounds,
}: {
  rounds: WecRoundResults[];
  seriesSlug?: string;
  weekendRounds?: Set<number>;
}) {
  const items = [...rounds]
    .sort((a, b) => b.round - a.round)
    .flatMap(round =>
      WEC_RESULT_CLASSES.map(cls => ({
        round,
        cls,
        // The class winner has no gap, so the shared row's gap||status cell
        // would render empty — surface the race total time there instead.
        entries: (round.perClass[cls] ?? []).map(e =>
          e.position === 1 && !e.gap ? { ...e, gap: e.elapsedTime } : e,
        ),
      })).filter(item => item.entries.length > 0),
    );

  return (
    <section className="border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        Season results
      </h2>
      <ul className="divide-y divide-border/60">
        {items.map(item => (
          <li key={`${item.round.round}-${item.cls}`} className="py-1">
            <ImsaRoundClassCard
              roundNumber={item.round.round}
              eventName={item.round.eventName}
              date={item.round.dateEnd}
              cls={item.cls}
              entries={item.entries}
              weekendHref={
                seriesSlug && weekendRounds?.has(item.round.round)
                  ? `/series/${seriesSlug}/weekend/${item.round.round}`
                  : undefined
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

// GT World Challenge Europe — class-aware results panel mirroring IMSA.
// Each (race, cup) tuple becomes one accordion row. Cup ordering is fixed
// at Pro → Gold → Silver → Bronze, matching the standings tab's class
// grouping (StandingsTab.tsx).
const GT_WORLD_CUP_ORDER: Cup[] = ['pro', 'gold', 'silver', 'bronze'];

function gtWorldCupLabel(cup: Cup): string {
  switch (cup) {
    case 'pro':
      return 'Pro Cup';
    case 'gold':
      return 'Gold Cup';
    case 'silver':
      return 'Silver Cup';
    case 'bronze':
      return 'Bronze Cup';
    default:
      return 'Unclassified';
  }
}

function GtWorldResultRow({ entry }: { entry: GtWorldRaceResultEntry }) {
  // Endurance crews are 3-4 drivers; sprint crews are 2. The driver list
  // is joined with " · " to keep the row compact at typical card widths.
  // No points column — SRO points scale + trend chart deferred to a
  // follow-up (see CHANGELOG 0.12.13 "Won't ship in this PR" section).
  return (
    <li className="flex items-baseline gap-3 py-2 break-inside-avoid">
      <span className="w-6 text-text-faint text-sm font-mono tabular-nums text-right">
        {entry.position}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-text text-sm font-medium truncate">
            {entry.drivers.join(' · ')}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold text-text-faint border border-border px-1.5 py-0.5">
            #{entry.carNumber}
          </span>
        </div>
        <div className="text-text-muted text-xs truncate">
          {entry.team}
          {entry.car ? ` · ${entry.car}` : ''}
        </div>
      </div>
      <span className="text-text-muted text-[11px] font-mono tabular-nums text-right w-24 truncate">
        {entry.gap || entry.time || ''}
      </span>
    </li>
  );
}

function GtWorldRoundClassCard({
  race,
  cup,
  entries,
  weekendHref,
}: {
  race: GtWorldRaceResult;
  cup: Cup;
  entries: GtWorldRaceResultEntry[];
  weekendHref?: string;
}) {
  const winner = entries[0];
  const winnerLabel = winner
    ? `${winner.drivers.join(' · ')} — ${winner.team}`
    : undefined;
  // Round numbers (and therefore weekend links) come from the curated
  // event-rounds.json map; unmapped events keep the championship-letter chip
  // and render unlinked.
  return (
    <details className="group">
      <summary className="flex items-start gap-3 py-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <RoundChip
          label={race.round ? `R${race.round}` : race.championship === 'endurance' ? 'E' : 'S'}
        />
        <div className="flex-1 min-w-0">
          <RaceTitle
            name={`${race.eventName} ${race.raceName} — ${gtWorldCupLabel(cup)}`}
            href={weekendHref}
          />
          <RowMeta winner={winnerLabel} />
        </div>
        <ChevronDown
          size={16}
          className="mt-1 text-text-faint transition-transform group-open:rotate-180 shrink-0"
        />
      </summary>
      <ul className="ml-2 sm:ml-9 mt-2 mb-2 divide-y divide-border/60 border-l border-border/60 pl-3 sm:columns-2 sm:gap-x-10">
        {entries.map(entry => (
          <GtWorldResultRow
            key={`${entry.position}-${entry.carNumber}`}
            entry={entry}
          />
        ))}
      </ul>
    </details>
  );
}

function GtWorldSeasonResultsPanel({
  races,
  seriesSlug,
  weekendRounds,
}: {
  races: GtWorldRaceResult[];
  seriesSlug?: string;
  weekendRounds?: Set<number>;
}) {
  // Flatten races × cups into one row per (race, cup). Races are kept in
  // the order they were fetched (the parser already groups by event +
  // race-id); cups within each race follow GT_WORLD_CUP_ORDER.
  const items = races.flatMap(race =>
    GT_WORLD_CUP_ORDER.map(cup => ({
      race,
      cup,
      entries: race.entries.filter(e => e.cup === cup),
    })).filter(item => item.entries.length > 0),
  );

  return (
    <section className="border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        Season results
      </h2>
      <ul className="divide-y divide-border/60">
        {items.map(item => (
          <li
            key={`${item.race.raceId}-${item.cup}`}
            className="py-1"
          >
            <GtWorldRoundClassCard
              race={item.race}
              cup={item.cup}
              entries={item.entries}
              weekendHref={
                seriesSlug && item.race.round && weekendRounds?.has(item.race.round)
                  ? `/series/${seriesSlug}/weekend/${item.race.round}`
                  : undefined
              }
            />
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
    <div className="border border-border bg-surface/40 p-6 text-center">
      <p className="text-text-muted text-sm mb-4">
        Race-by-race results are on the official site.
      </p>
      <a
        href={officialStandingsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-border-strong hover:bg-surface text-text text-sm font-medium transition-colors duration-(--duration-fast)"
      >
        {label} <span aria-hidden>→</span>
      </a>
    </div>
  );
}

export async function ResultsTab({ series }: { series: Series }) {
  // Round numbers that resolve to a live weekend page (same grouping
  // weekendFor() uses) — race rows only link where the URL exists, so a
  // results round absent from the weekend grouping never 404s.
  const slug = series.meta.slug;
  const weekendRounds = new Set(
    groupByWeekend(series.sessions, new Date(), series.rounds).map(w => w.round),
  );

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
    // The drivers' season-trend chart lives on the Standings tab as of
    // 0.26.0 — cumulative points are standings-shaped data, and co-locating
    // the chart with the tables it must reconcile against keeps the
    // chart-vs-standings invariant visible.
    return (
      <div className="space-y-4">
        <SeasonResultsPanel races={merged} seriesSlug={slug} weekendRounds={weekendRounds} />
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
          <SeasonResultsPanel races={feature} heading="Feature races" seriesSlug={slug} weekendRounds={weekendRounds} />
        ) : null}
        {sprint.length > 0 ? (
          <SeasonResultsPanel races={sprint} heading="Sprint races" seriesSlug={slug} weekendRounds={weekendRounds} />
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
        <SeasonResultsPanel races={merged} seriesSlug={slug} weekendRounds={weekendRounds} />
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
        <SeasonResultsPanel races={merged} seriesSlug={slug} weekendRounds={weekendRounds} />
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
        <SeasonResultsPanel races={merged} heading={heading} seriesSlug={slug} weekendRounds={weekendRounds} />
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
        <SeasonResultsPanel races={merged} seriesSlug={slug} weekendRounds={weekendRounds} />
        <SourceLink
          href={NASCAR_SOURCE_URL}
          label="Wikipedia (2026 NASCAR Cup Series)"
        />
      </div>
    );
  }

  if (series.meta.slug === 'gt-world') {
    const races = await fetchAllGtWorldSeasonRaces(series.meta.season);
    if (races.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    // No trend chart in 0.12.13 — SRO points scale (Sprint Cup top-10,
    // Endurance Cup multipliers, Spa 24h 3-stage scoring, Super Pole
    // bonus, per-cup sub-scoring) isn't encoded yet. Per the cross-series
    // chart-vs-standings invariant, ship classification first; the chart
    // ships in a follow-up when points are reconciled against the
    // standings tab.
    return (
      <div className="space-y-4">
        <GtWorldSeasonResultsPanel races={races} seriesSlug={slug} weekendRounds={weekendRounds} />
        <SourceLink
          href={GT_WORLD_SOURCE_URL}
          label="gt-world-challenge-europe.com (2026)"
        />
      </div>
    );
  }

  if (series.meta.slug === 'imsa') {
    const rounds = await fetchImsaSeasonResults();
    if (rounds.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    // No trend chart: per the cross-series invariant (see CHANGELOG 0.11.5
    // header), a chart that disagrees with the standings tab erodes trust.
    // Alkamel doesn't carry championship points, and IMSA's per-class scale
    // shifts between sprint / IMEC rounds, so a faithful trend requires
    // reconciliation work we haven't done. Standings tab is the authority.
    return (
      <div className="space-y-4">
        <ImsaSeasonResultsPanel rounds={rounds} seriesSlug={slug} weekendRounds={weekendRounds} />
        <SourceLink
          href="https://imsa.results.alkamelcloud.com/"
          label="imsa.results.alkamelcloud.com (Al Kamel timing)"
        />
      </div>
    );
  }

  if (series.meta.slug === 'wec') {
    const rounds = await fetchWecSeasonResults();
    if (rounds.length === 0) {
      return (
        <EmptyState message="Results are temporarily unavailable. Check back shortly." />
      );
    }
    // No trend chart: the fiawec timing table carries no championship points
    // (same limitation as IMSA's Alkamel export), so a chart can't reconcile
    // against the standings tab. Standings remain the points authority.
    return (
      <div className="space-y-4">
        <WecSeasonResultsPanel rounds={rounds} seriesSlug={slug} weekendRounds={weekendRounds} />
        <SourceLink
          href="https://www.fiawec.com/en/page/resultats-1"
          label="fiawec.com (official results)"
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
    return (
      <div className="space-y-4">
        <SeasonResultsPanel races={merged} seriesSlug={slug} weekendRounds={weekendRounds} />
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
        <SeasonResultsPanel races={merged} preserveOrder seriesSlug={slug} weekendRounds={weekendRounds} />
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
        <SeasonResultsPanel races={merged} preserveOrder seriesSlug={slug} weekendRounds={weekendRounds} />
        <SourceLink href="https://www.worldsbk.com/en/results" label="worldsbk.com" />
      </div>
    );
  }

  // DTM intentionally falls through to the link-out card: its only per-round
  // data is the points matrix powering the season-trend chart, which lives on
  // the Standings tab as of 0.26.0. A per-race classification accordion needs
  // the motorsport.com per-event pages probed first (0.12.15.1 entry note).

  if (!series.meta.officialStandingsUrl) {
    return <PlaceholderTab tabLabel="Results" />;
  }

  return <LinkOutCard officialStandingsUrl={series.meta.officialStandingsUrl} />;
}
