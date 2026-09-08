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
  DEFAULT_BUILD_OPTIONS,
  buildOptionsFromRows,
  isBuildOptionIncluded,
  loadBuildOptions,
  loadBuildOptionsForEditing,
  resetBuildOptionsMemo,
} from './build-options';

describe('buildOptionsFromRows — Include is the fallback', () => {
  it('takes include and exclude rows and keeps Include for the rest', () => {
    const out = buildOptionsFromRows([
      { key: 'weather', status: 'exclude' },
      { key: 'ghost_lap_3d', status: 'include' },
      { key: 'social', status: 'off' },
      { key: 'studio', status: null },
      { key: 'not_a_key', status: 'exclude' },
      null,
    ]);
    expect(out).toEqual({ ghost_lap_3d: 'include', weather: 'exclude', social: 'include', studio: 'include' });
  });

  it('is Include everywhere for anything that is not an array', () => {
    expect(buildOptionsFromRows(null)).toEqual(DEFAULT_BUILD_OPTIONS);
    expect(buildOptionsFromRows({ key: 'weather', status: 'exclude' })).toEqual(DEFAULT_BUILD_OPTIONS);
    expect(DEFAULT_BUILD_OPTIONS).toEqual({ ghost_lap_3d: 'include', weather: 'include', social: 'include', studio: 'include' });
  });
});

describe('loadBuildOptions and isBuildOptionIncluded', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
    resetBuildOptionsMemo();
  });

  it('is Include everywhere when unconfigured, on error, and on an empty table', async () => {
    configured = false;
    expect(await loadBuildOptions()).toEqual(DEFAULT_BUILD_OPTIONS);
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadBuildOptions()).toEqual(DEFAULT_BUILD_OPTIONS);
    result = { data: [], error: null };
    expect(await loadBuildOptions()).toEqual(DEFAULT_BUILD_OPTIONS);
    expect(await isBuildOptionIncluded('weather')).toBe(true);
  });

  it('reads rows, memoises for a minute, forgets on reset', async () => {
    result = { data: [{ key: 'weather', status: 'exclude' }], error: null };
    expect(await isBuildOptionIncluded('weather')).toBe(false);
    expect(await isBuildOptionIncluded('ghost_lap_3d')).toBe(true);
    result = { data: [{ key: 'weather', status: 'include' }], error: null };
    expect(await isBuildOptionIncluded('weather')).toBe(false);
    resetBuildOptionsMemo();
    expect(await isBuildOptionIncluded('weather')).toBe(true);
  });
});

describe('loadBuildOptionsForEditing', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
  });

  it('lists every key in catalogue order; a present row carries its label, status and stamp verbatim, a missing row shows Include with no stamp', async () => {
    result = {
      data: [{ key: 'weather', label: 'Weather', status: 'exclude', updated_at: '2026-09-08T07:25:42.505502+00:00' }],
      error: null,
    };
    const rows = await loadBuildOptionsForEditing();
    expect(rows).not.toBeNull();
    expect(rows!.map(r => r.key)).toEqual(['ghost_lap_3d', 'weather', 'social', 'studio']);
    expect(rows!.find(r => r.key === 'weather')).toEqual({
      key: 'weather',
      label: 'Weather',
      status: 'exclude',
      updatedAt: '2026-09-08T07:25:42.505502+00:00',
    });
    expect(rows!.find(r => r.key === 'ghost_lap_3d')).toEqual({
      key: 'ghost_lap_3d',
      label: 'Ghost lap 3D',
      status: 'include',
      updatedAt: null,
    });
  });

  it('is null when unconfigured or on error', async () => {
    configured = false;
    expect(await loadBuildOptionsForEditing()).toBeNull();
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadBuildOptionsForEditing()).toBeNull();
  });
});
