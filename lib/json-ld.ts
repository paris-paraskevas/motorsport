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
    alternateName: 'Paddock',
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
    alternateName: 'Paddock',
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
  description?: string;
  organizerUrl?: string;
  /** Competing team names → SportsTeam[] performers. */
  performers?: string[];
  /** ISO 3166-1 alpha-2 — from the matched circuit; → Place.address. */
  addressCountry?: string;
  /** Matched circuit coordinates → Place.geo. */
  geo?: { lat: number; lon: number };
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
    // Stable brand image — a per-event OG image would be nicer, but its
    // hashed dynamic URL isn't safe to hard-reference in structured data.
    image: LOGO_URL,
    organizer: {
      '@type': 'Organization',
      name: args.series.meta.name,
      ...(args.organizerUrl ? { url: args.organizerUrl } : {}),
    },
  };
  if (args.description) ld.description = args.description;
  if (args.performers && args.performers.length > 0) {
    ld.performer = args.performers.map((name) => ({ '@type': 'SportsTeam', name }));
  }
  // location: Place. When the venue matches our curated circuits.json we enrich
  // it with a PostalAddress (country) + GeoCoordinates; otherwise name-only,
  // which is still spec-valid.
  if (location) {
    const place: Record<string, unknown> = { '@type': 'Place', name: location };
    if (args.addressCountry) {
      place.address = { '@type': 'PostalAddress', addressCountry: args.addressCountry };
    }
    if (args.geo) {
      place.geo = {
        '@type': 'GeoCoordinates',
        latitude: args.geo.lat,
        longitude: args.geo.lon,
      };
    }
    ld.location = place;
  }
  return ld;
}

// Coerce a bare YYYY-MM-DD into a full ISO-8601 datetime with an explicit UTC
// offset. QAPage date fields are DateTime in Schema.org, and Google's Rich
// Results test rejects a bare date as "missing a timezone" / "invalid datetime".
function toIsoDateTime(d?: string): string | undefined {
  if (!d) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00+00:00` : d;
}

// QAPage for a single question + curated answer (the /information/[topic]/[slug]
// pages). Only emitted on INDEXED `qa` entries — a track profile isn't a Q&A, so
// its page omits this (avoids a structured-data-vs-content mismatch). `answerText`
// must be plain text (no markdown). Google requires `answerCount` and recommends
// author/text/datePublished/upvoteCount — all populated so the markup validates
// for rich results.
export function qaPageLd(args: {
  question: string;
  answerText: string;
  url: string;
  dateModified?: string;
  author?: string;
}): object {
  const iso = toIsoDateTime(args.dateModified);
  // `author.url` is a recommended Q&A field — GSC flags its absence on both
  // mainEntity.author and acceptedAnswer.author (this const feeds both). Point it
  // at the site identity so the author resolves to a real URL.
  const author = { '@type': 'Person', name: args.author || 'Paris Paraskevas', url: SITE_URL };
  const dates = iso ? { datePublished: iso, dateModified: iso } : {};
  return {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: args.question,
      text: args.question,
      url: args.url,
      answerCount: 1,
      author,
      ...dates,
      acceptedAnswer: {
        '@type': 'Answer',
        text: args.answerText,
        url: args.url,
        upvoteCount: 0,
        author,
        ...(iso ? { datePublished: iso } : {}),
      },
    },
  };
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

// Article schema for a series' curated History essay (/series/<slug>/history).
// These are the site's strongest ORIGINAL content (hand-written, cited, 750-970
// words each) — worth marking as proper articles so search engines treat them as
// such rather than as a generic tab. `date` (from the essay's last-updated
// frontmatter) is used for both published + modified since we don't track an
// edit history separately.
export function historyArticleLd(args: {
  seriesName: string;
  url: string;
  author?: string;
  date?: string;
}): object {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${args.seriesName} — history`,
    about: args.seriesName,
    url: args.url,
    author: { '@type': 'Person', name: args.author || 'Paris Paraskevas' },
    publisher: { '@id': ORG_ID },
    isAccessibleForFree: true,
  };
  if (args.date) {
    ld.datePublished = args.date;
    ld.dateModified = args.date;
  }
  return ld;
}

// Article schema for a long-form editorial /information guide (a series' history
// or rules essay). Like historyArticleLd but generic over the headline, so the
// same builder serves both guide kinds.
export function guideArticleLd(args: {
  headline: string;
  url: string;
  author?: string;
  date?: string;
}): object {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: args.headline,
    url: args.url,
    author: { '@type': 'Person', name: args.author || 'Paris Paraskevas' },
    publisher: { '@id': ORG_ID },
    isAccessibleForFree: true,
  };
  if (args.date) {
    ld.datePublished = args.date;
    ld.dateModified = args.date;
  }
  return ld;
}
