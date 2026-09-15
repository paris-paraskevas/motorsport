import { describe, expect, it } from 'vitest';
import type { NavEntry } from './destinations';
import {
  addEntry,
  canAdd,
  canRemove,
  maxEntries,
  minEntries,
  moveEntry,
  removeEntry,
  sameEntries,
  updateEntry,
} from './list-edit';

const four: NavEntry[] = [
  { label: 'Home', dest: 'home', icon: 'house' },
  { label: 'Calendar', dest: 'calendar', icon: 'calendar-days' },
  { label: 'Learn', dest: 'learn', icon: 'compass' },
  { label: 'Account', dest: 'account', icon: 'circle-user' },
];

describe('bounds', () => {
  it('the bar holds three to five, every other list at least one with no ceiling', () => {
    expect([minEntries('bar'), maxEntries('bar')]).toEqual([3, 5]);
    expect([minEntries('menu'), maxEntries('menu')]).toEqual([1, null]);
    expect(canRemove('bar', 3)).toBe(false);
    expect(canRemove('bar', 4)).toBe(true);
    expect(canRemove('footer', 1)).toBe(false);
    expect(canAdd('bar', 5)).toBe(false);
    expect(canAdd('bar', 4)).toBe(true);
    expect(canAdd('footer', 40)).toBe(true);
  });
});

describe('moveEntry', () => {
  it('moves an entry to a new position without mutating the input', () => {
    const out = moveEntry(four, 3, 0);
    expect(out.map(e => e.dest)).toEqual(['account', 'home', 'calendar', 'learn']);
    expect(four.map(e => e.dest)).toEqual(['home', 'calendar', 'learn', 'account']);
    expect(moveEntry(four, 0, 1).map(e => e.dest)).toEqual(['calendar', 'home', 'learn', 'account']);
  });

  it('returns the same list for a no-op or an out-of-range move', () => {
    expect(moveEntry(four, 1, 1)).toBe(four);
    expect(moveEntry(four, 0, -1)).toBe(four);
    expect(moveEntry(four, 4, 0)).toBe(four);
  });
});

describe('updateEntry', () => {
  it('patches one entry and drops an emptied optional field', () => {
    const out = updateEntry(four, 1, { label: 'Races', icon: '' });
    expect(out[1]).toEqual({ label: 'Races', dest: 'calendar' });
    expect(out[0]).toBe(four[0]);
    expect(updateEntry(four, 9, { label: 'x' })).toBe(four);
  });
});

describe('removeEntry', () => {
  it('removes within the bound and refuses at it', () => {
    expect(removeEntry(four, 0, 'bar').map(e => e.dest)).toEqual(['calendar', 'learn', 'account']);
    const three = removeEntry(four, 0, 'bar');
    expect(removeEntry(three, 0, 'bar')).toBe(three);
    expect(removeEntry([four[0]], 0, 'menu')).toHaveLength(1);
  });
});

describe('addEntry', () => {
  it('appends a catalogue destination with its label, a compass for the bar, and refuses junk or a full bar', () => {
    const menu = addEntry([four[0]], 'blog', 'menu');
    expect(menu[1]).toEqual({ label: 'Blog', dest: 'blog' });
    const bar = addEntry(four, 'blog', 'bar');
    expect(bar[4]).toEqual({ label: 'Blog', dest: 'blog', icon: 'compass' });
    expect(addEntry(bar, 'news', 'bar')).toBe(bar);
    expect(addEntry(four, 'https://evil.example', 'menu')).toBe(four);
  });

  it('appends a row page by its key with the page’s name and path as the entry’s href, given the pages; refuses it without them (P1.12 B1)', () => {
    const MONZA = 'a1b2c3d4-0000-4000-8000-000000000010';
    const pages = { [MONZA]: { path: '/history/monza', name: 'Monza, a history' } };
    const menu = addEntry([four[0]], `page:${MONZA}`, 'menu', pages);
    expect(menu[1]).toEqual({ label: 'Monza, a history', dest: `page:${MONZA}`, href: '/history/monza' });
    expect(addEntry([four[0]], `page:${MONZA}`, 'menu')).toEqual([four[0]]);
  });
});

describe('sameEntries', () => {
  it('compares what would be stored, treating a missing optional as empty', () => {
    expect(sameEntries(four, four.map(e => ({ ...e })))).toBe(true);
    expect(sameEntries(four, updateEntry(four, 0, { label: 'Start' }))).toBe(false);
    expect(sameEntries([{ label: 'A', dest: 'home' }], [{ label: 'A', dest: 'home', icon: '' }])).toBe(true);
    expect(sameEntries(four, four.slice(0, 3))).toBe(false);
  });
});
