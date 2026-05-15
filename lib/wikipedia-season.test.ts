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

// F1 2026-style multi-row header. Row 0 has `Race drivers` with
// colspan=3; row 1 has the sub-headers (No., Driver name, Rounds).
// Parser should flatten both rows, detect Entrant and Driver name as
// the team/driver columns, then read those positions on data rows.
const MULTI_ROW_HEADER_HTML = `
<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr>
      <th>Entrant</th>
      <th>Constructor</th>
      <th>Chassis</th>
      <th>Power unit</th>
      <th colspan="3">Race drivers</th>
    </tr>
    <tr>
      <th>No.</th>
      <th>Driver name</th>
      <th>Rounds</th>
    </tr>
    <tr>
      <td>BWT Alpine F1 Team</td>
      <td>Alpine - Mercedes</td>
      <td>A526</td>
      <td>Mercedes-AMG F1 M17</td>
      <td>10<br>43</td>
      <td>Pierre Gasly<br>Franco Colapinto</td>
      <td>All</td>
    </tr>
    <tr>
      <td>Aston Martin Aramco F1 Team</td>
      <td>Aston Martin Aramco - Honda</td>
      <td>AMR26</td>
      <td>Honda RA626H</td>
      <td>14<br>18</td>
      <td>Fernando Alonso<br>Lance Stroll</td>
      <td>All</td>
    </tr>
    <tr>
      <td>Atlassian Williams F1 Team</td>
      <td>Atlassian Williams - Mercedes</td>
      <td>FW48</td>
      <td>Mercedes-AMG F1 M17</td>
      <td>23<br>55</td>
      <td>Alexander Albon<br>Carlos Sainz Jr.</td>
      <td>All</td>
    </tr>
    <tr>
      <td>Audi Revolut F1 Team</td>
      <td>Audi</td>
      <td>R26</td>
      <td>Audi AFR 26 Hybrid</td>
      <td>5<br>27</td>
      <td>Gabriel Bortoleto<br>Nico Hülkenberg</td>
      <td>All</td>
    </tr>
  </tbody>
</table>
</body></html>
`;

// Driver cell containing bracketed footnotes ([a], [N 1], etc.) that
// older regex (numeric-only) failed to strip. The team name should
// render cleanly without bracket noise.
const FOOTNOTE_ANNOTATION_HTML = `
<!DOCTYPE html>
<html><body>
<table class="wikitable">
  <tbody>
    <tr><th>Constructor</th><th>Driver</th></tr>
    <tr><td>Monster Energy Yamaha MotoGP Team[a]</td><td>Fabio Quartararo[1]</td></tr>
    <tr><td>Aprilia Racing[N 1]</td><td>Marco Bezzecchi</td></tr>
    <tr><td>Ducati Lenovo Team</td><td>Francesco Bagnaia[lower-alpha 2]</td></tr>
    <tr><td>Red Bull KTM Factory Racing</td><td>Brad Binder</td></tr>
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

  it('handles multi-row headers where Race drivers spans No. + Driver name + Rounds sub-columns', async () => {
    mockFetchOnceOk(MULTI_ROW_HEADER_HTML);
    const lineup = await fetchSeasonLineup('2026_Formula_One_World_Championship');
    expect(lineup).toHaveLength(4);
    expect(lineup[0].team).toBe('BWT Alpine F1 Team');
    expect(lineup[0].drivers).toEqual(['Pierre Gasly', 'Franco Colapinto']);
    expect(lineup[1].team).toBe('Aston Martin Aramco F1 Team');
    expect(lineup[1].drivers).toEqual(['Fernando Alonso', 'Lance Stroll']);
    expect(lineup[2].team).toBe('Atlassian Williams F1 Team');
    expect(lineup[2].drivers).toEqual(['Alexander Albon', 'Carlos Sainz Jr.']);
    expect(lineup[3].team).toBe('Audi Revolut F1 Team');
    expect(lineup[3].drivers).toEqual(['Gabriel Bortoleto', 'Nico Hülkenberg']);
  });

  it('strips non-numeric footnote annotations like [a], [N 1], [lower-alpha 2] from team and driver names', async () => {
    mockFetchOnceOk(FOOTNOTE_ANNOTATION_HTML);
    const lineup = await fetchSeasonLineup('Some_Page');
    expect(lineup).toHaveLength(4);
    expect(lineup[0].team).toBe('Monster Energy Yamaha MotoGP Team');
    expect(lineup[0].drivers).toEqual(['Fabio Quartararo']);
    expect(lineup[1].team).toBe('Aprilia Racing');
    expect(lineup[2].drivers).toEqual(['Francesco Bagnaia']);
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
