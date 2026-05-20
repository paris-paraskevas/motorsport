import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchF3Standings } from './f3';

// HTML fixtures mirror the actual fiaformula3.com SSR layout: a
// `.table.table-bordered` with a thead listing each round and a tbody where
// each driver/team row has a `.driver-name-wrapper > .pos` for the position
// and a `.total-points` cell for the championship total. The driver rows
// additionally embed a `.visible-desktop-up` (full shorthand name) and a
// `.visible-desktop-down` (3-letter code).

function driverRow(opts: {
  pos: number;
  name: string;
  code: string;
  points: number;
}): string {
  return `
    <tr>
      <td class="sticky-col col-three driver-name-col">
        <div class="driver-name-wrapper">
          <div class="arrow-white"><span class="team-color"></span></div>
          <div class="pos">${opts.pos}</div>
          <div class="driver-name">
            <span class="visible-desktop-up">${opts.name}</span>
            <span class="visible-desktop-down">${opts.code}</span>
          </div>
        </div>
      </td>
      <td class="sticky-col col-four"><div class="total-points">${opts.points}</div></td>
    </tr>
  `;
}

function teamRow(opts: { pos: number; name: string; points: number }): string {
  // Team rows reuse the same `.driver-name-wrapper / .pos / .driver-name`
  // markup as the driver standings — the FIA template doesn't bother
  // renaming the wrapping classes. Both up/down spans hold the same team
  // name (the upstream page doesn't have an abbreviation for teams).
  return `
    <tr>
      <td class="sticky-col col-three driver-name-col">
        <div class="driver-name-wrapper">
          <div class="arrow-white"><span class="team-color"></span></div>
          <div class="pos">${opts.pos}</div>
          <div class="driver-name">
            <span class="visible-desktop-up">${opts.name}</span>
            <span class="visible-desktop-down">${opts.name}</span>
          </div>
        </div>
      </td>
      <td class="sticky-col col-four"><div class="total-points">${opts.points}</div></td>
    </tr>
  `;
}

const FULL_DRIVERS_HTML = `
<!DOCTYPE html><html><body>
<table class="table table-bordered">
  <thead><tr><th class="sticky-col col-three driver-name-col"><div class="heading">Driver</div></th><th class="sticky-col col-four"><div class="heading">Points</div></th></tr></thead>
  <tbody>
    ${driverRow({ pos: 1, name: 'U. Ugochukwu', code: 'UGO', points: 25 })}
    ${driverRow({ pos: 2, name: 'B. Del Pino', code: 'BDE', points: 18 })}
    ${driverRow({ pos: 3, name: 'F. Slater', code: 'SLA', points: 18 })}
    ${driverRow({ pos: 4, name: 'T. Kato', code: 'KAT', points: 16 })}
    ${driverRow({ pos: 5, name: 'E. Deligny', code: 'EDE', points: 12 })}
    ${driverRow({ pos: 6, name: 'N. Lacey', code: 'LAC', points: 10 })}
    ${driverRow({ pos: 7, name: 'O. Stenshorne', code: 'STE', points: 8 })}
    ${driverRow({ pos: 8, name: 'C. Wurtz', code: 'WUR', points: 6 })}
    ${driverRow({ pos: 9, name: 'M. Smal', code: 'SMA', points: 4 })}
    ${driverRow({ pos: 10, name: 'J. Cordeel', code: 'COR', points: 2 })}
    ${driverRow({ pos: 11, name: 'R. Camara', code: 'CAM', points: 1 })}
    ${driverRow({ pos: 12, name: 'D. David', code: 'DAV', points: 0 })}
  </tbody>
</table>
</body></html>
`;

const FULL_TEAMS_HTML = `
<!DOCTYPE html><html><body>
<table class="table table-bordered">
  <thead><tr><th class="sticky-col col-three driver-name-col"><div class="heading">Team</div></th><th class="sticky-col col-four"><div class="heading">Points</div></th></tr></thead>
  <tbody>
    ${teamRow({ pos: 1, name: 'Van Amersfoort Racing', points: 30 })}
    ${teamRow({ pos: 2, name: 'Campos Racing', points: 27 })}
    ${teamRow({ pos: 3, name: 'ART Grand Prix', points: 26 })}
    ${teamRow({ pos: 4, name: 'TRIDENT', points: 22 })}
    ${teamRow({ pos: 5, name: 'PREMA Racing', points: 18 })}
    ${teamRow({ pos: 6, name: 'MP Motorsport', points: 12 })}
    ${teamRow({ pos: 7, name: 'Hitech Pulse-Eight', points: 10 })}
    ${teamRow({ pos: 8, name: 'Rodin Motorsport', points: 8 })}
  </tbody>
</table>
</body></html>
`;

const SHELL_HTML = `<!DOCTYPE html><html><body><p>Site temporarily unavailable.</p></body></html>`;

function mockFetch(htmlByUrlSubstring: Record<string, { ok?: boolean; html?: string; throws?: boolean }>) {
  return vi.fn(async (url: string) => {
    for (const [substr, cfg] of Object.entries(htmlByUrlSubstring)) {
      if (url.includes(substr)) {
        if (cfg.throws) throw new Error('network down');
        return {
          ok: cfg.ok ?? true,
          status: cfg.ok === false ? 500 : 200,
          text: async () => cfg.html ?? '',
        } as Response;
      }
    }
    return { ok: false, status: 404, text: async () => '' } as Response;
  });
}

describe('fetchF3Standings', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses driver + team standings into typed shapes', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/Standings/Driver': { html: FULL_DRIVERS_HTML },
        '/Standings/Team': { html: FULL_TEAMS_HTML },
      }),
    );
    const result = await fetchF3Standings();
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(12);
    expect(result!.drivers[0]).toEqual({
      position: 1,
      driverName: 'U. Ugochukwu',
      driverCode: 'UGO',
      team: '',
      points: 25,
    });
    expect(result!.drivers[3].driverName).toBe('T. Kato');
    expect(result!.drivers[3].driverCode).toBe('KAT');
    expect(result!.drivers[3].points).toBe(16);

    expect(result!.constructors).toHaveLength(8);
    expect(result!.constructors[0]).toEqual({
      position: 1,
      name: 'Van Amersfoort Racing',
      points: 30,
    });
    expect(result!.constructors[2].name).toBe('ART Grand Prix');
  });

  it('resorts drivers by position even when the table emits them out of order', async () => {
    const reversed = `
      <html><body><table class="table table-bordered"><tbody>
        ${driverRow({ pos: 12, name: 'L', code: 'L12', points: 0 })}
        ${driverRow({ pos: 11, name: 'K', code: 'K11', points: 1 })}
        ${driverRow({ pos: 10, name: 'J', code: 'J10', points: 2 })}
        ${driverRow({ pos: 9, name: 'I', code: 'I09', points: 4 })}
        ${driverRow({ pos: 8, name: 'H', code: 'H08', points: 6 })}
        ${driverRow({ pos: 7, name: 'G', code: 'G07', points: 8 })}
        ${driverRow({ pos: 6, name: 'F', code: 'F06', points: 10 })}
        ${driverRow({ pos: 5, name: 'E', code: 'E05', points: 12 })}
        ${driverRow({ pos: 4, name: 'D', code: 'D04', points: 15 })}
        ${driverRow({ pos: 3, name: 'C', code: 'C03', points: 18 })}
        ${driverRow({ pos: 2, name: 'B', code: 'B02', points: 22 })}
        ${driverRow({ pos: 1, name: 'A', code: 'A01', points: 25 })}
      </tbody></table></body></html>
    `;
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/Standings/Driver': { html: reversed },
        '/Standings/Team': { html: FULL_TEAMS_HTML },
      }),
    );
    const result = await fetchF3Standings();
    expect(result).not.toBeNull();
    expect(result!.drivers.map(d => d.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(result!.drivers[0].driverName).toBe('A');
  });

  it('returns null when fewer than 10 drivers parsed (sanity floor)', async () => {
    const tooSmall = `
      <html><body><table class="table table-bordered"><tbody>
        ${driverRow({ pos: 1, name: 'A', code: 'A01', points: 25 })}
        ${driverRow({ pos: 2, name: 'B', code: 'B02', points: 18 })}
        ${driverRow({ pos: 3, name: 'C', code: 'C03', points: 15 })}
      </tbody></table></body></html>
    `;
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/Standings/Driver': { html: tooSmall },
        '/Standings/Team': { html: FULL_TEAMS_HTML },
      }),
    );
    const result = await fetchF3Standings();
    expect(result).toBeNull();
  });

  it('returns null when fewer than 6 teams parsed (sanity floor)', async () => {
    const tooFewTeams = `
      <html><body><table class="table table-bordered"><tbody>
        ${teamRow({ pos: 1, name: 'A', points: 30 })}
        ${teamRow({ pos: 2, name: 'B', points: 25 })}
      </tbody></table></body></html>
    `;
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/Standings/Driver': { html: FULL_DRIVERS_HTML },
        '/Standings/Team': { html: tooFewTeams },
      }),
    );
    const result = await fetchF3Standings();
    expect(result).toBeNull();
  });

  it('returns null when SSR shell renders no table (CMS regression)', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/Standings/Driver': { html: SHELL_HTML },
        '/Standings/Team': { html: FULL_TEAMS_HTML },
      }),
    );
    const result = await fetchF3Standings();
    expect(result).toBeNull();
  });

  it('returns null when the driver endpoint returns 500', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/Standings/Driver': { ok: false, html: 'Internal Server Error' },
        '/Standings/Team': { html: FULL_TEAMS_HTML },
      }),
    );
    const result = await fetchF3Standings();
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/Standings/Driver': { throws: true },
        '/Standings/Team': { html: FULL_TEAMS_HTML },
      }),
    );
    const result = await fetchF3Standings();
    expect(result).toBeNull();
  });
});
