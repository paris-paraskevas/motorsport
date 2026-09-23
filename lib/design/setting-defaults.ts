// Application Settings (APEX: Application Settings): the named values the site
// reads when it renders a page, by key, with the value the code shipped, what
// each one changes in plain words, and the control the editor draws for it.
// Client-safe: the designer's editor lists them, the server loader (settings.ts)
// falls back to them, and the home model and the layout read the loader's answer.

import { WHATS_NEW } from '@/lib/whats-new';
import type { RegionTemplateKey } from './template-options';
import { componentSettingSpecs } from './component-definitions';

export const SETTING_KEYS = [
  'home.lead_series',
  'home.major_series',
  'announcement.active_id',
  'region.image.show_caption',
  'region.list.style',
  'region.button.label',
  'region.static.template',
  'region.image.template',
  'region.list.template',
  'region.button.template',
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

/** Component Settings (APEX: Component Settings, the defaults of a component
 *  type): what a region of each kind starts with when it is placed on a page.
 *  The Page Designer reads them when it creates a region; a region carries its
 *  own values from then on, so changing a default changes no page. P1.1 adds
 *  the template (the look) per kind. Since P2.0 each is an application-scope
 *  attribute of its region kind's definition (component-definitions.ts) and
 *  its spec derives from there; this tuple stays as the type's anchor and the
 *  test keeps the two equal. */
export const COMPONENT_SETTING_KEYS = [
  'region.image.show_caption',
  'region.list.style',
  'region.button.label',
  'region.static.template',
  'region.image.template',
  'region.list.template',
  'region.button.template',
] as const satisfies readonly SettingKey[];
export type ComponentSettingKey = (typeof COMPONENT_SETTING_KEYS)[number];
/** The rest: what the site reads when it renders (the Application Settings entry). */
export const APPLICATION_SETTING_KEYS = SETTING_KEYS.filter(
  (k): k is Exclude<SettingKey, ComponentSettingKey> => !(COMPONENT_SETTING_KEYS as readonly string[]).includes(k),
);

/** What the `setting.type` column may hold. The editor draws from `control`. */
export type SettingType = 'text' | 'number' | 'boolean' | 'json';

/** The values as the site reads them, key by key. */
export interface SettingValues {
  'home.lead_series': string;
  'home.major_series': string[];
  'announcement.active_id': string;
  'region.image.show_caption': boolean;
  'region.list.style': 'links' | 'cards';
  'region.button.label': string;
  'region.static.template': RegionTemplateKey;
  'region.image.template': RegionTemplateKey;
  'region.list.template': RegionTemplateKey;
  'region.button.template': RegionTemplateKey;
}
/** What a setting may hold, by its controls: text and choices, a series set, an integer, a yes/no. Wider than the
 *  keys' own union: no shipped key is an integer since P2.24 C, a component's application-scope number attribute is. */
export type SettingValue = string | number | boolean | string[];

export type SettingControl =
  | { kind: 'series' }
  | { kind: 'series-set'; max: number }
  | { kind: 'integer'; min: number; max: number }
  | { kind: 'announcement' }
  | { kind: 'boolean' }
  /** `labels` names an option for a person where the stored value is a key (the templates); absent, the value is its own label. */
  | { kind: 'choice'; options: readonly string[]; labels?: Readonly<Record<string, string>> }
  | { kind: 'text'; max: number };

export interface SettingSpec<K extends SettingKey = SettingKey> {
  type: SettingType;
  label: string;
  /** What the value changes, in plain words; also the row's seeded description. */
  description: string;
  control: SettingControl;
  /** The value the code shipped, and the fallback for every failure. */
  shipped: SettingValues[K];
}

/** The notices the announcement setting may name, for the editor's select and
 *  the parser. Empty means no notice. */
export const ANNOUNCEMENT_IDS: readonly string[] = WHATS_NEW.map(e => e.id);

/** The Component Settings' specs, from the region kinds' definitions (P2.0). */
const COMPONENT_SETTING_SPECS = componentSettingSpecs() as unknown as { [K in ComponentSettingKey]: SettingSpec<K> };

export const SETTING_SPECS: { [K in SettingKey]: SettingSpec<K> } = {
  'home.lead_series': {
    type: 'text',
    label: 'Home: lead series',
    description: 'The championship that always leads the live band on the home page when it is running.',
    control: { kind: 'series' },
    shipped: 'f1',
  },
  'home.major_series': {
    type: 'json',
    label: 'Home: featured series',
    description:
      'The other championships that earn their own box on the home page when running; everything else shares one row.',
    control: { kind: 'series-set', max: 6 },
    shipped: ['motogp', 'wec', 'indycar', 'nascar-cup'],
  },
  // home.wire_count and home.blog_suggested_count left in P2.24 C: the counts are
  // the Rows of Home's Data regions now (their seeded rows stay in the table, unread).
  'announcement.active_id': {
    type: 'text',
    label: 'Announcement in force',
    description:
      "Which What's New notice readers see; empty hides it. The notice names the running version, so arm one only when that version is live.",
    control: { kind: 'announcement' },
    shipped: WHATS_NEW.find(e => e.active)?.id ?? '',
  },
  // The seven Component Settings (region.image.show_caption, region.list.style,
  // region.button.label, the four templates): the region kinds' definitions.
  ...COMPONENT_SETTING_SPECS,
};

/** The shipped values: what the site does when it cannot read the rows. */
export const DEFAULT_SETTINGS: SettingValues = Object.fromEntries(
  SETTING_KEYS.map(k => [k, SETTING_SPECS[k].shipped]),
) as unknown as SettingValues;

export function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(key);
}

const SLUG = /^[a-z0-9-]+$/;

/**
 * Parse one value for `key` into its typed form, or undefined when it is not
 * usable. Accepts what the `value` column holds (text; JSON text for a json
 * setting) and what the editor sends (the typed value itself), so the loader
 * and the write route share one rule: the loader falls back to the shipped
 * value, the route refuses. `known.seriesSlugs` is what only the server knows.
 */
export function parseSettingValue<K extends SettingKey>(
  key: K,
  raw: unknown,
  known?: { seriesSlugs?: readonly string[] },
): SettingValues[K] | undefined {
  const control = SETTING_SPECS[key].control;
  const slugOk = (s: string) => SLUG.test(s) && (!known?.seriesSlugs || known.seriesSlugs.includes(s));
  switch (control.kind) {
    case 'series': {
      if (typeof raw !== 'string') return undefined;
      const v = raw.trim();
      return v && slugOk(v) ? (v as unknown as SettingValues[K]) : undefined;
    }
    case 'series-set': {
      let list: unknown = raw;
      if (typeof raw === 'string') {
        try {
          list = JSON.parse(raw);
        } catch {
          return undefined;
        }
      }
      if (!Array.isArray(list)) return undefined;
      const out: string[] = [];
      for (const item of list) {
        if (typeof item !== 'string') return undefined;
        const v = item.trim();
        if (!v || !slugOk(v)) return undefined;
        if (!out.includes(v)) out.push(v);
      }
      return out.length <= control.max ? (out as unknown as SettingValues[K]) : undefined;
    }
    case 'integer': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
      return Number.isInteger(n) && n >= control.min && n <= control.max ? (n as unknown as SettingValues[K]) : undefined;
    }
    case 'announcement': {
      if (typeof raw !== 'string') return undefined;
      const v = raw.trim();
      return v === '' || ANNOUNCEMENT_IDS.includes(v) ? (v as unknown as SettingValues[K]) : undefined;
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw as unknown as SettingValues[K];
      if (raw === 'true') return true as unknown as SettingValues[K];
      if (raw === 'false') return false as unknown as SettingValues[K];
      return undefined;
    }
    case 'choice': {
      if (typeof raw !== 'string') return undefined;
      const v = raw.trim();
      return control.options.includes(v) ? (v as unknown as SettingValues[K]) : undefined;
    }
    case 'text': {
      if (typeof raw !== 'string') return undefined;
      const v = raw.trim();
      return v && v.length <= control.max ? (v as unknown as SettingValues[K]) : undefined;
    }
  }
}

/** The text the `value` column holds for a typed value. */
export function serialiseSettingValue(key: SettingKey, value: SettingValue): string {
  return SETTING_SPECS[key].type === 'json' ? JSON.stringify(value) : String(value);
}

/** What the editor tells a person a refused value must be. */
export function settingValueRule(key: SettingKey): string {
  const control = SETTING_SPECS[key].control;
  switch (control.kind) {
    case 'series':
      return 'must be one of the site’s championships';
    case 'series-set':
      return `must be up to ${control.max} of the site’s championships`;
    case 'integer':
      return `must be a whole number from ${control.min} to ${control.max}`;
    case 'announcement':
      return 'must be one of the known notices, or empty for none';
    case 'boolean':
      return 'must be yes or no';
    case 'choice':
      return `must be one of: ${control.options.join(', ')}`;
    case 'text':
      return `must be some words, at most ${control.max} characters`;
  }
}
