import { beforeEach, describe, expect, it, vi } from 'vitest';

// GET /api/admin/design/maps (P2.12): the Map Backgrounds' Utilization, the pages
// whose newest or live revision carries a Map region on each background, and
// whether a keyed background's variable is set (never its value). Admin-only.
// The catalogue itself is client-safe, so the route answers only what needs the
// database or the environment.

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

let tables: Record<string, { data: unknown; error: { message: string } | null }> = {};
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(resolve, reject),
      };
      return chain;
    },
  }),
}));

// A keyed provider beside the real catalogue (none ships today), so the key's state and its secrecy are exercised for real.
vi.mock('@/lib/design/map-backgrounds', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/design/map-backgrounds')>();
  return { ...real, MAP_BACKGROUNDS: [...real.MAP_BACKGROUNDS, { key: 'keyed', name: 'Keyed', holds: 'a test provider with a key', light: { url: 'https://tiles.example/{z}/{x}/{y}?key={key}', attribution: 'Test', maxZoom: 18 }, dark: null, keyVar: 'PADDOCK_TEST_TILES_KEY' }] };
});

import { GET } from './route';

const admin = { id: 'user_admin', role: 'admin' };
const MONZA = 'a1b2c3d4-0000-4000-8000-000000000002';
const region = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({ id, kind, title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, ...extra });

describe('GET /api/admin/design/maps', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    tables = {
      page: { data: [{ id: MONZA, path: '/history/monza', name: 'Monza, a history' }], error: null },
      page_revision: {
        data: [{ page_id: MONZA, created_at: '2026-09-29T12:00:00Z', published_at: null, document: { version: 2, actions: [], regions: [region('map', 'component', { component: 'data.map', settings: { preset: 'circuit-guides', background: 'canvas' }, source: 'guides' })] } }],
        error: null,
      },
    };
  });

  it('is not found for anyone but an administrator', async () => {
    currentAccount.mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });

  it('lists the backgrounds with whether their key is set (null for a key-less one) and the pages they are used on, never a key’s value', async () => {
    process.env.PADDOCK_TEST_TILES_KEY = 'a-secret-value';
    try {
      const res = await GET();
      expect(res.status).toBe(200);
      const body = (await res.json()) as { backgrounds: { key: string; keySet: boolean | null; usedOn: unknown[] }[] };
      expect(body.backgrounds).toEqual([
        { key: 'canvas', keySet: null, usedOn: [{ id: MONZA, path: '/history/monza', name: 'Monza, a history', refs: ['map'] }] },
        { key: 'keyed', keySet: true, usedOn: [] },
      ]);
      expect(JSON.stringify(body)).not.toContain('a-secret-value');
    } finally {
      delete process.env.PADDOCK_TEST_TILES_KEY;
    }
    const unset = (await (await GET()).json()) as { backgrounds: { key: string; keySet: boolean | null }[] };
    expect(unset.backgrounds.map(b => [b.key, b.keySet])).toEqual([
      ['canvas', null],
      ['keyed', false],
    ]);
  });

  it('answers the backgrounds with no page when the database cannot be read', async () => {
    tables = { page: { data: null, error: { message: 'down' } }, page_revision: { data: [], error: null } };
    const body = (await (await GET()).json()) as { backgrounds: { key: string; usedOn: unknown[] }[] };
    expect(body.backgrounds).toEqual([
      { key: 'canvas', keySet: null, usedOn: [] },
      { key: 'keyed', keySet: false, usedOn: [] },
    ]);
  });
});
