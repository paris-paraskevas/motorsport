import { COMPONENTS, type AttributeDefinition, type ComponentDefinition } from './components';
import { REGION_TEMPLATES } from './template-options';
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
