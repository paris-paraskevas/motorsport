// The page document (APEX: a page's regions on the Layout tab), the JSON a
// `page_revision` stores. Phase 3 step 2 of the designer plan. Client-safe: the
// App Builder draws the schematic from it, the write route parses it with the
// same rule the reader uses, and the refs projection is computed from it.
//
// SHAPE, VERSION 1. Six positions, each a strip of twelve columns; regions sit
// in a position at a column with a span, in sequence, optionally starting a new
// row. Three region kinds to begin with: Static Content (text, with
// `{shortcut:key}` inserting a shortcut), Image (one of the operator's assets)
// and List (one of the navigation lists as links). A region names rows by key
// and never by URL or file; the write path projects those keys into
// `page_revision_ref` so a row a page depends on cannot vanish unnoticed.
//
// REVISIONS ARE FOREVER, so the reader is lenient and the writer is strict: the
// same parser returns the usable document (unusable regions dropped) and the
// list of what was wrong, and the route refuses when the list is not empty. A
// version this code does not know is refused whole, never guessed at.

export const PAGE_DOCUMENT_VERSION = 1 as const;

export const POSITIONS = ['header', 'breadcrumb', 'body', 'right', 'footer', 'phonebar'] as const;
export type Position = (typeof POSITIONS)[number];

/** The positions as the schematic names them, top to bottom. */
export const POSITION_LABELS: Record<Position, { label: string; holds: string }> = {
  header: { label: 'Header', holds: 'above the page title, full width' },
  breadcrumb: { label: 'Breadcrumb Bar', holds: 'the strip under the header' },
  body: { label: 'Body', holds: 'the page itself' },
  right: { label: 'Right Side Column', holds: 'beside the body on wide screens, below it on phones' },
  footer: { label: 'Footer', holds: 'above the site footer' },
  phonebar: { label: 'Phone Bar', holds: 'the fixed bar on phones; one region at most' },
};

export const COLUMNS = 12;

export const REGION_KINDS = ['static', 'image', 'list'] as const;
export type RegionKind = (typeof REGION_KINDS)[number];

export const REGION_KIND_LABELS: Record<RegionKind, { label: string; holds: string }> = {
  static: { label: 'Static Content', holds: 'text of your own; {shortcut:key} inserts a shortcut' },
  image: { label: 'Image', holds: 'one of your photos, with its caption and credit' },
  list: { label: 'List', holds: 'one of the navigation lists, as links' },
};

export interface RegionBase {
  /** Stable within the page, lower-case; the designer generates it. */
  id: string;
  kind: RegionKind;
  title: string;
  position: Position;
  /** Order within the position; the schematic renumbers by tens. */
  seq: number;
  /** 1 to 12. */
  column: number;
  /** 1 to 13 minus column. */
  span: number;
  newRow: boolean;
  /** An authorization scheme key, or null for everyone; enforced from step 4. */
  authz: string | null;
}
export interface StaticRegion extends RegionBase {
  kind: 'static';
  text: string;
}
export interface ImageRegion extends RegionBase {
  kind: 'image';
  assetId: string;
  alt: string;
  showCaption: boolean;
}
export interface ListRegion extends RegionBase {
  kind: 'list';
  listKey: string;
  style: 'links' | 'cards';
}
export type Region = StaticRegion | ImageRegion | ListRegion;

export interface PageDocument {
  version: typeof PAGE_DOCUMENT_VERSION;
  regions: Region[];
}

export const EMPTY_DOCUMENT: PageDocument = { version: PAGE_DOCUMENT_VERSION, regions: [] };

export const REGION_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export const REGION_TITLE_MAX = 120;
export const STATIC_TEXT_MAX = 20_000;
export const IMAGE_ALT_MAX = 200;
const SLUG = /^[a-z0-9][a-z0-9._-]{0,59}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A shortcut reference inside Static Content. */
export const SHORTCUT_TOKEN = /\{shortcut:([a-z0-9][a-z0-9._-]{0,59})\}/g;

const POSITION_ORDER: Record<string, number> = Object.fromEntries(POSITIONS.map((p, i) => [p, i]));

function parseRegion(raw: unknown, index: number, seen: Set<string>): { region: Region | null; problems: string[] } {
  const problems: string[] = [];
  if (!raw || typeof raw !== 'object') return { region: null, problems: [`region ${index + 1}: not an object`] };
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  const who = `region ${id || index + 1}`;
  if (!REGION_ID.test(id)) problems.push(`${who}: the id must be lower-case letters, digits and dashes`);
  else if (seen.has(id)) problems.push(`${who}: the id is used twice`);
  const kind = typeof r.kind === 'string' && (REGION_KINDS as readonly string[]).includes(r.kind) ? (r.kind as RegionKind) : null;
  if (!kind) problems.push(`${who}: the kind must be static, image or list`);
  const position = typeof r.position === 'string' && (POSITIONS as readonly string[]).includes(r.position) ? (r.position as Position) : null;
  if (!position) problems.push(`${who}: the position must be one of the six`);
  const title = typeof r.title === 'string' ? r.title.trim() : '';
  if (title.length > REGION_TITLE_MAX) problems.push(`${who}: the title is at most ${REGION_TITLE_MAX} characters`);
  const seq = typeof r.seq === 'number' && Number.isInteger(r.seq) ? r.seq : null;
  if (seq === null) problems.push(`${who}: the sequence must be a whole number`);
  const column = typeof r.column === 'number' && Number.isInteger(r.column) && r.column >= 1 && r.column <= COLUMNS ? r.column : null;
  if (column === null) problems.push(`${who}: the column must be 1 to ${COLUMNS}`);
  const span = typeof r.span === 'number' && Number.isInteger(r.span) && r.span >= 1 && column !== null && column + r.span <= COLUMNS + 1 ? r.span : null;
  if (span === null) problems.push(`${who}: the span must be 1 to ${column === null ? COLUMNS : COLUMNS + 1 - column}`);
  const newRow = r.newRow === true;
  let authz: string | null = null;
  if (r.authz !== undefined && r.authz !== null) {
    if (typeof r.authz === 'string' && SLUG.test(r.authz)) authz = r.authz;
    else problems.push(`${who}: the authorization scheme must be a key`);
  }

  let region: Region | null = null;
  if (kind && position && seq !== null && column !== null && span !== null && problems.length === 0) {
    const base: RegionBase = { id, kind, title, position, seq, column, span, newRow, authz };
    if (kind === 'static') {
      const text = typeof r.text === 'string' ? r.text : '';
      if (text.length > STATIC_TEXT_MAX) problems.push(`${who}: the text is at most ${STATIC_TEXT_MAX} characters`);
      else region = { ...base, kind, text };
    } else if (kind === 'image') {
      const assetId = typeof r.assetId === 'string' && UUID.test(r.assetId) ? r.assetId : null;
      const alt = typeof r.alt === 'string' ? r.alt.trim() : '';
      if (!assetId) problems.push(`${who}: the image must name one of your photos`);
      else if (alt.length > IMAGE_ALT_MAX) problems.push(`${who}: the alternative text is at most ${IMAGE_ALT_MAX} characters`);
      else region = { ...base, kind, assetId, alt, showCaption: r.showCaption !== false };
    } else {
      const listKey = typeof r.listKey === 'string' && SLUG.test(r.listKey) ? r.listKey : null;
      const style = r.style === 'cards' ? 'cards' : r.style === 'links' || r.style === undefined ? 'links' : null;
      if (!listKey) problems.push(`${who}: the list must name one of the navigation lists`);
      else if (!style) problems.push(`${who}: the style must be links or cards`);
      else region = { ...base, kind, listKey, style };
    }
  }
  if (region) seen.add(region.id);
  return { region, problems };
}

/**
 * Parse one document into a usable PageDocument and the list of what was
 * refused. The reader keeps `value` (unusable regions dropped, in position and
 * sequence order); the write route refuses when `problems` is not empty. A
 * document whose version this code does not know is refused whole.
 */
export function parsePageDocument(raw: unknown): { value: PageDocument; problems: string[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { value: EMPTY_DOCUMENT, problems: ['the document must be an object'] };
  const d = raw as Record<string, unknown>;
  if (d.version !== PAGE_DOCUMENT_VERSION) return { value: EMPTY_DOCUMENT, problems: [`unknown document version ${String(d.version)}`] };
  if (!Array.isArray(d.regions)) return { value: EMPTY_DOCUMENT, problems: ['regions must be a list'] };
  const problems: string[] = [];
  const regions: Region[] = [];
  const seen = new Set<string>();
  d.regions.forEach((item, i) => {
    const { region, problems: p } = parseRegion(item, i, seen);
    problems.push(...p);
    if (region) regions.push(region);
  });
  const phone = regions.filter(r => r.position === 'phonebar');
  if (phone.length > 1) problems.push('the phone bar holds one region at most');
  regions.sort((a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position] || a.seq - b.seq);
  return { value: { version: PAGE_DOCUMENT_VERSION, regions }, problems };
}

export interface DocumentRefs {
  lists: string[];
  assets: string[];
  authz: string[];
  shortcuts: string[];
}

/** Every row a document depends on, by key, unique and sorted: the refs
 *  projection the write path stores beside the revision. */
export function documentRefs(doc: PageDocument): DocumentRefs {
  const lists = new Set<string>();
  const assets = new Set<string>();
  const authz = new Set<string>();
  const shortcuts = new Set<string>();
  for (const r of doc.regions) {
    if (r.authz) authz.add(r.authz);
    if (r.kind === 'list') lists.add(r.listKey);
    if (r.kind === 'image') assets.add(r.assetId);
    if (r.kind === 'static') for (const m of r.text.matchAll(SHORTCUT_TOKEN)) shortcuts.add(m[1]);
  }
  const sorted = (s: Set<string>) => [...s].sort();
  return { lists: sorted(lists), assets: sorted(assets), authz: sorted(authz), shortcuts: sorted(shortcuts) };
}

/** The refs projection as the database functions take it: `[{ kind, key }]`. */
export function refRows(refs: DocumentRefs): { kind: 'list' | 'asset' | 'shortcut' | 'authz'; key: string }[] {
  return [
    ...refs.lists.map(key => ({ kind: 'list' as const, key })),
    ...refs.assets.map(key => ({ kind: 'asset' as const, key })),
    ...refs.shortcuts.map(key => ({ kind: 'shortcut' as const, key })),
    ...refs.authz.map(key => ({ kind: 'authz' as const, key })),
  ];
}

/** The regions of one position in sequence, split into rows where a region
 *  starts a new row; what the schematic draws. */
export function rowsAt(doc: PageDocument, position: Position): Region[][] {
  const rows: Region[][] = [];
  for (const r of doc.regions.filter(x => x.position === position)) {
    if (rows.length === 0 || r.newRow) rows.push([r]);
    else rows[rows.length - 1].push(r);
  }
  return rows;
}

// ---------------------------------------------------------------- row page paths

/** A row page's path: literal, lower-case segments, no brackets, at most six deep. */
export const ROW_PAGE_PATH = /^\/[a-z0-9-]+(\/[a-z0-9-]+){0,5}$/;
export const RESERVED_PREFIXES = ['/api', '/media', '/admin', '/_next', '/serwist', '/sign-in', '/sign-up'] as const;
export const PAGE_NAME_MAX = 80;

/** Whether a route pattern in the registry's convention (`/series/[slug]`) matches a literal path. */
export function patternMatches(pattern: string, path: string): boolean {
  if (pattern === path) return true;
  const ps = pattern.split('/').filter(Boolean);
  const xs = path.split('/').filter(Boolean);
  for (let i = 0; i < ps.length; i++) {
    const seg = ps[i];
    if (/^\[\.\.\..+\]$/.test(seg)) return true;
    if (i >= xs.length) return false;
    if (/^\[.+\]$/.test(seg)) continue;
    if (seg !== xs[i]) return false;
  }
  return ps.length === xs.length;
}

/** Why a row page path is refused, in plain words; null when it is fine.
 *  `codePaths` are the registry's patterns, `rowPaths` the row pages that exist. */
export function rowPagePathProblem(path: string, codePaths: readonly string[], rowPaths: readonly string[] = []): string | null {
  if (!path.trim()) return 'needs a path';
  if (!ROW_PAGE_PATH.test(path)) return 'a path is lower-case letters, digits and dashes in segments, like /history/monza, at most six deep';
  if (RESERVED_PREFIXES.some(p => path === p || path.startsWith(`${p}/`))) return 'that part of the site is reserved';
  const hit = codePaths.find(p => patternMatches(p, path));
  if (hit) return `the code already serves ${hit}`;
  if (rowPaths.includes(path)) return 'a page with this path exists already';
  return null;
}
