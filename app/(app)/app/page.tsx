import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { HomeContent } from '@/components/HomeContent';
import { HOME_WEEK_MS, JUST_MISSED_WINDOW_MS } from '@/lib/date';
import { fetchAggregatedNews } from '@/lib/news';
import { matchCircuit } from '@/lib/circuits';
import { fetchWeather, forecastFor, type DailyWeather, type WeatherForecast } from '@/lib/weather';
import { buildRoundLookupAcrossSeries } from '@/lib/weekend';
import { looksLikeRaceSession } from '@/lib/results-ready';
import { fetchLatestPodium, homeResultsSupported, type JustMissedItem } from '@/lib/home-results';
import { loadMedia, highlightForRound } from '@/lib/media';

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

  // JUST MISSED (home v3): latest finished race per series within the recency
  // window. Covered series fetch the authoritative podium (KV-cached,
  // fail-soft) — gated on the series being active in-window so the off-season
  // and the MotoGP fan-out don't fetch needlessly; the result is then kept
  // only if its own race day is in-window. Uncovered series render a link-out
  // from their latest in-window race session. Client filters by followed + caps 3.
  const jmWindowStart = now.getTime() - JUST_MISSED_WINDOW_MS;
  const activeInWindow = new Set<string>();
  for (const x of flat) {
    const end = x.session.end.getTime();
    if (!x.session.dateOnly && end <= now.getTime() && end >= jmWindowStart) {
      activeInWindow.add(x.seriesSlug);
    }
  }
  const justMissed: JustMissedItem[] = [];
  await Promise.all(
    [...activeInWindow].filter(homeResultsSupported).map(async slug => {
      const meta = seriesBySlug.get(slug);
      if (!meta) return;
      const latest = await fetchLatestPodium(slug);
      if (!latest || new Date(latest.date).getTime() < jmWindowStart) return;
      justMissed.push({
        seriesSlug: slug,
        seriesName: meta.name,
        color: meta.color,
        raceName: latest.raceName,
        date: latest.date,
        round: latest.round,
        podium: latest.podium,
        highlight: highlightForRound(await loadMedia(slug), latest.round),
        resultsHref: `/series/${slug}?tab=results`,
      });
    }),
  );
  const uncoveredRecent = new Map<string, (typeof flat)[number]>();
  for (const x of flat) {
    if (homeResultsSupported(x.seriesSlug)) continue;
    const s = x.session;
    if (s.dateOnly || !looksLikeRaceSession(s.title)) continue;
    const end = s.end.getTime();
    if (end > now.getTime() || end < jmWindowStart) continue;
    uncoveredRecent.set(x.seriesSlug, x); // flat ascending → last = most recent
  }
  for (const [slug, x] of uncoveredRecent) {
    const meta = seriesBySlug.get(slug);
    if (!meta) continue;
    justMissed.push({
      seriesSlug: slug,
      seriesName: meta.name,
      color: meta.color,
      raceName: x.session.location?.split(',')[0].trim() || x.session.title,
      date: x.session.end.toISOString(),
      resultsHref: `/series/${slug}?tab=results`,
    });
  }
  justMissed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <HomeContent
        items={homeItems}
        news={news}
        justMissed={justMissed}
        weatherByUid={weatherByUid}
        roundByKey={roundByKey}
        serverNow={now.toISOString()}
        upcomingCountBySeries={upcomingCountBySeries}
      />
    </div>
  );
}
