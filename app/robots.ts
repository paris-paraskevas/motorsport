import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // R15 (2026-09-28): the Filters region's chips link every combination of series, so a crawler finds the graph of
        // all subsets (Ahrefs: 180,278 link targets on a site of 1,034 pages). Every filtered page answers noindex with a
        // canonical to the plain page and its links carry nofollow; this keeps crawlers off them at the door, the option
        // Google's faceted-navigation page prefers for filtered pages that need no indexing. The plain /calendar and
        // /news and every sitemap page carry no filter in their query and stay crawlable.
        disallow: ['/api/', '/settings', '/sign-in', '/sign-up', '/*?*filter='],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
