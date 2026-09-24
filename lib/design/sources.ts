// The source catalogue (the components programme, P2.1; APEX: REST Data
// Sources, Data Profile, Remote Servers). A component reads a source from
// here, never a query (rule 4): a source is a name, its parameters, its
// columns (APEX: the Data Profile), how it is kept fresh, its loading method
// (APEX: Data Load Definition's Append · Merge · Replace) and the loader keys
// it answers to. The readers are server code (lib/design/source-read.ts); this
// file is declarations only and is reached from every route's chunk through
// the parser, so it imports nothing at runtime (the plan critic's point; a
// test holds it).
//
// A region carries its pick as ONE string, the ref: `standings?series=f1&season=2026`
// (the source's key, then its parameters in the declared order). The parser
// reads it against the definition's `sources`; the Property Editor draws it as
// the Source group's Type and the parameters beneath (APEX: Location · Type).

export type SourceParameterKind = 'series' | 'season' | 'number' | 'choice' | 'text';

export interface SourceParameter {
  key: string;
  label: string;
  kind: SourceParameterKind;
  /** A stored ref must carry it; the picker writes the default. */
  required?: boolean;
  default?: string | number;
  /** For a series (the slugs the reader dispatches), a season (the seasons the loader warms) or a choice. */
  options?: readonly { key: string; label: string }[];
  min?: number;
  max?: number;
  help?: string;
}

/** APEX: the Data Profile's column types, the ones a view can bind (P2.2). */
export type SourceColumnType = 'text' | 'number' | 'date' | 'boolean' | 'link' | 'image' | 'colour';
export interface SourceColumn {
  key: string;
  label: string;
  type: SourceColumnType;
}

/** How a source is kept fresh: the loader's tiers (rows and snapshots), the content bundle, the database, an upstream read at request time. */
export type SourceFresh = 'loader' | 'content' | 'db' | 'live';
export const FRESH_NOTE: Readonly<Record<SourceFresh, string>> = {
  loader: 'the loader, every 20 minutes',
  content: 'deployed with the site',
  db: 'live from the database',
  live: 'live upstream, the content fallback',
};
/** APEX: a Data Load Definition's loading method. `none` for a source nothing loads. */
export type LoadMethod = 'append' | 'merge' | 'replace' | 'none';

/** APEX: Remote Server, the base URL a source's endpoints share. Code today,
 *  the hosts the readers already name; rows for the operator's additions
 *  arrive with the first remote source. */
export interface RemoteServer {
  key: string;
  name: string;
  baseUrl: string;
}

export type SourceParams = Record<string, string | number>;
export interface SourceRef {
  source: string;
  params: SourceParams;
}

export interface SourceDefinition {
  key: string;
  name: string;
  /** One line for the picker and the catalogue's table. */
  holds: string;
  parameters: readonly SourceParameter[];
  columns: readonly SourceColumn[];
  fresh: SourceFresh;
  load: LoadMethod;
  /** APEX: five pagination types; the readers page inside themselves, so every source is `none` today. */
  pagination: 'none';
  /** What the reader reads, as the Debug panel names it (component-render's READS): content:, db:, snapshot:<prefix>, kv:<prefix>, live:. */
  reads: readonly string[];
  /** The source_run and source_snapshot keys the loader writes behind a pick. */
  loaderKeys?: (params: SourceParams) => string[];
  /** The remote server per series (a RemoteServer key). */
  hosts?: Readonly<Record<string, string>>;
}

/** The season the loader warms; the three health modules check the same one (a test holds them equal). */
export const CURRENT_SEASON = 2026;

/** The fifteen series the content holds, by slug, with the names their meta files carry (the picker prefers the names the designer is handed). */
export const SERIES_OPTIONS: readonly { key: string; label: string }[] = [
  { key: 'adac-ravenol-24h', label: 'ADAC Ravenol 24h Nürburgring' },
  { key: 'dtm', label: 'DTM' },
  { key: 'f1', label: 'Formula 1' },
  { key: 'f2', label: 'Formula 2' },
  { key: 'f3', label: 'Formula 3' },
  { key: 'formula-e', label: 'Formula E' },
  { key: 'gt-world', label: 'GT World Challenge' },
  { key: 'imsa', label: 'IMSA' },
  { key: 'indycar', label: 'IndyCar' },
  { key: 'motogp', label: 'MotoGP' },
  { key: 'nascar-cup', label: 'NASCAR Cup' },
  { key: 'nls', label: 'NLS Nürburgring' },
  { key: 'wec', label: 'FIA WEC' },
  { key: 'wrc', label: 'WRC' },
  { key: 'wsbk', label: 'WorldSBK' },
];

const seriesOptions = (slugs: readonly string[]) => slugs.map(slug => SERIES_OPTIONS.find(o => o.key === slug) ?? { key: slug, label: slug });
/** The series the standings registry (lib/standings-health.ts) checks and the loader writes rows for. */
const STANDINGS_SERIES = ['f1', 'f2', 'f3', 'motogp', 'wsbk', 'indycar', 'formula-e', 'dtm', 'wrc', 'nascar-cup', 'gt-world', 'imsa', 'wec'];
/** The series the season results dispatch handles (components/weekend/WeekendStandingsSnapshot.tsx). */
/** The ten the weekend dispatch handles, plus the four the tab reads through their own fetchers (P2.2 B1): NLS, IMSA, WEC, GT World. */
const RESULTS_SERIES = ['f1', 'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup', 'wrc', 'dtm', 'nls', 'imsa', 'wec', 'gt-world'];
/** The series Home ranks for its Latest result (lib/home-results.ts HOME_RESULTS_SLUGS, in Home's order; a test holds the two
 *  equal, since this file imports nothing at runtime): the Series value "Home's series" resolves to the newest finished race
 *  across them (P2.24 B2). */
export const HOME_RESULTS_SERIES: readonly string[] = ['f1', 'f3', 'formula-e', 'indycar', 'motogp', 'wec'];
/** The two Series values the readers resolve rather than read (P2.24 B2), each offered by one source and first in its list: the
 *  Results source's "Home's series" (the newest finished race across the series Home ranks) and the Standings source's "Latest
 *  result" (that race's championship). Not championships: the designer draws them first, the parser takes them for their source alone. */
export const HOME_SERIES_OPTION = { key: 'home', label: "Home's series" } as const;
export const LATEST_RESULT_OPTION = { key: 'latest', label: 'Latest result' } as const;
/** The results keys the loader writes for one series: F1's three slots, else `results:<slug>` (and WRC's chart). */
const resultsKeys = (series: string | number | undefined): string[] => (series === 'f1' ? ['f1:results', 'f1:sprints', 'f1:last-race'] : [`results:${series}`, ...(series === 'wrc' ? ['results:wrc-chart'] : [])]);

const seriesParam = (options: readonly string[], required = true): SourceParameter => ({
  key: 'series',
  label: 'Series',
  kind: 'series',
  required,
  ...(required ? { default: 'f1' } : {}),
  options: seriesOptions(options),
  help: required ? 'Which championship.' : 'One championship, or every one when empty.',
});
const seasonParam: SourceParameter = {
  key: 'season',
  label: 'Season',
  kind: 'season',
  required: true,
  default: CURRENT_SEASON,
  options: [{ key: String(CURRENT_SEASON), label: String(CURRENT_SEASON) }],
  help: 'The season the loader warms. Earlier seasons arrive with the archive; the Worker never fetches upstream for a pick.',
};
const ALL_SERIES = SERIES_OPTIONS.map(o => o.key);

export const REMOTE_SERVERS: readonly RemoteServer[] = [
  { key: 'jolpica', name: 'Jolpica API', baseUrl: 'https://api.jolpi.ca' },
  { key: 'fom', name: 'FOM API', baseUrl: 'https://api.formula1.com' },
  { key: 'pulselive-motogp', name: 'Pulselive · MotoGP', baseUrl: 'https://api.motogp.pulselive.com' },
  { key: 'pulselive-wsbk', name: 'Pulselive · WorldSBK', baseUrl: 'https://api.wsbk.pulselive.com' },
  { key: 'motorsport-com', name: 'motorsport.com', baseUrl: 'https://www.motorsport.com' },
  { key: 'wikipedia', name: 'Wikipedia', baseUrl: 'https://en.wikipedia.org' },
  { key: 'indycar-com', name: 'indycar.com', baseUrl: 'https://www.indycar.com' },
  { key: 'gt-world-challenge', name: 'gt-world-challenge-europe.com', baseUrl: 'https://www.gt-world-challenge-europe.com' },
  { key: 'fiawec', name: 'fiawec.com', baseUrl: 'https://www.fiawec.com' },
  { key: 'wrc-com', name: 'wrc.com', baseUrl: 'https://www.wrc.com' },
  { key: 'vln', name: 'teilnehmer.vln.de', baseUrl: 'https://teilnehmer.vln.de' },
  { key: 'alkamel', name: 'Al Kamel timing · IMSA', baseUrl: 'https://imsa.results.alkamelcloud.com' },
];

const STANDINGS_HOSTS: Readonly<Record<string, string>> = {
  f1: 'jolpica',
  f2: 'fom',
  f3: 'fom',
  motogp: 'pulselive-motogp',
  wsbk: 'pulselive-wsbk',
  indycar: 'indycar-com',
  'formula-e': 'wikipedia',
  dtm: 'motorsport-com',
  wrc: 'wikipedia',
  'nascar-cup': 'wikipedia',
  'gt-world': 'gt-world-challenge',
  imsa: 'wikipedia',
  wec: 'fiawec',
};
const RESULTS_HOSTS: Readonly<Record<string, string>> = {
  f1: 'jolpica',
  f2: 'fom',
  f3: 'fom',
  'formula-e': 'wikipedia',
  indycar: 'wikipedia',
  motogp: 'pulselive-motogp',
  wsbk: 'pulselive-wsbk',
  'nascar-cup': 'wikipedia',
  wrc: 'wikipedia',
  dtm: 'motorsport-com',
  nls: 'vln',
  imsa: 'alkamel',
  wec: 'fiawec',
  'gt-world': 'gt-world-challenge',
};

const col = (key: string, label: string, type: SourceColumnType): SourceColumn => ({ key, label, type });

/** The thirteen, in the order the changes line of 2026-09-17 names them; then Weekends (P2.24 B1), the fourteenth. */
export const SOURCES: readonly SourceDefinition[] = [
  {
    key: 'series',
    name: 'Series',
    holds: 'the fifteen championships the site covers: slug, name, category, colour, season',
    parameters: [],
    columns: [col('slug', 'Slug', 'text'), col('name', 'Name', 'text'), col('category', 'Category', 'text'), col('colour', 'Colour', 'colour'), col('season', 'Season', 'number'), col('configured', 'Calendar feed', 'boolean')],
    fresh: 'content',
    load: 'none',
    pagination: 'none',
    reads: ['content:series'],
  },
  {
    key: 'season',
    name: 'Season',
    holds: 'each series’ declared season: its rounds and their span, whether it is under way',
    parameters: [seriesParam(ALL_SERIES, false)],
    columns: [col('series', 'Series', 'text'), col('season', 'Season', 'number'), col('rounds', 'Rounds', 'number'), col('first', 'First round', 'date'), col('last', 'Last round', 'date'), col('underWay', 'Under way', 'boolean')],
    fresh: 'content',
    load: 'none',
    pagination: 'none',
    reads: ['content:series'],
  },
  {
    key: 'standings',
    name: 'Standings',
    holds: 'the championship tables: drivers, constructors, teams, manufacturers and co-drivers, by class where a series has them; position, points, wins; the Latest result is the championship of the newest race across the series Home ranks',
    parameters: [{ ...seriesParam(STANDINGS_SERIES), options: [LATEST_RESULT_OPTION, ...seriesOptions(STANDINGS_SERIES)], help: 'Which championship; the Latest result is the championship of the newest race across the series Home ranks.' }, seasonParam],
    // The series' facts on every row (P2.24 B2): its name and colour; the race winner and the season's end are the Latest result's, null for one championship.
    columns: [col('kind', 'Kind', 'text'), col('position', 'Position', 'number'), col('name', 'Name', 'text'), col('code', 'Code', 'text'), col('team', 'Team', 'text'), col('points', 'Points', 'number'), col('wins', 'Wins', 'number'), col('class', 'Class', 'text'), col('profile', 'Page', 'link'), col('seriesName', 'Series', 'text'), col('colour', 'Series colour', 'colour'), col('winner', 'Race winner', 'boolean'), col('final', 'Season complete', 'boolean')],
    fresh: 'loader',
    load: 'replace',
    pagination: 'none',
    reads: ['db:standing_current', 'snapshot:standings:', 'snapshot:f1:', 'content:series'],
    // GT World's snapshot is season-scoped (lib/standings/gt-world.ts), the one such key; F1 keeps its own slot too. The Latest
    // result's series is known only when read: the reader names the resolved series' keys in the provenance.
    loaderKeys: p => (p.series === LATEST_RESULT_OPTION.key ? [] : [p.series === 'gt-world' ? `standings:gt-world:${p.season}` : `standings:${p.series}`, ...(p.series === 'f1' ? ['f1:standings'] : [])]),
    hosts: STANDINGS_HOSTS,
  },
  {
    key: 'results',
    name: 'Results',
    holds: 'the season’s race results, one row per classified entry: the flat series’ races by session, the sportscar series’ by class or cup, NLS’s winners; Home’s series is the newest finished race across the series Home ranks',
    parameters: [{ ...seriesParam(RESULTS_SERIES), options: [HOME_SERIES_OPTION, ...seriesOptions(RESULTS_SERIES)], help: 'Which championship; Home’s series is the newest finished race across the series Home ranks, its classification alone.' }, seasonParam],
    // The series' facts on every row (P2.24 B2): its name and colour, whether its season is complete and, then, its champion.
    columns: [col('round', 'Round', 'number'), col('race', 'Race', 'text'), col('raceId', 'Race id', 'number'), col('date', 'Date', 'date'), col('circuit', 'Circuit', 'text'), col('class', 'Class', 'text'), col('session', 'Session', 'text'), col('position', 'Position', 'number'), col('driver', 'Driver', 'text'), col('code', 'Code', 'text'), col('car', 'Car', 'text'), col('team', 'Team', 'text'), col('vehicle', 'Vehicle', 'text'), col('manufacturer', 'Manufacturer', 'text'), col('laps', 'Laps', 'number'), col('status', 'Status', 'text'), col('time', 'Time', 'text'), col('gap', 'Gap', 'text'), col('points', 'Points', 'number'), col('weekend', 'Weekend page', 'link'), col('profile', 'Page', 'link'), col('seriesName', 'Series', 'text'), col('colour', 'Series colour', 'colour'), col('final', 'Season complete', 'boolean'), col('champion', 'Champion', 'text')],
    fresh: 'loader',
    load: 'replace',
    pagination: 'none',
    reads: ['snapshot:results:', 'snapshot:f1:', 'content:series'],
    // Home's series reads every one of Home's six; the reader names the resolved series' keys in the provenance.
    loaderKeys: p => (p.series === HOME_SERIES_OPTION.key ? HOME_RESULTS_SERIES.flatMap(resultsKeys) : resultsKeys(p.series)),
    hosts: RESULTS_HOSTS,
  },
  {
    key: 'rounds',
    name: 'Rounds',
    holds: 'a series’ rounds as curated: number, name, dates, venue, status',
    parameters: [seriesParam(ALL_SERIES)],
    columns: [col('round', 'Round', 'number'), col('name', 'Name', 'text'), col('start', 'Start', 'date'), col('end', 'End', 'date'), col('location', 'Venue', 'text'), col('status', 'Status', 'text')],
    fresh: 'content',
    load: 'none',
    pagination: 'none',
    reads: ['content:series'],
  },
  {
    key: 'sessions',
    name: 'Sessions',
    holds: 'a series’ sessions from its calendar feed, with the curated overrides applied',
    parameters: [seriesParam(ALL_SERIES)],
    columns: [col('uid', 'Id', 'text'), col('title', 'Title', 'text'), col('start', 'Start', 'date'), col('end', 'End', 'date'), col('location', 'Location', 'text'), col('dateOnly', 'Date only', 'boolean'), col('significance', 'Significance', 'text')],
    fresh: 'live',
    load: 'none',
    pagination: 'none',
    reads: ['content:series', 'live:ics'],
  },
  {
    key: 'drivers',
    name: 'Drivers',
    holds: 'a series’ curated grid: name, code, number, team',
    parameters: [seriesParam(ALL_SERIES)],
    columns: [col('name', 'Name', 'text'), col('code', 'Code', 'text'), col('number', 'Number', 'number'), col('team', 'Team', 'text'), col('colour', 'Team colour', 'colour')],
    fresh: 'content',
    load: 'none',
    pagination: 'none',
    reads: ['content:series'],
  },
  {
    key: 'teams',
    name: 'Teams',
    holds: 'a series’ curated teams with their drivers',
    parameters: [seriesParam(ALL_SERIES)],
    columns: [col('name', 'Name', 'text'), col('colour', 'Colour', 'colour'), col('drivers', 'Drivers', 'text'), col('count', 'Drivers, count', 'number')],
    fresh: 'content',
    load: 'none',
    pagination: 'none',
    reads: ['content:series'],
  },
  {
    key: 'posts',
    name: 'Posts',
    holds: 'the published blog posts, newest first',
    parameters: [seriesParam(ALL_SERIES, false), { key: 'count', label: 'Count', kind: 'number', min: 1, max: 50, default: 10, help: 'How many, newest first.' }],
    // The series' name and colour and the read time (P2.24 A): what Home's lead derives, carried by the rows so the Data
    // region's Lead story template is a function of them; Published is the post's stamp, its creation when never stamped.
    columns: [col('slug', 'Slug', 'text'), col('title', 'Title', 'text'), col('summary', 'Summary', 'text'), col('series', 'Series slug', 'text'), col('author', 'Author', 'text'), col('published', 'Published', 'date'), col('hero', 'Cover', 'image'), col('link', 'Link', 'link'), col('seriesName', 'Series', 'text'), col('colour', 'Series colour', 'colour'), col('minutes', 'Read time', 'number')],
    fresh: 'db',
    load: 'none',
    pagination: 'none',
    reads: ['db:post'],
  },
  {
    key: 'news',
    name: 'News',
    holds: 'the newest headlines reported elsewhere, across the series',
    // The two counts the pages keep warm (the home wire's 3, the News page's 10), never a free value: under DATA_SOURCE=db a
    // snapshot nobody writes would send the Worker upstream (the reviewer's finding).
    parameters: [
      {
        key: 'per',
        label: 'Per series',
        kind: 'number',
        options: [
          { key: '3', label: '3 (the home wire)' },
          { key: '10', label: '10 (the News page)' },
        ],
        default: 3,
        help: 'The reader’s cap per series, not a total: one of the two counts the pages keep warm.',
      },
    ],
    // The series' name and colour (P2.24 A): what Home's wire derives, carried by the rows for The wire template.
    columns: [col('title', 'Title', 'text'), col('link', 'Link', 'link'), col('source', 'Source', 'text'), col('published', 'Published', 'date'), col('series', 'Series slug', 'text'), col('seriesName', 'Series', 'text'), col('colour', 'Series colour', 'colour')],
    fresh: 'loader',
    load: 'append',
    pagination: 'none',
    reads: ['snapshot:news:aggregate:'],
    loaderKeys: p => [`news:aggregate:${p.per}`],
  },
  {
    key: 'authors',
    name: 'Authors',
    holds: 'the author profiles: name, role, bio, links',
    parameters: [],
    columns: [col('slug', 'Slug', 'text'), col('name', 'Name', 'text'), col('role', 'Role', 'text'), col('bio', 'Bio', 'text'), col('links', 'Links, count', 'number')],
    fresh: 'db',
    load: 'none',
    pagination: 'none',
    reads: ['db:author'],
  },
  {
    key: 'releases',
    name: 'Releases',
    holds: 'the public release notes, one row per release',
    parameters: [],
    columns: [col('release', 'Release', 'text'), col('versions', 'Versions', 'text'), col('dates', 'Dates', 'text'), col('entries', 'Pushes', 'number')],
    fresh: 'content',
    load: 'none',
    pagination: 'none',
    reads: ['content:releases'],
  },
  {
    key: 'tracks',
    name: 'Tracks',
    holds: 'the circuits the site knows: name, country, coordinates',
    parameters: [],
    columns: [col('slug', 'Slug', 'text'), col('name', 'Name', 'text'), col('country', 'Country', 'text'), col('lat', 'Latitude', 'number'), col('lon', 'Longitude', 'number')],
    fresh: 'content',
    load: 'none',
    pagination: 'none',
    reads: ['content:circuits'],
  },
  // The coming weekends (P2.24 B1): Home's What's next as rows, every series' weekends not past with a session still to end,
  // the nearest first session first; read live from the feeds as Sessions is; Dates is the label Home draws.
  {
    key: 'weekends',
    name: 'Weekends',
    holds: 'the coming weekends across every series, or one, the nearest first: the round, its title, its dates, its first and last sessions, the weekend page',
    parameters: [seriesParam(ALL_SERIES, false), { key: 'count', label: 'Count', kind: 'number', min: 1, max: 50, default: 10, help: 'How many, the nearest first.' }],
    columns: [col('series', 'Series slug', 'text'), col('seriesName', 'Series', 'text'), col('colour', 'Series colour', 'colour'), col('round', 'Round', 'number'), col('title', 'Title', 'text'), col('start', 'First session', 'date'), col('end', 'Last session', 'date'), col('dates', 'Dates', 'text'), col('weekend', 'Weekend page', 'link')],
    fresh: 'live',
    load: 'none',
    pagination: 'none',
    reads: ['content:series', 'live:ics'],
  },
];

export function findSource(key: string): SourceDefinition | null {
  return SOURCES.find(s => s.key === key) ?? null;
}

/** The ref the picker writes when a source is picked: every parameter with a default. */
export function defaultSourceRef(source: SourceDefinition): SourceRef {
  const params: SourceParams = {};
  for (const p of source.parameters) if (p.default !== undefined) params[p.key] = p.default;
  return { source: source.key, params };
}

/** `standings?series=f1&season=2026`: the source, then its parameters in the declared order; the source alone when it takes none. */
export function encodeSourceRef(ref: SourceRef): string {
  const source = findSource(ref.source);
  const order = source ? source.parameters.map(p => p.key) : [];
  const q = new URLSearchParams();
  for (const k of order) if (ref.params[k] !== undefined) q.set(k, String(ref.params[k]));
  for (const k of Object.keys(ref.params)) if (!order.includes(k)) q.set(k, String(ref.params[k]));
  const s = q.toString();
  return s ? `${ref.source}?${s}` : ref.source;
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const TEXT_MAX = 120;

function readParameter(source: SourceDefinition, p: SourceParameter, v: string): { value?: string | number; problem?: string } {
  switch (p.kind) {
    case 'series':
      return (p.options ? p.options.some(o => o.key === v) : SLUG.test(v)) ? { value: v } : { problem: `${p.label} must be one of the series ${source.name} offers` };
    case 'season': {
      const n = Number(v);
      return p.options?.some(o => o.key === v) && Number.isInteger(n) ? { value: n } : { problem: `${p.label} must be ${(p.options ?? []).map(o => o.label).join(' or ')} (the season the loader keeps)` };
    }
    case 'number': {
      const n = Number(v);
      // A number with options is one of them (the counts the pages keep warm), never a free value.
      if (p.options) return p.options.some(o => o.key === v) && Number.isInteger(n) ? { value: n } : { problem: `${p.label} must be ${p.options.map(o => o.label).join(' or ')}` };
      const ok = /^-?\d+$/.test(v) && Number.isFinite(n) && (p.min === undefined || n >= p.min) && (p.max === undefined || n <= p.max);
      return ok ? { value: n } : { problem: `${p.label} must be a number${p.min !== undefined && p.max !== undefined ? ` from ${p.min} to ${p.max}` : ''}` };
    }
    case 'choice':
      return p.options?.some(o => o.key === v) ? { value: v } : { problem: `${p.label} must be one of ${(p.options ?? []).map(o => o.label).join(', ')}` };
    default:
      return v.length <= TEXT_MAX ? { value: v } : { problem: `${p.label} must be text of at most ${TEXT_MAX} characters` };
  }
}

/**
 * Read a stored (or picked) ref against the catalogue: the source must exist
 * and, when `allowed` is given, be among the sources the component reads;
 * every required parameter present, every parameter by its own rule, no
 * parameter the source lacks. Empty is none (value null, no problem). A refused
 * ref has no value: the writer refuses, nothing is guessed.
 */
export function parseSourceRef(raw: unknown, allowed?: readonly string[]): { value: SourceRef | null; problems: string[] } {
  if (typeof raw !== 'string') return { value: null, problems: ['Source must be text'] };
  const text = raw.trim();
  if (!text) return { value: null, problems: [] };
  const q = text.indexOf('?');
  const key = q === -1 ? text : text.slice(0, q);
  const source = findSource(key);
  if (!source) return { value: null, problems: ['Source must name a source from the catalogue'] };
  if (allowed && !allowed.includes(key)) return { value: null, problems: [`Source must be one of ${allowed.map(k => findSource(k)?.name ?? k).join(', ')}`] };
  const given = new URLSearchParams(q === -1 ? '' : text.slice(q + 1));
  const problems: string[] = [];
  const params: SourceParams = {};
  for (const k of new Set(given.keys())) {
    if (!source.parameters.some(p => p.key === k)) problems.push(`${source.name} has no parameter called ${k}`);
    else if (given.getAll(k).length > 1) problems.push(`${source.name} names ${k} twice`);
  }
  for (const p of source.parameters) {
    const v = given.get(p.key);
    if (v === null || v === '') {
      if (p.required) problems.push(`${source.name} needs a ${p.label.toLowerCase()}`);
      continue;
    }
    const read = readParameter(source, p, v);
    if (read.problem) problems.push(read.problem);
    else if (read.value !== undefined) params[p.key] = read.value;
  }
  return problems.length ? { value: null, problems } : { value: { source: key, params }, problems: [] };
}

/** `Standings · Formula 1 · 2026`: the source's name, then its parameters; a series by the name the list given holds, else the
 *  parameter's own option label (the values the readers resolve, P2.24 B2), else the catalogue's. */
export function sourceLabel(ref: SourceRef, series?: readonly { slug: string; name: string }[]): string {
  const source = findSource(ref.source);
  if (!source) return ref.source;
  const parts = [source.name];
  for (const p of source.parameters) {
    const v = ref.params[p.key];
    if (v === undefined) continue;
    if (p.kind === 'series') parts.push(series?.find(s => s.slug === v)?.name ?? p.options?.find(o => o.key === v)?.label ?? SERIES_OPTIONS.find(o => o.key === v)?.label ?? String(v));
    else if (p.kind === 'season') parts.push(String(v));
    else if (p.kind === 'choice') parts.push(p.options?.find(o => o.key === v)?.label ?? String(v));
    else parts.push(`${p.label} ${v}`);
  }
  return parts.join(' · ');
}

const F1_SLOTS: Readonly<Record<string, { source: 'standings' | 'results'; suffix?: string }>> = {
  standings: { source: 'standings' },
  results: { source: 'results' },
  sprints: { source: 'results', suffix: 'sprints' },
  'last-race': { source: 'results', suffix: 'last race' },
};

function withSeries(source: 'standings' | 'results', slug: string, suffix?: string): { ref: SourceRef; label: string } | null {
  if (!SERIES_OPTIONS.some(o => o.key === slug)) return null;
  const ref: SourceRef = { source, params: { series: slug, season: CURRENT_SEASON } };
  return { ref, label: `${sourceLabel(ref)}${suffix ? ` · ${suffix}` : ''}` };
}

/**
 * A loader key (a source_run's or a source_snapshot's) in the catalogue's
 * words: `standings:<slug>`, `results:<slug>` (and its chart), the F1 slots
 * `f1:<standings|results|sprints|last-race>`, `news:aggregate:<n>`. Nothing for
 * a key the vocabulary does not cover, so the raw key stands.
 */
export function describeLoaderKey(key: string): { ref: SourceRef; label: string } | null {
  // `standings:<slug>`, or GT World's season-scoped `standings:gt-world:<season>`; the season described is the loader's either way.
  let m = /^standings:([a-z0-9-]+?)(?::\d{4})?$/.exec(key);
  if (m) return withSeries('standings', m[1]);
  m = /^results:([a-z0-9-]+?)(-chart)?$/.exec(key);
  if (m) return withSeries('results', m[1], m[2] ? 'chart' : undefined);
  m = /^f1:([a-z-]+)$/.exec(key);
  if (m && F1_SLOTS[m[1]]) return withSeries(F1_SLOTS[m[1]].source, 'f1', F1_SLOTS[m[1]].suffix);
  m = /^news:aggregate:(\d+)$/.exec(key);
  if (m) {
    const ref: SourceRef = { source: 'news', params: { per: Number(m[1]) } };
    return { ref, label: sourceLabel(ref) };
  }
  return null;
}
