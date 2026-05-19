import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { HomeContent } from '@/components/HomeContent';
import { JsonLd } from '@/components/JsonLd';
import { organizationLd, websiteLd } from '@/lib/json-ld';
import { fetchAggregatedNews } from '@/lib/news';
import { matchCircuit } from '@/lib/circuits';
import { fetchWeather, forecastFor, type DailyWeather, type WeatherForecast } from '@/lib/weather';
import { buildRoundLookupAcrossSeries } from '@/lib/weekend';

export const revalidate = 300;

export const metadata: Metadata = {
  title: {
    absolute: 'Paddock — Live F1, MotoGP, WEC, IndyCar & NASCAR schedule',
  },
  description:
    'Live motorsport schedule and news across F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more — in your local time.',
  alternates: { canonical: '/' },
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
      })),
    )
    .sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  const upcoming = flat.filter(x => x.session.end >= now);

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

  const weatherByUid = await weatherForSessions(upcoming);

  const roundLookup = buildRoundLookupAcrossSeries(all, now);
  const roundByKey: Record<string, number> = {};
  for (const [k, v] of roundLookup) roundByKey[k] = v;

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd()} />
      <HomeContent
        items={upcoming}
        news={news}
        weatherByUid={weatherByUid}
        roundByKey={roundByKey}
      />
    </div>
  );
}
