import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchF2Standings } from './f2';

// Builds an HTML page that mirrors the fiaformula2.com SSR shape:
// a Next.js __NEXT_DATA__ JSON payload mounted at script#__NEXT_DATA__ inside
// <head>. The standings parser reads only from that JSON via cheerio; the
// surrounding markup is irrelevant.
function html(payload: unknown): string {
  return `<!doctype html><html><head><title>F2</title>` +
    `<script id="__NEXT_DATA__" type="application/json">` +
    `${JSON.stringify(payload)}` +
    `</script></head><body><div id="__next"></div></body></html>`;
}

function driverRow(opts: {
  position: number;
  driverID?: number;
  tla: string;
  fullName: string;
  team: string;
  totalPoints: number;
  racePoints?: Array<Array<number | null>>;
}) {
  return {
    Position: opts.position,
    CarNumber: opts.position + 10,
    DriverID: opts.driverID ?? 1000 + opts.position,
    TLA: opts.tla,
    DisplayName: opts.fullName.split(' ').map((part, i) => (i === 0 ? part[0] + '.' : part)).join(' '),
    FullName: opts.fullName,
    CountryCode: 'XX',
    TeamName: opts.team,
    TotalPoints: opts.totalPoints,
    RacePoints:
      opts.racePoints ??
      Array.from({ length: 14 }, () => [null, null] as Array<number | null>),
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
      Array.from({ length: 14 }, () => [null, null] as Array<number | null>),
  };
}

const FULL_DRIVER_FIXTURE = html({
  props: {
    pageProps: {
      pageData: {
        Standings: [
          driverRow({ position: 1, tla: 'TSO', fullName: 'Nikola Tsolov', team: 'Campos Racing', totalPoints: 35,
            racePoints: [[0, 25], [10, 0], ...Array.from({ length: 12 }, () => [null, null] as Array<number | null>)] }),
          driverRow({ position: 2, tla: 'MIN', fullName: 'Gabriele Minì', team: 'MP Motorsport', totalPoints: 34,
            racePoints: [[3, 4], [2, 25], ...Array.from({ length: 12 }, () => [null, null] as Array<number | null>)] }),
          driverRow({ position: 3, tla: 'CAM', fullName: 'Rafael Câmara', team: 'Invicta Racing', totalPoints: 30 }),
          driverRow({ position: 4, tla: 'BEG', fullName: 'Dino Beganovic', team: 'DAMS Lucas Oil', totalPoints: 24 }),
          driverRow({ position: 5, tla: 'LEO', fullName: 'Nikola León', team: 'Campos Racing', totalPoints: 21 }),
          driverRow({ position: 6, tla: 'MAI', fullName: 'Kush Maini', team: 'ART Grand Prix', totalPoints: 19 }),
          driverRow({ position: 7, tla: 'MIY', fullName: 'Ritomo Miyata', team: 'Hitech TGR', totalPoints: 17 }),
          driverRow({ position: 8, tla: 'BOY', fullName: 'Marti Boya', team: 'PREMA Racing', totalPoints: 15 }),
          driverRow({ position: 9, tla: 'HER', fullName: 'Colton Herta', team: 'Hitech TGR', totalPoints: 12 }),
          driverRow({ position: 10, tla: 'MON', fullName: 'Sebastian Montoya', team: 'PREMA Racing', totalPoints: 10 }),
          driverRow({ position: 11, tla: 'DUR', fullName: 'Joshua Dürksen', team: 'Invicta Racing', totalPoints: 9 }),
          driverRow({ position: 12, tla: 'VAN', fullName: 'Laurens van Hoepen', team: 'TRIDENT', totalPoints: 8 }),
          driverRow({ position: 13, tla: 'FIT', fullName: 'Enzo Fittipaldi', team: 'AIX Racing', totalPoints: 7 }),
          driverRow({ position: 14, tla: 'VAR', fullName: 'Nico Varrone', team: 'Van Amersfoort Racing', totalPoints: 6 }),
          driverRow({ position: 15, tla: 'BEN', fullName: 'Joey Bennett', team: 'TRIDENT', totalPoints: 5 }),
          driverRow({ position: 16, tla: 'STE', fullName: 'Martinius Stenshorne', team: 'Rodin Motorsport', totalPoints: 4 }),
          driverRow({ position: 17, tla: 'DUN', fullName: 'Alexander Dunne', team: 'Rodin Motorsport', totalPoints: 3 }),
          driverRow({ position: 18, tla: 'GOE', fullName: 'Oliver Goethe', team: 'MP Motorsport', totalPoints: 2 }),
          driverRow({ position: 19, tla: 'SHI', fullName: 'Cian Shields', team: 'AIX Racing', totalPoints: 1 }),
          driverRow({ position: 20, tla: 'BIL', fullName: 'Roman Bilinski', team: 'DAMS Lucas Oil', totalPoints: 0 }),
          driverRow({ position: 21, tla: 'INT', fullName: 'Tom Inthraphuvasak', team: 'ART Grand Prix', totalPoints: 0 }),
          driverRow({ position: 22, tla: 'VIL', fullName: 'Roberto Villagómez', team: 'Van Amersfoort Racing', totalPoints: 0 }),
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
          teamRow({ position: 1, name: 'Campos Racing', totalPoints: 56,
            racePoints: [[8, 25], [11, 12], ...Array.from({ length: 12 }, () => [0, 0] as Array<number | null>)] }),
          teamRow({ position: 2, name: 'MP Motorsport', totalPoints: 50 }),
          teamRow({ position: 3, name: 'Invicta Racing', totalPoints: 42 }),
          teamRow({ position: 4, name: 'DAMS Lucas Oil', totalPoints: 38 }),
          teamRow({ position: 5, name: 'ART Grand Prix', totalPoints: 34 }),
          teamRow({ position: 6, name: 'Hitech TGR', totalPoints: 30 }),
          teamRow({ position: 7, name: 'PREMA Racing', totalPoints: 26 }),
          teamRow({ position: 8, name: 'Rodin Motorsport', totalPoints: 22 }),
          teamRow({ position: 9, name: 'TRIDENT', totalPoints: 18 }),
          teamRow({ position: 10, name: 'AIX Racing', totalPoints: 14 }),
          teamRow({ position: 11, name: 'Van Amersfoort Racing', totalPoints: 10 }),
        ],
      },
    },
  },
});

const PARTIAL_DRIVER_FIXTURE = html({
  props: { pageProps: { pageData: { Standings: [
    driverRow({ position: 1, tla: 'TSO', fullName: 'Nikola Tsolov', team: 'Campos Racing', totalPoints: 35 }),
    driverRow({ position: 2, tla: 'MIN', fullName: 'Gabriele Minì', team: 'MP Motorsport', totalPoints: 34 }),
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

describe('fetchF2Standings', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses both standings pages into typed drivers + constructors', async () => {
    mockFetch(FULL_DRIVER_FIXTURE, FULL_TEAM_FIXTURE);
    const result = await fetchF2Standings();
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(22);
    expect(result!.drivers[0]).toEqual({
      position: 1,
      driverName: 'Nikola Tsolov',
      driverCode: 'TSO',
      team: 'Campos Racing',
      points: 35,
      // RacePoints: [[0,25],[10,0],...] → 1 Feature-Race win (25) at R1
      wins: 1,
    });
    expect(result!.drivers[1]).toEqual({
      position: 2,
      driverName: 'Gabriele Minì',
      driverCode: 'MIN',
      team: 'MP Motorsport',
      points: 34,
      // RacePoints: [[3,4],[2,25],...] → 1 Feature-Race win (25) at R2
      wins: 1,
    });
    expect(result!.constructors).toHaveLength(11);
    expect(result!.constructors[0]).toEqual({
      position: 1,
      name: 'Campos Racing',
      points: 56,
      // [[8,25],[11,12],...] → 1 FR win
      wins: 1,
    });
  });

  it('sorts drivers and constructors by position', async () => {
    // Wrap drivers/teams in reverse order in the payload — parser should resort.
    const reversedDrivers = JSON.parse(FULL_DRIVER_FIXTURE.match(/__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/)![1]);
    reversedDrivers.props.pageProps.pageData.Standings.reverse();
    const reversedTeams = JSON.parse(FULL_TEAM_FIXTURE.match(/__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/)![1]);
    reversedTeams.props.pageProps.pageData.Standings.reverse();
    mockFetch(html(reversedDrivers), html(reversedTeams));
    const result = await fetchF2Standings();
    expect(result).not.toBeNull();
    expect(result!.drivers.map(d => d.position).slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(result!.constructors.map(c => c.position).slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('returns null when driver standings has fewer than 15 entries (sanity floor)', async () => {
    mockFetch(PARTIAL_DRIVER_FIXTURE, FULL_TEAM_FIXTURE);
    const result = await fetchF2Standings();
    expect(result).toBeNull();
  });

  it('returns null when constructor standings has fewer than 8 entries (sanity floor)', async () => {
    const partialTeams = html({
      props: { pageProps: { pageData: { Standings: [
        teamRow({ position: 1, name: 'Campos Racing', totalPoints: 56 }),
        teamRow({ position: 2, name: 'MP Motorsport', totalPoints: 50 }),
      ]}}},
    });
    mockFetch(FULL_DRIVER_FIXTURE, partialTeams);
    const result = await fetchF2Standings();
    expect(result).toBeNull();
  });

  it('returns null when __NEXT_DATA__ is missing from the page', async () => {
    mockFetch(MISSING_PAYLOAD_FIXTURE, FULL_TEAM_FIXTURE);
    const result = await fetchF2Standings();
    expect(result).toBeNull();
  });

  it('returns null when either fetch is not ok', async () => {
    mockFetch(FULL_DRIVER_FIXTURE, FULL_TEAM_FIXTURE, true, false);
    const result = await fetchF2Standings();
    expect(result).toBeNull();
  });

  it('returns null when either fetch throws', async () => {
    mockFetch(null, FULL_TEAM_FIXTURE);
    const result = await fetchF2Standings();
    expect(result).toBeNull();
  });
});
