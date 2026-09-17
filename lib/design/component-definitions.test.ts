import { describe, expect, it } from 'vitest';
import { DEFINITIONS, REGION_DEFINITIONS, componentSettingSpecs } from './component-definitions';
import { COMPONENTS, componentDefaults } from './components';
import { COMPONENT_SETTING_KEYS, SETTING_SPECS } from './setting-defaults';
import { REGION_KIND_LABELS, type RegionKind } from './page-document';

// The component definition model (P2.0): the four built-in region kinds are
// definitions too, and their application-scope attributes ARE today's Component
// Settings. The seven setting specs derive from them and must come out exactly
// as they were written by hand, so a change of a label, a control or a shipped
// value in a definition fails here on purpose.

const TEMPLATE = { kind: 'choice', options: ['standard', 'boxed', 'band', 'aside', 'hero'], labels: { standard: 'Plain', boxed: 'Boxed', band: 'Band', aside: 'Aside', hero: 'Hero' } };
const TODAY = {
  'region.image.show_caption': {
    type: 'boolean',
    label: 'New Image regions: caption',
    description: 'Whether a photo placed on a page starts with its caption, credit and licence shown. Each region can still be changed on its page.',
    control: { kind: 'boolean' },
    shipped: true,
  },
  'region.list.style': {
    type: 'text',
    label: 'New List regions: style',
    description: 'How a list placed on a page starts: as plain links, or as cards. Each region can still be changed on its page.',
    control: { kind: 'choice', options: ['links', 'cards'] },
    shipped: 'links',
  },
  'region.button.label': {
    type: 'text',
    label: 'New Button regions: label',
    description: 'The words a button placed on a page starts with, up to 40 characters. Each region can still be changed on its page.',
    control: { kind: 'text', max: 40 },
    shipped: 'Read more',
  },
  'region.static.template': {
    type: 'text',
    label: 'New Static Content regions: template',
    description: 'The template, the look, a Static Content region placed on a page starts with: Plain, Boxed, Band, Aside or Hero. Each region can still be changed on its page.',
    control: TEMPLATE,
    shipped: 'standard',
  },
  'region.image.template': {
    type: 'text',
    label: 'New Image regions: template',
    description: 'The template, the look, an Image region placed on a page starts with: Plain, Boxed, Band, Aside or Hero. Each region can still be changed on its page.',
    control: TEMPLATE,
    shipped: 'standard',
  },
  'region.list.template': {
    type: 'text',
    label: 'New List regions: template',
    description: 'The template, the look, a List region placed on a page starts with: Plain, Boxed, Band, Aside or Hero. Each region can still be changed on its page.',
    control: TEMPLATE,
    shipped: 'standard',
  },
  'region.button.template': {
    type: 'text',
    label: 'New Button regions: template',
    description: 'The template, the look, a Button region placed on a page starts with: Plain, Boxed, Band, Aside or Hero. Each region can still be changed on its page.',
    control: TEMPLATE,
    shipped: 'standard',
  },
};

describe('the component definition model', () => {
  it('derives today’s seven Component Settings from the region definitions, byte for byte, and SETTING_SPECS reads them through unchanged', () => {
    expect(componentSettingSpecs()).toEqual(TODAY);
    for (const key of COMPONENT_SETTING_KEYS) expect(SETTING_SPECS[key], key).toEqual(TODAY[key]);
  });

  it('the derived keys are exactly the typed COMPONENT_SETTING_KEYS', () => {
    expect(Object.keys(componentSettingSpecs()).sort()).toEqual([...COMPONENT_SETTING_KEYS].sort());
  });

  it('every definition is well formed: unique attribute keys, a declared group for each grouped attribute, the region kinds named as the designer names them and application-scope only, the components after them', () => {
    expect(new Set(DEFINITIONS.map(d => d.key)).size).toBe(DEFINITIONS.length);
    for (const d of DEFINITIONS) {
      const keys = d.settings.map(s => s.key);
      expect(new Set(keys).size, d.key).toBe(keys.length);
      const groups = new Set((d.groups ?? []).map(g => g.key));
      for (const s of d.settings) if (s.group) expect(groups.has(s.group), `${d.key}: ${s.key} names the group ${s.group}`).toBe(true);
    }
    expect(REGION_DEFINITIONS.map(d => d.key)).toEqual(['region.static', 'region.image', 'region.list', 'region.button']);
    for (const d of REGION_DEFINITIONS) {
      const kind = d.key.slice('region.'.length) as RegionKind;
      expect(d.name).toBe(REGION_KIND_LABELS[kind].label);
      expect(d.holds).toBe(REGION_KIND_LABELS[kind].holds);
      for (const s of d.settings) expect(s.scope, `${d.key}: ${s.key}`).toBe('application');
    }
    expect(DEFINITIONS.slice(REGION_DEFINITIONS.length)).toEqual(COMPONENTS);
  });

  it('an application-scope attribute has no home on a region: a region kind’s defaults are empty', () => {
    for (const d of REGION_DEFINITIONS) expect(componentDefaults(d)).toEqual({});
  });
});
