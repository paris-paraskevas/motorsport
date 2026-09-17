import { COMPONENTS, parseSettings, type AttributeDefinition, type AttributeGroup, type AttributeKind, type AttributeScope, type ComponentDefinition } from './components';
import { REGION_TEMPLATES } from './template-options';
import { isGoDestination } from './page-document';
import type { SettingControl, SettingType, SettingValue } from './setting-defaults';

// The definitions of every component type (the components programme, P2.0;
// APEX: Plug-ins), client-safe: the four built-in region kinds, whose
// application-scope attributes ARE the Component Settings (APEX: Component
// Settings, the defaults a region of each kind starts with), then the
// components of lib/design/components.ts. The seven setting specs derive from
// the region definitions here, so the settings' keys, labels, controls and
// shipped values read through the model unchanged (setting-defaults.ts spreads
// them into SETTING_SPECS; component-definitions.test.ts holds today's literal).
//
// The region names and what each holds mirror REGION_KIND_LABELS in
// page-document.ts (the test keeps them equal); that module is not imported
// here, since it imports components.ts and setting-defaults.ts imports this.

/** The template (the look) a region of a kind starts with: one attribute per kind, the same rule. */
function templateAttribute(name: string, article: 'a' | 'an'): AttributeDefinition {
  return {
    key: 'template',
    label: 'Template',
    kind: 'choice',
    options: REGION_TEMPLATES.map(t => ({ key: t.key, label: t.label })),
    default: 'standard',
    scope: 'application',
    help: `The template, the look, ${article} ${name} region placed on a page starts with: Plain, Boxed, Band, Aside or Hero. Each region can still be changed on its page.`,
  };
}

export const REGION_DEFINITIONS: readonly ComponentDefinition[] = [
  {
    key: 'region.static',
    name: 'Static Content',
    group: 'Region',
    holds: 'text of your own; {shortcut:key} inserts a shortcut',
    settings: [templateAttribute('Static Content', 'a')],
  },
  {
    key: 'region.image',
    name: 'Image',
    group: 'Region',
    holds: 'one of your photos, with its caption and credit',
    settings: [
      {
        key: 'show_caption',
        label: 'Caption',
        kind: 'boolean',
        default: true,
        scope: 'application',
        help: 'Whether a photo placed on a page starts with its caption, credit and licence shown. Each region can still be changed on its page.',
      },
      templateAttribute('Image', 'an'),
    ],
  },
  {
    key: 'region.list',
    name: 'List',
    group: 'Region',
    holds: 'one of the navigation lists, as links',
    settings: [
      {
        key: 'style',
        label: 'Style',
        kind: 'choice',
        options: [
          { key: 'links', label: 'links' },
          { key: 'cards', label: 'cards' },
        ],
        default: 'links',
        scope: 'application',
        help: 'How a list placed on a page starts: as plain links, or as cards. Each region can still be changed on its page.',
      },
      templateAttribute('List', 'a'),
    ],
  },
  {
    key: 'region.button',
    name: 'Button',
    group: 'Region',
    holds: 'a labelled button: goes to a destination, fires a dynamic action, or both',
    settings: [
      {
        key: 'label',
        label: 'Label',
        kind: 'text',
        maxLength: 40,
        default: 'Read more',
        scope: 'application',
        help: 'The words a button placed on a page starts with, up to 40 characters. Each region can still be changed on its page.',
      },
      templateAttribute('Button', 'a'),
    ],
  },
];

/** Every definition: the region kinds, then the components. */
export const DEFINITIONS: readonly ComponentDefinition[] = [...REGION_DEFINITIONS, ...COMPONENTS];

export interface DerivedSettingSpec {
  type: SettingType;
  label: string;
  description: string;
  control: SettingControl;
  shipped: SettingValue;
}

/** The application-scope attributes as Component Settings: `<definition>.<attribute>`
 *  is the setting key; the label reads `New <Name> regions: <attribute>`; the
 *  control follows the editor. Today's seven, exactly as they were written. */
export function componentSettingSpecs(definitions: readonly ComponentDefinition[] = DEFINITIONS): Record<string, DerivedSettingSpec> {
  const out: Record<string, DerivedSettingSpec> = {};
  for (const d of definitions) {
    for (const a of d.settings) {
      if (a.scope !== 'application') continue;
      out[`${d.key}.${a.key}`] = {
        // The `setting.type` column agrees with the control: boolean, number (an integer control), else text.
        type: a.kind === 'boolean' ? 'boolean' : a.kind === 'number' ? 'number' : 'text',
        label: `New ${d.name} regions: ${a.label.toLowerCase()}`,
        description: a.help ?? '',
        control: controlFor(a),
        shipped: a.default,
      };
    }
  }
  return out;
}

function controlFor(a: AttributeDefinition): SettingControl {
  switch (a.kind) {
    case 'boolean':
      return { kind: 'boolean' };
    case 'choice': {
      const options = (a.options ?? []).map(o => o.key);
      // Labels only where an option is named otherwise than by its key (the templates), as the hand-written specs had it.
      const labelled = (a.options ?? []).some(o => o.label !== o.key);
      return labelled ? { kind: 'choice', options, labels: Object.fromEntries((a.options ?? []).map(o => [o.key, o.label])) } : { kind: 'choice', options };
    }
    case 'number':
      return { kind: 'integer', min: a.min ?? 0, max: a.max ?? Number.MAX_SAFE_INTEGER };
    default:
      return { kind: 'text', max: a.maxLength ?? 200 };
  }
}

// ---------------------------------------------------------------- the overlay (PR B)
//
// A definition's row (APEX: the Plug-in Edit Page's Custom Attributes and
// Attribute Groups, as the operator adds them): what the operator declared on
// top of the code's definition, kept apart from it so a row can never change
// or remove what a renderer reads. The merge is shipped first, then the row's.

/** A key of the operator's own: lower-case letters, digits and underscores. */
export const OVERLAY_KEY = /^[a-z][a-z0-9_]{0,39}$/;
const LABEL_MAX = 60;
const HELP_MAX = 300;
const OPTION_KEY = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const ATTRIBUTE_KINDS: readonly AttributeKind[] = ['choice', 'number', 'boolean', 'text', 'colour', 'icon', 'link'];
const SCOPES: readonly AttributeScope[] = ['application', 'component', 'report'];

export interface DefinitionOverlay {
  attributes: AttributeDefinition[];
  groups: AttributeGroup[];
}
export const EMPTY_OVERLAY: DefinitionOverlay = { attributes: [], groups: [] };

/**
 * Read a stored (or sent) overlay against its shipped definition: the known
 * fields only; a key the code has, a duplicate, a kind or scope outside the
 * lists, a default outside its kind's own rule (parseSettings decides), an
 * undeclared group, are problems. The value is what passed, never a guess.
 */
export function parseOverlay(raw: unknown, shipped: ComponentDefinition): { value: DefinitionOverlay; problems: string[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { value: EMPTY_OVERLAY, problems: ['the overlay must be an object'] };
  const o = raw as Record<string, unknown>;
  const problems: string[] = [];
  if (o.groups !== undefined && !Array.isArray(o.groups)) problems.push('groups must be a list');
  if (o.attributes !== undefined && !Array.isArray(o.attributes)) problems.push('attributes must be a list');
  if (problems.length) return { value: EMPTY_OVERLAY, problems };
  const groups: AttributeGroup[] = [];
  const attributes: AttributeDefinition[] = [];
  const shippedGroups = new Set((shipped.groups ?? []).map(g => g.key));
  ((o.groups as unknown[] | undefined) ?? []).forEach((item, i) => {
    if (!item || typeof item !== 'object') return void problems.push(`group ${i + 1}: not an object`);
    const g = item as Record<string, unknown>;
    const key = typeof g.key === 'string' ? g.key : '';
    if (!OVERLAY_KEY.test(key)) return void problems.push(`group ${i + 1}: the key must be lower-case letters, digits and underscores, at most 40`);
    const who = `group ${key}`;
    if (shippedGroups.has(key)) return void problems.push(`${who}: the code’s ${shipped.name} has a group with that key`);
    if (groups.some(x => x.key === key)) return void problems.push(`${who}: the key is used twice`);
    const title = typeof g.title === 'string' ? g.title.trim() : '';
    if (!title || title.length > LABEL_MAX) return void problems.push(`${who}: the title must be 1 to ${LABEL_MAX} characters`);
    if (typeof g.seq !== 'number' || !Number.isInteger(g.seq)) return void problems.push(`${who}: seq must be a whole number`);
    groups.push({ key, title, seq: g.seq });
  });
  const declared = new Set([...shippedGroups, ...groups.map(g => g.key)]);
  const shippedKeys = new Set(shipped.settings.map(s => s.key));
  ((o.attributes as unknown[] | undefined) ?? []).forEach((item, i) => {
    if (!item || typeof item !== 'object') return void problems.push(`attribute ${i + 1}: not an object`);
    const a = item as Record<string, unknown>;
    const key = typeof a.key === 'string' ? a.key : '';
    if (!OVERLAY_KEY.test(key)) return void problems.push(`attribute ${i + 1}: the key must be lower-case letters, digits and underscores, at most 40`);
    const who = `attribute ${key}`;
    if (shippedKeys.has(key)) return void problems.push(`${who}: the code’s ${shipped.name} has an attribute with that key`);
    if (attributes.some(x => x.key === key)) return void problems.push(`${who}: the key is used twice`);
    const label = typeof a.label === 'string' ? a.label.trim() : '';
    if (!label || label.length > LABEL_MAX) return void problems.push(`${who}: the label must be 1 to ${LABEL_MAX} characters`);
    const kind = typeof a.kind === 'string' && (ATTRIBUTE_KINDS as readonly string[]).includes(a.kind) ? (a.kind as AttributeKind) : null;
    if (!kind) return void problems.push(`${who}: the kind must be one of ${ATTRIBUTE_KINDS.join(', ')}`);
    const scope = a.scope === undefined ? undefined : typeof a.scope === 'string' && (SCOPES as readonly string[]).includes(a.scope) ? (a.scope as AttributeScope) : null;
    if (scope === null) return void problems.push(`${who}: the scope must be application, component or report`);
    const def: AttributeDefinition = { key, label, kind, default: '' };
    if (kind === 'choice') {
      const options = Array.isArray(a.options) ? (a.options as unknown[]) : [];
      const ok = (x: unknown): x is { key: string; label: string } => {
        if (!x || typeof x !== 'object') return false;
        const y = x as { key?: unknown; label?: unknown };
        return typeof y.key === 'string' && OPTION_KEY.test(y.key) && typeof y.label === 'string' && y.label.trim().length > 0 && y.label.length <= LABEL_MAX;
      };
      if (options.length === 0 || !options.every(ok)) return void problems.push(`${who}: a choice needs options, each with a key and a label`);
      def.options = options.map(x => ({ key: x.key, label: x.label.trim() }));
    }
    if (kind === 'number') {
      if (typeof a.min !== 'number' || typeof a.max !== 'number' || !Number.isFinite(a.min) || !Number.isFinite(a.max) || a.min > a.max) return void problems.push(`${who}: min and max must be numbers with min at most max`);
      def.min = a.min;
      def.max = a.max;
    }
    if (kind === 'text' && a.maxLength !== undefined) {
      if (typeof a.maxLength !== 'number' || !Number.isInteger(a.maxLength) || a.maxLength < 1 || a.maxLength > 200) return void problems.push(`${who}: maxLength must be a whole number from 1 to 200`);
      def.maxLength = a.maxLength;
    }
    if (a.default === undefined) return void problems.push(`${who}: the default is missing`);
    // The default by the kind's own rule, and stored as the kind stores it (a colour lower-cased).
    const probe = parseSettings({ ...shipped, settings: [def] }, { [key]: a.default });
    if (probe.problems.length) return void problems.push(`${who}: the default: ${probe.problems[0]}`);
    def.default = probe.settings[key];
    // A link's default names a page or a catalogue link, as the parser will ask of every value (the reviewer's note).
    if (kind === 'link' && def.default && !isGoDestination(String(def.default))) return void problems.push(`${who}: the default: ${label} must be a page or a link from the catalogue`);
    if (a.help !== undefined) {
      if (typeof a.help !== 'string' || a.help.length > HELP_MAX) return void problems.push(`${who}: the help is at most ${HELP_MAX} characters`);
      if (a.help.trim()) def.help = a.help.trim();
    }
    if (scope) def.scope = scope;
    if (a.group !== undefined && a.group !== '') {
      if (typeof a.group !== 'string' || !declared.has(a.group)) return void problems.push(`${who}: names the group ${String(a.group)}, which neither the code nor this overlay declares`);
      def.group = a.group;
    }
    attributes.push(def);
  });
  return { value: attributes.length || groups.length ? { attributes, groups } : EMPTY_OVERLAY, problems };
}

/** The shipped definition with the overlay's attributes and groups after its own; the shipped object itself when the overlay is empty. */
export function mergeDefinition(shipped: ComponentDefinition, overlay: DefinitionOverlay): ComponentDefinition {
  if (overlay.attributes.length === 0 && overlay.groups.length === 0) return shipped;
  const groups = [...(shipped.groups ?? []), ...overlay.groups];
  return { ...shipped, settings: [...shipped.settings, ...overlay.attributes], ...(groups.length ? { groups } : {}) };
}

/** Every shipped definition, merged with its overlay where one exists. */
export function mergeDefinitions(shipped: readonly ComponentDefinition[], overlays: Readonly<Record<string, DefinitionOverlay>>): ComponentDefinition[] {
  return shipped.map(d => {
    const o = overlays[d.key];
    return o ? mergeDefinition(d, o) : d;
  });
}

export function isDefinitionKey(key: string): boolean {
  return DEFINITIONS.some(d => d.key === key);
}

/** Region (one of the four built-in kinds) or Component (drawn by a renderer). */
export function definitionKind(d: ComponentDefinition): 'Region' | 'Component' {
  return d.group === 'Region' ? 'Region' : 'Component';
}

/** A definition as the Plug-ins page sees it: merged, with its overlay, the
 *  row's stamp (null when the code's alone), Utilization (the live pages whose
 *  newest revision uses it) and the count of such regions. */
export interface EditableDefinition {
  key: string;
  definition: ComponentDefinition;
  overlay: DefinitionOverlay;
  updatedAt: string | null;
  updatedBy: string | null;
  usedOn: { id: string; path: string; name: string }[];
  regions: number;
}

/** The component kinds of an editable list, merged: what the Page Designer takes. */
export function componentDefinitionsOf(list: readonly EditableDefinition[]): ComponentDefinition[] {
  return list.map(d => d.definition).filter(d => d.group !== 'Region');
}
