'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Session } from '@/lib/types';
import { getFollowedSeries } from '@/lib/follow';
import { groupByDay } from '@/lib/group';
import { NextSessionCard } from './NextSessionCard';
import { SessionCard } from './SessionCard';
import { DayHeader } from './DayHeader';

interface HomeItem {
  session: Session;
  color: string;
  seriesName: string;
  seriesSlug: string;
}

interface NewsItemSerialized {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
  seriesSlug: string;
  seriesName: string;
  seriesColor: string;
}

type Tab = 'news' | 'upcoming';

const UPCOMING_LIMIT = 24;
const NEWS_LIMIT = 8;
const TAB_KEY = 'paddock:home-tab';

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

export function HomeContent({
  items,
  news,
}: {
  items: HomeItem[];
  news: NewsItemSerialized[];
}) {
  const [followed, setFollowed] = useState<string[] | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<Tab>('news');

  useEffect(() => {
    setFollowed(getFollowedSeries());
    try {
      const stored = window.localStorage.getItem(TAB_KEY);
      if (stored === 'upcoming' || stored === 'news') setTab(stored);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const setTabPersistent = (t: Tab) => {
    setTab(t);
    try {
      window.localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
  };

  const filteredSessions =
    hydrated && followed !== null
      ? items.filter(i => followed.includes(i.seriesSlug))
      : items;

  const filteredNews =
    hydrated && followed !== null
      ? news.filter(n => followed.includes(n.seriesSlug))
      : news;

  const hero = filteredSessions[0];
  const remaining = filteredSessions.slice(1, 1 + UPCOMING_LIMIT);

  const colorByUid: Record<string, string> = {};
  remaining.forEach(i => {
    colorByUid[i.session.uid] = i.color;
  });
  const byDay = groupByDay(remaining.map(i => i.session));

  const topNews = filteredNews.slice(0, NEWS_LIMIT);

  const isEmptyFromFilter =
    hydrated && followed !== null && followed.length < items.length;

  return (
    <>
      {hero ? (
        <NextSessionCard
          session={hero.session}
          color={hero.color}
          seriesName={hero.seriesName}
          seriesSlug={hero.seriesSlug}
        />
      ) : (
        <div className="mb-8 p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-500 text-sm">
          {isEmptyFromFilter ? (
            <>
              No upcoming sessions in your followed series.{' '}
              <Link
                href="/settings"
                className="text-zinc-300 underline underline-offset-2 hover:text-zinc-100"
              >
                Manage
              </Link>
              .
            </>
          ) : (
            'Nothing scheduled yet.'
          )}
        </div>
      )}

      {/* Tab control */}
      <div
        className="inline-flex p-1 bg-zinc-900/60 border border-zinc-800 rounded-full mb-4"
        role="tablist"
        aria-label="Home content"
      >
        <TabButton
          active={tab === 'news'}
          onClick={() => setTabPersistent('news')}
        >
          News
        </TabButton>
        <TabButton
          active={tab === 'upcoming'}
          onClick={() => setTabPersistent('upcoming')}
        >
          Upcoming
        </TabButton>
      </div>

      {tab === 'news' && (
        <section>
          {topNews.length === 0 ? (
            <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-8 text-center">
              <div className="text-zinc-300 text-base font-medium mb-1">No news yet</div>
              <div className="text-zinc-500 text-sm">
                {isEmptyFromFilter
                  ? 'No recent stories from your followed series.'
                  : 'Latest stories unavailable right now.'}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {topNews.map(item => {
                const pubDate = new Date(item.pubDate);
                return (
                  <a
                    key={item.link}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-2xl bg-zinc-900/30 border border-zinc-800/60 p-4 transition-all hover:bg-zinc-900/70 hover:border-zinc-700"
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
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
              <div className="pt-2 text-[10px] uppercase tracking-[0.14em] text-zinc-600 text-center">
                Source: motorsport.com
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'upcoming' && (
        <section>
          {byDay.length === 0 ? (
            <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-8 text-center">
              <div className="text-zinc-300 text-base font-medium mb-1">
                Nothing scheduled
              </div>
              <div className="text-zinc-500 text-sm">
                {isEmptyFromFilter ? (
                  <>
                    No upcoming sessions in your followed series.{' '}
                    <Link
                      href="/settings"
                      className="text-zinc-300 underline underline-offset-2 hover:text-zinc-100"
                    >
                      Manage
                    </Link>
                    .
                  </>
                ) : (
                  'Nothing in the next window across the configured series.'
                )}
              </div>
            </div>
          ) : (
            byDay.map(day => (
              <div key={day.label} className="mb-3">
                <DayHeader label={day.label} count={day.sessions.length} />
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {day.sessions.map(s => (
                    <SessionCard
                      key={`${s.seriesSlug}-${s.uid}`}
                      session={s}
                      color={colorByUid[s.uid]}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`text-xs font-semibold uppercase tracking-[0.14em] px-4 py-1.5 rounded-full transition-colors ${
        active
          ? 'bg-zinc-100 text-zinc-950'
          : 'text-zinc-400 hover:text-zinc-100'
      }`}
    >
      {children}
    </button>
  );
}
