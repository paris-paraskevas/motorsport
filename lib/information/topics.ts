// Topics for the Motorsport Information hub. A topic is one /information/[topic]
// index page; every InfoEntry belongs to exactly one. Kept intentionally small
// (a handful of durable buckets) rather than one-per-series, so the IA stays
// legible and each index page has real depth.

export interface InfoTopic {
  id: string;
  label: string;
  /** One-line description shown on the hub topic card + the topic index. */
  blurb: string;
}

export const INFO_TOPICS: InfoTopic[] = [
  {
    id: 'formula-1',
    label: 'Formula 1 & Open-Wheel',
    blurb: 'Grand Prix racing, IndyCar and Formula E — the pinnacle of single-seaters.',
  },
  {
    id: 'feeder-series',
    label: 'Feeder Series',
    blurb: 'The junior ladder — Formula 2, Formula 3, Formula 4, F3000 and karting.',
  },
  {
    id: 'motogp',
    label: 'MotoGP & Bikes',
    blurb: 'Grand Prix motorcycle racing and World Superbikes.',
  },
  {
    id: 'endurance',
    label: 'Endurance & GT',
    blurb: 'Le Mans, WEC, IMSA and GT racing — winning over hours, not laps.',
  },
  {
    id: 'rally',
    label: 'Rally',
    blurb: 'The World Rally Championship — racing the clock across stages and surfaces.',
  },
  {
    id: 'stock-cars',
    label: 'Stock Cars & Ovals',
    blurb: 'NASCAR, oval racing and the American motorsport tradition.',
  },
  {
    id: 'tracks',
    label: 'Tracks & Circuits',
    blurb: 'A directory of the world’s great racing venues, by country and discipline.',
  },
  {
    id: 'teams',
    label: 'Teams',
    blurb: 'The great constructors and their histories across motorsport.',
  },
  {
    id: 'drivers',
    label: 'Drivers',
    blurb: 'Records, the road to the top, and the people behind the wheel.',
  },
  {
    id: 'general',
    label: 'Motorsport 101',
    blurb: 'The basics, the jargon, and the great debates — start here.',
  },
];

const TOPIC_BY_ID = new Map(INFO_TOPICS.map((t) => [t.id, t]));

export function getTopic(id: string): InfoTopic | undefined {
  return TOPIC_BY_ID.get(id);
}

export function isTopicId(id: string): boolean {
  return TOPIC_BY_ID.has(id);
}

// Map a series slug → the information topic its champions/facts belong under.
// Falls back to a category-based guess for any series slug not listed here, so
// a newly added series still lands somewhere sensible.
const SERIES_TOPIC: Record<string, string> = {
  f1: 'formula-1',
  'formula-e': 'formula-1',
  indycar: 'formula-1',
  f2: 'feeder-series',
  f3: 'feeder-series',
  motogp: 'motogp',
  wsbk: 'motogp',
  wec: 'endurance',
  imsa: 'endurance',
  'gt-world': 'endurance',
  dtm: 'endurance',
  nls: 'endurance',
  'adac-ravenol-24h': 'endurance',
  wrc: 'rally',
  'nascar-cup': 'stock-cars',
};

const CATEGORY_TOPIC: Record<string, string> = {
  formula: 'feeder-series',
  motorcycle: 'motogp',
  endurance: 'endurance',
  gt: 'endurance',
  rally: 'rally',
  stock: 'stock-cars',
};

export function topicForSeries(slug: string, category?: string): string {
  return SERIES_TOPIC[slug] ?? (category ? CATEGORY_TOPIC[category] : undefined) ?? 'general';
}

// The /information "what is <series>?" entry that replaces each series' old
// About tab (IA restructure Phase C — About routes 308-redirect here). The
// slugs are bespoke (curated answer filenames), NOT a template, so they're
// mapped explicitly; the topic prefix is derived from topicForSeries.
const SERIES_WHAT_IS: Record<string, string> = {
  f1: 'what-is-formula-1',
  'formula-e': 'what-is-formula-e',
  indycar: 'what-is-indycar',
  f2: 'what-is-formula-2',
  f3: 'what-is-formula-3',
  motogp: 'what-is-motogp',
  wsbk: 'what-is-worldsbk',
  wec: 'what-is-the-wec',
  imsa: 'what-is-imsa',
  'gt-world': 'what-is-gt-world-challenge',
  dtm: 'what-is-dtm',
  nls: 'what-is-nls',
  'adac-ravenol-24h': 'what-is-the-nurburgring-24-hours',
  wrc: 'what-is-the-wrc',
  'nascar-cup': 'what-is-the-nascar-cup-series',
};

/** The /information "what is <series>?" guide path for a series' About tab, or
 *  null if none exists (then the About tab stays live). Single source of truth
 *  for the About→/information redirect (proxy.ts), the "Learn about" link, and
 *  the sitemap/search exclusion. */
export function aboutGuideForSeries(slug: string): string | null {
  const whatIs = SERIES_WHAT_IS[slug];
  return whatIs ? `/information/${topicForSeries(slug)}/${whatIs}` : null;
}

// Bespoke curated answer filenames (NOT a template — F1's points slug differs
// from the rest, NASCAR folds in playoffs), so mapped explicitly like
// SERIES_WHAT_IS. Every slug below is a real content/information/answers/*.md.
// Surfaced from the series page's "Learn about" card so these featured-but-
// under-linked explainers get inbound links from an indexed series hub.
const SERIES_POINTS: Record<string, string> = {
  f1: 'how-the-f1-points-system-works',
  'formula-e': 'how-formula-e-points-work',
  indycar: 'how-indycar-points-work',
  f2: 'how-f2-points-work',
  f3: 'how-f3-points-work',
  motogp: 'how-motogp-points-work',
  wsbk: 'how-worldsbk-points-work',
  wec: 'how-wec-points-work',
  imsa: 'how-imsa-points-work',
  'gt-world': 'how-gt-world-challenge-points-work',
  dtm: 'how-dtm-points-work',
  nls: 'how-nls-points-work',
  wrc: 'how-wrc-points-work',
  'nascar-cup': 'how-nascar-cup-points-and-playoffs-work',
};

const SERIES_WHATS_NEW: Record<string, string> = {
  f1: 'whats-new-in-f1-2026',
  'formula-e': 'whats-new-in-formula-e-2026',
  indycar: 'whats-new-in-indycar-2026',
  f2: 'whats-new-in-f2-2026',
  f3: 'whats-new-in-f3-2026',
  motogp: 'whats-new-in-motogp-2026',
  wsbk: 'whats-new-in-worldsbk-2026',
  wec: 'whats-new-in-wec-2026',
  imsa: 'whats-new-in-imsa-2026',
  'gt-world': 'whats-new-in-gt-world-challenge-2026',
  dtm: 'whats-new-in-dtm-2026',
  nls: 'whats-new-in-nls-2026',
  wrc: 'whats-new-in-wrc-2026',
  'nascar-cup': 'whats-new-in-nascar-cup-2026',
};

/** The /information "how <series> points work" guide path, or null. */
export function pointsGuideForSeries(slug: string): string | null {
  const s = SERIES_POINTS[slug];
  return s ? `/information/${topicForSeries(slug)}/${s}` : null;
}

/** The /information "what's new in <series> 2026" guide path, or null. */
export function whatsNewGuideForSeries(slug: string): string | null {
  const s = SERIES_WHATS_NEW[slug];
  return s ? `/information/${topicForSeries(slug)}/${s}` : null;
}
