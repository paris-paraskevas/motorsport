import { ExternalLink } from 'lucide-react';
import { Series } from '@/lib/types';
import { fetchNews, NEWS_SLUG_MAP } from '@/lib/news';

function relativeAgo(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export async function NewsTab({ series }: { series: Series }) {
  const slug = series.meta.slug;
  const hasFeed = NEWS_SLUG_MAP[slug] !== null && NEWS_SLUG_MAP[slug] !== undefined;
  const items = hasFeed ? await fetchNews(slug) : [];

  if (items.length === 0) {
    const officialSite = series.meta.officialSite;
    return (
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-6 md:p-8 text-center">
        <div className="text-zinc-300 text-base font-medium mb-1">News</div>
        <div className="text-zinc-500 text-sm mb-5 max-w-xs mx-auto">
          {hasFeed
            ? 'Latest stories unavailable right now.'
            : `No news feed configured for ${series.meta.name}.`}
        </div>
        {officialSite && (
          <a
            href={officialSite}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 transition-colors"
          >
            Visit official site
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <a
          key={item.link}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="group block rounded-2xl bg-zinc-900/30 border border-zinc-800/60 p-4 md:p-5 transition-all hover:bg-zinc-900/70 hover:border-zinc-700"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-zinc-50 text-base md:text-lg font-semibold leading-tight tracking-tight">
              {item.title}
            </h3>
            <ExternalLink
              size={14}
              className="text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0 mt-1"
            />
          </div>
          {item.description && (
            <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3">
              {item.description}
            </p>
          )}
          <div className="mt-3 text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">
            {relativeAgo(item.pubDate)} · Motorsport.com
          </div>
        </a>
      ))}
      <div className="pt-2 text-xs text-zinc-500 text-center">
        Source:{' '}
        <a
          href="https://www.motorsport.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
        >
          motorsport.com ↗
        </a>
      </div>
    </div>
  );
}
