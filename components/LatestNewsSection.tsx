'use client';
import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { getFollowedSeries } from '@/lib/follow';

interface NewsItemSerialized {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  seriesSlug: string;
  seriesName: string;
  seriesColor: string;
}

const TOP_N = 5;

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

export function LatestNewsSection({ items }: { items: NewsItemSerialized[] }) {
  const [followed, setFollowed] = useState<string[] | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFollowed(getFollowedSeries());
    setHydrated(true);
  }, []);

  const filtered =
    hydrated && followed !== null
      ? items.filter(i => followed.includes(i.seriesSlug))
      : items;

  const top = filtered.slice(0, TOP_N);

  if (top.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xs uppercase tracking-[0.14em] text-zinc-500 font-semibold mb-3">
        Latest news
      </h2>

      <div className="space-y-2">
        {top.map(item => {
          const pubDate = new Date(item.pubDate);
          return (
            <a
              key={item.link}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-2xl bg-zinc-900/30 border border-zinc-800/60 p-4 transition-all hover:bg-zinc-900/70 hover:border-zinc-700"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.seriesColor }}
                />
                <span
                  className="text-[10px] uppercase tracking-[0.14em] font-semibold"
                  style={{ color: item.seriesColor }}
                >
                  {item.seriesName}
                </span>
                <span className="text-zinc-700">·</span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 font-medium">
                  {relativeAgo(pubDate)}
                </span>
                <ExternalLink
                  size={12}
                  className="text-zinc-600 group-hover:text-zinc-300 transition-colors ml-auto shrink-0"
                />
              </div>
              <h3 className="text-zinc-100 text-sm font-semibold leading-snug tracking-tight">
                {item.title}
              </h3>
            </a>
          );
        })}
      </div>

      <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-zinc-600 text-center">
        Source: motorsport.com
      </div>
    </section>
  );
}
