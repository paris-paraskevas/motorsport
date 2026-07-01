import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// In-memory fake of the durable `source_snapshot` table so the last-good wrap on
// `fetchNascarCupStandings` can be exercised. `snapshotConfigured` defaults FALSE
// so the pre-existing fetch tests below behave exactly as before (wrapper runs
// the fetcher uncached, as in a test env with no SUPABASE_URL); the last-good
// block flips it on. Mirrors lib/standings/dtm.test.ts.
const snapshotTable = new Map<string, unknown>();
let snapshotConfigured = false;

vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => snapshotConfigured,
  betDb: () => ({
    from: () => {
      let selectedKey: string | null = null;
      const builder = {
        select: () => builder,
        eq: (_col: string, value: string) => {
          selectedKey = value;
          return builder;
        },
        maybeSingle: async () => {
          const raw = selectedKey != null ? snapshotTable.get(selectedKey) : undefined;
          if (raw === undefined) return { data: null, error: null };
          return { data: { payload: JSON.parse(JSON.stringify(raw)) }, error: null };
        },
        upsert: async (row: { source_key: string; payload: unknown }) => {
          snapshotTable.set(row.source_key, row.payload);
          return { data: null, error: null };
        },
      };
      return builder;
    },
  }),
}));

import { fetchNascarCupStandings } from './nascar-cup';

// Build a driver standings row mirroring the Wikipedia 2026 NASCAR Cup Series
// season article: 40 cells total — position <th>, driver <td>, 36 race-result
// <td>s, points <th>, stage <td>. A "win" cell carries inline
// style="background:#FFFFBF;".
function driverRow(opts: {
  position: number;
  name: string;
  finishes: Array<{ pos: string; win?: boolean }>;
  points: number;
  stage: number;
}): string {
  while (opts.finishes.length < 36) {
    opts.finishes.push({ pos: '' });
  }
  const cells = opts.finishes
    .map((f) => {
      const style = f.win ? ' style="background:#FFFFBF;"' : '';
      return `<td${style}>${f.pos}</td>`;
    })
    .join('');
  return `
    <tr>
      <th>${opts.position}</th>
      <td style="text-align:left;"><a href="/wiki/${opts.name.replace(/\s+/g, '_')}">${opts.name}</a></td>
      ${cells}
      <th>${opts.points}</th>
      <td>${opts.stage}</td>
    </tr>
  `;
}

// Build a NASCAR-shaped season page with the three sections needed:
//   1. Chartered_teams (driver -> team lookup)
//   2. Drivers'_championship (standings)
//   3. Manufacturers'_championship (constructor standings)
function buildSeasonPageHtml(opts: {
  drivers: Array<{
    position: number;
    name: string;
    team: string;
    points: number;
    wins: number;
    stagePoints: number;
  }>;
  manufacturers: Array<{ position: number; name: string; wins: number; points: number }>;
}): string {
  // Chartered teams: one row per driver with manufacturer "Toyota" for simplicity
  const chartered = opts.drivers
    .map(
      (d) => `
    <tr>
      <th>Toyota</th>
      <td>${d.team}</td>
      <td>1</td>
      <td><a href="/wiki/${d.name.replace(/\s+/g, '_')}">${d.name}</a></td>
      <td>Some Chief</td>
      <td></td>
    </tr>
    `,
    )
    .join('');

  const driversRows = opts.drivers
    .map((d) => {
      const finishes: Array<{ pos: string; win?: boolean }> = [];
      for (let i = 0; i < d.wins; i++) finishes.push({ pos: '1', win: true });
      while (finishes.length < 36) finishes.push({ pos: '' });
      return driverRow({
        position: d.position,
        name: d.name,
        finishes,
        points: d.points,
        stage: d.stagePoints,
      });
    })
    .join('');

  const manuRows = opts.manufacturers
    .map(
      (m) => `
      <tr>
        <th>${m.position}</th>
        <td>${m.name}</td>
        <td>${m.wins}</td>
        <th>${m.points}</th>
      </tr>
    `,
    )
    .join('');

  return `<!DOCTYPE html>
<html><body>
<h3 id="Chartered_teams">Chartered teams</h3>
<table class="wikitable">
  <tr>
    <th>Manufacturer</th>
    <th>Team</th>
    <th>No.</th>
    <th>Driver</th>
    <th>Crew chief</th>
    <th>References</th>
  </tr>
  ${chartered}
</table>

<h3 id="Drivers'_championship">Drivers' championship</h3>
<table class="wikitable">
  <tbody>
  <tr><th>Pos.</th><th>Driver</th>${Array(36).fill('<th>R</th>').join('')}<th>Pts.</th><th>Stages</th></tr>
  ${driversRows}
  </tbody>
</table>

<h3 id="Manufacturers'_championship">Manufacturers' championship</h3>
<table class="wikitable">
  <tr><th>Pos</th><th>Manufacturer</th><th>Wins</th><th>Points</th></tr>
  ${manuRows}
</table>
</body></html>`;
}

const SAMPLE_DRIVERS = [
  { position: 1, name: 'Tyler Reddick', team: '23XI Racing', points: 567, wins: 4, stagePoints: 96 },
  { position: 2, name: 'Denny Hamlin', team: 'Joe Gibbs Racing', points: 438, wins: 1, stagePoints: 91 },
  { position: 3, name: 'Chase Elliott', team: 'Hendrick Motorsports', points: 422, wins: 1, stagePoints: 61 },
  { position: 4, name: 'Ryan Blaney', team: 'Team Penske', points: 405, wins: 0, stagePoints: 95 },
  { position: 5, name: 'Chris Buescher', team: 'RFK Racing', points: 380, wins: 0, stagePoints: 70 },
  { position: 6, name: 'Kyle Larson', team: 'Hendrick Motorsports', points: 370, wins: 2, stagePoints: 85 },
  { position: 7, name: 'Christopher Bell', team: 'Joe Gibbs Racing', points: 360, wins: 0, stagePoints: 80 },
  { position: 8, name: 'Chase Briscoe', team: 'Joe Gibbs Racing', points: 355, wins: 1, stagePoints: 60 },
  { position: 9, name: 'William Byron', team: 'Hendrick Motorsports', points: 345, wins: 0, stagePoints: 75 },
  { position: 10, name: 'Joey Logano', team: 'Team Penske', points: 335, wins: 1, stagePoints: 50 },
  { position: 11, name: 'Bubba Wallace', team: '23XI Racing', points: 325, wins: 0, stagePoints: 55 },
  { position: 12, name: 'Ross Chastain', team: 'Trackhouse Racing', points: 315, wins: 0, stagePoints: 50 },
  { position: 13, name: 'Alex Bowman', team: 'Hendrick Motorsports', points: 310, wins: 0, stagePoints: 45 },
  { position: 14, name: 'Brad Keselowski', team: 'RFK Racing', points: 305, wins: 0, stagePoints: 40 },
  { position: 15, name: 'Ty Gibbs', team: 'Joe Gibbs Racing', points: 300, wins: 0, stagePoints: 35 },
  { position: 16, name: 'Austin Cindric', team: 'Team Penske', points: 295, wins: 0, stagePoints: 30 },
  { position: 17, name: 'Carson Hocevar', team: 'Spire Motorsports', points: 290, wins: 0, stagePoints: 28 },
  { position: 18, name: 'Tyler Reddick II', team: '23XI Racing', points: 285, wins: 0, stagePoints: 25 },
  { position: 19, name: 'Ryan Preece', team: 'RFK Racing', points: 280, wins: 0, stagePoints: 22 },
  { position: 20, name: 'Kyle Busch', team: 'Richard Childress Racing', points: 275, wins: 0, stagePoints: 20 },
];

const SAMPLE_MANUFACTURERS = [
  { position: 1, name: 'Toyota', wins: 7, points: 547 },
  { position: 2, name: 'Chevrolet', wins: 4, points: 495 },
  { position: 3, name: 'Ford', wins: 1, points: 409 },
];

const FULL_SAMPLE_HTML = buildSeasonPageHtml({
  drivers: SAMPLE_DRIVERS,
  manufacturers: SAMPLE_MANUFACTURERS,
});

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
    text: async () => 'fail',
  }) as unknown as typeof fetch;
}

function mockFetchReject() {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
}

describe('fetchNascarCupStandings', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses a 20-driver standings table with position / driver / team / points / wins', async () => {
    mockFetchOk(FULL_SAMPLE_HTML);
    const result = await fetchNascarCupStandings();
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(20);
    expect(result!.drivers[0]).toEqual({
      position: 1,
      driverName: 'Tyler Reddick',
      team: '23XI Racing',
      points: 567,
      wins: 4,
    });
    expect(result!.drivers[1].driverName).toBe('Denny Hamlin');
    expect(result!.drivers[1].team).toBe('Joe Gibbs Racing');
    expect(result!.drivers[5].driverName).toBe('Kyle Larson');
    expect(result!.drivers[5].wins).toBe(2);
  });

  it('parses the manufacturers championship table into 3 constructors', async () => {
    mockFetchOk(FULL_SAMPLE_HTML);
    const result = await fetchNascarCupStandings();
    expect(result).not.toBeNull();
    expect(result!.constructors).toHaveLength(3);
    expect(result!.constructors[0]).toEqual({
      position: 1,
      name: 'Toyota',
      points: 547,
      wins: 7,
    });
    expect(result!.constructors[2]).toEqual({
      position: 3,
      name: 'Ford',
      points: 409,
      wins: 1,
    });
  });

  it('falls back to "Unknown team" when a driver is absent from the chartered_teams join', async () => {
    // Build a season page where the standings names an extra driver that
    // chartered_teams doesn't include — should not blow up the whole parse.
    const drivers = [...SAMPLE_DRIVERS];
    drivers[19] = {
      position: 20,
      name: 'Mystery Newcomer',
      team: 'placeholder', // chartered uses this name; standings doesn't see it
      points: 250,
      wins: 0,
      stagePoints: 10,
    };
    // Remove from chartered (we cheat: build with a synthetic html that omits the row)
    const html = buildSeasonPageHtml({
      drivers,
      manufacturers: SAMPLE_MANUFACTURERS,
    }).replace(
      /<tr>\s*<th>Toyota<\/th>\s*<td>placeholder<\/td>[\s\S]*?Mystery Newcomer[\s\S]*?<\/tr>/,
      '',
    );
    mockFetchOk(html);
    const result = await fetchNascarCupStandings();
    expect(result).not.toBeNull();
    const mystery = result!.drivers.find((d) => d.driverName === 'Mystery Newcomer');
    expect(mystery).toBeDefined();
    expect(mystery!.team).toBe('Unknown team');
  });

  it('returns null when fewer than 20 drivers parsed (sanity floor)', async () => {
    const fewDrivers = SAMPLE_DRIVERS.slice(0, 5);
    const html = buildSeasonPageHtml({
      drivers: fewDrivers,
      manufacturers: SAMPLE_MANUFACTURERS,
    });
    mockFetchOk(html);
    const result = await fetchNascarCupStandings();
    expect(result).toBeNull();
  });

  it('returns null when the standings table is missing entirely', async () => {
    const html = '<!DOCTYPE html><html><body><h3 id="Other">Other</h3></body></html>';
    mockFetchOk(html);
    const result = await fetchNascarCupStandings();
    expect(result).toBeNull();
  });

  it('returns null on 500 without throwing', async () => {
    mockFetch500();
    const result = await fetchNascarCupStandings();
    expect(result).toBeNull();
  });

  it('returns null on network failure without throwing', async () => {
    mockFetchReject();
    const result = await fetchNascarCupStandings();
    expect(result).toBeNull();
  });

  it('sorts drivers by position even if the table emits them out of order', async () => {
    const reversed = [...SAMPLE_DRIVERS].reverse();
    const html = buildSeasonPageHtml({
      drivers: reversed,
      manufacturers: SAMPLE_MANUFACTURERS,
    });
    mockFetchOk(html);
    const result = await fetchNascarCupStandings();
    expect(result).not.toBeNull();
    const positions = result!.drivers.map((d) => d.position);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });
});

// Durable last-good: a Wikipedia outage / article restructure should serve the
// previous good standings instead of the null that blanks the page. Supabase IS
// configured here (in-memory fake); the standings payload carries no Date fields
// so no rehydration. isEmpty keys off drivers.length.
describe('fetchNascarCupStandings — durable last-good (source_snapshot)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    snapshotTable.clear();
    snapshotConfigured = true;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    snapshotConfigured = false;
    snapshotTable.clear();
    vi.restoreAllMocks();
  });

  it('SUCCESS persists the standings under standings:nascar-cup', async () => {
    mockFetchOk(FULL_SAMPLE_HTML);
    const data = await fetchNascarCupStandings();
    expect(data).not.toBeNull();
    expect(snapshotTable.has('standings:nascar-cup')).toBe(true);
  });

  it('FAILURE serves the last-good standings instead of null', async () => {
    mockFetchOk(FULL_SAMPLE_HTML);
    await fetchNascarCupStandings(); // prime the snapshot
    mockFetch500(); // Wikipedia 500
    const recovered = await fetchNascarCupStandings();
    expect(recovered).not.toBeNull();
    expect(recovered!.drivers).toHaveLength(20);
    expect(recovered!.drivers[0].driverName).toBe('Tyler Reddick');
    expect(recovered!.constructors).toHaveLength(3);
  });

  it('a good fetch overwrites the snapshot (self-heal)', async () => {
    // Seed a deliberately-stale snapshot, then a good fetch must replace it.
    snapshotTable.set('standings:nascar-cup', {
      drivers: [{ position: 1, driverName: 'stale', team: 'x', points: 0, wins: 0 }],
      constructors: [],
    });
    mockFetchOk(FULL_SAMPLE_HTML);
    await fetchNascarCupStandings();
    const stored = snapshotTable.get('standings:nascar-cup') as { drivers: unknown[] };
    expect(stored.drivers).toHaveLength(20);
  });

  it('FAILURE with no snapshot present returns null (today behaviour)', async () => {
    mockFetch500();
    expect(await fetchNascarCupStandings()).toBeNull();
  });

  it('FAIL-SOFT: Supabase unconfigured behaves exactly like the live fetch', async () => {
    snapshotConfigured = false;
    mockFetch500();
    expect(await fetchNascarCupStandings()).toBeNull();
  });
});