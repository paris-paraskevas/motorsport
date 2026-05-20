import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchWRCStandings, parseStandingsFromHtml } from './wrc';

// Mirrors the Wikipedia 2026 WRC article shape: three wikitables anchored
// after headings whose ids match "Drivers'_World_Championship",
// "Co-Drivers'_World_Championship", and "Manufacturers'_Championship".
// Position lives in the first cell (<th>), driver/manufacturer name in the
// second cell (with flagicon span + <a>), and total points in the last
// cell. Per-round cells in between are skipped — the parser only reads
// position + name + last-cell total.
function buildDriverRow(
  position: number,
  name: string,
  flag: string,
  points: number,
): string {
  return `
    <tr>
      <th>${position}</th>
      <td align="left">
        <span class="flagicon"><a href="/wiki/${flag}" title="${flag}">
          <img src="/${flag}.svg" alt="${flag}" /></a></span>
        <a href="/wiki/${name.replace(/ /g, '_')}">${name}</a>
      </td>
      <td style="background:#dfdfdf">2<br /><small>17+4+5</small></td>
      <td style="background:#ffffbf">1<br /><small>25+5+4</small></td>
      <td style="background:#cfcfff">13<br /><small>0+3+3</small></td>
      <td style="background:#cfcfff">34<br /><small>0+4+4</small></td>
      <td style="background:#dfdfdf">2<br /><small>17+5+5</small></td>
      <td style="background:#ffdf9f">3<br /><small>15+4+3</small></td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      <th>${points}</th>
    </tr>
  `;
}

function buildCoDriverRow(
  position: number,
  name: string,
  flag: string,
  points: number,
): string {
  return `
    <tr>
      <th>${position}</th>
      <td align="left">
        <span class="flagicon"><img alt="${flag}" /></span>
        <a href="/wiki/${name.replace(/ /g, '_')}_(co-driver)">${name}</a>
      </td>
      <td>2</td><td>1</td><td>13</td><td>34</td><td>2</td><td>3</td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      <th>${points}</th>
    </tr>
  `;
}

function buildManufacturerRow(
  position: number,
  name: string,
  flag: string,
  points: number,
): string {
  return `
    <tr>
      <th rowspan="3">${position}</th>
      <td rowspan="3" align="left" nowrap>
        <span class="flagicon"><img alt="${flag}" /></span>
        <a href="/wiki/${name.replace(/ /g, '_')}">${name}</a>
      </td>
      <td style="background:#ffffbf">1<br /><small>25+4+3</small></td>
      <td style="background:#ffffbf">1<br /><small>25+5+4</small></td>
      <td style="background:#dfffdf">4<br /><small>12+5+5</small></td>
      <td style="background:#ffffbf">1<br /><small>25+0+0</small></td>
      <td style="background:#ffffbf">1<br /><small>25+4+3</small></td>
      <td style="background:#dfdfdf">2<br /><small>17+5+2</small></td>
      <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
      <th rowspan="3">${points}</th>
    </tr>
  `;
}

const FULL_HTML = `
<!DOCTYPE html>
<html><body>
<h2 id="FIA_World_Rally_Championship_for_Drivers">FIA World Rally Championship for Drivers</h2>
<table class="wikitable">
  <tbody>
    <tr>
      <th>Pos.</th><th>Driver</th>
      <th>MON</th><th>SWE</th><th>KEN</th><th>CRO</th><th>ESP</th><th>POR</th>
      <th>JPN</th><th>GRE</th><th>EST</th><th>FIN</th><th>PAR</th><th>CHL</th>
      <th>ITA</th><th>SAU</th>
      <th>Pts</th>
    </tr>
    ${buildDriverRow(1, 'Elfyn Evans', 'GBR', 123)}
    ${buildDriverRow(2, 'Takamoto Katsuta', 'JPN', 111)}
    ${buildDriverRow(3, 'Oliver Solberg', 'SWE', 92)}
    ${buildDriverRow(4, 'Adrien Fourmaux', 'FRA', 79)}
    ${buildDriverRow(5, 'Sami Pajari', 'FIN', 78)}
    ${buildDriverRow(6, 'Thierry Neuville', 'BEL', 65)}
    ${buildDriverRow(7, 'Sébastien Ogier', 'FRA', 54)}
  </tbody>
</table>

<h2 id="FIA_World_Rally_Championship_for_Co-Drivers">FIA World Rally Championship for Co-Drivers</h2>
<table class="wikitable">
  <tbody>
    <tr>
      <th>Pos.</th><th>Co-driver</th>
      <th>MON</th><th>SWE</th><th>KEN</th><th>CRO</th><th>ESP</th><th>POR</th>
      <th>JPN</th><th>GRE</th><th>EST</th><th>FIN</th><th>PAR</th><th>CHL</th>
      <th>ITA</th><th>SAU</th>
      <th>Pts</th>
    </tr>
    ${buildCoDriverRow(1, 'Scott Martin', 'GBR', 123)}
    ${buildCoDriverRow(2, 'Aaron Johnston', 'IRL', 111)}
    ${buildCoDriverRow(3, 'Elliott Edmondson', 'GBR', 92)}
    ${buildCoDriverRow(4, 'Alexandre Coria', 'FRA', 79)}
    ${buildCoDriverRow(5, 'Marko Salminen', 'FIN', 78)}
  </tbody>
</table>

<h2 id="FIA_World_Rally_Championship_for_Manufacturers">FIA World Rally Championship for Manufacturers</h2>
<table class="wikitable">
  <tbody>
    <tr>
      <th>Pos.</th><th>Manufacturer</th>
      <th>MON</th><th>SWE</th><th>KEN</th><th>CRO</th><th>ESP</th><th>POR</th>
      <th>JPN</th><th>GRE</th><th>EST</th><th>FIN</th><th>PAR</th><th>CHL</th>
      <th>ITA</th><th>SAU</th>
      <th>Pts</th>
    </tr>
    ${buildManufacturerRow(1, 'Toyota Gazoo Racing WRT', 'JPN', 311)}
    ${buildManufacturerRow(2, 'Hyundai Shell Mobis WRT', 'KOR', 218)}
    ${buildManufacturerRow(3, 'M-Sport Ford WRT', 'GBR', 71)}
  </tbody>
</table>
</body></html>
`;

const MISSING_TABLE_HTML = `
<!DOCTYPE html>
<html><body>
<h2 id="FIA_World_Rally_Championship_for_Drivers">FIA World Rally Championship for Drivers</h2>
<p>Coming soon.</p>
</body></html>
`;

const TOO_FEW_DRIVERS_HTML = `
<!DOCTYPE html>
<html><body>
<h2 id="FIA_World_Rally_Championship_for_Drivers">Drivers</h2>
<table class="wikitable">
  <tbody>
    <tr>
      <th>Pos.</th><th>Driver</th><th>MON</th><th>Pts</th>
    </tr>
    ${buildDriverRow(1, 'Lone Driver', 'XXX', 25)}
    ${buildDriverRow(2, 'Second Driver', 'YYY', 18)}
  </tbody>
</table>
<h2 id="FIA_World_Rally_Championship_for_Co-Drivers">Co-Drivers</h2>
<table class="wikitable">
  <tbody>
    <tr><th>Pos.</th><th>Co-driver</th><th>MON</th><th>Pts</th></tr>
    ${buildCoDriverRow(1, 'A', 'XXX', 25)}
    ${buildCoDriverRow(2, 'B', 'XXX', 18)}
  </tbody>
</table>
<h2 id="FIA_World_Rally_Championship_for_Manufacturers">Manufacturers</h2>
<table class="wikitable">
  <tbody>
    <tr><th>Pos.</th><th>Manufacturer</th><th>MON</th><th>Pts</th></tr>
    ${buildManufacturerRow(1, 'Solo Co', 'XXX', 100)}
    ${buildManufacturerRow(2, 'Second Co', 'YYY', 50)}
  </tbody>
</table>
</body></html>
`;

function mockOk(html: string) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => html,
  }) as unknown as typeof fetch;
}

function mockFail() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    text: async () => 'Forbidden',
  }) as unknown as typeof fetch;
}

function mockReject() {
  globalThis.fetch = vi
    .fn()
    .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
}

// Two-call mock: first call (wrc.com) fails / unparseable, second call
// (wikipedia) returns the supplied HTML. fetchWRCStandings attempts wrc.com
// first and falls through to Wikipedia.
function mockWrcFailWikiOk(wikiHtml: string) {
  let call = 0;
  globalThis.fetch = vi.fn().mockImplementation(async () => {
    call += 1;
    if (call === 1) {
      // wrc.com — pretend it 403'd
      return {
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      } as Response;
    }
    return {
      ok: true,
      status: 200,
      text: async () => wikiHtml,
    } as Response;
  }) as unknown as typeof fetch;
}

describe('parseStandingsFromHtml', () => {
  it('parses drivers, co-drivers, and manufacturers from a full Wikipedia fixture', () => {
    const parsed = parseStandingsFromHtml(FULL_HTML);
    expect(parsed).not.toBeNull();
    expect(parsed!.drivers).toHaveLength(7);
    expect(parsed!.drivers[0]).toEqual({
      position: 1,
      driverName: 'Elfyn Evans',
      team: '',
      points: 123,
    });
    expect(parsed!.drivers[1].driverName).toBe('Takamoto Katsuta');
    expect(parsed!.drivers[6].driverName).toBe('Sébastien Ogier');

    expect(parsed!.coDrivers).toHaveLength(5);
    expect(parsed!.coDrivers[0]).toEqual({
      position: 1,
      coDriverName: 'Scott Martin',
      team: '',
      points: 123,
    });
    expect(parsed!.coDrivers[1].coDriverName).toBe('Aaron Johnston');

    expect(parsed!.manufacturers).toHaveLength(3);
    expect(parsed!.manufacturers[0]).toEqual({
      position: 1,
      name: 'Toyota Gazoo Racing WRT',
      points: 311,
    });
    expect(parsed!.manufacturers[2].name).toBe('M-Sport Ford WRT');
  });

  it('sorts standings by position', () => {
    const parsed = parseStandingsFromHtml(FULL_HTML);
    expect(parsed!.drivers.map(d => d.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(parsed!.coDrivers.map(c => c.position)).toEqual([1, 2, 3, 4, 5]);
    expect(parsed!.manufacturers.map(m => m.position)).toEqual([1, 2, 3]);
  });

  it('returns null when any of the three required tables is missing', () => {
    expect(parseStandingsFromHtml(MISSING_TABLE_HTML)).toBeNull();
  });

  it('returns null when fewer than the sanity floor of drivers parsed', () => {
    expect(parseStandingsFromHtml(TOO_FEW_DRIVERS_HTML)).toBeNull();
  });

  it('returns null on garbage HTML', () => {
    expect(parseStandingsFromHtml('<html><body><p>not standings</p></body></html>')).toBeNull();
  });
});

describe('fetchWRCStandings', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('falls back to Wikipedia when wrc.com returns 403', async () => {
    mockWrcFailWikiOk(FULL_HTML);
    const result = await fetchWRCStandings();
    expect(result).not.toBeNull();
    expect(result!.drivers[0].driverName).toBe('Elfyn Evans');
    expect(result!.manufacturers[0].name).toBe('Toyota Gazoo Racing WRT');
  });

  it('returns null when both sources fail', async () => {
    mockFail();
    const result = await fetchWRCStandings();
    expect(result).toBeNull();
  });

  it('returns null when network throws', async () => {
    mockReject();
    const result = await fetchWRCStandings();
    expect(result).toBeNull();
  });

  it('uses wrc.com data when it parses cleanly (no Wikipedia fallback needed)', async () => {
    // Both calls return a parseable HTML — first should win.
    mockOk(FULL_HTML);
    const result = await fetchWRCStandings();
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(7);
    // Verify only one fetch was needed when the first one parses.
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
  });
});
