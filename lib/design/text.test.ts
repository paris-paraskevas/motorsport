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

import { DEFAULT_TEXT, TEXT_MAX, loadTextForEditing, loadTextMessages, resetTextMemo, textFromRows } from './text';

describe('textFromRows — the shipped text is the fallback', () => {
  it('takes usable rows and keeps the default for the rest', () => {
    const out = textFromRows([
      { key: 'footer.site', text: ' Around the site ' },
      { key: 'footer.legal', text: '' },
      { key: 'nav.search', text: 'x'.repeat(TEXT_MAX + 1) },
      { key: 'not.a.key', text: 'ignored' },
      { key: 'footer.install', text: 42 },
      null,
    ]);
    expect(out['footer.site']).toBe('Around the site');
    expect(out['footer.legal']).toBe(DEFAULT_TEXT['footer.legal']);
    expect(out['nav.search']).toBe(DEFAULT_TEXT['nav.search']);
    expect(out['footer.install']).toBe(DEFAULT_TEXT['footer.install']);
    expect(out['a11y.skip']).toBe('Skip to content');
  });

  it('is the default for anything that is not an array', () => {
    expect(textFromRows(null)).toEqual(DEFAULT_TEXT);
    expect(textFromRows({ key: 'footer.site', text: 'x' })).toEqual(DEFAULT_TEXT);
  });
});

describe('loadTextMessages', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
    resetTextMemo();
  });

  it('is the default when unconfigured, on error, and on an empty table', async () => {
    configured = false;
    expect(await loadTextMessages()).toEqual(DEFAULT_TEXT);
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadTextMessages()).toEqual(DEFAULT_TEXT);
    result = { data: [], error: null };
    expect(await loadTextMessages()).toEqual(DEFAULT_TEXT);
  });

  it('reads rows, memoises for a minute, forgets on reset', async () => {
    result = { data: [{ key: 'footer.site', text: 'Around the site' }], error: null };
    expect((await loadTextMessages())['footer.site']).toBe('Around the site');
    result = { data: [{ key: 'footer.site', text: 'Elsewhere' }], error: null };
    expect((await loadTextMessages())['footer.site']).toBe('Around the site');
    resetTextMemo();
    expect((await loadTextMessages())['footer.site']).toBe('Elsewhere');
  });
});

describe('loadTextForEditing', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
  });

  it('lists every key; a missing row shows the default with no stamp, a present row its text and stamp verbatim', async () => {
    result = {
      data: [{ key: 'footer.site', text: 'Around the site', where_shown: 'Footer · heading', updated_at: '2026-09-08T07:25:42.505502+00:00' }],
      error: null,
    };
    const rows = await loadTextForEditing();
    expect(rows).not.toBeNull();
    expect(rows).toHaveLength(7);
    const site = rows!.find(r => r.key === 'footer.site')!;
    expect(site).toEqual({ key: 'footer.site', text: 'Around the site', where: 'Footer · heading', updatedAt: '2026-09-08T07:25:42.505502+00:00' });
    const skip = rows!.find(r => r.key === 'a11y.skip')!;
    expect(skip.text).toBe('Skip to content');
    expect(skip.updatedAt).toBeNull();
  });

  it('is null when unconfigured or on error', async () => {
    configured = false;
    expect(await loadTextForEditing()).toBeNull();
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadTextForEditing()).toBeNull();
  });
});
