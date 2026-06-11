import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchIndyCarSeasonResults,
  parseSeasonResultsFromHtml,
} from './indycar';
import type { CuratedDriversFile } from '@/lib/types';

// Builds a minimal Wikipedia-shaped HTML page with a Driver_standings
// table. The findDriverStandingsTable walker keys on `id="Driver_standings"`
// + walks siblings to a table.wikitable; the table itself uses a header row
// followed by per-driver rows, each cell terminating in a Pts column we
// ignore.
//
// Each round column is a `<th>` whose text is the abbreviation. MIL uses
// `colspan="2"` to model the doubleheader; the driver rows then carry two
// physical cells for that round.

interface RoundHeader {
  abbr: string;
  href?: string;
  colspan?: number;
}

function header(rounds: RoundHeader[]): string {
  const cells = rounds
    .map(r => {
      const cs = r.colspan && r.colspan > 1 ? ` colspan="${r.colspan}"` : '';
      const link = r.href ? `<a href="${r.href}">${r.abbr}</a>` : r.abbr;
      return `<th${cs}>${link}</th>`;
    })
    .join('');
  return (
    `<tr>` +
    `<th>Pos</th><th>Driver</th>` +
    cells +
    `<th>Pts</th>` +
    `</tr>`
  );
}

interface CellSpec {
  // Literal HTML rendered for the cell. Examples:
  //   "1"          → finished P1
  //   "1<sup>L</sup>" → P1 + led laps
  //   "1<sup>L</sup>*" → P1 + led laps + fastest lap
  //   "<b>1</b><sup>L</sup>*" → P1 + pole + led laps + fastest lap
  //   "<i><b>5</b></i><sup>L</sup>" → P5 + pole + fastest lap + led laps
  //   "<b>P</b>"   → pole-only (race not yet run)
  //   "DNS"        → did not start
  //   "Wth"        → withdrew
  //   ""           → empty (race not yet run / driver absent)
  inner: string;
}

function row(opts: {
  pos: number;
  driver: string;
  cells: CellSpec[];
  points: number;
}): string {
  const cellHtml = opts.cells.map(c => `<td>${c.inner}</td>`).join('');
  return (
    `<tr>` +
    `<th>${opts.pos}</th>` +
    `<td><a href="/wiki/${opts.driver.replace(/ /g, '_')}">${opts.driver}</a></td>` +
    cellHtml +
    `<th>${opts.points}</th>` +
    `</tr>`
  );
}

function buildTable(opts: {
  headerHtml: string;
  rowsHtml: string[];
}): string {
  return (
    `<!doctype html><html><body>` +
    `<h3><span class="mw-headline" id="Driver_standings">Driver standings</span></h3>` +
    `<table class="wikitable">` +
    `<tbody>` +
    opts.headerHtml +
    opts.rowsHtml.join('') +
    `</tbody></table></body></html>`
  );
}

// 12 finishers — enough to clear the MIN_FINISHERS_PER_RACE floor of 10.
function twelveFinishers(positions: number[], modifier?: (i: number) => string): string[] {
  return positions.map((p, i) => row({
    pos: p,
    driver: `Driver ${p}`,
    cells: [{ inner: modifier ? modifier(p) : String(p) }],
    points: p * 10,
  }));
}

const DRIVERS_FIXTURE: CuratedDriversFile = {
  teams: [
    {
      name: 'Chip Ganassi Racing',
      drivers: [{ name: 'Driver 1' }],
    },
    {
      name: 'Team Penske',
      drivers: [{ name: 'Driver 2' }],
    },
  ],
};

describe('parseSeasonResultsFromHtml', () => {
  it('parses one round with full classification + computes IndyCar points', () => {
    const headerHtml = header([
      { abbr: 'STP', href: '/wiki/2026_Firestone_Grand_Prix_of_St._Petersburg' },
    ]);
    const rowsHtml = twelveFinishers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const html = buildTable({ headerHtml, rowsHtml });

    const races = parseSeasonResultsFromHtml(html, DRIVERS_FIXTURE);
    expect(races).toHaveLength(1);
    expect(races[0].round).toBe(1);
    expect(races[0].raceName).toBe('Firestone Grand Prix of St. Petersburg');
    expect(races[0].results).toHaveLength(12);

    // P1 base points (no pole/led/fastest in the bare-number fixture).
    expect(races[0].results[0]).toMatchObject({
      position: 1,
      driverName: 'Driver 1',
      team: 'Chip Ganassi Racing',
      status: 'Finished',
      points: 50,
    });
    // P10 = 20; P11 = 19; P25 floor onwards = 5.
    expect(races[0].results[9].points).toBe(20);
    expect(races[0].results[10].points).toBe(19);
  });

  it('adds +1 for pole and +1 for led laps (non-Indy500 round)', () => {
    const headerHtml = header([
      { abbr: 'STP', href: '/wiki/2026_Firestone_Grand_Prix_of_St._Petersburg' },
    ]);
    const rowsHtml = [
      row({
        pos: 1, driver: 'Driver 1',
        cells: [{ inner: '<b>1</b><sup>L</sup>*' }],
        points: 52,
      }),
      ...twelveFinishers([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    ];
    const html = buildTable({ headerHtml, rowsHtml });

    const races = parseSeasonResultsFromHtml(html, DRIVERS_FIXTURE);
    expect(races).toHaveLength(1);
    // 50 (P1) + 1 (pole) + 1 (led laps) = 52
    expect(races[0].results[0].points).toBe(52);
  });

  it('strips superscript qualifying numerals — 1<sup>12</sup> is P1, not P112 (2026 Indy 500 regression)', () => {
    const headerHtml = header([
      { abbr: 'INDY', href: '/wiki/2026_Indianapolis_500' },
    ]);
    // Wikipedia's Indy 500 column decorates the Fast-12 qualifiers with
    // superscript shootout points: winner "1<sup>12</sup>", P2 "2<sup>6</sup>".
    // Flattened text reads "112"/"26" and the real podium vanishes.
    const rowsHtml = [
      row({ pos: 1, driver: 'Driver 1', cells: [{ inner: '1<sup>12</sup><sup>L</sup>' }], points: 53 }),
      row({ pos: 2, driver: 'Driver 2', cells: [{ inner: '2<sup>6</sup>' }], points: 40 }),
      ...twelveFinishers([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]).slice(2),
    ];
    const html = buildTable({ headerHtml, rowsHtml });

    const races = parseSeasonResultsFromHtml(html, DRIVERS_FIXTURE);
    expect(races).toHaveLength(1);
    expect(races[0].results[0]).toMatchObject({
      position: 1,
      driverName: 'Driver 1',
    });
    expect(races[0].results[1].position).toBe(2);
    // P1 Indy 500: 50 base + 1 led laps (no pole bonus at Indy) = 51
    expect(races[0].results[0].points).toBe(51);
    // P2: 40 base, the <sup>6</sup> must not corrupt it to P26 (=4+...)
    expect(races[0].results[1].points).toBe(40);
  });

  it('omits the pole bonus for the Indianapolis 500 (qualifying points are separate)', () => {
    const headerHtml = header([
      { abbr: 'INDY', href: '/wiki/2026_Indianapolis_500' },
    ]);
    const rowsHtml = [
      row({
        pos: 1, driver: 'Driver 1',
        // Polesitter winner who led laps. Normal race = 52; Indy 500 = 51.
        cells: [{ inner: '<b>1</b><sup>L</sup>' }],
        points: 51,
      }),
      ...twelveFinishers([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    ];
    const html = buildTable({ headerHtml, rowsHtml });

    const races = parseSeasonResultsFromHtml(html, DRIVERS_FIXTURE);
    expect(races).toHaveLength(1);
    expect(races[0].raceName).toContain('Indianapolis 500');
    // 50 (P1) + 0 (no pole bonus at Indy) + 1 (led laps) = 51
    expect(races[0].results[0].points).toBe(51);
  });

  it('expands MIL colspan=2 into two separate races (MIL1, MIL2)', () => {
    const headerHtml = header([
      { abbr: 'MIL', href: '/wiki/2026_Milwaukee_Mile', colspan: 2 },
    ]);
    // 12 finishers in MIL1 and 12 in MIL2.
    const finishers = (rIdx: 0 | 1) => [
      row({
        pos: 1, driver: 'Driver 1',
        cells: rIdx === 0
          ? [{ inner: '1' }, { inner: '5' }]
          : [{ inner: '5' }, { inner: '1' }],
        points: 70,
      }),
      ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(p => row({
        pos: p, driver: `Driver ${p}`,
        cells: [{ inner: String(p) }, { inner: String(p) }],
        points: 100,
      })),
    ];
    const html = buildTable({ headerHtml, rowsHtml: finishers(0) });

    const races = parseSeasonResultsFromHtml(html, DRIVERS_FIXTURE);
    // Two RaceResults — one per Milwaukee race.
    expect(races).toHaveLength(2);
    expect(races[0].raceName).toContain('Race 1');
    expect(races[1].raceName).toContain('Race 2');
    // Round numbers come from physical column index — Mile R1 = round 1,
    // Mile R2 = round 2.
    expect(races[0].round).toBe(1);
    expect(races[1].round).toBe(2);
    // Driver 1 finished P1 in MIL1 (50pts) and P5 in MIL2 (30pts).
    const d1InMil1 = races[0].results.find(r => r.driverName === 'Driver 1')!;
    const d1InMil2 = races[1].results.find(r => r.driverName === 'Driver 1')!;
    expect(d1InMil1.position).toBe(1);
    expect(d1InMil1.points).toBe(50);
    expect(d1InMil2.position).toBe(5);
    expect(d1InMil2.points).toBe(30);
    // MIL2 winner is whichever driver finished P2 in our fixture (Driver 2),
    // because all other drivers (3-12) share their MIL1 position to MIL2.
    expect(races[1].results[0].position).toBe(2);
  });

  it('marks DNS / Wth / EX / DNQ cells with the status code and zero points', () => {
    const headerHtml = header([
      { abbr: 'STP', href: '/wiki/2026_Firestone_Grand_Prix_of_St._Petersburg' },
    ]);
    const rowsHtml = [
      ...twelveFinishers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      row({ pos: 13, driver: 'Driver 13', cells: [{ inner: 'DNS' }], points: 0 }),
      row({ pos: 14, driver: 'Driver 14', cells: [{ inner: 'Wth' }], points: 0 }),
      row({ pos: 15, driver: 'Driver 15', cells: [{ inner: 'EX' }], points: 0 }),
      row({ pos: 16, driver: 'Driver 16', cells: [{ inner: 'DNQ' }], points: 0 }),
    ];
    const html = buildTable({ headerHtml, rowsHtml });

    const races = parseSeasonResultsFromHtml(html, DRIVERS_FIXTURE);
    expect(races).toHaveLength(1);
    // 12 finishers + 4 non-finishers.
    expect(races[0].results).toHaveLength(16);
    // Non-finishers sorted to the bottom in their original status order.
    const tail = races[0].results.slice(12);
    expect(tail.map(t => t.status)).toEqual(['DNS', 'WTH', 'EX', 'DNQ']);
    expect(tail.every(t => t.points === 0)).toBe(true);
  });

  it('drops empty cells and pole-only "P" pre-race markers', () => {
    const headerHtml = header([
      { abbr: 'STP', href: '/wiki/2026_Firestone_Grand_Prix_of_St._Petersburg' },
      { abbr: 'INDY', href: '/wiki/2026_Indianapolis_500' },
    ]);
    // Driver 1 finished P1 at STP, has only a pole-only marker at INDY (race
    // hasn't run). Driver 2 - 12 are finishers at STP but absent from INDY.
    const rowsHtml = [
      row({
        pos: 1, driver: 'Driver 1',
        cells: [{ inner: '1' }, { inner: '<b>P</b>' }],
        points: 50,
      }),
      ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(p => row({
        pos: p, driver: `Driver ${p}`,
        cells: [{ inner: String(p) }, { inner: '' }],
        points: p * 10,
      })),
    ];
    const html = buildTable({ headerHtml, rowsHtml });

    const races = parseSeasonResultsFromHtml(html, DRIVERS_FIXTURE);
    // Only STP races. INDY has 0 finishers (pole-only on Driver 1, empty on
    // others) so it falls below the 10-finisher floor.
    expect(races).toHaveLength(1);
    expect(races[0].raceName).toContain('St. Petersburg');
  });

  it('drops a round whose finisher count is below the sanity floor', () => {
    const headerHtml = header([
      { abbr: 'STP', href: '/wiki/2026_Firestone_Grand_Prix_of_St._Petersburg' },
    ]);
    // Only 5 finishers — well below MIN_FINISHERS_PER_RACE = 10.
    const rowsHtml = [1, 2, 3, 4, 5].map(p => row({
      pos: p, driver: `Driver ${p}`,
      cells: [{ inner: String(p) }],
      points: p * 10,
    }));
    const html = buildTable({ headerHtml, rowsHtml });

    const races = parseSeasonResultsFromHtml(html, DRIVERS_FIXTURE);
    expect(races).toEqual([]);
  });

  it('returns empty array when the Driver_standings table is missing', () => {
    const html =
      `<!doctype html><html><body>` +
      `<h3><span id="Some_Other_Section">Other</span></h3>` +
      `<table class="wikitable"><tbody><tr><th>Foo</th></tr></tbody></table>` +
      `</body></html>`;
    const races = parseSeasonResultsFromHtml(html, DRIVERS_FIXTURE);
    expect(races).toEqual([]);
  });

  it('renders driver rows without team when drivers.json has no match', () => {
    const headerHtml = header([
      { abbr: 'STP', href: '/wiki/2026_Firestone_Grand_Prix_of_St._Petersburg' },
    ]);
    const rowsHtml = twelveFinishers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const html = buildTable({ headerHtml, rowsHtml });

    // No drivers passed — team should be empty.
    const races = parseSeasonResultsFromHtml(html, null);
    expect(races).toHaveLength(1);
    expect(races[0].results.every(r => r.team === '')).toBe(true);
  });
});

describe('fetchIndyCarSeasonResults', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches Wikipedia and parses', async () => {
    const headerHtml = header([
      { abbr: 'STP', href: '/wiki/2026_Firestone_Grand_Prix_of_St._Petersburg' },
    ]);
    const rowsHtml = twelveFinishers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const html = buildTable({ headerHtml, rowsHtml });
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200, text: async () => html,
    } as Response)) as unknown as typeof fetch;

    const races = await fetchIndyCarSeasonResults({ drivers: DRIVERS_FIXTURE });
    expect(races).toHaveLength(1);
    expect(races[0].raceName).toContain('St. Petersburg');
  });

  it('returns an empty array on fetch failure', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 500, text: async () => 'Internal',
    } as Response)) as unknown as typeof fetch;
    const races = await fetchIndyCarSeasonResults({ drivers: null });
    expect(races).toEqual([]);
  });

  it('returns an empty array when fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const races = await fetchIndyCarSeasonResults({ drivers: null });
    expect(races).toEqual([]);
  });
});
