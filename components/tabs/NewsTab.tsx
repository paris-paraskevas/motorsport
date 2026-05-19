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
      <div className="rounded-2xl bg-surface/40 border border-border/60 p-6 md:p-8 text-center">
        <div className="text-text text-base font-medium mb-1">News</div>
        <div className="text-text-faint text-sm mb-5 max-w-xs mx-auto">
          {hasFeed
            ? 'Latest stories unavailable right now.'
            : `No news feed configured for ${series.meta.name}.`}
        </div>
        {officialSite && (
          <a
            href={officialSite}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-3 py-1.5 transition-colors duration-(--duration-fast)"
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
      {items.map(item => {
        const excerpt = item.description
          ? item.description.length > 120
            ? item.description.slice(0, 117).trimEnd() + '…'
            : item.description
          : null;
        return (
          <a
            key={item.link}
            href={item.link}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="group block rounded-2xl bg-surface/40 border border-border/60 p-4 md:p-5 transition-all duration-(--duration-fast) hover:bg-surface hover:border-border-strong"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-text text-base md:text-lg font-semibold leading-tight tracking-tight">
                {item.title}
              </h3>
              <ExternalLink
                size={14}
                className="text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast) shrink-0 mt-1"
              />
            </div>
            {excerpt && (
              <p className="text-sm text-text-muted leading-relaxed line-clamp-3">
                {excerpt}
              </p>
            )}
            <div className="mt-3 text-[11px] uppercase tracking-[0.14em] text-text-faint font-semibold font-mono">
              <time dateTime={item.pubDate.toISOString()}>
                {relativeAgo(item.pubDate)}
              </time>{' '}
              · Motorsport.com
            </div>
          </a>
        );
      })}
      <div className="pt-2 text-xs text-text-faint text-center">
        Source:{' '}
        <a
          href="https://www.motorsport.com/"
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
        >
          motorsport.com ↗
        </a>
      </div>
    </div>
  );
}
