// Data model for the Motorsport Information hub (/information) — a curated
// "questions answered" + reference section.
//
// Two-tier trust model (the anti-spam / accuracy control, see
// docs/research/2026-07-07-information-hub.md):
//   • review: 'verified'   — derived from our already-fact-checked curated repo
//                            data (champions.json) or hand-written evergreen
//                            explainers with cited sources.
//   • review: 'unverified' — drafted from open web research (tracks, team
//                            histories, rising stars); ships noindex, is
//                            excluded from the sitemap AND the on-site search
//                            index, and renders a "pending review" banner until
//                            an editor promotes it.
//
// A page is INDEXED (indexable + eligible for the sitemap) only when it is
// `verified` AND `featured` AND inside the global cap (registry.ts). Everything
// else renders with <meta robots="noindex"> — so we can build hundreds of pages
// without ever risking a Search Console "scaled content" action.

export type InfoReview = 'verified' | 'unverified';

/** qa = a question + answer. track = a circuit/venue profile (structured
 *  facts + map). watchlist = the feeder rising-stars list page. guide = a
 *  long-form editorial essay (a series' history / rules), sourced from
 *  content/series/<slug>/{history,rules}.md. */
export type InfoKind = 'qa' | 'track' | 'watchlist' | 'guide';

export interface InfoSource {
  label: string;
  /** Optional — an official/authoritative URL. Omitted for "our own curated
   *  championship records" style provenance. */
  url?: string;
}

/** An internal link back into the rest of the site — the whole section exists
 *  partly to funnel this traffic onward (series, drivers, weekends…). */
export interface InfoLink {
  label: string;
  href: string;
}

/** Structured facts for a `track` entry. Descriptive fields are unverified web
 *  research; `coordsVerified` is true only when lat/lng were overridden from
 *  our curated content/circuits.json. */
export interface TrackFacts {
  country: string;
  countryCode?: string;
  location?: { lat: number; lng: number };
  lengthKm?: number | null;
  turns?: number | null;
  opened?: number | null;
  /** circuit | street | oval | rally | karting */
  type?: string;
  categories?: string[];
  coordsVerified?: boolean;
}

/** One rendered page in the information hub. */
export interface InfoEntry {
  kind: InfoKind;
  /** Topic id — see lib/information/topics.ts (drives the /information/[topic] URL). */
  topic: string;
  /** Unique within its topic; forms the /information/[topic]/[slug] URL. */
  slug: string;
  /** The H1, phrased as a natural question (or a plain title for tracks). */
  question: string;
  /** Meta description + hub/teaser line. Keep ≤ ~160 chars. */
  summary: string;
  /** SEO keyword variants — also become on-site search tokens. */
  keywords: string[];
  /** The answer/body in markdown (rendered via lib/content renderMarkdown). */
  bodyMarkdown: string;
  sources: InfoSource[];
  related: InfoLink[];
  review: InfoReview;
  /** Hand-picked (or generator-elected) for indexing. Only verified+featured
   *  entries are eligible for index/sitemap; still subject to the global cap. */
  featured: boolean;
  /** ISO date (YYYY-MM-DD) of last curation. */
  updated: string;
  /** Byline for authored/curated content (an E-E-A-T trust signal). Set on the
   *  curated datasets; absent on auto-generated champions-derived entries, which
   *  are data-derived rather than written — so we never slap a byline on a
   *  templated stub. */
  author?: string;
  /** Present only when kind === 'track'. */
  track?: TrackFacts;
}

/** Stable unique key for an entry (topic + slug). */
export function entryKey(e: Pick<InfoEntry, 'topic' | 'slug'>): string {
  return `${e.topic}/${e.slug}`;
}

/** Site-relative URL for an entry. */
export function entryHref(e: Pick<InfoEntry, 'topic' | 'slug'>): string {
  return `/information/${e.topic}/${e.slug}`;
}
