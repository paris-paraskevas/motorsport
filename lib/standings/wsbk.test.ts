import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchWsbkStandings } from './wsbk';

// Realistic fixtures mirroring api.wsbk.pulselive.com responses captured in
// the May 2026 source probe. Endpoint:
//   GET /wsbk-results/v1/seasons/{year}/categories/SBK/{riders|manufacturers}/standings
// Auto-includes related records under `included` — no `?include=` param
// required.

const ridersFixture = {
  data: [
    {
      type: 'rider-standings',
      id: 'std-1',
      attributes: { position: 1, number: 11, points: 310, type: 'championship standings' },
      relationships: {
        rider: { data: { type: 'riders', id: '6164' } },
        team: { data: { type: 'teams', id: 'SBK-2026-2' } },
      },
    },
    {
      type: 'rider-standings',
      id: 'std-2',
      attributes: { position: 2, number: 7, points: 215 },
      relationships: {
        rider: { data: { type: 'riders', id: '7812' } },
        team: { data: { type: 'teams', id: 'SBK-2026-2' } },
      },
    },
    {
      type: 'rider-standings',
      id: 'std-3',
      attributes: { position: 3, number: 5, points: 121 },
      relationships: {
        rider: { data: { type: 'riders', id: '6331' } },
        team: { data: { type: 'teams', id: 'SBK-2026-1' } },
      },
    },
    {
      type: 'rider-standings',
      id: 'std-4',
      attributes: { position: 4, number: 34, points: 107 },
      relationships: {
        rider: { data: { type: 'riders', id: '3984' } },
        team: { data: { type: 'teams', id: 'SBK-2026-1' } },
      },
    },
    {
      type: 'rider-standings',
      id: 'std-5',
      attributes: { position: 5, number: 22, points: 103 },
      relationships: {
        rider: { data: { type: 'riders', id: '5001' } },
        team: { data: { type: 'teams', id: 'SBK-2026-3' } },
      },
    },
    {
      type: 'rider-standings',
      id: 'std-6',
      attributes: { position: 6, number: 22, points: 101 },
      relationships: {
        rider: { data: { type: 'riders', id: '5002' } },
        team: { data: { type: 'teams', id: 'SBK-2026-4' } },
      },
    },
    {
      type: 'rider-standings',
      id: 'std-7',
      attributes: { position: 7, number: 47, points: 86 },
      relationships: {
        rider: { data: { type: 'riders', id: '5003' } },
        team: { data: { type: 'teams', id: 'SBK-2026-4' } },
      },
    },
    {
      type: 'rider-standings',
      id: 'std-8',
      attributes: { position: 8, number: 88, points: 85 },
      relationships: {
        rider: { data: { type: 'riders', id: '5004' } },
        team: { data: { type: 'teams', id: 'SBK-2026-5' } },
      },
    },
    {
      type: 'rider-standings',
      id: 'std-9',
      attributes: { position: 9, number: 19, points: 81 },
      relationships: {
        rider: { data: { type: 'riders', id: '5005' } },
        team: { data: { type: 'teams', id: 'SBK-2026-1' } },
      },
    },
    {
      type: 'rider-standings',
      id: 'std-10',
      attributes: { position: 10, number: 31, points: 68 },
      relationships: {
        rider: { data: { type: 'riders', id: '5006' } },
        team: { data: { type: 'teams', id: 'SBK-2026-6' } },
      },
    },
  ],
  included: [
    { type: 'riders', id: '6164', attributes: { name: 'Nicolo', surname: 'Bulega' } },
    { type: 'riders', id: '7812', attributes: { name: 'Iker', surname: 'Lecuona' } },
    { type: 'riders', id: '6331', attributes: { name: 'Yari', surname: 'Montella' } },
    { type: 'riders', id: '3984', attributes: { name: 'Lorenzo', surname: 'Baldassarri' } },
    { type: 'riders', id: '5001', attributes: { name: 'Sam', surname: 'Lowes' } },
    { type: 'riders', id: '5002', attributes: { name: 'Alex', surname: 'Lowes' } },
    { type: 'riders', id: '5003', attributes: { name: 'Axel', surname: 'Bassani' } },
    { type: 'riders', id: '5004', attributes: { name: 'Miguel', surname: 'Oliveira' } },
    { type: 'riders', id: '5005', attributes: { name: 'Alvaro', surname: 'Bautista' } },
    { type: 'riders', id: '5006', attributes: { name: 'Garrett', surname: 'Gerloff' } },
    { type: 'teams', id: 'SBK-2026-1', attributes: { name: 'Barni Spark Racing Team' } },
    { type: 'teams', id: 'SBK-2026-2', attributes: { name: 'Aruba.it Racing - Ducati' } },
    { type: 'teams', id: 'SBK-2026-3', attributes: { name: 'ELF Marc VDS Racing Team' } },
    { type: 'teams', id: 'SBK-2026-4', attributes: { name: 'bimota by Kawasaki Racing Team' } },
    { type: 'teams', id: 'SBK-2026-5', attributes: { name: 'ROKiT BMW Motorrad WorldSBK Team' } },
    { type: 'teams', id: 'SBK-2026-6', attributes: { name: 'Kawasaki WorldSBK Team' } },
  ],
};

const manufacturersFixture = {
  data: [
    {
      type: 'manufacturer-standings',
      id: 'mfr-1',
      attributes: { position: 1, points: 310 },
      relationships: { manufacturer: { data: { type: 'manufacturers', id: 'DUCAT' } } },
    },
    {
      type: 'manufacturer-standings',
      id: 'mfr-2',
      attributes: { position: 2, points: 230 },
      relationships: { manufacturer: { data: { type: 'manufacturers', id: 'KAWAS' } } },
    },
    {
      type: 'manufacturer-standings',
      id: 'mfr-3',
      attributes: { position: 3, points: 205 },
      relationships: { manufacturer: { data: { type: 'manufacturers', id: 'BMW' } } },
    },
    {
      type: 'manufacturer-standings',
      id: 'mfr-4',
      attributes: { position: 4, points: 180 },
      relationships: { manufacturer: { data: { type: 'manufacturers', id: 'YAM' } } },
    },
  ],
  included: [
    { type: 'manufacturers', id: 'DUCAT', attributes: { name: 'Ducati' } },
    { type: 'manufacturers', id: 'KAWAS', attributes: { name: 'Kawasaki' } },
    { type: 'manufacturers', id: 'BMW', attributes: { name: 'BMW' } },
    { type: 'manufacturers', id: 'YAM', attributes: { name: 'Yamaha' } },
  ],
};

function mockFetchPair(
  ridersPayload: unknown,
  mfrPayload: unknown,
  ridersOk = true,
  mfrOk = true,
) {
  return vi.fn(async (url: string) => {
    if (typeof url === 'string' && url.includes('/riders/standings')) {
      return { ok: ridersOk, json: async () => ridersPayload } as Response;
    }
    if (typeof url === 'string' && url.includes('/manufacturers/standings')) {
      return { ok: mfrOk, json: async () => mfrPayload } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
}

describe('fetchWsbkStandings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses both feeds into typed standings with rider+team and manufacturer names', async () => {
    vi.stubGlobal('fetch', mockFetchPair(ridersFixture, manufacturersFixture));
    const result = await fetchWsbkStandings(2026);
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(10);
    expect(result!.drivers[0]).toEqual({
      position: 1,
      driverName: 'Nicolo Bulega',
      team: 'Aruba.it Racing - Ducati',
      points: 310,
    });
    expect(result!.drivers[2].driverName).toBe('Yari Montella');
    expect(result!.drivers[2].team).toBe('Barni Spark Racing Team');
    expect(result!.constructors).toHaveLength(4);
    expect(result!.constructors[0]).toEqual({
      position: 1,
      name: 'Ducati',
      points: 310,
    });
  });

  it('sorts standings rows by position even if upstream emits them out of order', async () => {
    const reversed = {
      ...ridersFixture,
      data: [...ridersFixture.data].reverse(),
    };
    vi.stubGlobal('fetch', mockFetchPair(reversed, manufacturersFixture));
    const result = await fetchWsbkStandings(2026);
    expect(result).not.toBeNull();
    expect(result!.drivers.map(d => d.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('returns null when riders feed is HTTP not ok (fail-closed)', async () => {
    vi.stubGlobal('fetch', mockFetchPair(ridersFixture, manufacturersFixture, false, true));
    const result = await fetchWsbkStandings(2026);
    expect(result).toBeNull();
  });

  it('returns null when manufacturers feed is HTTP not ok (fail-closed)', async () => {
    vi.stubGlobal('fetch', mockFetchPair(ridersFixture, manufacturersFixture, true, false));
    const result = await fetchWsbkStandings(2026);
    expect(result).toBeNull();
  });

  it('returns null when riders payload has fewer than 10 entries (sanity floor)', async () => {
    const thin = { data: ridersFixture.data.slice(0, 5), included: ridersFixture.included };
    vi.stubGlobal('fetch', mockFetchPair(thin, manufacturersFixture));
    const result = await fetchWsbkStandings(2026);
    expect(result).toBeNull();
  });

  it('returns null when manufacturers payload has fewer than 3 entries (sanity floor)', async () => {
    const thin = {
      data: manufacturersFixture.data.slice(0, 2),
      included: manufacturersFixture.included.slice(0, 2),
    };
    vi.stubGlobal('fetch', mockFetchPair(ridersFixture, thin));
    const result = await fetchWsbkStandings(2026);
    expect(result).toBeNull();
  });

  it('returns null when relationships reference an id that is missing from included', async () => {
    const broken = {
      ...ridersFixture,
      // Drop one rider; the row referencing rider id 5006 will not match an included entry.
      included: ridersFixture.included.filter(i => !(i.type === 'riders' && i.id === '5006')),
    };
    vi.stubGlobal('fetch', mockFetchPair(broken, manufacturersFixture));
    const result = await fetchWsbkStandings(2026);
    // Floor is 10; we lose 1 row so total drops to 9 -> null.
    expect(result).toBeNull();
  });

  it('returns null when payload shape is unexpected', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchPair({ wrong: 'shape' }, { wrong: 'shape' }),
    );
    const result = await fetchWsbkStandings(2026);
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const result = await fetchWsbkStandings(2026);
    expect(result).toBeNull();
  });

  it('hits the correct host + path with the configured season', async () => {
    const spy = mockFetchPair(ridersFixture, manufacturersFixture);
    vi.stubGlobal('fetch', spy);
    await fetchWsbkStandings(2026);
    const calls = spy.mock.calls.map(c => c[0]);
    expect(
      calls.some(
        u =>
          typeof u === 'string' &&
          u ===
            'https://api.wsbk.pulselive.com/wsbk-results/v1/seasons/2026/categories/SBK/riders/standings',
      ),
    ).toBe(true);
    expect(
      calls.some(
        u =>
          typeof u === 'string' &&
          u ===
            'https://api.wsbk.pulselive.com/wsbk-results/v1/seasons/2026/categories/SBK/manufacturers/standings',
      ),
    ).toBe(true);
  });
});
