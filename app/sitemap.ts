import type { MetadataRoute } from 'next';
import { buildSitemapEntries } from '@/lib/sitemap-data';

// Next.js 16 file convention: this default export becomes /sitemap.xml.
// The actual data assembly lives in lib/sitemap-data.ts so vitest can
// exercise it (vitest.config.ts only matches lib/** and tests/**).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemapEntries();
}
