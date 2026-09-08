// Application Settings (APEX: Application Settings): the named values the site
// reads when it renders a page, by key, with the value the code shipped, what
// each one changes in plain words, and the control the editor draws for it.
// Client-safe: the designer's editor lists them, the server loader (settings.ts)
// falls back to them, and the home model and the layout read the loader's answer.

import { WHATS_NEW } from '@/lib/whats-new';

export const SETTING_KEYS = [
  'home.lead_series',
  'home.major_series',
  'home.wire_count',
  'home.blog_suggested_count',
  'announcement.active_id',
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

/** What the `setting.type` column may hold. The editor draws from `control`. */
export type SettingType = 'text' | 'number' | 'boolean' | 'json';

/** The values as the site reads them, key by key. */
export interface SettingValues {
  'home.lead_series': string;
  'home.major_series': string[];
  'home.wire_count': number;
  'home.blog_suggested_count': number;
  'announcement.active_id': string;
}
export type SettingValue = SettingValues[SettingKey];

export type SettingControl =
  | { kind: 'series' }
  | { kind: 'series-set'; max: number }
  | { kind: 'integer'; min: number; max: number }
  | { kind: 'announcement' };

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
  'home.wire_count': {
    type: 'number',
    label: 'Home: wire headlines',
    description: 'How many headlines the home page wire band shows, 1 to 15.',
    control: { kind: 'integer', min: 1, max: 15 },
    shipped: 5,
  },
  'home.blog_suggested_count': {
    type: 'number',
    label: 'Home: further reading',
    description: 'How many further posts are listed beside the lead post on the home page, 0 to 6.',
    control: { kind: 'integer', min: 0, max: 6 },
    shipped: 3,
  },
  'announcement.active_id': {
    type: 'text',
    label: 'Announcement in force',
    description:
      "Which What's New notice readers see; empty hides it. The notice names the running version, so arm one only when that version is live.",
    control: { kind: 'announcement' },
    shipped: WHATS_NEW.find(e => e.active)?.id ?? '',
  },
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
  }
}
