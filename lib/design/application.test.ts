import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The application definition: the parse rule, the row mapping both ways, the
// loader's four failure paths and its memo.

let configured = true;
let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const from = vi.fn();
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: (table: string) => {
      from(table);
      const q: Record<string, unknown> = {};
      Object.assign(q, {
        select: () => q,
        eq: () => q,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
      });
      return q;
    },
  }),
}));

import { DEFAULT_DEFINITION, definitionFromRow, definitionToRow, parseDefinition } from './application-defaults';
import { loadApplicationDefinition, loadApplicationForEditing, resetApplicationMemo } from './application';

const STAMP = '2026-09-08T15:30:00.505502+00:00';
const row = {
  key: 'paddock',
  name: 'Paddock Tracker',
  alias: 'paddock',
  availability: 'available',
  home_path: '/',
  description: null,
  wordmark: null,
  tagline: null,
  date_chip: true,
  install_prompt: true,
  favicon_asset_id: null,
  updated_at: STAMP,
};

beforeEach(() => {
  configured = true;
  rows = { data: [row], error: null };
  from.mockReset();
  resetApplicationMemo();
});
afterEach(() => resetApplicationMemo());

describe('parseDefinition', () => {
  it('reads the defaults from an empty object and keeps a full definition', () => {
    expect(parseDefinition({}).value).toEqual(DEFAULT_DEFINITION);
    const full = { ...DEFAULT_DEFINITION, name: 'Paddock', availability: 'maintenance', wordmark: 'Paddock', dateChip: false, installPrompt: false, description: 'The site.' };
    expect(parseDefinition(full)).toEqual({ value: full, problems: [] });
  });

  it('names what is wrong and still answers a usable definition', () => {
    const r = parseDefinition({ name: ' ', availability: 'closed', wordmark: 'x'.repeat(40), tagline: 42 });
    expect(r.problems).toEqual(['the application needs a name', 'availability must be available or maintenance', 'the wordmark is at most 32 characters', 'the tagline must be text']);
    expect(r.value.name).toBe('Paddock Tracker');
    expect(r.value.availability).toBe('available');
    expect(r.value.wordmark).toHaveLength(32);
    expect(parseDefinition('no').problems).toEqual(['the definition must be an object']);
  });

  it('maps the row both ways, never writing the alias or the home path', () => {
    const d = definitionFromRow({ ...row, wordmark: 'Paddock', date_chip: false });
    expect(d).toMatchObject({ name: 'Paddock Tracker', alias: 'paddock', wordmark: 'Paddock', dateChip: false, installPrompt: true, homePath: '/' });
    const written = definitionToRow(d);
    expect(written).toEqual({ name: 'Paddock Tracker', availability: 'available', description: null, wordmark: 'Paddock', tagline: null, date_chip: false, install_prompt: true, favicon_asset_id: null });
    expect('alias' in written).toBe(false);
  });
});

describe('loadApplicationDefinition', () => {
  it('reads the row once a minute; the defaults when unconfigured, on an error, or with no row', async () => {
    expect(await loadApplicationDefinition()).toEqual(DEFAULT_DEFINITION);
    rows = { data: [{ ...row, wordmark: 'Paddock' }], error: null };
    expect((await loadApplicationDefinition()).wordmark).toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    resetApplicationMemo();
    expect((await loadApplicationDefinition()).wordmark).toBe('Paddock');
    configured = false;
    resetApplicationMemo();
    expect(await loadApplicationDefinition()).toEqual(DEFAULT_DEFINITION);
    configured = true;
    rows = { data: null, error: { message: 'down' } };
    expect(await loadApplicationDefinition()).toEqual(DEFAULT_DEFINITION);
    rows = { data: [], error: null };
    expect(await loadApplicationDefinition()).toEqual(DEFAULT_DEFINITION);
  });

  it('the editing view carries the stamp exactly, and is null without a row', async () => {
    expect(await loadApplicationForEditing()).toEqual({ definition: DEFAULT_DEFINITION, updatedAt: STAMP });
    rows = { data: [], error: null };
    expect(await loadApplicationForEditing()).toBeNull();
  });
});
