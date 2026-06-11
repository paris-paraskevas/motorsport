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

// Same wire-row language as the home's PADDOCK WIRE (operator: series tabs
// must mirror the home UI) — meta line, headline, hard rules. The series
// identity is the page's, so no per-row series chip; the excerpt stays
// because this tab is the series' dedicated reading surface.
export async function NewsTab({ series }: { series: Series }) {
  const slug = series.meta.slug;
  const hasFeed = NEWS_SLUG_MAP[slug] !== null && NEWS_SLUG_MAP[slug] !== undefined;
  const items = hasFeed ? await fetchNews(slug) : [];

  if (items.length === 0) {
    const officialSite = series.meta.officialSite;
    return (
      <div className="border border-border bg-surface/40 p-6 md:p-8 text-center">
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
            className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-text-muted hover:text-text border border-border hover:border-border-strong px-3 py-1.5 transition-colors duration-(--duration-fast)"
          >
            Visit official site
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="border-y border-border divide-y divide-border">
        {items.map(item => {
          const excerpt = item.description
            ? item.description.length > 140
              ? item.description.slice(0, 137).trimEnd() + '…'
              : item.description
            : null;
          return (
            <a
              key={item.link}
              href={item.link}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="group block py-3.5 px-2 -mx-2 transition-colors duration-(--duration-fast) hover:bg-surface"
            >
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <time
                  dateTime={item.pubDate.toISOString()}
                  className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint tnum shrink-0"
                >
                  {relativeAgo(item.pubDate)}
                </time>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint shrink-0">
                  · motorsport.com
                </span>
                <ExternalLink
                  size={12}
                  className="ml-auto shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)"
                />
              </div>
              <h3 className="text-[15px] md:text-base font-semibold leading-snug tracking-tight text-text">
                {item.title}
              </h3>
              {excerpt && (
                <p className="mt-1 text-sm text-text-muted leading-relaxed line-clamp-2">
                  {excerpt}
                </p>
              )}
            </a>
          );
        })}
      </div>
      <div className="pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
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
