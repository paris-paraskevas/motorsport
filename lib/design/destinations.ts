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
  /** A key of DESTINATIONS. */
  dest: string;
  /** Icon name for the phone bar; see the map in components/BottomBar.tsx. */
  icon?: string;
  /** Authorization scheme key; unset means everyone. Enforced from Phase 3. */
  authz?: string;
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

export function resolveDestination(key: string): Destination | null {
  return Object.prototype.hasOwnProperty.call(DESTINATIONS, key) ? DESTINATIONS[key] : null;
}

/** The active-state rule the doors and the bar share: home matches itself only,
 *  every other route matches itself and its children. */
export function isActivePath(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
