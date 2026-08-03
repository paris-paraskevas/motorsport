import type { MetadataRoute } from 'next';
import { loadAllSeriesMeta, loadSeries } from './series';
import { groupByWeekend } from './group';
import { tabsFor } from './tabs';
import { SITE_URL } from './site';
import { INFO_TOPICS, aboutGuideForSeries } from './information/topics';
import { getIndexedInfoEntries, isTopicIndexable } from './information/registry';
import { listAuthors } from './authors';
import { publishedPosts } from './blog';
import { loadAllPosts } from './posts';

// Google's 2026 sitemap guidance: `priority` and `changefreq` are ignored
// entirely; `lastmod` is the only acted-upon hint, and only when its accuracy
// is verifiable against actual page-change history. Until we wire a per-page
// "significant content change" timestamp source (rounds.json / sessions.json
// edit history, markdown frontmatter dates, etc.), emitting `lastModified:
// new Date()` on every build would train Google to ignore the field — worse
// than omitting it. So entries here are minimal `<url><loc>` only.
export async function buildSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const allMeta = await loadAllSeriesMeta();
  // Sort for deterministic build-to-build output. fs.readdir order is
  // OS-dependent and would otherwise differ between CI and local builds.
  const sortedMeta = [...allMeta].sort((a, b) => a.slug.localeCompare(b.slug));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: SITE_URL },
    { url: `${SITE_URL}/app` },
    { url: `${SITE_URL}/series` },
    { url: `${SITE_URL}/calendar` },
    { url: `${SITE_URL}/news` },
    { url: `${SITE_URL}/blog` },
    { url: `${SITE_URL}/about` },
    { url: `${SITE_URL}/changelog` },
    { url: `${SITE_URL}/privacy` },
    { url: `${SITE_URL}/terms` },
    { url: `${SITE_URL}/cookies` },
    { url: `${SITE_URL}/accessibility` },
    { url: `${SITE_URL}/do-not-sell` },
    { url: `${SITE_URL}/imprint` },
    { url: `${SITE_URL}/impressum` },
  ];

  // The bare series URL (the calendar landing) plus each non-calendar tab as
  // its own path (B11 path-based tabs — each is a distinct, indexable page).
  // Single-event series carry a reduced tab set, and the coverage-gated
  // Tracks tab only exists for TRACKS_TAB_SLUGS series — so respect tabsFor
  // (slug-aware since the Tracks tab landed).
  const seriesUrls: MetadataRoute.Sitemap = sortedMeta.flatMap((m) => [
    { url: `${SITE_URL}/series/${m.slug}` },
    ...tabsFor(m.singleEvent, m.slug)
      // history + about moved to /information guides (redirected in proxy.ts) —
      // keep the redirecting URLs out of the sitemap. About only redirects where
      // a guide exists, so gate it on aboutGuideForSeries.
      .filter(
        (t) =>
          t.key !== 'calendar' &&
          t.key !== 'history' &&
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
        return groupByWeekend(series.sessions, now, series.rounds)
          .filter((w) => w.round >= 1)
          .map((w) => ({
            url: `${SITE_URL}/series/${m.slug}/weekend/${w.round}`,
          }));
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
  const blogUrls: MetadataRoute.Sitemap = [...postSlugs]
    .sort()
    .map((slug) => ({ url: `${SITE_URL}/blog/${slug}` }));

  return [
    ...staticUrls,
    ...seriesUrls,
    ...weekendChunks.flat(),
    ...infoUrls,
    ...authorUrls,
    ...blogUrls,
  ];
}
