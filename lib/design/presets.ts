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
// presets are declared and wait for the Rounds view (PR B): not pickable,
// refused by the parser, drawn disabled with the reason.

export type PresetSource = 'standings' | 'results';
/** The `kind` a standings row carries (lib/design/source-read.ts). */
export type RowKind = 'driver' | 'constructor' | 'team' | 'manufacturer' | 'co-driver';
/** The column types a view draws (APEX: a report's column types); link · date · image arrive with PR B. */
export type ColumnType = 'position' | 'text' | 'number' | 'gap' | 'badge' | 'percent';
export interface PresetColumn {
  key: string;
  label: string;
  type: ColumnType;
}
export type ShapeKey = 'driver-rows' | 'team-rows' | 'race-rows';
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
  'race-rows': {
    key: 'race-rows',
    source: 'results',
    columns: [
      { key: 'round', label: 'Round', type: 'number' },
      { key: 'race', label: 'Race', type: 'text' },
      position,
      { key: 'driver', label: 'Driver', type: 'text' },
      { key: 'code', label: 'Code', type: 'badge' },
      { key: 'team', label: 'Team', type: 'text' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'time', label: 'Time', type: 'text' },
      points,
    ],
    card: { title: 'driver', subtitle: 'team', body: 'points', badge: 'position' },
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
  /** The rows the preset shows: the kind and, for a class family, the class. */
  where: { kind?: RowKind; class?: string };
  /** The series that have this table (the site's own dispatch). */
  series: readonly string[];
  /** The name column's label: Driver · Co-Driver · Constructor · Team · Manufacturer. */
  nameLabel: string;
  view: 'table' | 'cards';
  /** Not yet pickable, and why. */
  later?: string;
}

export const LATER_ROUNDS = 'arrives with the Rounds view (PR B)';

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
const results = (key: string, name: string, group: string, series: readonly string[]): Preset => ({ key, name, group, source: 'results', shape: 'race-rows', where: {}, series, nameLabel: 'Driver', view: 'table', later: LATER_ROUNDS });

/** The thirty-three: twenty-six standings (the fifteen groups' first eight), seven results waiting for PR B. */
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
  results('season-results', 'Season results', 'season-results', RESULT_SERIES),
  results('feature-races', 'Feature races', 'feature-races', ['f2']),
  results('sprint-races', 'Sprint races', 'sprint-races', ['f2']),
  results('overall-winners', 'Overall winners', 'overall-winners', ['nls']),
  results('season-results-imsa', 'Season results · IMSA', 'season-results-imsa', ['imsa']),
  results('season-results-wec', 'Season results · WEC', 'season-results-wec', ['wec']),
  results('season-results-gt-world', 'Season results · GT World', 'season-results-gt-world', ['gt-world']),
];

export function findPreset(key: string): Preset | null {
  return PRESETS.find(p => p.key === key) ?? null;
}

/** The presets a Source offers: its source's, for one of the series they have. */
export function presetsFor(source: string, series: string): Preset[] {
  return PRESETS.filter(p => p.source === source && p.series.includes(series));
}

export type PresetRow = Record<string, string | number | boolean | null | undefined>;

/** The rows a preset shows from a source's rows: its kind and class, by position, the first `count`. */
export function presetRows(rows: readonly PresetRow[], preset: Preset, count: number): PresetRow[] {
  const pos = (r: PresetRow) => (typeof r.position === 'number' && Number.isFinite(r.position) ? r.position : Number.MAX_SAFE_INTEGER);
  return rows
    .filter(r => (preset.where.kind === undefined || r.kind === preset.where.kind) && (preset.where.class === undefined || (r.class ?? null) === preset.where.class))
    .sort((a, b) => pos(a) - pos(b))
    .slice(0, Math.max(0, count));
}
