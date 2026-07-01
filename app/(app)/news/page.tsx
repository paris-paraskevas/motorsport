import type { Metadata } from 'next';
import { loadAllSeriesMeta } from '@/lib/series';
import { fetchAggregatedNews } from '@/lib/news';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';
import { NewsPageContent, type NewsPageItem } from './NewsPageContent';

// Same 30-min ISR window as the home wire's fetchAggregatedNews / fetchNews
// (next.revalidate: 1800) so this page reuses the SAME cached upstream RSS
// pulls rather than adding a heavier fetch. Static-render + revalidate keeps it
// edge-cached and user-agnostic; the followed-series filter runs client-side.
export const revalidate = 1800;

const NEWS_TITLE = 'News';
const NEWS_DESCRIPTION =
  'Latest motorsport news across F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more — one aggregated feed, filterable by series.';

// A fuller feed than the home wire's 3-per-series. 10 per configured series,
// deduped by article slug across cross-posts, sorted newest-first upstream.
const PER_SERIES = 10;

export const metadata: Metadata = {
  title: NEWS_TITLE,
  description: NEWS_DESCRIPTION,
  alternates: { canonical: '/news' },
  ...withSocialMeta({
    // The root layout's title.template only applies to the document <title>,
    // not og:title / twitter:title — so pass the full title here.
    title: `${NEWS_TITLE} — Paddock Tracker`,
    description: NEWS_DESCRIPTION,
    path: '/news',
  }),
};

export default async function NewsPage() {
  const [allMeta, rawNews] = await Promise.all([
    loadAllSeriesMeta(),
    fetchAggregatedNews(PER_SERIES),
  ]);

  // Join each aggregated item to its series meta for name/color — same shape
  // and dropping-unknown-slugs guard as app/(app)/app/page.tsx.
  const seriesBySlug = new Map(allMeta.map(m => [m.slug, m]));
  const news: NewsPageItem[] = rawNews.flatMap(item => {
    const meta = seriesBySlug.get(item.seriesSlug);
    if (!meta) return [];
    return [
      {
        title: item.title,
        link: item.link,
        pubDate: item.pubDate.toISOString(),
        description: item.description,
        seriesSlug: item.seriesSlug,
        seriesName: meta.name,
        seriesColor: meta.color,
      },
    ];
  });

  const now = new Date();

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'News', url: `${SITE_URL}/news` },
        ])}
      />
      <header className="mb-6 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
            News<span className="text-brand">.</span>
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Latest stories across the grid — filter by series.
          </p>
        </div>
      </header>

      <NewsPageContent news={news} serverNow={now.toISOString()} />
    </div>
  );
}
