'use client';
import Link from 'next/link';
import { Tour } from '@/components/Tour';
import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronDown, ExternalLink, MapPin, Play, Tv } from 'lucide-react';
import type { Session } from '@/lib/types';
import type { DailyWeather } from '@/lib/weather';
import { weatherLabel } from '@/lib/weather';
import { useFollowedSeries } from '@/lib/useFollowedSeries';
import { groupByDay } from '@/lib/group';
import { formatRelative, HOME_WEEK_MS } from '@/lib/date';
import type { JustMissedItem } from '@/lib/home-results';
import { useHomeLayout } from '@/lib/useHomeLayout';
import type { HomeElementId } from '@/lib/homeLayout';

interface HomeItem {
  session: Session;
  color: string;
  seriesName: string;
  seriesSlug: string;
  watch?: { service: string; url: string };
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

const WEEK_MS = HOME_WEEK_MS;
const NEWS_LIMIT = 10;

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

export function HomeContent({
  items,
  news,
  weatherByUid,
  roundByKey,
  serverNow,
  upcomingCountBySeries,
}: {
  // Live + this-week sessions + the first beyond-week session per series
  // (so `next` resolves under any follow filter) — NOT the whole season.
  items: HomeItem[];
  news: NewsItemSerialized[];
  weatherByUid?: Record<string, DailyWeather>;
  roundByKey?: Record<string, number>;
  serverNow: string;
  // Per-series count of ALL remaining upcoming sessions (same predicate as
  // upcomingItems below); powers beyondCount without shipping the tail.
  upcomingCountBySeries?: Record<string, number>;
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
  // Layout is read here; the customise CONTROLS live in Account (a banner with a
  // preview). The home keeps an inline collapse toggle on its collapsible blocks.
  const { layout, toggleCollapsed } = useHomeLayout();
  const [newsFilter, setNewsFilter] = useState<string | null>(null);
  // JUST MISSED is fetched as cacheable Ajax (/api/just-missed) rather than
  // server-rendered, so /app itself stays statically generated / edge-cached
  // (the WEC podium path does a no-store live fetch that otherwise forces the
  // whole route dynamic). Post-loads below the chyron — fine for a
  // retrospective block.
  const [justMissed, setJustMissed] = useState<JustMissedItem[] | null>(null);
  // Lighter when hidden: a hidden Just-missed block skips the /api/just-missed
  // fetch entirely (the WEC podium fan-out behind it isn't free).
  const justMissedHidden = layout.hidden.includes('just-missed');
  useEffect(() => {
    if (justMissedHidden) return;
    let alive = true;
    fetch('/api/just-missed')
      .then(r => (r.ok ? r.json() : []))
      .then(d => {
        if (alive) setJustMissed(d as JustMissedItem[]);
      })
      .catch(() => {
        if (alive) setJustMissed([]);
      });
    return () => {
      alive = false;
    };
  }, [justMissedHidden]);

  // Until followed-series prefs resolve on the client, render a skeleton — never
  // the unfiltered page. /app is statically cached / user-agnostic, so the SSR
  // HTML can't know the user's series; without this gate it paints EVERY series
  // (chyron, week, wire, just-missed) and the post-hydration filter then yanks
  // the non-followed ones away — the personalization flash. Skeleton → your
  // paddock, never other-series data. Guests resolve from localStorage in ~1
  // frame; signed-in returns from the local mirror (see useFollowedSeries).
  if (!hydrated) return <HomeSkeleton />;

  const filteredSessions =
    followed !== null
      ? items.filter(i => followed.includes(i.seriesSlug))
      : items;
  const filteredNews =
    hydrated && followed !== null
      ? news.filter(n => followed.includes(n.seriesSlug))
      : news;

  // JUST MISSED — filter to followed, cap 3 (hero + 2 rows). Rank cards that
  // carry an actual podium ahead of link-out-only series, then by recency: the
  // block's whole point is "who won", so a result we can show beats a more
  // recent race we can only link out to (NASCAR/WSBK/F2 etc.).
  const justMissedItems = (
    hydrated && followed !== null
      ? (justMissed ?? []).filter(j => followed.includes(j.seriesSlug))
      : (justMissed ?? [])
  )
    .slice()
    .sort((a, b) => {
      const pa = a.podium && a.podium.length > 0 ? 1 : 0;
      const pb = b.podium && b.podium.length > 0 ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })
    .slice(0, 3);
  const jmHero = justMissedItems[0];
  const jmRest = justMissedItems.slice(1);
  // Hero "article" — the latest news item for the hero's series. Honest
  // heuristic (latest series story, not guaranteed a race report), so it's
  // labelled "Latest · <series>" rather than implied to be about the race.
  const heroArticle = jmHero
    ? news.find(n => n.seriesSlug === jmHero.seriesSlug)
    : undefined;

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
  // "+N ahead": total remaining sessions for the followed set minus the week
  // actually rendered above it. The per-series counts come from the page
  // (full-season knowledge) so the payload doesn't have to (audit 2-2);
  // subtracting weekItems — not all payload upcoming — keeps the per-series
  // "next beyond the week" payload items counted in the tail, matching the
  // full-payload formula exactly (verified equal at the same instant).
  const totalUpcoming = upcomingCountBySeries
    ? Object.entries(upcomingCountBySeries)
        .filter(
          ([slug]) =>
            !(hydrated && followed !== null) || followed.includes(slug),
        )
        .reduce((sum, [, n]) => sum + n, 0)
    : upcomingItems.length;
  const beyondCount = Math.max(0, totalUpcoming - weekItems.length);

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
  // Dedupe by link before slicing: motorsport.com cross-posts the same story
  // to multiple series feeds, so an unfiltered "All" view rendered it twice
  // back-to-back under different chips (heuristic walk 2026-06). Per-series
  // filtering is unaffected — a single-series view has no cross-series dups.
  const newsForView = newsFilter
    ? filteredNews.filter(n => n.seriesSlug === newsFilter)
    : filteredNews;
  const seenLinks = new Set<string>();
  const topNews = newsForView
    .filter(n => (seenLinks.has(n.link) ? false : seenLinks.add(n.link)))
    .slice(0, NEWS_LIMIT);

  const isEmptyFromFilter =
    hydrated && followed !== null && followed.length < items.length;

  const nextWeather = next ? weatherByUid?.[next.session.uid] : undefined;
  const nextW = nextWeather ? weatherLabel(nextWeather.weatherCode) : null;

  // Home-layout customization: each top-level block gets a CSS `order` from the
  // user's prefs (so the DEFAULT order renders identically), and hidden blocks
  // are dropped. Applied on a flex column below.
  const orderOf = (id: HomeElementId): number => {
    const i = layout.order.indexOf(id);
    return i < 0 ? 99 : i;
  };
  const isHidden = (id: HomeElementId): boolean => layout.hidden.includes(id);
  const isCollapsed = (id: HomeElementId): boolean => layout.collapsed.includes(id);

  return (
    <>
      <h1 className="sr-only">
        Paddock Tracker — live motorsport schedule and news across F1, MotoGP, WEC,
        Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more
      </h1>

      <div className="flex flex-col">
      {/* ── Chyron — the broadcast strip. Live takes over; otherwise the next
             session with a ticking countdown. ── */}
      {!isHidden('chyron') && (
      <section
        aria-label={liveItems.length > 0 ? 'Live now' : 'Up next'}
        data-tour="chyron"
        style={{ order: orderOf('chyron') }}
        className="mb-8 border-y border-border bg-surface -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8"
      >
        {liveItems.length > 0 ? (
          <div className="divide-y divide-border">
            {liveItems.map(item => (
              <div key={`${item.seriesSlug}-${item.session.uid}`} className="py-4">
              <Link
                href={hrefFor(item)}
                className="group flex flex-wrap items-center gap-x-4 gap-y-1"
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
              {item.watch && (
                <a
                  href={item.watch.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-brand transition-colors duration-(--duration-fast)"
                >
                  <Tv size={12} />
                  Watch on {item.watch.service}
                  <ArrowUpRight size={12} className="opacity-60" />
                </a>
              )}
              </div>
            ))}
          </div>
        ) : next ? (
          <div className="py-4">
          <Link
            href={hrefFor(next)}
            className="group flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6"
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
          {next.watch && (
            <a
              href={next.watch.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-brand transition-colors duration-(--duration-fast)"
            >
              <Tv size={12} />
              Watch on {next.watch.service}
              <ArrowUpRight size={12} className="opacity-60" />
            </a>
          )}
          </div>
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
      )}

      {/* ── JUST MISSED — what just happened. Hero (latest finished race) +
             up to 2 quiet rows. Podium for covered series, link-out otherwise.
             (Slice 3 pairs this side-by-side with UP NEXT on desktop.) ── */}
      {jmHero && !isHidden('just-missed') && (
        <section aria-label="Just missed" className="mb-8" style={{ order: orderOf('just-missed') }}>
          <CollapsibleSectionHead
            title="Just missed"
            sub="latest results"
            collapsed={isCollapsed('just-missed')}
            onToggle={() => toggleCollapsed('just-missed')}
          />
          {!isCollapsed('just-missed') && (
          <>
          <div className="border-y border-border py-4">
            <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em]">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: jmHero.color }}
                />
                <span className="font-semibold" style={{ color: jmHero.color }}>
                  {jmHero.seriesName}
                </span>
              </span>
              <span className="text-text-faint tnum">
                {relativeAgo(new Date(jmHero.date), now)}
              </span>
            </div>
            <a href={jmHero.resultsHref} className="group inline-block">
              <span className="font-display text-2xl md:text-3xl font-extrabold uppercase tracking-wide text-text leading-none">
                {jmHero.raceName}
              </span>
            </a>
            {jmHero.podium && jmHero.podium.length > 0 ? (
              <ol className="mt-2.5 space-y-1">
                {jmHero.podium.map(p => (
                  <li
                    key={p.position}
                    className="flex items-baseline gap-2.5 text-sm min-w-0"
                  >
                    <span className="w-6 shrink-0 font-mono text-[11px] text-text-faint tnum">
                      P{p.position}
                    </span>
                    <span
                      className={
                        p.position === 1
                          ? 'font-semibold text-text'
                          : 'text-text-muted'
                      }
                    >
                      {p.name}
                    </span>
                    {p.detail && (
                      <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint">
                        {p.detail}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <a
                href={jmHero.resultsHref}
                className="group mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
              >
                See full results
                <ArrowUpRight size={13} />
              </a>
            )}
            {heroArticle && (
              <a
                href={heroArticle.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-3 block min-w-0"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
                  Latest · {jmHero.seriesName}
                </span>
                <span className="mt-0.5 flex items-start gap-1.5 text-sm leading-snug text-text-muted transition-colors duration-(--duration-fast) group-hover:text-text">
                  <span className="min-w-0 line-clamp-2">{heroArticle.title}</span>
                  <ExternalLink size={12} className="mt-0.5 shrink-0 text-text-faint" />
                </span>
              </a>
            )}
            {jmHero.highlight && (
              <a
                href={`https://www.youtube.com/watch?v=${jmHero.highlight}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-brand transition-colors duration-(--duration-fast)"
              >
                <Play size={12} />
                Highlights
                <ArrowUpRight size={12} className="opacity-60" />
              </a>
            )}
          </div>
          {jmRest.length > 0 && (
            <div className="border-b border-border divide-y divide-border">
              {jmRest.map(j => (
                <a
                  key={j.seriesSlug}
                  href={j.resultsHref}
                  className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface"
                >
                  <span
                    className="self-stretch w-[3px] shrink-0"
                    style={{ backgroundColor: j.color }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-text tracking-tight">
                      {j.raceName}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint min-w-0">
                      <span
                        className="font-semibold whitespace-nowrap shrink-0"
                        style={{ color: j.color }}
                      >
                        {j.seriesName}
                      </span>
                      {j.podium?.[0] && (
                        <>
                          <span>·</span>
                          <span className="truncate">{j.podium[0].name}</span>
                        </>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-text-muted tnum">
                    {relativeAgo(new Date(j.date), now)}
                  </span>
                </a>
              ))}
            </div>
          )}
          </>
          )}
        </section>
      )}

      {/* ── Two columns on desktop: schedule | wire. Stacked on mobile,
             schedule first. No tabs anywhere. ── */}
      {!isHidden('schedule') && (
        <section aria-label="This week's sessions" data-tour="week" className="mb-8" style={{ order: orderOf('schedule') }}>
          <CollapsibleSectionHead
            title="This week"
            sub={`${weekItems.length} sessions · ${tz}`}
            collapsed={isCollapsed('schedule')}
            onToggle={() => toggleCollapsed('schedule')}
          />
          {!isCollapsed('schedule') && (
          <>
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
            byDay.map((day, dayIdx) => {
              const d0 = day.sessions[0].start;
              const dayTag = sameUTCDay(d0, now)
                ? 'Today'
                : sameUTCDay(d0, new Date(now.getTime() + 86_400_000))
                  ? 'Tomorrow'
                  : null;
              // Density (operator: home is "chaotic"): only the first day
              // group renders open — later days collapse to a summary row
              // (day + count + series dots) that expands on tap. The info
              // is one interaction away instead of one unbroken wall.
              const defaultOpen = dayIdx === 0;
              const daySeries = Array.from(
                new Map(
                  day.sessions
                    .map(s => itemByUid.get(s.uid))
                    .filter((i): i is NonNullable<typeof i> => Boolean(i))
                    .map(i => [i.seriesSlug, i.color]),
                ).values(),
              );
              return (
                <details key={day.label} open={defaultOpen} className="group mb-3">
                  <summary className="flex cursor-pointer list-none items-baseline gap-2 py-1 [&::-webkit-details-marker]:hidden">
                    {dayTag && (
                      <span className="font-display text-sm font-extrabold uppercase tracking-wide text-brand">
                        {dayTag}
                      </span>
                    )}
                    <span className="font-display text-sm font-extrabold uppercase tracking-wide text-text">
                      {day.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint tnum">
                      {day.sessions.length}
                    </span>
                    <span className="ml-auto flex items-center gap-1 self-center">
                      {daySeries.slice(0, 6).map((color, i) => (
                        <span
                          key={i}
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <span className="ml-1 font-mono text-[10px] text-text-faint transition-transform duration-(--duration-fast) group-open:rotate-90">
                        ›
                      </span>
                    </span>
                  </summary>
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
                </details>
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
          </>
          )}
        </section>
      )}

      {!isHidden('news') && (
        <section aria-label="Latest news" className="mb-8" style={{ order: orderOf('news') }}>
          <CollapsibleSectionHead
            title="Paddock wire"
            sub="motorsport.com"
            collapsed={isCollapsed('news')}
            onToggle={() => toggleCollapsed('news')}
          />
          {!isCollapsed('news') && (
          <>
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
          </>
          )}
        </section>
      )}
      </div>
      <Tour
        stops={[
          {
            selector: '[data-tour="chyron"]',
            title: 'Live, or next up',
            body: 'This strip is the broadcast chyron: when a session is on track it takes over with a live marker; otherwise it counts down to the next one, in your time zone.',
          },
          {
            selector: '[data-tour="week"]',
            title: 'Your week at a glance',
            body: 'Every session across all 15 series, in your local time. Tap any session to open its page — practice, qualifying and race each have their own.',
          },
          {
            selector: '[data-tour="series"]',
            title: 'Fifteen series, one place',
            body: 'Standings, race-by-race results, rules and history for every championship we track — from F1 to the Nürburgring.',
          },
          {
            selector: '[data-tour="account"]',
            title: 'Make it yours',
            body: 'Pick the series you follow and they shape your home and calendar — saved on this device, no account needed. Sign in to keep them everywhere and enable race-day notifications.',
          },
        ]}
      />
    </>
  );
}

// SectionHead variant that toggles its block's collapsed state (persisted). Used
// for the home's collapsible blocks (Just missed) — tap the header to fold/expand.
function CollapsibleSectionHead({
  title,
  sub,
  collapsed,
  onToggle,
}: {
  title: string;
  sub?: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="mb-3 flex w-full items-baseline justify-between gap-3 border-b border-border pb-2 text-left"
    >
      <span className="font-display text-xl font-extrabold uppercase tracking-wide text-text">
        {title}
        <span className="text-brand">.</span>
      </span>
      <span className="inline-flex items-center gap-2">
        {sub && <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">{sub}</span>}
        <ChevronDown
          size={15}
          className={`shrink-0 text-text-faint transition-transform duration-(--duration-fast) ${collapsed ? '-rotate-90' : ''}`}
        />
      </span>
    </button>
  );
}

// Shown until followed-series prefs resolve on the client (see the early return
// in HomeContent), in place of the unfiltered page. Keeps the sr-only H1 so the
// page keeps its heading for crawlers, and roughly mirrors the chyron + two-column
// week/wire layout to avoid layout shift when the real content swaps in.
function HomeSkeleton() {
  return (
    <>
      <h1 className="sr-only">
        Paddock Tracker — live motorsport schedule and news across F1, MotoGP, WEC,
        Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more
      </h1>
      <div aria-hidden="true" className="animate-pulse">
        <div className="mb-8 -mx-4 border-y border-border bg-surface px-4 py-5 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          <div className="mb-2 h-4 w-40 bg-surface-elevated" />
          <div className="h-9 w-3/4 max-w-md bg-surface-elevated" />
        </div>
        <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-12 xl:gap-16">
          <div>
            <div className="mb-3 h-5 w-28 bg-surface" />
            <div className="border-y border-border divide-y divide-border">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-surface/60" />
              ))}
            </div>
          </div>
          <div className="mt-10 lg:mt-0">
            <div className="mb-3 h-5 w-28 bg-surface" />
            <div className="border-y border-border divide-y divide-border">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="h-14 bg-surface/60" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
