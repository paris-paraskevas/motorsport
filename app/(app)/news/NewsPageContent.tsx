'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useFollowedSeries } from '@/lib/useFollowedSeries';

export interface NewsPageItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  seriesSlug: string;
  seriesName: string;
  seriesColor: string;
}

// How many rows to reveal per "load more" press, and the initial cap. The feed
// ships fuller than the home wire (fetchAggregatedNews with a higher perSeries),
// so we paginate client-side rather than paint one very long list.
const PAGE_SIZE = 20;

/* ── Filter persistence ───────────────────────────────────────────────────
   Shares the home wire's storage key so a series picked on either surface
   re-opens on the other. Read returns null (= "All", the SSR default) on the
   server and for any absent/malformed value, so the first render matches the
   SSR default and the stored slug is adopted after mount — no hydration
   mismatch. Mirrors HomeContent's readStoredNewsFilter. */
const NEWS_FILTER_KEY = 'paddock:news-filter';

function readStoredNewsFilter(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(NEWS_FILTER_KEY);
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

function writeStoredNewsFilter(slug: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (slug) window.localStorage.setItem(NEWS_FILTER_KEY, slug);
    else window.localStorage.removeItem(NEWS_FILTER_KEY);
  } catch {
    /* quota or denied — silently ignore */
  }
}

/* Hydration-safe relative time: first render uses the SERVER instant (serverNow
   prop) so SSR HTML and the first client render are byte-identical no matter how
   stale the ISR payload is; after mount we swap to the device clock and tick
   once a minute. Same engine as HomeContent's useNow. */
function useNow(serverNow: string): Date {
  const [now, setNow] = useState(() => new Date(serverNow));
  useEffect(() => {
    const sync = () => setNow(new Date());
    const t = setTimeout(sync, 0);
    const id = setInterval(sync, 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);
  return now;
}

function relativeAgo(date: Date, now: Date): string {
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function NewsPageContent({
  news,
  serverNow,
}: {
  news: NewsPageItem[];
  serverNow: string;
}) {
  const now = useNow(serverNow);
  const { followed, hydrated } = useFollowedSeries();

  // Starts at the SSR default ("All" = null); the persisted slug is adopted
  // after mount so the hydration render matches the server HTML.
  const [newsFilter, setNewsFilter] = useState<string | null>(null);
  useEffect(() => {
    const stored = readStoredNewsFilter();
    if (stored !== null) setNewsFilter(stored);
  }, []);
  const selectNewsFilter = (slug: string | null) => {
    setNewsFilter(slug);
    writeStoredNewsFilter(slug);
    setVisible(PAGE_SIZE); // a filter change resets the reveal window
  };

  const [visible, setVisible] = useState(PAGE_SIZE);

  // Honour the followed-series filter for signed-in users exactly as the home
  // does — until prefs resolve on the client, render the full feed (this page
  // is not personalized at SSR), then narrow. `followed === null` = follow-all.
  const filteredNews =
    hydrated && followed !== null
      ? news.filter(n => followed.includes(n.seriesSlug))
      : news;

  // Series present in the (followed-filtered) feed, in first-seen order, with
  // per-series counts — mirrors HomeContent's seriesWithNews.
  const seriesWithNews: Array<{ slug: string; name: string; color: string; count: number }> = [];
  {
    const seen = new Set<string>();
    for (const n of filteredNews) {
      if (!seen.has(n.seriesSlug)) {
        seen.add(n.seriesSlug);
        seriesWithNews.push({
          slug: n.seriesSlug,
          name: n.seriesName,
          color: n.seriesColor,
          count: filteredNews.filter(x => x.seriesSlug === n.seriesSlug).length,
        });
      }
    }
  }

  // A persisted filter is honoured only while its series is still in the feed;
  // if it dropped out we fall back to "All" so a stale stored slug can't strand
  // the page on an empty, unresettable view.
  const effectiveNewsFilter =
    newsFilter && seriesWithNews.some(s => s.slug === newsFilter) ? newsFilter : null;

  // Dedupe by link before slicing: motorsport.com cross-posts the same story to
  // multiple series feeds. The aggregate is already deduped by article slug
  // server-side, but a link-level guard is cheap and matches the home wire.
  const newsForView = effectiveNewsFilter
    ? filteredNews.filter(n => n.seriesSlug === effectiveNewsFilter)
    : filteredNews;
  const seenLinks = new Set<string>();
  const deduped = newsForView.filter(n => (seenLinks.has(n.link) ? false : seenLinks.add(n.link)));
  const rows = deduped.slice(0, visible);
  const hasMore = deduped.length > rows.length;

  const isEmptyFromFilter = hydrated && followed !== null && followed.length === 0;

  return (
    <>
      {seriesWithNews.length > 1 && (
        <div className="mb-5 -mx-1 px-1 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => selectNewsFilter(null)}
            className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] font-semibold px-3 py-1.5 border transition-colors duration-(--duration-fast) ${
              effectiveNewsFilter === null
                ? 'bg-text text-bg border-text'
                : 'text-text-muted border-border hover:text-text hover:border-border-strong'
            }`}
          >
            All
            <span className="ml-1.5 tnum opacity-70">{deduped.length}</span>
          </button>
          {seriesWithNews.map(s => {
            const active = effectiveNewsFilter === s.slug;
            return (
              <button
                key={s.slug}
                type="button"
                onClick={() => selectNewsFilter(s.slug)}
                className={`shrink-0 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] font-semibold px-3 py-1.5 border transition-colors duration-(--duration-fast) ${
                  active
                    ? 'text-black border-transparent'
                    : 'text-text-muted border-border hover:text-text hover:border-border-strong'
                }`}
                style={active ? { backgroundColor: s.color } : undefined}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: active ? '#07070a' : s.color }}
                />
                {s.name}
                <span className="tnum opacity-70">{s.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="border border-border bg-surface/40 p-6 md:p-8 text-center">
          <div className="text-text text-base font-medium mb-1">No stories</div>
          <div className="text-text-faint text-sm mb-5 max-w-xs mx-auto">
            {isEmptyFromFilter
              ? 'You are not following any series — follow a few to see their news here.'
              : 'Latest stories are unavailable right now.'}
          </div>
          {isEmptyFromFilter ? (
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-text-muted hover:text-text border border-border hover:border-border-strong px-3 py-1.5 transition-colors duration-(--duration-fast)"
            >
              Manage followed series
            </Link>
          ) : (
            // Mirrors NewsTab's empty affordance — link out to the source when
            // the feed itself is dry.
            <a
              href="https://www.motorsport.com/"
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-text-muted hover:text-text border border-border hover:border-border-strong px-3 py-1.5 transition-colors duration-(--duration-fast)"
            >
              Visit official site
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="border-y border-border divide-y divide-border">
            {rows.map(item => {
              const pubDate = new Date(item.pubDate);
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
                      dateTime={pubDate.toISOString()}
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint tnum shrink-0"
                    >
                      {relativeAgo(pubDate, now)}
                    </time>
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.seriesColor }}
                    />
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold shrink-0"
                      style={{ color: item.seriesColor }}
                    >
                      {item.seriesName}
                    </span>
                    <ExternalLink
                      size={12}
                      className="ml-auto shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)"
                    />
                  </div>
                  <h2 className="text-[15px] md:text-base font-semibold leading-snug tracking-tight text-text">
                    {item.title}
                  </h2>
                  {excerpt && (
                    <p className="mt-1 text-sm text-text-muted leading-relaxed line-clamp-2">
                      {excerpt}
                    </p>
                  )}
                </a>
              );
            })}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => setVisible(v => v + PAGE_SIZE)}
              className="mt-5 w-full font-mono text-[11px] uppercase tracking-[0.16em] font-semibold text-text-muted hover:text-text border border-border hover:border-border-strong py-2.5 transition-colors duration-(--duration-fast)"
            >
              Load more
              <span className="ml-1.5 tnum opacity-70">{deduped.length - rows.length}</span>
            </button>
          )}

          <div className="pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
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
        </>
      )}
    </>
  );
}
