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

  it('opens exactly the four navigation lists, each with its copy, and the five editors', () => {
    const listed = items.filter(i => i.listKey).map(i => i.listKey);
    expect([...listed].sort()).toEqual([...NAV_LIST_KEYS].sort());
    for (const key of NAV_LIST_KEYS) expect(LIST_COPY[key].title.length).toBeGreaterThan(0);
    expect(items.filter(i => i.editor).map(i => [i.key, i.editor])).toEqual([
      ['settings', 'settings'],
      ['build', 'build'],
      ['authz', 'authz'],
      ['themes', 'themes'],
      ['textmsgs', 'text'],
    ]);
  });
});
