// The application definition (APEX: Shared Components → Application Definition):
// the facts of the one application, Paddock, as the `application` row carries
// them (migration 20260908090000). Client-safe: the designer's editor reads the
// rule and the defaults, the server loader (application.ts) falls back to them.
//
// What the site reads from the row today: the name and the wordmark in the
// header and the footer, the date chip in the header, the install button in
// the footer, and the availability (Maintenance shows a notice on every page;
// nothing is locked, by design). The alias and the home path are the code's;
// the tagline and the favicon are stored for later steps and say so.

export const APPLICATION_KEY = 'paddock';

export const AVAILABILITIES = ['available', 'maintenance'] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export interface ApplicationDefinition {
  /** The application's name: the title suffix, the footer's copyright line. */
  name: string;
  /** The alias in URLs and exports; the code's. */
  alias: string;
  availability: Availability;
  /** The page `/` serves; the code's. */
  homePath: string;
  description: string | null;
  /** The header's and the footer's wordmark; null keeps the shipped Paddock•Tracker. */
  wordmark: string | null;
  /** Stored for a later step (nothing reads it yet). */
  tagline: string | null;
  /** The date in the header. */
  dateChip: boolean;
  /** The Install as an app button in the footer. */
  installPrompt: boolean;
  /** An asset id for the favicon; a later step reads it. */
  faviconAssetId: string | null;
}

export const DEFAULT_DEFINITION: ApplicationDefinition = {
  name: 'Paddock Tracker',
  alias: 'paddock',
  availability: 'available',
  homePath: '/',
  description: null,
  wordmark: null,
  tagline: null,
  dateChip: true,
  installPrompt: true,
  faviconAssetId: null,
};

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 300;
export const WORDMARK_MAX = 32;
export const TAGLINE_MAX = 160;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** What a visitor reads on every page while the application is in maintenance. */
export const MAINTENANCE_NOTICE = 'Paddock is being looked after right now. Everything stays open; some figures may lag while we work.';

function text(v: unknown, max: number, what: string, problems: string[]): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') {
    problems.push(`${what} must be text`);
    return null;
  }
  const s = v.trim();
  if (!s) return null;
  if (s.length > max) problems.push(`${what} is at most ${max} characters`);
  return s.slice(0, max);
}

/** One rule for the loader and the route: the usable definition and what was
 *  wrong. A row the parser cannot use reads as the defaults, field by field. */
export function parseDefinition(raw: unknown): { value: ApplicationDefinition; problems: string[] } {
  const problems: string[] = [];
  if (!raw || typeof raw !== 'object') return { value: DEFAULT_DEFINITION, problems: ['the definition must be an object'] };
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : DEFAULT_DEFINITION.name;
  if (typeof r.name === 'string' && !r.name.trim()) problems.push('the application needs a name');
  if (name.length > NAME_MAX) problems.push(`the name is at most ${NAME_MAX} characters`);
  const availability = typeof r.availability === 'string' && (AVAILABILITIES as readonly string[]).includes(r.availability) ? (r.availability as Availability) : DEFAULT_DEFINITION.availability;
  if (r.availability !== undefined && r.availability !== availability) problems.push('availability must be available or maintenance');
  const favicon = typeof r.faviconAssetId === 'string' && UUID.test(r.faviconAssetId) ? r.faviconAssetId : null;
  return {
    value: {
      name: name.slice(0, NAME_MAX),
      alias: typeof r.alias === 'string' && r.alias.trim() ? r.alias.trim() : DEFAULT_DEFINITION.alias,
      availability,
      homePath: typeof r.homePath === 'string' && r.homePath.startsWith('/') ? r.homePath : DEFAULT_DEFINITION.homePath,
      description: text(r.description, DESCRIPTION_MAX, 'the description', problems),
      wordmark: text(r.wordmark, WORDMARK_MAX, 'the wordmark', problems),
      tagline: text(r.tagline, TAGLINE_MAX, 'the tagline', problems),
      dateChip: r.dateChip === undefined ? DEFAULT_DEFINITION.dateChip : r.dateChip === true,
      installPrompt: r.installPrompt === undefined ? DEFAULT_DEFINITION.installPrompt : r.installPrompt === true,
      faviconAssetId: favicon,
    },
    problems,
  };
}

/** The row's columns as the definition; the reverse of `definitionToRow`. */
export function definitionFromRow(row: Record<string, unknown>): ApplicationDefinition {
  return parseDefinition({
    name: row.name,
    alias: row.alias,
    availability: row.availability,
    homePath: row.home_path,
    description: row.description,
    wordmark: row.wordmark,
    tagline: row.tagline,
    dateChip: row.date_chip,
    installPrompt: row.install_prompt,
    faviconAssetId: row.favicon_asset_id,
  }).value;
}

/** The columns a save writes: never the alias or the home path (the code's). */
export function definitionToRow(d: ApplicationDefinition): Record<string, unknown> {
  return {
    name: d.name,
    availability: d.availability,
    description: d.description,
    wordmark: d.wordmark,
    tagline: d.tagline,
    date_chip: d.dateChip,
    install_prompt: d.installPrompt,
    favicon_asset_id: d.faviconAssetId,
  };
}
