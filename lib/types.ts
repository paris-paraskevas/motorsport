export type SeriesCategory =
  | 'formula'
  | 'endurance'
  | 'gt'
  | 'motorcycle'
  | 'rally'
  | 'stock';

export interface SeriesMeta {
  slug: string;
  name: string;
  color: string;
  icsUrl: string;
  season: number;
  category: SeriesCategory;
  wikipediaPage?: string;
  championsPage?: string;
  seasonPage?: string;
  officialStandingsUrl?: string;
  officialSite?: string;
}

export interface DriverStanding {
  position: number;
  driverName: string;
  driverCode?: string;
  team: string;
  points: number;
  wins?: number;
}

export interface ConstructorStanding {
  position: number;
  name: string;
  points: number;
  wins?: number;
}

export interface RaceResultEntry {
  position: number;
  driverName: string;
  driverCode?: string;
  team: string;
  status: string;
  time?: string;
  points: number;
}

export interface RaceResult {
  round: number;
  raceName: string;
  date: Date;
  circuit: string;
  results: RaceResultEntry[];
}

export interface Champion {
  year: number;
  driver: string;
  constructor?: string;
  points?: number;
}

export interface WikipediaSummary {
  title: string;
  extract: string;
  description?: string;
  url: string;
  fetchedAt: Date;
}

export interface NewsItem {
  title: string;
  link: string;
  pubDate: Date;
  description?: string;
}

export type SignificanceTier = 'marquee' | 'finale' | 'weighted' | 'note';

export interface SignificanceFlag {
  tier: SignificanceTier;
  note: string;
  weekend?: string;
}

export type SignificanceMap = Record<string, SignificanceFlag>;

export interface Session {
  uid: string;
  seriesSlug: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  significance?: SignificanceFlag;
}

export interface Series {
  meta: SeriesMeta;
  sessions: Session[];
  overview: string;
  drivers: string;
  significance: string;
  fetchedAt: Date;
  stale: boolean;
  configured: boolean;
}

export interface CuratedDriverEntry {
  name: string;
  code?: string;
  number?: number;
}

export interface CuratedTeamLineup {
  name: string;
  color?: string;
  drivers: CuratedDriverEntry[];
}

export interface CuratedDriversFile {
  teams: CuratedTeamLineup[];
}

export interface DriverStandingOverride {
  driverName: string;
  position?: number;
  points?: number;
  wins?: number;
}

export interface ConstructorStandingOverride {
  name: string;
  position?: number;
  points?: number;
  wins?: number;
}

export interface StandingsOverridesFile {
  drivers?: DriverStandingOverride[];
  constructors?: ConstructorStandingOverride[];
}

export interface RaceResultOverride {
  driverName: string;
  position?: number;
  points?: number;
  status?: string;
  time?: string;
}

export interface ResultsOverridesFile {
  // Keyed by round number as a string.
  [round: string]: RaceResultOverride[];
}

export interface PostFrontmatter {
  title: string;
  summary: string;
  publishedAt: string;
  tags?: string[];
  heroImage?: string;
  seriesSlug?: string;
  draft?: boolean;
}

export interface Post {
  slug: string;
  frontmatter: PostFrontmatter;
  source: string;
}

export interface Weekend {
  key: string;
  label?: string;
  dateRangeLabel: string;
  sessions: Session[];
  significance?: SignificanceFlag;
  isPast: boolean;
}
