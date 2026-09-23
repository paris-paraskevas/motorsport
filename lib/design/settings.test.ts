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
    expect(parseSettingValue('home.major_series', '["wec","motogp"]')).toEqual(['wec', 'motogp']);
    expect(parseSettingValue('home.major_series', ['wec', 'motogp', 'wec'])).toEqual(['wec', 'motogp']);
    expect(parseSettingValue('home.lead_series', ' f1 ')).toBe('f1');
    expect(parseSettingValue('announcement.active_id', '')).toBe('');
    expect(parseSettingValue('announcement.active_id', 'v1.0')).toBe('v1.0');
  });

  it('refuses what breaks the key’s rule', () => {
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
    expect(serialiseSettingValue('announcement.active_id', '')).toBe('');
  });
});

describe('settingsFromRows — the shipped value is the fallback', () => {
  it('takes usable rows and keeps the shipped value for the rest', () => {
    const out = settingsFromRows([
      { key: 'home.major_series', value: '["wec"]' },
      { key: 'home.lead_series', value: 'F1!' },
      { key: 'announcement.active_id', value: 'v9.9' },
      { key: 'region.button.label', value: 'Open' },
      // P2.24 C: the two retired count rows, still seeded in the table, are skipped like any unknown key.
      { key: 'home.wire_count', value: '9' },
      { key: 'home.blog_suggested_count', value: '6' },
      { key: 'not.a.key', value: 'x' },
      null,
    ]);
    expect(out['home.major_series']).toEqual(['wec']);
    expect(out['region.button.label']).toBe('Open');
    expect(out['announcement.active_id']).toBe('v1.0');
    expect(out['home.lead_series']).toBe('f1');
    expect(Object.keys(out)).not.toContain('home.wire_count');
  });

  it('is the shipped set for anything that is not an array, and the shipped set matches the code', () => {
    expect(settingsFromRows(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({
      'home.lead_series': 'f1',
      'home.major_series': ['motogp', 'wec', 'indycar', 'nascar-cup'],
      'announcement.active_id': 'v1.0',
      'region.image.show_caption': true,
      'region.list.style': 'links',
      'region.button.label': 'Read more',
      'region.static.template': 'standard',
      'region.image.template': 'standard',
      'region.list.template': 'standard',
      'region.button.template': 'standard',
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
    result = { data: [{ key: 'home.lead_series', value: 'motogp' }], error: null };
    expect((await loadSettings())['home.lead_series']).toBe('motogp');
    result = { data: [{ key: 'home.lead_series', value: 'wec' }], error: null };
    expect((await loadSettings())['home.lead_series']).toBe('motogp');
    resetSettingsMemo();
    expect((await loadSettings())['home.lead_series']).toBe('wec');
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
        { key: 'announcement.active_id', value: 'v9.9', description: null, updated_at: STAMP },
      ],
      error: null,
    };
    const rows = await loadSettingsForEditing();
    expect(rows).not.toBeNull();
    expect(rows!.map(r => r.key)).toEqual([
      'home.lead_series',
      'home.major_series',
      'announcement.active_id',
      'region.image.show_caption',
      'region.list.style',
      'region.button.label',
      'region.static.template',
      'region.image.template',
      'region.list.template',
      'region.button.template',
    ]);
    expect(rows!.find(r => r.key === 'home.major_series')).toEqual({
      key: 'home.major_series',
      value: ['wec'],
      description: 'Boxes.',
      updatedAt: STAMP,
    });
    const notice = rows!.find(r => r.key === 'announcement.active_id')!;
    expect(notice.value).toBe('v1.0'); // an unusable row shows what the site reads
    expect(notice.description).toContain('notice');
    expect(notice.updatedAt).toBe(STAMP);
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

describe('Component Settings — the region defaults', () => {
  it('parses the template a new region starts with (P1.1): one of the five looks, Plain shipped, anything else refused', () => {
    expect(parseSettingValue('region.static.template', 'boxed')).toBe('boxed');
    expect(parseSettingValue('region.list.template', ' hero ')).toBe('hero');
    expect(parseSettingValue('region.image.template', 'nope')).toBeUndefined();
    expect(parseSettingValue('region.button.template', 3)).toBeUndefined();
    expect(serialiseSettingValue('region.static.template', 'band')).toBe('band');
    expect(DEFAULT_SETTINGS['region.static.template']).toBe('standard');
    expect(DEFAULT_SETTINGS['region.button.template']).toBe('standard');
  });

  it('parses yes/no, a choice and a short text from the column and from the editor alike, refusing the rest', () => {
    expect(parseSettingValue('region.image.show_caption', 'true')).toBe(true);
    expect(parseSettingValue('region.image.show_caption', false)).toBe(false);
    expect(parseSettingValue('region.image.show_caption', 'yes')).toBeUndefined();
    expect(parseSettingValue('region.list.style', 'cards')).toBe('cards');
    expect(parseSettingValue('region.list.style', ' links ')).toBe('links');
    expect(parseSettingValue('region.list.style', 'tiles')).toBeUndefined();
    expect(parseSettingValue('region.button.label', ' Read on ')).toBe('Read on');
    expect(parseSettingValue('region.button.label', '   ')).toBeUndefined();
    expect(parseSettingValue('region.button.label', 'x'.repeat(41))).toBeUndefined();
    expect(serialiseSettingValue('region.image.show_caption', false)).toBe('false');
    expect(DEFAULT_SETTINGS['region.image.show_caption']).toBe(true);
    expect(DEFAULT_SETTINGS['region.list.style']).toBe('links');
    expect(DEFAULT_SETTINGS['region.button.label']).toBe('Read more');
  });

  it('separates the component keys from the application keys, together the whole set', async () => {
    const { APPLICATION_SETTING_KEYS, COMPONENT_SETTING_KEYS, SETTING_KEYS } = await import('./setting-defaults');
    expect([...COMPONENT_SETTING_KEYS]).toEqual([
      'region.image.show_caption',
      'region.list.style',
      'region.button.label',
      'region.static.template',
      'region.image.template',
      'region.list.template',
      'region.button.template',
    ]);
    expect([...APPLICATION_SETTING_KEYS, ...COMPONENT_SETTING_KEYS].sort()).toEqual([...SETTING_KEYS].sort());
  });
});
