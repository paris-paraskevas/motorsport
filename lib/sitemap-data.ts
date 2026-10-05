import type { MetadataRoute } from 'next';
import { loadAllSeriesMeta, loadSeries } from './series';
import { groupByWeekend } from './group';
import { SESSION_PAGE_SERIES, sessionSlug } from './weekend';
import { tabIsIndexed, tabsFor } from './tabs';
import { tabIsEmpty } from '@/components/SeriesPageView';
import { listArchivePairs, loadSeasonArchive, isArchiveLiveSeason } from './season-archive';
import { SITE_URL } from './site';
import { INFO_TOPICS, aboutGuideForSeries } from './information/topics';
import { getIndexedInfoEntries, isTopicIndexable } from './information/registry';
import { listAuthors } from './authors';
import { hasWeekendNote, loadDriverBios, loadWeekendNotes } from './series-content';
import { publishedPosts } from './blog';
import { loadAllPosts } from './posts';
import { RELEASE_INDEX } from './content-bundle.generated';

// Google's 2026 sitemap guidance: `priority` and `changefreq` are ignored
// entirely; `lastmod` is the only acted-upon hint, and only when its accuracy
// is verifiable against actual page-change history. Until we wire a per-page
// "significant content change" timestamp source (rounds.json / sessions.json
// edit history, markdown frontmatter dates, etc.), emitting `lastModified:
// new Date()` on every build would train Google to ignore the field — worse
// than omitting it. So entries here are minimal `<url><loc>` only.
//
// ONE EXCEPTION, added 0.334.22: DB-backed blog posts. They carry `updated_at`,
// a real per-page change timestamp of exactly the kind this rule was waiting
// for, so those entries — and only those — advertise a `lastmod`. The rule is
// unchanged everywhere else, and an MDX post with no such stamp still gets none.
/**
 * The `lastmod` for one DB blog post, or null when it has no usable stamp.
 *
 * Order matters: `updated_at` is the only value that moves when a published post
 * is CORRECTED, which is the change a re-crawl is actually for. It falls back to
 * publication, then creation. An unparseable or absent stamp yields null and the
 * entry ships without a lastmod — a wrong one is worse than none, which is the
 * rule the header comment above is protecting.
 */
export function blogLastModified(post: {
  updatedAt?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
}): string | null {
  const stamp = post.updatedAt ?? post.publishedAt ?? post.createdAt;
  if (!stamp) return null;
  const when = new Date(stamp);
  return Number.isNaN(when.getTime()) ? null : when.toISOString();
}

export async function buildSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const allMeta = await loadAllSeriesMeta();
  // Sort for deterministic build-to-build output. fs.readdir order is
  // OS-dependent and would otherwise differ between CI and local builds.
  const sortedMeta = [...allMeta].sort((a, b) => a.slug.localeCompare(b.slug));

  const staticUrls: MetadataRoute.Sitemap = [
    // The root IS the home page since 0.334.42; `/app` now 301s here, and
    // advertising a redirect in a sitemap earns "Page with redirect" in Search
    // Console rather than an indexed page.
    { url: SITE_URL },
    { url: `${SITE_URL}/series` },
    { url: `${SITE_URL}/calendar` },
    { url: `${SITE_URL}/news` },
    { url: `${SITE_URL}/blog` },
    { url: `${SITE_URL}/write-for-us` },
    { url: `${SITE_URL}/about` },
    { url: `${SITE_URL}/changelog` },
    // The release pages (X6 A) from the bundled index: RELEASES.md is not on the Worker, where this sitemap is
    // regenerated every six hours, and the index is all it knows of the releases.
    ...RELEASE_INDEX.map(r => ({ url: `${SITE_URL}/changelog/${r.slug}` })),
    { url: `${SITE_URL}/archive` },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },
    { url: `${SITE_URL}/cookies` },
    { url: `${SITE_URL}/accessibility` },
    { url: `${SITE_URL}/do-not-sell` },
    { url: `${SITE_URL}/imprint` },
    // /impressum is NOT advertised: it renders the same file as /imprint and now
    // canonicalises to it. Submitting a page that points its canonical elsewhere
    // earns "Duplicate, Google chose a different canonical" rather than an index
    // entry. The URL stays live and reachable for anyone looking for "Impressum".
  ];

  // The bare series URL (the calendar landing) plus each non-calendar tab as
  // its own path (B11 path-based tabs — each is a distinct, indexable page).
  // Single-event series carry a reduced tab set, and the coverage-gated
  // Tracks tab only exists for TRACKS_TAB_SLUGS series — so respect tabsFor
  // (slug-aware since the Tracks tab landed).
  //
  // An EMPTY tab is excluded for the same reason (0.334.88): twelve series blog
  // tabs and /series/nls/standings render an empty state and were submitted as
  // indexable. `tabIsEmpty` is imported rather than reimplemented so the robots
  // tag and the sitemap cannot disagree — the news exclusion below is duplicated
  // and this one deliberately is not.
  const seriesTabLists = await Promise.all(
    sortedMeta.map(async (m) => {
      const keys = tabsFor(m.singleEvent, m.slug);
      const empty = await Promise.all(keys.map((t) => tabIsEmpty(m.slug, t.key, m)));
      return keys.filter((_, i) => !empty[i]);
    }),
  );
  const seriesUrls: MetadataRoute.Sitemap = sortedMeta.flatMap((m, mi) => [
    { url: `${SITE_URL}/series/${m.slug}` },
    ...seriesTabLists[mi]
      // history + about moved to /information guides (redirected in middleware) —
      // keep the redirecting URLs out of the sitemap. About only redirects where
      // a guide exists, so gate it on aboutGuideForSeries.
      //
      // The tabs of NOINDEX_TABS (lib/tabs.ts) answer noindex in
      // components/SeriesPageView.tsx — news as motorsport.com aggregation, and
      // since R14 (2026-09-28) blog, standings, results and drivers as tables over
      // feeds with one standard paragraph — and a sitemap that submits a noindex
      // URL earns Search Console's "Submitted URL marked noindex" instead of being
      // merely ignored. One list in both places, so the two cannot contradict.
      .filter(
        (t) =>
          t.key !== 'calendar' &&
          t.key !== 'history' &&
          tabIsIndexed(t.key) &&
          !(t.key === 'about' && aboutGuideForSeries(m.slug)),
      )
      .map((t) => ({ url: `${SITE_URL}/series/${m.slug}/${t.key}` })),
  ]);

  // Weekend URLs come from the SAME resolution the pages use (groupByWeekend
  // + round assignment), not from rounds.json directly. The raw-rounds.json
  // version advertised URLs that never resolved: doubleheader second rounds
  // before the split fix, rounds whose sessions fall outside the grouping
  // window, and rounds with no sessions at all (audit 3-6 — six FE URLs
  // 404'd from the live sitemap). Round 0 = non-championship weekends
  // (tests), which have no page.
  const now = new Date();
  const weekendChunks = await Promise.all(
    sortedMeta.map(async (m): Promise<MetadataRoute.Sitemap> => {
      try {
        const series = await loadSeries(m.slug);
        // R14 (2026-09-28): only a weekend carrying an authored note is advertised;
        // the page answers noindex without one (the weekend route reads the same
        // predicate), and a sitemap must not submit a noindex URL.
        const notes = await loadWeekendNotes(m.slug);
        const weekends = groupByWeekend(series.sessions, now, series.rounds).filter((w) => w.round >= 1);
        const weekendUrls = weekends
          .filter((w) => hasWeekendNote(notes, series.meta.season, w.round))
          .map((w) => ({
            url: `${SITE_URL}/series/${m.slug}/weekend/${w.round}`,
          }));
        // X13: the session pages of the series whose schedules link them. The session route answers any session of a
        // weekend by its slug with no note needed, and the first session of a slug is the page (sessionBySlug), so each
        // slug of a weekend is listed once.
        const sessionUrls = !(SESSION_PAGE_SERIES as readonly string[]).includes(m.slug)
          ? []
          : weekends.flatMap((w) =>
              [...new Set(w.sessions.map((s) => sessionSlug(s.title)).filter(Boolean))].map((slug) => ({
                url: `${SITE_URL}/series/${m.slug}/weekend/${w.round}/${slug}`,
              })),
            );
        return [...weekendUrls, ...sessionUrls];
      } catch {
        return [];
      }
    }),
  );

  // Information hub — GATED. Only verified + featured entries (already capped in
  // the registry) reach the sitemap; the hub and any topic index holding ≥1
  // verified entry are included. The all-draft tracks directory + every
  // noindex draft/long-tail page are deliberately left out, so a section that
  // can hold hundreds of pages contributes only a controlled, high-quality set
  // to Google (the anti-"scaled content" control).
  const indexedInfo = await getIndexedInfoEntries();
  const topicIndexable = await Promise.all(
    INFO_TOPICS.map(async (t) => ({ id: t.id, ok: await isTopicIndexable(t.id) })),
  );
  const infoUrls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/information` },
    { url: `${SITE_URL}/information/series-guides` },
    ...topicIndexable
      .filter((t) => t.ok)
      .map((t) => ({ url: `${SITE_URL}/information/${t.id}` })),
    ...indexedInfo.map((e) => ({ url: `${SITE_URL}/information/${e.topic}/${e.slug}` })),
  ];

  // Author pages — one per row in `author`, so the set is editorially controlled
  // by definition (a row requires a bio). The /authors index only ships once at
  // least one profile exists; an empty index would be a thin page advertised to
  // Google. listAuthors is fail-soft, so an unreachable DB drops these entries
  // rather than failing the whole sitemap.
  const authors = await listAuthors();
  const authorUrls: MetadataRoute.Sitemap =
    authors.length > 0
      ? [
          { url: `${SITE_URL}/authors` },
          ...authors.map((a) => ({ url: `${SITE_URL}/authors/${a.slug}` })),
        ]
      : [];

  // Blog posts. The sitemap advertised /blog but not a single post on it, so the
  // site's most original content was reachable only by crawling the index — which
  // is exactly the "Crawled - currently not indexed" shape sitting in Search
  // Console. Both sources the /blog page merges are included, DB winning on a slug
  // collision to match that page's own precedence, and each is fail-soft: a
  // Supabase hiccup or an unreadable content directory drops these entries rather
  // than failing the whole sitemap.
  const [dbPosts, mdxPosts] = await Promise.all([
    publishedPosts().catch(() => []),
    loadAllPosts().catch(() => []),
  ]);
  const postSlugs = new Set<string>();
  for (const p of mdxPosts) postSlugs.add(p.slug);
  // Imported articles (original_url set) canonicalize off-site — advertising a
  // URL whose canonical says "index somewhere else" is a mixed signal, so the
  // sitemap carries original writing only.
  for (const p of dbPosts) if (p.originalUrl === null) postSlugs.add(p.slug);

  // Blog posts are THE EXCEPTION to the no-lastmod rule above, and the only one:
  // a DB post carries a real per-page change timestamp, which is exactly the
  // "significant content change" source that comment says we lack elsewhere.
  // `updated_at` is stamped by every mutating helper in lib/blog.ts, so an edit
  // to a published post moves it and a re-crawl is genuinely warranted.
  // Falls back to published_at, then created_at. An MDX-only post has no such
  // timestamp and deliberately gets NO lastmod rather than a guessed one —
  // a wrong lastmod is worse than none, which is the whole point of the rule.
  const stampBySlug = new Map<string, string>();
  for (const p of dbPosts) {
    const when = blogLastModified(p);
    if (when) stampBySlug.set(p.slug, when);
  }
  const blogUrls: MetadataRoute.Sitemap = [...postSlugs].sort().map((slug) => {
    const lastModified = stampBySlug.get(slug);
    return lastModified
      ? { url: `${SITE_URL}/blog/${slug}`, lastModified }
      : { url: `${SITE_URL}/blog/${slug}` };
  });

  // Driver profiles — GATED on an authored bio (content/series/<slug>/bios.json).
  // ~650 driver routes exist, but a bare page (Wikipedia intro + live season
  // form) is thin, so only pages carrying an original fact-checked bio are
  // advertised (the same anti-"scaled content" control as the information hub).
  // The bios key IS the /drivers/<slug> param; that route namespace is global,
  // so keys dedupe across series. loadDriverBios is fail-soft (absent file → {}).
  // /teams/* stays out until team pages carry an equivalent depth mechanism.
  const bioMaps = await Promise.all(sortedMeta.map((m) => loadDriverBios(m.slug)));
  const bioSlugs = new Set<string>();
  for (const bios of bioMaps) for (const key of Object.keys(bios)) bioSlugs.add(key);
  const driverUrls: MetadataRoute.Sitemap = [...bioSlugs]
    .sort()
    .map((slug) => ({ url: `${SITE_URL}/drivers/${slug}` }));

  // Season archive (/archive/<season>/<slug>/…). Only seasons that are NO LONGER
  // the live one: while a season is current, the archive renders the same
  // weekend as /series/<slug>/weekend/<round>, so it ships noindex + canonical
  // to the live URL, and submitting it here would earn "Submitted URL marked
  // noindex". `isArchiveLiveSeason` is the same predicate the pages use, so the
  // robots tag and the sitemap cannot disagree.
  //
  // Today this contributes ZERO URLs — 2026 is current for all fifteen series.
  // It fills in by itself at the rollover, with no code change.
  const archivePairs = await listArchivePairs();
  const archiveChunks = await Promise.all(
    archivePairs.map(async ({ season, slug }) => {
      if (await isArchiveLiveSeason(slug, season)) return [] as MetadataRoute.Sitemap;
      const archive = await loadSeasonArchive(season, slug);
      if (!archive) return [] as MetadataRoute.Sitemap;
      return [
        { url: `${SITE_URL}/archive/${season}/${slug}` },
        ...archive.weekends.map((w) => ({
          url: `${SITE_URL}/archive/${season}/${slug}/weekend/${w.round}`,
        })),
      ];
    }),
  );
  const archiveUrls = archiveChunks.flat();

  return [
    ...staticUrls,
    ...seriesUrls,
    ...weekendChunks.flat(),
    ...archiveUrls,
    ...infoUrls,
    ...authorUrls,
    ...driverUrls,
    ...blogUrls,
  ];
}
