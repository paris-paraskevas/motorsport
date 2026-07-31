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
  /** Competing team names → SportsTeam[] performers. When absent/empty the
   *  series itself is emitted as the SportsOrganization performer. */
  performers?: string[];
  /** ISO 3166-1 alpha-2 — from the matched circuit; → Place.address. */
  addressCountry?: string;
  /** Matched circuit coordinates → Place.geo. */
  geo?: { lat: number; lon: number };
  /** Venue name (the matched circuit) — the Place name when no session carries a
   *  `location`. Ensures `location` is always emitted (Google requires it). */
  venue?: string;
  /** Official watch link (series.meta.watch) → an Offer (where to view). */
  watch?: { service: string; url: string };
  /** Round cancelled (rounds.json) → eventStatus = EventCancelled. */
  cancelled?: boolean;
  /** Override the event URL (e.g. a per-session page); defaults to the weekend URL. */
  url?: string;
  /** Date the round was moved from; sets eventStatus = EventRescheduled + previousStartDate. */
  previousStartDate?: string;
  /** Per-session sub-events (the weekend schedule) — each becomes a SportsEvent subEvent. */
  subEvents?: Array<{ name: string; startDate: Date; endDate: Date; url: string }>;
}): object {
  const url = args.url ?? `${SITE_URL}/series/${args.slug}/weekend/${args.round}`;
  const location = args.weekend.sessions.find((s) => s.location)?.location ?? args.venue;

  // image was already present on the top-level event but MISSING on every
  // sub-event (GSC flag) — so emit it on both. We deliberately do NOT reference
  // the per-weekend OG image route: Next serves it at a build-hashed path
  // (/…/opengraph-image-<hash>?<contenthash>, verified 2026-07 — the bare
  // /opengraph-image returns HTML, not the PNG), and hard-coding that internal
  // hash into structured data breaks silently on any rebuild / Next upgrade.
  // The stable brand logo always resolves and satisfies the image requirement.
  const image = LOGO_URL;

  // organizer.url flagged missing by GSC — always emit one: the series' official
  // site when known, else its hub on this site.
  const organizer = {
    '@type': 'Organization',
    name: args.series.meta.name,
    url: args.organizerUrl ?? `${SITE_URL}/series/${args.slug}`,
  };

  // performer flagged missing by GSC — always populated. The competing teams
  // when a roster is curated, else the series itself as the performing body (a
  // motorsport round always has its series as a SportsOrganization performer).
  const performer =
    args.performers && args.performers.length > 0
      ? args.performers.map((name) => ({ '@type': 'SportsTeam', name }))
      : [{ '@type': 'SportsOrganization', name: args.series.meta.name }];

  // offers (where to watch) when the series carries an official watch link. No
  // price: the watch products are subscription/broadcast links whose cost we
  // don't track, so asserting a price (even "0") would be inaccurate.
  const offers = args.watch
    ? {
        '@type': 'Offer',
        url: args.watch.url,
        category: 'watch',
        availability: 'https://schema.org/InStock',
      }
    : undefined;

  // A tracked reschedule always has a known new date (current start) + the old
  // one (previousStartDate), which is precisely EventRescheduled — not the
  // date-less EventPostponed. A cancelled round is EventCancelled.
  const eventStatus = args.cancelled
    ? 'https://schema.org/EventCancelled'
    : args.previousStartDate
      ? 'https://schema.org/EventRescheduled'
      : 'https://schema.org/EventScheduled';

  const description =
    args.description ??
    `Round ${args.round} of the ${args.series.meta.season} ${args.series.meta.name} season.`;

  // location: Place — REQUIRED by Google for SportsEvent rich results, so it is
  // ALWAYS emitted (a missing location invalidates the item — GSC error, NASCAR
  // Homestead, 2026-07). The name prefers a session/circuit venue, else the event
  // title. When the venue matches circuits.json we enrich with a PostalAddress
  // (country) + GeoCoordinates. No addressLocality: circuits.json carries no city
  // field, so we emit country + venue name rather than fabricate a city.
  const place: Record<string, unknown> = { '@type': 'Place', name: location ?? args.title };
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

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: args.title,
    url,
    description,
    startDate: args.startDate.toISOString(),
    endDate: args.endDate.toISOString(),
    eventStatus,
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    sport: args.series.meta.name,
    image,
    location: place,
    organizer,
    performer,
  };
  if (offers) ld.offers = offers;
  // A rescheduled round carries its former date (Schema.org pairs this with
  // eventStatus = EventRescheduled).
  if (args.previousStartDate) {
    ld.previousStartDate = toIsoDateTime(args.previousStartDate) ?? args.previousStartDate;
  }
  // The weekend's sessions as sub-events. Each is itself a SportsEvent that
  // Google validates independently, so carry the same enrichment (description,
  // location, organizer, performer, image, offers, eventStatus) — otherwise
  // every sub-event trips the "missing field" warnings the parent just fixed.
  // Sub-events take EventScheduled (or EventCancelled when the round is off);
  // they have no per-session previousStartDate, so they never claim
  // EventRescheduled.
  if (args.subEvents && args.subEvents.length > 0) {
    const subStatus = args.cancelled
      ? 'https://schema.org/EventCancelled'
      : 'https://schema.org/EventScheduled';
    ld.subEvent = args.subEvents.map((s) => {
      const sub: Record<string, unknown> = {
        '@type': 'SportsEvent',
        name: s.name,
        description: `${s.name}: ${description}`,
        startDate: s.startDate.toISOString(),
        endDate: s.endDate.toISOString(),
        url: s.url,
        eventStatus: subStatus,
        eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
        sport: args.series.meta.name,
        image,
        location: place,
        organizer,
        performer,
      };
      if (offers) sub.offers = offers;
      return sub;
    });
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

// `authorName` / `authorUrl` are set for DB posts, where the byline is a real
// resolved writer and (when they have a profile) a real /authors/<slug> URL —
// pointing author.url at that page is what ties every post to one author entity.
// MDX posts pass neither and keep the site-owner default they've always had.
export function articleLd(args: {
  post: Post;
  url: string;
  authorName?: string | null;
  authorUrl?: string | null;
}): object {
  const author: Record<string, unknown> = {
    '@type': 'Person',
    name: args.authorName || 'Paris Paraskevas',
  };
  if (args.authorUrl) {
    author['@id'] = `${args.authorUrl}#person`;
    author.url = args.authorUrl;
  }
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
    author,
    publisher: { '@id': ORG_ID },
  };
  if (args.post.frontmatter.heroImage) {
    ld.image = args.post.frontmatter.heroImage;
  }
  return ld;
}

// ProfilePage + Person for /authors/<slug>. The Person carries the same `@id`
// (`<page-url>#person`) that articleLd stamps on every post's author, so the
// writer resolves as ONE entity across the site instead of a repeated name
// string. `sameAs` takes the profile's outbound links: those are the identity
// claims that let a search engine reconcile the person with their off-site
// presence, which is the whole point of having the page.
export function profilePageLd(args: {
  name: string;
  url: string;
  bio: string;
  jobTitle?: string | null;
  image?: string | null;
  sameAs?: string[];
}): object {
  const person: Record<string, unknown> = {
    '@type': 'Person',
    '@id': `${args.url}#person`,
    name: args.name,
    url: args.url,
    description: args.bio,
    worksFor: { '@id': ORG_ID },
  };
  if (args.jobTitle) person.jobTitle = args.jobTitle;
  if (args.image) person.image = args.image;
  if (args.sameAs && args.sameAs.length > 0) person.sameAs = args.sameAs;
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: args.url,
    mainEntity: person,
  };
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
