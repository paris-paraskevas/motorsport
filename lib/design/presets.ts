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

export type PresetSource = 'standings' | 'results' | 'posts' | 'news' | 'weekends';
/** The `kind` a standings row carries (lib/design/source-read.ts). */
export type RowKind = 'driver' | 'constructor' | 'team' | 'manufacturer' | 'co-driver';
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
export type ShapeKey = 'driver-rows' | 'team-rows' | 'race-rows' | 'car-rows' | 'cup-rows' | 'podium-rows' | 'post-rows' | 'news-rows' | 'weekend-rows';
export interface Shape {
  key: ShapeKey;
  source: PresetSource;
  columns: readonly PresetColumn[];
  /** APEX Cards: the column that fills each slot by default, the operator's slots (P2.2 B3) over it; `media` the picture
   *  column a shape carries (P2.24 A), none for the shapes without one. */
  card: { title: string; subtitle?: string; body: string; badge: string; media?: string };
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
    columns: [position, { key: 'name', label: 'Driver', type: 'text' }, { key: 'code', label: 'Code', type: 'badge' }, { key: 'team', label: 'Team', type: 'text' }, points, wins, gap, share],
    card: { title: 'name', subtitle: 'team', body: 'points', badge: 'position' },
  },
  'team-rows': {
    key: 'team-rows',
    source: 'standings',
    columns: [position, { key: 'name', label: 'Constructor', type: 'text' }, points, wins, gap, share],
    card: { title: 'name', body: 'points', badge: 'position' },
  },
  // The results shapes (P2.2 B1): the race links to the round's weekend page as the tab's RaceTitle does.
  'race-rows': {
    key: 'race-rows',
    source: 'results',
    columns: [round, race, date, { key: 'circuit', label: 'Circuit', type: 'text' }, { key: 'session', label: 'Session', type: 'text' }, position, { key: 'driver', label: 'Driver', type: 'text' }, { key: 'code', label: 'Code', type: 'badge' }, team, { key: 'status', label: 'Status', type: 'text' }, { key: 'time', label: 'Time', type: 'text' }, points],
    card: { title: 'driver', subtitle: 'team', body: 'points', badge: 'position' },
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
    columns: [race, { key: 'seriesName', label: 'Series', type: 'text' }, date, position, { key: 'driver', label: 'Driver', type: 'text' }, team, car, { key: 'time', label: 'Time', type: 'text' }, gapText, points, round],
    card: { title: 'driver', subtitle: 'team', body: 'time', badge: 'position' },
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
  view: 'table' | 'cards' | 'list' | 'timeline' | 'detail' | 'lead-story' | 'wire' | 'coming-weekends' | 'podium' | 'leader';
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

/** The thirty-five: twenty-six standings (the fifteen groups' first eight), seven results (the other seven), each the site's own
 *  table; then Home's two boxes over the posts and the news (P2.24 A), each a template of its own. */
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
  // Home's boxes (P2.24 A): the lead with its three further posts (home.blog_suggested_count shipped three), the wire's five
  // headlines (home.wire_count shipped five); `nameLabel` unused, the shapes carrying no name column.
  { key: 'lead-story', name: 'Lead story', group: 'lead-story', source: 'posts', shape: 'post-rows', where: {}, series: EVERY_SERIES, nameLabel: 'Title', view: 'lead-story', rows: 4 },
  { key: 'wire', name: 'The wire', group: 'wire', source: 'news', shape: 'news-rows', where: {}, series: EVERY_SERIES, nameLabel: 'Title', view: 'wire', rows: 5 },
  // Home's What's next (P2.24 B1): the next three weekends across every series.
  { key: 'whats-next', name: "What's next", group: 'whats-next', source: 'weekends', shape: 'weekend-rows', where: {}, series: EVERY_SERIES, nameLabel: 'Title', view: 'coming-weekends', rows: 3 },
  // Home's Latest result and What it changed (P2.24 B2): the podium (three rows) of the newest race, for Home's series or any
  // championship the Results source offers; the drivers' table (five rows, home.changed's default) after that race, for the
  // Latest result or any of the ten with a drivers' brief.
  { key: 'latest-result', name: 'Latest result', group: 'latest-result', source: 'results', shape: 'podium-rows', where: {}, series: PODIUM_SERIES, nameLabel: 'Driver', view: 'podium', rows: 3 },
  { key: 'what-it-changed', name: 'What it changed', group: 'what-it-changed', source: 'standings', shape: 'driver-rows', where: { kind: 'driver' }, series: LEADER_SERIES, nameLabel: 'Driver', view: 'leader', rows: 5 },
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
export function presetRows(rows: readonly PresetRow[], preset: Preset, count: number): PresetRow[] {
  const w = preset.where;
  const pos = (r: PresetRow) => (typeof r.position === 'number' && Number.isFinite(r.position) ? r.position : Number.MAX_SAFE_INTEGER);
  const kept = rows.filter(r => (w.kind === undefined || r.kind === w.kind) && (w.class === undefined || (r.class ?? null) === w.class) && (w.session === undefined || r.session === w.session));
  if (SHAPES[preset.shape].source !== 'results') return kept.sort((a, b) => pos(a) - pos(b)).slice(0, Math.max(0, count));
  if (preset.shape === 'podium-rows') {
    const at = (r: PresetRow) => (typeof r.date === 'string' ? Date.parse(r.date) : Number.NaN);
    const dated = kept.filter(r => Number.isFinite(at(r)));
    const newest = dated.reduce<PresetRow | null>((m, r) => (m === null || at(r) > at(m) ? r : m), null);
    if (!newest) return [];
    const key = (r: PresetRow) => `${r.round ?? ''}|${r.raceId ?? ''}|${r.race ?? ''}`;
    const race = dated.filter(r => key(r) === key(newest));
    const cls = race[0].class ?? null;
    return race
      .filter(r => (r.class ?? null) === cls)
      .sort((a, b) => pos(a) - pos(b))
      .slice(0, Math.max(0, count));
  }
  const raceKey = (r: PresetRow) => `${r.raceId ?? ''}|${r.race ?? ''}`;
  const firstAt = new Map<string, number>();
  kept.forEach((r, i) => {
    if (!firstAt.has(raceKey(r))) firstAt.set(raceKey(r), i);
  });
  const round = (r: PresetRow) => (typeof r.round === 'number' && Number.isFinite(r.round) ? r.round : Number.NEGATIVE_INFINITY);
  const sorted = kept.sort((a, b) => round(b) - round(a) || firstAt.get(raceKey(a))! - firstAt.get(raceKey(b))! || pos(a) - pos(b));
  const races = new Set<string>();
  return sorted.filter(r => {
    races.add(raceKey(r));
    return races.size <= Math.max(0, count);
  });
}
