import type { MetadataRoute } from 'next';
import path from 'path';
import { loadAllSeriesMeta } from './series';
import { loadRounds } from './rounds-loader';
import { SITE_URL } from './site';

const SERIES_ROOT = path.join(process.cwd(), 'content', 'series');

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

  const seriesUrls: MetadataRoute.Sitemap = sortedMeta.map((m) => ({
    url: `${SITE_URL}/series/${m.slug}`,
  }));

  const weekendChunks = await Promise.all(
    sortedMeta.map(async (m): Promise<MetadataRoute.Sitemap> => {
      const rounds = await loadRounds(path.join(SERIES_ROOT, m.slug));
      if (!rounds) return [];
      return rounds.rounds
        .filter((r) => !r.cancelled)
        .map((r) => ({
          url: `${SITE_URL}/series/${m.slug}/weekend/${r.round}`,
        }));
    }),
  );

  return [...staticUrls, ...seriesUrls, ...weekendChunks.flat()];
}
