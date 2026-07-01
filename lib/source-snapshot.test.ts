import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// In-memory fake of the `source_snapshot` Postgres table, standing in for the
// service-role Supabase client. It supports exactly the two call chains
// source-snapshot.ts uses:
//   read:  betDb().from('source_snapshot').select('payload').eq('source_key', k).maybeSingle()
//   write: betDb().from('source_snapshot').upsert(row, { onConflict: 'source_key' })
// so the durable last-good behaviour can be asserted without a network.
const table = new Map<string, { payload: unknown; fetched_at: string; ok: boolean; http_status: number }>();

// Toggled per-test to simulate a Supabase outage on the read/write path.
let failReads = false;
let failWrites = false;

function makeFrom() {
  let selectedKey: string | null = null;
  const builder = {
    select() {
      return builder;
    },
    eq(_col: string, value: string) {
      selectedKey = value;
      return builder;
    },
    async maybeSingle() {
      if (failReads) throw new Error('supabase read outage');
      const row = selectedKey != null ? table.get(selectedKey) : undefined;
      return { data: row ? { payload: row.payload } : null, error: null };
    },
    async upsert(row: { source_key: string; payload: unknown; fetched_at: string; ok: boolean; http_status: number }) {
      if (failWrites) throw new Error('supabase write outage');
      table.set(row.source_key, {
        payload: row.payload,
        fetched_at: row.fetched_at,
        ok: row.ok,
        http_status: row.http_status,
      });
      return { data: null, error: null };
    },
  };
  return builder;
}

let configured = true;

vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({ from: () => makeFrom() }),
}));

import { withSourceSnapshot, readSnapshot, writeSnapshot } from './source-snapshot';

// Shape mirrors the motorsport.com-sourced DTMStandings the wrapper protects:
// no Date fields, so the jsonb round-trip is lossless.
interface Standings {
  drivers: { name: string; points: number }[];
}

const GOOD: Standings = { drivers: [{ name: 'M. Engel', points: 44 }] };
const isEmpty = (v: Standings | null) => v == null || v.drivers.length === 0;

describe('withSourceSnapshot — durable last-good', () => {
  beforeEach(() => {
    table.clear();
    failReads = false;
    failWrites = false;
    configured = true;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('SUCCESS persists the fetched payload under the key', async () => {
    const result = await withSourceSnapshot<Standings | null>(
      'standings:dtm',
      async () => GOOD,
      isEmpty,
    );
    expect(result).toEqual(GOOD);
    expect(await readSnapshot<Standings>('standings:dtm')).toEqual(GOOD);
  });

  it('FAILURE (fetch returns null) serves the last-good snapshot', async () => {
    await writeSnapshot('standings:dtm', GOOD);
    const result = await withSourceSnapshot<Standings | null>(
      'standings:dtm',
      async () => null,
      isEmpty,
    );
    expect(result).toEqual(GOOD);
  });

  it('FAILURE (fetch returns empty array) serves the last-good snapshot', async () => {
    await writeSnapshot('standings:dtm', GOOD);
    const result = await withSourceSnapshot<Standings | null>(
      'standings:dtm',
      async () => ({ drivers: [] }),
      isEmpty,
    );
    expect(result).toEqual(GOOD);
  });

  it('FAILURE (fetcher throws) serves the last-good snapshot', async () => {
    await writeSnapshot('standings:dtm', GOOD);
    const result = await withSourceSnapshot<Standings | null>(
      'standings:dtm',
      async () => {
        throw new Error('motorsport.com 503');
      },
      isEmpty,
    );
    expect(result).toEqual(GOOD);
  });

  it('a good fetch overwrites a stale snapshot (self-heal)', async () => {
    await writeSnapshot('standings:dtm', { drivers: [{ name: 'stale', points: 1 }] });
    const fresh: Standings = { drivers: [{ name: 'M. Engel', points: 44 }, { name: 'L. Auer', points: 37 }] };
    const result = await withSourceSnapshot<Standings | null>(
      'standings:dtm',
      async () => fresh,
      isEmpty,
    );
    expect(result).toEqual(fresh);
    expect(await readSnapshot<Standings>('standings:dtm')).toEqual(fresh);
  });

  it('FAILURE with no snapshot present returns the empty value (today behaviour)', async () => {
    const result = await withSourceSnapshot<Standings | null>(
      'standings:dtm',
      async () => null,
      isEmpty,
    );
    expect(result).toBeNull();
  });

  describe('FAIL-SOFT when Supabase is unconfigured', () => {
    beforeEach(() => {
      configured = false;
    });

    it('runs the fetcher uncached; success passes straight through, no persist', async () => {
      const result = await withSourceSnapshot<Standings | null>(
        'standings:dtm',
        async () => GOOD,
        isEmpty,
      );
      expect(result).toEqual(GOOD);
      // Reads are no-ops too, so nothing was written even though the fetch was good.
      configured = true;
      expect(await readSnapshot<Standings>('standings:dtm')).toBeNull();
    });

    it('failure returns the empty value exactly as today (no throw)', async () => {
      const result = await withSourceSnapshot<Standings | null>(
        'standings:dtm',
        async () => null,
        isEmpty,
      );
      expect(result).toBeNull();
    });
  });

  describe('FAIL-SOFT when Supabase throws', () => {
    it('a read outage on the failure path falls back to the fresh empty value', async () => {
      failReads = true;
      const result = await withSourceSnapshot<Standings | null>(
        'standings:dtm',
        async () => null,
        isEmpty,
      );
      expect(result).toBeNull();
    });

    it('a write outage on the success path still returns fresh data', async () => {
      failWrites = true;
      const result = await withSourceSnapshot<Standings | null>(
        'standings:dtm',
        async () => GOOD,
        isEmpty,
      );
      expect(result).toEqual(GOOD);
    });
  });
});
