import { fitDescription, fitTitle } from './site';

export const TABS = [
  { key: 'calendar',  label: 'Calendar' },
  { key: 'news',      label: 'News' },
  { key: 'blog',      label: 'Blog' },
  { key: 'standings', label: 'Standings' },
  { key: 'results',   label: 'Results' },
  { key: 'drivers',   label: 'Drivers' },
  { key: 'tracks',    label: 'Rounds' },
  { key: 'about',     label: 'About' },
  { key: 'history',   label: 'History' },
  { key: 'champions', label: 'Champions' },
] as const;

export type TabKey = typeof TABS[number]['key'];

/** Tabs kept out of the index (R14, 2026-09-28): `robots: noindex, follow` on the page and no sitemap entry, in ONE
 *  list so the two can never contradict each other (a sitemap that submits a noindex URL earns Search Console's
 *  "Submitted URL marked noindex"). News is motorsport.com aggregation (0.334.8); blog, standings, results and drivers
 *  are tables and links over feeds with one standard paragraph, which Google's own refusal page calls "not only
 *  headlines"; the series hub, the champions roll and the mapped rounds stay. A tab comes back by earning sentences. */
export const NOINDEX_TABS = ['news', 'blog', 'standings', 'results', 'drivers'] as const satisfies readonly TabKey[];

export function tabIsIndexed(key: TabKey): boolean {
  return !(NOINDEX_TABS as readonly string[]).includes(key);
}

/** Tabs that make sense for a single-event series (one annual race,
 *  not a championship). Standings / Results / Drivers / News don't apply. */
// 'drivers' joined 2026-06-12 (content-gap audit #6): ADAC's curated
// flagship lineup was unreachable on its own series page without it.
export const SINGLE_EVENT_TAB_KEYS = ['calendar', 'drivers', 'about', 'history', 'champions'] as const;

/**
 * Series whose calendars have curated circuit-layout coverage
 * (content/circuits-layout.json) and therefore show the Tracks tab. A static
 * list because this module is client-bundled AND runs in middleware — the fs
 * check in lib/circuit-layout.ts can't live here. Kept honest by the
 * coverage-sync test in lib/sitemap-data.test.ts: every slug listed must
 * resolve layouts for most of its season.
 */
export const TRACKS_TAB_SLUGS = ['f1'] as const;

export function seriesHasTracksTab(slug: string | undefined): boolean {
  return slug != null && (TRACKS_TAB_SLUGS as readonly string[]).includes(slug);
}

export function tabsFor(singleEvent: boolean | undefined, slug?: string): typeof TABS[number][] {
  const base = singleEvent
    ? TABS.filter(t => (SINGLE_EVENT_TAB_KEYS as readonly string[]).includes(t.key))
    : [...TABS];
  // Tracks is coverage-gated: callers that don't know the slug never get it.
  return base.filter(t => t.key !== 'tracks' || seriesHasTracksTab(slug));
}

/** Tabs shown in the series-page RAIL — the live/interactive ones only. The
 *  editorial tabs (about / history / champions / drivers) moved to a "Learn
 *  about <series>" link block + the /information hub (IA restructure); News was
 *  dropped from the rail too — redundant with the News quick-link added by the
 *  Threads link (#528). Their ROUTES stay live and in the sitemap until Phase C
 *  redirects them, so TABS / tabsFor() are deliberately unchanged — this only
 *  trims the visible rail. */
export const RAIL_TAB_KEYS = ['calendar', 'standings', 'results', 'tracks'] as const;

export function railTabsFor(singleEvent: boolean | undefined, slug?: string): typeof TABS[number][] {
  return tabsFor(singleEvent, slug).filter(t =>
    (RAIL_TAB_KEYS as readonly string[]).includes(t.key),
  );
}

/** Sub-pages surfaced in the Series NAV — the desktop mega-menu detail pane and
 *  the /series hub cards. The live/reference destinations a reader jumps between
 *  per series, in reading order. Reuses tabsFor() so the single-event trim and
 *  the F1-only Rounds gate live in ONE place; deliberately excludes the
 *  editorial about/history + news (those live in the Learn block / News link). */
// 'blog' joined 2026-08-21 (operator: "in /series/{slug} add blog in one of
// these tabs and filter blogs to whatever series we are on"). It sits here
// rather than with the excluded news/about/history because it is OUR writing
// about this series, not a link off-site or a static explainer — without it the
// tab exists and renders but nothing on the series page links to it.
export const NAV_SUBPAGE_KEYS = ['calendar', 'standings', 'results', 'tracks', 'drivers', 'champions', 'blog'] as const;

export function seriesSubPages(
  meta: { slug: string; singleEvent?: boolean },
): { key: TabKey; label: string; href: string }[] {
  const allowed = new Set(tabsFor(meta.singleEvent, meta.slug).map(t => t.key));
  return NAV_SUBPAGE_KEYS.filter(k => allowed.has(k)).map(k => ({
    key: k,
    // Single-event series call their honours roll "Past Winners", matching the rail.
    label: meta.singleEvent && k === 'champions' ? 'Past Winners' : labelForTab(k),
    href: k === 'calendar' ? `/series/${meta.slug}` : `/series/${meta.slug}/${k}`,
  }));
}

export function resolveTab(
  value: string | string[] | undefined,
  singleEvent?: boolean,
  slug?: string,
): TabKey {
  const v = Array.isArray(value) ? value[0] : value;
  const allowed = tabsFor(singleEvent, slug);
  const match = allowed.find(t => t.key === v);
  return match?.key ?? 'calendar';
}

export function labelForTab(key: TabKey): string {
  return TABS.find(t => t.key === key)?.label ?? '';
}

/**
 * Per-tab title + description strings for `generateMetadata` on `/series/[slug]`.
 * Differentiating these is the B7 fix — without it, all 9 tabs share the same
 * `<title>` and Google treats them as duplicate content of the bare series URL.
 *
 * Final rendered title gets the layout's `%s — Paddock Tracker` template appended, so
 * each return value here should land around 40–50 chars to stay under Google's
 * ~60-char SERP truncation after the suffix.
 */
export function describeTab(
  key: TabKey,
  seriesName: string,
  season: number,
  singleEvent = false,
): { title: string; description: string } {
  // X10 (the Seobility crawl of 1 October 2026): every title fitted under the layout's suffix (lib/site.ts fitTitle, the
  // shorter variant for the longest series names), no word twice, "Paddock" left to the suffix; every description within
  // Seobility's width and above Bing's floor (fitDescription).
  const s = seriesName;
  const y = season;
  const t = (...variants: string[]) => fitTitle(variants);
  const d = (text: string) => fitDescription(text);
  switch (key) {
    case 'calendar':
      return {
        title: t(`${s} ${y} calendar`, `${s} calendar`),
        description: d(`The ${y} ${s} calendar: every session with its start in your time zone, weekend by weekend. The venue weather and the round numbers beside them.`),
      };
    case 'news':
      return {
        title: t(`${s} news`),
        description: d(`The latest ${s} news in one wire: race weekend coverage, driver and team stories, technical and rule updates. From motorsport.com.`),
      };
    case 'blog':
      return {
        title: t(`${s} race reports and analysis`, `${s} analysis`),
        description: d(`Paddock’s own ${s} writing: previews, race reports, lap-by-lap chronologies and analysis. Written and fact-checked in house rather than aggregated.`),
      };
    case 'standings':
      return {
        title: t(`${s} ${y} standings`, `${s} standings`),
        description: d(`The ${y} ${s} standings: the drivers’ and teams’ championship tables with points, wins and gaps. The season trend chart beside them, refreshed automatically.`),
      };
    case 'results':
      return {
        title: t(`${s} ${y} results`, `${s} results`),
        description: d(`Every ${y} ${s} race result round by round: the finishing order, points and retirements. Each weekend’s full classification a click away.`),
      };
    case 'drivers':
      return {
        title: t(`${s} ${y} drivers and teams`, `${s} drivers`),
        description: d(`The ${y} ${s} grid team by team: every driver with car number, championship position, points and wins. The live standings, and a page for each driver.`),
      };
    case 'tracks':
      return {
        title: t(`${s} ${y} circuits`, `${s} circuits`),
        description: d(`Every ${y} ${s} circuit mapped: each round’s track layout and venue. The weekend’s schedule, preview and full results a click away.`),
      };
    case 'about':
      return {
        title: t(`${s}: data sources and notes`, `About ${s}`),
        description: d(`How Paddock Tracker covers ${s}: where the calendar, results and standings come from, and how fresh they are. What is curated by hand rather than fetched live.`),
      };
    case 'history':
      return {
        title: t(`The history of ${s}`, `${s} history`),
        description: d(`The history of ${s}: its origin and founding era, the defining seasons and championship deciders. The drivers, teams and figures who shaped it.`),
      };
    case 'champions':
      return singleEvent
        ? {
            title: t(`${s} past winners`, `${s} winners`),
            description: d(`Every ${s} winner year by year: the overall winners with their cars and teams. The margins where they are known, and the record holders.`),
          }
        : {
            title: t(`${s} champions, every season`, `${s} champions`),
            description: d(`Every ${s} champion season by season: the drivers’ roll of honour with points, wins and title margins. The teams’ champions beside them.`),
          };
  }
}

/** The series hub’s own title and description (the tab route reads describeTab; the hub is the series’ front page). */
export function describeHub(seriesName: string, season: number, singleEvent = false): { title: string; description: string } {
  return {
    title: fitTitle([`${seriesName} ${season} season`, seriesName]),
    description: fitDescription(
      singleEvent
        ? `${seriesName} in ${season} on Paddock Tracker: the next session, the entry, the latest results and news, and the full schedule.`
        : `${seriesName} in ${season} on Paddock Tracker: the next session, where the title stands, the latest results and news, and the full calendar.`,
    ),
  };
}
