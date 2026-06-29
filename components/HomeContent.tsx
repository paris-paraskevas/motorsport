'use client';
import Link from 'next/link';
import { Tour } from '@/components/Tour';
import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronDown, Coins, ExternalLink, MapPin, MessageSquare, Play, Trophy, Tv, Users, UserPlus } from 'lucide-react';
import type { Session } from '@/lib/types';
import type { DailyWeather } from '@/lib/weather';
import { weatherLabel } from '@/lib/weather';
import { useFollowedSeries } from '@/lib/useFollowedSeries';
import { groupByDay } from '@/lib/group';
import { formatRelative } from '@/lib/date';
import type { JustMissedItem } from '@/lib/home-results';
import { useHomeLayout } from '@/lib/useHomeLayout';
import type { HomeElementId, WidgetSettings } from '@/lib/homeLayout';
import type { CircuitLayout } from '@/lib/circuit-layout';
import { formatBetSelection } from '@/lib/betting/constants';
import { OpenF1Attribution } from '@/components/f1/OpenF1Attribution';

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

interface HomeBlogItem {
  slug: string;
  title: string;
  summary: string;
  seriesSlug: string | null;
  publishedAt: string | null;
}

interface HomeStandingsItem {
  slug: string;
  name: string;
  color: string;
  leader: { name: string; points: number };
  gapToSecond: number | null;
  top: { position: number; name: string; points: number }[];
}

// ── New opt-in widget payloads (mirror the /api/home/* route exports) ──
interface HomeThreadItem {
  id: string;
  title: string;
  seriesSlug: string | null;
  seriesName: string | null;
  seriesColor: string | null;
  createdAt: string;
}

interface HomeBetLine {
  id: string;
  type: string;
  selection: Record<string, unknown>;
  seriesSlug: string;
  seriesName: string | null;
  round: number;
  stake: number;
}

interface HomeNextMarket {
  seriesSlug: string;
  seriesName: string | null;
  round: number;
  type: string;
  locksAt: string;
}

interface HomeBetsData {
  signedIn: boolean;
  balance: number;
  openCount: number;
  openBets: HomeBetLine[];
  nextMarket: HomeNextMarket | null;
}

interface HomeDecodedData {
  round: number;
  gp: string;
  qualifying: { href: string; pole: string | null; p2: string | null } | null;
  race: { href: string } | null;
}

interface HomeSocialLeague {
  id: string;
  name: string;
  memberCount: number;
  myRank: number | null;
}

interface HomeSocialData {
  signedIn: boolean;
  leagues: HomeSocialLeague[];
  friends: { count: number; pending: number };
}

// Mirrors the /api/home/spotlight route export.
interface HomeSpotlightDriver {
  slug: string;
  name: string;
  code: string | null;
  team: string;
  teamSlug: string;
  teamColor: string | null;
  seriesSlug: string;
  seriesName: string;
  seriesColor: string;
}

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
  circuitLayoutByUid,
  roundByKey,
  serverNow,
  upcomingCountBySeries,
}: {
  // Live + this-week sessions + the first beyond-week session per series
  // (so `next` resolves under any follow filter) — NOT the whole season.
  items: HomeItem[];
  news: NewsItemSerialized[];
  weatherByUid?: Record<string, DailyWeather>;
  circuitLayoutByUid?: Record<string, CircuitLayout>;
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
      : `/series/${item.seriesSlug}`;
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
  // Lighter when hidden OR collapsed: the /api/just-missed fetch (a WEC podium
  // fan-out — not free) is deferred until the block is both shown and expanded.
  // Just-missed is collapsed by default, so a fresh /app pays nothing for it
  // until the user opens it; the effect re-runs when the collapse state flips.
  // Both the combined Just missed block and the per-series Series results block
  // render from /api/just-missed — ONE shared fetch, fired when EITHER is shown +
  // expanded (mirrors the championship-leader + standings-snapshot fan-out).
  const justMissedShown =
    !layout.hidden.includes('just-missed') && !layout.collapsed.includes('just-missed');
  const seriesResultsShown =
    !layout.hidden.includes('series-just-missed') && !layout.collapsed.includes('series-just-missed');
  const needJustMissed = justMissedShown || seriesResultsShown;
  useEffect(() => {
    if (!needJustMissed) return;
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
  }, [needJustMissed]);

  // FROM THE BLOG — same defer-fetch shape as just-missed: the latest published
  // posts load only when the (opt-in, default-hidden) block is both shown and
  // expanded, so a home that never enables it pays nothing for it.
  const [blogPosts, setBlogPosts] = useState<HomeBlogItem[] | null>(null);
  const blogHidden = layout.hidden.includes('from-the-blog');
  const blogCollapsed = layout.collapsed.includes('from-the-blog');
  useEffect(() => {
    if (blogHidden || blogCollapsed) return;
    let alive = true;
    fetch('/api/home/from-the-blog')
      .then(r => (r.ok ? r.json() : []))
      .then(d => {
        if (alive) setBlogPosts(d as HomeBlogItem[]);
      })
      .catch(() => {
        if (alive) setBlogPosts([]);
      });
    return () => {
      alive = false;
    };
  }, [blogHidden, blogCollapsed]);

  // STANDINGS WIDGETS (championship-leader + standings-snapshot) — ONE fetch for
  // both, defer-loaded only when at least one is shown + expanded. The route
  // returns briefs only for eligible series that have data, so its response
  // defines what renders (no client-side eligibility list). `all` = follow-all.
  const [standings, setStandings] = useState<HomeStandingsItem[] | null>(null);
  const leaderShown =
    !layout.hidden.includes('championship-leader') && !layout.collapsed.includes('championship-leader');
  const snapshotShown =
    !layout.hidden.includes('standings-snapshot') && !layout.collapsed.includes('standings-snapshot');
  const needStandings = leaderShown || snapshotShown;
  const standingsParam = followed === null ? 'all' : followed.join(',');
  useEffect(() => {
    if (!needStandings || !standingsParam) return;
    let alive = true;
    fetch(`/api/home/standings?series=${encodeURIComponent(standingsParam)}`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => {
        if (alive) setStandings(d as HomeStandingsItem[]);
      })
      .catch(() => {
        if (alive) setStandings([]);
      });
    return () => {
      alive = false;
    };
  }, [needStandings, standingsParam]);

  // THREADS ("paddock chatter") — opt-in, default-hidden; same defer-fetch shape
  // as from-the-blog. The newest approved threads load only when the block is
  // shown + expanded, so a home that never enables it pays nothing.
  const [threads, setThreads] = useState<HomeThreadItem[] | null>(null);
  const threadsHidden = layout.hidden.includes('threads');
  const threadsCollapsed = layout.collapsed.includes('threads');
  useEffect(() => {
    if (threadsHidden || threadsCollapsed) return;
    let alive = true;
    fetch('/api/home/threads')
      .then(r => (r.ok ? r.json() : []))
      .then(d => {
        if (alive) setThreads(d as HomeThreadItem[]);
      })
      .catch(() => {
        if (alive) setThreads([]);
      });
    return () => {
      alive = false;
    };
  }, [threadsHidden, threadsCollapsed]);

  // YOUR BETS & CREDITS — opt-in, default-hidden, signed-in only. Same defer
  // shape; the route returns { signedIn:false } for anon (the widget then shows a
  // subtle sign-in nudge). Per-user, so the route is no-store (not edge-cached).
  const [bets, setBets] = useState<HomeBetsData | null>(null);
  const betsHidden = layout.hidden.includes('bets');
  const betsCollapsed = layout.collapsed.includes('bets');
  useEffect(() => {
    if (betsHidden || betsCollapsed) return;
    let alive = true;
    fetch('/api/home/bets')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (alive) setBets(d as HomeBetsData | null);
      })
      .catch(() => {
        if (alive) setBets(null);
      });
    return () => {
      alive = false;
    };
  }, [betsHidden, betsCollapsed]);

  // YOUR LEAGUES & FRIENDS — opt-in, default-hidden, signed-in only. Same defer
  // shape as bets; the route returns { signedIn:false } for anon (the widget then
  // shows a join-a-league nudge). Per-user, so the route is no-store.
  const [social, setSocial] = useState<HomeSocialData | null>(null);
  const socialHidden = layout.hidden.includes('social');
  const socialCollapsed = layout.collapsed.includes('social');
  useEffect(() => {
    if (socialHidden || socialCollapsed) return;
    let alive = true;
    fetch('/api/home/social')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (alive) setSocial(d as HomeSocialData | null);
      })
      .catch(() => {
        if (alive) setSocial(null);
      });
    return () => {
      alive = false;
    };
  }, [socialHidden, socialCollapsed]);

  // LATEST DECODED (F1) — opt-in, default-hidden. The most recent past F1 round's
  // qualifying + race, deep-linked to the Decoder / Race Story. Defer-fetched;
  // null when there's no finished round yet or OpenF1 has nothing.
  const [decoded, setDecoded] = useState<HomeDecodedData | null | undefined>(undefined);
  const decodedHidden = layout.hidden.includes('latest-decoded');
  const decodedCollapsed = layout.collapsed.includes('latest-decoded');
  useEffect(() => {
    if (decodedHidden || decodedCollapsed) return;
    let alive = true;
    fetch('/api/home/latest-decoded')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (alive) setDecoded(d as HomeDecodedData | null);
      })
      .catch(() => {
        if (alive) setDecoded(null);
      });
    return () => {
      alive = false;
    };
  }, [decodedHidden, decodedCollapsed]);

  // DRIVER SPOTLIGHT — opt-in, default-hidden. A rotating sample of drivers (+
  // their team) from the curated lineups, deep-linked into /drivers and /teams.
  // Same defer-fetch shape; the route is edge-cached + time-rotated, so a home
  // that never enables it pays nothing and the sample turns over per window.
  const [spotlight, setSpotlight] = useState<HomeSpotlightDriver[] | null>(null);
  const spotlightHidden = layout.hidden.includes('driver-spotlight');
  const spotlightCollapsed = layout.collapsed.includes('driver-spotlight');
  useEffect(() => {
    if (spotlightHidden || spotlightCollapsed) return;
    let alive = true;
    fetch('/api/home/spotlight')
      .then(r => (r.ok ? r.json() : []))
      .then(d => {
        if (alive) setSpotlight(d as HomeSpotlightDriver[]);
      })
      .catch(() => {
        if (alive) setSpotlight([]);
      });
    return () => {
      alive = false;
    };
  }, [spotlightHidden, spotlightCollapsed]);

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

  // Per-widget settings (content + density). Each derived value clamps to its
  // widget's allowed range; the customise page persists them to layout.config.
  const cfg = (id: HomeElementId): WidgetSettings => layout.config[id] ?? {};
  const dense = (id: HomeElementId): boolean => (cfg(id).density ?? 'comfortable') === 'compact';
  const jmCount = Math.min(Math.max(cfg('just-missed').count ?? 3, 1), 5);
  const schedDays = cfg('schedule').days === 3 ? 3 : 7;
  const newsCount = cfg('news').count ?? NEWS_LIMIT;
  const blogCount = cfg('from-the-blog').count ?? 4;
  const leaderSet = cfg('championship-leader').seriesSet;
  const snapSeries = cfg('standings-snapshot').series;
  const snapRows = cfg('standings-snapshot').rows ?? 5;
  const sjmCount = Math.min(Math.max(cfg('series-just-missed').count ?? 5, 1), 10);
  const cdCount = Math.min(Math.max(cfg('series-countdowns').count ?? 5, 1), 10);
  const threadsCount = Math.min(Math.max(cfg('threads').count ?? 5, 1), 5);
  const socialCount = Math.min(Math.max(cfg('social').count ?? 3, 1), 5);
  const wtwCount = Math.min(Math.max(cfg('where-to-watch').count ?? 4, 1), 8);
  const spotlightCount = Math.min(Math.max(cfg('driver-spotlight').count ?? 3, 1), 6);
  // Density on the chyron tightens its vertical padding (it's a single strip, not
  // a row list — so the [&_a]/[&_li] descendant variants the other blocks use
  // don't apply here).
  const chyronPad = dense('chyron') ? 'py-2.5' : 'py-4';

  // JUST MISSED — filter to followed, capped to the widget's `count` (hero +
  // rest). Rank cards that
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
    .slice(0, jmCount);
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
    i => i.session.start.getTime() - now.getTime() <= schedDays * 86_400_000,
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
    .slice(0, newsCount);

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

      {/* On 2K+ (≥1700px) the blocks flow into two columns so the wide container is
          used, not stretched into over-long rows; the chyron spans both. Below that
          it stays a single flex column (mobile/laptop unchanged). CSS `order` from
          the customise prefs still applies to grid items. */}
      <div className="flex flex-col 3xl:grid 3xl:grid-cols-2 3xl:gap-x-10 3xl:items-start">
      {/* ── Chyron — the broadcast strip. Live takes over; otherwise the next
             session with a ticking countdown. ── */}
      {!isHidden('chyron') && (
      <section
        aria-label={liveItems.length > 0 ? 'Live now' : 'Up next'}
        data-tour="chyron"
        style={{ order: orderOf('chyron') }}
        className="mb-8 border-y border-border bg-surface -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 3xl:col-span-2"
      >
        {liveItems.length > 0 ? (
          <div className="divide-y divide-border">
            {liveItems.map(item => (
              <div key={`${item.seriesSlug}-${item.session.uid}`} className={chyronPad}>
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
          <div className={chyronPad}>
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
      {!isHidden('just-missed') && (
        <section aria-label="Just missed" className="mb-8" style={{ order: orderOf('just-missed') }}>
          <CollapsibleSectionHead
            title="Just missed"
            sub="latest results"
            collapsed={isCollapsed('just-missed')}
            onToggle={() => toggleCollapsed('just-missed')}
          />
          {!isCollapsed('just-missed') &&
            (justMissed === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-40 animate-pulse bg-surface" />
                <div className="h-8 w-3/4 max-w-sm animate-pulse bg-surface" />
                <div className="h-4 w-1/2 animate-pulse bg-surface/60" />
              </div>
            ) : !jmHero ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                Nothing wrapped up recently.
              </p>
            ) : (
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
            <div className={`border-b border-border divide-y divide-border${dense('just-missed') ? ' [&_a]:py-1.5' : ''}`}>
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
            ))}
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
                  <div className={`border-y border-border divide-y divide-border${dense('schedule') ? ' [&_a]:py-1.5' : ''}`}>
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
            <div className={`border-y border-border divide-y divide-border${dense('news') ? ' [&_a]:py-1.5' : ''}`}>
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

      {/* ── FROM THE BLOG — opt-in widget (default hidden; enabled from the
             customise gallery). The latest published posts, defer-fetched when
             the block is shown + expanded. ── */}
      {!isHidden('from-the-blog') && (
        <section aria-label="From the blog" className="mb-8" style={{ order: orderOf('from-the-blog') }}>
          <CollapsibleSectionHead
            title="From the blog"
            sub="long-reads"
            collapsed={isCollapsed('from-the-blog')}
            onToggle={() => toggleCollapsed('from-the-blog')}
          />
          {!isCollapsed('from-the-blog') && (
          <>
          {blogPosts === null ? (
            <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
              <div className="h-4 w-40 animate-pulse bg-surface" />
              <div className="h-4 w-3/4 max-w-md animate-pulse bg-surface/60" />
            </div>
          ) : blogPosts.length === 0 ? (
            <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
              No posts published yet.
            </p>
          ) : (
            <div className={`border-y border-border divide-y divide-border${dense('from-the-blog') ? ' [&_a]:py-1.5' : ''}`}>
              {blogPosts.slice(0, blogCount).map(p => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group block py-3 px-2 -mx-2 transition-colors duration-(--duration-fast) hover:bg-surface"
                >
                  <div className="mb-1 flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-brand shrink-0">
                      Paddock
                    </span>
                    {p.publishedAt && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint tnum shrink-0">
                        · {relativeAgo(new Date(p.publishedAt), now)}
                      </span>
                    )}
                    <ArrowUpRight
                      size={12}
                      className="ml-auto shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)"
                    />
                  </div>
                  <h3 className="text-sm font-semibold leading-snug tracking-tight text-text">{p.title}</h3>
                  {p.summary && (
                    <p className="mt-0.5 text-sm leading-snug text-text-muted line-clamp-2">{p.summary}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/blog"
            className="group mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
          >
            All posts
            <ArrowUpRight size={13} />
          </Link>
          </>
          )}
        </section>
      )}

      {/* ── CHAMPIONSHIP LEADER — opt-in. Who leads each series you follow. ── */}
      {!isHidden('championship-leader') && (
        <section aria-label="Championship leader" className="mb-8" style={{ order: orderOf('championship-leader') }}>
          <CollapsibleSectionHead
            title="Championship leader"
            sub="who's on top"
            collapsed={isCollapsed('championship-leader')}
            onToggle={() => toggleCollapsed('championship-leader')}
          />
          {!isCollapsed('championship-leader') &&
            (standings === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-3/4 max-w-md animate-pulse bg-surface" />
                <div className="h-4 w-1/2 animate-pulse bg-surface/60" />
              </div>
            ) : standings.length === 0 ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                Standings unavailable right now.
              </p>
            ) : (
              <div className={`border-y border-border divide-y divide-border${dense('championship-leader') ? ' [&_a]:py-1.5' : ''}`}>
                {standings.filter(s => !leaderSet || leaderSet.includes(s.slug)).map(s => (
                  <Link
                    key={s.slug}
                    href={`/series/${s.slug}/standings`}
                    className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface"
                  >
                    <span className="self-stretch w-[3px] shrink-0" style={{ backgroundColor: s.color }} />
                    <span
                      className="w-20 shrink-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: s.color }}
                    >
                      {s.name}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-text">
                      {s.leader.name}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-semibold tnum text-text">{s.leader.points}</span>
                    {s.gapToSecond != null && s.gapToSecond > 0 && (
                      <span className="w-10 shrink-0 text-right font-mono text-[11px] tnum text-text-faint">
                        +{s.gapToSecond}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ))}
        </section>
      )}

      {/* ── STANDINGS SNAPSHOT — opt-in. Top 5 of one chosen series (picked in
             Customise; defaults to the first one with data). ── */}
      {!isHidden('standings-snapshot') && (
        <section aria-label="Standings snapshot" className="mb-8" style={{ order: orderOf('standings-snapshot') }}>
          {(() => {
            const brief =
              standings && standings.length > 0
                ? standings.find(s => s.slug === snapSeries) ?? standings[0]
                : null;
            return (
              <>
                <CollapsibleSectionHead
                  title="Standings snapshot"
                  sub={brief ? brief.name : 'top of the table'}
                  collapsed={isCollapsed('standings-snapshot')}
                  onToggle={() => toggleCollapsed('standings-snapshot')}
                />
                {!isCollapsed('standings-snapshot') &&
                  (standings === null ? (
                    <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                      <div className="h-4 w-1/3 animate-pulse bg-surface" />
                      <div className="h-4 w-2/3 animate-pulse bg-surface/60" />
                    </div>
                  ) : !brief ? (
                    <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                      Pick a series in Customise to see its table.
                    </p>
                  ) : (
                    <>
                      <ol className={`border-y border-border divide-y divide-border${dense('standings-snapshot') ? ' [&_li]:py-1.5' : ''}`}>
                        {brief.top.slice(0, snapRows).map(row => (
                          <li key={row.position} className="flex items-baseline gap-3 py-2 px-2 -mx-2">
                            <span
                              className={`w-5 shrink-0 text-right font-mono text-sm tnum ${
                                row.position === 1 ? 'font-bold text-brand' : 'text-text-faint'
                              }`}
                            >
                              {row.position}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{row.name}</span>
                            <span className="shrink-0 font-mono text-sm font-semibold tnum text-text">{row.points}</span>
                          </li>
                        ))}
                      </ol>
                      <Link
                        href={`/series/${brief.slug}/standings`}
                        className="group mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
                      >
                        Full standings
                        <ArrowUpRight size={13} />
                      </Link>
                    </>
                  ))}
              </>
            );
          })()}
        </section>
      )}
      {/* ── SERIES COUNTDOWNS — opt-in. Each followed series' next session with
             its own live countdown (optionally a chosen subset of series). Reads
             `items` (which carries each series' next), so no fetch. ── */}
      {!isHidden('series-countdowns') && (() => {
        const seen = new Set<string>();
        const rows = upcomingItems
          .filter(i => {
            if (seen.has(i.seriesSlug)) return false;
            seen.add(i.seriesSlug);
            return true;
          })
          .slice(0, cdCount);
        return (
          <section aria-label="Series countdowns" className="mb-8" style={{ order: orderOf('series-countdowns') }}>
            <CollapsibleSectionHead
              title="Series countdowns"
              sub={`${rows.length} series`}
              collapsed={isCollapsed('series-countdowns')}
              onToggle={() => toggleCollapsed('series-countdowns')}
            />
            {!isCollapsed('series-countdowns') &&
              (rows.length === 0 ? (
                <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                  No upcoming sessions in your followed series.
                </p>
              ) : (
                <div className={`border-y border-border divide-y divide-border${dense('series-countdowns') ? ' [&_a]:py-1.5' : ''}`}>
                  {rows.map(item => (
                    <Link
                      key={item.seriesSlug}
                      href={hrefFor(item)}
                      className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface"
                    >
                      <span className="self-stretch w-[3px] shrink-0" style={{ backgroundColor: item.color }} />
                      <span
                        className="w-20 shrink-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: item.color }}
                      >
                        {item.seriesName}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-text">
                        {item.session.title}
                      </span>
                      <span className="shrink-0 font-mono text-sm font-semibold tnum text-text">
                        {item.session.dateOnly ? 'TBC' : <Countdown to={item.session.start} initialNow={now} />}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
          </section>
        );
      })()}

      {/* ── SERIES RESULTS — opt-in. The latest result for each followed series,
             one row each (vs the combined Just missed block); shares the
             /api/just-missed fetch, recency-sorted, capped to `count`. ── */}
      {!isHidden('series-just-missed') && (() => {
        const rows = (justMissed ?? [])
          .filter(j => !(hydrated && followed !== null) || followed.includes(j.seriesSlug))
          .slice()
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, sjmCount);
        return (
          <section aria-label="Series results" className="mb-8" style={{ order: orderOf('series-just-missed') }}>
            <CollapsibleSectionHead
              title="Series results"
              sub="latest per series"
              collapsed={isCollapsed('series-just-missed')}
              onToggle={() => toggleCollapsed('series-just-missed')}
            />
            {!isCollapsed('series-just-missed') &&
              (justMissed === null ? (
                <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                  <div className="h-4 w-3/4 max-w-md animate-pulse bg-surface" />
                  <div className="h-4 w-1/2 animate-pulse bg-surface/60" />
                </div>
              ) : rows.length === 0 ? (
                <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                  Nothing wrapped up recently.
                </p>
              ) : (
                <div className={`border-y border-border divide-y divide-border${dense('series-just-missed') ? ' [&_a]:py-1.5' : ''}`}>
                  {rows.map(j => (
                    <a
                      key={j.seriesSlug}
                      href={j.resultsHref}
                      className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface"
                    >
                      <span className="self-stretch w-[3px] shrink-0" style={{ backgroundColor: j.color }} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-text tracking-tight">
                          {j.raceName}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint min-w-0">
                          <span className="font-semibold whitespace-nowrap shrink-0" style={{ color: j.color }}>
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
              ))}
          </section>
        );
      })()}
      {/* ── CIRCUIT MAP — opt-in. The track layout for the next followed round
             we have a map for (F1 2026 calendar in v1). Static SVG, no fetch. ── */}
      {!isHidden('track-layout') && (() => {
        const item = upcomingItems.find(i => circuitLayoutByUid?.[i.session.uid]);
        const layout = item ? circuitLayoutByUid?.[item.session.uid] : undefined;
        return (
          <section aria-label="Circuit map" className="mb-8" style={{ order: orderOf('track-layout') }}>
            <CollapsibleSectionHead
              title="Circuit map"
              sub={layout ? layout.name : 'next round'}
              collapsed={isCollapsed('track-layout')}
              onToggle={() => toggleCollapsed('track-layout')}
            />
            {!isCollapsed('track-layout') &&
              (!item || !layout ? (
                <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                  No circuit map for your next round yet.
                </p>
              ) : (
                <div className={`border-y border-border ${dense('track-layout') ? 'py-3' : 'py-5'}`}>
                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold" style={{ color: item.color }}>{item.seriesName}</span>
                    </span>
                    {item.session.location && (
                      <span className="inline-flex items-center gap-1 text-text-faint">
                        <MapPin size={11} />
                        {item.session.location.split(',')[0].trim()}
                      </span>
                    )}
                  </div>
                  <Link href={hrefFor(item)} className="group block">
                    {/* aspect-square wrapper reserves the box before the SVG loads
                        (the schematics are square-ish) — kills the CLS the bare
                        <img> caused. The height cap stays on the wrapper; the img
                        fills it with object-contain so the artwork is unchanged. */}
                    <div
                      className={`relative mx-auto aspect-square w-full ${dense('track-layout') ? 'max-h-44' : 'max-h-64'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={layout.svg}
                        alt={`${layout.name} circuit layout`}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-display text-lg font-bold uppercase tracking-wide text-text truncate">
                        {layout.name}
                      </span>
                      <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)">
                        {roundFor(item.seriesSlug, item.session.uid) ? 'Open weekend' : 'Open series'}
                        <ArrowUpRight size={12} />
                      </span>
                    </div>
                  </Link>
                  <div className="pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                    Circuit map ·{' '}
                    <a
                      href={layout.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-text-muted"
                    >
                      {layout.source}
                    </a>{' '}
                    ({layout.license})
                  </div>
                </div>
              ))}
          </section>
        );
      })()}

      {/* ── PADDOCK CHATTER (threads) — opt-in. The newest approved community
             threads, defer-fetched when shown + expanded. Links into /threads. ── */}
      {!isHidden('threads') && (
        <section aria-label="Paddock chatter" className="mb-8" style={{ order: orderOf('threads') }}>
          <CollapsibleSectionHead
            title="Paddock chatter"
            sub="latest threads"
            collapsed={isCollapsed('threads')}
            onToggle={() => toggleCollapsed('threads')}
          />
          {!isCollapsed('threads') &&
            (threads === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-40 animate-pulse bg-surface" />
                <div className="h-4 w-3/4 max-w-md animate-pulse bg-surface/60" />
              </div>
            ) : threads.length === 0 ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                No threads yet — start the conversation.
              </p>
            ) : (
              <>
                <div className={`border-y border-border divide-y divide-border${dense('threads') ? ' [&_a]:py-1.5' : ''}`}>
                  {threads.slice(0, threadsCount).map(t => (
                    <Link
                      key={t.id}
                      href={`/threads/${t.id}`}
                      className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface"
                    >
                      <MessageSquare size={14} className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-text tracking-tight">
                          {t.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint min-w-0">
                          {t.seriesName && (
                            <>
                              <span
                                className="font-semibold whitespace-nowrap shrink-0"
                                style={{ color: t.seriesColor ?? undefined }}
                              >
                                {t.seriesName}
                              </span>
                              <span>·</span>
                            </>
                          )}
                          <span className="tnum">{relativeAgo(new Date(t.createdAt), now)}</span>
                        </span>
                      </span>
                      <ArrowUpRight size={13} className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
                    </Link>
                  ))}
                </div>
                <Link
                  href="/threads"
                  className="group mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
                >
                  All threads
                  <ArrowUpRight size={13} />
                </Link>
              </>
            ))}
        </section>
      )}

      {/* ── YOUR BETS & CREDITS — opt-in, signed-in only. Open bets + balance +
             next market closing, CTA to /play. Anon → a subtle sign-in nudge. ── */}
      {!isHidden('bets') && (
        <section aria-label="Your bets and credits" className="mb-8" style={{ order: orderOf('bets') }}>
          <CollapsibleSectionHead
            title="Your bets & credits"
            sub={bets?.signedIn ? `${bets.balance.toLocaleString()} cr` : 'play money'}
            collapsed={isCollapsed('bets')}
            onToggle={() => toggleCollapsed('bets')}
          />
          {!isCollapsed('bets') &&
            (bets === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-1/3 animate-pulse bg-surface" />
                <div className="h-4 w-2/3 animate-pulse bg-surface/60" />
              </div>
            ) : !bets.signedIn ? (
              <p className="border-y border-border py-4 text-sm text-text-faint">
                <Link href="/play" className="text-text-muted underline underline-offset-2 hover:text-text">
                  Sign in to play
                </Link>{' '}
                — free credits, predict each race, climb the table.
              </p>
            ) : (
              <div className="border-y border-border py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-faint">
                    <Coins size={13} className="text-brand" />
                    Balance
                  </span>
                  <span className="font-display text-2xl font-extrabold tracking-wide text-text tnum">
                    {bets.balance.toLocaleString()}
                    <span className="ml-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-text-faint">cr</span>
                  </span>
                </div>

                {bets.openBets.length > 0 ? (
                  <ul className={`mt-3 divide-y divide-border border-y border-border${dense('bets') ? ' [&_li]:py-1.5' : ''}`}>
                    {bets.openBets.map(b => (
                      <li key={b.id} className="flex items-center gap-3 py-2 px-2 -mx-2 min-w-0">
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-[15px] font-semibold text-text tracking-tight">
                            {formatBetSelection(b.type, b.selection)}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint">
                            {b.seriesName ?? b.seriesSlug} · R{b.round}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-sm font-semibold tnum text-text">{b.stake}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 border-y border-border py-3 font-mono text-sm text-text-faint">
                    No open bets right now.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                    {bets.openCount === 1 ? '1 open bet' : `${bets.openCount} open bets`}
                    {bets.nextMarket && (
                      <>
                        {' · next closes '}
                        <span className="tnum text-text-muted">
                          {new Date(bets.nextMarket.locksAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            timeZone: 'UTC',
                          })}
                        </span>
                      </>
                    )}
                  </span>
                  <Link
                    href="/play"
                    className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
                  >
                    {bets.nextMarket ? 'Place a bet' : 'Open Play'}
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
        </section>
      )}

      {/* ── YOUR LEAGUES & FRIENDS — opt-in, signed-in only. The user's leagues
             (with their rank) + a friends summary, linking into /social. Anon →
             a subtle sign-in nudge. Empty → a join-a-league CTA. ── */}
      {!isHidden('social') && (
        <section aria-label="Your leagues and friends" className="mb-8" style={{ order: orderOf('social') }}>
          <CollapsibleSectionHead
            title="Leagues & friends"
            sub={social?.signedIn ? `${social.friends.count} friend${social.friends.count === 1 ? '' : 's'}` : 'play money'}
            collapsed={isCollapsed('social')}
            onToggle={() => toggleCollapsed('social')}
          />
          {!isCollapsed('social') &&
            (social === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-1/3 animate-pulse bg-surface" />
                <div className="h-4 w-2/3 animate-pulse bg-surface/60" />
              </div>
            ) : !social.signedIn ? (
              <p className="border-y border-border py-4 text-sm text-text-faint">
                <Link href="/social/leagues" className="text-text-muted underline underline-offset-2 hover:text-text">
                  Sign in to play with friends
                </Link>{' '}
                — join a private league and climb the table.
              </p>
            ) : (
              <div className="border-y border-border py-4">
                {social.leagues.length > 0 ? (
                  <ul className={`divide-y divide-border${dense('social') ? ' [&_a]:py-1.5' : ''}`}>
                    {social.leagues.slice(0, socialCount).map(l => (
                      <li key={l.id}>
                        <Link
                          href={`/social/leagues/${l.id}`}
                          className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface"
                        >
                          <Trophy size={14} className="shrink-0 text-text-faint group-hover:text-brand transition-colors duration-(--duration-fast)" />
                          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text tracking-tight">
                            {l.name}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted tnum">
                            {l.myRank ? `P${l.myRank}/${l.memberCount}` : `${l.memberCount} member${l.memberCount === 1 ? '' : 's'}`}
                          </span>
                          <ArrowUpRight size={13} className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-mono text-sm text-text-faint">
                    <Link href="/social/leagues" className="text-text-muted underline underline-offset-2 hover:text-text">
                      Join or create a league
                    </Link>{' '}
                    — predict races against friends.
                  </p>
                )}

                <Link
                  href="/social/friends"
                  className="group mt-3 flex items-center gap-3 border-t border-border pt-3 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface"
                >
                  <UserPlus size={14} className="shrink-0 text-text-faint group-hover:text-brand transition-colors duration-(--duration-fast)" />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text tracking-tight">
                    {social.friends.count} friend{social.friends.count === 1 ? '' : 's'}
                    {social.friends.pending > 0 && (
                      <span className="ml-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-brand tnum">
                        · {social.friends.pending} request{social.friends.pending === 1 ? '' : 's'}
                      </span>
                    )}
                  </span>
                  <ArrowUpRight size={13} className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
                </Link>
              </div>
            ))}
        </section>
      )}

      {/* ── LATEST DECODED (F1) — opt-in. The most recent past F1 round's
             qualifying (→ Decoder, pole + P2 codes) and race (→ Race Story). ── */}
      {!isHidden('latest-decoded') && (
        <section aria-label="Latest Decoded" className="mb-8" style={{ order: orderOf('latest-decoded') }}>
          <CollapsibleSectionHead
            title="Latest Decoded"
            sub={decoded ? decoded.gp : 'F1 analysis'}
            collapsed={isCollapsed('latest-decoded')}
            onToggle={() => toggleCollapsed('latest-decoded')}
          />
          {!isCollapsed('latest-decoded') &&
            (decoded === undefined ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-1/2 animate-pulse bg-surface" />
                <div className="h-4 w-2/3 animate-pulse bg-surface/60" />
              </div>
            ) : decoded === null ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                No decoded F1 session yet.
              </p>
            ) : (
              <div className="border-y border-border py-4">
                <div className="space-y-2">
                  {decoded.qualifying && (
                    <Link href={decoded.qualifying.href} className="group block min-w-0">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
                        Pole lap decoded · {decoded.gp}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 min-w-0">
                        <span className="font-display text-xl font-extrabold uppercase tracking-wide text-text leading-none">
                          Qualifying Decoder
                        </span>
                        <ArrowUpRight size={14} className="shrink-0 text-text-faint group-hover:text-text transition-colors duration-(--duration-fast)" />
                      </span>
                      {(decoded.qualifying.pole || decoded.qualifying.p2) && (
                        <span className="mt-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
                          {decoded.qualifying.pole && (
                            <span>
                              <span className="text-text-faint">POLE</span>{' '}
                              <span className="font-semibold text-text">{decoded.qualifying.pole}</span>
                            </span>
                          )}
                          {decoded.qualifying.p2 && (
                            <span>
                              <span className="text-text-faint">P2</span>{' '}
                              <span className="font-semibold text-text">{decoded.qualifying.p2}</span>
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  )}
                  {decoded.race && (
                    <Link
                      href={decoded.race.href}
                      className="group flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
                    >
                      <Play size={12} />
                      Race Story · {decoded.gp}
                      <ArrowUpRight size={12} className="opacity-60" />
                    </Link>
                  )}
                </div>
                <OpenF1Attribution className="pt-3" />
              </div>
            ))}
        </section>
      )}

      {/* ── WHERE TO WATCH — opt-in. Broadcast links for the next few upcoming
             followed sessions whose series has a `watch` link. Reads `items`
             (which already carries each session's watch link), so no fetch. ── */}
      {!isHidden('where-to-watch') && (() => {
        const rows = upcomingItems.filter(i => i.watch).slice(0, wtwCount);
        return (
          <section aria-label="Where to watch" className="mb-8" style={{ order: orderOf('where-to-watch') }}>
            <CollapsibleSectionHead
              title="Where to watch"
              sub={`${rows.length} session${rows.length === 1 ? '' : 's'}`}
              collapsed={isCollapsed('where-to-watch')}
              onToggle={() => toggleCollapsed('where-to-watch')}
            />
            {!isCollapsed('where-to-watch') &&
              (rows.length === 0 ? (
                <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                  No broadcast links for your upcoming sessions.
                </p>
              ) : (
                <div className={`border-y border-border divide-y divide-border${dense('where-to-watch') ? ' [&_a]:py-1.5' : ''}`}>
                  {rows.map(item => (
                    <a
                      key={`${item.seriesSlug}-${item.session.uid}`}
                      href={item.watch!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface"
                    >
                      <Tv size={14} className="shrink-0 text-text-faint group-hover:text-brand transition-colors duration-(--duration-fast)" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-text tracking-tight">
                          {item.session.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint min-w-0">
                          <span className="font-semibold whitespace-nowrap shrink-0" style={{ color: item.color }}>
                            {item.seriesName}
                          </span>
                          <span>·</span>
                          <span className="truncate">Watch on {item.watch!.service}</span>
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-text-muted tnum">
                        {item.session.dateOnly ? 'TBC' : formatRelative(item.session.start, now)}
                      </span>
                      <ArrowUpRight size={13} className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
                    </a>
                  ))}
                </div>
              ))}
          </section>
        );
      })()}

      {/* ── NEXT-RACE WEATHER — opt-in. The forecast for the next followed
             session that has one (server resolves weatherByUid; client picks the
             next upcoming item with an entry). No fetch. ── */}
      {!isHidden('next-weather') && (() => {
        const item = upcomingItems.find(i => weatherByUid?.[i.session.uid]);
        const w = item ? weatherByUid?.[item.session.uid] : undefined;
        const wl = w ? weatherLabel(w.weatherCode) : null;
        return (
          <section aria-label="Next-race weather" className="mb-8" style={{ order: orderOf('next-weather') }}>
            <CollapsibleSectionHead
              title="Next-race weather"
              sub={item ? item.seriesName : 'next round'}
              collapsed={isCollapsed('next-weather')}
              onToggle={() => toggleCollapsed('next-weather')}
            />
            {!isCollapsed('next-weather') &&
              (!item || !w || !wl ? (
                <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                  No forecast for your next round yet.
                </p>
              ) : (
                <Link
                  href={hrefFor(item)}
                  className={`group block border-y border-border ${dense('next-weather') ? 'py-3' : 'py-4'}`}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold" style={{ color: item.color }}>{item.seriesName}</span>
                    </span>
                    {item.session.location && (
                      <span className="inline-flex items-center gap-1 text-text-faint">
                        <MapPin size={11} />
                        {item.session.location.split(',')[0].trim()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-3xl leading-none" aria-hidden="true">{wl.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-lg font-bold uppercase tracking-wide text-text">
                        {item.session.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted tnum">
                        <span>{wl.label}</span>
                        <span>·</span>
                        <span>{Math.round(w.maxC)}° / {Math.round(w.minC)}°</span>
                        {w.precipProb >= 30 && (
                          <>
                            <span>·</span>
                            <span>{Math.round(w.precipProb)}% rain</span>
                          </>
                        )}
                      </span>
                    </span>
                    <ArrowUpRight size={13} className="shrink-0 self-start text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
                  </div>
                </Link>
              ))}
          </section>
        );
      })()}

      {/* ── DRIVER SPOTLIGHT — opt-in, default-hidden. A rotating sample of
             drivers from the curated lineups, deep-linked into /drivers and
             /teams. Defer-fetched (edge-cached + time-rotated route). ── */}
      {!isHidden('driver-spotlight') && (
        <section aria-label="Driver spotlight" className="mb-8" style={{ order: orderOf('driver-spotlight') }}>
          <CollapsibleSectionHead
            title="Driver spotlight"
            sub="from your series"
            collapsed={isCollapsed('driver-spotlight')}
            onToggle={() => toggleCollapsed('driver-spotlight')}
          />
          {!isCollapsed('driver-spotlight') &&
            (spotlight === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-40 animate-pulse bg-surface" />
                <div className="h-4 w-3/4 max-w-md animate-pulse bg-surface/60" />
              </div>
            ) : spotlight.length === 0 ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                No drivers to spotlight right now.
              </p>
            ) : (
              <div className={`border-y border-border divide-y divide-border${dense('driver-spotlight') ? ' [&_a]:py-1.5' : ''}`}>
                {spotlight.slice(0, spotlightCount).map(d => (
                  <div
                    key={`${d.seriesSlug}-${d.slug}`}
                    className="flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0"
                  >
                    <span className="self-stretch w-[3px] shrink-0" style={{ backgroundColor: d.teamColor ?? d.seriesColor }} />
                    <Users size={14} className="shrink-0 text-text-faint" />
                    <span className="flex-1 min-w-0">
                      <Link href={`/drivers/${d.slug}`} className="group inline-flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-[15px] font-semibold text-text tracking-tight group-hover:text-brand transition-colors duration-(--duration-fast)">
                          {d.name}
                        </span>
                        {d.code && (
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">{d.code}</span>
                        )}
                        <ArrowUpRight size={12} className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
                      </Link>
                      <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint min-w-0">
                        <span className="font-semibold whitespace-nowrap shrink-0" style={{ color: d.seriesColor }}>
                          {d.seriesName}
                        </span>
                        <span>·</span>
                        <Link href={`/teams/${d.teamSlug}`} className="truncate hover:text-text-muted transition-colors duration-(--duration-fast)">
                          {d.team}
                        </Link>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
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
