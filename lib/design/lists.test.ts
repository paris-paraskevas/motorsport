import { beforeEach, describe, expect, it, vi } from 'vitest';

// A fake list_entry / list table. `entryRows` answers the shell's one query and
// the editor's entries query; `listRow` answers the editor's list query.
let configured = true;
let entryRows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let listRow: { data: unknown; error: { message: string } | null } = { data: null, error: null };
// The row pages a page: destination may name (P1.12 B1); `.is('deleted_at', null)` keeps the live ones.
let pageRows: { data: { id: string; path: string; name: string; deleted_at?: string | null }[]; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => {
      let liveOnly = false;
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        is: (col: string, v: unknown) => {
          if (col === 'deleted_at' && v === null) liveOnly = true;
          return q;
        },
        maybeSingle: async () => (table === 'list' ? listRow : entryRows),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
          const result =
            table === 'list' ? listRow : table === 'page' ? { ...pageRows, data: liveOnly ? pageRows.data.filter(r => r.deleted_at == null) : pageRows.data } : entryRows;
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return q;
    },
  }),
}));

import {
  BAR_MAX,
  BAR_MIN,
  DEFAULT_NAV,
  loadListForEditing,
  loadNavLists,
  parseEntries,
  resetNavListsMemo,
} from './lists';
import { pageDest } from './destinations';

const MONZA = 'a1b2c3d4-0000-4000-8000-000000000010';
const IMOLA = 'a1b2c3d4-0000-4000-8000-000000000021';
const monzaRow = { id: MONZA, path: '/history/monza', name: 'Monza, a history', deleted_at: null };
const imolaRow = { id: IMOLA, path: '/history/imola', name: 'Imola', deleted_at: '2026-09-13T10:00:00+00:00' };

describe('page destinations in the lists (P1.12 B1)', () => {
  beforeEach(() => {
    configured = true;
    resetNavListsMemo();
    pageRows = { data: [monzaRow, imolaRow], error: null };
    listRow = { data: null, error: null };
    entryRows = { data: [], error: null };
  });

  it('parseEntries resolves a page key against the map it is given, carrying the page’s path as the entry’s href, and drops one the map lacks', () => {
    const pages = { [MONZA]: { path: '/history/monza', name: 'Monza, a history' } };
    expect(parseEntries([{ label: 'Monza', dest_key: pageDest(MONZA) }, { label: 'Gone', dest_key: pageDest(IMOLA) }, { label: 'Learn', dest_key: 'learn' }], 'menu', pages)).toEqual([
      { label: 'Monza', dest: pageDest(MONZA), href: '/history/monza' },
      { label: 'Learn', dest: 'learn' },
    ]);
    expect(parseEntries([{ label: 'Monza', dest_key: pageDest(MONZA) }], 'menu')).toBeNull();
  });

  it('the shell’s lists resolve page entries against the LIVE row pages: a deleted page’s entry is left out while it is deleted', async () => {
    entryRows = {
      data: [
        { list_key: 'footer-site', seq: 10, label: 'Monza', dest_key: pageDest(MONZA) },
        { list_key: 'footer-site', seq: 20, label: 'Imola', dest_key: pageDest(IMOLA) },
        { list_key: 'footer-site', seq: 30, label: 'About', dest_key: 'about' },
      ],
      error: null,
    };
    const nav = await loadNavLists();
    expect(nav.footerSite).toEqual([
      { label: 'Monza', dest: pageDest(MONZA), href: '/history/monza' },
      { label: 'About', dest: 'about' },
    ]);
  });

  it('the editor’s read keeps a deleted page’s entry, with its href, so the editor can show its state and offer Remove', async () => {
    listRow = { data: { key: 'footer-site', role: 'footer', label: 'Footer: Site', updated_at: '2026-09-08T06:34:16.728382+00:00' }, error: null };
    entryRows = { data: [{ seq: 10, label: 'Imola', dest_key: pageDest(IMOLA) }, { seq: 20, label: 'About', dest_key: 'about' }], error: null };
    const list = await loadListForEditing('footer-site');
    expect(list?.entries).toEqual([
      { label: 'Imola', dest: pageDest(IMOLA), href: '/history/imola' },
      { label: 'About', dest: 'about' },
    ]);
  });
});

describe('parseEntries — fail-soft matrix', () => {
  it('maps rows, keeping icon and authz when present', () => {
    const out = parseEntries(
      [
        { label: 'Home', dest_key: 'home', icon: 'house' },
        { label: ' Calendar ', dest_key: 'calendar', authz_key: 'signed_in' },
      ],
      'bar',
    );
    expect(out).toBeNull(); // two entries: below the bar's minimum
    const menu = parseEntries(
      [
        { label: 'Home', dest_key: 'home', icon: 'house' },
        { label: ' Calendar ', dest_key: 'calendar', authz_key: 'signed_in' },
      ],
      'menu',
    );
    expect(menu).toEqual([
      { label: 'Home', dest: 'home', icon: 'house' },
      { label: 'Calendar', dest: 'calendar', authz: 'signed_in' },
    ]);
  });

  it('drops a row with no label or an unknown destination, and returns null when nothing is left', () => {
    expect(parseEntries([{ label: '', dest_key: 'home' }, { label: 'X', dest_key: 'https://evil' }], 'menu')).toBeNull();
    expect(parseEntries([{ label: 'X', dest_key: 'nope' }, { label: 'Learn', dest_key: 'learn' }], 'menu')).toEqual([
      { label: 'Learn', dest: 'learn' },
    ]);
  });

  it('is null for anything that is not an array, and for an empty array', () => {
    expect(parseEntries(null, 'menu')).toBeNull();
    expect(parseEntries({ label: 'x' }, 'menu')).toBeNull();
    expect(parseEntries([], 'footer')).toBeNull();
  });

  it(`holds the phone bar to ${BAR_MIN}..${BAR_MAX} cells`, () => {
    const cell = (n: number) => ({ label: `L${n}`, dest_key: 'calendar' });
    expect(parseEntries([cell(1), cell(2)], 'bar')).toBeNull();
    expect(parseEntries([cell(1), cell(2), cell(3)], 'bar')).toHaveLength(3);
    expect(parseEntries([1, 2, 3, 4, 5].map(cell), 'bar')).toHaveLength(5);
    expect(parseEntries([1, 2, 3, 4, 5, 6].map(cell), 'bar')).toBeNull();
  });
});

describe('loadNavLists — the code is the fallback', () => {
  beforeEach(() => {
    configured = true;
    entryRows = { data: [], error: null };
    listRow = { data: null, error: null };
    resetNavListsMemo();
  });

  it('is the default when the database is not configured', async () => {
    configured = false;
    expect(await loadNavLists()).toEqual(DEFAULT_NAV);
  });

  it('is the default on a query error', async () => {
    entryRows = { data: null, error: { message: 'boom' } };
    expect(await loadNavLists()).toEqual(DEFAULT_NAV);
  });

  it('is the default when the tables are empty', async () => {
    expect(await loadNavLists()).toEqual(DEFAULT_NAV);
  });

  it('takes a usable list from rows and falls back list by list for the rest', async () => {
    entryRows = {
      data: [
        { list_key: 'doors', seq: 10, label: 'Races', dest_key: 'calendar' },
        { list_key: 'doors', seq: 20, label: 'Learn', dest_key: 'learn' },
        // A bar with two cells is unusable: the default bar stays.
        { list_key: 'bar', seq: 10, label: 'Home', dest_key: 'home', icon: 'house' },
        { list_key: 'bar', seq: 20, label: 'Learn', dest_key: 'learn', icon: 'compass' },
        // A row pointing outside the catalogue is dropped, the rest of its list survives.
        { list_key: 'footer-legal', seq: 10, label: 'Evil', dest_key: 'https://evil.example' },
        { list_key: 'footer-legal', seq: 20, label: 'Privacy', dest_key: 'privacy' },
      ],
      error: null,
    };
    const nav = await loadNavLists();
    expect(nav.doors).toEqual([
      { label: 'Races', dest: 'calendar' },
      { label: 'Learn', dest: 'learn' },
    ]);
    expect(nav.bar).toEqual(DEFAULT_NAV.bar);
    expect(nav.footerSite).toEqual(DEFAULT_NAV.footerSite);
    expect(nav.footerLegal).toEqual([{ label: 'Privacy', dest: 'privacy' }]);
  });

  it('memoises for a minute and forgets on reset', async () => {
    entryRows = { data: [{ list_key: 'doors', seq: 10, label: 'One', dest_key: 'blog' }], error: null };
    expect((await loadNavLists()).doors).toEqual([{ label: 'One', dest: 'blog' }]);
    entryRows = { data: [{ list_key: 'doors', seq: 10, label: 'Two', dest_key: 'news' }], error: null };
    expect((await loadNavLists()).doors).toEqual([{ label: 'One', dest: 'blog' }]);
    resetNavListsMemo();
    expect((await loadNavLists()).doors).toEqual([{ label: 'Two', dest: 'news' }]);
  });
});

describe('loadListForEditing', () => {
  beforeEach(() => {
    configured = true;
    entryRows = { data: [], error: null };
    listRow = { data: null, error: null };
  });

  it('is null for a list that does not exist, or when unconfigured', async () => {
    expect(await loadListForEditing('nope')).toBeNull();
    configured = false;
    expect(await loadListForEditing('doors')).toBeNull();
  });

  it('returns the stamp verbatim and the entries leniently, even a two-cell bar', async () => {
    listRow = { data: { key: 'bar', role: 'bar', label: 'Phone bar', updated_at: '2026-09-08T06:34:16.728382+00:00' }, error: null };
    entryRows = {
      data: [
        { seq: 10, label: 'Home', dest_key: 'home', icon: 'house' },
        { seq: 20, label: 'Learn', dest_key: 'learn', icon: 'compass' },
      ],
      error: null,
    };
    const list = await loadListForEditing('bar');
    expect(list).toMatchObject({ key: 'bar', role: 'bar', updatedAt: '2026-09-08T06:34:16.728382+00:00' });
    expect(list?.entries).toHaveLength(2);
  });
});

describe('lists of the operator’s own', () => {
  beforeEach(() => {
    configured = true;
    listRow = { data: [], error: null };
    entryRows = { data: [], error: null };
  });

  it('names the key rule and the label rule, keeping the shell’s keys', async () => {
    const { listKeyProblem, listLabelProblem, LIST_KEY_MAX } = await import('./lists');
    expect(listKeyProblem('useful-links')).toBeNull();
    expect(listKeyProblem('')).toMatch(/needed/);
    expect(listKeyProblem('Useful')).toMatch(/lower-case/);
    expect(listKeyProblem('-x')).toMatch(/lower-case/);
    expect(listKeyProblem('a'.repeat(LIST_KEY_MAX + 1))).toMatch(/at most/);
    expect(listKeyProblem('doors')).toMatch(/shell/);
    expect(listLabelProblem('  ')).toMatch(/needed/);
    expect(listLabelProblem('x'.repeat(61))).toMatch(/at most/);
    expect(listLabelProblem(' Useful links ')).toBeNull();
  });

  it('reads every list with its entry count, and is null when unconfigured or on an error', async () => {
    const { loadListsForEditing } = await import('./lists');
    configured = false;
    expect(await loadListsForEditing()).toBeNull();
    configured = true;
    listRow = { data: null, error: { message: 'down' } };
    expect(await loadListsForEditing()).toBeNull();
    listRow = {
      data: [
        { key: 'doors', role: 'menu', label: 'Navigation Menu', updated_at: '2026-09-08T06:34:16.728382+00:00' },
        { key: 'useful-links', role: 'generic', label: 'Useful links', updated_at: '2026-09-09T02:00:00+00:00' },
      ],
      error: null,
    };
    entryRows = { data: [{ list_key: 'doors' }, { list_key: 'doors' }, { list_key: 'useful-links' }], error: null };
    expect(await loadListsForEditing()).toEqual([
      { key: 'doors', role: 'menu', label: 'Navigation Menu', updatedAt: '2026-09-08T06:34:16.728382+00:00', entries: 2 },
      { key: 'useful-links', role: 'generic', label: 'Useful links', updatedAt: '2026-09-09T02:00:00+00:00', entries: 1 },
    ]);
  });

  it('hands a document the shell’s lists from the set it was given and reads the operator’s own, an unknown key empty, without a query when none is its own', async () => {
    const { loadDocumentLists } = await import('./lists');
    entryRows = { data: null, error: { message: 'must not be asked' } };
    expect(await loadDocumentLists(['doors', 'bar'], DEFAULT_NAV)).toEqual({ doors: DEFAULT_NAV.doors, bar: DEFAULT_NAV.bar });
    entryRows = {
      data: [
        { list_key: 'useful-links', seq: 10, label: 'Calendar', dest_key: 'calendar' },
        { list_key: 'useful-links', seq: 20, label: 'Nowhere', dest_key: 'https://evil' },
        { list_key: 'useful-links', seq: 30, label: 'Blog', dest_key: 'blog', authz_key: 'signed_in' },
      ],
      error: null,
    };
    expect(await loadDocumentLists(['footer-site', 'useful-links', 'ghost', 'useful-links'], DEFAULT_NAV)).toEqual({
      'footer-site': DEFAULT_NAV.footerSite,
      'useful-links': [
        { label: 'Calendar', dest: 'calendar' },
        { label: 'Blog', dest: 'blog', authz: 'signed_in' },
      ],
      ghost: [],
    });
    configured = false;
    expect(await loadDocumentLists(['useful-links'], DEFAULT_NAV)).toEqual({ 'useful-links': [] });
  });
});
