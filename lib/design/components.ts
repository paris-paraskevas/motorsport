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
];

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
