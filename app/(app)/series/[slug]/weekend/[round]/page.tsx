import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { listSeriesSlugs, loadSeries } from '@/lib/series';
import { groupByWeekend } from '@/lib/group';
import { weekendFor, weekendLabel, weekendStartEnd } from '@/lib/weekend';
import { WeekendHero } from '@/components/weekend/WeekendHero';
import { WeekendWeatherStrip } from '@/components/weekend/WeekendWeatherStrip';
import { WeekendSchedule } from '@/components/weekend/WeekendSchedule';
import { WeekendStandingsSnapshot } from '@/components/weekend/WeekendStandingsSnapshot';
import { WeekendNews } from '@/components/weekend/WeekendNews';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd, sportsEventLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const slugs = await listSeriesSlugs();
  const all = await Promise.all(
    slugs.map(async slug => {
      try {
        const series = await loadSeries(slug);
        const weekends = groupByWeekend(series.sessions, new Date(), series.rounds);
        return weekends.map(w => ({ slug, round: String(w.round) }));
      } catch {
        return [];
      }
    }),
  );
  return all.flat();
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
  const { title: weekendTitleLabel } = weekendLabel(weekend, round);
  const eventName =
    weekendTitleLabel === `Round ${round}`
      ? `${series.meta.name} Round ${round}`
      : `${series.meta.name} — ${weekendTitleLabel}`;

  return (
    <div
      className="relative max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto p-4 md:p-6 lg:p-8 pb-16"
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
      />

      <WeekendWeatherStrip weekend={weekend} />

      <WeekendSchedule
        weekend={weekend}
        color={color}
        // Per-session pages: F1 has every session via OpenF1; the listed
        // series carry race-session classifications from their results
        // feeds (0.35.0). DTM/IMSA/GTWC/WEC/NLS/ADAC stay unlinked until a
        // per-race source exists for them.
        sessionLinkBase={
          ['f1', 'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup'].includes(slug)
            ? `/series/${slug}/weekend/${round}`
            : undefined
        }
      />

      <WeekendStandingsSnapshot series={series} round={round} isPast={isPast} />

      <WeekendNews series={series} weekend={weekend} />

      <p className="mt-10 text-center text-[11px] uppercase tracking-[0.16em] text-text-faint">
        Predictions and comments coming soon
      </p>
    </div>
  );
}
