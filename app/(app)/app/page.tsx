import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { HomeContent } from '@/components/HomeContent';
import { HOME_WEEK_MS } from '@/lib/date';
import { fetchAggregatedNews } from '@/lib/news';
import { matchCircuit } from '@/lib/circuits';
import { fetchWeather, forecastFor, type DailyWeather, type WeatherForecast } from '@/lib/weather';
import { buildRoundLookupAcrossSeries } from '@/lib/weekend';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Your paddock — live schedule & news',
  description:
    'Live motorsport schedule and news across F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more — in your local time.',
  alternates: { canonical: '/app' },
};

async function weatherForSessions(
  candidates: Array<{ session: { uid: string; start: Date; location?: string; title: string } }>,
): Promise<Record<string, DailyWeather>> {
  // Look up weather for up to the next 12 sessions; circuit forecasts dedupe
  // by lat/lon so each unique venue costs at most one upstream call.
  const top = candidates.slice(0, 12);
  const forecasts = new Map<string, WeatherForecast | null>(); // key: lat,lon
  const result: Record<string, DailyWeather> = {};

  for (const item of top) {
    const c = await matchCircuit(item.session.location, item.session.title);
    if (!c) continue;
    const key = `${c.lat},${c.lon}`;
    let forecast = forecasts.get(key);
    if (forecast === undefined) {
      forecast = await fetchWeather(c.lat, c.lon);
      forecasts.set(key, forecast);
    }
    if (!forecast) continue;
    const daily = forecastFor(forecast, item.session.start);
    if (daily) result[item.session.uid] = daily;
  }
  return result;
}

export default async function Home() {
  const all = await loadAllSeries();
  const now = new Date();

  const flat = all
    .flatMap(s =>
      s.sessions.map(session => ({
        session,
        color: s.meta.color,
        seriesName: s.meta.name,
        seriesSlug: s.meta.slug,
        watch: s.meta.watch,
      })),
    )
    .sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  const upcoming = flat.filter(x => x.session.end >= now);

  // Payload diet (audit 2-2/3-2): the client renders live + this week + one
  // "next" candidate per series — shipping the entire remaining season
  // (~hundreds of KB serialized twice) bought nothing but the beyondCount
  // integer, which the per-series counts below now carry instead.
  const horizon = now.getTime() + HOME_WEEK_MS;
  const inWindow = upcoming.filter(x => x.session.start.getTime() <= horizon);
  const firstBeyondBySeries = new Map<string, (typeof upcoming)[number]>();
  for (const x of upcoming) {
    if (x.session.start.getTime() <= horizon) continue;
    if (!firstBeyondBySeries.has(x.seriesSlug)) {
      firstBeyondBySeries.set(x.seriesSlug, x);
    }
  }
  const homeItems = [...inWindow, ...firstBeyondBySeries.values()].sort(
    (a, b) => a.session.start.getTime() - b.session.start.getTime(),
  );

  // Mirrors HomeContent's upcomingItems predicate exactly — counts must
  // agree with what the client would have computed from the full season.
  const upcomingCountBySeries: Record<string, number> = {};
  for (const x of upcoming) {
    const isUpcoming = x.session.dateOnly
      ? x.session.end > now
      : x.session.start > now;
    if (!isUpcoming) continue;
    upcomingCountBySeries[x.seriesSlug] =
      (upcomingCountBySeries[x.seriesSlug] ?? 0) + 1;
  }

  const seriesBySlug = new Map(all.map(s => [s.meta.slug, s.meta]));
  const rawNews = await fetchAggregatedNews();
  const news = rawNews.flatMap(item => {
    const meta = seriesBySlug.get(item.seriesSlug);
    if (!meta) return [];
    return [{
      title: item.title,
      link: item.link,
      pubDate: item.pubDate.toISOString(),
      description: item.description,
      seriesSlug: item.seriesSlug,
      seriesName: meta.name,
      seriesColor: meta.color,
    }];
  });

  const weatherByUid = await weatherForSessions(homeItems);

  // Round lookup only for sessions actually shipped to the client.
  const roundLookup = buildRoundLookupAcrossSeries(all, now);
  const roundByKey: Record<string, number> = {};
  for (const x of homeItems) {
    const key = `${x.seriesSlug}:${x.session.uid}`;
    const round = roundLookup.get(key);
    if (round) roundByKey[key] = round;
  }

  // JUST MISSED data is fetched client-side from /api/just-missed (cacheable
  // Ajax) — keeping the WEC live-component fetch off this render is what lets
  // /app stay statically generated / edge-cached. See HomeContent.

  return (
    <div className="max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <HomeContent
        items={homeItems}
        news={news}
        weatherByUid={weatherByUid}
        roundByKey={roundByKey}
        serverNow={now.toISOString()}
        upcomingCountBySeries={upcomingCountBySeries}
      />
    </div>
  );
}
