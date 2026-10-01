// The preset catalogue (the components programme, P2.2). A preset names one of
// the site's own tables for the Data region's Preset attribute: its heading
// verbatim, the rows it shows (the kind and, for a class family, the class),
// the series that have it, and the shape it is drawn in. The operator's word
// of 2026-09-18: the picker groups the fifteen shapes as drawn (PRESET_GROUPS),
// every class heading is its own preset, and presets that share their columns
// are one shape with a label of their own (SHAPES, nameLabel). Ours: APEX has
// no preset catalogue, a Classic Report or Cards region is configured by hand
// each time; here the fifteen shapes exist before any page picks them.
//
// Declarations only: like the sources, this file is reached from every route's
// chunk through the parser (a test holds it import-pure). The seven results
// presets (P2.2 B1) bring the Rounds layout, the round-grouped list the site
// draws for results, as their view.

import type { ViewFilter, ViewState } from './view-state';

export type PresetSource = 'standings' | 'results' | 'posts' | 'news' | 'weekends' | 'session-results' | 'trend' | 'tracks' | 'guides' | 'champions';
/** The `kind` a standings row carries (lib/design/source-read.ts). */
export type RowKind = 'driver' | 'constructor' | 'team' | 'manufacturer' | 'co-driver' | 'season' | 'driver-titles' | 'team-titles';
/** The column types a view draws (APEX: a report's column types). The image column arrived with P2.24 A, where the posts
 *  source (the one with a picture column) met the Data region: a thumbnail in a table cell, the picture in a card's Media
 *  box; the other template components (Content Row, Timeline, Avatar, Badge) are drawn by the views, not declared as
 *  column types no shape uses. */
export type ColumnType = 'position' | 'text' | 'number' | 'gap' | 'badge' | 'percent' | 'link' | 'date' | 'image';
export interface PresetColumn {
  key: string;
  label: string;
  type: ColumnType;
  /** For a link: the row's column carrying the address, never a typed one; a site path unless the column is `external`. */
  href?: string;
  /** For a link whose address leaves the site (the news headlines): drawn in a new tab, as an external destination is. */
  external?: true;
}
export type ShapeKey = 'driver-rows' | 'team-rows' | 'race-rows' | 'car-rows' | 'cup-rows' | 'podium-rows' | 'post-rows' | 'news-rows' | 'weekend-rows' | 'session-rows' | 'trend-rows' | 'track-rows' | 'guide-rows' | 'honour-rows' | 'title-rows';
export interface Shape {
  key: ShapeKey;
  source: PresetSource;
  columns: readonly PresetColumn[];
  /** APEX Cards: the column that fills each slot by default, the operator's slots (P2.2 B3) over it; `media` the picture
   *  column a shape carries (P2.24 A), none for the shapes without one. */
  card: { title: string; subtitle?: string; body: string; badge: string; media?: string };
  /** The Chart's own mapping (P2.11; APEX: the Series' Column Mapping): the column along the axis, the value drawn, the column one
   *  series is drawn per, and the type; a shape without one draws nothing in a Chart until Label and Value are set. */
  chart?: { label: string; value: string; series?: string; type: 'line' | 'bar' | 'area' };
  /** The Map's own mapping (P2.12; APEX: a Map Layer's Column Mapping and Info Window): the coordinate columns, the popup's title
   *  and body, the link column the popup's Open follows, the marker's colour column; a shape without one draws nothing in a Map
   *  until Latitude and Longitude are set. */
  map?: { latitude: string; longitude: string; title: string; body?: string; link?: string; colour?: string };
}

const position: PresetColumn = { key: 'position', label: 'Pos', type: 'position' };
const points: PresetColumn = { key: 'points', label: 'Pts', type: 'number' };
const wins: PresetColumn = { key: 'wins', label: 'Wins', type: 'number' };
const gap: PresetColumn = { key: 'gap', label: 'Gap', type: 'gap' };
const share: PresetColumn = { key: 'share', label: 'Share', type: 'percent' };
const round: PresetColumn = { key: 'round', label: 'Round', type: 'number' };
const race: PresetColumn = { key: 'race', label: 'Race', type: 'link', href: 'weekend' };
const date: PresetColumn = { key: 'date', label: 'Date', type: 'date' };
const cls: PresetColumn = { key: 'class', label: 'Class', type: 'text' };
const car: PresetColumn = { key: 'car', label: 'Car', type: 'badge' };
const team: PresetColumn = { key: 'team', label: 'Team', type: 'text' };
const vehicle: PresetColumn = { key: 'vehicle', label: 'Vehicle', type: 'text' };
const laps: PresetColumn = { key: 'laps', label: 'Laps', type: 'number' };
/** The gap a timing export states ("+1.969", "2 Laps"), text as given; the standings' gap is computed from the points. */
const gapText: PresetColumn = { key: 'gap', label: 'Gap', type: 'text' };

/** The column shapes: two for the standings (the operator's C), one declared for the results until PR B draws them. */
export const SHAPES: Readonly<Record<ShapeKey, Shape>> = {
  'driver-rows': {
    key: 'driver-rows',
    source: 'standings',
    columns: [position, { key: 'name', label: 'Driver', type: 'link', href: 'profile' }, { key: 'code', label: 'Code', type: 'badge' }, { key: 'team', label: 'Team', type: 'text' }, points, wins, gap, share],
    card: { title: 'name', subtitle: 'team', body: 'points', badge: 'position' },
    chart: { label: 'name', value: 'points', type: 'bar' },
  },
  'team-rows': {
    key: 'team-rows',
    source: 'standings',
    columns: [position, { key: 'name', label: 'Constructor', type: 'link', href: 'profile' }, points, wins, gap, share],
    card: { title: 'name', body: 'points', badge: 'position' },
    chart: { label: 'name', value: 'points', type: 'bar' },
  },
  // The results shapes (P2.2 B1): the race links to the round's weekend page as the tab's RaceTitle does.
  'race-rows': {
    key: 'race-rows',
    source: 'results',
    columns: [round, race, date, { key: 'circuit', label: 'Circuit', type: 'text' }, { key: 'session', label: 'Session', type: 'text' }, position, { key: 'driver', label: 'Driver', type: 'link', href: 'profile' }, { key: 'code', label: 'Code', type: 'badge' }, team, { key: 'status', label: 'Status', type: 'text' }, { key: 'time', label: 'Time', type: 'text' }, points],
    card: { title: 'driver', subtitle: 'team', body: 'points', badge: 'position' },
    chart: { label: 'driver', value: 'points', type: 'bar' },
  },
  // IMSA's and WEC's timing exports: the car, its crew, its vehicle and the gap; no points.
  'car-rows': {
    key: 'car-rows',
    source: 'results',
    columns: [round, race, date, cls, position, car, { key: 'driver', label: 'Drivers', type: 'text' }, team, vehicle, { key: 'manufacturer', label: 'Manufacturer', type: 'text' }, laps, { key: 'status', label: 'Status', type: 'text' }, gapText],
    card: { title: 'driver', subtitle: 'team', body: 'gap', badge: 'car' },
  },
  // GT World's classification per cup: no date and no status in the source.
  'cup-rows': {
    key: 'cup-rows',
    source: 'results',
    columns: [round, race, cls, position, car, { key: 'driver', label: 'Drivers', type: 'text' }, team, vehicle, laps, gapText],
    card: { title: 'driver', subtitle: 'team', body: 'gap', badge: 'car' },
  },
  // Home's two boxes (P2.24 A): the posts as the Lead story reads them (the cover as the image column, the title linked to
  // the post, the series' name, the stamp and the read time the source carries), the headlines as The wire reads them (the
  // title a link that leaves the site, the source's host, the series' name, the stamp). No position: the source's order stands.
  'post-rows': {
    key: 'post-rows',
    source: 'posts',
    columns: [
      { key: 'hero', label: 'Cover', type: 'image' },
      { key: 'title', label: 'Title', type: 'link', href: 'link' },
      { key: 'summary', label: 'Summary', type: 'text' },
      { key: 'seriesName', label: 'Series', type: 'text' },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'published', label: 'Published', type: 'date' },
      { key: 'minutes', label: 'Read time', type: 'number' },
    ],
    card: { title: 'title', subtitle: 'author', body: 'published', badge: 'seriesName', media: 'hero' },
  },
  'news-rows': {
    key: 'news-rows',
    source: 'news',
    columns: [
      { key: 'title', label: 'Title', type: 'link', href: 'link', external: true },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'seriesName', label: 'Series', type: 'text' },
      { key: 'published', label: 'Published', type: 'date' },
    ],
    card: { title: 'title', subtitle: 'source', body: 'published', badge: 'seriesName' },
  },
  // Home's What's next (P2.24 B1): the coming weekends as the weekends source reads them, the title linked to the weekend page;
  // the round last, a right-aligned number before a left-aligned column having no gap in the Table.
  'weekend-rows': {
    key: 'weekend-rows',
    source: 'weekends',
    columns: [
      { key: 'title', label: 'Title', type: 'link', href: 'weekend' },
      { key: 'seriesName', label: 'Series', type: 'text' },
      { key: 'dates', label: 'Dates', type: 'text' },
      { key: 'start', label: 'First session', type: 'date' },
      { key: 'end', label: 'Last session', type: 'date' },
      { key: 'round', label: 'Round', type: 'number' },
    ],
    card: { title: 'title', subtitle: 'seriesName', body: 'dates', badge: 'round' },
  },
  // Home's Latest result (P2.24 B2): the newest race's classification as the results source reads it, with the series' name;
  // the flat series' rows carry a driver, a team and a time, the sportscar series' a car, a crew and a gap; the numbers last.
  'podium-rows': {
    key: 'podium-rows',
    source: 'results',
    columns: [race, { key: 'seriesName', label: 'Series', type: 'text' }, date, position, { key: 'driver', label: 'Driver', type: 'link', href: 'profile' }, team, car, { key: 'time', label: 'Time', type: 'text' }, gapText, points, round],
    card: { title: 'driver', subtitle: 'team', body: 'time', badge: 'position' },
    chart: { label: 'driver', value: 'points', type: 'bar' },
  },
  // One session's classification (P2.25): the flat series' columns of the results shapes, the best lap as the time, the gap
  // as the timing states it, the qualifying segments and the tyre of the best lap; no round or race column, the source's own
  // pick names them.
  'session-rows': {
    key: 'session-rows',
    source: 'session-results',
    columns: [position, { key: 'driver', label: 'Driver', type: 'link', href: 'profile' }, { key: 'code', label: 'Code', type: 'badge' }, team, laps, { key: 'time', label: 'Time', type: 'text' }, gapText, { key: 'interval', label: 'Interval', type: 'text' }, { key: 'q1', label: 'Q1', type: 'text' }, { key: 'q2', label: 'Q2', type: 'text' }, { key: 'q3', label: 'Q3', type: 'text' }, { key: 'compound', label: 'Tyre', type: 'text' }, { key: 'status', label: 'Status', type: 'text' }],
    card: { title: 'driver', subtitle: 'team', body: 'time', badge: 'position' },
    chart: { label: 'driver', value: 'gap', type: 'bar' },
  },
  // The season trend (P2.11): the standings tab's charts as rows of the Season trend source, one per driver (or constructor) and
  // round: the running total after the round, the round's points, the season's; the name a link to its page. The Chart's own
  // mapping draws it as the tab does, one line per name by round.
  'trend-rows': {
    key: 'trend-rows',
    source: 'trend',
    columns: [round, { key: 'race', label: 'Race', type: 'text' }, { key: 'name', label: 'Driver', type: 'link', href: 'profile' }, { key: 'code', label: 'Code', type: 'badge' }, team, { key: 'points', label: 'Points', type: 'number' }, { key: 'gained', label: 'Gained', type: 'number' }, { key: 'total', label: 'Total', type: 'number' }],
    card: { title: 'name', subtitle: 'team', body: 'points', badge: 'round' },
    chart: { label: 'round', value: 'points', series: 'name', type: 'line' },
  },
  // The circuits (P2.12): content/circuits.json as the Tracks source answers it, a place per circuit; the Map's own mapping marks
  // each by name with the country beneath (the source carries the two-letter code; the guides carry the country's name).
  'track-rows': {
    key: 'track-rows',
    source: 'tracks',
    columns: [{ key: 'slug', label: 'Slug', type: 'text' }, { key: 'name', label: 'Circuit', type: 'text' }, { key: 'country', label: 'Country', type: 'text' }, { key: 'lat', label: 'Latitude', type: 'number' }, { key: 'lon', label: 'Longitude', type: 'number' }],
    card: { title: 'name', body: 'country', badge: 'country' },
    map: { latitude: 'lat', longitude: 'lon', title: 'name', body: 'country' },
  },
  // The circuit guides (P2.12): the information hub's track entries with a place, the Circuit Map's markers, each with its page;
  // the name and the Page column both follow the page, so a link may name either; the colour the primary category's.
  'guide-rows': {
    key: 'guide-rows',
    source: 'guides',
    columns: [
      { key: 'slug', label: 'Slug', type: 'text' },
      { key: 'name', label: 'Circuit', type: 'link', href: 'page' },
      { key: 'country', label: 'Country', type: 'text' },
      { key: 'countryCode', label: 'Code', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'categories', label: 'Categories', type: 'text' },
      { key: 'lat', label: 'Latitude', type: 'number' },
      { key: 'lon', label: 'Longitude', type: 'number' },
      { key: 'page', label: 'Page', type: 'link', href: 'page' },
      { key: 'colour', label: 'Colour', type: 'text' },
    ],
    card: { title: 'name', subtitle: 'country', body: 'category', badge: 'countryCode' },
    map: { latitude: 'lat', longitude: 'lon', title: 'name', body: 'country', link: 'page', colour: 'colour' },
  },
  // The roll of honour (R18): a season per row, the champion linked to the profile the rosters hold, the teams' champion to
  // its page; no position column, so the reader's order (newest first) stands. The title tallies: a team per row.
  'honour-rows': {
    key: 'honour-rows',
    source: 'champions',
    columns: [
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'driver', label: 'Champion', type: 'link', href: 'profile' },
      { key: 'nationality', label: 'Nat.', type: 'badge' },
      { key: 'team', label: 'Team', type: 'link', href: 'teamPage' },
      points,
      wins,
      { key: 'podiums', label: 'Podiums', type: 'number' },
      { key: 'margin', label: 'Margin', type: 'number' },
      { key: 'runnerUp', label: 'Runner-up', type: 'text' },
      { key: 'runnerUpTeam', label: 'Runner-up’s team', type: 'text' },
      { key: 'runnerUpPoints', label: 'Runner-up’s pts', type: 'number' },
      { key: 'teamsChampion', label: "Teams' champion", type: 'link', href: 'teamsChampionPage' },
      { key: 'teamsTitles', label: 'Title no.', type: 'number' },
      { key: 'teamsRun', label: 'Run', type: 'number' },
      { key: 'driverTitles', label: 'Driver’s title no.', type: 'number' },
      { key: 'era', label: 'Era', type: 'text' },
      { key: 'decade', label: 'Decade', type: 'text' },
    ],
    card: { title: 'driver', subtitle: 'team', body: 'points', badge: 'year' },
  },
  'title-rows': {
    key: 'title-rows',
    source: 'champions',
    columns: [
      { key: 'name', label: 'Team', type: 'link', href: 'page' },
      { key: 'titles', label: 'Titles', type: 'number' },
    ],
    card: { title: 'name', body: 'titles', badge: '' },
  },
};

export interface PresetGroup {
  key: string;
  name: string;
  source: PresetSource;
}
/** The fifteen, in the order the operator saw them drawn; then Home's two boxes (P2.24 A). */
export const PRESET_GROUPS: readonly PresetGroup[] = [
  { key: 'drivers', name: 'Drivers', source: 'standings' },
  { key: 'constructors', name: 'Constructors', source: 'standings' },
  { key: 'teams', name: 'Teams', source: 'standings' },
  { key: 'manufacturers', name: 'Manufacturers', source: 'standings' },
  { key: 'co-drivers', name: 'Co-Drivers', source: 'standings' },
  { key: 'gt-world-cups', name: 'GT World Challenge cups', source: 'standings' },
  { key: 'imsa-classes', name: 'IMSA classes', source: 'standings' },
  { key: 'wec-classes', name: 'FIA WEC classes', source: 'standings' },
  { key: 'season-results', name: 'Season results', source: 'results' },
  { key: 'feature-races', name: 'Feature races', source: 'results' },
  { key: 'sprint-races', name: 'Sprint races', source: 'results' },
  { key: 'overall-winners', name: 'Overall winners', source: 'results' },
  { key: 'season-results-imsa', name: 'Season results · IMSA', source: 'results' },
  { key: 'season-results-wec', name: 'Season results · WEC', source: 'results' },
  { key: 'season-results-gt-world', name: 'Season results · GT World', source: 'results' },
  { key: 'lead-story', name: 'Lead story', source: 'posts' },
  { key: 'wire', name: 'The wire', source: 'news' },
  // Home's literal has the straight apostrophe (components/HomeLead.tsx HomeWhatsNext), and the heading must match it byte for byte.
  { key: 'whats-next', name: "What's next", source: 'weekends' },
  // Home's Latest result and What it changed (P2.24 B2), Home's literals (HomeLatestResult's aria-label, HomeWhatChanged's rule).
  { key: 'latest-result', name: 'Latest result', source: 'results' },
  { key: 'what-it-changed', name: 'What it changed', source: 'standings' },
  // One session's classification (P2.25).
  { key: 'session', name: 'Session', source: 'session-results' },
  // The season trend (P2.11): the standings tab's two charts as presets over the Season trend source.
  { key: 'season-trend', name: 'Season trend', source: 'trend' },
  // The circuits and the circuit guides (P2.12): the Map's two sources, a group of one preset each.
  { key: 'circuits', name: 'Circuits', source: 'tracks' },
  { key: 'circuit-guides', name: 'Circuit guides', source: 'guides' },
  // The champions (R18): the roll of honour and the two title tallies over the Champions source.
  { key: 'champions', name: 'Champions', source: 'champions' },
];

export interface Preset {
  key: string;
  /** The heading the site draws, verbatim. */
  name: string;
  /** A PRESET_GROUPS key. */
  group: string;
  source: PresetSource;
  shape: ShapeKey;
  /** The rows the preset shows: the kind and, for a class family, the class (standings); the session (results). */
  where: { kind?: RowKind; class?: string; session?: string };
  /** The series that have this table (the site's own dispatch). */
  series: readonly string[];
  /** The name column's label: Driver · Co-Driver · Constructor · Team · Manufacturer. */
  nameLabel: string;
  /** The view the preset brings when picked: the standings tables, the results' Rounds layout (List), Home's boxes their own
   *  template (P2.24 A: lead-story, wire; B1: coming-weekends; B2: podium, leader); Timeline and Detail (P2.2 B2) are the
   *  operator's picks, no preset brings them. */
  view: 'table' | 'cards' | 'list' | 'timeline' | 'detail' | 'lead-story' | 'wire' | 'headlines' | 'coming-weekends' | 'podium' | 'leader';
  /** The Rows the pick sets, where the site's box has a count of its own (P2.24 A: the lead and its three further posts, the
   *  wire's five); absent, the region's Rows stands. Ours: the counts were Application Settings of Home's pieces. */
  rows?: number;
}

const DRIVER_SERIES = ['f1', 'f2', 'f3', 'indycar', 'formula-e', 'nascar-cup', 'wrc', 'motogp', 'wsbk', 'dtm'];
const CONSTRUCTOR_SERIES = ['f1', 'f2', 'f3', 'formula-e', 'nascar-cup', 'wsbk'];
const RESULT_SERIES = ['f1', 'f3', 'indycar', 'nascar-cup', 'wrc', 'motogp', 'wsbk', 'dtm', 'formula-e'];
/** The fifteen the site covers (lib/design/sources.ts SERIES_OPTIONS, listed here since this file imports nothing): the posts
 *  and the headlines belong to any of them, or to none. */
const EVERY_SERIES = ['adac-ravenol-24h', 'dtm', 'f1', 'f2', 'f3', 'formula-e', 'gt-world', 'imsa', 'indycar', 'motogp', 'nascar-cup', 'nls', 'wec', 'wrc', 'wsbk'];
/** The Latest result's series (P2.24 B2): Home's series (the Results source's value the reader resolves, lib/design/sources.ts
 *  HOME_SERIES_OPTION) first, then the fourteen the Results source offers (its RESULTS_SERIES, listed here since this file
 *  imports nothing). */
const PODIUM_SERIES = ['home', 'f1', 'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup', 'wrc', 'dtm', 'nls', 'imsa', 'wec', 'gt-world'];
/** What it changed's series (P2.24 B2): the Latest result (the Standings source's value the reader resolves) first, then the
 *  ten with a drivers' brief (lib/standings/brief.ts ELIGIBLE_STANDINGS_SLUGS), the only ones Home draws the box for. */
const LEADER_SERIES = ['latest', 'f1', 'f2', 'f3', 'indycar', 'formula-e', 'motogp', 'nascar-cup', 'wsbk', 'wrc', 'dtm'];
/** The Season trend's series (P2.11): the eight whose results feeds carry championship-canonical per-round points
 *  (lib/design/sources.ts TREND_SERIES, listed here since this file imports nothing; a test holds the two equal); the
 *  constructors' Formula 1 alone, the one constructors' table the site's own chart reconciles against (the proof of
 *  2026-09-29: F2's and F3's summed cars fall short of their Constructors tables, DTM's teams' table is not the sum,
 *  MotoGP and WorldSBK draw no teams table), the CHANGELOG's rule (b) until a series is reconciled. */
const TREND_SERIES = ['f1', 'f2', 'f3', 'motogp', 'wsbk', 'nascar-cup', 'wrc', 'dtm'];
const TREND_TEAM_SERIES = ['f1'];

const standings = (key: string, name: string, group: string, shape: ShapeKey, where: Preset['where'], series: readonly string[], nameLabel: string): Preset => ({ key, name, group, source: 'standings', shape, where, series, nameLabel, view: 'table' });
const family = (prefix: string, group: string, series: string, cls: string, kinds: readonly RowKind[]): Preset[] =>
  kinds.map(kind =>
    standings(
      `${prefix}-${cls.toLowerCase().replace(/\s+/g, '-')}-${kind === 'driver' ? 'drivers' : kind === 'team' ? 'teams' : 'manufacturers'}`,
      `${cls} — ${kind === 'driver' ? 'Drivers' : kind === 'team' ? 'Teams' : 'Manufacturers'}`,
      group,
      kind === 'driver' ? 'driver-rows' : 'team-rows',
      { kind, class: cls },
      [series],
      kind === 'driver' ? 'Driver' : kind === 'team' ? 'Team' : 'Manufacturer',
    ),
  );
const results = (key: string, name: string, group: string, series: readonly string[], shape: ShapeKey = 'race-rows', where: Preset['where'] = {}): Preset => ({ key, name, group, source: 'results', shape, where, series, nameLabel: 'Driver', view: 'list' });

/** The thirty-nine: twenty-six standings (the fifteen groups' first eight), seven results (the other seven), each the site's own
 *  table; then Home's five boxes as templates of their own: the Lead story and The wire over the posts and the news (P2.24 A),
 *  What's next over the weekends (B1), Latest result over the results and What it changed over the standings (B2). */
export const PRESETS: readonly Preset[] = [
  standings('drivers', 'Drivers', 'drivers', 'driver-rows', { kind: 'driver' }, DRIVER_SERIES, 'Driver'),
  standings('constructors', 'Constructors', 'constructors', 'team-rows', { kind: 'constructor' }, CONSTRUCTOR_SERIES, 'Constructor'),
  // DTM's teams reach the rows tier as constructor rows (lib/standing-rows.ts reads `teams` for `constructors`); the site heads them Teams.
  standings('teams', 'Teams', 'teams', 'team-rows', { kind: 'constructor' }, ['dtm'], 'Team'),
  standings('manufacturers', 'Manufacturers', 'manufacturers', 'team-rows', { kind: 'manufacturer' }, ['wrc'], 'Manufacturer'),
  standings('co-drivers', 'Co-Drivers', 'co-drivers', 'driver-rows', { kind: 'co-driver' }, ['wrc'], 'Co-Driver'),
  // GT World Challenge: three cups × drivers and teams, headed "Overall — Drivers" … "Endurance Cup — Teams".
  ...family('gt-world', 'gt-world-cups', 'gt-world', 'Overall', ['driver', 'team']),
  ...family('gt-world', 'gt-world-cups', 'gt-world', 'Sprint Cup', ['driver', 'team']),
  ...family('gt-world', 'gt-world-cups', 'gt-world', 'Endurance Cup', ['driver', 'team']),
  // IMSA: four classes; LMP2 has no manufacturers' championship (the spec Oreca).
  ...family('imsa', 'imsa-classes', 'imsa', 'GTP', ['driver', 'team', 'manufacturer']),
  ...family('imsa', 'imsa-classes', 'imsa', 'LMP2', ['driver', 'team']),
  ...family('imsa', 'imsa-classes', 'imsa', 'GTD Pro', ['driver', 'team', 'manufacturer']),
  ...family('imsa', 'imsa-classes', 'imsa', 'GTD', ['driver', 'team', 'manufacturer']),
  // FIA WEC: Hypercar awards Drivers and Manufacturers, LMGT3 Drivers and Teams.
  ...family('wec', 'wec-classes', 'wec', 'Hypercar', ['driver', 'manufacturer']),
  ...family('wec', 'wec-classes', 'wec', 'LMGT3', ['driver', 'team']),
  // Home's Latest result (P2.24 B2): the podium (three rows) of the newest race, for Home's series or any championship the Results
  // source offers. First of the results presets (R8), so a Source moved to Results lands on the box (R7 picks the first offered).
  { key: 'latest-result', name: 'Latest result', group: 'latest-result', source: 'results', shape: 'podium-rows', where: {}, series: PODIUM_SERIES, nameLabel: 'Driver', view: 'podium', rows: 3 },
  // The flat series' Season results are their races (F1's sprints sit apart, as the tab leaves them out); F2's two presets its two sessions.
  results('season-results', 'Season results', 'season-results', RESULT_SERIES, 'race-rows', { session: 'race' }),
  results('feature-races', 'Feature races', 'feature-races', ['f2'], 'race-rows', { session: 'feature' }),
  results('sprint-races', 'Sprint races', 'sprint-races', ['f2'], 'race-rows', { session: 'sprint' }),
  // NLS: one winning crew per round, no championship points (the site's "winners-only" rows).
  results('overall-winners', 'Overall winners', 'overall-winners', ['nls']),
  // The site heads all three "Season results"; the series suffix is ours, the preset names being one list.
  results('season-results-imsa', 'Season results · IMSA', 'season-results-imsa', ['imsa'], 'car-rows'),
  results('season-results-wec', 'Season results · WEC', 'season-results-wec', ['wec'], 'car-rows'),
  results('season-results-gt-world', 'Season results · GT World', 'season-results-gt-world', ['gt-world'], 'cup-rows'),
  // One session's classification (P2.25): F1 alone (OpenF1), the Table, thirty rows so a full grid shows without a Rows edit;
  // the source's own Round and Session picks say which session, so one preset serves them all.
  { key: 'session', name: 'Session', group: 'session', source: 'session-results', shape: 'session-rows', where: {}, series: ['f1'], nameLabel: 'Driver', view: 'table', rows: 30 },
  // Home's boxes (P2.24 A): the lead with its three further posts, the wire's five headlines (the counts Home shipped; the two
  // Application Settings that once set them left in P2.24 C); `nameLabel` unused, the shapes carrying no name column.
  { key: 'lead-story', name: 'Lead story', group: 'lead-story', source: 'posts', shape: 'post-rows', where: {}, series: EVERY_SERIES, nameLabel: 'Title', view: 'lead-story', rows: 4 },
  { key: 'wire', name: 'The wire', group: 'wire', source: 'news', shape: 'news-rows', where: {}, series: EVERY_SERIES, nameLabel: 'Title', view: 'wire', rows: 5 },
  // Home's What's next (P2.24 B1): the next three weekends across every series.
  { key: 'whats-next', name: "What's next", group: 'whats-next', source: 'weekends', shape: 'weekend-rows', where: {}, series: EVERY_SERIES, nameLabel: 'Title', view: 'coming-weekends', rows: 3 },
  // Home's What it changed (P2.24 B2): the drivers' table (five rows, home.changed's default) after the newest race, for the
  // Latest result or any of the ten with a drivers' brief.
  { key: 'what-it-changed', name: 'What it changed', group: 'what-it-changed', source: 'standings', shape: 'driver-rows', where: { kind: 'driver' }, series: LEADER_SERIES, nameLabel: 'Driver', view: 'leader', rows: 5 },
  // The season trend (P2.11): the standings tab's two charts as presets over the Season trend source, the tab's headings verbatim
  // (components/tabs/StandingsTab.tsx TrendSection); the drivers' for the eight series with canonical points, the constructors'
  // for Formula 1 alone, the one constructors' table the site's own chart reconciles against. The Table by default, as a preset must bring a view;
  // the Chart draws them as the tab does through the shape's own mapping.
  { key: 'drivers-trend', name: "Drivers' season trend", group: 'season-trend', source: 'trend', shape: 'trend-rows', where: { kind: 'driver' }, series: TREND_SERIES, nameLabel: 'Driver', view: 'table' },
  { key: 'constructors-trend', name: "Constructors' season trend", group: 'season-trend', source: 'trend', shape: 'trend-rows', where: { kind: 'constructor' }, series: TREND_TEAM_SERIES, nameLabel: 'Constructor', view: 'table' },
  // The circuits (P2.12): the circuits of content/circuits.json; the circuit guides: the information hub's tracks with a place.
  // Every series, since neither source takes one (the posts' rule); the Table by default, as a preset must bring a view.
  { key: 'circuits', name: 'Circuits', group: 'circuits', source: 'tracks', shape: 'track-rows', where: {}, series: EVERY_SERIES, nameLabel: 'Circuit', view: 'table' },
  { key: 'circuit-guides', name: 'Circuit guides', group: 'circuit-guides', source: 'guides', shape: 'guide-rows', where: {}, series: EVERY_SERIES, nameLabel: 'Circuit', view: 'table' },
  // The champions (R18): every season of a series' roll of honour (Rows 150, so a file is never cut; the Table until the Roll of
  // honour view lands with PR B), and the two title tallies, five rows each, on the List. Every series carries a champions file.
  { key: 'champions', name: 'Champions', group: 'champions', source: 'champions', shape: 'honour-rows', where: { kind: 'season' }, series: EVERY_SERIES, nameLabel: 'Champion', view: 'table', rows: 150 },
  { key: 'drivers-titles-by-team', name: "Drivers' titles", group: 'champions', source: 'champions', shape: 'title-rows', where: { kind: 'driver-titles' }, series: EVERY_SERIES, nameLabel: 'Team', view: 'list', rows: 5 },
  { key: 'teams-titles-by-team', name: "Teams' titles", group: 'champions', source: 'champions', shape: 'title-rows', where: { kind: 'team-titles' }, series: EVERY_SERIES, nameLabel: 'Team', view: 'list', rows: 5 },
];

export function findPreset(key: string): Preset | null {
  return PRESETS.find(p => p.key === key) ?? null;
}

/** The presets a Source offers: its source's, for one of the series they have. */
export function presetsFor(source: string, series: string): Preset[] {
  return PRESETS.filter(p => p.source === source && p.series.includes(series));
}

export type PresetRow = Record<string, string | number | boolean | null | undefined>;

/** The rows a preset shows from a source's rows: a standings shape's by position, the first `count`; the podium shape's the
 *  newest race by date (P2.24 B2: across series a round number says nothing; a tie keeps the first race in row order, Home's
 *  series order; a race without a date is never the newest), its first class alone (WEC's Hypercar, IMSA's GTP, the class
 *  Home's podium reads), by position, the first `count` rows; any other results shape's newest round first (a race without a
 *  round last), a weekend's races kept together in the order the fetcher gave them (R1 · Superpole · R2, Feature before
 *  Sprint), each by position, the first `count` RACES whole (a row of the Rounds layout is a race, and a classification cut
 *  in half would mislead). */
export function presetRows(rows: readonly PresetRow[], preset: Preset, count: number, state?: ViewState): PresetRow[] {
  const w = preset.where;
  const shape = SHAPES[preset.shape];
  const cut = Math.max(0, count);
  const pos = (r: PresetRow) => (typeof r.position === 'number' && Number.isFinite(r.position) ? r.position : Number.MAX_SAFE_INTEGER);
  let kept = rows.filter(r => (w.kind === undefined || r.kind === w.kind) && (w.class === undefined || (r.class ?? null) === w.class) && (w.session === undefined || r.session === w.session));
  // The reader's state (P2.3): its filters after the preset's own rule; its sort over the preset's order, flat, then the count of
  // rows — on a results shape too, where the count is of races only while the rows keep the preset's grouping.
  if (state && state.filters.length > 0) kept = kept.filter(r => state.filters.every(f => rowPasses(r, f, shape.columns)));
  const sorted = (base: PresetRow[]) => (state?.sort ? sortBy(base, state.sort, shape.columns) : base);
  if (shape.source !== 'results') return sorted(kept.sort((a, b) => pos(a) - pos(b))).slice(0, cut);
  if (preset.shape === 'podium-rows') {
    const at = (r: PresetRow) => (typeof r.date === 'string' ? Date.parse(r.date) : Number.NaN);
    const dated = kept.filter(r => Number.isFinite(at(r)));
    const newest = dated.reduce<PresetRow | null>((m, r) => (m === null || at(r) > at(m) ? r : m), null);
    if (!newest) return [];
    const key = (r: PresetRow) => `${r.round ?? ''}|${r.raceId ?? ''}|${r.race ?? ''}`;
    const race = dated.filter(r => key(r) === key(newest));
    const cls = race[0].class ?? null;
    return sorted(race.filter(r => (r.class ?? null) === cls).sort((a, b) => pos(a) - pos(b))).slice(0, cut);
  }
  const raceKey = (r: PresetRow) => `${r.raceId ?? ''}|${r.race ?? ''}`;
  const firstAt = new Map<string, number>();
  kept.forEach((r, i) => {
    if (!firstAt.has(raceKey(r))) firstAt.set(raceKey(r), i);
  });
  const round = (r: PresetRow) => (typeof r.round === 'number' && Number.isFinite(r.round) ? r.round : Number.NEGATIVE_INFINITY);
  const ordered = kept.sort((a, b) => round(b) - round(a) || firstAt.get(raceKey(a))! - firstAt.get(raceKey(b))! || pos(a) - pos(b));
  if (state?.sort) return sortBy(ordered, state.sort, shape.columns).slice(0, cut);
  const races = new Set<string>();
  return ordered.filter(r => {
    races.add(raceKey(r));
    return races.size <= cut;
  });
}

const NUMERIC_TYPES: ReadonlySet<ColumnType> = new Set(['number', 'position', 'percent', 'gap']);
const cell = (v: PresetRow[string]): string => (v === null || v === undefined ? '' : String(v));
/** A cell as a number: a number as it is, a string that reads as one ("+12" too), else null; the Chart's value (P2.11) reads by it. */
export const numeric = (v: PresetRow[string]): number | null => (typeof v === 'number' ? (Number.isFinite(v) ? v : null) : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const columnType = (columns: readonly PresetColumn[], key: string): ColumnType => columns.find(c => c.key === key)?.type ?? 'text';

/** Whether a row passes a reader's filter (P2.3), compared as the column's type reads: numbers as numbers (a missing one fails
 *  every test but `ne`), a date by its day, text case-insensitively; `in` over a comma list. */
export function rowPasses(row: PresetRow, f: ViewFilter, columns: readonly PresetColumn[]): boolean {
  const type = columnType(columns, f.column);
  const v = row[f.column];
  if (f.op === 'in') {
    const set = f.value.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== '');
    return set.includes(cell(v).toLowerCase());
  }
  if (NUMERIC_TYPES.has(type)) {
    const a = numeric(v);
    const b = numeric(f.value);
    if (a === null || b === null) return f.op === 'ne';
    return f.op === 'eq' ? a === b : f.op === 'ne' ? a !== b : f.op === 'lt' ? a < b : f.op === 'lte' ? a <= b : f.op === 'gt' ? a > b : a >= b;
  }
  const a = (type === 'date' ? cell(v).slice(0, 10) : cell(v)).toLowerCase();
  const b = (type === 'date' ? f.value.slice(0, 10) : f.value).toLowerCase();
  return f.op === 'eq' ? a === b : f.op === 'ne' ? a !== b : false;
}

/** The values a facet lists at most (P2.5); past it the chip names how many more. Sized to the site's own data: fifteen series,
 *  at most two dozen drivers a season. */
export const FACET_VALUES_MAX = 40;
/** The values a facet offers (P2.5; APEX: a Smart Filter's list): each distinct value of the column across the rows that pass
 *  every OTHER active filter (never the facet's own, so a picked value keeps its siblings), with its count, the most frequent
 *  first and a tie by value; a missing value is left out; the list cut at FACET_VALUES_MAX with the rest counted. */
export function facetValues(rows: readonly PresetRow[], column: string, columns: readonly PresetColumn[], filters: readonly ViewFilter[]): { values: { value: string; count: number }[]; more: number } {
  const others = filters.filter(f => f.column !== column);
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!others.every(f => rowPasses(r, f, columns))) continue;
    const v = cell(r[column]);
    if (v === '') continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const all = [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return { values: all.slice(0, FACET_VALUES_MAX), more: Math.max(0, all.length - FACET_VALUES_MAX) };
}

/** The rows by a reader's column (P2.3), as its type orders — numbers as numbers, a date by its instant, text by locale —
 *  an empty cell last either way, a tie in the order given (the preset's own). */
function sortBy(base: readonly PresetRow[], sort: { column: string; desc: boolean }, columns: readonly PresetColumn[]): PresetRow[] {
  const type = columnType(columns, sort.column);
  const key = (r: PresetRow): number | string | null => {
    const v = r[sort.column];
    if (NUMERIC_TYPES.has(type)) return numeric(v);
    if (type === 'date') return Number.isFinite(Date.parse(cell(v))) ? Date.parse(cell(v)) : null;
    return cell(v) || null;
  };
  return base
    .map((r, i) => ({ r, i, k: key(r) }))
    .sort((a, b) => {
      if (a.k === null || b.k === null) return a.k === b.k ? a.i - b.i : a.k === null ? 1 : -1;
      const c = typeof a.k === 'number' && typeof b.k === 'number' ? a.k - b.k : String(a.k).localeCompare(String(b.k), 'en', { sensitivity: 'base' });
      return (sort.desc ? -c : c) || a.i - b.i;
    })
    .map(x => x.r);
}
