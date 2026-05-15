import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchSeasonLineup } from './wikipedia-season';

// Drivers in one cell, separated by <br>. Mirrors the F1 "Entries" table shape.
const F1_STYLE_HTML = `
<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr>
      <th>Constructor</th>
      <th>Chassis</th>
      <th>Engine</th>
      <th>No.</th>
      <th>Race drivers</th>
    </tr>
    <tr>
      <td>Oracle Red Bull Racing</td>
      <td>RB22</td>
      <td>Ford</td>
      <td>1<br>22</td>
      <td>Max Verstappen<br>Yuki Tsunoda</td>
    </tr>
    <tr>
      <td>Mercedes-AMG Petronas F1 Team</td>
      <td>W17</td>
      <td>Mercedes</td>
      <td>63<br>12</td>
      <td>George Russell<br>Andrea Kimi Antonelli</td>
    </tr>
    <tr>
      <td>McLaren F1 Team</td>
      <td>MCL40</td>
      <td>Mercedes</td>
      <td>4<br>81</td>
      <td>Lando Norris<br>Oscar Piastri</td>
    </tr>
    <tr>
      <td>Scuderia Ferrari HP</td>
      <td>SF-26</td>
      <td>Ferrari</td>
      <td>16<br>44</td>
      <td>Charles Leclerc<br>Lewis Hamilton</td>
    </tr>
  </tbody>
</table>
</body></html>
`;

// Drivers spread across multiple per-driver rows under a single team rowspan cell.
const MULTI_ROW_HTML = `
<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr>
      <th>Team</th>
      <th>No.</th>
      <th>Driver</th>
    </tr>
    <tr>
      <td rowspan="2">Scuderia Ferrari</td>
      <td>16</td>
      <td>Charles Leclerc</td>
    </tr>
    <tr>
      <td>44</td>
      <td>Lewis Hamilton</td>
    </tr>
    <tr>
      <td rowspan="2">McLaren</td>
      <td>4</td>
      <td>Lando Norris</td>
    </tr>
    <tr>
      <td>81</td>
      <td>Oscar Piastri</td>
    </tr>
    <tr>
      <td rowspan="2">Mercedes-AMG Petronas</td>
      <td>63</td>
      <td>George Russell</td>
    </tr>
    <tr>
      <td>12</td>
      <td>Andrea Kimi Antonelli</td>
    </tr>
    <tr>
      <td rowspan="2">Aston Martin Aramco</td>
      <td>14</td>
      <td>Fernando Alonso</td>
    </tr>
    <tr>
      <td>18</td>
      <td>Lance Stroll</td>
    </tr>
  </tbody>
</table>
</body></html>
`;

// One row per driver — same team text repeats on multiple rows without
// rowspan grouping. Parser should merge these into one entry per team.
const ONE_ROW_PER_DRIVER_HTML = `
<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr><th>Constructor</th><th>No.</th><th>Driver</th></tr>
    <tr><td>Mercedes</td><td>63</td><td>George Russell</td></tr>
    <tr><td>Mercedes</td><td>12</td><td>Andrea Kimi Antonelli</td></tr>
    <tr><td>McLaren</td><td>4</td><td>Lando Norris</td></tr>
    <tr><td>McLaren</td><td>81</td><td>Oscar Piastri</td></tr>
    <tr><td>Ferrari</td><td>16</td><td>Charles Leclerc</td></tr>
    <tr><td>Ferrari</td><td>44</td><td>Lewis Hamilton</td></tr>
    <tr><td>Red Bull</td><td>1</td><td>Max Verstappen</td></tr>
    <tr><td>Red Bull</td><td>22</td><td>Yuki Tsunoda</td></tr>
  </tbody>
</table>
</body></html>
`;

// A 2-row table that looks superficially driver-ish but is actually too
// small to be a credible season lineup. Should be rejected by the
// >= 4 credible-teams floor.
const TOO_SMALL_HTML = `
<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr><th>Team</th><th>Driver</th></tr>
    <tr><td>Tiny Team</td><td>Some Driver</td></tr>
    <tr><td>Other Team</td><td>Other Driver</td></tr>
  </tbody>
</table>
</body></html>
`;

// A table whose first column is "Source: Wikipedia" header chrome rather
// than real team names. Should be rejected by the junk-team filter.
const JUNK_TEAM_HTML = `
<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr><th>Team</th><th>Driver</th></tr>
    <tr><td>No.</td><td>A</td></tr>
    <tr><td>Source</td><td>B</td></tr>
    <tr><td>Driver</td><td>C</td></tr>
    <tr><td>Pos</td><td>D</td></tr>
  </tbody>
</table>
</body></html>
`;

const NO_TABLE_HTML = `
<!DOCTYPE html>
<html><body><p>Prose only, no tables present.</p></body></html>
`;

const UNRELATED_TABLE_HTML = `
<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr><th>Round</th><th>Race</th><th>Date</th></tr>
    <tr><td>1</td><td>Bahrain GP</td><td>5 March</td></tr>
  </tbody>
</table>
</body></html>
`;

function mockFetchOnceOk(html: string) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => html,
  }) as unknown as typeof fetch;
}

function mockFetch404() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    text: async () => 'Not found',
  }) as unknown as typeof fetch;
}

function mockFetchReject() {
  globalThis.fetch = vi
    .fn()
    .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
}

describe('fetchSeasonLineup', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses an F1-style table with two drivers per cell separated by <br>', async () => {
    mockFetchOnceOk(F1_STYLE_HTML);
    const lineup = await fetchSeasonLineup('2026_Formula_One_World_Championship');
    expect(lineup).toHaveLength(4);
    expect(lineup[0].team).toBe('Oracle Red Bull Racing');
    expect(lineup[0].drivers).toEqual(['Max Verstappen', 'Yuki Tsunoda']);
    expect(lineup[1].team).toBe('Mercedes-AMG Petronas F1 Team');
    expect(lineup[1].drivers).toEqual([
      'George Russell',
      'Andrea Kimi Antonelli',
    ]);
  });

  it('parses a table where drivers live on per-driver rows under a rowspan team cell', async () => {
    mockFetchOnceOk(MULTI_ROW_HTML);
    const lineup = await fetchSeasonLineup('Some_Season_Page');
    expect(lineup).toHaveLength(4);
    expect(lineup[0].team).toBe('Scuderia Ferrari');
    expect(lineup[0].drivers).toEqual(['Charles Leclerc', 'Lewis Hamilton']);
    expect(lineup[1].team).toBe('McLaren');
    expect(lineup[1].drivers).toEqual(['Lando Norris', 'Oscar Piastri']);
  });

  it('merges duplicate team rows when the table uses one row per driver (no rowspan)', async () => {
    mockFetchOnceOk(ONE_ROW_PER_DRIVER_HTML);
    const lineup = await fetchSeasonLineup('Some_Season_Page');
    expect(lineup).toHaveLength(4);
    expect(lineup[0].team).toBe('Mercedes');
    expect(lineup[0].drivers).toEqual(['George Russell', 'Andrea Kimi Antonelli']);
    expect(lineup[1].team).toBe('McLaren');
    expect(lineup[1].drivers).toEqual(['Lando Norris', 'Oscar Piastri']);
    expect(lineup[2].team).toBe('Ferrari');
    expect(lineup[2].drivers).toEqual(['Charles Leclerc', 'Lewis Hamilton']);
    expect(lineup[3].team).toBe('Red Bull');
    expect(lineup[3].drivers).toEqual(['Max Verstappen', 'Yuki Tsunoda']);
  });

  it('rejects a lineup that has fewer than 4 credible teams', async () => {
    mockFetchOnceOk(TOO_SMALL_HTML);
    const lineup = await fetchSeasonLineup('Some_Tiny_Page');
    expect(lineup).toEqual([]);
  });

  it('rejects a table whose team column is column-header leakage like "No.", "Source", "Driver", "Pos"', async () => {
    mockFetchOnceOk(JUNK_TEAM_HTML);
    const lineup = await fetchSeasonLineup('Some_Junk_Page');
    expect(lineup).toEqual([]);
  });

  it('returns [] when no table has Team/Driver-style headers', async () => {
    mockFetchOnceOk(UNRELATED_TABLE_HTML);
    const lineup = await fetchSeasonLineup('Some_Page');
    expect(lineup).toEqual([]);
  });

  it('returns [] when no table is present at all', async () => {
    mockFetchOnceOk(NO_TABLE_HTML);
    const lineup = await fetchSeasonLineup('Empty_Page');
    expect(lineup).toEqual([]);
  });

  it('returns [] on 404 without throwing', async () => {
    mockFetch404();
    const lineup = await fetchSeasonLineup('Missing_Page');
    expect(lineup).toEqual([]);
  });

  it('returns [] on network failure without throwing', async () => {
    mockFetchReject();
    const lineup = await fetchSeasonLineup('Any_Page');
    expect(lineup).toEqual([]);
  });
});
