'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, ExternalLink, MapPin } from 'lucide-react';
import type { Session } from '@/lib/types';
import type { DailyWeather } from '@/lib/weather';
import { weatherLabel } from '@/lib/weather';
import { useFollowedSeries } from '@/lib/useFollowedSeries';
import { groupByDay } from '@/lib/group';
import { formatRelative } from '@/lib/date';

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

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NEWS_LIMIT = 14;

/* ── Hydration-safe time engine ─────────────────────────────────────────
   Every time-derived string on this page renders from `now`, which starts
   as the SERVER's render instant (serverNow prop). SSR HTML and the first
   client render are therefore byte-identical no matter how stale the ISR
   payload is — this kills the React #418 source the 0.13.0 audit traced
   to relative-time labels drifting against up-to-5-min-stale HTML. After
   mount we swap to the device clock and tick once a minute; `clock` also
   gates the GMT → device-local timezone upgrade. */
function useNow(serverNow: string): { now: Date; clock: boolean } {
  const [now, setNow] = useState(() => new Date(serverNow));
  const [clock, setClock] = useState(false);
  useEffect(() => {
    const sync = () => {
      setNow(new Date());
      setClock(true);
    };
    const t = setTimeout(sync, 0);
    const id = setInterval(sync, 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);
  return { now, clock };
}

function timeHM(d: Date, local: boolean): string {
  return new Intl.DateTimeFormat('en-GB', {
    ...(local ? {} : { timeZone: 'UTC' }),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function tzShort(now: Date, clock: boolean): string {
  if (!clock) return 'GMT';
  return (
    new Intl.DateTimeFormat('en-GB', { timeZoneName: 'short' })
      .formatToParts(now)
      .find(p => p.type === 'timeZoneName')?.value ?? 'local'
  );
}

function elapsedLabel(start: Date, now: Date): string {
  const m = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
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

function sameUTCDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

/* Live countdown — owns its own 1s tick so the rest of the page only
   re-renders on the minute. First render derives from the server instant
   (deterministic), the tick takes over after mount. */
function Countdown({ to, initialNow }: { to: Date; initialNow: Date }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);
  const ms = Math.max(0, to.getTime() - now.getTime());
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor(ms / 3_600_000) % 24;
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1_000) % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="font-mono tnum tracking-tight">
      {d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`}
    </span>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-border pb-2">
      <h2 className="font-display text-xl font-extrabold uppercase tracking-wide text-text">
        {title}
        <span className="text-brand">.</span>
      </h2>
      {sub && (
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          {sub}
        </span>
      )}
    </div>
  );
}

export function HomeContent({
  items,
  news,
  weatherByUid,
  roundByKey,
  serverNow,
}: {
  items: HomeItem[];
  news: NewsItemSerialized[];
  weatherByUid?: Record<string, DailyWeather>;
  roundByKey?: Record<string, number>;
  serverNow: string;
}) {
  const { now, clock } = useNow(serverNow);
  const tz = tzShort(now, clock);
  const roundFor = (slug: string, uid: string): number | undefined =>
    roundByKey?.[`${slug}:${uid}`];
  const hrefFor = (item: HomeItem): string => {
    const round = roundFor(item.seriesSlug, item.session.uid);
    return round
      ? `/series/${item.seriesSlug}/weekend/${round}`
      : `/series/${item.seriesSlug}?tab=calendar`;
  };
  const { followed, hydrated } = useFollowedSeries();
  const [newsFilter, setNewsFilter] = useState<string | null>(null);

  const filteredSessions =
    hydrated && followed !== null
      ? items.filter(i => followed.includes(i.seriesSlug))
      : items;
  const filteredNews =
    hydrated && followed !== null
      ? news.filter(n => followed.includes(n.seriesSlug))
      : news;

  const liveItems = filteredSessions.filter(
    i => !i.session.dateOnly && i.session.start <= now && now <= i.session.end,
  );
  const upcomingItems = filteredSessions.filter(i =>
    i.session.dateOnly ? i.session.end > now : i.session.start > now,
  );
  const next = upcomingItems[0];

  const weekItems = upcomingItems.filter(
    i => i.session.start.getTime() - now.getTime() <= WEEK_MS,
  );
  const beyondCount = upcomingItems.length - weekItems.length;

  const itemByUid = new Map(weekItems.map(i => [i.session.uid, i]));
  const byDay = groupByDay(weekItems.map(i => i.session));

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
  const topNews = (
    newsFilter ? filteredNews.filter(n => n.seriesSlug === newsFilter) : filteredNews
  ).slice(0, NEWS_LIMIT);

  const isEmptyFromFilter =
    hydrated && followed !== null && followed.length < items.length;

  const nextWeather = next ? weatherByUid?.[next.session.uid] : undefined;
  const nextW = nextWeather ? weatherLabel(nextWeather.weatherCode) : null;

  return (
    <>
      <h1 className="sr-only">
        Paddock Tracker — live motorsport schedule and news across F1, MotoGP, WEC,
        Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more
      </h1>

      {/* ── Chyron — the broadcast strip. Live takes over; otherwise the next
             session with a ticking countdown. ── */}
      <section
        aria-label={liveItems.length > 0 ? 'Live now' : 'Up next'}
        className="mb-8 border-y border-border bg-surface -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8"
      >
        {liveItems.length > 0 ? (
          <div className="divide-y divide-border">
            {liveItems.map(item => (
              <Link
                key={`${item.seriesSlug}-${item.session.uid}`}
                href={hrefFor(item)}
                className="group flex flex-wrap items-center gap-x-4 gap-y-1 py-4"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="relative inline-flex">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-60 animate-ping" />
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-live" />
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] font-bold text-live">
                    Live
                  </span>
                </span>
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.14em] font-semibold"
                  style={{ color: item.color }}
                >
                  {item.seriesName}
                </span>
                <span className="font-display text-xl md:text-2xl font-bold uppercase tracking-wide text-text basis-full md:basis-auto md:flex-1 min-w-0 truncate">
                  {item.session.title}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
                  {elapsedLabel(item.session.start, now)} in
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted group-hover:text-text transition-colors duration-(--duration-fast)">
                  Open
                  <ArrowUpRight size={13} />
                </span>
              </Link>
            ))}
          </div>
        ) : next ? (
          <Link
            href={hrefFor(next)}
            className="group flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between md:gap-6"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] font-bold text-brand">
                  Up next
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: next.color }}
                  />
                  <span
                    className="font-mono text-[11px] uppercase tracking-[0.14em] font-semibold"
                    style={{ color: next.color }}
                  >
                    {next.seriesName}
                  </span>
                </span>
                {next.session.location && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">
                    <MapPin size={11} />
                    {next.session.location.split(',')[0].trim()}
                  </span>
                )}
              </div>
              <div className="font-display text-2xl md:text-3xl font-extrabold uppercase tracking-wide text-text leading-none truncate">
                {next.session.title}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
                <span className="tnum">
                  {next.session.dateOnly
                    ? 'This weekend · time TBC'
                    : `${next.session.start.toLocaleDateString('en-GB', {
                        weekday: 'short',
                        timeZone: 'UTC',
                      })} ${timeHM(next.session.start, clock)} ${tz}`}
                </span>
                {nextWeather && nextW && (
                  <span className="tnum">
                    {nextW.emoji} {Math.round(nextWeather.maxC)}°/
                    {Math.round(nextWeather.minC)}°
                    {nextWeather.precipProb >= 30 &&
                      ` · ${Math.round(nextWeather.precipProb)}% rain`}
                  </span>
                )}
              </div>
            </div>
            {!next.session.dateOnly && (
              <div className="shrink-0 text-left md:text-right">
                <div className="text-3xl md:text-4xl font-bold text-text">
                  <Countdown to={next.session.start} initialNow={now} />
                </div>
                <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)">
                  {roundFor(next.seriesSlug, next.session.uid) ? 'Open weekend' : 'Open series'}
                  <ArrowUpRight size={12} />
                </div>
              </div>
            )}
          </Link>
        ) : (
          <div className="py-4 text-sm text-text-faint">
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
      </section>

      {/* ── Two columns on desktop: schedule | wire. Stacked on mobile,
             schedule first. No tabs anywhere. ── */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16 lg:items-start">
        <section aria-label="This week's sessions">
          <SectionHead
            title="This week"
            sub={`${weekItems.length} sessions · ${tz}`}
          />
          {byDay.length === 0 ? (
            <div className="border border-border bg-surface/40 p-6 text-sm text-text-faint">
              {isEmptyFromFilter ? (
                <>
                  No sessions in your followed series this week.{' '}
                  <Link
                    href="/settings"
                    className="text-text-muted underline underline-offset-2 hover:text-text"
                  >
                    Manage
                  </Link>
                  .
                </>
              ) : (
                'Nothing on track in the next seven days.'
              )}
            </div>
          ) : (
            byDay.map(day => {
              const d0 = day.sessions[0].start;
              const dayTag = sameUTCDay(d0, now)
                ? 'Today'
                : sameUTCDay(d0, new Date(now.getTime() + 86_400_000))
                  ? 'Tomorrow'
                  : null;
              return (
                <div key={day.label} className="mb-5">
                  <div className="flex items-baseline gap-2 mb-1">
                    {dayTag && (
                      <span className="font-display text-sm font-extrabold uppercase tracking-wide text-brand">
                        {dayTag}
                      </span>
                    )}
                    <span className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
                      {day.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                      {day.sessions.length}
                    </span>
                  </div>
                  <div className="border-y border-border divide-y divide-border">
                    {day.sessions.map(s => {
                      const item = itemByUid.get(s.uid);
                      if (!item) return null;
                      const w = weatherByUid?.[s.uid];
                      const wl = w ? weatherLabel(w.weatherCode) : null;
                      return (
                        <Link
                          key={`${s.seriesSlug}-${s.uid}`}
                          href={hrefFor(item)}
                          className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface"
                        >
                          <span
                            className="self-stretch w-[3px] shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="w-12 shrink-0 font-mono text-sm font-semibold text-text tnum">
                            {s.dateOnly ? 'TBC' : timeHM(s.start, clock)}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-[15px] font-semibold text-text tracking-tight truncate min-w-0">
                                {s.title}
                              </span>
                              {s.significance && (
                                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 border border-brand/40 text-brand">
                                  {s.significance.tier}
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint min-w-0">
                              <span
                                className="font-semibold whitespace-nowrap shrink-0"
                                style={{ color: item.color }}
                              >
                                {item.seriesName}
                              </span>
                              {s.location && (
                                <>
                                  <span>·</span>
                                  <span className="truncate">
                                    {s.location.split(',')[0].trim()}
                                  </span>
                                </>
                              )}
                              {w && wl && (
                                <span className="tnum shrink-0">
                                  · {wl.emoji} {Math.round(w.maxC)}°
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-text-muted tnum">
                            {s.dateOnly ? 'TBC' : formatRelative(s.start, now)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          <Link
            href="/calendar"
            className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
          >
            Full calendar
            {beyondCount > 0 && (
              <span className="text-text-faint tnum">+{beyondCount} ahead</span>
            )}
            <ArrowUpRight size={13} />
          </Link>
        </section>

        <section aria-label="Latest news" className="mt-10 lg:mt-0">
          <SectionHead title="Paddock wire" sub="motorsport.com" />
          {seriesWithNews.length > 1 && (
            <div className="mb-3 -mx-1 px-1 flex gap-1.5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setNewsFilter(null)}
                className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] font-semibold px-3 py-1.5 border transition-colors duration-(--duration-fast) ${
                  newsFilter === null
                    ? 'bg-text text-bg border-text'
                    : 'text-text-muted border-border hover:text-text hover:border-border-strong'
                }`}
              >
                All
                <span className="ml-1.5 tnum opacity-70">{filteredNews.length}</span>
              </button>
              {seriesWithNews.map(s => {
                const active = newsFilter === s.slug;
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => setNewsFilter(s.slug)}
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
          {topNews.length === 0 ? (
            <div className="border border-border bg-surface/40 p-6 text-sm text-text-faint">
              {isEmptyFromFilter
                ? 'No recent stories from your followed series.'
                : 'Latest stories unavailable right now.'}
            </div>
          ) : (
            <div className="border-y border-border divide-y divide-border">
              {topNews.map(item => {
                const pubDate = new Date(item.pubDate);
                return (
                  <a
                    key={item.link}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block py-3 px-2 -mx-2 transition-colors duration-(--duration-fast) hover:bg-surface"
                  >
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.seriesColor }}
                      />
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.14em] font-semibold shrink-0"
                        style={{ color: item.seriesColor }}
                      >
                        {item.seriesName}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint tnum shrink-0">
                        · {relativeAgo(pubDate, now)}
                      </span>
                      <ExternalLink
                        size={12}
                        className="ml-auto shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)"
                      />
                    </div>
                    <h3 className="text-sm font-semibold leading-snug tracking-tight text-text">
                      {item.title}
                    </h3>
                  </a>
                );
              })}
            </div>
          )}
          <div className="pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
            Source: motorsport.com
          </div>
        </section>
      </div>
    </>
  );
}
