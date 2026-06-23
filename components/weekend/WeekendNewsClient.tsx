'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

// Client renderer for the News tab — fetches the weekend's news from the cached
// /api/weekend/news only when mounted (i.e. when the tab is first opened), so the
// weekend page render never blocks on fetchNews.
interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
}
interface NewsResponse {
  items: NewsItem[];
  seriesName?: string;
  color?: string;
}

function relativeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return 'just now';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function WeekendNewsClient({ slug, round }: { slug: string; round: number }) {
  const [data, setData] = useState<NewsResponse | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/weekend/news?series=${encodeURIComponent(slug)}&round=${round}`)
      .then(r => r.json())
      .then((d: NewsResponse) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setData({ items: [] });
      });
    return () => {
      active = false;
    };
  }, [slug, round]);

  if (!data) return <div className="h-32 animate-pulse rounded-lg border border-white/10 bg-white/5" aria-hidden="true" />;
  if (data.items.length === 0) return <p className="font-mono text-sm text-text-muted">No news this weekend.</p>;

  const color = data.color ?? '#888888';
  const seriesName = data.seriesName ?? '';
  return (
    <div className="divide-y divide-border/60">
      {data.items.map(item => (
        <a
          key={item.link}
          href={item.link}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="group block py-3 transition-colors duration-(--duration-fast) hover:bg-surface/40"
        >
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>
              {seriesName}
            </span>
            <span className="text-border-strong">·</span>
            <time dateTime={item.pubDate} className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-faint">
              {relativeAgo(item.pubDate)}
            </time>
            <ExternalLink size={12} className="ml-auto shrink-0 text-text-faint transition-colors duration-(--duration-fast) group-hover:text-text-muted" />
          </div>
          <h3 className="text-sm font-semibold leading-snug tracking-tight text-text">{item.title}</h3>
        </a>
      ))}
      <div className="mt-2 pt-2 text-center text-[10px] uppercase tracking-[0.14em] text-text-faint">Source: motorsport.com</div>
    </div>
  );
}
