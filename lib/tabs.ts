export const TABS = [
  { key: 'calendar',  label: 'Calendar' },
  { key: 'news',      label: 'News' },
  { key: 'standings', label: 'Standings' },
  { key: 'results',   label: 'Results' },
  { key: 'drivers',   label: 'Drivers' },
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

export function tabsFor(singleEvent: boolean | undefined): typeof TABS[number][] {
  if (!singleEvent) return [...TABS];
  return TABS.filter(t => (SINGLE_EVENT_TAB_KEYS as readonly string[]).includes(t.key));
}

export function resolveTab(value: string | string[] | undefined, singleEvent?: boolean): TabKey {
  const v = Array.isArray(value) ? value[0] : value;
  const allowed = tabsFor(singleEvent);
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
  switch (key) {
    case 'calendar':
      return {
        title: `${seriesName} ${season} — calendar, schedule, race weekends`,
        // "in your local timezone" was false here — calendar times render in
        // a labeled fixed zone until the device-local upgrade lands with
        // home v3 (audit 1b-9 / 2-1).
        description: `Full ${season} ${seriesName} calendar with time-zoned session times, weekend grouping, weather, and round numbers.`,
      };
    case 'news':
      return {
        title: `${seriesName} news — latest stories and recaps`,
        description: `Latest ${seriesName} stories from motorsport.com — race weekend coverage, driver news, team updates, and regulatory changes.`,
      };
    case 'standings':
      return {
        title: `${seriesName} ${season} standings — drivers and constructors`,
        description: `Current ${season} ${seriesName} drivers' and constructors' championship standings, refreshed automatically from official sources.`,
      };
    case 'results':
      return {
        title: `${seriesName} ${season} results — race by race`,
        description: `Race-by-race ${season} ${seriesName} results — finishing order, points, and DNFs across the season so far.`,
      };
    case 'drivers':
      return {
        title: `${seriesName} ${season} drivers and teams`,
        description: `Full ${season} ${seriesName} driver lineup and team pairings, with car numbers and any mid-season seat changes.`,
      };
    case 'about':
      return {
        title: `About ${seriesName} — data sources and notes`,
        description: `How Paddock Tracker covers ${seriesName}: data sources, freshness, and what's curated versus fetched live.`,
      };
    case 'history':
      return {
        title: `${seriesName} history — origin, eras, defining moments`,
        description: `${seriesName} history — origin, defining eras, championship-decider controversies, and the figures who shaped the sport.`,
      };
    case 'champions':
      return {
        title: `${seriesName} champions — full list, year by year`,
        description: `Complete list of ${seriesName} champions year by year — drivers and constructors with season-by-season detail.`,
      };
  }
}
