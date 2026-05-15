import { loadAllSeries } from '@/lib/series';
import { HomeContent } from '@/components/HomeContent';
import { fetchAggregatedNews } from '@/lib/news';
import { matchCircuit } from '@/lib/circuits';
import { fetchWeather, forecastFor, type DailyWeather } from '@/lib/weather';

export const dynamic = 'force-dynamic';

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function weatherForSessions(
  candidates: Array<{ session: { uid: string; start: Date; location?: string; title: string } }>,
): Promise<Record<string, DailyWeather>> {
  // Look up circuit + weather for up to the next 5 sessions, deduped by circuit.
  const top = candidates.slice(0, 5);
  const fetched = new Map<string, DailyWeather | null>(); // key: lat,lon
  const result: Record<string, DailyWeather> = {};

  for (const item of top) {
    const c = await matchCircuit(item.session.location, item.session.title);
    if (!c) continue;
    const key = `${c.lat},${c.lon}`;
    let daily = fetched.get(key);
    if (daily === undefined) {
      const forecast = await fetchWeather(c.lat, c.lon);
      daily = forecast ? forecastFor(forecast, toIsoDate(item.session.start)) : null;
      fetched.set(key, daily);
    }
    if (daily) {
      result[item.session.uid] = daily;
    }
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

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <HomeContent items={upcoming} news={news} weatherByUid={weatherByUid} />
    </div>
  );
}
