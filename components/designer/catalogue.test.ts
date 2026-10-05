import { describe, expect, it } from 'vitest';
import { NAV_LIST_KEYS } from '@/lib/design/lists';
import { CATALOGUE, LIST_COPY } from './catalogue';

describe('shared components catalogue', () => {
  const items = CATALOGUE.flatMap(g => g.items);

  it('has unique keys and every item is either editable or says when it arrives', () => {
    const keys = items.map(i => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of items) expect(Boolean(item.listKey || item.editor) !== Boolean(item.later), item.key).toBe(true);
  });

  it('opens exactly the five navigation lists, each with its copy, and the eighteen editors', () => {
    const listed = items.filter(i => i.listKey).map(i => i.listKey);
    expect([...listed].sort()).toEqual([...NAV_LIST_KEYS].sort());
    for (const key of NAV_LIST_KEYS) expect(LIST_COPY[key].title.length).toBeGreaterThan(0);
    expect(items.filter(i => i.editor).map(i => [i.key, i.editor])).toEqual([
      ['appdef', 'appdef'],
      ['appcomps', 'computations'],
      ['settings', 'settings'],
      ['build', 'build'],
      ['authz', 'authz'],
      ['plugins', 'plugins'],
      ['compsettings', 'compsettings'],
      ['shortcuts', 'shortcuts'],
      ['views', 'views'],
      ['lists', 'lists'],
      ['searchhints', 'searchhints'],
      ['appearance', 'appearance'],
      ['themes', 'themes'],
      ['templates', 'templates'],
      ['maps', 'maps'],
      ['assets', 'assets'],
      ['datasources', 'datasources'],
      ['textmsgs', 'text'],
    ]);
    // P2.1: Data Sources is editable; Remote Servers and JSON Sources say when they arrive.
    const data = CATALOGUE.find(g => g.group === 'Data Sources')!;
    expect(data.items.map(i => [i.key, i.editor ?? null, i.later ?? null])).toEqual([
      ['datasources', 'datasources', null],
      ['remoteservers', null, 'with the first remote source'],
      ['json', null, 'Phase 4'],
    ]);
  });
});
