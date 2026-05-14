import { loadAllSeries } from '@/lib/series';
import { HomeContent } from '@/components/HomeContent';
import { LatestNewsSection } from '@/components/LatestNewsSection';
import { fetchAggregatedNews } from '@/lib/news';

export const dynamic = 'force-dynamic';

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

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <HomeContent items={upcoming} />
      <LatestNewsSection items={news} />
    </div>
  );
}
