import type { Metadata } from 'next';
import path from 'path';
import { loadAllSeries } from '@/lib/series';
import { loadAllDrivers } from '@/lib/people';
import { groupByWeekend } from '@/lib/group';
import { buildRoundLookupAcrossSeries, roundFor } from '@/lib/weekend';
import { loadRounds } from '@/lib/rounds-loader';
import { fetchAggregatedNews } from '@/lib/news';
import { matchCircuit } from '@/lib/circuits';
import { fetchWeather, forecastFor, weatherLabel } from '@/lib/weather';
import { formatRelative } from '@/lib/date';
import { JsonLd } from '@/components/JsonLd';
import { organizationLd, websiteLd } from '@/lib/json-ld';
import { StandaloneRedirect } from '@/components/landing/StandaloneRedirect';
import { TickerBar, type TickerSegment } from '@/components/landing/TickerBar';
import { LandingNav } from '@/components/landing/LandingNav';
import { Hero, type HeroSession } from '@/components/landing/Hero';
import { MarqueeEvent, type MarqueeEventData } from '@/components/landing/MarqueeEvent';
import { SeriesMarquee } from '@/components/landing/SeriesMarquee';
import { StatsBand } from '@/components/landing/StatsBand';
import { FeatureBlocks } from '@/components/landing/FeatureBlocks';
import { DisciplinesGrid } from '@/components/landing/DisciplinesGrid';
import { PerksCta } from '@/components/landing/PerksCta';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { cleanSessionTitle } from '@/components/landing/clean-title';

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const GMT_FMT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

type Upcoming = {
  session: import('@/lib/types').Session;
  seriesName: string;
  seriesSlug: string;
  seriesColor: string;
};

function pickMarquee(upcoming: Upcoming[]): Upcoming | undefined {
  return (
    upcoming.find(x => x.session.significance?.tier === 'marquee' && !x.session.dateOnly) ??
    upcoming.find(
      x => !x.session.dateOnly && /\b(race|grand prix|500|24 hours|24h|rally)\b/i.test(x.session.title),
    ) ??
    upcoming[0]
  );
}

export default async function Landing() {
  const all = await loadAllSeries();
  const drivers = await loadAllDrivers();
  const now = new Date();

  const flat: Upcoming[] = all
    .flatMap(s =>
      s.sessions.map(session => ({
        session,
        seriesName: s.meta.name,
        seriesSlug: s.meta.slug,
        seriesColor: s.meta.color,
      })),
    )
    .sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  const upcoming = flat.filter(x => x.session.end >= now);
  const roundLookup = buildRoundLookupAcrossSeries(all, now);
  const stats = {
    series: all.length,
    sessions: flat.length,
    races: all.reduce((acc, s) => acc + groupByWeekend(s.sessions, now).length, 0),
    drivers: drivers.length,
  };

  // ── Ticker: stats / next-up / GMT-timed events / weather / news ──
  const segments: TickerSegment[] = [];
  segments.push({
    body: `Tracking ${stats.series} series · ${stats.races} race weekends in 2026`,
  });
  const next = upcoming[0];
  if (next) {
    segments.push({
      dot: next.seriesColor,
      head: 'Next up',
      body: `${next.seriesName} — ${cleanSessionTitle(next.seriesName, next.session.title)}`,
      tail: next.session.dateOnly ? 'time TBC' : formatRelative(next.session.start, now),
    });
  }
  for (const x of upcoming.slice(1, 5)) {
    segments.push({
      dot: x.seriesColor,
      head: x.session.dateOnly ? undefined : `${GMT_FMT.format(x.session.start)} GMT`,
      body: cleanSessionTitle(x.seriesName, x.session.title),
      tail: x.session.location,
    });
  }
  // Weather for the next locatable session (forecasts are KV-cached).
  for (const x of upcoming.slice(0, 4)) {
    const circuit = await matchCircuit(x.session.location, x.session.title);
    if (!circuit) continue;
    const forecast = await fetchWeather(circuit.lat, circuit.lon);
    const daily = forecast ? forecastFor(forecast, x.session.start) : null;
    if (!daily) continue;
    const w = weatherLabel(daily.weatherCode);
    segments.push({
      dot: x.seriesColor,
      head: 'Weather',
      body: `${Math.round(daily.maxC)}°C ${w.label} — ${x.session.location ?? 'next venue'}`,
    });
    break;
  }
  const news = await fetchAggregatedNews();
  const seriesBySlug = new Map(all.map(s => [s.meta.slug, s.meta]));
  for (const item of news.slice(0, 3)) {
    const meta = seriesBySlug.get(item.seriesSlug);
    segments.push({ dot: meta?.color, head: 'News', body: item.title });
  }

  // ── Hero widget ──
  const heroSessions: HeroSession[] = upcoming.slice(0, 6).map(x => {
    const round = roundFor(roundLookup, x.seriesSlug, x.session.uid);
    return {
      seriesSlug: x.seriesSlug,
      seriesName: x.seriesName,
      seriesColor: x.seriesColor,
      title: x.session.title,
      start: x.session.start,
      end: x.session.end,
      location: x.session.location,
      dateOnly: x.session.dateOnly,
      weekendHref: round ? `/series/${x.seriesSlug}/weekend/${round}` : undefined,
    };
  });

  // ── Marquee event (significance-flagged first, race-like fallback) ──
  let marquee: MarqueeEventData | undefined;
  const pick = pickMarquee(upcoming);
  if (pick && !pick.session.dateOnly) {
    const round = roundFor(roundLookup, pick.seriesSlug, pick.session.uid);
    let eventName = cleanSessionTitle(pick.seriesName, pick.session.title);
    if (round !== undefined) {
      const rounds = await loadRounds(path.join(process.cwd(), 'content', 'series', pick.seriesSlug));
      const entry = rounds?.rounds.find(r => r.round === round);
      if (entry?.name) eventName = entry.name;
    }
    marquee = {
      seriesName: pick.seriesName,
      seriesColor: pick.seriesColor,
      eventName,
      sessionTitle: cleanSessionTitle(pick.seriesName, pick.session.title),
      start: pick.session.start,
      location: pick.session.location,
      weekendHref:
        round !== undefined ? `/series/${pick.seriesSlug}/weekend/${round}` : undefined,
    };
  }

  const seriesList = all.map(s => s.meta);

  return (
    <>
      <StandaloneRedirect />
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd()} />

      <TickerBar segments={segments} />
      <LandingNav />
      <main>
        <Hero sessions={heroSessions} now={now} />
        {marquee && <MarqueeEvent event={marquee} />}
        <SeriesMarquee seriesList={seriesList} />
        <StatsBand stats={stats} />
        <FeatureBlocks />
        <DisciplinesGrid seriesList={seriesList} />
        <PerksCta />
      </main>
      <LandingFooter seriesList={seriesList} />
    </>
  );
}
