'use client';
import Link from 'next/link';
import { Tour } from '@/components/Tour';
import { seriesInk } from '@/lib/site';
import { useEffect, useRef, useState } from 'react';
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
import { HomeLauncher, type LauncherSeries } from '@/components/HomeLauncher';

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
  /** Feed thumbnail (see enclosureImage in lib/news.ts). Optional — the card
      falls back to its series-colour wash. */
  image?: string;
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
  /** Curated cover URL, licence-gated by normalizeHeroImage (lib/blog.ts).
      Usually null — the lead-story card falls back to its gradient. Mirrors
      HomeBlogItem in app/(app)/api/home/from-the-blog/route.ts. */
  heroImage: string | null;
}

interface HomeStandingsItem {
  slug: string;
  name: string;
  color: string;
  leader: { name: string; points: number };
  gapToSecond: number | null;
  top: { position: number; name: string; points: number }[];
}

// Mirrors the /api/home/movers route export (lib/standings/movers SeriesMovers).
interface HomeMoversItem {
  slug: string;
  name: string;
  color: string;
  latestRound: string;
  movers: { name: string; rank: number; points: number; delta: number | null }[];
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

// Mirrors the /api/home/upgrades route export.
interface HomeUpgradesData {
  round: number;
  gp: string;
  totalParts: number;
  teams: { team: string; count: number }[];
}

const NEWS_LIMIT = 10;

/* ── PADDOCK WIRE filter persistence ─────────────────────────────────────
   The wire's active series filter survives reloads via localStorage. Read
   returns null (= "All", the default) on the server and for any absent or
   malformed value, so the first render always matches the SSR default and the
   stored slug is adopted after mount (see the effect below) — no hydration
   mismatch. Mirrors the `typeof window` guarding in lib/follow.ts. */
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
  series,
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
  // All series (slug/name/color/category) for the Jump-to launcher pickers.
  series: LauncherSeries[];
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
  // Layout is read here (order / hidden / collapsed); the customise CONTROLS live
  // at /settings/customize. The home keeps an inline collapse toggle on its
  // collapsible blocks.
  const { layout, toggleCollapsed } = useHomeLayout();
  // Starts at the SSR default ("All" = null); the persisted slug is adopted
  // after mount so the hydration render matches the server HTML. Guarded so a
  // stored series that's since dropped out of the feed can still be re-picked
  // from the chips (the value is validated against the rendered set at use).
  const [newsFilter, setNewsFilter] = useState<string | null>(null);
  useEffect(() => {
    const stored = readStoredNewsFilter();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stored-filter adoption after mount is the hydration-safe pattern (SSR renders the default; one sync pass swaps in the persisted choice)
    if (stored !== null) setNewsFilter(stored);
  }, []);
  // Persist on every change so the wire re-opens on the last-used filter.
  const selectNewsFilter = (slug: string | null) => {
    setNewsFilter(slug);
    writeStoredNewsFilter(slug);
  };
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
  const seriesResultsShown =
    !layout.hidden.includes('series-just-missed') && !layout.collapsed.includes('series-just-missed');
  const needJustMissed = seriesResultsShown;
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
  // This ONE response also feeds the chyron's lead-story card, which ships
  // visible by default while this widget is default-hidden — hence the gate is
  // "chyron shown OR widget shown + expanded", never two fetches of the same
  // endpoint.
  const [blogPosts, setBlogPosts] = useState<HomeBlogItem[] | null>(null);
  const blogHidden = layout.hidden.includes('from-the-blog');
  const blogCollapsed = layout.collapsed.includes('from-the-blog');
  const chyronHidden = layout.hidden.includes('chyron');
  const needBlog = !chyronHidden || !(blogHidden || blogCollapsed);
  useEffect(() => {
    if (!needBlog) return;
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
  }, [needBlog]);

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

  // STANDINGS MOVERS — opt-in, default-hidden. Round-over-round rank change per
  // series (F1/F3/MotoGP eligible); the route filters to eligible+has-data, so
  // its response defines what renders. Same defer-fetch shape as standings.
  const [movers, setMovers] = useState<HomeMoversItem[] | null>(null);
  const moversShown =
    !layout.hidden.includes('standings-movers') && !layout.collapsed.includes('standings-movers');
  const moversParam = followed === null ? 'all' : followed.join(',');
  useEffect(() => {
    if (!moversShown || !moversParam) return;
    let alive = true;
    fetch(`/api/home/movers?series=${encodeURIComponent(moversParam)}`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => {
        if (alive) setMovers(d as HomeMoversItem[]);
      })
      .catch(() => {
        if (alive) setMovers([]);
      });
    return () => {
      alive = false;
    };
  }, [moversShown, moversParam]);

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

  // F1 CAR UPGRADES — opt-in, default-hidden. The latest F1 round's declared
  // parts per team (from the curated FIA Car Presentation sidecar). Same
  // defer-fetch shape; undefined = loading, null = nothing curated yet.
  const [upgrades, setUpgrades] = useState<HomeUpgradesData | null | undefined>(undefined);
  const upgradesHidden = layout.hidden.includes('f1-upgrades');
  const upgradesCollapsed = layout.collapsed.includes('f1-upgrades');
  useEffect(() => {
    if (upgradesHidden || upgradesCollapsed) return;
    let alive = true;
    fetch('/api/home/upgrades')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (alive) setUpgrades(d as HomeUpgradesData | null);
      })
      .catch(() => {
        if (alive) setUpgrades(null);
      });
    return () => {
      alive = false;
    };
  }, [upgradesHidden, upgradesCollapsed]);

  // Until followed-series prefs resolve on the client, render a skeleton — never
  // the unfiltered page. /app is statically cached / user-agnostic, so the SSR
  // HTML can't know the user's series; without this gate it paints EVERY series
  // (chyron, week, wire, just-missed) and the post-hydration filter then yanks
  // the non-followed ones away — the personalization flash. Skeleton → your
  // paddock, never other-series data. Guests resolve from localStorage in ~1
  // frame; signed-in returns from the local mirror (see useFollowedSeries).
  /* ── Masonry row-span solver ───────────────────────────────────────────────
     A plain 12-col row grid puts two blocks per row and `items-start` leaves the
     height difference between them empty: the taller block sets the row height and
     the shorter one's leftover is unreachable — `grid-flow-dense` cannot reclaim it
     because the hole sits INSIDE a row rather than being an empty cell.

     So the grid runs on a fine auto-row track and each block's measured height is
     expressed as a row span, which turns that leftover into real empty cells for
     dense packing to backfill. Identity:
       span = ceil((height + marginBottom) / row)

     The grid's own row-gap is 0 on purpose: with a 32px row gap the span
     granularity becomes 4+32=36px rather than 4px, and every block over-reserves
     by up to a full gap — which is what left ~90px voids on the first attempt.
     Spacing lives in each block's margin-bottom instead, folded into its span.

     Three things keep this from being the footgun it was on the first attempt:

     1. Spans live in React state and render through `style`. Written imperatively
        they were erased on every render, because these blocks already own a
        `style` prop for their `order`.
     2. The fine track is applied ONLY once spans exist (`masonry` below). A fixed
        4px auto-row does not grow to fit an unspanned item, so without this the
        blocks all reserve one 4px row and pile onto row 1. Layout must never
        DEPEND on this effect having run — with no spans it degrades to the plain
        row grid, gaps and all.
     3. +1 row of slack per block, so content that grows slightly between a resize
        and the next solve overflows into spare track instead of the next block.

     Measurement needs no reset pass: `items-start` means a block's height is its
     CONTENT height whatever span it carries, so writing a span cannot change what
     was just measured — which is what would otherwise make the observer loop. */
  const masonryRef = useRef<HTMLDivElement>(null);
  const [spans, setSpans] = useState<Record<string, number>>({});
  const masonry = Object.keys(spans).length > 0;
  useEffect(() => {
    const root = masonryRef.current;
    if (!root) return;
    const ROW = 4;
    const mq = window.matchMedia('(min-width: 1280px)');

    const solve = () => {
      const blocks = Array.from(root.querySelectorAll('[data-home-block]')) as HTMLElement[];
      // Below the grid breakpoint it is a plain flex column; drop every span so
      // none of this can leak into the stacked mobile layout.
      if (!mq.matches) {
        setSpans(prev => (Object.keys(prev).length === 0 ? prev : {}));
        return;
      }
      const next: Record<string, number> = {};
      for (const el of blocks) {
        const id = el.dataset.homeBlock;
        if (!id) continue;
        const h = el.getBoundingClientRect().height;
        if (h <= 0) continue; // display:none / not yet laid out — leave it unspanned
        // Row gap is 0 (see the container); the visual gap is the block's own
        // margin-bottom, so it has to be inside the reserved track or the next
        // block lands on top of it.
        const mb = parseFloat(getComputedStyle(el).marginBottom) || 0;
        next[id] = Math.max(1, Math.ceil((h + mb) / ROW) + 1);
      }
      setSpans(prev => {
        const keys = Object.keys(next);
        if (keys.length === Object.keys(prev).length && keys.every(k => prev[k] === next[k])) {
          return prev;
        }
        return next;
      });
    };

    solve();
    // Heights move constantly here: deferred widgets post-load, sections collapse,
    // countdowns retick. One observer over the container plus each block catches
    // all of it; the callback runs after layout and before paint, so a corrected
    // span usually lands in the same frame the content grew in.
    const ro = new ResizeObserver(solve);
    ro.observe(root);
    for (const el of Array.from(root.querySelectorAll('[data-home-block]'))) ro.observe(el);
    mq.addEventListener('change', solve);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', solve);
    };
    // `layout` and `hydrated` are the only things that change block MEMBERSHIP.
    // hydrated matters most: the grid is not mounted on the first render (the
    // skeleton is), so without it the effect bails on a null ref and never re-runs.
  }, [layout, hydrated]);

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
  const schedDays = cfg('schedule').days === 3 ? 3 : 7;
  const newsCount = cfg('news').count ?? NEWS_LIMIT;
  const blogCount = cfg('from-the-blog').count ?? 4;
  // championship-leader subset. An ABSENT or EMPTY set both mean "all followed"
  // (the customise UI can persist [] when every series is deselected — treating
  // that as "show nothing" left a blank block). A non-empty set filters.
  const leaderSet = cfg('championship-leader').seriesSet;
  const leaderRows = (standings ?? []).filter(
    s => !leaderSet || leaderSet.length === 0 || leaderSet.includes(s.slug),
  );
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
  const chyronPad = dense('chyron') ? 'py-4' : 'py-7 md:py-9';

  const liveItems = filteredSessions.filter(
    i => !i.session.dateOnly && i.session.start <= now && now <= i.session.end,
  );
  const upcomingItems = filteredSessions.filter(i =>
    i.session.dateOnly ? i.session.end > now : i.session.start > now,
  );
  const next = upcomingItems[0];
  // Busy-race-day hero: when the 2nd/3rd upcoming sessions land within ~24h of
  // the primary countdown, surface them compactly beneath it (a race day is
  // quali + sprint + race stacked together). Otherwise the hero stays a single
  // session. Only when the primary has a precise start (dateOnly = "this
  // weekend, time TBC" has nothing to measure 24h from, and its countdown block
  // is hidden anyway); companions without a precise start are skipped too.
  const HERO_WINDOW_MS = 24 * 60 * 60 * 1000;
  const heroUpNext =
    next && !next.session.dateOnly
      ? upcomingItems
          .slice(1, 4)
          .filter(
            i =>
              !i.session.dateOnly &&
              i.session.start.getTime() - next.session.start.getTime() <= HERO_WINDOW_MS,
          )
      : [];

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
  // A persisted filter (from localStorage) is honoured only while its series is
  // still in the feed; if that series has dropped out we fall back to "All" so a
  // stale stored slug can't strand the wire on an empty, unresettable view (the
  // chip bar hides when there's ≤1 series, leaving no in-UI way to clear it).
  const effectiveNewsFilter =
    newsFilter && seriesWithNews.some(s => s.slug === newsFilter) ? newsFilter : null;
  // Dedupe by link before slicing: motorsport.com cross-posts the same story
  // to multiple series feeds, so an unfiltered "All" view rendered it twice
  // back-to-back under different chips (heuristic walk 2026-06). Per-series
  // filtering is unaffected — a single-series view has no cross-series dups.
  const newsForView = effectiveNewsFilter
    ? filteredNews.filter(n => n.seriesSlug === effectiveNewsFilter)
    : filteredNews;
  const seenLinks = new Set<string>();
  const topNews = newsForView
    .filter(n => (seenLinks.has(n.link) ? false : seenLinks.add(n.link)))
    .slice(0, newsCount);

  const isEmptyFromFilter =
    hydrated && followed !== null && followed.length < items.length;

  const nextWeather = next ? weatherByUid?.[next.session.uid] : undefined;
  const nextW = nextWeather ? weatherLabel(nextWeather.weatherCode) : null;

  // LEAD STORY — the newest published post fronts the band and the countdown
  // demotes to the strip beneath it (operator brief 2026-07-28). Reads the
  // from-the-blog payload already fetched above: no new route, no new type.
  // `blogPosts === null` is still loading; `[]` means no posts OR a failed fetch
  // (the catch normalises both to []) and falls through to the blog-invite copy,
  // so the hero can never render as an empty box.
  // Source cascade, because `publishedPosts()` (lib/blog.ts:170) reads the
  // Supabase `post` table ONLY: the three posts on /blog are legacy MDX files in
  // content/posts, so on a day with no DB post the payload is [] and the hero had
  // nothing to lead with. Falling back to the top wire story keeps the band a
  // real front page — and the wire now carries a photograph, so this is also the
  // path that guarantees the hero is never art-less. Editorial still outranks the
  // wire when a post exists — but ONLY when that post can bring its own art.
  // heroImage is optional in the editor and usually unset, and a cover-less post
  // blocked the wire fallback, which is why the band kept coming up as a bare
  // gradient: a post existed, so the wire was never consulted. A post with no
  // cover now stays out of the hero (it still shows in "From the blog") and the
  // top wire story leads instead, because that always carries a photograph.
  const newestPost = blogPosts?.[0] ?? null;
  const leadPost = newestPost?.heroImage ? newestPost : null;
  const leadWire = !leadPost && topNews.length > 0 ? topNews[0] : null;
  // The live branch's subordinate "Lead story" line links the newest post
  // whatever its art, since it is a text line with no cover panel.
  const lead = newestPost;
  const leadSeriesSlug = leadPost?.seriesSlug ?? leadWire?.seriesSlug ?? null;
  const leadSeries = leadSeriesSlug
    ? series.find(s => s.slug === leadSeriesSlug) ?? null
    : null;
  // Fills (the cover wash, the foot rule) take the raw series colour — the
  // sanctioned use; the tag's TEXT goes through seriesInk. A post with no series
  // (or one we don't carry) falls back to the brand token, like the rail below.
  const leadAccent = leadSeries?.color ?? 'var(--brand)';
  const leadTagStyle = leadSeries
    ? { color: seriesInk(leadSeries.color), borderColor: seriesInk(leadSeries.color) }
    : undefined;
  const leadTag = leadSeries?.name ?? 'Paddock';
  // The wire lead leaves the site, so it needs the same target/rel the cards use.
  const leadExternal = !leadPost && Boolean(leadWire);
  const leadHref = leadPost ? `/blog/${leadPost.slug}` : leadWire ? leadWire.link : '/blog';
  const leadImage = leadPost?.heroImage ?? leadWire?.image ?? null;
  const leadTitle = leadPost?.title ?? leadWire?.title ?? 'Long-reads from the paddock';
  const leadSummary =
    leadPost?.summary ??
    leadWire?.description ??
    'Previews, race reports and explainers from the Paddock desk.';
  const leadCta = leadPost ? 'Read article' : leadWire ? 'Read the story' : 'Open the blog';

  // Home-layout customization: each top-level block gets a CSS `order` from the
  // user's prefs (so the DEFAULT order renders identically), and hidden blocks
  // are dropped. Applied on a flex column below.
  // Scaled ×2 so the fixed Jump-to launcher can slot at an odd order (1) directly
  // under the chyron (order 0), above the first controllable block (order ≥2).
  const orderOf = (id: HomeElementId): number => {
    const i = layout.order.indexOf(id);
    return (i < 0 ? 99 : i) * 2;
  };
  // Every direct grid child goes through this: the customise `order`, the masonry
  // span, and the id the solver measures against, in one place. A child WITHOUT
  // data-home-block would never get a span and would overlap its neighbours.
  const blockProps = (id: string, order: number) => ({
    'data-home-block': id,
    style: {
      order,
      gridRowEnd: spans[id] ? `span ${spans[id]}` : undefined,
    } as React.CSSProperties,
  });

  const isHidden = (id: HomeElementId): boolean => layout.hidden.includes(id);
  const isCollapsed = (id: HomeElementId): boolean => layout.collapsed.includes(id);

  return (
    <>
      <h1 className="sr-only">
        Paddock Tracker — live motorsport schedule and news across F1, MotoGP, WEC,
        Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more
      </h1>

      {/* Desktop (≥xl) lays the blocks on a 12-column grid — each block spans 6
          (two magazine columns) so the fluid container is used instead of being
          stretched into over-long rows; the chyron and the launcher span all 12,
          and 2K+ only widens the gutter. Below xl it stays a single flex column
          (mobile/tablet unchanged).
          Blocks are AUTO-PLACED on purpose: CSS `order` (set inline from the
          customise prefs) drives grid auto-placement, but any explicit line
          placement (col-start-*, grid-column: N / span M) makes the browser
          ignore `order` outright — which would silently break user ordering.
          Uniform spans also keep auto-placement hole-free under any order. The
          chyron's full-bleed negative margins are only safe while it spans the
          whole row; narrow it and they bleed into the neighbouring column. */}
      <div
        ref={masonryRef}
        className={`flex flex-col xl:grid xl:grid-cols-12 xl:gap-x-8 xl:gap-y-0 xl:items-start 3xl:gap-x-10${
          masonry ? ' xl:auto-rows-[4px] xl:grid-flow-row-dense' : ''
        }`}
      >
      {/* ── Jump-to launcher — fixed quick-access nav, pinned directly under the
             chyron hero (order 1 sits between the chyron at 0 and the first
             controllable block at ≥2). Shown to everyone; all content is public. ── */}
      {/* Sits tight under the chyron on purpose: as a lone bordered rail with
          section-sized margins above and below it read as an orphan strip
          (operator 2026-07-28). Small gap + the same surface panel as the
          sections below binds it to the page. */}
      <div className="mb-8 xl:col-span-12" {...blockProps('launcher', 1)}>
        <HomeLauncher series={series} />
      </div>
      {/* ── Chyron — the broadcast strip. Live takes over; otherwise the lead
             story fronts it and the next session rides beneath as a compact
             countdown strip. ── */}
      {!isHidden('chyron') && (
      <section
        aria-label={liveItems.length > 0 ? 'Live now' : 'Lead story and up next'}
        data-tour="chyron"
        {...blockProps('chyron', orderOf('chyron'))}
        className="relative mb-8 border-t border-b-2 border-border-strong bg-surface -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 xl:col-span-12"
      >
        {/* Series-coloured rail — scales the schedule row's 3px spine up to the
            full-bleed hero band, so the dominant block is identified by series
            colour before any text is read. Raw series hex on a fill is the
            sanctioned use (see lib/site.ts — only text goes through seriesInk). */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ backgroundColor: liveItems[0]?.color ?? next?.color ?? 'var(--brand)' }}
        />
        {liveItems.length > 0 ? (
          <>
          <div className="divide-y divide-border">
            {liveItems.map(item => (
              <div key={`${item.seriesSlug}-${item.session.uid}`} className={chyronPad}>
              <Link
                href={hrefFor(item)}
                className="group flex flex-wrap items-center gap-x-3 gap-y-2"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="relative inline-flex">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-60 animate-ping motion-reduce:animate-none" />
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-live" />
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.2em] font-bold text-live">
                    Live
                  </span>
                </span>
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.14em] font-semibold"
                  style={{ color: seriesInk(item.color) }}
                >
                  {item.seriesName}
                </span>
                <span className="font-display text-[clamp(2.5rem,7vw,3.75rem)] font-extrabold uppercase tracking-wide text-text leading-[0.9] text-balance basis-full md:basis-auto md:flex-1 min-w-0">
                  {item.session.title}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
                  {elapsedLabel(item.session.start, now)} in
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted group-hover:text-text transition-colors duration-(--duration-fast)">
                  Open
                  <ArrowUpRight size={13} aria-hidden="true" />
                </span>
              </Link>
              {item.watch && (
                <a
                  href={item.watch.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted hover:text-brand transition-colors duration-(--duration-fast)"
                >
                  <Tv size={12} aria-hidden="true" />
                  Watch on {item.watch.service}
                  <ArrowUpRight size={12} aria-hidden="true" className="opacity-60" />
                </a>
              )}
              </div>
            ))}
          </div>
          {/* Live outranks editorial: while anything is on track the lead story
              collapses to one subordinate line, so the rows above stay the
              dominant thing in the band. */}
          {lead && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-3">
              <span className="font-mono text-[10px] leading-none font-semibold uppercase tracking-[0.14em] text-text-faint">
                Lead story
              </span>
              <Link
                href={`/blog/${lead.slug}`}
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-text hover:text-brand transition-colors duration-(--duration-fast)"
              >
                <span className="min-w-0 truncate text-sm font-semibold tracking-tight">
                  {lead.title}
                </span>
                <ArrowUpRight size={12} aria-hidden="true" className="shrink-0 opacity-60" />
              </Link>
            </div>
          )}
          </>
        ) : (
          <div className={chyronPad}>
          {/* ── LEAD STORY — the home's front page (operator brief 2026-07-28:
                 editorial takes prime real estate, the countdown demotes to the
                 strip below). The cover is the post's own `heroImage` when it has
                 one — operator-curated and licence-gated by normalizeHeroImage
                 (lib/blog.ts), the only third-party art in this app cleared for
                 display — and the series-colour gradient otherwise. Most posts
                 carry no cover, so the gradient is the common path, not the edge.
                 Four paths, all clean: loading (skeleton), a post with a cover, a
                 post without, and no post at all (blog-invite copy, so the hero
                 is never an empty box). ── */}
          {blogPosts === null ? (
            <div
              aria-hidden="true"
              className="grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-center md:gap-8"
            >
              <div className="aspect-[16/10] w-full animate-pulse motion-reduce:animate-none border border-border bg-surface-elevated" />
              <div className="space-y-3">
                <div className="h-3 w-24 animate-pulse motion-reduce:animate-none bg-surface-elevated" />
                <div className="h-9 w-full animate-pulse motion-reduce:animate-none bg-surface-elevated" />
                <div className="h-9 w-2/3 animate-pulse motion-reduce:animate-none bg-surface-elevated/60" />
                <div className="h-10 w-36 animate-pulse motion-reduce:animate-none bg-surface-elevated/60" />
              </div>
            </div>
          ) : (
            <div className="group grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-center md:gap-8">
              {/* Cover panel — the series colour rising out of a thick foot rule,
                  the wire cards' language at hero scale. The headline sits in the
                  SECOND column, never on the wash: over the strong end of the mix
                  its contrast would ride on the series hue and go muddy on the
                  two light themes. */}
              <div className="relative aspect-[16/10] w-full overflow-hidden border border-border bg-surface-elevated">
                {leadImage ? (
                  /* A post's own cover, or the wire lead's feed thumbnail.
                     next/image is pointless here — next.config.ts sets
                     images.unoptimized (the Workers runtime has no optimizer), so
                     this is a raw fetch either way. eager, because this one IS the
                     LCP element; the gradient stays behind it so a failed load
                     degrades to the wash rather than a hole. */
                  <img
                    src={leadImage}
                    alt=""
                    loading="eager"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-(--duration-fast) motion-safe:group-hover:scale-[1.03]"
                  />
                ) : (
                  /* No cover on the post — the common case, since heroImage is
                     optional in the editor. A bare wash read as a broken image
                     (operator 2026-07-28), so the series wordmark is ghosted over
                     it to make the panel look authored rather than failed. */
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 transition-transform duration-(--duration-fast) motion-safe:group-hover:scale-[1.03]"
                      style={{
                        backgroundImage: `linear-gradient(to top, color-mix(in srgb, ${leadAccent} 62%, transparent), color-mix(in srgb, ${leadAccent} 16%, transparent) 48%, transparent)`,
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 bottom-4 truncate font-display text-[clamp(1.75rem,5vw,3rem)] font-extrabold uppercase leading-none tracking-wide text-text/15"
                    >
                      {leadTag}
                    </span>
                  </>
                )}
                <span
                  className={`absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate border px-2 py-1 font-mono text-[10px] leading-none font-bold uppercase tracking-[0.2em]${leadSeries ? '' : ' border-brand/40 text-brand'}`}
                  style={leadTagStyle}
                >
                  {leadTag}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-1.5"
                  style={{ backgroundColor: leadAccent }}
                />
              </div>
              <div className="min-w-0">
                <div className="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="inline-flex items-center bg-brand-fill px-2 py-1 font-mono text-[11px] leading-none uppercase tracking-[0.2em] font-bold text-tint-contrast">
                    Lead story
                  </span>
                  {(leadPost?.publishedAt || leadWire) && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint tnum">
                      {leadPost?.publishedAt
                        ? relativeAgo(new Date(leadPost.publishedAt), now)
                        : `${relativeAgo(new Date(leadWire!.pubDate), now)} · motorsport.com`}
                    </span>
                  )}
                </div>
                {/* A wire lead leaves the site, so it gets a plain <a> with
                    target/rel; a post stays internal and keeps next/link
                    prefetching. Same classes either way. */}
                <h2 className="font-display text-[clamp(1.75rem,4.2vw,3rem)] font-extrabold tracking-tight text-text leading-[1.03] text-balance">
                  {leadExternal ? (
                    <a
                      href={leadHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-brand transition-colors duration-(--duration-fast)"
                    >
                      {leadTitle}
                    </a>
                  ) : (
                    <Link
                      href={leadHref}
                      className="hover:text-brand transition-colors duration-(--duration-fast)"
                    >
                      {leadTitle}
                    </Link>
                  )}
                </h2>
                {leadSummary && (
                  <p className="mt-2.5 max-w-prose text-sm md:text-base leading-snug text-text-muted line-clamp-2">
                    {leadSummary}
                  </p>
                )}
                {leadExternal ? (
                  <a
                    href={leadHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 bg-brand-fill px-4 py-2.5 font-mono text-[11px] leading-none font-bold uppercase tracking-[0.16em] text-tint-contrast transition-opacity duration-(--duration-fast) hover:opacity-90"
                  >
                    {leadCta}
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                ) : (
                  <Link
                    href={leadHref}
                    className="mt-4 inline-flex items-center gap-1.5 bg-brand-fill px-4 py-2.5 font-mono text-[11px] leading-none font-bold uppercase tracking-[0.16em] text-tint-contrast transition-opacity duration-(--duration-fast) hover:opacity-90"
                  >
                    {leadCta}
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          )}
          {next ? (
            <>
            {/* UP NEXT — demoted from the old 4.5rem hero countdown to one compact
                strip. Every fact the hero carried survives (series, session,
                local time, venue, forecast, broadcast); only the type scale drops,
                so the lead story above clearly outranks it. The session title and
                the affordance are separate anchors: the old hero was one big link,
                which a card that owns its own links can no longer nest inside. */}
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border border-border bg-surface-elevated px-3 py-2.5">
              <span className="inline-flex items-center bg-brand-fill px-2 py-1 font-mono text-[10px] leading-none uppercase tracking-[0.2em] font-bold text-tint-contrast">
                Up next
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="w-2 h-2 shrink-0 rounded-full"
                  style={{ backgroundColor: next.color }}
                />
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.14em] font-semibold"
                  style={{ color: seriesInk(next.color) }}
                >
                  {next.seriesName}
                </span>
              </span>
              <Link
                href={hrefFor(next)}
                className="inline-flex min-w-0 basis-full items-center gap-1.5 text-text hover:text-brand transition-colors duration-(--duration-fast) md:basis-auto md:flex-1"
              >
                <span className="min-w-0 truncate text-sm font-semibold tracking-tight">
                  {next.session.title}
                </span>
                <ArrowUpRight size={12} aria-hidden="true" className="shrink-0 opacity-60" />
              </Link>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted tnum">
                {next.session.dateOnly
                  ? 'This weekend · time TBC'
                  : `${next.session.start.toLocaleDateString('en-GB', {
                      weekday: 'short',
                      timeZone: 'UTC',
                    })} ${timeHM(next.session.start, clock)} ${tz}`}
              </span>
              {next.session.location && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-faint">
                  <MapPin size={11} aria-hidden="true" />
                  {next.session.location.split(',')[0].trim()}
                </span>
              )}
              {nextWeather && nextW && (
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted tnum">
                  {nextW.emoji} {Math.round(nextWeather.maxC)}°/
                  {Math.round(nextWeather.minC)}°
                  {nextWeather.precipProb >= 30 &&
                    ` · ${Math.round(nextWeather.precipProb)}% rain`}
                </span>
              )}
              {!next.session.dateOnly && (
                <span className="ml-auto font-mono text-sm md:text-base font-bold leading-none text-text tnum">
                  <Countdown to={next.session.start} initialNow={now} />
                </span>
              )}
              {next.watch ? (
                <a
                  href={next.watch.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 border border-border-strong px-2.5 py-1.5 font-mono text-[10px] leading-none font-semibold uppercase tracking-[0.14em] text-text-muted hover:text-brand transition-colors duration-(--duration-fast)"
                >
                  <Tv size={12} aria-hidden="true" />
                  Watch live
                  <ArrowUpRight size={11} aria-hidden="true" className="opacity-60" />
                </a>
              ) : (
                <Link
                  href={hrefFor(next)}
                  className="inline-flex items-center gap-1.5 border border-border-strong px-2.5 py-1.5 font-mono text-[10px] leading-none font-semibold uppercase tracking-[0.14em] text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
                >
                  {roundFor(next.seriesSlug, next.session.uid) ? 'Open weekend' : 'Open series'}
                  <ArrowUpRight size={11} aria-hidden="true" />
                </Link>
              )}
            </div>
            {heroUpNext.length > 0 && (
              <div className="mt-3">
                <div className="mb-2 font-mono text-[10px] leading-none uppercase tracking-[0.12em] text-text-faint">
                  Also today
                </div>
                <div className="flex flex-col gap-2.5">
                  {heroUpNext.map(item => (
                    <Link
                      key={`${item.seriesSlug}-${item.session.uid}`}
                      href={hrefFor(item)}
                      className="group flex items-center gap-2 min-w-0"
                    >
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span
                        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] font-semibold"
                        style={{ color: seriesInk(item.color) }}
                      >
                        {item.seriesName}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-text">
                        {item.session.title}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted tnum">
                        {timeHM(item.session.start, clock)} {tz}
                      </span>
                      <span className="shrink-0 font-mono text-sm font-semibold tnum text-text">
                        <Countdown to={item.session.start} initialNow={now} />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            </>
          ) : (
            /* No session to count down to — the strip's slot carries the reason
               instead, so the band never ends on a dangling lead card. */
            <div className="mt-6 border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text-faint">
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
          </div>
        )}
      </section>
      )}

      {/* ── Two columns on desktop: schedule | wire. Stacked on mobile,
             schedule first. No tabs anywhere. ── */}
      {!isHidden('schedule') && (
        <section aria-label="This week's sessions" data-tour="week" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('schedule', orderOf('schedule'))}>
          <CollapsibleSectionHead
            title="This week"
            sub={`${weekItems.length} sessions · ${tz}`}
            collapsed={isCollapsed('schedule')}
            onToggle={() => toggleCollapsed('schedule')}
          />
          {!isCollapsed('schedule') && (
          <>
          {byDay.length === 0 ? (
            <div className="border-y border-border py-4 font-mono text-sm text-text-faint">
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
                <details key={day.label} open={defaultOpen} className="group mb-6">
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
                  <div className={`divide-y divide-border border-t border-border${dense('schedule') ? ' [&_a]:py-1.5' : ''}`}>
                    {day.sessions.map(s => {
                      const item = itemByUid.get(s.uid);
                      if (!item) return null;
                      const w = weatherByUid?.[s.uid];
                      const wl = w ? weatherLabel(w.weatherCode) : null;
                      return (
                        <Link
                          key={`${s.seriesSlug}-${s.uid}`}
                          href={hrefFor(item)}
                          className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface-elevated"
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
                            <span className="mt-1 flex items-center gap-1.5 font-mono text-[10px] leading-none uppercase tracking-[0.12em] text-text-faint min-w-0">
                              <span className="font-semibold whitespace-nowrap shrink-0 text-text-muted">
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
            <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
          </>
          )}
        </section>
      )}

      {!isHidden('news') && (
        <section aria-label="Latest news" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('news', orderOf('news'))}>
          <CollapsibleSectionHead
            title="Paddock wire"
            sub="motorsport.com"
            collapsed={isCollapsed('news')}
            onToggle={() => toggleCollapsed('news')}
          />
          {!isCollapsed('news') && (
          <>
          {seriesWithNews.length > 1 && (
            <div className="mb-3 -mx-1 px-1 flex gap-1.5 overflow-x-auto scrollbar-none [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%_-_1rem),transparent)]">
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
                <span className="ml-1.5 tnum opacity-70">{filteredNews.length}</span>
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
                      style={{ backgroundColor: active ? 'var(--bg)' : s.color }}
                    />
                    {s.name}
                    <span className="tnum opacity-70">{s.count}</span>
                  </button>
                );
              })}
            </div>
          )}
          {topNews.length === 0 ? (
            <div className="border-y border-border py-4 font-mono text-sm text-text-faint">
              {isEmptyFromFilter
                ? 'No recent stories from your followed series.'
                : 'Latest stories unavailable right now.'}
            </div>
          ) : (
            /* Article cards, not a divided list — the wire is the home's only
               editorial surface. Cover art is the feed's own thumbnail where the
               item has one (operator decision 2026-07-28), over a series-colour
               wash that shows through when it doesn't and when a load fails. The
               wash + kicker + foot rule is the share cards' language
               (app/(app)/blog/[slug]/opengraph-image.tsx). Density tightens
               gutters + card padding; the row-squeezing [&_a]:py-1.5 the other
               blocks use would collapse a card. */
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${dense('news') ? 'gap-3 sm:gap-4' : 'gap-4 sm:gap-5'}`}>
              {topNews.map(item => {
                const pubDate = new Date(item.pubDate);
                return (
                  <a
                    key={item.link}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col border border-border bg-surface transition-colors duration-(--duration-fast) hover:border-border-strong"
                  >
                    {/* overflow-hidden clips the hover scale so the wash can
                        never bleed past the card edge. */}
                    <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-surface-elevated">
                      {/* The wash stays underneath unconditionally so a blocked
                          or 404'd thumbnail degrades to it instead of a hole. */}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 transition-transform duration-(--duration-fast) motion-safe:group-hover:scale-[1.04]"
                        style={{
                          backgroundImage: `linear-gradient(to top, color-mix(in srgb, ${item.seriesColor} 58%, transparent), color-mix(in srgb, ${item.seriesColor} 14%, transparent) 45%, transparent)`,
                        }}
                      />
                      {item.image && (
                        /* Feed thumbnail, shown per the operator decision of
                           2026-07-28 (see enclosureImage in lib/news.ts for the
                           licensing note). Plain <img>: next.config.ts sets
                           images.unoptimized for the Workers runtime, so
                           next/image would be the same raw cross-origin fetch
                           while forcing motorsport.com's CDN into remotePatterns.
                           Lazy + async-decode keeps ten of these off the LCP path. */
                        <img
                          src={item.image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-(--duration-fast) motion-safe:group-hover:scale-[1.04]"
                        />
                      )}
                      {/* Kicker rides the clean top of the wash: over the
                          coloured foot its seriesInk would sit on a mix of its
                          own hue and go muddy on the two light themes. */}
                      <span
                        className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] truncate border px-2 py-1 font-mono text-[10px] leading-none font-bold uppercase tracking-[0.2em]"
                        style={{
                          color: seriesInk(item.seriesColor),
                          borderColor: seriesInk(item.seriesColor),
                        }}
                      >
                        {item.seriesName}
                      </span>
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-1"
                        style={{ backgroundColor: item.seriesColor }}
                      />
                    </div>
                    <div className={`flex flex-1 flex-col ${dense('news') ? 'gap-1.5 p-3' : 'gap-2 p-4'}`}>
                      <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-text group-hover:text-brand transition-colors duration-(--duration-fast)">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-sm leading-snug text-text-muted line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="mt-auto flex items-center gap-1.5 pt-1 font-mono text-[10px] leading-none uppercase tracking-[0.12em] text-text-faint min-w-0">
                        <span
                          aria-hidden="true"
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.seriesColor }}
                        />
                        <span className="tnum shrink-0">{relativeAgo(pubDate, now)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">motorsport.com</span>
                        <ExternalLink
                          size={12}
                          aria-hidden="true"
                          className="ml-auto shrink-0 group-hover:text-text-muted transition-colors duration-(--duration-fast)"
                        />
                      </div>
                    </div>
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
        <section aria-label="From the blog" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('from-the-blog', orderOf('from-the-blog'))}>
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
              <div className="h-4 w-40 animate-pulse motion-reduce:animate-none bg-surface" />
              <div className="h-4 w-3/4 max-w-md animate-pulse motion-reduce:animate-none bg-surface/60" />
            </div>
          ) : blogPosts.length === 0 ? (
            <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
              No posts published yet.
            </p>
          ) : (
            <div className={`divide-y divide-border border-t border-border${dense('from-the-blog') ? ' [&_a]:py-1.5' : ''}`}>
              {blogPosts.slice(0, blogCount).map(p => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group block py-3 px-2 -mx-2 transition-colors duration-(--duration-fast) hover:bg-surface-elevated"
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
                      aria-hidden="true"
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
            <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
          </>
          )}
        </section>
      )}

      {/* ── CHAMPIONSHIP LEADER — opt-in. Who leads each series you follow. ── */}
      {!isHidden('championship-leader') && (
        <section aria-label="Championship leader" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('championship-leader', orderOf('championship-leader'))}>
          <CollapsibleSectionHead
            title="Championship leader"
            sub="who's on top"
            collapsed={isCollapsed('championship-leader')}
            onToggle={() => toggleCollapsed('championship-leader')}
          />
          {!isCollapsed('championship-leader') &&
            (standings === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-3/4 max-w-md animate-pulse motion-reduce:animate-none bg-surface" />
                <div className="h-4 w-1/2 animate-pulse motion-reduce:animate-none bg-surface/60" />
              </div>
            ) : standings.length === 0 ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                Standings unavailable right now.
              </p>
            ) : leaderRows.length === 0 ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                Pick a series in Customise to see its leader.
              </p>
            ) : (
              <div className={`divide-y divide-border border-t border-border${dense('championship-leader') ? ' [&_a]:py-1.5' : ''}`}>
                {leaderRows.map(s => (
                  <Link
                    key={s.slug}
                    href={`/series/${s.slug}/standings`}
                    className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface-elevated"
                  >
                    <span className="self-stretch w-[3px] shrink-0" style={{ backgroundColor: s.color }} />
                    <span
                      className="w-20 shrink-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: seriesInk(s.color) }}
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
        <section aria-label="Standings snapshot" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('standings-snapshot', orderOf('standings-snapshot'))}>
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
                      <div className="h-4 w-1/3 animate-pulse motion-reduce:animate-none bg-surface" />
                      <div className="h-4 w-2/3 animate-pulse motion-reduce:animate-none bg-surface/60" />
                    </div>
                  ) : !brief ? (
                    <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                      Pick a series in Customise to see its table.
                    </p>
                  ) : (
                    <>
                      <ol className={`divide-y divide-border border-t border-border${dense('standings-snapshot') ? ' [&_li]:py-1.5' : ''}`}>
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
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </Link>
                    </>
                  ))}
              </>
            );
          })()}
        </section>
      )}
      {/* ── STANDINGS MOVERS — opt-in, default-hidden. Round-over-round rank
             change per eligible series (F1/F3/MotoGP), from the same trend the
             Standings tab charts. Fetch is deferred to when the block is shown. ── */}
      {!isHidden('standings-movers') && (
        <section aria-label="Standings movers" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('standings-movers', orderOf('standings-movers'))}>
          <CollapsibleSectionHead
            title="Standings movers"
            sub="since the last race"
            collapsed={isCollapsed('standings-movers')}
            onToggle={() => toggleCollapsed('standings-movers')}
          />
          {!isCollapsed('standings-movers') &&
            (movers === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-1/3 animate-pulse motion-reduce:animate-none bg-surface" />
                <div className="h-4 w-2/3 animate-pulse motion-reduce:animate-none bg-surface/60" />
              </div>
            ) : movers.length === 0 ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                No round-over-round changes to show yet.
              </p>
            ) : (
              <div className="space-y-5">
                {movers.map(series => {
                  // Biggest actual movers first (skip holds / season-openers).
                  const changed = series.movers
                    .filter(m => m.delta !== null && m.delta !== 0)
                    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
                    .slice(0, 5);
                  return (
                    <div key={series.slug}>
                      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em]">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: series.color }} />
                          <span className="font-semibold" style={{ color: seriesInk(series.color) }}>{series.name}</span>
                        </span>
                        <span className="text-text-faint">· after {series.latestRound}</span>
                      </div>
                      {changed.length === 0 ? (
                        <p className="border-y border-border py-3 font-mono text-xs text-text-faint">
                          No position changes this round.
                        </p>
                      ) : (
                        <ol className={`divide-y divide-border border-t border-border${dense('standings-movers') ? ' [&_li]:py-1.5' : ''}`}>
                          {changed.map(m => {
                            const up = (m.delta ?? 0) > 0;
                            return (
                              <li key={m.name} className="flex items-baseline gap-3 py-2 px-2 -mx-2 min-w-0">
                                <span
                                  className={`w-9 shrink-0 font-mono text-[11px] font-semibold tnum ${up ? 'text-brand' : 'text-red-400'}`}
                                >
                                  {up ? '▲' : '▼'}{Math.abs(m.delta!)}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{m.name}</span>
                                <span className="shrink-0 font-mono text-[11px] text-text-faint tnum">P{m.rank}</span>
                                <span className="shrink-0 font-mono text-sm font-semibold tnum text-text">{m.points}</span>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
        </section>
      )}
      {/* ── F1 CAR UPGRADES — opt-in, default-hidden. The latest F1 weekend's
             declared parts per team (curated from the FIA Car Presentation doc),
             linking to the weekend's full Upgrades section. ── */}
      {!isHidden('f1-upgrades') && (
        <section aria-label="F1 car upgrades" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('f1-upgrades', orderOf('f1-upgrades'))}>
          <CollapsibleSectionHead
            title="F1 car upgrades"
            sub="latest weekend"
            collapsed={isCollapsed('f1-upgrades')}
            onToggle={() => toggleCollapsed('f1-upgrades')}
          />
          {!isCollapsed('f1-upgrades') &&
            (upgrades === undefined ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-1/3 animate-pulse motion-reduce:animate-none bg-surface" />
                <div className="h-4 w-2/3 animate-pulse motion-reduce:animate-none bg-surface/60" />
              </div>
            ) : !upgrades ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                No F1 upgrades to show yet.
              </p>
            ) : (
              <div className="border-y border-border py-4">
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em]">
                  <span className="font-semibold text-text">{upgrades.gp}</span>
                  <span className="text-text-faint">
                    · {upgrades.totalParts} new {upgrades.totalParts === 1 ? 'part' : 'parts'}
                  </span>
                </div>
                <ol className={`divide-y divide-border${dense('f1-upgrades') ? ' [&_li]:py-1.5' : ''}`}>
                  {upgrades.teams.map(t => (
                    <li key={t.team} className="flex items-baseline gap-3 py-2 min-w-0">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{t.team}</span>
                      <span className="shrink-0 font-mono text-[11px] text-text-faint tnum">
                        {t.count} {t.count === 1 ? 'part' : 'parts'}
                      </span>
                    </li>
                  ))}
                </ol>
                <Link
                  href={`/series/f1/weekend/${upgrades.round}`}
                  className="group mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
                >
                  Full upgrades
                  <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              </div>
            ))}
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
          <section aria-label="Series countdowns" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('series-countdowns', orderOf('series-countdowns'))}>
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
                <div className={`divide-y divide-border border-t border-border${dense('series-countdowns') ? ' [&_a]:py-1.5' : ''}`}>
                  {rows.map(item => (
                    <Link
                      key={item.seriesSlug}
                      href={hrefFor(item)}
                      className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface-elevated"
                    >
                      <span className="self-stretch w-[3px] shrink-0" style={{ backgroundColor: item.color }} />
                      <span
                        className="w-20 shrink-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: seriesInk(item.color) }}
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
          <section aria-label="Series results" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('series-just-missed', orderOf('series-just-missed'))}>
            <CollapsibleSectionHead
              title="Series results"
              sub="latest per series"
              collapsed={isCollapsed('series-just-missed')}
              onToggle={() => toggleCollapsed('series-just-missed')}
            />
            {!isCollapsed('series-just-missed') &&
              (justMissed === null ? (
                <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                  <div className="h-4 w-3/4 max-w-md animate-pulse motion-reduce:animate-none bg-surface" />
                  <div className="h-4 w-1/2 animate-pulse motion-reduce:animate-none bg-surface/60" />
                </div>
              ) : rows.length === 0 ? (
                <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                  Nothing wrapped up recently.
                </p>
              ) : (
                <div className={`divide-y divide-border border-t border-border${dense('series-just-missed') ? ' [&_a]:py-1.5' : ''}`}>
                  {rows.map(j => (
                    <a
                      key={j.seriesSlug}
                      href={j.resultsHref}
                      className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface-elevated"
                    >
                      <span className="self-stretch w-[3px] shrink-0" style={{ backgroundColor: j.color }} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-text tracking-tight">
                          {j.raceName}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint min-w-0">
                          <span className="font-semibold whitespace-nowrap shrink-0" style={{ color: seriesInk(j.color) }}>
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
          <section aria-label="Circuit map" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('track-layout', orderOf('track-layout'))}>
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
                      <span className="font-semibold" style={{ color: seriesInk(item.color) }}>{item.seriesName}</span>
                    </span>
                    {item.session.location && (
                      <span className="inline-flex items-center gap-1 text-text-faint">
                        <MapPin size={11} aria-hidden="true" />
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
                        <ArrowUpRight size={12} aria-hidden="true" />
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
        <section aria-label="Paddock chatter" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('threads', orderOf('threads'))}>
          <CollapsibleSectionHead
            title="Paddock chatter"
            sub="latest threads"
            collapsed={isCollapsed('threads')}
            onToggle={() => toggleCollapsed('threads')}
          />
          {!isCollapsed('threads') &&
            (threads === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-40 animate-pulse motion-reduce:animate-none bg-surface" />
                <div className="h-4 w-3/4 max-w-md animate-pulse motion-reduce:animate-none bg-surface/60" />
              </div>
            ) : threads.length === 0 ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                No threads yet — start the conversation.
              </p>
            ) : (
              <>
                <div className={`divide-y divide-border border-t border-border${dense('threads') ? ' [&_a]:py-1.5' : ''}`}>
                  {threads.slice(0, threadsCount).map(t => (
                    <Link
                      key={t.id}
                      href={`/threads/${t.id}`}
                      className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface-elevated"
                    >
                      <MessageSquare size={14} aria-hidden="true" className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-text tracking-tight">
                          {t.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint min-w-0">
                          {t.seriesName && (
                            <>
                              <span
                                className="font-semibold whitespace-nowrap shrink-0"
                                style={{ color: t.seriesColor ? seriesInk(t.seriesColor) : undefined }}
                              >
                                {t.seriesName}
                              </span>
                              <span>·</span>
                            </>
                          )}
                          <span className="tnum">{relativeAgo(new Date(t.createdAt), now)}</span>
                        </span>
                      </span>
                      <ArrowUpRight size={13} aria-hidden="true" className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
                    </Link>
                  ))}
                </div>
                <Link
                  href="/threads"
                  className="group mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted hover:text-text transition-colors duration-(--duration-fast)"
                >
                  All threads
                  <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              </>
            ))}
        </section>
      )}

      {/* ── YOUR BETS & CREDITS — opt-in, signed-in only. Open bets + balance +
             next market closing, CTA to /play. Anon → a subtle sign-in nudge. ── */}
      {!isHidden('bets') && (
        <section aria-label="Your bets and credits" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('bets', orderOf('bets'))}>
          <CollapsibleSectionHead
            title="Your bets & credits"
            sub={bets?.signedIn ? `${bets.balance.toLocaleString()} cr` : 'play money'}
            collapsed={isCollapsed('bets')}
            onToggle={() => toggleCollapsed('bets')}
          />
          {!isCollapsed('bets') &&
            (bets === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-1/3 animate-pulse motion-reduce:animate-none bg-surface" />
                <div className="h-4 w-2/3 animate-pulse motion-reduce:animate-none bg-surface/60" />
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
                    <Coins size={13} aria-hidden="true" className="text-brand" />
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
                    <ArrowUpRight size={13} aria-hidden="true" />
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
        <section aria-label="Your leagues and friends" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('social', orderOf('social'))}>
          <CollapsibleSectionHead
            title="Leagues & friends"
            sub={social?.signedIn ? `${social.friends.count} friend${social.friends.count === 1 ? '' : 's'}` : 'play money'}
            collapsed={isCollapsed('social')}
            onToggle={() => toggleCollapsed('social')}
          />
          {!isCollapsed('social') &&
            (social === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-1/3 animate-pulse motion-reduce:animate-none bg-surface" />
                <div className="h-4 w-2/3 animate-pulse motion-reduce:animate-none bg-surface/60" />
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
                          className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface-elevated"
                        >
                          <Trophy size={14} aria-hidden="true" className="shrink-0 text-text-faint group-hover:text-brand transition-colors duration-(--duration-fast)" />
                          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text tracking-tight">
                            {l.name}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted tnum">
                            {l.myRank ? `P${l.myRank}/${l.memberCount}` : `${l.memberCount} member${l.memberCount === 1 ? '' : 's'}`}
                          </span>
                          <ArrowUpRight size={13} aria-hidden="true" className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
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
                  className="group mt-3 flex items-center gap-3 border-t border-border pt-3 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface-elevated"
                >
                  <UserPlus size={14} aria-hidden="true" className="shrink-0 text-text-faint group-hover:text-brand transition-colors duration-(--duration-fast)" />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text tracking-tight">
                    {social.friends.count} friend{social.friends.count === 1 ? '' : 's'}
                    {social.friends.pending > 0 && (
                      <span className="ml-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-brand tnum">
                        · {social.friends.pending} request{social.friends.pending === 1 ? '' : 's'}
                      </span>
                    )}
                  </span>
                  <ArrowUpRight size={13} aria-hidden="true" className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
                </Link>
              </div>
            ))}
        </section>
      )}

      {/* ── LATEST DECODED (F1) — opt-in. The most recent past F1 round's
             qualifying (→ Decoder, pole + P2 codes) and race (→ Race Story). ── */}
      {!isHidden('latest-decoded') && (
        <section aria-label="Latest Analysis" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('latest-decoded', orderOf('latest-decoded'))}>
          <CollapsibleSectionHead
            title="Latest Analysis"
            sub={decoded ? decoded.gp : 'F1 analysis'}
            collapsed={isCollapsed('latest-decoded')}
            onToggle={() => toggleCollapsed('latest-decoded')}
          />
          {!isCollapsed('latest-decoded') &&
            (decoded === undefined ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-1/2 animate-pulse motion-reduce:animate-none bg-surface" />
                <div className="h-4 w-2/3 animate-pulse motion-reduce:animate-none bg-surface/60" />
              </div>
            ) : decoded === null ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                No analysed F1 session yet.
              </p>
            ) : (
              <div className="border-y border-border py-4">
                <div className="space-y-2">
                  {decoded.qualifying && (
                    <Link href={decoded.qualifying.href} className="group block min-w-0">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint">
                        Pole lap analysis · {decoded.gp}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 min-w-0">
                        <span className="font-display text-xl font-extrabold uppercase tracking-wide text-text leading-none">
                          Qualifying Analysis
                        </span>
                        <ArrowUpRight size={14} aria-hidden="true" className="shrink-0 text-text-faint group-hover:text-text transition-colors duration-(--duration-fast)" />
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
                      <Play size={12} aria-hidden="true" />
                      Race Story · {decoded.gp}
                      <ArrowUpRight size={12} aria-hidden="true" className="opacity-60" />
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
          <section aria-label="Where to watch" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('where-to-watch', orderOf('where-to-watch'))}>
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
                <div className={`divide-y divide-border border-t border-border${dense('where-to-watch') ? ' [&_a]:py-1.5' : ''}`}>
                  {rows.map(item => (
                    <a
                      key={`${item.seriesSlug}-${item.session.uid}`}
                      href={item.watch!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface-elevated"
                    >
                      <Tv size={14} aria-hidden="true" className="shrink-0 text-text-faint group-hover:text-brand transition-colors duration-(--duration-fast)" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-text tracking-tight">
                          {item.session.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint min-w-0">
                          <span className="font-semibold whitespace-nowrap shrink-0" style={{ color: seriesInk(item.color) }}>
                            {item.seriesName}
                          </span>
                          <span>·</span>
                          <span className="truncate">Watch on {item.watch!.service}</span>
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-text-muted tnum">
                        {item.session.dateOnly ? 'TBC' : formatRelative(item.session.start, now)}
                      </span>
                      <ArrowUpRight size={13} aria-hidden="true" className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
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
          <section aria-label="Next-race weather" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('next-weather', orderOf('next-weather'))}>
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
                      <span className="font-semibold" style={{ color: seriesInk(item.color) }}>{item.seriesName}</span>
                    </span>
                    {item.session.location && (
                      <span className="inline-flex items-center gap-1 text-text-faint">
                        <MapPin size={11} aria-hidden="true" />
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
                    <ArrowUpRight size={13} aria-hidden="true" className="shrink-0 self-start text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
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
        <section aria-label="Driver spotlight" className="mb-8 border border-border bg-surface p-4 md:p-5 xl:col-span-6" {...blockProps('driver-spotlight', orderOf('driver-spotlight'))}>
          <CollapsibleSectionHead
            title="Driver spotlight"
            sub="from your series"
            collapsed={isCollapsed('driver-spotlight')}
            onToggle={() => toggleCollapsed('driver-spotlight')}
          />
          {!isCollapsed('driver-spotlight') &&
            (spotlight === null ? (
              <div aria-hidden="true" className="space-y-2 border-y border-border py-4">
                <div className="h-4 w-40 animate-pulse motion-reduce:animate-none bg-surface" />
                <div className="h-4 w-3/4 max-w-md animate-pulse motion-reduce:animate-none bg-surface/60" />
              </div>
            ) : spotlight.length === 0 ? (
              <p className="border-y border-border py-4 font-mono text-sm text-text-faint">
                No drivers to spotlight right now.
              </p>
            ) : (
              <div className={`divide-y divide-border border-t border-border${dense('driver-spotlight') ? ' [&_a]:py-1.5' : ''}`}>
                {spotlight.slice(0, spotlightCount).map(d => (
                  <div
                    key={`${d.seriesSlug}-${d.slug}`}
                    className="flex items-center gap-3 py-2.5 px-2 -mx-2 min-w-0"
                  >
                    <span className="self-stretch w-[3px] shrink-0" style={{ backgroundColor: d.teamColor ?? d.seriesColor }} />
                    <Users size={14} aria-hidden="true" className="shrink-0 text-text-faint" />
                    <span className="flex-1 min-w-0">
                      <Link href={`/drivers/${d.slug}`} className="group inline-flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-[15px] font-semibold text-text tracking-tight group-hover:text-brand transition-colors duration-(--duration-fast)">
                          {d.name}
                        </span>
                        {d.code && (
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">{d.code}</span>
                        )}
                        <ArrowUpRight size={12} aria-hidden="true" className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)" />
                      </Link>
                      <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint min-w-0">
                        <span className="font-semibold whitespace-nowrap shrink-0" style={{ color: seriesInk(d.seriesColor) }}>
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
            title: 'The lead story, live and next up',
            body: 'The top of your home leads with our latest long-read. When a session is on track it takes over with a live marker; otherwise the strip underneath counts down to the next one, in your time zone.',
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
    <h2 className="mb-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="relative flex w-full items-baseline justify-between gap-3 pb-2.5 text-left after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-linear-to-r after:from-border-strong after:via-border after:to-border"
      >
        <span className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide text-text">
          {title}
          <span className="text-brand">.</span>
        </span>
        <span className="inline-flex items-center gap-2">
          {sub && <span className="font-mono text-[10px] leading-none uppercase tracking-[0.12em] text-text-muted">{sub}</span>}
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={`shrink-0 text-text-faint transition-transform duration-(--duration-fast) ${collapsed ? '-rotate-90' : ''}`}
          />
        </span>
      </button>
    </h2>
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
      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        <div className="mb-8 -mx-4 border-y border-border bg-surface px-4 py-5 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          <div className="mb-2 h-4 w-40 bg-surface-elevated" />
          <div className="h-9 w-3/4 max-w-md bg-surface-elevated" />
        </div>
        <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-12 xl:gap-16">
          <div>
            <div className="mb-3 h-5 w-28 bg-surface" />
            <div className="divide-y divide-border border-t border-border">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-surface/60" />
              ))}
            </div>
          </div>
          <div className="mt-10 lg:mt-0">
            <div className="mb-3 h-5 w-28 bg-surface" />
            <div className="divide-y divide-border border-t border-border">
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
