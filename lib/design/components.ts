// The component catalogue (APEX: region types; the operator, 2026-09-09: "we
// want to stray further away from code serving the site and go to components
// the developer/app builder has … a bunch of components and templates with
// tweaks at certain parts", and "code pages should not exist. FINAL!"). A
// component is a piece the code knows how to draw; a page's body is a list of
// them, each with its settings and its rule. This file is the client-safe
// half: what exists, what each takes, how a stored settings object is read.
// The server half (component-render.tsx) draws them.
//
// THE RULE THIS FILE ENFORCES: a component's key and its settings are checked
// here, once, for the designer, the parser and the renderer alike. An unknown
// key or a setting outside its spec is a problem the writer refuses; the reader
// keeps the usable part and falls back to the defaults.

export type SettingValue = string | number | boolean;

export interface ComponentSetting {
  key: string;
  label: string;
  kind: 'choice' | 'number' | 'boolean' | 'text';
  /** For a choice. */
  options?: readonly { key: string; label: string }[];
  /** For a number. */
  min?: number;
  max?: number;
  /** For text. */
  maxLength?: number;
  default: SettingValue;
  help?: string;
}

export interface ComponentSpec {
  /** Dotted, lower-case: `page.body`, `home.wire`. */
  key: string;
  name: string;
  group: 'Page' | 'Home' | 'Series' | 'Editorial' | 'Data';
  /** One line for the gallery tile and the Property Editor. */
  holds: string;
  settings: readonly ComponentSetting[];
  /** The transitional component: a page not yet split holds its body as the
   *  code draws it today, one per page, and loses nothing until it is split. */
  legacy?: true;
}

export const COMPONENT_KEY = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

export const COMPONENTS: readonly ComponentSpec[] = [
  {
    key: 'page.body',
    name: 'Body as the code draws it',
    group: 'Page',
    holds: 'this page’s body exactly as its code writes it today; one per page, until the page is split into components',
    settings: [],
    legacy: true,
  },
  // The page's heading, as the site's mastheads draw it: the row's title or
  // name, or words of the component's own. Every page split after Home starts
  // with it (R4.1).
  {
    key: 'page.heading',
    name: 'Page heading',
    group: 'Page',
    holds: 'the page’s heading in the site’s masthead style: its title, or words of your own',
    settings: [{ key: 'text', label: 'Words', kind: 'text', default: '', maxLength: 120, help: 'Empty shows the page’s title, or its name when it has none.' }],
  },
  // The calendar (R4.1, the first page whose route file left the code): the
  // month-by-month timeline of every session across the series.
  {
    key: 'calendar.month',
    name: 'Calendar',
    group: 'Data',
    holds: 'every session of every series, month by month, in the reader’s local time; the weekend under way on top',
    settings: [],
  },
  // Home's six (R2b), cut along the sections Home shows today; each draws from
  // the same assembly the page used (lib/home-model.ts) and applies its own
  // settings on top. They may sit on any page.
  {
    key: 'home.lead',
    name: 'Lead story',
    group: 'Home',
    holds: 'the newest post from the blog, or the one you pin, with its cover and further reading',
    settings: [
      { key: 'pinned', label: 'Pinned post', kind: 'text', default: '', maxLength: 120, help: 'The slug of a post to lead with, from its address (/blog/<slug>). Empty leads with the newest.' },
      { key: 'suggested', label: 'Further reading', kind: 'number', default: 3, min: 0, max: 6, help: 'How many more posts are listed beside the cover on wide screens.' },
    ],
  },
  {
    key: 'home.live',
    name: 'This weekend',
    group: 'Home',
    holds: 'the weekends under way, one box for the lead series and the majors, one row for the rest',
    settings: [],
  },
  {
    key: 'home.result',
    name: 'Latest result',
    group: 'Home',
    holds: 'the last race that finished: the headline, the margin, the podium',
    settings: [],
  },
  {
    key: 'home.changed',
    name: 'What it changed',
    group: 'Home',
    holds: 'the championship read after the race: the leader, the gap, the table',
    settings: [{ key: 'rows', label: 'Rows', kind: 'number', default: 5, min: 1, max: 10, help: 'How many standings rows the table shows.' }],
  },
  {
    key: 'home.next',
    name: 'What’s next',
    group: 'Home',
    holds: 'the coming weekends across every series, the first with its countdown',
    settings: [],
  },
  {
    key: 'home.wire',
    name: 'The wire',
    group: 'Home',
    holds: 'the newest headlines reported elsewhere, each linked out with its source',
    settings: [{ key: 'items', label: 'Items', kind: 'number', default: 5, min: 3, max: 20, help: 'How many headlines.' }],
  },
];

/** How a page not yet split becomes components: the keys that replace its
 *  transitional body, in order. Only pages whose components exist appear here.
 *  For a page whose route file has left the code, this is also its default
 *  composition when nothing is published. */
export const SPLITS: Readonly<Record<string, readonly string[]>> = {
  '/': ['home.lead', 'home.live', 'home.result', 'home.changed', 'home.next', 'home.wire'],
  '/calendar': ['page.heading', 'calendar.month'],
};

/** Components that share a row as two halves, in the order the recipe names them. */
const HALVES: ReadonlySet<string> = new Set(['home.changed', 'home.next']);

/** A region of the document model for a component, as the recipes lay them out. */
export interface RecipeRegion {
  id: string;
  kind: 'component';
  component: string;
  settings: Record<string, SettingValue>;
  title: string;
  position: 'body';
  seq: number;
  column: number;
  span: number;
  newRow: boolean;
  authz: string | null;
  hidden: boolean;
}

/** A fresh id for a component: the key's last word (`home.wire` → `wire`, then `wire-2`); `code-body` for the transitional one. */
export function componentId(key: string, taken: readonly string[]): string {
  const base = key === 'page.body' ? 'code-body' : (key.split('.').pop() ?? 'component').replace(/[^a-z0-9-]/g, '-');
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** The recipe's components as Body regions, in order, renumbered by tens from
 *  `seqFrom`; the halves share one row. Empty for a path without a recipe. */
export function recipeRegions(path: string, taken: readonly string[] = [], seqFrom = 10): RecipeRegion[] {
  const recipe = SPLITS[path];
  if (!recipe) return [];
  const out: RecipeRegion[] = [];
  let seq = seqFrom;
  for (const key of recipe) {
    const spec = findComponent(key);
    if (!spec) continue;
    const half = HALVES.has(key);
    const second = half && out.some(r => HALVES.has(r.component));
    out.push({
      id: componentId(key, [...taken, ...out.map(r => r.id)]),
      kind: 'component',
      component: key,
      settings: componentDefaults(spec),
      title: '',
      position: 'body',
      seq,
      column: second ? 7 : 1,
      span: half ? 6 : 12,
      newRow: !second,
      authz: null,
      hidden: false,
    });
    seq += 10;
  }
  return out;
}

/** A page's default composition: the recipe as a document, nothing else. */
export function defaultDocument(path: string): { version: 1; regions: RecipeRegion[]; actions: never[] } {
  return { version: 1, regions: recipeRegions(path), actions: [] };
}

export function findComponent(key: string): ComponentSpec | null {
  return COMPONENTS.find(c => c.key === key) ?? null;
}

/** Every setting at its default. */
export function componentDefaults(spec: ComponentSpec): Record<string, SettingValue> {
  return Object.fromEntries(spec.settings.map(s => [s.key, s.default]));
}

/**
 * Read a stored settings object against the spec: a missing setting takes its
 * default, an unknown key or a value outside its spec is a problem (and the
 * default stands in). Always answers a full settings object.
 */
export function parseSettings(spec: ComponentSpec, raw: unknown): { settings: Record<string, SettingValue>; problems: string[] } {
  const problems: string[] = [];
  const settings = componentDefaults(spec);
  if (raw === undefined || raw === null) return { settings, problems };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { settings, problems: ['the settings must be an object'] };
  const given = raw as Record<string, unknown>;
  for (const key of Object.keys(given)) {
    if (!spec.settings.some(s => s.key === key)) problems.push(`${spec.name} has no setting called ${key}`);
  }
  for (const s of spec.settings) {
    const v = given[s.key];
    if (v === undefined) continue;
    if (s.kind === 'boolean') {
      if (typeof v === 'boolean') settings[s.key] = v;
      else problems.push(`${s.label} must be yes or no`);
    } else if (s.kind === 'number') {
      if (typeof v === 'number' && Number.isFinite(v) && (s.min === undefined || v >= s.min) && (s.max === undefined || v <= s.max)) settings[s.key] = v;
      else problems.push(`${s.label} must be a number${s.min !== undefined && s.max !== undefined ? ` from ${s.min} to ${s.max}` : ''}`);
    } else if (s.kind === 'choice') {
      if (typeof v === 'string' && s.options?.some(o => o.key === v)) settings[s.key] = v;
      else problems.push(`${s.label} must be one of ${(s.options ?? []).map(o => o.label).join(', ')}`);
    } else if (typeof v === 'string' && v.length <= (s.maxLength ?? 200)) settings[s.key] = v;
    else problems.push(`${s.label} must be text of at most ${s.maxLength ?? 200} characters`);
  }
  return { settings, problems };
}

/** One line about a component's settings, for its tile: `Items 8 · Series All`. */
export function settingsSummary(spec: ComponentSpec, settings: Readonly<Record<string, SettingValue>>): string {
  const parts = spec.settings.map(s => {
    const v = settings[s.key] ?? s.default;
    const shown = s.kind === 'boolean' ? (v ? 'yes' : 'no') : s.kind === 'choice' ? (s.options?.find(o => o.key === v)?.label ?? String(v)) : String(v);
    return `${s.label} ${shown}`;
  });
  return parts.length ? parts.join(' · ') : spec.holds;
}
