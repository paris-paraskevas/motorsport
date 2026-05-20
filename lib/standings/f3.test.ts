import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchF3Standings } from './f3';

// Mirrors the fiaformula3.com SSR shape: a Next.js __NEXT_DATA__ JSON payload
// mounted at script#__NEXT_DATA__. The standings parser reads from that JSON
// via cheerio; surrounding markup is irrelevant.
function html(payload: unknown): string {
  return `<!doctype html><html><head><title>F3</title>` +
    `<script id="__NEXT_DATA__" type="application/json">` +
    `${JSON.stringify(payload)}` +
    `</script></head><body><div id="__next"></div></body></html>`;
}

function driverRow(opts: {
  position: number;
  driverID?: number;
  tla: string;
  fullName: string;
  team: string | null;
  totalPoints: number;
  racePoints?: Array<Array<number | null>>;
}) {
  return {
    Position: opts.position,
    CarNumber: opts.position + 10,
    DriverID: opts.driverID ?? 1400 + opts.position,
    TLA: opts.tla,
    DisplayName: opts.fullName.split(' ').map((part, i) => (i === 0 ? part[0] + '.' : part)).join(' '),
    FullName: opts.fullName,
    CountryCode: 'XX',
    TeamName: opts.team,
    TotalPoints: opts.totalPoints,
    RacePoints:
      opts.racePoints ??
      Array.from({ length: 9 }, () => [null, null] as Array<number | null>),
  };
}

function teamRow(opts: {
  position: number;
  name: string;
  totalPoints: number;
  racePoints?: Array<Array<number | null>>;
}) {
  return {
    Position: opts.position,
    TeamID: 200 + opts.position,
    TLA: opts.name,
    DisplayName: opts.name,
    FullName: opts.name,
    CountryCode: 'XX',
    TotalPoints: opts.totalPoints,
    RacePoints:
      opts.racePoints ??
      Array.from({ length: 9 }, () => [null, null] as Array<number | null>),
  };
}

const FULL_DRIVER_FIXTURE = html({
  props: {
    pageProps: {
      pageData: {
        Standings: [
          // Ugochukwu: SR P8 scored 0 (red-flag-reduced), FR P1 scored 25.
          // TotalPoints = 25 — matches the operator-flagged Ugochukwu 25 case
          // and proves the parser surfaces the FIA-authoritative total, not
          // a (1 + 25) = 26 recomputed-from-position figure.
          driverRow({ position: 1, tla: 'UGO', fullName: 'Ugo Ugochukwu', team: 'Campos Racing', totalPoints: 25,
            racePoints: [[0, 25], ...Array.from({ length: 8 }, () => [null, null] as Array<number | null>)] }),
          driverRow({ position: 2, tla: 'BAD', fullName: 'Brando Badoer', team: 'Rodin Motorsport', totalPoints: 18 }),
          driverRow({ position: 3, tla: 'STR', fullName: 'Noah Strømsted', team: 'TRIDENT', totalPoints: 18 }),
          driverRow({ position: 4, tla: 'KAT', fullName: 'Taito Kato', team: 'ART Grand Prix', totalPoints: 16 }),
          driverRow({ position: 5, tla: 'EDE', fullName: 'Enzo Deligny', team: 'Van Amersfoort Racing', totalPoints: 12 }),
          driverRow({ position: 6, tla: 'BDE', fullName: 'Bruno Del Pino', team: 'Van Amersfoort Racing', totalPoints: 13,
            racePoints: [[5, 13], ...Array.from({ length: 8 }, () => [null, null] as Array<number | null>)] }),
          driverRow({ position: 7, tla: 'NAK', fullName: 'Jin Nakamura', team: 'Hitech', totalPoints: 8 }),
          driverRow({ position: 8, tla: 'GLA', fullName: 'Maciej Gładysz', team: 'ART Grand Prix', totalPoints: 6 }),
          driverRow({ position: 9, tla: 'LAC', fullName: 'Nicola Lacorte', team: 'DAMS Lucas Oil', totalPoints: 4 }),
          driverRow({ position: 10, tla: 'WHA', fullName: 'James Wharton', team: 'PREMA Racing', totalPoints: 2 }),
          driverRow({ position: 11, tla: 'NAE', fullName: 'Théophile Naël', team: 'Campos Racing', totalPoints: 1 }),
          driverRow({ position: 12, tla: 'BAR', fullName: 'Fernando Barrichello', team: 'AIX Racing', totalPoints: 0 }),
          // Two MX reserves carry TeamName=null in the live payload; the
          // parser must keep them (the row contributes a stub entry) rather
          // than dropping outright.
          driverRow({ position: 31, tla: 'CAR', fullName: 'Jesse Carrasquedo', team: null, totalPoints: 0 }),
          driverRow({ position: 32, tla: 'RIV', fullName: 'Ernesto Rivera', team: null, totalPoints: 0 }),
        ],
      },
    },
  },
});

const FULL_TEAM_FIXTURE = html({
  props: {
    pageProps: {
      pageData: {
        Standings: [
          teamRow({ position: 1, name: 'Campos Racing', totalPoints: 35,
            racePoints: [[1, 25], ...Array.from({ length: 8 }, () => [0, 0] as Array<number | null>)] }),
          teamRow({ position: 2, name: 'Van Amersfoort Racing', totalPoints: 25 }),
          teamRow({ position: 3, name: 'Rodin Motorsport', totalPoints: 22 }),
          teamRow({ position: 4, name: 'TRIDENT', totalPoints: 20 }),
          teamRow({ position: 5, name: 'ART Grand Prix', totalPoints: 18 }),
          teamRow({ position: 6, name: 'Hitech', totalPoints: 8 }),
          teamRow({ position: 7, name: 'DAMS Lucas Oil', totalPoints: 4 }),
          teamRow({ position: 8, name: 'PREMA Racing', totalPoints: 2 }),
          teamRow({ position: 9, name: 'MP Motorsport', totalPoints: 0 }),
          teamRow({ position: 10, name: 'AIX Racing', totalPoints: 0 }),
        ],
      },
    },
  },
});

const PARTIAL_DRIVER_FIXTURE = html({
  props: { pageProps: { pageData: { Standings: [
    driverRow({ position: 1, tla: 'UGO', fullName: 'Ugo Ugochukwu', team: 'Campos Racing', totalPoints: 25 }),
    driverRow({ position: 2, tla: 'BAD', fullName: 'Brando Badoer', team: 'Rodin Motorsport', totalPoints: 18 }),
  ]}}},
});

const MISSING_PAYLOAD_FIXTURE = `<!doctype html><html><body><p>Maintenance.</p></body></html>`;

function mockFetch(driverHtml: string | null, teamHtml: string | null, driverOk = true, teamOk = true) {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('/Standings/Driver')) {
      if (driverHtml === null) throw new Error('network down');
      return { ok: driverOk, status: driverOk ? 200 : 500, text: async () => driverHtml } as Response;
    }
    if (u.includes('/Standings/Team')) {
      if (teamHtml === null) throw new Error('network down');
      return { ok: teamOk, status: teamOk ? 200 : 500, text: async () => teamHtml } as Response;
    }
    return { ok: false, status: 404, text: async () => '' } as Response;
  }) as unknown as typeof fetch;
}

describe('fetchF3Standings', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses both standings pages into typed drivers + constructors', async () => {
    mockFetch(FULL_DRIVER_FIXTURE, FULL_TEAM_FIXTURE);
    const result = await fetchF3Standings();
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(14);
    // Ugochukwu's TotalPoints from FIA is 25 — not the (1 + 25) = 26 the
    // pre-migration parser surfaced. This is the operator-flagged bug.
    expect(result!.drivers[0]).toEqual({
      position: 1,
      driverName: 'Ugo Ugochukwu',
      driverCode: 'UGO',
      team: 'Campos Racing',
      points: 25,
      // RacePoints: [[0,25],...] → 1 Feature-Race win (25) at R1
      wins: 1,
    });
    expect(result!.drivers[3].driverName).toBe('Taito Kato');
    expect(result!.drivers[3].driverCode).toBe('KAT');
    expect(result!.drivers[3].points).toBe(16);

    expect(result!.constructors).toHaveLength(10);
    expect(result!.constructors[0]).toEqual({
      position: 1,
      name: 'Campos Racing',
      points: 35,
      wins: 1,
    });
    expect(result!.constructors[2].name).toBe('Rodin Motorsport');
  });

  it('preserves reserves whose TeamName is null with an empty team string', async () => {
    mockFetch(FULL_DRIVER_FIXTURE, FULL_TEAM_FIXTURE);
    const result = await fetchF3Standings();
    expect(result).not.toBeNull();
    const carrasquedo = result!.drivers.find(d => d.driverCode === 'CAR');
    expect(carrasquedo).toBeDefined();
    expect(carrasquedo!.team).toBe('');
    expect(carrasquedo!.driverName).toBe('Jesse Carrasquedo');
  });

  it('sorts drivers and constructors by position', async () => {
    const reversedDrivers = JSON.parse(
      FULL_DRIVER_FIXTURE.match(/__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/)![1],
    );
    reversedDrivers.props.pageProps.pageData.Standings.reverse();
    const reversedTeams = JSON.parse(
      FULL_TEAM_FIXTURE.match(/__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/)![1],
    );
    reversedTeams.props.pageProps.pageData.Standings.reverse();
    mockFetch(html(reversedDrivers), html(reversedTeams));
    const result = await fetchF3Standings();
    expect(result).not.toBeNull();
    expect(result!.drivers.map(d => d.position).slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(result!.constructors.map(c => c.position).slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns null when driver standings has fewer than 10 entries (sanity floor)', async () => {
    mockFetch(PARTIAL_DRIVER_FIXTURE, FULL_TEAM_FIXTURE);
    const result = await fetchF3Standings();
    expect(result).toBeNull();
  });

  it('returns null when constructor standings has fewer than 6 entries (sanity floor)', async () => {
    const partialTeams = html({
      props: { pageProps: { pageData: { Standings: [
        teamRow({ position: 1, name: 'Campos Racing', totalPoints: 35 }),
        teamRow({ position: 2, name: 'Van Amersfoort Racing', totalPoints: 25 }),
      ]}}},
    });
    mockFetch(FULL_DRIVER_FIXTURE, partialTeams);
    const result = await fetchF3Standings();
    expect(result).toBeNull();
  });

  it('returns null when __NEXT_DATA__ is missing from the page', async () => {
    mockFetch(MISSING_PAYLOAD_FIXTURE, FULL_TEAM_FIXTURE);
    const result = await fetchF3Standings();
    expect(result).toBeNull();
  });

  it('returns null when either fetch is not ok', async () => {
    mockFetch(FULL_DRIVER_FIXTURE, FULL_TEAM_FIXTURE, true, false);
    const result = await fetchF3Standings();
    expect(result).toBeNull();
  });

  it('returns null when either fetch throws', async () => {
    mockFetch(null, FULL_TEAM_FIXTURE);
    const result = await fetchF3Standings();
    expect(result).toBeNull();
  });
});
