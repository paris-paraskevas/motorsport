import { SUPPORT_URL } from '@/lib/site';

// The catalogue of places a navigation entry may point at. A row in the
// database names a key from here, never a URL (the field guide's first rail): a
// row cannot send a visitor anywhere the code does not know, and a route rename
// happens in one place. Client-safe on purpose: the shell renders from it in
// the browser, so nothing here may import a server-only module.

export type Destination =
  | { kind: 'route'; href: string; label: string }
  | { kind: 'external'; href: string; label: string }
  | { kind: 'action'; action: 'contact' | 'cookies'; label: string };

/** One entry of a navigation list, as the shell renders it. */
export interface NavEntry {
  label: string;
  /** A key of DESTINATIONS, or a page key (`page:<id>`, P1.12 B1). */
  dest: string;
  /** Icon name for the phone bar; see the map in components/BottomBar.tsx. */
  icon?: string;
  /** Authorization scheme key; unset means everyone. Enforced from Phase 3. */
  authz?: string;
  /** A page entry's address, resolved by the loader against the live row pages
   *  (P1.12 B1), so the shell's browser components need no map. Never stored;
   *  the write path keeps the key alone. */
  href?: string;
}

/** The icon names an entry, or a region (P2.10), may carry: the phone bar's set,
 *  drawn by the map in components/BottomBar.tsx. Here, plain, so the client-safe
 *  page parser checks a name without the bar's lucide graph. */
export const ICON_NAMES = ['house', 'calendar-days', 'compass', 'circle-user', 'flag', 'trophy', 'newspaper', 'book-open', 'users', 'settings', 'search'] as const;
export type IconName = (typeof ICON_NAMES)[number];

// Row pages as destinations (P1.12 B1): a page made in the designer is named by
// its id, `page:<uuid>`, never by its path (a page keeps its identity across a
// rename of its address). The key resolves against the live row pages the
// loader hands over; a deleted page resolves to nothing, so its entries leave
// the shell while it is deleted and come back with Reinstate.
export const PAGE_DEST = /^page:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
/** The live row pages by id: what a `page:` key resolves against. */
export type PageDestinations = Readonly<Record<string, { path: string; name: string }>>;

export function pageDest(id: string): string {
  return `page:${id}`;
}

/** The page id inside a page key, or null for any other key. */
export function pageIdOf(key: string): string | null {
  return PAGE_DEST.exec(key)?.[1] ?? null;
}

/** The four lists the shell renders, resolved to entries. */
export interface NavLists {
  doors: NavEntry[];
  bar: NavEntry[];
  footerSite: NavEntry[];
  footerLegal: NavEntry[];
}

/** Where a list renders (the `list.role` column). */
export type ListRole = 'menu' | 'bar' | 'footer' | 'reference' | 'generic';

/** The four lists the shell renders; their keys are fixed and never reused. */
export const NAV_LIST_KEYS = ['doors', 'bar', 'footer-site', 'footer-legal'] as const;
export type NavListKey = (typeof NAV_LIST_KEYS)[number];

/** The phone bar is equal cells and cannot fit fewer than three or more than
 *  five without the design breaking, so the loader, the API and the editor all
 *  hold this line. Here, and not in lists.ts, because the editor runs in the
 *  browser and lists.ts is server-only. */
export const BAR_MIN = 3;
export const BAR_MAX = 5;

const route = (href: string, label: string): Destination => ({ kind: 'route', href, label });

export const DESTINATIONS: Record<string, Destination> = {
  home: route('/', 'Home'),
  calendar: route('/calendar', 'Calendar'),
  learn: route('/information', 'Learn'),
  series: route('/series', 'Series'),
  blog: route('/blog', 'Blog'),
  account: route('/settings', 'Account'),
  about: route('/about', 'About'),
  news: route('/news', 'News'),
  writers: route('/authors', 'Writers'),
  'write-for-us': route('/write-for-us', 'Write for Paddock'),
  threads: route('/social/threads', 'Threads'),
  social: route('/social', 'Predictions & leagues'),
  changelog: route('/changelog', 'Release notes'),
  archive: route('/archive', 'Season archive'),
  privacy: route('/privacy', 'Privacy'),
  terms: route('/terms', 'Terms'),
  cookies: route('/cookies', 'Cookies'),
  accessibility: route('/accessibility', 'Accessibility'),
  'do-not-sell': route('/do-not-sell', 'Do Not Sell or Share'),
  imprint: route('/imprint', 'Imprint'),
  'learn:series-guides': route('/information/series-guides', 'Series guides'),
  'learn:formula-1': route('/information/formula-1', 'Formula 1 & open-wheel'),
  'learn:feeder-series': route('/information/feeder-series', 'Feeder series'),
  'learn:tracks': route('/information/tracks', 'Tracks & circuits'),
  'learn:general': route('/information/general', 'Motorsport 101'),
  // The support link, single-sourced from lib/site.ts like the header button.
  'external:support': { kind: 'external', href: SUPPORT_URL, label: 'Support the creator' },
  // Fixed actions the footer offers; their components carry their own text.
  'action:contact': { kind: 'action', action: 'contact', label: 'Contact' },
  'action:cookies': { kind: 'action', action: 'cookies', label: 'Manage cookies' },
};

/** The catalogue's entry for a key; with the live row pages given, a page key's
 *  route (its path, its name) too. Null for anything else. */
// The series tabs as destinations (R18): `series:<slug>` is a championship's hub, `series:<slug>:<tab>` one of its tabs,
// resolved by a rule as page keys are, never a table, since this module rides every page's client JS. The slugs and names
// are the catalogue's fifteen (lib/design/sources.ts SERIES_OPTIONS, which this module must not import; a test holds the
// two equal), the single-event series the content's (its meta file; the same test), the tabs the six a list may point at
// (the calendar is the hub itself, Rounds is coverage-gated per series), their labels the tab rail's (lib/tabs.ts TABS).
export const SERIES_DESTINATION_SLUGS: Readonly<Record<string, string>> = {
  'adac-ravenol-24h': 'ADAC Ravenol 24h Nürburgring',
  dtm: 'DTM',
  f1: 'Formula 1',
  f2: 'Formula 2',
  f3: 'Formula 3',
  'formula-e': 'Formula E',
  'gt-world': 'GT World Challenge',
  imsa: 'IMSA',
  indycar: 'IndyCar',
  motogp: 'MotoGP',
  'nascar-cup': 'NASCAR Cup',
  nls: 'NLS Nürburgring',
  wec: 'FIA WEC',
  wrc: 'WRC',
  wsbk: 'WorldSBK',
};
/** The series with one annual race, not a championship: their tab set is drivers and champions (lib/tabs.ts SINGLE_EVENT_TAB_KEYS). */
export const SINGLE_EVENT_SLUGS: ReadonlySet<string> = new Set(['adac-ravenol-24h']);
const SERIES_TAB_LABELS: Readonly<Record<string, string>> = { standings: 'Standings', results: 'Results', drivers: 'Drivers', champions: 'Champions', blog: 'Blog', news: 'News' };
const SINGLE_EVENT_TABS: ReadonlySet<string> = new Set(['drivers', 'champions']);
const SERIES_KEY = /^series:([a-z0-9-]+)(?::([a-z]+))?$/;

/** The rule: a series key's destination, or null for a slug or a tab the series does not have. */
function seriesDestination(key: string): Destination | null {
  const m = SERIES_KEY.exec(key);
  if (!m) return null;
  const [, slug, tab] = m;
  const name = SERIES_DESTINATION_SLUGS[slug];
  if (!name) return null;
  if (!tab) return route(`/series/${slug}`, name);
  const label = SERIES_TAB_LABELS[tab];
  if (!label) return null;
  const single = SINGLE_EVENT_SLUGS.has(slug);
  if (single && !SINGLE_EVENT_TABS.has(tab)) return null;
  return route(`/series/${slug}/${tab}`, `${name} · ${single && tab === 'champions' ? 'Past Winners' : label}`);
}

/** Every series destination the rule resolves, for the pickers: the hub, then the tabs, in the catalogue's series order. */
export function seriesDestinationOptions(): { key: string; label: string; href: string }[] {
  const out: { key: string; label: string; href: string }[] = [];
  for (const slug of Object.keys(SERIES_DESTINATION_SLUGS)) {
    for (const key of [`series:${slug}`, ...Object.keys(SERIES_TAB_LABELS).map(tab => `series:${slug}:${tab}`)]) {
      const d = seriesDestination(key);
      if (d && d.kind === 'route') out.push({ key, label: d.label, href: d.href });
    }
  }
  return out;
}

export function resolveDestination(key: string, pages?: PageDestinations): Destination | null {
  if (Object.prototype.hasOwnProperty.call(DESTINATIONS, key)) return DESTINATIONS[key];
  const series = seriesDestination(key);
  if (series) return series;
  const id = pageIdOf(key);
  if (id && pages && Object.prototype.hasOwnProperty.call(pages, id)) return { kind: 'route', href: pages[id].path, label: pages[id].name };
  return null;
}

/** An entry's destination as the shell draws it: the catalogue, else the href
 *  the loader carried on a page entry (the browser has no map), else nothing. */
export function resolveEntry(entry: NavEntry, pages?: PageDestinations): Destination | null {
  const dest = resolveDestination(entry.dest, pages);
  if (dest) return dest;
  if (entry.href && pageIdOf(entry.dest)) return { kind: 'route', href: entry.href, label: entry.label };
  return null;
}

/** The active-state rule the doors and the bar share: home matches itself only,
 *  every other route matches itself and its children. */
export function isActivePath(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
