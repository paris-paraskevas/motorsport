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
  /** True for single-event series (one annual race, not a championship).
   *  Drives a slimmer tab set: Calendar + About + Champions only. */
  singleEvent?: boolean;
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
  /** The driver's team in their championship-winning season. */
  constructor?: string;
  /** The winning constructor in the same season's Constructors' Championship,
   * when distinct from `constructor`. Useful for F1, where the World
   * Drivers' Championship and World Constructors' Championship can be won
   * by different teams in the same year (e.g. 1981, 2024). */
  constructorChampion?: string;
  /** Optional secondary drivers' championship in the same season. Used by
   * GT World Challenge Europe for the Endurance Cup, which runs in parallel
   * to the Overall championship with different winners most years. */
  secondaryDriver?: string;
  secondaryTeam?: string;
  /** Display label for the secondary championship section (e.g.
   * "Endurance Cup"). Falls back to "Secondary" if not provided. */
  secondaryLabel?: string;
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
  // True when the upstream ICS entry was DTSTART;VALUE=DATE — no real hour
  // is known. UI must not display a clock time, notifications must not fire,
  // and live-now must not consider it active.
  dateOnly?: boolean;
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
  rounds?: SeriesRoundsFile;
}

export interface SeriesRoundEntry {
  round: number;
  startDate: string;
  endDate: string;
  name: string;
  cancelled?: boolean;
  // Set when a round was rescheduled mid-season (e.g. MotoGP Qatar 2026
  // moved from April to November). Original dates preserved for UI display.
  previousStartDate?: string;
  previousEndDate?: string;
  rescheduleNote?: string;
}

export interface CancelledRoundEntry {
  // Original round number in the pre-cancellation calendar (e.g. F1 Bahrain
  // was R4 of the original 24-round 2026 calendar before the conflict-related
  // cancellation reduced the season to 22 effective rounds).
  originalRound: number;
  name: string;
  originalStartDate: string;
  originalEndDate: string;
  reason?: string;
  // Free-form reschedule status: "under discussion", "rescheduled to 2026-09-15",
  // "no reschedule planned", etc.
  rescheduleStatus?: string;
}

export interface SeriesRoundsFile {
  season: number;
  rounds: SeriesRoundEntry[];
  // Kept separate from `rounds` so canonical round numbers and URL slugs
  // for the remaining rounds stay stable when a round is cancelled mid-season.
  cancelledRounds?: CancelledRoundEntry[];
}

export interface SessionOverrideEntry {
  title: string;
  start: string;
  end: string;
  location?: string;
  significance?: SignificanceFlag;
}

export interface SessionOverrideBlock {
  matchDate: string;
  matchTitle?: string;
  round?: number;
  sessions: SessionOverrideEntry[];
}

export interface SessionsOverridesFile {
  season: number;
  overrides: SessionOverrideBlock[];
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
  // Canonical championship round number. Sourced from content/series/<slug>/rounds.json
  // when curated. When absent, falls back to array index + 1.
  round: number;
  // Canonical name from rounds.json (e.g. "Canadian Grand Prix"); used when
  // no series-specific significance label is set.
  roundName?: string;
  // Set when this round was rescheduled mid-season (MotoGP Qatar 2026 moved
  // from April to November). UI renders a "Rescheduled from <date>" note.
  previousStartDate?: string;
  previousEndDate?: string;
  rescheduleNote?: string;
}
