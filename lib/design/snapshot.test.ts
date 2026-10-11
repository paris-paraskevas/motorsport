import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The design snapshot (PF5): one read of the application row with the design
// tables embedded, shared by the loaders that ask at the same time, kept for a
// minute per isolate, never kept when it fails, and dropped by a save.

let configured = true;
let answer: { data: unknown; error: { message: string } | null } = { data: [], error: null };
/** Each read's steps, as [method, ...args]. */
const reads: unknown[][][] = [];
/** When set, a read waits for this before it answers. */
let gate: Promise<void> | null = null;
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => {
      const steps: unknown[][] = [['from', table]];
      reads.push(steps);
      const at = answer;
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'is', 'order']) {
        q[m] = (...args: unknown[]) => {
          steps.push([m, ...args]);
          return q;
        };
      }
      q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        (gate ?? Promise.resolve()).then(() => at).then(resolve, reject);
      return q;
    },
  }),
}));

import { SNAPSHOT_SELECT, loadDesignSnapshot, resetDesignSnapshot } from './snapshot';
import { loadTextMessages, DEFAULT_TEXT } from './text';
import { loadSettings, DEFAULT_SETTINGS } from './settings';
import { loadThemeSet } from './themes';
import { loadNavLists, DEFAULT_NAV } from './lists';
import { loadPageFrame } from './page-frame';
import { PAGE_COLUMNS } from './pages';

const row = (over: Record<string, unknown> = {}) => ({ key: 'paddock', name: 'Paddock Tracker', ui: null, ...over });

beforeEach(() => {
  configured = true;
  answer = { data: [row()], error: null };
  reads.length = 0;
  gate = null;
  resetDesignSnapshot();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('loadDesignSnapshot', () => {
  it('is one read: the application row with the pages still live and the list entries by seq', async () => {
    expect(await loadDesignSnapshot()).toEqual(row());
    expect(reads).toEqual([
      [
        ['from', 'application'],
        ['select', SNAPSHOT_SELECT],
        ['eq', 'key', 'paddock'],
        ['is', 'page.deleted_at', null],
        ['order', 'seq', { referencedTable: 'list_entry', ascending: true }],
      ],
    ]);
  });

  it('carries the columns each loader’s parser reads', () => {
    for (const part of [
      'key, name, alias, availability, home_path, description, wordmark, tagline, date_chip, install_prompt, favicon_asset_id, updated_at, ui',
      'text_message(key, text)',
      'setting(key, value)',
      'theme(key, label, tokens, is_default, available, base)',
      'authz_scheme(key, label, type, value, message)',
      'search_hint(id, question, seq, leads_to, leads_title, updated_at)',
      'shortcut(key, text)',
      'build_option(key, status)',
      'component_definition(key, overlay, updated_at, updated_by)',
      'list_entry(list_key, seq, label, dest_key, icon, authz_key)',
      `page(${PAGE_COLUMNS})`,
    ]) {
      expect(SNAPSHOT_SELECT).toContain(part);
    }
  });

  it('gives the loaders that ask at the same time one read', async () => {
    await Promise.all([loadTextMessages(), loadSettings(), loadThemeSet(), loadNavLists(), loadPageFrame('/calendar')]);
    expect(reads).toHaveLength(1);
  });

  it('keeps the answer for a minute, and forgets it on reset', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    await loadDesignSnapshot();
    vi.setSystemTime(new Date('2026-10-10T12:00:59Z'));
    await loadDesignSnapshot();
    expect(reads).toHaveLength(1);
    vi.setSystemTime(new Date('2026-10-10T12:01:01Z'));
    await loadDesignSnapshot();
    expect(reads).toHaveLength(2);
    resetDesignSnapshot();
    await loadDesignSnapshot();
    expect(reads).toHaveLength(3);
  });

  it('is null, and kept by nobody, when unconfigured, on an error, or without the row; the loaders fall back to the code', async () => {
    configured = false;
    expect(await loadDesignSnapshot()).toBeNull();
    expect(reads).toHaveLength(0);
    configured = true;
    answer = { data: null, error: { message: 'down' } };
    expect(await loadDesignSnapshot()).toBeNull();
    expect(await loadTextMessages()).toEqual(DEFAULT_TEXT);
    answer = { data: [], error: null };
    expect(await loadDesignSnapshot()).toBeNull();
    expect(reads).toHaveLength(3);
    answer = { data: [row()], error: null };
    expect(await loadDesignSnapshot()).toEqual(row());
  });

  it('does not keep a read that was under way when a save reset it', async () => {
    let open!: () => void;
    gate = new Promise(resolve => (open = resolve));
    const before = loadDesignSnapshot();
    resetDesignSnapshot();
    answer = { data: [row({ name: 'After the save' })], error: null };
    const after = loadDesignSnapshot();
    open();
    expect(await before).toEqual(row());
    expect(await after).toEqual(row({ name: 'After the save' }));
    gate = null;
    expect(await loadDesignSnapshot()).toEqual(row({ name: 'After the save' }));
    expect(reads).toHaveLength(2);
  });
});

describe('the loaders read only what their old queries asked for', () => {
  it('rows the old filters left out change nothing: unknown keys, other lists’ entries, the other kind of page', async () => {
    answer = {
      data: [
        row({
          text_message: [{ key: 'not-a-text-key', text: 'Never shown' }],
          setting: [{ key: 'not-a-setting', value: 'x' }],
          list_entry: [{ list_key: 'f2-more', seq: 10, label: 'Not a nav list', dest_key: 'blog' }],
          page: [
            { id: 'c0de0000-0000-4000-8000-000000000002', path: '/calendar', name: 'Calendar', kind: 'code', authz_key: 'public', indexable: true },
            { id: 'a1b2c3d4-0000-4000-8000-000000000010', path: '/history/monza', name: 'Monza', kind: 'row', authz_key: 'public', indexable: true },
          ],
        }),
      ],
      error: null,
    };
    expect(await loadTextMessages()).toEqual(DEFAULT_TEXT);
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await loadNavLists()).toEqual(DEFAULT_NAV);
    expect(await loadPageFrame('/calendar')).toMatchObject({ name: 'Calendar' });
    expect(await loadPageFrame('/history/monza')).toBeNull();
  });
});
