import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// In-memory fake of the durable `source_snapshot` table so the last-good wrap on
// `fetchFormulaEStandings` can be exercised. `snapshotConfigured` defaults FALSE
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

import { fetchFormulaEStandings } from './formula-e';

// Realistic fixture mirroring the Wikipedia REST HTML payload for
// 2025–26_Formula_E_World_Championship. Two wikitable tables — the Drivers'
// Championship (with a "Driver" column and 11 race-position columns we don't
// parse) and the Teams' Championship.

function driversTable(rows: string): string {
  return `
    <table class="wikitable">
      <tbody>
        <tr>
          <th>Pos.</th><th>Driver</th>
          <th>SAO</th><th>MEX</th><th>MIA</th><th>JED</th><th>JED</th>
          <th>MAD</th><th>BER</th><th>BER</th><th>MCO</th><th>MCO</th>
          <th>Pts</th>
        </tr>
        ${rows}
      </tbody>
    </table>
  `;
}

function driversRow(opts: { pos: number; driver: string; team?: string; pts: number }): string {
  // Note: real Wikipedia article does NOT carry the team in the drivers
  // standings table. Our parser tolerates the missing column → "Unknown".
  // The optional `team` arg lets specific tests verify the team-column path.
  if (opts.team) {
    return `
      <tr>
        <td>${opts.pos}</td>
        <td>${opts.driver}<span class="legend"></span></td>
        <td>${opts.team}</td>
        <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td>
        <td>6</td><td>7</td><td>8</td><td>9</td><td>10</td>
        <td>${opts.pts}</td>
      </tr>
    `;
  }
  return `
    <tr>
      <td>${opts.pos}</td>
      <td>${opts.driver}<sup>[a]</sup></td>
      <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td>
      <td>6</td><td>7</td><td>8</td><td>9</td><td>10</td>
      <td>${opts.pts}</td>
    </tr>
  `;
}

function teamsTable(rows: string): string {
  return `
    <table class="wikitable">
      <tbody>
        <tr>
          <th>Pos.</th><th>Team</th>
          <th>SAO</th><th>MEX</th><th>MIA</th><th>JED</th><th>JED</th>
          <th>MAD</th><th>BER</th><th>BER</th><th>MCO</th><th>MCO</th>
          <th>Pts</th>
        </tr>
        ${rows}
      </tbody>
    </table>
  `;
}

function teamsRow(opts: { pos: number; team: string; pts: number }): string {
  return `
    <tr>
      <td>${opts.pos}</td>
      <td>${opts.team}</td>
      <td>1</td><td>2</td><td>3</td><td>4</td><td>5</td>
      <td>6</td><td>7</td><td>8</td><td>9</td><td>10</td>
      <td>${opts.pts}</td>
    </tr>
  `;
}

const REAL_DRIVERS_ROWS = [
  driversRow({ pos: 1, driver: 'Mitch Evans', pts: 128 }),
  driversRow({ pos: 2, driver: 'Oliver Rowland', pts: 109 }),
  driversRow({ pos: 3, driver: 'Edoardo Mortara', pts: 103 }),
  driversRow({ pos: 4, driver: 'Pascal Wehrlein', pts: 101 }),
  driversRow({ pos: 5, driver: 'Nico Müller', pts: 83 }),
  driversRow({ pos: 6, driver: 'António Félix da Costa', pts: 80 }),
  driversRow({ pos: 7, driver: 'Nick Cassidy', pts: 71 }),
  driversRow({ pos: 8, driver: 'Jake Dennis', pts: 66 }),
  driversRow({ pos: 9, driver: 'Sébastien Buemi', pts: 65 }),
  driversRow({ pos: 10, driver: 'Nyck de Vries', pts: 43 }),
  driversRow({ pos: 11, driver: 'Pepe Martí', pts: 40 }),
  driversRow({ pos: 12, driver: 'Joel Eriksson', pts: 34 }),
  driversRow({ pos: 13, driver: 'Felipe Drugovich', pts: 32 }),
  driversRow({ pos: 14, driver: 'Dan Ticktum', pts: 28 }),
  driversRow({ pos: 15, driver: 'Taylor Barnard', pts: 24 }),
].join('');

const REAL_TEAMS_ROWS = [
  teamsRow({ pos: 1, team: 'Jaguar TCS Racing', pts: 208 }),
  teamsRow({ pos: 2, team: 'Porsche Formula E Team', pts: 184 }),
  teamsRow({ pos: 3, team: 'Mahindra Racing', pts: 146 }),
  teamsRow({ pos: 4, team: 'Nissan Formula E Team', pts: 120 }),
  teamsRow({ pos: 5, team: 'Envision Racing', pts: 99 }),
  teamsRow({ pos: 6, team: 'Andretti Formula E', pts: 98 }),
  teamsRow({ pos: 7, team: 'Citroën Racing', pts: 85 }),
  teamsRow({ pos: 8, team: 'Cupra Kiro', pts: 68 }),
  teamsRow({ pos: 9, team: 'DS Penske', pts: 34 }),
  teamsRow({ pos: 10, team: 'Lola Yamaha ABT', pts: 8 }),
].join('');

const REAL_HTML = `<!DOCTYPE html>
<html><body>
${driversTable(REAL_DRIVERS_ROWS)}
${teamsTable(REAL_TEAMS_ROWS)}
</body></html>`;

const TEAMS_ONLY_HTML = `<!DOCTYPE html>
<html><body>
<p>No drivers table here, just teams.</p>
${teamsTable(REAL_TEAMS_ROWS)}
</body></html>`;

const DRIVERS_ONLY_HTML = `<!DOCTYPE html>
<html><body>
${driversTable(REAL_DRIVERS_ROWS)}
<p>No teams table.</p>
</body></html>`;

const PARTIAL_DRIVERS_HTML = `<!DOCTYPE html>
<html><body>
${driversTable(
  [
    driversRow({ pos: 1, driver: 'Mitch Evans', pts: 128 }),
    driversRow({ pos: 2, driver: 'Oliver Rowland', pts: 109 }),
    driversRow({ pos: 3, driver: 'Edoardo Mortara', pts: 103 }),
  ].join(''),
)}
${teamsTable(REAL_TEAMS_ROWS)}
</body></html>`;

const SPA_SHELL_HTML = `<!DOCTYPE html>
<html><body><div id="root"></div><p>Loading…</p></body></html>`;

// Drivers table with a team column inline (defensive — Wikipedia editors
// sometimes add this; our parser detects and uses it when present).
function driversRowWithTeam(opts: { pos: number; driver: string; team: string; pts: number }): string {
  return `
    <tr>
      <td>${opts.pos}</td>
      <td>${opts.driver}</td>
      <td>${opts.team}</td>
      <td>${opts.pts}</td>
    </tr>
  `;
}

const WITH_TEAM_COLUMN_HTML = `<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr><th>Pos.</th><th>Driver</th><th>Team</th><th>Pts</th></tr>
    ${driversRowWithTeam({ pos: 1, driver: 'Mitch Evans', team: 'Jaguar TCS Racing', pts: 128 })}
    ${driversRowWithTeam({ pos: 2, driver: 'Oliver Rowland', team: 'Nissan Formula E Team', pts: 109 })}
    ${driversRowWithTeam({ pos: 3, driver: 'Edoardo Mortara', team: 'Mahindra Racing', pts: 103 })}
    ${driversRowWithTeam({ pos: 4, driver: 'Pascal Wehrlein', team: 'Porsche Formula E Team', pts: 101 })}
    ${driversRowWithTeam({ pos: 5, driver: 'Nico Müller', team: 'Porsche Formula E Team', pts: 83 })}
    ${driversRowWithTeam({ pos: 6, driver: 'António Félix da Costa', team: 'Jaguar TCS Racing', pts: 80 })}
    ${driversRowWithTeam({ pos: 7, driver: 'Nick Cassidy', team: 'Citroën Racing', pts: 71 })}
    ${driversRowWithTeam({ pos: 8, driver: 'Jake Dennis', team: 'Andretti Formula E', pts: 66 })}
    ${driversRowWithTeam({ pos: 9, driver: 'Sébastien Buemi', team: 'Envision Racing', pts: 65 })}
    ${driversRowWithTeam({ pos: 10, driver: 'Nyck de Vries', team: 'Mahindra Racing', pts: 43 })}
    ${driversRowWithTeam({ pos: 11, driver: 'Pepe Martí', team: 'Cupra Kiro', pts: 40 })}
    ${driversRowWithTeam({ pos: 12, driver: 'Joel Eriksson', team: 'Envision Racing', pts: 34 })}
  </tbody>
</table>
${teamsTable(REAL_TEAMS_ROWS)}
</body></html>`;

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
  globalThis.fetch = vi.fn().mockRejectedValue(
    new Error('network down'),
  ) as unknown as typeof fetch;
}

describe('fetchFormulaEStandings', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses both Drivers and Teams Championship tables from a realistic Wikipedia HTML', async () => {
    mockFetchOk(REAL_HTML);
    const result = await fetchFormulaEStandings();
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(15);
    expect(result!.drivers[0]).toEqual({
      position: 1,
      driverName: 'Mitch Evans',
      team: '',
      points: 128,
    });
    expect(result!.drivers[5].driverName).toBe('António Félix da Costa');
    expect(result!.drivers[5].points).toBe(80);
    expect(result!.constructors).toHaveLength(10);
    expect(result!.constructors[0]).toEqual({
      position: 1,
      name: 'Jaguar TCS Racing',
      points: 208,
    });
    expect(result!.constructors[9].name).toBe('Lola Yamaha ABT');
  });

  it('uses the team column when Wikipedia exposes one inline', async () => {
    mockFetchOk(WITH_TEAM_COLUMN_HTML);
    const result = await fetchFormulaEStandings();
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(12);
    // First row carries the team via the dedicated column.
    expect(result!.drivers[0].team).toBe('Jaguar TCS Racing');
    expect(result!.drivers[1].team).toBe('Nissan Formula E Team');
    expect(result!.drivers[4].team).toBe('Porsche Formula E Team');
  });

  it('sorts driver standings by position even if rows are out of order', async () => {
    const reversed = [
      driversRow({ pos: 15, driver: 'Taylor Barnard', pts: 24 }),
      driversRow({ pos: 14, driver: 'Dan Ticktum', pts: 28 }),
      driversRow({ pos: 13, driver: 'Felipe Drugovich', pts: 32 }),
      driversRow({ pos: 12, driver: 'Joel Eriksson', pts: 34 }),
      driversRow({ pos: 11, driver: 'Pepe Martí', pts: 40 }),
      driversRow({ pos: 10, driver: 'Nyck de Vries', pts: 43 }),
      driversRow({ pos: 9, driver: 'Sébastien Buemi', pts: 65 }),
      driversRow({ pos: 8, driver: 'Jake Dennis', pts: 66 }),
      driversRow({ pos: 7, driver: 'Nick Cassidy', pts: 71 }),
      driversRow({ pos: 6, driver: 'António Félix da Costa', pts: 80 }),
      driversRow({ pos: 5, driver: 'Nico Müller', pts: 83 }),
      driversRow({ pos: 4, driver: 'Pascal Wehrlein', pts: 101 }),
      driversRow({ pos: 3, driver: 'Edoardo Mortara', pts: 103 }),
      driversRow({ pos: 2, driver: 'Oliver Rowland', pts: 109 }),
      driversRow({ pos: 1, driver: 'Mitch Evans', pts: 128 }),
    ].join('');
    const html = `<!DOCTYPE html><html><body>${driversTable(reversed)}${teamsTable(REAL_TEAMS_ROWS)}</body></html>`;
    mockFetchOk(html);
    const result = await fetchFormulaEStandings();
    expect(result).not.toBeNull();
    expect(result!.drivers.map((d) => d.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
    expect(result!.drivers[0].driverName).toBe('Mitch Evans');
  });

  it('returns null when the drivers table is below the sanity floor', async () => {
    mockFetchOk(PARTIAL_DRIVERS_HTML);
    const result = await fetchFormulaEStandings();
    expect(result).toBeNull();
  });

  it('returns null when only the teams table is found', async () => {
    mockFetchOk(TEAMS_ONLY_HTML);
    const result = await fetchFormulaEStandings();
    expect(result).toBeNull();
  });

  it('returns null when only the drivers table is found', async () => {
    mockFetchOk(DRIVERS_ONLY_HTML);
    const result = await fetchFormulaEStandings();
    expect(result).toBeNull();
  });

  it('returns null on an SPA shell with no tables', async () => {
    mockFetchOk(SPA_SHELL_HTML);
    const result = await fetchFormulaEStandings();
    expect(result).toBeNull();
  });

  it('returns null on 500 without throwing', async () => {
    mockFetch500();
    const result = await fetchFormulaEStandings();
    expect(result).toBeNull();
  });

  it('returns null on network failure without throwing', async () => {
    mockFetchReject();
    const result = await fetchFormulaEStandings();
    expect(result).toBeNull();
  });
});

// Durable last-good: a Wikipedia outage / article restructure should serve the
// previous good standings instead of the null that blanks the page. Supabase IS
// configured here (in-memory fake); FormulaEStandings carries no Date fields so
// no rehydration. isEmpty keys off drivers.length.
describe('fetchFormulaEStandings — durable last-good (source_snapshot)', () => {
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

  it('SUCCESS persists the standings under standings:formula-e', async () => {
    mockFetchOk(REAL_HTML);
    const data = await fetchFormulaEStandings();
    expect(data).not.toBeNull();
    expect(snapshotTable.has('standings:formula-e')).toBe(true);
  });

  it('FAILURE serves the last-good standings instead of null', async () => {
    mockFetchOk(REAL_HTML);
    await fetchFormulaEStandings(); // prime the snapshot
    mockFetch500(); // Wikipedia 500 everywhere
    const recovered = await fetchFormulaEStandings();
    expect(recovered).not.toBeNull();
    expect(recovered!.drivers).toHaveLength(15);
    expect(recovered!.drivers[0].driverName).toBe('Mitch Evans');
    expect(recovered!.constructors).toHaveLength(10);
  });

  it('a good fetch overwrites the snapshot (self-heal)', async () => {
    // Seed a deliberately-stale snapshot, then a good fetch must replace it.
    snapshotTable.set('standings:formula-e', {
      drivers: [{ position: 1, driverName: 'stale', team: '', points: 0 }],
      constructors: [],
    });
    mockFetchOk(REAL_HTML);
    await fetchFormulaEStandings();
    const stored = snapshotTable.get('standings:formula-e') as { drivers: unknown[] };
    expect(stored.drivers).toHaveLength(15);
  });

  it('FAILURE with no snapshot present returns null (today behaviour)', async () => {
    mockFetch500();
    expect(await fetchFormulaEStandings()).toBeNull();
  });

  it('FAIL-SOFT: Supabase unconfigured behaves exactly like the live fetch', async () => {
    snapshotConfigured = false;
    mockFetch500();
    expect(await fetchFormulaEStandings()).toBeNull();
  });
});
