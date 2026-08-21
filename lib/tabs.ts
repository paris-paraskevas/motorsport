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
): { title: string; description: string } {
  // Descriptions target ~150–200 chars: Bing WMT flagged the old one-liners
  // as "too short" (33 pages, 2026-08-20) — search engines want 150–160.
  switch (key) {
    case 'calendar':
      return {
        title: `${seriesName} ${season} — calendar, schedule, race weekends`,
        // "in your local timezone" was false here — calendar times render in
        // a labeled fixed zone until the device-local upgrade lands with
        // home v3 (audit 1b-9 / 2-1).
        description: `The full ${season} ${seriesName} calendar — practice, qualifying, sprint and race sessions with time-zoned start times, weekend grouping, venue weather, round numbers and a subscribable feed, updated from official schedules.`,
      };
    case 'news':
      return {
        title: `${seriesName} news — latest stories and recaps`,
        description: `The latest ${seriesName} news in one wire — race weekend coverage, driver and team stories, technical and regulatory updates, aggregated from motorsport.com and linked straight to the source.`,
      };
    case 'blog':
      return {
        title: `${seriesName} analysis and race reports from Paddock`,
        description: `Paddock's own ${seriesName} writing — race weekend previews, reports, lap-by-lap chronologies and analysis, written and fact-checked in house rather than aggregated, newest first.`,
      };
    case 'standings':
      return {
        title: `${seriesName} ${season} standings — drivers and constructors`,
        description: `Live ${season} ${seriesName} standings — the full drivers' and constructors' championship tables with points, wins and gaps, plus a season trend chart, refreshed automatically from official sources.`,
      };
    case 'results':
      return {
        title: `${seriesName} ${season} results — race by race`,
        description: `Every ${season} ${seriesName} race result — round-by-round finishing order, points and retirements, with links to each weekend's full classification, updated automatically as the season runs.`,
      };
    case 'drivers':
      return {
        title: `${seriesName} ${season} drivers and teams`,
        description: `The full ${season} ${seriesName} grid, team by team — every driver with car number, championship position, points and wins from the live standings, plus links to individual driver profiles.`,
      };
    case 'tracks':
      return {
        title: `${seriesName} ${season} rounds — every circuit mapped`,
        description: `All ${season} ${seriesName} circuits in one place — every round's track layout mapped, with venue locations and links to each race weekend's schedule, preview and full report.`,
      };
    case 'about':
      return {
        title: `About ${seriesName} — data sources and notes`,
        description: `How Paddock Tracker covers ${seriesName} — where the calendar, results and standings data comes from, how fresh it is, and what is curated by hand versus fetched live from official sources.`,
      };
    case 'history':
      return {
        title: `${seriesName} history — origin, eras, defining moments`,
        description: `The history of ${seriesName} — its origin and founding era, the defining seasons and championship deciders, and the drivers, teams and figures who shaped the series into what it is today.`,
      };
    case 'champions':
      return {
        title: `${seriesName} champions — full list, year by year`,
        description: `Every ${seriesName} champion year by year — the complete drivers' roll of honour and the team champions on their own tab, with points, wins and title margins for the seasons on record.`,
      };
  }
}
