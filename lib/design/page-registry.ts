// The page registry (APEX: the App Builder's page list): every page the site
// serves, as the designer sees it. Phase 3 step 1 of the designer plan.
//
// Two kinds of page share the `page` table. A `code` page is a route the code
// serves today, registered here so the App Builder shows the whole site and so
// a row page can never take a path the code already owns; its row carries the
// facts a person wants to see (group, how it renders, whether it is indexed,
// who may see it) and nothing the code reads. A `row` page (step 2) is served
// from a published revision by the catch-all. Client-safe: the App Builder
// lists from it, the server loader (pages.ts) falls back to it, and the
// route-collision test compares it with the route files.
//
// PATH CONVENTION: a dynamic route is written exactly as Next names it in the
// file system (`/series/[slug]/[tab]`), so the test can compare the two without
// translation. An optional catch-all owned by a library (`/sign-in/[[...sign-in]]`)
// is registered as its parent, `/sign-in`, which is the page a person knows.

export const PAGE_GROUPS = ['home', 'calendar', 'series', 'editorial', 'account', 'site'] as const;
export type PageGroup = (typeof PAGE_GROUPS)[number];

/** The seeded page groups' labels (migration 20260908090000). */
export const PAGE_GROUP_LABELS: Record<PageGroup, string> = {
  home: 'Home',
  calendar: 'Calendar',
  series: 'Series',
  editorial: 'Editorial',
  account: 'Account',
  site: 'Site',
};

/** A page's comments (APEX: Comments): notes for the operators, never rendered. */
export const PAGE_COMMENTS_MAX = 500;

export type PageRendering = 'dynamic' | 'cached';
export type PageAuthz = 'public' | 'signed_in' | 'contributor' | 'administrator';

export interface CodePage {
  path: string;
  name: string;
  group: PageGroup;
  /** `dynamic` when the route exports `dynamic = 'force-dynamic'`; everything else, static or ISR, is `cached`. */
  rendering: PageRendering;
  /** Whether the page's own metadata lets search engines index it; a page may still say noindex per instance. */
  indexable: boolean;
  /** The scheme the page enforces today, in the code; enforcement from rows is step 4. */
  authz: PageAuthz;
  note?: string;
  /** `rows` once the page's route file has left the code (the components
   *  programme, R4): the catch-all serves it from its row, the published
   *  revision's components or the page's default composition. Absent means a
   *  route file still serves it. */
  served?: 'rows';
}

const P = (path: string, name: string, group: PageGroup, rendering: PageRendering, indexable: boolean, authz: PageAuthz = 'public', note?: string): CodePage => ({
  path,
  name,
  group,
  rendering,
  indexable,
  authz,
  ...(note ? { note } : {}),
});
/** A page whose route file has left the code: served from its row by the catch-all. */
const R = (path: string, name: string, group: PageGroup, rendering: PageRendering, indexable: boolean, authz: PageAuthz = 'public', note?: string): CodePage => ({
  ...P(path, name, group, rendering, indexable, authz, note),
  served: 'rows',
});

/** Every route the site serves today, in the App Builder's order. */
export const CODE_PAGES: readonly CodePage[] = [
  P('/', 'Home', 'home', 'cached', true),

  R('/calendar', 'Calendar', 'calendar', 'cached', true),
  P('/archive', 'Season archive', 'calendar', 'cached', true),
  P('/archive/[season]/[slug]', 'Archived season', 'calendar', 'cached', false),
  P('/archive/[season]/[slug]/weekend/[round]', 'Archived weekend', 'calendar', 'cached', false),

  P('/series', 'Series', 'series', 'cached', true),
  P('/series/[slug]', 'Series hub', 'series', 'cached', true),
  P('/series/[slug]/[tab]', 'Series tab', 'series', 'cached', true, 'public', 'standings, results, drivers, teams, champions and the rest; an empty tab says noindex on its own'),
  P('/series/[slug]/weekend/[round]', 'Race weekend', 'series', 'cached', true),
  P('/series/[slug]/weekend/[round]/[session]', 'Session', 'series', 'dynamic', true),
  P('/drivers/[slug]', 'Driver profile', 'series', 'cached', true),
  P('/teams/[slug]', 'Team profile', 'series', 'cached', true),
  P('/f1/analysis', 'F1 qualifying analysis', 'series', 'cached', true),
  P('/f1/compare', 'F1 compare', 'series', 'cached', true),

  P('/blog', 'Blog', 'editorial', 'cached', true),
  P('/blog/[slug]', 'Blog post', 'editorial', 'dynamic', true),
  // P2.5 PR C: the news page's route file left; the catch-all serves it from its row (the recipe in components.ts SPLITS, the
  // family in families/news.tsx). Its name is the route's title, News.
  R('/news', 'News', 'editorial', 'cached', true),
  P('/information', 'Learn', 'editorial', 'cached', true),
  // Indexable on for the three patterns below (R14, 2026-09-28): the frame then leaves the code its own robots rule,
  // which indexes a verified and featured Learn answer, a topic index with one, and an author profile. Off, the frame
  // blanketed every one of them with noindex from 1.0.70 (2026-09-09) until the apply of 2026-09-28 (801 of 1,279
  // sitemap pages). The seed correction: 20260928190000_pages_seed_indexable.sql.
  P('/information/[topic]', 'Learn topic', 'editorial', 'cached', true),
  P('/information/[topic]/[slug]', 'Learn answer', 'editorial', 'cached', true),
  P('/information/map', 'Tracks map', 'editorial', 'cached', true),
  P('/information/series-guides', 'Series guides', 'editorial', 'cached', true),
  P('/authors', 'Authors', 'editorial', 'cached', true),
  P('/authors/[slug]', 'Author profile', 'editorial', 'cached', true),
  P('/changelog', 'Changelog', 'editorial', 'cached', true),
  P('/write-for-us', 'Write for us', 'editorial', 'cached', true),
  P('/contribute', 'Contribute', 'editorial', 'cached', false),
  P('/studio', 'Studio', 'editorial', 'cached', true, 'contributor', 'the code sets no robots rule on the studio pages; they are for approved writers'),
  P('/studio/[id]', 'Studio draft', 'editorial', 'cached', true, 'contributor'),
  P('/studio/new', 'Studio, new draft', 'editorial', 'cached', true, 'contributor'),

  P('/settings', 'Settings', 'account', 'dynamic', false, 'signed_in'),
  P('/settings/account', 'Settings, account details', 'account', 'dynamic', false, 'signed_in'),
  P('/settings/assistant', 'Settings, assistant', 'account', 'dynamic', false, 'signed_in'),
  P('/settings/author', 'Settings, author', 'account', 'dynamic', false, 'signed_in'),
  P('/settings/notifications', 'Settings, notifications', 'account', 'dynamic', false, 'signed_in'),
  P('/settings/series', 'Settings, series', 'account', 'dynamic', false, 'signed_in'),
  P('/settings/theme', 'Settings, theme', 'account', 'cached', false),
  P('/sign-in', 'Sign in', 'account', 'dynamic', false, 'public', "The site's own sign-in page (PA A3), /sign-in/[[...sign-in]] in the code"),
  P('/sign-up', 'Sign up', 'account', 'dynamic', false, 'public', "The site's own sign-up page (PA A3), /sign-up/[[...sign-up]] in the code"),
  P('/social', 'Social', 'account', 'dynamic', true),
  P('/social/friends', 'Friends', 'account', 'dynamic', false, 'signed_in'),
  P('/social/friends/add/[id]', 'Add a friend', 'account', 'dynamic', false, 'signed_in'),
  P('/social/leagues', 'Leagues', 'account', 'dynamic', false, 'signed_in'),
  P('/social/leagues/[id]', 'League', 'account', 'dynamic', false, 'signed_in'),
  P('/social/leagues/join/[token]', 'Join a league', 'account', 'dynamic', false, 'signed_in'),
  P('/social/threads', 'Threads', 'account', 'dynamic', true),
  P('/social/users/[id]', 'Member profile', 'account', 'dynamic', false, 'signed_in'),
  P('/threads/[id]', 'Thread', 'account', 'dynamic', false, 'public', 'reading is public; posting needs a sign-in'),
  P('/feedback', 'Feedback', 'account', 'dynamic', false),
  P('/contact', 'Contact', 'account', 'cached', true),

  P('/about', 'About', 'site', 'cached', true),
  P('/accessibility', 'Accessibility', 'site', 'cached', true),
  P('/privacy', 'Privacy', 'site', 'cached', true),
  P('/terms', 'Terms', 'site', 'cached', true),
  P('/cookies', 'Cookies', 'site', 'cached', true),
  P('/do-not-sell', 'Do not sell', 'site', 'cached', true),
  P('/impressum', 'Impressum', 'site', 'cached', true),
  P('/imprint', 'Imprint', 'site', 'cached', true),
  P('/preview/[rev]', 'Revision preview', 'site', 'dynamic', false, 'administrator', 'Save and Run: any revision of a row page, for administrators, never indexed'),
];

export function isPageGroup(v: unknown): v is PageGroup {
  return typeof v === 'string' && (PAGE_GROUPS as readonly string[]).includes(v);
}

/** A route as the file system names it, made into the registry's path: route
 *  groups already stripped; a library-owned optional catch-all folds into its
 *  parent. Used by the route-collision test and by nothing at runtime. */
export function registryPathOf(route: string): string {
  return route.replace(/\/\[\[\.\.\.[^\]]+\]\]$/, '') || '/';
}
