import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  wasNotified,
  markNotified,
  unmarkNotified,
  shouldRetryAfterTotalFailure,
} from './notify-ledger';

// In-memory KV mock (same approach as results-cache.test.ts): replace
// `@vercel/kv` wholesale so set/get/del become Map operations and we can assert
// the mark / unmark round-trip without a network.
const store = new Map<string, unknown>();
const delSpy = vi.fn();

vi.mock('@vercel/kv', () => ({
  kv: {
    get: vi.fn(async (key: string) => {
      const v = store.get(key);
      return v === undefined ? null : v;
    }),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      delSpy(key);
      store.delete(key);
      return 1;
    }),
  },
}));

describe('shouldRetryAfterTotalFailure', () => {
  it('retries on a transient total failure (0 sent, ≥1 real error)', () => {
    expect(shouldRetryAfterTotalFailure({ sent: 0, errored: 1 })).toBe(true);
    expect(shouldRetryAfterTotalFailure({ sent: 0, errored: 5 })).toBe(true);
  });

  it('does NOT retry when at least one send succeeded', () => {
    expect(shouldRetryAfterTotalFailure({ sent: 1, errored: 3 })).toBe(false);
    expect(shouldRetryAfterTotalFailure({ sent: 10, errored: 0 })).toBe(false);
  });

  it('does NOT retry when there were no real errors (gone-only / no subscribers / all skipped)', () => {
    // 0 sent + 0 errored = nothing transient to recover (terminal outcome).
    expect(shouldRetryAfterTotalFailure({ sent: 0, errored: 0 })).toBe(false);
  });
});

describe('notify-ledger mark / unmark (KV configured)', () => {
  beforeEach(() => {
    store.clear();
    delSpy.mockClear();
    process.env.KV_REST_API_URL = 'https://kv.test.invalid';
    process.env.KV_REST_API_TOKEN = 'test-token';
  });
  afterEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('wasNotified is false before marking, true after', async () => {
    expect(await wasNotified('t30', 'uid-1')).toBe(false);
    await markNotified('t30', 'uid-1');
    expect(await wasNotified('t30', 'uid-1')).toBe(true);
  });

  it('unmarkNotified deletes the key so a later tick re-evaluates', async () => {
    await markNotified('res', 'uid-2');
    expect(await wasNotified('res', 'uid-2')).toBe(true);

    await unmarkNotified('res', 'uid-2');
    expect(delSpy).toHaveBeenCalledWith('paddock:notified:res:uid-2');
    expect(await wasNotified('res', 'uid-2')).toBe(false);

    // The retry path: after unmark the next mark works again (re-fire allowed).
    await markNotified('res', 'uid-2');
    expect(await wasNotified('res', 'uid-2')).toBe(true);
  });

  it('keys are namespaced per kind + uid (no cross-talk)', async () => {
    await markNotified('t30', 'uid-3');
    expect(await wasNotified('t10', 'uid-3')).toBe(false); // different kind
    expect(await wasNotified('t30', 'uid-other')).toBe(false); // different uid
  });

  it('unmark of an unmarked key is a harmless no-op', async () => {
    await expect(unmarkNotified('analysis', 'never-marked')).resolves.toBeUndefined();
    expect(await wasNotified('analysis', 'never-marked')).toBe(false);
  });
});

describe('notify-ledger (KV unconfigured)', () => {
  beforeEach(() => {
    store.clear();
    delSpy.mockClear();
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('treats everything as "never notified" and no-ops mark/unmark without touching KV', async () => {
    expect(await wasNotified('t30', 'uid-x')).toBe(false);
    await expect(markNotified('t30', 'uid-x')).resolves.toBeUndefined();
    await expect(unmarkNotified('t30', 'uid-x')).resolves.toBeUndefined();
    expect(delSpy).not.toHaveBeenCalled();
    // Still "not notified" because the mark was a no-op.
    expect(await wasNotified('t30', 'uid-x')).toBe(false);
  });
});
