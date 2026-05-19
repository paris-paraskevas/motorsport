// JSON-LD builders for Schema.org structured data.
//
// SSR'd into the initial HTML via <JsonLd> (see components/JsonLd.tsx).
// Per the SEO/GEO playbook: do not inject JSON-LD via client JavaScript;
// SSR is preferred so the markup is in initial HTML with no JS dependency.
//
// Stable @id references via #org / #website let other schemas point at
// the canonical site identity without re-declaring it (Article.publisher,
// SportsEvent.organizer, etc).

import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from './site';
import type { Series, Weekend, Post } from './types';

export const ORG_ID = `${SITE_URL}/#org`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
const LOGO_URL = `${SITE_URL}/icons/icon-512.png`;

export function organizationLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_TITLE,
    alternateName: 'Paddock Tracker',
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    logo: {
      '@type': 'ImageObject',
      url: LOGO_URL,
      width: 512,
      height: 512,
    },
  };
}

// Sitelinks searchbox was sunset by Google in 2024, so we deliberately
// omit `potentialAction: SearchAction`. The WebSite schema still drives
// site-name display in branded SERP results, which is its remaining value.
export function websiteLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_TITLE,
    alternateName: 'Paddock Tracker',
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en',
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

// Minimum 2 items per Google's BreadcrumbList spec. Position is 1-indexed.
// Last item's `item` URL is technically optional per spec, but we always
// include it for consistency.
export function breadcrumbLd(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function sportsEventLd(args: {
  weekend: Weekend;
  series: Series;
  slug: string;
  round: number;
  title: string;
  startDate: Date;
  endDate: Date;
}): object {
  const url = `${SITE_URL}/series/${args.slug}/weekend/${args.round}`;
  const location = args.weekend.sessions.find((s) => s.location)?.location;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: args.title,
    url,
    startDate: args.startDate.toISOString(),
    endDate: args.endDate.toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    sport: args.series.meta.name,
    organizer: {
      '@type': 'Organization',
      name: args.series.meta.name,
    },
  };
  // location is required by Schema.org for Event, but Place.address would
  // need circuit data we don't have. Place with `name` only is spec-valid;
  // Rich Results Test may warn but the schema still validates.
  if (location) {
    ld.location = {
      '@type': 'Place',
      name: location,
    };
  }
  return ld;
}

export function articleLd(args: { post: Post; url: string }): object {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: args.post.frontmatter.title,
    description: args.post.frontmatter.summary,
    url: args.url,
    datePublished: args.post.frontmatter.publishedAt,
    // No edit tracking yet — modified date = published date. When a post
    // gains an actual edit history (frontmatter `updatedAt` or git log),
    // wire that here.
    dateModified: args.post.frontmatter.publishedAt,
    author: {
      '@type': 'Person',
      name: 'Paris Paraskevas',
    },
    publisher: { '@id': ORG_ID },
  };
  if (args.post.frontmatter.heroImage) {
    ld.image = args.post.frontmatter.heroImage;
  }
  return ld;
}
