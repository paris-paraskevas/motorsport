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
  DEFAULT_AUTHZ_SCHEMES,
  authzFromRows,
  authzOptions,
  describeAuthzCheck,
  loadAuthzForEditing,
  loadAuthzSchemes,
  resetAuthzMemo,
} from './authz';

const STAMP = '2026-09-08T10:12:42.505502+00:00';
const seeded = [
  { key: 'administrator', label: 'Administrator', type: 'role', value: 'admin', message: null, updated_at: STAMP },
  { key: 'public', label: 'Public', type: 'public', value: null, message: null, updated_at: STAMP },
  { key: 'signed_in', label: 'Signed in', type: 'signed_in', value: null, message: 'Sign in to see this.', updated_at: STAMP },
  { key: 'contributor', label: 'Contributor', type: 'author', value: null, message: 'For approved writers.', updated_at: STAMP },
];

describe('authzFromRows — usable rows only, shipped order first', () => {
  it('keeps rows with a key, a label and a known type, trims, and orders the shipped four first', () => {
    const out = authzFromRows([
      ...seeded,
      { key: 'staff', label: ' Staff ', type: 'role', value: ' moderator ', message: '  ' },
      { key: 'Bad Key', label: 'x', type: 'role', value: 'x', message: null },
      { key: 'nolabel', label: '', type: 'role', value: 'x', message: null },
      { key: 'odd', label: 'Odd', type: 'captcha', value: null, message: null },
      null,
    ]);
    expect(out.map(s => s.key)).toEqual(['public', 'signed_in', 'contributor', 'administrator', 'staff']);
    expect(out[4]).toEqual({ key: 'staff', label: 'Staff', type: 'role', value: 'moderator', message: null });
  });

  it('is empty for anything that is not an array', () => {
    expect(authzFromRows(null)).toEqual([]);
    expect(authzFromRows({ key: 'public' })).toEqual([]);
  });
});

describe('describeAuthzCheck and authzOptions', () => {
  it('says how each check is made, in plain words', () => {
    expect(describeAuthzCheck({ type: 'public', value: null })).toBe('everyone');
    expect(describeAuthzCheck({ type: 'signed_in', value: null })).toBe('any signed-in account');
    expect(describeAuthzCheck({ type: 'role', value: 'admin' })).toBe('account role is “admin”');
    expect(describeAuthzCheck({ type: 'author', value: null })).toBe('an approved writer');
    expect(describeAuthzCheck({ type: 'email_domain', value: '@skg-t.com' })).toBe('email ends with “@skg-t.com”');
  });

  it('offers unset-as-everyone first under the public label, then the schemes that ask for something', () => {
    expect(authzOptions(DEFAULT_AUTHZ_SCHEMES)).toEqual([
      { key: '', label: 'Public' },
      { key: 'signed_in', label: 'Signed in' },
      { key: 'contributor', label: 'Contributor' },
      { key: 'administrator', label: 'Administrator' },
    ]);
    expect(authzOptions([])[0]).toEqual({ key: '', label: 'Public' });
  });
});

describe('loadAuthzSchemes', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
    resetAuthzMemo();
  });

  it('is the shipped four when unconfigured, on error, and on an empty table', async () => {
    configured = false;
    expect(await loadAuthzSchemes()).toEqual(DEFAULT_AUTHZ_SCHEMES);
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadAuthzSchemes()).toEqual(DEFAULT_AUTHZ_SCHEMES);
    result = { data: [], error: null };
    expect(await loadAuthzSchemes()).toEqual(DEFAULT_AUTHZ_SCHEMES);
  });

  it('reads rows, memoises for a minute, forgets on reset', async () => {
    result = { data: [{ key: 'signed_in', label: 'Members', type: 'signed_in', value: null, message: null }], error: null };
    expect((await loadAuthzSchemes()).map(s => s.label)).toEqual(['Members']);
    result = { data: [{ key: 'signed_in', label: 'Accounts', type: 'signed_in', value: null, message: null }], error: null };
    expect((await loadAuthzSchemes()).map(s => s.label)).toEqual(['Members']);
    resetAuthzMemo();
    expect((await loadAuthzSchemes()).map(s => s.label)).toEqual(['Accounts']);
  });
});

describe('loadAuthzForEditing', () => {
  beforeEach(() => {
    configured = true;
    result = { data: [], error: null };
  });

  it('lists the rows in shipped order with their stamps verbatim', async () => {
    result = { data: seeded, error: null };
    const rows = await loadAuthzForEditing();
    expect(rows?.map(r => r.key)).toEqual(['public', 'signed_in', 'contributor', 'administrator']);
    expect(rows?.[1]).toEqual({
      key: 'signed_in',
      label: 'Signed in',
      type: 'signed_in',
      value: null,
      message: 'Sign in to see this.',
      updatedAt: STAMP,
    });
  });

  it('shows the shipped four with no stamp when the table holds nothing usable', async () => {
    const rows = await loadAuthzForEditing();
    expect(rows).toHaveLength(4);
    expect(rows?.every(r => r.updatedAt === null)).toBe(true);
    expect(rows?.[0].key).toBe('public');
  });

  it('is null when unconfigured or on error', async () => {
    configured = false;
    expect(await loadAuthzForEditing()).toBeNull();
    configured = true;
    result = { data: null, error: { message: 'boom' } };
    expect(await loadAuthzForEditing()).toBeNull();
  });
});
