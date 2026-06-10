'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import type { Session } from '@/lib/types';
import type { DailyWeather } from '@/lib/weather';
import { useFollowedSeries } from '@/lib/useFollowedSeries';
import { groupByDay } from '@/lib/group';
import { formatRelative } from '@/lib/date';
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
const NEWS_LIMIT = 12;
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
  weatherByUid,
  roundByKey,
}: {
  items: HomeItem[];
  news: NewsItemSerialized[];
  weatherByUid?: Record<string, DailyWeather>;
  roundByKey?: Record<string, number>;
}) {
  const roundFor = (slug: string, uid: string): number | undefined =>
    roundByKey?.[`${slug}:${uid}`];
  const { followed, hydrated } = useFollowedSeries();
  const [tab, setTab] = useState<Tab>('news');
  const [newsFilter, setNewsFilter] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TAB_KEY);
      if (stored === 'upcoming' || stored === 'news') setTab(stored);
    } catch {
      /* ignore */
    }
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

  const now = new Date();
  const liveItems = filteredSessions.filter(
    i => !i.session.dateOnly && i.session.start <= now && now <= i.session.end,
  );
  const upcomingItems = filteredSessions.filter(i =>
    i.session.dateOnly ? i.session.end > now : i.session.start > now,
  );

  const hero = upcomingItems[0];
  const remaining = upcomingItems.slice(1, 1 + UPCOMING_LIMIT);

  const colorByUid: Record<string, string> = {};
  remaining.forEach(i => {
    colorByUid[i.session.uid] = i.color;
  });
  const byDay = groupByDay(remaining.map(i => i.session));

  const seriesWithNews: Array<{ slug: string; name: string; color: string; count: number }> = [];
  {
    const seenSlugs = new Set<string>();
    for (const n of filteredNews) {
      if (!seenSlugs.has(n.seriesSlug)) {
        seenSlugs.add(n.seriesSlug);
        seriesWithNews.push({
          slug: n.seriesSlug,
          name: n.seriesName,
          color: n.seriesColor,
          count: filteredNews.filter(x => x.seriesSlug === n.seriesSlug).length,
        });
      }
    }
  }
  const newsForTab = newsFilter
    ? filteredNews.filter(n => n.seriesSlug === newsFilter)
    : filteredNews;
  const topNews = newsForTab.slice(0, NEWS_LIMIT);

  const isEmptyFromFilter =
    hydrated && followed !== null && followed.length < items.length;

  return (
    <>
      <h1 className="sr-only">
        Paddock Tracker — live motorsport schedule and news across F1, MotoGP, WEC,
        Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more
      </h1>
      {liveItems.length > 0 && (
        <section className="mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="relative inline-flex">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-red-500" />
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-red-300">
              Live now
            </span>
          </div>
          <div className="space-y-2">
            {liveItems.map(item => {
              const liveRound = roundFor(item.seriesSlug, item.session.uid);
              const liveHref = liveRound
                ? `/series/${item.seriesSlug}/weekend/${liveRound}`
                : `/series/${item.seriesSlug}?tab=calendar`;
              return (
              <Link
                key={`${item.seriesSlug}-${item.session.uid}`}
                href={liveHref}
                className="group block relative overflow-hidden rounded-2xl border border-red-500/30 bg-surface transition-all duration-(--duration-fast) hover:bg-surface-elevated hover:border-red-500/50"
              >
                <div
                  className="absolute inset-0 opacity-[0.10] pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at 0% 0%, ${item.color} 0%, transparent 55%)`,
                  }}
                />
                <div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{ backgroundColor: item.color, opacity: 0.6 }}
                />
                <div className="relative p-4 md:p-5">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span
                      className="text-[10px] uppercase tracking-[0.16em] font-semibold"
                      style={{ color: item.color }}
                    >
                      {item.seriesName}
                    </span>
                    <span className="text-border-strong">·</span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted font-medium font-mono">
                      started {formatRelative(item.session.start)}
                    </span>
                  </div>
                  <div className="text-text text-lg md:text-xl font-bold tracking-tight">
                    {item.session.title}
                  </div>
                  {item.session.location && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-text-faint">
                      <MapPin size={12} className="text-text-faint" />
                      <span>{item.session.location.split(',')[0].trim()}</span>
                    </div>
                  )}
                </div>
              </Link>
              );
            })}
          </div>
        </section>
      )}

      {hero ? (
        <NextSessionCard
          session={hero.session}
          color={hero.color}
          seriesName={hero.seriesName}
          seriesSlug={hero.seriesSlug}
          weather={weatherByUid?.[hero.session.uid]}
          round={roundFor(hero.seriesSlug, hero.session.uid)}
        />
      ) : liveItems.length > 0 ? null : (
        <div className="mb-8 p-5 rounded-xl bg-surface border border-border text-text-faint text-sm">
          {isEmptyFromFilter ? (
            <>
              No upcoming sessions in your followed series.{' '}
              <Link
                href="/settings"
                className="text-text-muted underline underline-offset-2 hover:text-text"
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
        className="inline-flex p-1 bg-surface border border-border rounded-full mb-4"
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
          {seriesWithNews.length > 1 && (
            <div className="mb-3 -mx-1 px-1 flex gap-1.5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setNewsFilter(null)}
                className={`shrink-0 text-[11px] uppercase tracking-[0.12em] font-semibold px-3 py-1.5 rounded-full border transition-colors duration-(--duration-fast) ${
                  newsFilter === null
                    ? 'bg-text text-bg border-text'
                    : 'text-text-muted border-border hover:text-text hover:border-border-strong'
                }`}
              >
                All
                <span className="ml-1.5 tabular-nums font-mono opacity-70">{filteredNews.length}</span>
              </button>
              {seriesWithNews.map(s => {
                const active = newsFilter === s.slug;
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => setNewsFilter(s.slug)}
                    className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold px-3 py-1.5 rounded-full border transition-colors duration-(--duration-fast) ${
                      active
                        ? 'text-zinc-950 border-transparent'
                        : 'text-text-muted border-border hover:text-text hover:border-border-strong'
                    }`}
                    style={active ? { backgroundColor: s.color } : undefined}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: active ? '#0a0a0a' : s.color }}
                    />
                    {s.name}
                    <span className="tabular-nums font-mono opacity-70">{s.count}</span>
                  </button>
                );
              })}
            </div>
          )}
          {topNews.length === 0 ? (
            <div className="rounded-2xl bg-surface/60 border border-border p-8 text-center">
              <div className="text-text text-base font-medium mb-1">No news yet</div>
              <div className="text-text-faint text-sm">
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
                    className="group block rounded-2xl bg-surface/40 border border-border/60 p-4 transition-all duration-(--duration-fast) hover:bg-surface hover:border-border-strong"
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
                      <span className="text-border-strong">·</span>
                      <span className="text-[10px] uppercase tracking-[0.12em] text-text-faint font-medium font-mono">
                        {relativeAgo(pubDate)}
                      </span>
                      <ExternalLink
                        size={12}
                        className="text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast) ml-auto shrink-0"
                      />
                    </div>
                    <h3 className="text-text text-sm font-semibold leading-snug tracking-tight">
                      {item.title}
                    </h3>
                  </a>
                );
              })}
              <div className="pt-2 text-[10px] uppercase tracking-[0.14em] text-text-faint text-center">
                Source: motorsport.com
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'upcoming' && (
        <section>
          {byDay.length === 0 ? (
            <div className="rounded-2xl bg-surface/60 border border-border p-8 text-center">
              <div className="text-text text-base font-medium mb-1">
                Nothing scheduled
              </div>
              <div className="text-text-faint text-sm">
                {isEmptyFromFilter ? (
                  <>
                    No upcoming sessions in your followed series.{' '}
                    <Link
                      href="/settings"
                      className="text-text-muted underline underline-offset-2 hover:text-text"
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
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {day.sessions.map(s => (
                    <SessionCard
                      key={`${s.seriesSlug}-${s.uid}`}
                      session={s}
                      color={colorByUid[s.uid]}
                      round={roundFor(s.seriesSlug, s.uid)}
                      weather={weatherByUid?.[s.uid]}
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
      className={`text-xs font-semibold uppercase tracking-[0.14em] px-4 py-1.5 rounded-full transition-colors duration-(--duration-fast) ${
        active
          ? 'bg-text text-bg'
          : 'text-text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
