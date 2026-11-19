import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import manifest from '@/content/series/imsa/alkamel-rounds.json';
import { championshipFolder, fetchImsaStandings, indexFolders, IMSA_CLASSES, IMSA_MANUFACTURER_CLASSES, parsePointsCsv, pointsFolderOf } from './imsa';

// IMSA's official points files as Al Kamel files them (read 19 Nov 2026 at
// .../21_Road Atlanta/01_IMSA WeatherTech SportsCar Championship/POINTS DATA - Official/):
// a byte-order mark, "Pos;Participant;Points" then a column per session, a row a participant,
// CRLF; crew-mates level on points share a place.
type Row = readonly [number, string, number];
const csv = (rows: readonly Row[]): string =>
  `﻿Pos;Participant;Points;Daytona_Race_Points;Daytona_Race_Status\r\n${rows.map(([p, n, pts]) => `${p};${n};${pts};${pts};\r\n`).join('')}`;

const drivers = (cls: string): Row[] => Array.from({ length: 10 }, (_, i) => [i + 1, `${cls} Driver ${i + 1}`, 3000 - i * 100] as const);
const FILES: Record<string, Row[]> = {
  'IWSC 01 GTP Drivers': drivers('GTP'),
  'IWSC 02 GTP Teams': [
    [1, '31', 3020],
    [2, '93', 2723],
  ],
  'IWSC 03 GTP Manufacturers': [
    [1, 'Cadillac', 3226],
    [2, 'Porsche', 3165],
  ],
  'IWSC 04 LMP2 Drivers': drivers('LMP2'),
  'IWSC 05 LMP2 Teams': [[1, '04', 2322]],
  'IWSC 08 GTDPRO Drivers': [
    [1, 'Connor De Phillippi', 3017],
    [1, 'Neil Verhagen', 3017],
    [2, 'Andrea Caldarelli', 2979],
    ...drivers('GTD Pro').slice(3),
  ],
  'IWSC 09 GTDPRO Teams': [
    [1, '1', 3017],
    [13, '68', 1144],
    [14, '99', 512],
  ],
  'IWSC 10 GTDPRO Manufacturers': [
    [1, 'Chevrolet', 3248],
    [9, 'Aston Martin', 1206],
  ],
  'IWSC 11 GTD Drivers': drivers('GTD'),
  'IWSC 12 GTD Teams': [
    [1, '57', 3078],
    [14, '068', 1543],
  ],
  'IWSC 13 GTD Manufacturers': [[1, 'Mercedes-AMG', 3339]],
};

// Al Kamel's race file (05_Results by Class_Race_Official.JSON), the cars only.
const entry = (number: string, team: string, vehicle: string, position = 1) => ({
  status: 'Classified',
  position,
  number,
  team,
  class: '',
  vehicle,
  manufacturer: '',
  laps: '349',
  elapsed_time: '',
  gap_first: '',
  drivers: [],
});
const race = (classes: Record<string, ReturnType<typeof entry>[]>) =>
  JSON.stringify({
    session: { event_name: 'Motul Petit Le Mans', session_date: '03-10-2026 12:10', circuit: { name: 'Michelin Raceway Road Atlanta' } },
    classifications: Object.entries(classes).map(([name, classification]) => ({ name, classification })),
  });

const rounds = [...manifest.rounds].sort((a, b) => b.round - a.round);
const NEWEST = rounds[0];
const BEFORE = rounds[1];
const base = (url: string): string => championshipFolder(url) ?? '';
const index = (folders: string[]): string =>
  `<html><body><h1>Index of /Results</h1><a href="?C=N;O=D">Name</a><a href="/Results/26_2026/">Parent Directory</a>${folders.map(f => `<a href="${encodeURIComponent(f)}/">${f}/</a>`).join('')}<a href="00_Championship%20Points%20-%20Official.pdf">pdf</a></body></html>`;

interface Site {
  /** URL → body; any other URL answers 404. */
  pages: Record<string, string>;
  /** URLs that answer 500. */
  broken?: string[];
}
const officialFolder = (url: string, folder = 'POINTS DATA - Official'): string => `${base(url)}${encodeURIComponent(folder)}/`;
const fileUrl = (folder: string, name: string): string => `${folder}${encodeURIComponent(`${name}.csv`)}`;
const site = (opts: { newest?: string[]; before?: string[]; files?: Record<string, Row[] | null>; folderOf?: string } = {}): Site => {
  const folders = opts.newest ?? ['202610031210_Race', 'POINTS DATA - Official', 'Points Data - Provisional'];
  const pointsAt = opts.folderOf ?? officialFolder(NEWEST.url);
  const pages: Record<string, string> = {
    [base(NEWEST.url)]: index(folders),
    [base(BEFORE.url)]: index(opts.before ?? ['POINTS DATA - Official']),
    [NEWEST.url]: race({
      GTP: [entry('31', 'Cadillac Whelen', 'Cadillac V-Series.R'), entry('93', 'Acura Meyer Shank Racing w/Curb Agajanian', 'Acura ARX-06', 2)],
      // As Al Kamel's race file writes it; team-names.json writes imsa.com's spelling.
      LMP2: [entry('04', 'Crowdstrike Racing by APR', 'ORECA LMP2 07')],
      GTDPRO: [entry('68', 'Car Blanche', 'Aston Martin Vantage GT3 Evo'), entry('1', 'Paul Miller Racing', 'BMW M4 GT3 EVO', 3)],
      GTD: [entry('57', 'Winward Racing', 'Mercedes-AMG GT3'), entry('068', 'Car Blanche', 'Aston Martin Vantage GT3', 14)],
    }),
  };
  for (const [name, rows] of Object.entries({ ...FILES, ...opts.files })) if (rows) pages[fileUrl(pointsAt, name)] = csv(rows);
  return { pages };
};

function serve(s: Site) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (s.broken?.includes(url)) return { ok: false, status: 500, text: async () => 'Internal Server Error' };
    const body = s.pages[url];
    return body === undefined ? { ok: false, status: 404, text: async () => 'Not Found' } : { ok: true, status: 200, text: async () => body };
  }) as unknown as typeof fetch;
}

describe('IMSA points files', () => {
  it('reads a file: the byte-order mark, the head, a participant a row, crew-mates sharing a place', () => {
    expect(parsePointsCsv(csv(FILES['IWSC 08 GTDPRO Drivers']))?.slice(0, 3)).toEqual([
      { position: 1, name: 'Connor De Phillippi', points: 3017 },
      { position: 1, name: 'Neil Verhagen', points: 3017 },
      { position: 2, name: 'Andrea Caldarelli', points: 2979 },
    ]);
    // A car number keeps its leading zero.
    expect(parsePointsCsv(csv(FILES['IWSC 12 GTD Teams']))?.[1]).toEqual({ position: 14, name: '068', points: 1543 });
  });

  it('reads no file whose head or any row is not the official one', () => {
    expect(parsePointsCsv(csv(FILES['IWSC 01 GTP Drivers']).replace('Pos;Participant;Points', 'Pos;Driver;Points'))).toBeNull();
    expect(parsePointsCsv(`${csv(FILES['IWSC 01 GTP Drivers'])}x;Someone;10\r\n`)).toBeNull();
    expect(parsePointsCsv(`${csv(FILES['IWSC 01 GTP Drivers'])}11;Someone;\r\n`)).toBeNull();
    expect(parsePointsCsv('﻿Pos;Participant;Points\r\n')).toBeNull();
  });

  it("finds a round's WeatherTech folder by the championship's name, Laguna Seca's event folder notwithstanding", () => {
    const laguna =
      'https://imsa.results.alkamelcloud.com/Results/26_2026/09_Weathertech%20Raceway%20Laguna%20Seca/01_IMSA%20WeatherTech%20SportsCar%20Championship/202605031505_Race/03_Results_Race_Official.JSON';
    expect(championshipFolder(laguna)).toBe('https://imsa.results.alkamelcloud.com/Results/26_2026/09_Weathertech%20Raceway%20Laguna%20Seca/01_IMSA%20WeatherTech%20SportsCar%20Championship/');
    expect(championshipFolder('https://example.com/Results/26_2026/x.JSON')).toBeNull();
  });

  it('takes the official points folder, else the provisional, else a plain one; never an unofficial one', () => {
    expect(indexFolders(index(['202610031210_Race', 'POINTS DATA - Official', 'Points Data - Provisional']))).toEqual(['202610031210_Race', 'POINTS DATA - Official', 'Points Data - Provisional']);
    expect(pointsFolderOf(['Points Data - Provisional', 'POINTS DATA - Official'])).toBe('POINTS DATA - Official');
    // VIR's spelling.
    expect(pointsFolderOf(['Points Data - Offiical', 'Points Data - Provisional'])).toBe('Points Data - Offiical');
    expect(pointsFolderOf(['202610031210_Race', 'Points Data - Provisional'])).toBe('Points Data - Provisional');
    // Daytona's and Laguna Seca's.
    expect(pointsFolderOf(['POINTS DATA'])).toBe('POINTS DATA');
    expect(pointsFolderOf(['Points Data - Unofficial', '202610031210_Race'])).toBeNull();
  });
});

describe('fetchImsaStandings', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reads the newest round's official files: a driver a row, each team named from the race results, the makes as written", async () => {
    serve(site());
    const result = await fetchImsaStandings();
    expect(result).not.toBeNull();
    for (const cls of IMSA_CLASSES) expect(result!.drivers[cls]).toHaveLength(10);
    expect(result!.drivers['GTD Pro'].slice(0, 3)).toEqual([
      { position: 1, driverName: 'Connor De Phillippi', points: 3017 },
      { position: 1, driverName: 'Neil Verhagen', points: 3017 },
      { position: 2, driverName: 'Andrea Caldarelli', points: 2979 },
    ]);
    expect(result!.teams.GTP).toEqual([
      { position: 1, team: '#31 Cadillac Whelen', car: 'Cadillac V-Series.R', points: 3020 },
      { position: 2, team: '#93 Acura Meyer Shank Racing w/Curb Agajanian', car: 'Acura ARX-06', points: 2723 },
    ]);
    // GTD PRO's #68 and GTD's #068 are two cars, each named in its own class; a number no race names stands alone.
    expect(result!.teams['GTD Pro']).toEqual([
      { position: 1, team: '#1 Paul Miller Racing', car: 'BMW M4 GT3 EVO', points: 3017 },
      { position: 13, team: '#68 Car Blanche', car: 'Aston Martin Vantage GT3 Evo', points: 1144 },
      { position: 14, team: '#99', car: undefined, points: 512 },
    ]);
    expect(result!.teams.GTD[1]).toEqual({ position: 14, team: '#068 Car Blanche', car: 'Aston Martin Vantage GT3', points: 1543 });
    expect(result!.teams.LMP2).toEqual([{ position: 1, team: '#04 CrowdStrike Racing by APR', car: 'ORECA LMP2 07', points: 2322 }]);
    for (const cls of IMSA_MANUFACTURER_CLASSES) expect(result!.manufacturers[cls]?.length).toBeGreaterThan(0);
    expect(result!.manufacturers['GTD Pro']).toEqual([
      { position: 1, manufacturer: 'Chevrolet', points: 3248 },
      { position: 9, manufacturer: 'Aston Martin', points: 1206 },
    ]);
    // IMSA awards no LMP2 manufacturers' title.
    expect(result!.manufacturers.LMP2).toBeUndefined();
  });

  it('reads the provisional files until the official ones are filed', async () => {
    const provisional = officialFolder(NEWEST.url, 'Points Data - Provisional');
    serve(site({ newest: ['202610031210_Race', 'Points Data - Provisional'], folderOf: provisional }));
    expect((await fetchImsaStandings())?.teams.GTP[0].points).toBe(3020);
  });

  it('reads the round before when the newest has filed no points yet', async () => {
    serve(site({ newest: ['202610031210_Race'], folderOf: officialFolder(BEFORE.url) }));
    expect((await fetchImsaStandings())?.drivers.GTP[0]).toEqual({ position: 1, driverName: 'GTP Driver 1', points: 3000 });
  });

  it("never stands an older round's points in for the newest's when the newest's folder cannot be read", async () => {
    const s = site({ folderOf: officialFolder(BEFORE.url) });
    serve({ ...s, broken: [base(NEWEST.url)] });
    expect(await fetchImsaStandings()).toBeNull();
  });

  it("fails closed when a class's file is missing or read wrongly", async () => {
    serve(site({ files: { 'IWSC 09 GTDPRO Teams': null } }));
    expect(await fetchImsaStandings()).toBeNull();
    serve(site({ files: { 'IWSC 03 GTP Manufacturers': null } }));
    expect(await fetchImsaStandings()).toBeNull();
    serve(site({ files: { 'IWSC 01 GTP Drivers': [[1, 'GTP Driver 1', Number.NaN]] } }));
    expect(await fetchImsaStandings()).toBeNull();
  });

  it('fails closed below the floor of 30 drivers in all', async () => {
    const short = Object.fromEntries(['IWSC 01 GTP Drivers', 'IWSC 04 LMP2 Drivers', 'IWSC 08 GTDPRO Drivers', 'IWSC 11 GTD Drivers'].map(n => [n, FILES[n].slice(0, 7)]));
    serve(site({ files: short }));
    expect(await fetchImsaStandings()).toBeNull();
  });

  it('sorts by place where a file lists out of order', async () => {
    serve(site({ files: { 'IWSC 01 GTP Drivers': [...drivers('GTP')].reverse() } }));
    expect((await fetchImsaStandings())?.drivers.GTP.map(d => d.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('returns null without throwing when the host answers 500 or the network fails', async () => {
    serve({ pages: {}, broken: [base(NEWEST.url)] });
    expect(await fetchImsaStandings()).toBeNull();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    expect(await fetchImsaStandings()).toBeNull();
  });
});
