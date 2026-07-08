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
