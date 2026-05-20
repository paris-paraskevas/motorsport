import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchImsaStandings, IMSA_CLASSES, IMSA_MANUFACTURER_CLASSES } from './imsa';

// Fixtures mirror the actual structure of the Wikipedia
// `2026_IMSA_SportsCar_Championship` page (verified via Playwright probe
// 2026-05-20). Schema: H2 "Championship standings" > H3 section >
// H4 "Standings: <class name>" > wikitable.

function driverRow(opts: {
  pos: number;
  driver: string;
  finishes: string[];
  points: number;
  mec?: number;
}): string {
  const finishCells = opts.finishes
    .map(f => `<td align="center">${f}</td>`)
    .join('');
  const mecCell = opts.mec != null ? `<th>${opts.mec}</th>` : '<th></th>';
  return `<tr><th>${opts.pos}</th><td>${opts.driver}</td>${finishCells}<th>${opts.points}</th>${mecCell}</tr>`;
}

function teamRow(opts: {
  pos: number;
  team: string;
  car: string;
  finishes: string[];
  points: number;
  mec?: number;
}): string {
  const finishCells = opts.finishes
    .map(f => `<td align="center">${f}</td>`)
    .join('');
  const mecCell = opts.mec != null ? `<th>${opts.mec}</th>` : '<th></th>';
  return `<tr><th>${opts.pos}</th><td>${opts.team}</td><td>${opts.car}</td>${finishCells}<th>${opts.points}</th>${mecCell}</tr>`;
}

function manufacturerRow(opts: {
  pos: number;
  manufacturer: string;
  finishes: string[];
  points: number;
  mec?: number;
}): string {
  const finishCells = opts.finishes
    .map(f => `<td align="center">${f}</td>`)
    .join('');
  const mecCell = opts.mec != null ? `<th>${opts.mec}</th>` : '<th></th>';
  return `<tr><th>${opts.pos}</th><td>${opts.manufacturer}</td>${finishCells}<th>${opts.points}</th>${mecCell}</tr>`;
}

// A complete (if minimal) page: every class populated with enough rows to
// clear the sanity floor.
function buildPageHtml(opts?: {
  // Allow tests to chop specific tables out to simulate upstream drift.
  omitGTPdrivers?: boolean;
  omitLMP2manufacturers?: boolean;
  omitGTDmanufacturers?: boolean;
  omitGTPmanufacturers?: boolean;
  omitGTDProteams?: boolean;
  noPointsColumn?: boolean;
}): string {
  const cls = (label: string, code: string) =>
    `<h4>Standings: ${label} (${code})</h4>`;

  // Build minimal valid driver/team/manufacturer tables. The Wikipedia tables
  // are massive — these mirror the column order (Pos | name/team[+car] |
  // <round columns> | Points | MEC) but with three rounds and three rows
  // per class to keep readable.
  const driverHeader = (codes: string[]) =>
    `<tr><th>Pos.</th><th>Drivers</th>${codes.map(c => `<th>${c}</th>`).join('')}<th>Points</th><th>MEC</th></tr>`;
  const teamHeader = (codes: string[]) =>
    `<tr><th>Pos.</th><th>Team</th><th>Car</th>${codes.map(c => `<th>${c}</th>`).join('')}<th>Points</th><th>MEC</th></tr>`;
  const manufHeader = (codes: string[]) =>
    `<tr><th>Pos.</th><th>Manufacturer</th>${codes.map(c => `<th>${c}</th>`).join('')}<th>Points</th><th>MEC</th></tr>`;

  // The class drives the round-codes shown; for fixture purposes we use the
  // same three codes everywhere.
  const codes = ['DAY', 'SEB', 'LBH'];

  // 10 drivers per class so total clears the 30-row sanity floor.
  function driversTableFor(cls: string): string {
    const rows: string[] = [];
    for (let i = 1; i <= 10; i++) {
      rows.push(
        driverRow({
          pos: i,
          driver: `${cls} Driver ${i}`,
          finishes: ['1', '2', '3'],
          points: 1400 - i * 30,
          mec: 35 - i * 2,
        }),
      );
    }
    return `<table class="wikitable">${driverHeader(codes)}${rows.join('')}</table>`;
  }

  function teamsTableFor(cls: string): string {
    const rows: string[] = [];
    for (let i = 1; i <= 5; i++) {
      rows.push(
        teamRow({
          pos: i,
          team: `#${i} ${cls} Team ${i}`,
          car: `Car Model ${i}`,
          finishes: ['1', '2', '3'],
          points: 1400 - i * 30,
        }),
      );
    }
    return `<table class="wikitable">${teamHeader(codes)}${rows.join('')}</table>`;
  }

  function manufacturersTableFor(cls: string): string {
    const rows: string[] = [];
    for (let i = 1; i <= 3; i++) {
      rows.push(
        manufacturerRow({
          pos: i,
          manufacturer: `${cls} Manufacturer ${i}`,
          finishes: ['1', '2', '3'],
          points: 1400 - i * 50,
        }),
      );
    }
    return `<table class="wikitable">${manufHeader(codes)}${rows.join('')}</table>`;
  }

  const driversBlock = `
    <h3>Drivers' Championships</h3>
    ${cls('Grand Touring Prototype', 'GTP')}
    ${opts?.omitGTPdrivers ? '' : driversTableFor('GTP')}
    ${cls('Le Mans Prototype 2', 'LMP2')}
    ${driversTableFor('LMP2')}
    ${cls('GT Daytona Pro', 'GTD Pro')}
    ${driversTableFor('GTD Pro')}
    ${cls('GT Daytona', 'GTD')}
    ${driversTableFor('GTD')}
  `;

  const teamsBlock = `
    <h3>Teams' Championships</h3>
    ${cls('Grand Touring Prototype', 'GTP')}
    ${teamsTableFor('GTP')}
    ${cls('Le Mans Prototype 2', 'LMP2')}
    ${teamsTableFor('LMP2')}
    ${cls('GT Daytona Pro', 'GTD Pro')}
    ${opts?.omitGTDProteams ? '' : teamsTableFor('GTD Pro')}
    ${cls('GT Daytona', 'GTD')}
    ${teamsTableFor('GTD')}
  `;

  const manufacturersBlock = `
    <h3>Manufacturers' Championships</h3>
    ${cls('Grand Touring Prototype', 'GTP')}
    ${opts?.omitGTPmanufacturers ? '' : manufacturersTableFor('GTP')}
    ${cls('GT Daytona Pro', 'GTD Pro')}
    ${manufacturersTableFor('GTD Pro')}
    ${cls('GT Daytona', 'GTD')}
    ${opts?.omitGTDmanufacturers ? '' : manufacturersTableFor('GTD')}
  `;

  // Some unrelated h2/h3 to ensure the parser anchors only on the matching
  // section heading (otherwise it would also try to parse "Schedule" tables).
  const html = `
<html><body>
  <h2>Schedule</h2>
  <table class="wikitable"><tr><th>Round</th><th>Date</th></tr><tr><td>1</td><td>2026-01-25</td></tr></table>
  <h2>Championship standings</h2>
  <h3>Points systems</h3>
  <table class="wikitable"><tr><th>Position</th><th>1</th><th>2</th></tr><tr><td>Race</td><td>350</td><td>320</td></tr></table>
  ${driversBlock}
  ${teamsBlock}
  ${manufacturersBlock}
  <h2>See also</h2>
</body></html>
`;

  if (opts?.noPointsColumn) {
    return html.replace(/<th>Points<\/th>/g, '<th>Pts</th>');
  }
  return html;
}

function mockFetchOk(html: string) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => html,
  }) as unknown as typeof fetch;
}
function mockFetch500() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    text: async () => 'Internal Server Error',
  }) as unknown as typeof fetch;
}
function mockFetchReject() {
  globalThis.fetch = vi
    .fn()
    .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
}

describe('fetchImsaStandings', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses drivers / teams / manufacturers across all classes', async () => {
    mockFetchOk(buildPageHtml());
    const result = await fetchImsaStandings();
    expect(result).not.toBeNull();
    // Drivers: 10 per class × 4 classes
    for (const cls of IMSA_CLASSES) {
      expect(result!.drivers[cls]).toHaveLength(10);
      expect(result!.drivers[cls][0]).toEqual({
        position: 1,
        driverName: `${cls} Driver 1`,
        points: 1370,
      });
      // Confirm sorted by position
      const positions = result!.drivers[cls].map(d => d.position);
      expect(positions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
    // Teams: 5 per class × 4 classes; car preserved
    for (const cls of IMSA_CLASSES) {
      expect(result!.teams[cls]).toHaveLength(5);
      expect(result!.teams[cls][0]).toEqual({
        position: 1,
        team: `#1 ${cls} Team 1`,
        car: 'Car Model 1',
        points: 1370,
      });
    }
    // Manufacturers: only GTP / GTD Pro / GTD
    for (const cls of IMSA_MANUFACTURER_CLASSES) {
      expect(result!.manufacturers[cls]).toBeDefined();
      expect(result!.manufacturers[cls]!).toHaveLength(3);
      expect(result!.manufacturers[cls]![0]).toEqual({
        position: 1,
        manufacturer: `${cls} Manufacturer 1`,
        points: 1350,
      });
    }
    // LMP2 manufacturers should be absent (no LMP2 manufacturers' title in IMSA)
    expect(result!.manufacturers.LMP2).toBeUndefined();
  });

  it('fails closed when GTP drivers table is missing (class drift)', async () => {
    mockFetchOk(buildPageHtml({ omitGTPdrivers: true }));
    const result = await fetchImsaStandings();
    expect(result).toBeNull();
  });

  it('fails closed when GTD Pro teams table is missing', async () => {
    mockFetchOk(buildPageHtml({ omitGTDProteams: true }));
    const result = await fetchImsaStandings();
    expect(result).toBeNull();
  });

  it('fails closed when GTP manufacturers table is missing', async () => {
    mockFetchOk(buildPageHtml({ omitGTPmanufacturers: true }));
    const result = await fetchImsaStandings();
    expect(result).toBeNull();
  });

  it('fails closed when the Points column is renamed (header drift)', async () => {
    mockFetchOk(buildPageHtml({ noPointsColumn: true }));
    const result = await fetchImsaStandings();
    expect(result).toBeNull();
  });

  it('returns null on 500 without throwing', async () => {
    mockFetch500();
    const result = await fetchImsaStandings();
    expect(result).toBeNull();
  });

  it('returns null on network failure without throwing', async () => {
    mockFetchReject();
    const result = await fetchImsaStandings();
    expect(result).toBeNull();
  });

  it('sorts drivers by position even when the source emits out of order', async () => {
    // Build HTML with rows emitted in reverse-rank order; parser should resort.
    const reversedRows: string[] = [];
    for (let i = 10; i >= 1; i--) {
      reversedRows.push(
        `<tr><th>${i}</th><td>GTP Driver ${i}</td><td align="center">1</td><td align="center">2</td><td align="center">3</td><th>${1400 - i * 30}</th><th>0</th></tr>`,
      );
    }
    const reversedGtpTable = `<table class="wikitable"><tr><th>Pos.</th><th>Drivers</th><th>DAY</th><th>SEB</th><th>LBH</th><th>Points</th><th>MEC</th></tr>${reversedRows.join('')}</table>`;
    // Swap the standard GTP drivers table for the reversed one
    const standard = buildPageHtml();
    const swapped = standard.replace(
      /<h4>Standings: Grand Touring Prototype \(GTP\)<\/h4>\s*<table class="wikitable">[\s\S]*?<\/table>/,
      `<h4>Standings: Grand Touring Prototype (GTP)</h4>${reversedGtpTable}`,
    );
    mockFetchOk(swapped);
    const result = await fetchImsaStandings();
    expect(result).not.toBeNull();
    expect(result!.drivers.GTP.map(d => d.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });
});
