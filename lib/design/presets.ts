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

export type PresetSource = 'standings' | 'results';
/** The `kind` a standings row carries (lib/design/source-read.ts). */
export type RowKind = 'driver' | 'constructor' | 'team' | 'manufacturer' | 'co-driver';
/** The column types a view draws (APEX: a report's column types); image arrives with PR B2. */
export type ColumnType = 'position' | 'text' | 'number' | 'gap' | 'badge' | 'percent' | 'link' | 'date';
export interface PresetColumn {
  key: string;
  label: string;
  type: ColumnType;
  /** For a link: the row's column carrying the address (a site path), never a typed one. */
  href?: string;
}
export type ShapeKey = 'driver-rows' | 'team-rows' | 'race-rows' | 'car-rows' | 'cup-rows';
export interface Shape {
  key: ShapeKey;
  source: PresetSource;
  columns: readonly PresetColumn[];
  /** APEX Cards: the column that fills each slot; the presets' defaults until the slots are editable (PR B). */
  card: { title: string; subtitle?: string; body: string; badge: string };
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
};

export interface PresetGroup {
  key: string;
  name: string;
  source: PresetSource;
}
/** The fifteen, in the order the operator saw them drawn. */
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
  /** The view the preset brings when picked: the standings tables, the results' Rounds layout (List). */
  view: 'table' | 'cards' | 'list';
}

const DRIVER_SERIES = ['f1', 'f2', 'f3', 'indycar', 'formula-e', 'nascar-cup', 'wrc', 'motogp', 'wsbk', 'dtm'];
const CONSTRUCTOR_SERIES = ['f1', 'f2', 'f3', 'formula-e', 'nascar-cup', 'wsbk'];
const RESULT_SERIES = ['f1', 'f3', 'indycar', 'nascar-cup', 'wrc', 'motogp', 'wsbk', 'dtm', 'formula-e'];

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

/** The thirty-three: twenty-six standings (the fifteen groups' first eight), seven results (the other seven), each the site's own table. */
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
];

export function findPreset(key: string): Preset | null {
  return PRESETS.find(p => p.key === key) ?? null;
}

/** The presets a Source offers: its source's, for one of the series they have. */
export function presetsFor(source: string, series: string): Preset[] {
  return PRESETS.filter(p => p.source === source && p.series.includes(series));
}

export type PresetRow = Record<string, string | number | boolean | null | undefined>;

/** The rows a preset shows from a source's rows, the first `count`: a standings shape's by position; a results shape's
 *  newest round first (a race without a round last), a weekend's races kept together in the order the fetcher gave them
 *  (R1 · Superpole · R2, Feature before Sprint), each by position. */
export function presetRows(rows: readonly PresetRow[], preset: Preset, count: number): PresetRow[] {
  const w = preset.where;
  const pos = (r: PresetRow) => (typeof r.position === 'number' && Number.isFinite(r.position) ? r.position : Number.MAX_SAFE_INTEGER);
  const kept = rows.filter(r => (w.kind === undefined || r.kind === w.kind) && (w.class === undefined || (r.class ?? null) === w.class) && (w.session === undefined || r.session === w.session));
  if (SHAPES[preset.shape].source !== 'results') return kept.sort((a, b) => pos(a) - pos(b)).slice(0, Math.max(0, count));
  const raceKey = (r: PresetRow) => `${r.raceId ?? ''}|${r.race ?? ''}`;
  const firstAt = new Map<string, number>();
  kept.forEach((r, i) => {
    if (!firstAt.has(raceKey(r))) firstAt.set(raceKey(r), i);
  });
  const round = (r: PresetRow) => (typeof r.round === 'number' && Number.isFinite(r.round) ? r.round : Number.NEGATIVE_INFINITY);
  return kept.sort((a, b) => round(b) - round(a) || firstAt.get(raceKey(a))! - firstAt.get(raceKey(b))! || pos(a) - pos(b)).slice(0, Math.max(0, count));
}
