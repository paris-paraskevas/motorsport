import type { MetadataRoute } from 'next';
import path from 'path';
import { loadAllSeriesMeta } from '@/lib/series';
import { loadRounds } from '@/lib/rounds-loader';

const BASE = 'https://paddock-tracker.com';
const SERIES_ROOT = path.join(process.cwd(), 'content', 'series');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${BASE}/`,              lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/calendar`,      lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/blog`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${BASE}/about`,         lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/changelog`,     lastModified: now, changeFrequency: 'daily',   priority: 0.5 },
    { url: `${BASE}/privacy`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,         lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/cookies`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/accessibility`, lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/do-not-sell`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/imprint`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/impressum`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];

  const allMeta = await loadAllSeriesMeta();

  const seriesUrls: MetadataRoute.Sitemap = allMeta.map((m) => ({
    url: `${BASE}/series/${m.slug}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.9,
  }));

  const weekendChunks = await Promise.all(
    allMeta.map(async (m): Promise<MetadataRoute.Sitemap> => {
      const rounds = await loadRounds(path.join(SERIES_ROOT, m.slug));
      if (!rounds) return [];
      return rounds.rounds
        .filter((r) => !r.cancelled)
        .map((r) => ({
          url: `${BASE}/series/${m.slug}/weekend/${r.round}`,
          lastModified: new Date(`${r.startDate}T00:00:00Z`),
          changeFrequency: 'weekly',
          priority: 0.7,
        }));
    }),
  );

  return [...staticUrls, ...seriesUrls, ...weekendChunks.flat()];
}
