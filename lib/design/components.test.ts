import { describe, expect, it } from 'vitest';
import { COMPONENTS, COMPONENT_KEY, SPLITS, componentDefaults, componentId, defaultDocument, findComponent, parseSettings, recipeRegions, settingsSummary } from './components';

// The component catalogue: every key well formed and unique, settings read
// against their spec with defaults standing in, the summary in words, Home's
// split recipe naming components that exist.

describe('the component catalogue', () => {
  it('has well-formed, unique keys, one transitional component, and a renderer-side counterpart for each (by name)', () => {
    const keys = COMPONENTS.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of COMPONENTS) expect(c.key).toMatch(COMPONENT_KEY);
    expect(COMPONENTS.filter(c => c.legacy).map(c => c.key)).toEqual(['page.body']);
    expect(findComponent('home.wire')?.name).toBe('The wire');
    expect(findComponent('nope')).toBeNull();
  });

  it('reads settings against the spec: defaults stand in, a wrong kind, a range miss or an unknown key is a problem', () => {
    const wire = findComponent('home.wire')!;
    expect(componentDefaults(wire)).toEqual({ items: 5 });
    expect(parseSettings(wire, undefined)).toEqual({ settings: { items: 5 }, problems: [] });
    expect(parseSettings(wire, { items: 12 })).toEqual({ settings: { items: 12 }, problems: [] });
    expect(parseSettings(wire, { items: 40 })).toEqual({ settings: { items: 5 }, problems: ['Items must be a number from 3 to 20'] });
    expect(parseSettings(wire, { items: 'many' }).problems).toEqual(['Items must be a number from 3 to 20']);
    expect(parseSettings(wire, { colour: 'red' }).problems).toEqual(['The wire has no setting called colour']);
    expect(parseSettings(wire, ['x']).problems).toEqual(['the settings must be an object']);
    const lead = findComponent('home.lead')!;
    expect(parseSettings(lead, { pinned: 'monza-2026', suggested: 2 })).toEqual({ settings: { pinned: 'monza-2026', suggested: 2 }, problems: [] });
    expect(parseSettings(lead, { pinned: 'x'.repeat(121) }).problems).toEqual(['Pinned post must be text of at most 120 characters']);
  });

  it('sums settings up in words, and the transitional component by what it holds', () => {
    const wire = findComponent('home.wire')!;
    expect(settingsSummary(wire, { items: 8 })).toBe('Items 8');
    const changed = findComponent('home.changed')!;
    expect(settingsSummary(changed, {})).toBe('Rows 5');
    const legacy = findComponent('page.body')!;
    expect(settingsSummary(legacy, {})).toMatch(/exactly as its code writes it today/);
  });

  it('every split recipe names components the catalogue has', () => {
    expect(SPLITS['/']).toHaveLength(6);
    expect(SPLITS['/calendar']).toEqual(['page.heading', 'calendar.month']);
    for (const recipe of Object.values(SPLITS)) for (const key of recipe) expect(findComponent(key)).not.toBeNull();
  });

  it('lays a recipe out as Body regions: full rows, the two Home halves sharing one, ids from the keys, and a default document from it', () => {
    const home = recipeRegions('/');
    expect(home.map(r => `${r.id}:${r.column}/${r.span}${r.newRow ? '' : ' same row'}:${r.seq}`)).toEqual([
      'lead:1/12:10',
      'live:1/12:20',
      'result:1/12:30',
      'changed:1/6:40',
      'next:7/6 same row:50',
      'wire:1/12:60',
    ]);
    expect(home.find(r => r.id === 'wire')?.settings).toEqual({ items: 5 });
    expect(recipeRegions('/', ['wire'], 100).map(r => r.id)[5]).toBe('wire-2');
    expect(recipeRegions('/nowhere')).toEqual([]);
    expect(componentId('page.body', [])).toBe('code-body');
    expect(componentId('home.wire', ['wire', 'wire-2'])).toBe('wire-3');
    expect(defaultDocument('/calendar').regions.map(r => r.component)).toEqual(['page.heading', 'calendar.month']);
  });
});
