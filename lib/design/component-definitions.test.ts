import { describe, expect, it } from 'vitest';
import { DEFINITIONS, EMPTY_OVERLAY, REGION_DEFINITIONS, componentDefinitionsOf, componentSettingSpecs, mergeDefinition, mergeDefinitions, parseOverlay, type EditableDefinition } from './component-definitions';
import { COMPONENTS, componentDefaults, type ComponentDefinition } from './components';
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

  it('a derived spec’s type agrees with its control for every kind, a number included (the reviewer’s note)', () => {
    const rows: ComponentDefinition = {
      key: 'test.rows',
      name: 'Rows',
      group: 'Data',
      holds: 'rows',
      settings: [
        { key: 'count', label: 'Count', kind: 'number', min: 1, max: 50, default: 10, scope: 'application' },
        { key: 'open', label: 'Open', kind: 'boolean', default: false, scope: 'application' },
        { key: 'note', label: 'Note', kind: 'text', maxLength: 30, default: '', scope: 'application' },
      ],
    };
    const specs = componentSettingSpecs([rows]);
    expect(specs['test.rows.count']).toEqual({ type: 'number', label: 'New Rows regions: count', description: '', control: { kind: 'integer', min: 1, max: 50 }, shipped: 10 });
    expect(specs['test.rows.open'].type).toBe('boolean');
    expect(specs['test.rows.note']).toMatchObject({ type: 'text', control: { kind: 'text', max: 30 } });
    const agree = { boolean: 'boolean', integer: 'number', choice: 'text', text: 'text' } as const;
    for (const [key, spec] of Object.entries({ ...componentSettingSpecs(), ...specs })) expect(spec.type, key).toBe(agree[spec.control.kind as keyof typeof agree]);
  });
});

describe('a definition’s overlay (P2.0, PR B): what the operator adds to a shipped definition', () => {
  const heading = DEFINITIONS.find(d => d.key === 'page.heading')!;
  const overlay = {
    attributes: [
      { key: 'accent', label: 'Accent', kind: 'colour', default: '#8C1C13', group: 'colours', help: 'The rule under the heading.' },
      { key: 'badge', label: 'Badge', kind: 'choice', options: [{ key: 'none', label: 'None' }, { key: 'new', label: 'New' }], default: 'none' },
    ],
    groups: [{ key: 'colours', title: 'Colours', seq: 10 }],
  };

  it('reads a well-formed overlay, keeping the known fields only and the defaults as the kinds store them', () => {
    const { value, problems } = parseOverlay({ ...overlay, extra: 1 }, heading);
    expect(problems).toEqual([]);
    expect(value).toEqual({
      attributes: [
        { key: 'accent', label: 'Accent', kind: 'colour', default: '#8c1c13', group: 'colours', help: 'The rule under the heading.' },
        { key: 'badge', label: 'Badge', kind: 'choice', options: [{ key: 'none', label: 'None' }, { key: 'new', label: 'New' }], default: 'none' },
      ],
      groups: [{ key: 'colours', title: 'Colours', seq: 10 }],
    });
    expect(parseOverlay({}, heading)).toEqual({ value: EMPTY_OVERLAY, problems: [] });
    expect(parseOverlay(null, heading).problems).toEqual(['the overlay must be an object']);
    expect(parseOverlay({ attributes: 'x' }, heading).problems).toEqual(['attributes must be a list']);
  });

  it('refuses a shipped key, a duplicate, a bad kind or scope, a default outside its kind’s rule, and an undeclared group', () => {
    const bad = (attributes: unknown[], groups: unknown[] = []) => parseOverlay({ attributes, groups }, heading).problems;
    expect(bad([{ key: 'text', label: 'Words', kind: 'text', default: '' }])).toEqual(['attribute text: the code’s Page heading has an attribute with that key']);
    expect(bad([{ key: 'Accent', label: 'Accent', kind: 'colour', default: '#8c1c13' }])).toEqual(['attribute 1: the key must be lower-case letters, digits and underscores, at most 40']);
    expect(bad([{ key: 'a', label: 'A', kind: 'text', default: '' }, { key: 'a', label: 'A', kind: 'text', default: '' }])).toEqual(['attribute a: the key is used twice']);
    expect(bad([{ key: 'a', label: 'A', kind: 'blob', default: '' }])).toEqual(['attribute a: the kind must be one of choice, number, boolean, text, colour, icon, link']);
    expect(bad([{ key: 'a', label: 'A', kind: 'text', default: '', scope: 'page' }])).toEqual(['attribute a: the scope must be application, component or report']);
    expect(bad([{ key: 'a', label: 'A', kind: 'colour', default: 'red' }])).toEqual(['attribute a: the default: A must be a colour as #rrggbb']);
    expect(bad([{ key: 'a', label: 'A', kind: 'choice', default: 'x' }])).toEqual(['attribute a: a choice needs options, each with a key and a label']);
    expect(bad([{ key: 'a', label: 'A', kind: 'number', min: 5, max: 1, default: 3 }])).toEqual(['attribute a: min and max must be numbers with min at most max']);
    expect(bad([{ key: 'a', label: '', kind: 'text', default: '' }])).toEqual(['attribute a: the label must be 1 to 60 characters']);
    expect(bad([{ key: 'a', label: 'A', kind: 'text', default: '', group: 'nope' }])).toEqual(['attribute a: names the group nope, which neither the code nor this overlay declares']);
    expect(bad([{ key: 'a', label: 'A', kind: 'link', default: 'nowhere-at-all' }])).toEqual(['attribute a: the default: A must be a page or a link from the catalogue']);
    expect(bad([{ key: 'a', label: 'A', kind: 'link', default: 'calendar' }])).toEqual([]);
    expect(bad([], [{ key: 'g', title: '', seq: 10 }])).toEqual(['group g: the title must be 1 to 60 characters']);
    expect(bad([], [{ key: 'g', title: 'G', seq: 1.5 }])).toEqual(['group g: seq must be a whole number']);
  });

  it('merges shipped first, then the overlay; an empty overlay leaves the shipped definition as it is', () => {
    const merged = mergeDefinition(heading, parseOverlay(overlay, heading).value);
    // R18: the shipped heading carries text, eyebrow and standfirst; the overlay's two follow.
    expect(merged.settings.map(s => s.key)).toEqual(['text', 'eyebrow', 'standfirst', 'accent', 'badge']);
    expect(merged.groups).toEqual([{ key: 'colours', title: 'Colours', seq: 10 }]);
    expect(merged.name).toBe(heading.name);
    expect(mergeDefinition(heading, EMPTY_OVERLAY)).toBe(heading);
    const all = mergeDefinitions(DEFINITIONS, { 'page.heading': parseOverlay(overlay, heading).value });
    expect(all).toHaveLength(DEFINITIONS.length);
    expect(all.find(d => d.key === 'page.heading')?.settings).toHaveLength(5);
    expect(all.find(d => d.key === 'series.live')).toBe(DEFINITIONS.find(d => d.key === 'series.live'));
  });

  it('the component kinds of an editable list, merged, are what the Page Designer takes', () => {
    const list: EditableDefinition[] = DEFINITIONS.map(d => ({ key: d.key, definition: d.key === 'page.heading' ? mergeDefinition(d, parseOverlay(overlay, d).value) : d, overlay: EMPTY_OVERLAY, updatedAt: null, updatedBy: null, usedOn: [], regions: 0 }));
    const components = componentDefinitionsOf(list);
    expect(components.map(d => d.key)).toEqual(DEFINITIONS.filter(d => d.group !== 'Region').map(d => d.key));
    expect(components.find(d => d.key === 'page.heading')?.settings).toHaveLength(5);
  });
});
