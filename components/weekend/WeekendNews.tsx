import { ExternalLink } from 'lucide-react';
import type { Series, Weekend } from '@/lib/types';
import { fetchNews, NEWS_SLUG_MAP } from '@/lib/news';
import { weekendStartEnd } from '@/lib/weekend';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_BEFORE_DAYS = 7;
const WINDOW_AFTER_DAYS = 1;
const MAX_ITEMS = 8;

function relativeAgo(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'just now';
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export async function WeekendNews({
  series,
  weekend,
}: {
  series: Series;
  weekend: Weekend;
}) {
  if (NEWS_SLUG_MAP[series.meta.slug] == null) return null;

  const items = await fetchNews(series.meta.slug);
  if (items.length === 0) return null;

  const { start, end } = weekendStartEnd(weekend);
  const from = new Date(start.getTime() - WINDOW_BEFORE_DAYS * DAY_MS);
  const to = new Date(end.getTime() + WINDOW_AFTER_DAYS * DAY_MS);

  const inWindow = items
    .filter(i => i.pubDate >= from && i.pubDate <= to)
    .slice(0, MAX_ITEMS);

  if (inWindow.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-wider text-text-faint mb-3 font-semibold">News this weekend</h2>
      <div className="space-y-2">
        {inWindow.map(item => (
          <a
            key={item.link}
            href={item.link}
            target="_blank"
            rel="nofollow noopener noreferrer"
            className="group block rounded-2xl bg-surface/40 border border-border/60 p-4 transition-all duration-(--duration-fast) hover:bg-surface hover:border-border-strong"
          >
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: series.meta.color }}
              />
              <span
                className="text-[10px] uppercase tracking-[0.14em] font-semibold"
                style={{ color: series.meta.color }}
              >
                {series.meta.name}
              </span>
              <span className="text-border-strong">·</span>
              <time
                dateTime={item.pubDate.toISOString()}
                className="text-[10px] uppercase tracking-[0.12em] text-text-faint font-medium font-mono"
              >
                {relativeAgo(item.pubDate)}
              </time>
              <ExternalLink
                size={12}
                className="text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast) ml-auto shrink-0"
              />
            </div>
            <h3 className="text-text text-sm font-semibold leading-snug tracking-tight">
              {item.title}
            </h3>
          </a>
        ))}
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-text-faint text-center">
        Source: motorsport.com
      </div>
    </section>
  );
}
