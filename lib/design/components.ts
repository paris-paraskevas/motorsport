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

import { PRESETS, PRESET_GROUPS } from './presets';

export type SettingValue = string | number | boolean;

// THE COMPONENT DEFINITION MODEL (the components programme, P2.0; APEX:
// Plug-ins). A definition says what a component type takes: its attributes,
// each with a scope, an editor and a default, in named groups; the events it
// fires; the capability flags that gate sections of the Property Editor; the
// slots other components may nest in. The documents store an instance's
// attribute values under `settings`, the field's name since R2b, so the word
// stays here; APEX calls them attributes and so does the Property Editor.

/** APEX: the Scope of a custom attribute. Absent reads as component. */
export type AttributeScope = 'application' | 'component' | 'report';
/** APEX: Select List · Number · Yes/No · Text · Color · Icon · Link to Target Page. */
export type AttributeKind = 'choice' | 'number' | 'boolean' | 'text' | 'colour' | 'icon' | 'link';

/** An option of a choice. `group` draws the choice as a select with its groups
 *  (APEX: Select List); `only` binds the option to a region whose Source names
 *  that source and one of those series (the editor hides the rest, the parser
 *  refuses a stored one); `later` marks one not yet pickable, and why (drawn
 *  disabled, refused by the parser). P2.2's Preset carries all three. */
export interface ChoiceOption {
  key: string;
  label: string;
  group?: string;
  only?: { source: string; series: readonly string[] };
  later?: string;
  /** Other attributes the option sets when picked (P2.2 B1: a preset brings its view). Ours; APEX picks a report's
   *  template by hand. The stored values are left alone; the editor applies them with the pick. */
  sets?: Readonly<Record<string, SettingValue>>;
}

export interface AttributeDefinition {
  key: string;
  label: string;
  kind: AttributeKind;
  /** For a choice. */
  options?: readonly ChoiceOption[];
  /** For a number. */
  min?: number;
  max?: number;
  /** For text (and the destination key of a link, at most 120). */
  maxLength?: number;
  default: SettingValue;
  help?: string;
  /** component (absent): one value per instance, on the region. application:
   *  one value for the application, edited under Shared Components › Component
   *  Settings and never stored on a region. report: one value per multi-row
   *  region (none today; drawn as component scope until the data region). */
  scope?: AttributeScope;
  /** A key of the definition's `groups`; absent falls under Settings (APEX:
   *  ungrouped attributes under a generic Settings heading). */
  group?: string;
}
/** APEX: Attribute Groups, named and sequenced sections of the Attributes tab. */
export interface AttributeGroup {
  key: string;
  title: string;
  seq: number;
}
/** APEX: Plug-in Events, a display name and the internal name a dynamic action
 *  may listen for. Declared here; the first component that fires one wires the
 *  trigger list (P2.23). */
export interface ComponentEvent {
  key: string;
  name: string;
}
/** APEX: the Standard Attributes of a plug-in, each toggling a section of the
 *  Property Editor. Absent reads true. */
export interface ComponentCapabilities {
  /** Appearance › Template and Template Options (false: the component draws its own frame). */
  template?: boolean;
  /** The Header and Footer group. */
  headerFooter?: boolean;
}
/** APEX: Template Component Slots, named nesting points restricted to region
 *  kinds (by name: page-document owns the kinds list). Declared here; the first
 *  component with a slot wires the Layout (P2.2's Card). */
export interface ComponentSlot {
  key: string;
  name: string;
  accepts: readonly string[];
}

export interface ComponentDefinition {
  /** Dotted, lower-case: `page.body`, `home.wire`, `region.image`. */
  key: string;
  name: string;
  group: 'Page' | 'Home' | 'Series' | 'Editorial' | 'Data' | 'Region';
  /** One line for the gallery tile and the Property Editor. */
  holds: string;
  /** The attributes (APEX), stored on an instance under `settings`. */
  settings: readonly AttributeDefinition[];
  groups?: readonly AttributeGroup[];
  events?: readonly ComponentEvent[];
  capabilities?: ComponentCapabilities;
  slots?: readonly ComponentSlot[];
  /** The catalogue sources (lib/design/sources.ts) the component may read
   *  (P2.1; APEX: the Source group is a standard part of a region, not a custom
   *  attribute). Absent, it reads none and the Source group holds the Component
   *  row alone. A region carries its pick as `source`, never among the settings. */
  sources?: readonly string[];
  /** The transitional component: a page not yet split holds its body as the
   *  code draws it today, one per page, and loses nothing until it is split. */
  legacy?: true;
}
/** The names before P2.0; every reader of them keeps compiling. */
export type ComponentSpec = ComponentDefinition;
export type ComponentSetting = AttributeDefinition;

export const COMPONENT_KEY = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

/** Lower-case #rrggbb. */
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
/** An icon's name, as the bar's icons are named. */
const ICON_NAME = /^[a-z][a-z0-9-]{0,39}$/;
const LINK_MAX = 120;

/** The attributes an instance carries: every scope but application. */
export function instanceAttributes(spec: ComponentDefinition): AttributeDefinition[] {
  return spec.settings.filter(s => s.scope !== 'application');
}

export const COMPONENTS: readonly ComponentDefinition[] = [
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
    // P2.1: a Source pins the table to one championship; none reads the page's assembly (the race that just finished).
    sources: ['standings'],
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
  // The Data region (P2.2; ours by name: APEX has Classic Report, Cards, Content
  // Row, Media List and Timeline as region types, and the operator chose one
  // region with a View setting, 2026-09-10). One region over a source from the
  // catalogue, drawn in one of the site's own named shapes (lib/design/presets.ts).
  // Its attributes are of report scope: one value per multi-row region.
  {
    key: 'data.region',
    name: 'Data region',
    group: 'Data',
    holds: 'a table or cards over a source from the catalogue, in one of the site’s named shapes',
    settings: [
      {
        key: 'preset',
        label: 'Preset',
        kind: 'choice',
        scope: 'report',
        default: 'drivers',
        options: PRESETS.map(p => ({
          key: p.key,
          label: p.name,
          group: PRESET_GROUPS.find(g => g.key === p.group)?.name ?? p.group,
          only: { source: p.source, series: p.series },
          sets: { view: p.view },
        })),
        help: 'Which of the site’s tables this region draws (APEX: a report’s template and its columns; ours: the fifteen shapes as named presets). The list follows the Source: its presets, grouped as the site groups them.',
      },
      {
        key: 'view',
        label: 'View',
        kind: 'choice',
        scope: 'report',
        default: 'table',
        options: [
          { key: 'table', label: 'Table' },
          { key: 'cards', label: 'Cards' },
          { key: 'list', label: 'List' },
        ],
        help: 'How the rows are drawn (APEX: a Classic Report or a Cards region; ours: one region with a View setting). List is the Rounds layout for results, a round per fold, and a compact list for standings; a preset brings its own view when picked. Timeline and Detail arrive with PR B2.',
      },
      { key: 'rows', label: 'Rows', kind: 'number', scope: 'report', default: 10, min: 1, max: 50, help: 'How many rows the region shows, from the top of the table.' },
      { key: 'heading', label: 'Heading', kind: 'text', scope: 'report', default: '', maxLength: 80, help: 'The heading above the rows; empty draws the preset’s name.' },
    ],
    sources: ['standings', 'results'],
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
export function recipeRegions(path: string, taken: readonly string[] = [], seqFrom = 10, components: readonly ComponentDefinition[] = COMPONENTS): RecipeRegion[] {
  const recipe = SPLITS[path];
  if (!recipe) return [];
  const out: RecipeRegion[] = [];
  let seq = seqFrom;
  for (const key of recipe) {
    const spec = findComponent(key, components);
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

/** A definition by key, from the code's list or the one handed in (the
 *  designer's, the merged one once definitions have rows). */
export function findComponent(key: string, components: readonly ComponentDefinition[] = COMPONENTS): ComponentDefinition | null {
  return components.find(c => c.key === key) ?? null;
}

/** Every attribute an instance carries, at its default. */
export function componentDefaults(spec: ComponentDefinition): Record<string, SettingValue> {
  return Object.fromEntries(instanceAttributes(spec).map(s => [s.key, s.default]));
}

/**
 * Read a stored settings object against the definition: a missing attribute
 * takes its default, an unknown key or a value outside its rule is a problem
 * (and the default stands in); an application-scope attribute has no home on
 * an instance. Always answers a full settings object.
 */
export function parseSettings(spec: ComponentDefinition, raw: unknown): { settings: Record<string, SettingValue>; problems: string[] } {
  const problems: string[] = [];
  const settings = componentDefaults(spec);
  if (raw === undefined || raw === null) return { settings, problems };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { settings, problems: ['the settings must be an object'] };
  const given = raw as Record<string, unknown>;
  for (const key of Object.keys(given)) {
    const s = spec.settings.find(x => x.key === key);
    if (!s) problems.push(`${spec.name} has no setting called ${key}`);
    else if (s.scope === 'application') problems.push(`${s.label} is set for the application, not on a region`);
  }
  for (const s of instanceAttributes(spec)) {
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
    } else if (s.kind === 'colour') {
      if (typeof v === 'string' && HEX_COLOUR.test(v)) settings[s.key] = v.toLowerCase();
      else problems.push(`${s.label} must be a colour as #rrggbb`);
    } else if (s.kind === 'icon') {
      if (typeof v === 'string' && (v === '' || ICON_NAME.test(v))) settings[s.key] = v;
      else problems.push(`${s.label} must be an icon name: lower-case letters, digits and dashes`);
    } else if (s.kind === 'link') {
      // The key's shape only; whether it names a page or a catalogue link is the document parser's rule (isGoDestination).
      if (typeof v === 'string' && v.length <= LINK_MAX) settings[s.key] = v;
      else problems.push(`${s.label} must name a destination of at most ${LINK_MAX} characters`);
    } else if (typeof v === 'string' && v.length <= (s.maxLength ?? 200)) settings[s.key] = v;
    else problems.push(`${s.label} must be text of at most ${s.maxLength ?? 200} characters`);
  }
  return { settings, problems };
}

/** One line about an instance's attributes, for its tile: `Items 8 · Series All`; an empty text says nothing. */
export function settingsSummary(spec: ComponentDefinition, settings: Readonly<Record<string, SettingValue>>): string {
  const parts = instanceAttributes(spec).flatMap(s => {
    const v = settings[s.key] ?? s.default;
    if (s.kind === 'text' && String(v).trim() === '') return [];
    const shown =
      s.kind === 'boolean'
        ? v
          ? 'yes'
          : 'no'
        : s.kind === 'choice'
          ? (s.options?.find(o => o.key === v)?.label ?? String(v))
          : s.kind === 'icon'
            ? String(v) || 'none'
            : s.kind === 'link'
              ? String(v) || 'nowhere'
              : String(v);
    return `${s.label} ${shown}`;
  });
  return parts.length ? parts.join(' · ') : spec.holds;
}
