import 'server-only';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { slugify } from '../slug';
import { matchCircuit } from '../circuits';
import { isTopicId } from './topics';
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
    const body = [t.summary?.trim(), facts.length ? facts.join(' · ') : '']
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
      featured: false,
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
      review: 'unverified',
      featured: false,
      updated: FALLBACK_DATE,
    },
  ];
}

/** All curated + web-researched entries (editorial answers, tracks, team
 *  histories, rising stars). Order is stable within each source. */
export async function loadCuratedInfoEntries(): Promise<InfoEntry[]> {
  const [answers, tracks, teams, stars] = await Promise.all([
    loadEditorialAnswers(),
    loadTracks(),
    loadTeamHistories(),
    loadRisingStars(),
  ]);
  return [...answers, ...tracks, ...teams, ...stars];
}
