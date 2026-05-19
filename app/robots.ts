import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/settings', '/sign-in', '/sign-up'],
      },
    ],
    sitemap: 'https://paddock-tracker.com/sitemap.xml',
    host: 'https://paddock-tracker.com',
  };
}
