import { fetchUpstream } from './fetch-upstream';
import { readResultsCache, writeResultsCache } from './results-cache';
import { slugify } from './slug';

// Short Wikipedia "About" bio for driver/team profile pages: the intro extract
// of the article whose title is the curated name. Fetched via the Wikimedia
// ACTION API (action=query&prop=extracts&exintro, plaintext) — NEVER the /wiki/
// article frontend, whose bot mitigation blocks Vercel's datacenter IPs
// (0.150.2 lesson; same reason lib/results/nls.ts uses action=parse and
// lib/wikipedia-champions.ts uses the REST API). Fail-soft throughout: any
// miss/ambiguity/error → null and the profile page simply omits the section.

// Wikimedia asks API clients for a descriptive User-Agent identifying the app +
// a contact. A datacenter IP spoofing a browser UA is exactly what the /wiki/
// frontend mitigation blocked; identify Paddock instead. (Mirrors lib/results/nls.ts.)
const WIKIMEDIA_UA =
  'PaddockTracker/1.0 (https://paddock-tracker.com; pparaskevas.dev@gmail.com)';

const API_BASE = 'https://en.wikipedia.org/w/api.php';

// Curated names are guesses at article titles, so a hit can be the wrong
// subject entirely (a politician sharing a junior driver's name, a company
// page for a team name). Requiring a motorsport-ish word in the intro keeps a
// wrong-person bio off a profile page; a false negative just omits the section
// (fail-soft), which is the cheaper error.
const MOTORSPORT_HINT =
  /\b(racing|races?|raced|driver|rider|motorsport|motorsports|formula|grand prix|rall(?:y|ying)|nascar|indycar|motogp|motorcycl\w*|le mans|endurance|touring car|karting|stock car|automobile|automotive|constructor)\b/i;

const MAX_PARAGRAPHS = 3;
const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24h — bios are near-static

export interface WikipediaBio {
  /** Resolved article title (post-redirect), e.g. "Max Verstappen". */
  title: string;
  /** Intro paragraphs, plaintext, capped at MAX_PARAGRAPHS. */
  paragraphs: string[];
  /** Canonical article URL for the "Wikipedia →" attribution link. */
  url: string;
}

interface WikiExtractPage {
  pageid?: number;
  title?: string;
  missing?: boolean;
  extract?: string;
  pageprops?: Record<string, string>;
}

interface WikiExtractResponse {
  query?: { pages?: WikiExtractPage[] };
}

/**
 * Parse an action-API extracts response (format=json&formatversion=2) into a
 * WikipediaBio. Exported for unit tests. Returns null for: no page, a missing
 * title, a disambiguation page, an empty extract, or an intro that doesn't
 * read as a motorsport subject (wrong-person guard).
 */
export function parseBioResponse(json: unknown): WikipediaBio | null {
  const page = (json as WikiExtractResponse)?.query?.pages?.[0];
  if (!page || page.missing || !page.title) return null;
  // Disambiguation pages carry the `disambiguation` pageprop — a name that
  // maps to several subjects is a miss, not a bio.
  if (page.pageprops && 'disambiguation' in page.pageprops) return null;

  const extract = (page.extract ?? '').trim();
  if (!extract) return null;
  if (!MOTORSPORT_HINT.test(extract)) return null;

  const paragraphs = extract
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .slice(0, MAX_PARAGRAPHS);
  if (paragraphs.length === 0) return null;

  return {
    title: page.title,
    paragraphs,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
  };
}

// Cache wrapper so a deterministic miss (driver without an article) is also
// remembered — otherwise every profile render of the ~600 article-less
// drivers would re-hit the API for another null.
interface CachedBio {
  bio: WikipediaBio | null;
}

/**
 * Intro bio for a curated driver/team name. KV-cached 24h (hits AND misses);
 * fail-soft: any fetch/parse problem → null, never a throw.
 */
export async function fetchWikipediaBio(name: string): Promise<WikipediaBio | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const key = `paddock:wiki-bio:${slugify(trimmed)}`;
  const cached = await readResultsCache<CachedBio>(key);
  if (cached) return cached.bio;

  const url =
    `${API_BASE}?action=query&prop=extracts%7Cpageprops&exintro=1&explaintext=1` +
    `&ppprop=disambiguation&redirects=1&format=json&formatversion=2` +
    `&titles=${encodeURIComponent(trimmed)}`;

  let bio: WikipediaBio | null;
  try {
    const res = await fetchUpstream(url, {
      headers: { 'User-Agent': WIKIMEDIA_UA, Accept: 'application/json' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null; // transient upstream trouble — don't cache
    bio = parseBioResponse(await res.json());
  } catch {
    return null; // network/timeout — don't cache, retry next render
  }

  await writeResultsCache<CachedBio>(key, { bio }, CACHE_TTL_SECONDS);
  return bio;
}
