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
  DEFAULT_SETTINGS,
  loadSettings,
  loadSettingsForEditing,
  parseSettingValue,
  resetSettingsMemo,
  serialiseSettingValue,
  settingsFromRows,
} from './settings';
import { currentWhatsNew, WHATS_NEW } from '@/lib/whats-new';

const STAMP = '2026-09-08T09:40:12.505502+00:00';

describe('parseSettingValue — one rule for the loader and the write route', () => {
  it('accepts the column text and the typed value alike', () => {
    expect(parseSettingValue('home.wire_count', '7')).toBe(7);
    expect(parseSettingValue('home.wire_count', 7)).toBe(7);
    expect(parseSettingValue('home.major_series', '["wec","motogp"]')).toEqual(['wec', 'motogp']);
    expect(parseSettingValue('home.major_series', ['wec', 'motogp', 'wec'])).toEqual(['wec', 'motogp']);
    expect(parseSettingValue('home.lead_series', ' f1 ')).toBe('f1');
    expect(parseSettingValue('announcement.active_id', '')).toBe('');
    expect(parseSettingValue('announcement.active_id', 'v1.0')).toBe('v1.0');
  });

  it('refuses what breaks the key’s rule', () => {
    expect(parseSettingValue('home.wire_count', 0)).toBeUndefined();
    expect(parseSettingValue('home.wire_count', 16)).toBeUndefined();
    expect(parseSettingValue('home.wire_count', 2.5)).toBeUndefined();
    expect(parseSettingValue('home.wire_count', 'five')).toBeUndefined();
    expect(parseSettingValue('home.blog_suggested_count', -1)).toBeUndefined();
    expect(parseSettingValue('home.major_series', 'not json')).toBeUndefined();
    expect(parseSettingValue('home.major_series', ['wec', 42])).toBeUndefined();
    expect(parseSettingValue('home.major_series', ['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBeUndefined();
    expect(parseSettingValue('home.lead_series', 'F1!')).toBeUndefined();
    expect(parseSettingValue('home.lead_series', '')).toBeUndefined();
    expect(parseSettingValue('announcement.active_id', 'v9.9')).toBeUndefined();
    expect(parseSettingValue('announcement.active_id', 42)).toBeUndefined();
  });

  it('checks series against the known slugs when the server hands them over', () => {
    const known = { seriesSlugs: ['f1', 'wec'] };
    expect(parseSettingValue('home.lead_series', 'f1', known)).toBe('f1');
    expect(parseSettingValue('home.lead_series', 'dtm', known)).toBeUndefined();
    expect(parseSettingValue('home.major_series', ['wec', 'dtm'], known)).toBeUndefined();
  });

  it('serialises json settings as JSON text and the rest as plain text', () => {
    expect(serialiseSettingValue('home.major_series', ['wec', 'motogp'])).toBe('["wec","motogp"]');
    expect(serialiseSettingValue('home.wire_count', 7)).toBe('7');
    expect(serialiseSettingValue('announcement.active_id', '')).toBe('');
  });
});

describe('settingsFromRows — the shipped value is the fallback', () => {
  it('takes usable rows and keeps the shipped value for the rest', () => {
    const out = settingsFromRows([
      { key: 'home.wire_count', value: '9' },
      { key: 'home.major_series', value: '["wec"]' },
      { key: 'home.blog_suggested_count', value: '99' },
      { key: 'announcement.active_id', value: 'v9.9' },
      { key: 'not.a.key', value: 'x' },
      null,
    ]);
    expect(out['home.wire_count']).toBe(9);
    expect(out['home.major_series']).toEqual(['wec']);
    expect(out['home.blog_suggested_count']).toBe(3);
    expect(out['announcement.active_id']).toBe('v1.0');
    expect(out['home.lead_series']).toBe('f1');
  });

  it('is the shipped set for anything that is not an array, and the shipped set matches the code', () => {
    expect(settingsFromRows(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      'home.lead_series': 'f1',
      'home.major_series': ['motogp', 'wec', 'indycar', 'nascar-cup'],
      'home.wire_count': 5,
      'home.blog_suggested_count': 3,
      'announcement.active_id': 'v1.0',
    });
  });
});

describe('loadSettings', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
    resetSettingsMemo();
  });

  it('is the shipped set when unconfigured, on error, and on an empty table', async () => {
    configured = false;
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    result = { data: [], error: null };
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('reads rows, memoises for a minute, forgets on reset', async () => {
    result = { data: [{ key: 'home.wire_count', value: '8' }], error: null };
    expect((await loadSettings())['home.wire_count']).toBe(8);
    result = { data: [{ key: 'home.wire_count', value: '2' }], error: null };
    expect((await loadSettings())['home.wire_count']).toBe(8);
    resetSettingsMemo();
    expect((await loadSettings())['home.wire_count']).toBe(2);
  });
});

describe('loadSettingsForEditing', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
  });

  it('lists every key in order; a present row carries its parsed value, description and stamp, a missing row the shipped value with no stamp', async () => {
    result = {
      data: [
        { key: 'home.major_series', value: '["wec"]', description: 'Boxes.', updated_at: STAMP },
        { key: 'home.wire_count', value: 'nine', description: null, updated_at: STAMP },
      ],
      error: null,
    };
    const rows = await loadSettingsForEditing();
    expect(rows).not.toBeNull();
    expect(rows!.map(r => r.key)).toEqual([
      'home.lead_series',
      'home.major_series',
      'home.wire_count',
      'home.blog_suggested_count',
      'announcement.active_id',
    ]);
    expect(rows!.find(r => r.key === 'home.major_series')).toEqual({
      key: 'home.major_series',
      value: ['wec'],
      description: 'Boxes.',
      updatedAt: STAMP,
    });
    const wire = rows!.find(r => r.key === 'home.wire_count')!;
    expect(wire.value).toBe(5); // an unusable row shows what the site reads
    expect(wire.description).toContain('headlines');
    expect(wire.updatedAt).toBe(STAMP);
    const lead = rows!.find(r => r.key === 'home.lead_series')!;
    expect(lead).toEqual({
      key: 'home.lead_series',
      value: 'f1',
      description: SETTING_DESCRIPTION_LEAD,
      updatedAt: null,
    });
  });

  it('is null when unconfigured or on error', async () => {
    configured = false;
    expect(await loadSettingsForEditing()).toBeNull();
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadSettingsForEditing()).toBeNull();
  });
});

const SETTING_DESCRIPTION_LEAD =
  'The championship that always leads the live band on the home page when it is running.';

describe('the announcement setting reaches currentWhatsNew', () => {
  it('with no argument keeps the shipped behaviour, the entry flagged active', () => {
    expect(currentWhatsNew()?.id).toBe(WHATS_NEW.find(e => e.active)?.id);
  });

  it('empty hides the notice, a known id shows that entry, an unknown id shows nothing', () => {
    expect(currentWhatsNew('')).toBeNull();
    expect(currentWhatsNew('v1.0')?.id).toBe('v1.0');
    expect(currentWhatsNew('v9.9')).toBeNull();
  });
});
