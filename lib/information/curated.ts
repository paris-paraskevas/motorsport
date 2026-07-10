import 'server-only';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { slugify } from '../slug';
import { matchCircuit } from '../circuits';
import { isTopicId, topicForSeries, getTopic } from './topics';
import { listSeriesSlugs, loadSeriesMeta } from '../series';
import { entryHref } from './types';
import type { InfoEntry, InfoLink, InfoReview, InfoSource, TrackFacts } from './types';

// Hand-curated + web-researched content for the information hub, loaded from
// content/information/. Everything here is fail-soft: a missing/broken file
// contributes zero entries, never an error — so the section renders (from the
// generated champions Q&A alone) even before the datasets are curated.

const ROOT = path.join(process.cwd(), 'content', 'information');
const FALLBACK_DATE = '2026-07-07';

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf-8')) as T;
  } catch {
    return null;
  }
}

// gray-matter turns bare YAML dates into Date objects; normalise to YYYY-MM-DD.
function coerceDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 10);
  return FALLBACK_DATE;
}

function asSources(v: unknown): InfoSource[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s): InfoSource | null => {
      if (typeof s === 'string') return { label: s };
      if (s && typeof s === 'object' && 'label' in s) {
        const o = s as { label: unknown; url?: unknown };
        return { label: String(o.label), url: typeof o.url === 'string' ? o.url : undefined };
      }
      return null;
    })
    .filter((s): s is InfoSource => s !== null);
}

function asLinks(v: unknown): InfoLink[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((l): InfoLink | null =>
      l && typeof l === 'object' && 'href' in l && 'label' in l
        ? { label: String((l as InfoLink).label), href: String((l as InfoLink).href) }
        : null,
    )
    .filter((l): l is InfoLink => l !== null);
}

const topicOr = (v: unknown, fallback: string): string =>
  typeof v === 'string' && isTopicId(v) ? v : fallback;

// ── Editorial Q&A: content/information/answers/*.md ──────────────────────────
async function loadEditorialAnswers(): Promise<InfoEntry[]> {
  let files: string[];
  try {
    files = (await fs.readdir(path.join(ROOT, 'answers'))).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  const out: InfoEntry[] = [];
  for (const file of files.sort()) {
    try {
      const raw = await fs.readFile(path.join(ROOT, 'answers', file), 'utf-8');
      const { data, content } = matter(raw);
      const question = typeof data.question === 'string' ? data.question : '';
      if (!question || !content.trim()) continue;
      const review: InfoReview = data.review === 'unverified' ? 'unverified' : 'verified';
      out.push({
        kind: 'qa',
        topic: topicOr(data.topic, 'general'),
        slug: typeof data.slug === 'string' && data.slug ? data.slug : file.replace(/\.md$/, ''),
        question,
        summary: typeof data.summary === 'string' ? data.summary : question,
        keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
        bodyMarkdown: content.trim(),
        sources: asSources(data.sources),
        related: asLinks(data.related),
        review,
        featured: data.featured === true && review === 'verified',
        updated: coerceDate(data.updated),
      });
    } catch {
      /* one malformed answer file must not break the section */
    }
  }
  return out;
}

// ── Tracks: content/information/tracks.json (web-researched, unverified) ──────
interface RawTrack {
  slug?: string;
  name: string;
  country: string;
  countryCode?: string;
  location?: { lat?: number; lng?: number };
  lengthKm?: number | null;
  turns?: number | null;
  opened?: number | null;
  type?: string;
  categories?: string[];
  summary?: string;
  /** Long-form, fact-checked circuit guide (markdown). Its presence is what
   *  turns a thin stub into a substantial, index-worthy page. */
  article?: string;
  sources?: unknown;
  review?: string;
  featured?: boolean;
}

async function loadTracks(): Promise<InfoEntry[]> {
  const raw = await readJson<RawTrack[] | { tracks?: RawTrack[] }>('tracks.json');
  const list = Array.isArray(raw) ? raw : raw?.tracks;
  if (!Array.isArray(list)) return [];

  const out: InfoEntry[] = [];
  for (const t of list) {
    if (!t?.name || !t?.country) continue;
    const slug = t.slug || slugify(t.name);

    // Prefer OUR curated coordinates when the venue matches content/circuits.json.
    let location = t.location?.lat != null && t.location?.lng != null
      ? { lat: t.location.lat, lng: t.location.lng }
      : undefined;
    let coordsVerified = false;
    const matched = await matchCircuit(t.name, slug.replace(/-/g, ' '));
    if (matched) {
      location = { lat: matched.lat, lng: matched.lon };
      coordsVerified = true;
    }

    const track: TrackFacts = {
      country: t.country,
      countryCode: t.countryCode,
      location,
      lengthKm: t.lengthKm ?? null,
      turns: t.turns ?? null,
      opened: t.opened ?? null,
      type: t.type,
      categories: Array.isArray(t.categories) ? t.categories.map(String) : [],
      coordsVerified,
    };

    const facts: string[] = [];
    if (track.type) facts.push(`Type: ${track.type}`);
    if (track.lengthKm) facts.push(`Length: ${track.lengthKm} km`);
    if (track.turns) facts.push(`Turns: ${track.turns}`);
    if (track.opened) facts.push(`Opened: ${track.opened}`);
    // A rich `article` makes the page substantial; when present, drop the inline
    // facts line (the Circuit-facts table already renders those on the page).
    const article = typeof t.article === 'string' ? t.article.trim() : '';
    const body = [
      t.summary?.trim(),
      article,
      article ? '' : facts.length ? facts.join(' · ') : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const review: InfoReview = t.review === 'verified' ? 'verified' : 'unverified';
    out.push({
      kind: 'track',
      topic: 'tracks',
      slug,
      question: t.name,
      summary: t.summary?.trim() || `${t.name} — a racing venue in ${t.country}.`,
      keywords: [t.name, `${t.name} circuit`, `${t.country} race track`, t.country],
      bodyMarkdown: body,
      sources: asSources(t.sources),
      related: [
        { label: 'All tracks & circuits', href: '/information/tracks' },
        { label: 'Browse every series', href: '/series' },
      ],
      review,
      featured: t.featured === true && review === 'verified',
      updated: FALLBACK_DATE,
      track,
    });
  }
  return out;
}

// ── Team histories: content/information/team-histories.json (unverified) ──────
interface RawTeamHistory {
  slug?: string;
  team: string;
  topic?: string;
  question?: string;
  summary?: string;
  foundingYear?: number | null;
  titles?: string | null;
  body: string;
  sources?: unknown;
  review?: string;
  featured?: boolean;
}

async function loadTeamHistories(): Promise<InfoEntry[]> {
  const raw = await readJson<RawTeamHistory[] | { teams?: RawTeamHistory[] }>('team-histories.json');
  const list = Array.isArray(raw) ? raw : raw?.teams;
  if (!Array.isArray(list)) return [];

  const out: InfoEntry[] = [];
  for (const t of list) {
    if (!t?.team || !t?.body?.trim()) continue;
    const question = t.question || `What is the history of ${t.team}?`;
    const facts: string[] = [];
    if (t.foundingYear) facts.push(`**Founded:** ${t.foundingYear}`);
    if (t.titles) facts.push(`**Major titles:** ${t.titles}`);
    const body = [facts.join('  \n'), t.body.trim()].filter(Boolean).join('\n\n');
    const review: InfoReview = t.review === 'verified' ? 'verified' : 'unverified';
    out.push({
      kind: 'qa',
      // Team histories live under the Teams hub regardless of the discipline
      // tag in the file (kept there for reference/curation only).
      topic: 'teams',
      slug: t.slug || slugify(`${t.team}-history`),
      question,
      summary: t.summary?.trim() || `A short history of ${t.team}.`,
      keywords: [t.team, `${t.team} history`, `${t.team} championships`],
      bodyMarkdown: body,
      sources: asSources(t.sources),
      related: [
        { label: 'More team histories', href: '/information/teams' },
        { label: 'Browse every series', href: '/series' },
      ],
      review,
      featured: t.featured === true && review === 'verified',
      updated: FALLBACK_DATE,
    });
  }
  return out;
}

// ── Feeder rising stars: content/information/rising-stars.json (unverified) ───
interface RawStar {
  name: string;
  nationality?: string;
  born?: string | number | null;
  currentSeries?: string;
  ladder?: string;
  academy?: string | null;
  highlights?: string[];
  why?: string;
  sources?: unknown;
}

async function loadRisingStars(): Promise<InfoEntry[]> {
  const raw = await readJson<RawStar[] | { drivers?: RawStar[]; review?: string }>('rising-stars.json');
  const list = Array.isArray(raw) ? raw : raw?.drivers;
  if (!Array.isArray(list) || list.length === 0) return [];
  const review: InfoReview =
    !Array.isArray(raw) && raw?.review === 'verified' ? 'verified' : 'unverified';

  // Group by ladder for a legible watchlist.
  const byLadder = new Map<string, RawStar[]>();
  for (const s of list) {
    if (!s?.name) continue;
    const k = s.ladder || 'single-seater';
    (byLadder.get(k) ?? byLadder.set(k, []).get(k)!).push(s);
  }
  const sections: string[] = [
    'Drivers on the junior ladder tipped as future stars, curated from the 2025–2026 feeder seasons. This list is reviewed periodically as results come in.',
  ];
  const sources = new Set<string>();
  for (const [ladder, stars] of byLadder) {
    sections.push(`### ${ladder.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`);
    for (const s of stars) {
      const bits = [
        `**${s.name}**`,
        s.nationality ? `(${s.nationality}${s.born ? `, b. ${s.born}` : ''})` : '',
        s.currentSeries ? `— ${s.currentSeries}` : '',
        s.academy ? `· ${s.academy}` : '',
      ].filter(Boolean).join(' ');
      const detail = [s.why, (s.highlights ?? []).join('; ')].filter(Boolean).join(' — ');
      sections.push(`- ${bits}${detail ? `: ${detail}` : ''}`);
      for (const src of asSources(s.sources)) if (src.url) sources.add(src.url);
    }
  }

  return [
    {
      kind: 'watchlist',
      topic: 'feeder-series',
      slug: 'up-and-coming-drivers-to-watch',
      question: 'Which up-and-coming drivers should you watch in the feeder series?',
      summary:
        'A curated watchlist of rising stars on the junior single-seater and karting ladder.',
      keywords: [
        'up and coming drivers',
        'rising stars motorsport',
        'future F1 drivers',
        'F2 F3 prospects',
        'junior formula drivers to watch',
      ],
      bodyMarkdown: sections.join('\n\n'),
      sources: [...sources].map((url) => ({ label: url, url })),
      related: [
        { label: 'Feeder series questions', href: '/information/feeder-series' },
        { label: 'Formula 2', href: '/series/f2' },
        { label: 'Formula 3', href: '/series/f3' },
      ],
      review,
      featured: review === 'verified',
      updated: FALLBACK_DATE,
    },
  ];
}

// ── Generated aggregate pages from the tracks data ──────────────────────────
// "What racing tracks are in <country>?" (per country) + "Which are the most
// famous racing circuits in the world?". Derived from the track entries, so they
// inherit their review status — verified/indexable only when every member track
// is verified (a single unverified track keeps the aggregate a noindex draft).
const MARQUEE_CATEGORIES = ['f1', 'motogp', 'endurance', 'nascar', 'indycar'];

function trackAggregates(tracks: InfoEntry[]): InfoEntry[] {
  const out: InfoEntry[] = [];

  const byCountry = new Map<string, InfoEntry[]>();
  for (const t of tracks) {
    const c = t.track?.country;
    if (!c) continue;
    (byCountry.get(c) ?? byCountry.set(c, []).get(c)!).push(t);
  }

  // Per-country pages — only where there are ≥2 venues (a 1-item list is thin).
  for (const [country, listRaw] of [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (listRaw.length < 2) continue;
    const list = [...listRaw].sort((a, b) => a.question.localeCompare(b.question));
    const review: InfoReview = list.every((t) => t.review === 'verified') ? 'verified' : 'unverified';
    const body = [
      `${country} is home to **${list.length}** notable racing venues in our directory — here is each, with a note on what it is known for:`,
      '',
      ...list.map((t) => {
        const facts = [
          t.track?.type,
          t.track?.lengthKm ? `${t.track.lengthKm} km` : null,
          t.track?.opened ? `opened ${t.track.opened}` : null,
        ]
          .filter(Boolean)
          .join(', ');
        const note = t.summary ? ` ${t.summary}` : '';
        return `- **[${t.question}](${entryHref(t)})**${facts ? ` — ${facts}.` : ''}${note}`;
      }),
    ].join('\n');
    out.push({
      kind: 'qa',
      topic: 'tracks',
      slug: slugify(`racing-tracks-in-${country}`),
      question: `What racing tracks are in ${country}?`,
      summary: `${country} is home to ${list.length} notable racing venues, including ${list.slice(0, 3).map((t) => t.question).join(', ')}.`,
      keywords: [
        `race tracks in ${country}`,
        `racing circuits in ${country}`,
        `${country} motorsport venues`,
        `how many race tracks in ${country}`,
      ],
      bodyMarkdown: body,
      sources: [{ label: 'Paddock tracks directory' }],
      related: [
        { label: 'All tracks & circuits', href: '/information/tracks' },
        { label: 'Most famous circuits in the world', href: '/information/tracks/most-famous-racing-circuits-in-the-world' },
      ],
      review,
      featured: review === 'verified',
      updated: FALLBACK_DATE,
    });
  }

  // "Most famous circuits" — marquee venues (F1/MotoGP/endurance/oval), no karting.
  const famous = tracks
    .filter((t) => {
      const cats = t.track?.categories ?? [];
      return t.track?.type !== 'karting' && MARQUEE_CATEGORIES.some((c) => cats.includes(c));
    })
    .sort((a, b) => (a.track?.country ?? '').localeCompare(b.track?.country ?? '') || a.question.localeCompare(b.question));
  if (famous.length > 0) {
    const review: InfoReview = famous.every((t) => t.review === 'verified') ? 'verified' : 'unverified';
    out.push({
      kind: 'qa',
      topic: 'tracks',
      slug: 'most-famous-racing-circuits-in-the-world',
      question: 'Which are the most famous racing circuits in the world?',
      summary:
        'A guide to the world’s most famous racing circuits — from Monaco and Monza to Spa, Suzuka, Le Mans and the Nürburgring.',
      keywords: [
        'most famous race tracks',
        'famous racing circuits',
        'iconic race tracks in the world',
        'best circuits in the world',
      ],
      bodyMarkdown: [
        'Some circuits are known the world over for their history, their challenge, and the great races they have staged. Among the most famous venues in our directory:',
        '',
        ...famous.map((t) => `- [${t.question}](${entryHref(t)}) — ${t.track?.country}${t.track?.type ? ` (${t.track.type})` : ''}`),
      ].join('\n'),
      sources: [{ label: 'Paddock tracks directory' }],
      related: [
        { label: 'All tracks & circuits', href: '/information/tracks' },
        { label: 'What makes a race track great?', href: '/information/tracks/what-makes-a-race-track-great' },
      ],
      review,
      featured: review === 'verified',
      updated: FALLBACK_DATE,
    });
  }

  return out;
}

// ── Series guides: content/series/<slug>/{history,rules}.md → long-form ───────
// editorial guide pages in /information. SINGLE SOURCE OF TRUTH — the same files
// the series History tab + About-tab "Rules essentials" render, read straight
// from content/series/ (no duplication). Ship `featured: false` (noindex, out of
// the sitemap) so they don't compete with the still-live series editorial tabs
// for indexing; the IA restructure flips them featured as those tabs redirect
// here (Phase C). Reachable now via topic index pages + on-site search.
async function readSeriesMd(
  slug: string,
  file: string,
): Promise<{ body: string; author?: string; updated: string } | null> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), 'content', 'series', slug, file),
      'utf-8',
    );
    const { content, data } = matter(raw);
    if (!content.trim()) return null;
    return {
      body: content.trim(),
      author: typeof data.author === 'string' ? data.author : undefined,
      updated: coerceDate(data['last-updated']),
    };
  } catch {
    return null;
  }
}

async function loadSeriesGuides(): Promise<InfoEntry[]> {
  const slugs = await listSeriesSlugs();
  const out: InfoEntry[] = [];
  for (const slug of slugs) {
    const meta = await loadSeriesMeta(slug).catch(() => null);
    if (!meta) continue;
    const name = meta.name;
    const topic = topicForSeries(slug);
    const topicLabel = getTopic(topic)?.label ?? 'more';
    const officialSource: InfoSource[] = meta.officialSite
      ? [{ label: `${name} — official site`, url: meta.officialSite }]
      : [];

    const hist = await readSeriesMd(slug, 'history.md');
    if (hist) {
      out.push({
        kind: 'guide',
        topic,
        slug: `the-history-of-${slug}`,
        question: `The history of ${name}`,
        summary: `How ${name} came to be — its origins, defining eras and the modern championship.`,
        keywords: [`${name} history`, `history of ${name}`, `${name} origins`, `${name} explained`],
        bodyMarkdown: hist.body,
        sources: officialSource,
        related: [
          { label: name, href: `/series/${slug}` },
          { label: `${name} rules explained`, href: `/information/${topic}/${slug}-rules-explained` },
          { label: `More ${topicLabel} answers`, href: `/information/${topic}` },
        ],
        review: 'verified',
        featured: false,
        updated: hist.updated,
        author: hist.author,
      });
    }

    const rules = await readSeriesMd(slug, 'rules.md');
    if (rules) {
      out.push({
        kind: 'guide',
        topic,
        slug: `${slug}-rules-explained`,
        question: `${name} rules explained`,
        summary: `The essential rules of ${name} — the race format, how points are scored, and what decides the title.`,
        keywords: [`${name} rules`, `how ${name} works`, `${name} points system`, `${name} regulations`],
        bodyMarkdown: rules.body,
        sources: meta.regulationsUrl
          ? [{ label: `${name} — regulations`, url: meta.regulationsUrl }, ...officialSource]
          : officialSource,
        related: [
          { label: name, href: `/series/${slug}` },
          { label: `The history of ${name}`, href: `/information/${topic}/the-history-of-${slug}` },
          { label: `More ${topicLabel} answers`, href: `/information/${topic}` },
        ],
        review: 'verified',
        featured: false,
        updated: rules.updated,
        author: rules.author,
      });
    }
  }
  return out;
}

/** All curated + web-researched entries (editorial answers, tracks, team
 *  histories, rising stars, per-series history/rules guides) plus generated
 *  track-aggregate pages (per-country + most-famous). Order is stable within
 *  each source. */
export async function loadCuratedInfoEntries(): Promise<InfoEntry[]> {
  const [answers, tracks, teams, stars, guides] = await Promise.all([
    loadEditorialAnswers(),
    loadTracks(),
    loadTeamHistories(),
    loadRisingStars(),
    loadSeriesGuides(),
  ]);
  // Every curated entry carries the operator byline (E-E-A-T); generated
  // champions-derived entries deliberately do not (see registry/generated.ts).
  const AUTHOR = 'Paris Paraskevas';
  return [...answers, ...tracks, ...teams, ...stars, ...guides, ...trackAggregates(tracks)].map(
    (e) => ({ ...e, author: e.author ?? AUTHOR }),
  );
}
