import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { loadSeries } from '@/lib/series';
import { sessionSlug, weekendFor, weekendLabel, weekendStartEnd } from '@/lib/weekend';
import { WeekendHero } from '@/components/weekend/WeekendHero';
import { circuitLayoutFor } from '@/lib/circuit-layout';
import { matchCircuitEntry } from '@/lib/circuits';
import { WeekendWeatherStrip } from '@/components/weekend/WeekendWeatherStrip';
import { WeekendSchedule } from '@/components/weekend/WeekendSchedule';
import { WeekendTabs } from '@/components/weekend/WeekendTabs';
import { isBettingConfigured } from '@/lib/betting/client';
import { BETTABLE_SERIES } from '@/lib/betting/constants';
import { NEWS_SLUG_MAP } from '@/lib/news';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd, sportsEventLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';
import { Tv, ArrowUpRight, MapPin } from 'lucide-react';
import { VideoEmbed } from '@/components/VideoEmbed';
import { loadMedia, highlightForRound } from '@/lib/media';
import { loadF1Upgrades, loadCuratedDrivers } from '@/lib/series-content';
import { getTrackInfoByCircuitSlug } from '@/lib/information/registry';
import { WeekendUpgrades } from '@/components/weekend/WeekendUpgrades';

// ISR: weekend pages edge-cache (was force-dynamic — uncached, slow per hit).
// Everything here is cacheable — weather (KV), news, and the standings-snapshot
// fetchers all revalidate, and the snapshot excludes WEC's no-store live feed.
export const revalidate = 300;

// On-demand: generate + edge-cache on first request rather than prerendering
// every series×round at build (which would fan out weather/results fetches
// across ~200 weekends). The sitemap still enumerates them for crawlers.
export function generateStaticParams() {
  return [];
}

function parseRound(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; round: string }> },
): Promise<Metadata> {
  const { slug, round: roundRaw } = await params;
  const round = parseRound(roundRaw);
  if (!round) return { title: 'Weekend not found' };
  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    return { title: 'Weekend not found' };
  }
  const weekend = weekendFor(series, round);
  if (!weekend) return { title: 'Weekend not found' };
  const { title: label } = weekendLabel(weekend, round);
  const baseTitle = label === `Round ${round}`
    ? `${series.meta.name} · Round ${round}`
    : `${series.meta.name} · ${label} · Round ${round}`;
  // Google's title display caps around 60 chars and the layout appends
  // " — Paddock Tracker" (17 chars) so dynamic portion budget is ~43 chars.
  // Cap conservatively at 60 to leave room for the suffix without ellipsis
  // ever showing on common combinations.
  const fullTitle = baseTitle.length > 60 ? `${baseTitle.slice(0, 59)}…` : baseTitle;
  const description = `${series.meta.name} Round ${round} — ${label}. ${weekend.dateRangeLabel}. Schedule, weather, standings, news. Where to watch live.`;
  return {
    title: fullTitle,
    description,
    keywords: [
      series.meta.name,
      label,
      `${series.meta.name} ${weekend.dateRangeLabel}`,
      `${series.meta.name} schedule`,
      `${series.meta.name} round ${round}`,
      `${series.meta.name} where to watch`,
      `${series.meta.name} ${label} schedule`,
      `${series.meta.name} ${label} timetable`,
      `${series.meta.name} ${label} live stream`,
    ],
    alternates: { canonical: `/series/${slug}/weekend/${round}` },
    ...withSocialMeta({
      title: fullTitle,
      description,
      path: `/series/${slug}/weekend/${round}`,
    }),
  };
}

export default async function WeekendPage({
  params,
}: {
  params: Promise<{ slug: string; round: string }>;
}) {
  const { slug, round: roundRaw } = await params;
  const round = parseRound(roundRaw);
  if (!round) notFound();

  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    notFound();
  }

  const weekend = weekendFor(series, round);
  if (!weekend) notFound();

  const now = new Date();
  const { start, end } = weekendStartEnd(weekend);
  const isPast = end.getTime() < now.getTime();
  const color = series.meta.color;
  // Watch link + race highlights. loadMedia is an fs read (no fetch), so this
  // stays ISR-safe. The headline clip shows once the weekend is in the past.
  const media = await loadMedia(slug);
  const raceHighlight = isPast ? highlightForRound(media, round) : undefined;
  // Per-weekend car upgrades (F1 only) from the curated FIA Car Presentation
  // data — fs read, ISR-safe. Null when this round has no curated entry.
  const upgrades = slug === 'f1' ? await loadF1Upgrades(round) : null;
  const watch = series.meta.watch;
  const { title: weekendTitleLabel } = weekendLabel(weekend, round);
  const eventName =
    weekendTitleLabel === `Round ${round}`
      ? `${series.meta.name} Round ${round}`
      : `${series.meta.name} — ${weekendTitleLabel}`;

  // Per-session result pages: F1 via OpenF1; the listed series carry race-session
  // classifications; WEC/IMSA/GT World render per-class tables; WRC stage pages
  // show the curated per-stage overall classification (0.229.0). Others stay
  // unlinked. Passed straight to the Schedule so each session ROW links to its
  // page — no separate "Sessions" list (it duplicated the timetable).
  const sessionLinkBase = ['f1', 'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup', 'wec', 'imsa', 'gt-world', 'wrc'].includes(slug)
    ? `/series/${slug}/weekend/${round}`
    : undefined;

  // Circuit-layout schematic for the hero (F1 2026 calendar in v1, from f1db) —
  // resolved by the round's venue/name via the shared circuit matcher. ISR-safe
  // (fs reads); gracefully null for circuits we haven't curated a map for.
  const circuitLayout = await circuitLayoutFor(
    weekend.sessions.find(s => s.location)?.location,
    weekendTitleLabel,
  );

  // SportsEvent structured-data enrichment (SEO): resolve the venue's circuit
  // (address/geo) and the series' curated teams (performers). Both fs reads,
  // ISR-safe; gracefully partial when a venue or roster isn't curated.
  const venueLocation = weekend.sessions.find(s => s.location)?.location;
  const circuitMatch = await matchCircuitEntry(venueLocation, weekendTitleLabel);
  // Deep-link the venue to its /information circuit profile when one exists —
  // those pages are otherwise reachable only from the tracks index + search.
  const trackInfoSlug = circuitMatch
    ? (await getTrackInfoByCircuitSlug()).get(circuitMatch.slug)
    : undefined;
  // Rally / multi-venue rounds have no single circuit; fall back to the round's
  // curated host country (rounds.json) so SportsEvent still emits an address.
  const roundMeta = series.rounds?.rounds?.find((r) => r.round === round);
  const roster = await loadCuratedDrivers(slug);
  const eventDescription =
    `Round ${round} of the ${series.meta.season} ${series.meta.name} season` +
    (weekend.roundName ? `, the ${weekend.roundName}` : '') +
    (venueLocation ? ` at ${venueLocation}` : '') +
    '.';

  // Per-session sub-events for the weekend SportsEvent — the schedule + start
  // times search can surface. Timed sessions only (TBC/dateOnly have no instant).
  const sessionEvents = [...weekend.sessions]
    .filter((s) => !s.dateOnly)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((s) => ({
      name: s.title.replace(/^.*?[-–—:]\s*/, '').trim() || s.title,
      startDate: s.start,
      endDate: s.end,
      url: `${SITE_URL}/series/${slug}/weekend/${round}/${sessionSlug(s.title)}`,
    }));

  return (
    <div
      className={`relative ${PAGE_WIDE}`}
      style={{
        '--tint': color,
        ['--series-color' as string]: color,
      } as React.CSSProperties}
    >
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: series.meta.name, url: `${SITE_URL}/series/${slug}` },
          {
            name: eventName,
            url: `${SITE_URL}/series/${slug}/weekend/${round}`,
          },
        ])}
      />
      <JsonLd
        data={sportsEventLd({
          weekend,
          series,
          slug,
          round,
          title: eventName,
          startDate: start,
          endDate: end,
          description: eventDescription,
          organizerUrl: series.meta.officialSite ?? `${SITE_URL}/series/${slug}`,
          performers: roster?.teams.map(t => t.name) ?? [],
          addressCountry: circuitMatch?.circuit.countryCode ?? roundMeta?.countryCode,
          venue: circuitMatch?.circuit.name,
          geo: circuitMatch
            ? { lat: circuitMatch.circuit.lat, lon: circuitMatch.circuit.lon }
            : undefined,
          subEvents: sessionEvents,
          previousStartDate: weekend.previousStartDate,
          cancelled: roundMeta?.cancelled,
          watch,
        })}
      />
      {/* Radial wash retired with the rest of the app's (2c-3 precedent);
          the series-color hairline below is a hard rule — on-language. */}
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      <WeekendHero
        weekend={weekend}
        round={round}
        seriesSlug={series.meta.slug}
        seriesName={series.meta.name}
        color={color}
        circuitLayout={circuitLayout}
      />

      {trackInfoSlug && circuitMatch && (
        <div className="mb-8">
          <Link
            href={`/information/tracks/${trackInfoSlug}`}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-brand transition-colors duration-(--duration-fast)"
          >
            <MapPin size={13} />
            About {circuitMatch.circuit.name}
            <ArrowUpRight size={12} className="opacity-60" />
          </Link>
        </div>
      )}

      {(raceHighlight || watch) && (
        <section className="mb-8 border-y border-border py-4">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
            {raceHighlight ? 'Highlights' : 'Where to watch'}
          </h2>
          {raceHighlight && (
            <VideoEmbed id={raceHighlight} title={`${eventName} race highlights`} />
          )}
          {watch && (
            <a
              href={watch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-brand transition-colors duration-(--duration-fast)"
            >
              <Tv size={13} />
              {isPast ? 'Watch on' : 'Watch live on'} {watch.service}
              <ArrowUpRight size={12} className="opacity-60" />
            </a>
          )}
        </section>
      )}

      {upgrades && <WeekendUpgrades data={upgrades} />}

      {/* Tabs: Schedule (server-rendered timetable + weather, paints with the
          page; each session row links to its result page, and standings sit
          behind a lazy disclosure) | Bets (F1) | News. The non-default tabs mount
          + fetch only when first opened, so a cold weekend render does only the
          cheap schedule + weather — not the news feed, the results fan-out, or
          the betting markets. The page stays ISR-cacheable. */}
      <WeekendTabs
        scheduleSlot={
          <>
            <WeekendSchedule weekend={weekend} color={color} sessionLinkBase={sessionLinkBase} />
            <WeekendWeatherStrip weekend={weekend} />
          </>
        }
        slug={slug}
        round={round}
        isPast={isPast}
        showBets={(BETTABLE_SERIES as readonly string[]).includes(slug) && !isPast && isBettingConfigured()}
        showNews={NEWS_SLUG_MAP[slug] != null}
      />
    </div>
  );
}
