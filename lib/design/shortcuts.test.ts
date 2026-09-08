import { beforeEach, describe, expect, it, vi } from 'vitest';

let configured = true;
let result: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return q;
    },
  }),
}));

import {
  SHORTCUT_TEXT_MAX,
  isShortcutKey,
  loadShortcuts,
  loadShortcutsForEditing,
  resetShortcutsMemo,
  shortcutKeyProblem,
  shortcutTextProblem,
  shortcutsFromRows,
} from './shortcuts';

const STAMP = '2026-09-08T14:00:00.505502+00:00';
const seeded = [
  { key: 'times.local', text: 'All times are shown in your local time zone.', updated_at: STAMP },
  { key: 'wire.linked_out', text: 'Reported elsewhere. Every headline links out to its source.', updated_at: STAMP },
  { key: 'data.sources', text: 'Results and standings follow the official timing.', updated_at: STAMP },
];

describe('the key and text rules', () => {
  it('accepts dotted, dashed and underscored lower-case keys and refuses the rest, with reasons', () => {
    for (const k of ['times.local', 'wire.linked_out', 'a', 'x-1', 'a'.repeat(60)]) expect(isShortcutKey(k), k).toBe(true);
    for (const k of ['', 'Times', 'times local', '.start', 'a'.repeat(61), 'ünïcode', 42, null]) expect(isShortcutKey(k), String(k)).toBe(false);
    expect(shortcutKeyProblem('')).toBe('needs a key');
    expect(shortcutKeyProblem('a'.repeat(61))).toMatch(/at most 60/);
    expect(shortcutKeyProblem('Times Local')).toMatch(/lower-case letters, digits, dots, dashes and underscores/);
    expect(shortcutKeyProblem('times.local')).toBeNull();
    expect(shortcutTextProblem('   ')).toBe('cannot be empty');
    expect(shortcutTextProblem('x'.repeat(SHORTCUT_TEXT_MAX + 1))).toBe(`over ${SHORTCUT_TEXT_MAX} characters`);
    expect(shortcutTextProblem('Fine.')).toBeNull();
  });
});

describe('shortcutsFromRows', () => {
  it('keeps usable rows and leaves out a bad key, an empty text and an over-long text', () => {
    const out = shortcutsFromRows([
      ...seeded,
      { key: 'Bad Key', text: 'x' },
      { key: 'empty', text: '   ' },
      { key: 'long', text: 'x'.repeat(SHORTCUT_TEXT_MAX + 1) },
      { key: 'spaced', text: '  trimmed  ' },
      null,
      'nope',
    ]);
    expect(Object.keys(out).sort()).toEqual(['data.sources', 'spaced', 'times.local', 'wire.linked_out']);
    expect(out.spaced).toBe('trimmed');
    expect(shortcutsFromRows('nope')).toEqual({});
  });
});

describe('loadShortcuts', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
    resetShortcutsMemo();
  });

  it('is empty when the database is unconfigured, errors, or holds no rows', async () => {
    configured = false;
    expect(await loadShortcuts()).toEqual({});
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadShortcuts()).toEqual({});
    result = { data: [], error: null };
    expect(await loadShortcuts()).toEqual({});
  });

  it('reads the rows, keeps the answer for a minute, and forgets it on reset', async () => {
    result = { data: seeded, error: null };
    expect(Object.keys(await loadShortcuts())).toHaveLength(3);
    result = { data: [], error: null };
    expect(Object.keys(await loadShortcuts())).toHaveLength(3);
    resetShortcutsMemo();
    expect(await loadShortcuts()).toEqual({});
  });
});

describe('loadShortcutsForEditing', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
  });

  it('is null when unconfigured or on an error, and empty when there are no rows', async () => {
    configured = false;
    expect(await loadShortcutsForEditing()).toBeNull();
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadShortcutsForEditing()).toBeNull();
    result = { data: [], error: null };
    expect(await loadShortcutsForEditing()).toEqual([]);
  });

  it('returns usable rows by key with their stamps as sent, leaving out what it cannot use', async () => {
    result = { data: [...seeded, { key: 'Bad', text: 'x', updated_at: STAMP }, { key: 'nostamp', text: 'x', updated_at: null }], error: null };
    const rows = await loadShortcutsForEditing();
    expect(rows?.map(r => r.key)).toEqual(['data.sources', 'times.local', 'wire.linked_out']);
    expect(rows?.[0].updatedAt).toBe(STAMP);
  });
});
