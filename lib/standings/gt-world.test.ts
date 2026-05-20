import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchGtWorldStandings,
  buildStandingsUrl,
  parseStandingsHtml,
} from './gt-world';

// Realistic fixture mirroring gt-world-challenge-europe.com/standings.
// The header row is rendered with plain <td> elements (NOT <th>); the
// parser must treat any first-cell value that isn't a finite integer as a
// non-data row and drop it.

function teamRow(opts: {
  pos: number;
  teamId: number;
  teamSlug: string;
  team: string;
  total: number;
}): string {
  return `
    <tr>
      <td>${opts.pos}</td>
      <td>
        <a href="/team/${opts.teamId}/${opts.teamSlug}" title="${opts.team}">
          ${opts.team}
        </a>
      </td>
      <td>${opts.total}</td>
      <td>10</td><td>5</td><td>3</td><td>4</td><td></td><td></td>
    </tr>
  `;
}

function driverRow(opts: {
  pos: number;
  driverId: number;
  driverSlug: string;
  driverName: string;
  total: number;
}): string {
  return `
    <tr>
      <td>${opts.pos}</td>
      <td>
        <a href="/driver/${opts.driverId}/${opts.driverSlug}" title="${opts.driverName}">
          ${opts.driverName}
        </a>
      </td>
      <td>${opts.total}</td>
      <td></td><td>20</td><td></td><td></td><td>10</td><td></td>
    </tr>
  `;
}

const TEAMS_OVERALL_HTML = `
<!DOCTYPE html><html><body>
<table class="table standing standing-europe-2021">
  <tbody>
    <tr><td>POS</td><td>TEAM</td><td>TOTAL</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    ${teamRow({ pos: 1, teamId: 786, teamSlug: 'winward-racing', team: 'Winward Racing', total: 40.5 })}
    ${teamRow({ pos: 2, teamId: 773, teamSlug: 'comtoyou-racing', team: 'Comtoyou Racing', total: 36.5 })}
    ${teamRow({ pos: 3, teamId: 770, teamSlug: 'team-wrt', team: 'Team WRT', total: 30 })}
    ${teamRow({ pos: 4, teamId: 781, teamSlug: 'akkodis-asp-team', team: 'AKKodis ASP Team', total: 22 })}
    ${teamRow({ pos: 5, teamId: 790, teamSlug: 'rutronik-racing', team: 'Rutronik Racing', total: 19 })}
    ${teamRow({ pos: 6, teamId: 800, teamSlug: 'garage-59', team: 'Garage 59', total: 15.5 })}
    ${teamRow({ pos: 7, teamId: 805, teamSlug: 'mercedes-amg-mann-filter', team: 'Mercedes-AMG MANN-FILTER', total: 12 })}
    ${teamRow({ pos: 8, teamId: 810, teamSlug: 'haupt-racing-team', team: 'Haupt Racing Team', total: 10 })}
  </tbody>
</table>
</body></html>
`;

const DRIVERS_OVERALL_HTML = `
<!DOCTYPE html><html><body>
<table class="table standing standing-europe-2021">
  <tbody>
    <tr><td>POS</td><td>DRIVER</td><td>TOTAL</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
    ${driverRow({ pos: 1, driverId: 4102, driverSlug: 'lucas-auer', driverName: 'Lucas Auer', total: 39 })}
    ${driverRow({ pos: 1, driverId: 4145, driverSlug: 'maro-engel', driverName: 'Maro Engel', total: 39 })}
    ${driverRow({ pos: 2, driverId: 4057, driverSlug: 'nicki-thiim', driverName: 'Nicki Thiim', total: 34 })}
    ${driverRow({ pos: 3, driverId: 4156, driverSlug: 'marco-sorensen', driverName: 'Marco Sorensen', total: 33 })}
    ${driverRow({ pos: 3, driverId: 4155, driverSlug: 'mattia-drudi', driverName: 'Mattia Drudi', total: 33 })}
    ${driverRow({ pos: 4, driverId: 4200, driverSlug: 'kelvin-vanderlinde', driverName: 'Kelvin van der Linde', total: 28 })}
    ${driverRow({ pos: 5, driverId: 4210, driverSlug: 'charles-weerts', driverName: 'Charles Weerts', total: 26 })}
  </tbody>
</table>
</body></html>
`;

const SPRINT_DRIVERS_HTML = `
<!DOCTYPE html><html><body>
<table>
  <tbody>
    <tr><td>POS</td><td>DRIVER</td><td>TOTAL</td><td></td></tr>
    ${driverRow({ pos: 1, driverId: 4102, driverSlug: 'lucas-auer', driverName: 'Lucas Auer', total: 14 })}
    ${driverRow({ pos: 2, driverId: 4057, driverSlug: 'nicki-thiim', driverName: 'Nicki Thiim', total: 11 })}
    ${driverRow({ pos: 3, driverId: 4220, driverSlug: 'tom-kalender', driverName: 'Tom Kalender', total: 10 })}
    ${driverRow({ pos: 4, driverId: 4230, driverSlug: 'finlay-hutchison', driverName: 'Finlay Hutchison', total: 9 })}
    ${driverRow({ pos: 5, driverId: 4240, driverSlug: 'martin-konrad', driverName: 'Martin Konrad', total: 8 })}
    ${driverRow({ pos: 6, driverId: 4250, driverSlug: 'philip-ellis', driverName: 'Philip Ellis', total: 7 })}
  </tbody>
</table>
</body></html>
`;

const ENDURANCE_DRIVERS_HTML = `
<!DOCTYPE html><html><body>
<table>
  <tbody>
    <tr><td>POS</td><td>DRIVER</td><td>TOTAL</td><td></td></tr>
    ${driverRow({ pos: 1, driverId: 4145, driverSlug: 'maro-engel', driverName: 'Maro Engel', total: 25 })}
    ${driverRow({ pos: 2, driverId: 4155, driverSlug: 'mattia-drudi', driverName: 'Mattia Drudi', total: 22 })}
    ${driverRow({ pos: 3, driverId: 4156, driverSlug: 'marco-sorensen', driverName: 'Marco Sorensen', total: 22 })}
    ${driverRow({ pos: 4, driverId: 4300, driverSlug: 'luca-stolz', driverName: 'Luca Stolz', total: 18 })}
    ${driverRow({ pos: 5, driverId: 4310, driverSlug: 'jordan-pepper', driverName: 'Jordan Pepper', total: 14 })}
    ${driverRow({ pos: 6, driverId: 4320, driverSlug: 'kelvin-vanderlinde', driverName: 'Kelvin van der Linde', total: 14 })}
  </tbody>
</table>
</body></html>
`;

const SPRINT_TEAMS_HTML = `
<!DOCTYPE html><html><body>
<table>
  <tbody>
    <tr><td>POS</td><td>TEAM</td><td>TOTAL</td><td></td></tr>
    ${teamRow({ pos: 1, teamId: 786, teamSlug: 'winward-racing', team: 'Winward Racing', total: 18 })}
    ${teamRow({ pos: 2, teamId: 773, teamSlug: 'comtoyou-racing', team: 'Comtoyou Racing', total: 14 })}
    ${teamRow({ pos: 3, teamId: 770, teamSlug: 'team-wrt', team: 'Team WRT', total: 12 })}
    ${teamRow({ pos: 4, teamId: 781, teamSlug: 'akkodis-asp-team', team: 'AKKodis ASP Team', total: 10 })}
    ${teamRow({ pos: 5, teamId: 790, teamSlug: 'rutronik-racing', team: 'Rutronik Racing', total: 9 })}
    ${teamRow({ pos: 6, teamId: 800, teamSlug: 'garage-59', team: 'Garage 59', total: 8 })}
  </tbody>
</table>
</body></html>
`;

const ENDURANCE_TEAMS_HTML = `
<!DOCTYPE html><html><body>
<table>
  <tbody>
    <tr><td>POS</td><td>TEAM</td><td>TOTAL</td><td></td></tr>
    ${teamRow({ pos: 1, teamId: 786, teamSlug: 'winward-racing', team: 'Winward Racing', total: 25 })}
    ${teamRow({ pos: 2, teamId: 773, teamSlug: 'comtoyou-racing', team: 'Comtoyou Racing', total: 22 })}
    ${teamRow({ pos: 3, teamId: 770, teamSlug: 'team-wrt', team: 'Team WRT', total: 18 })}
    ${teamRow({ pos: 4, teamId: 781, teamSlug: 'akkodis-asp-team', team: 'AKKodis ASP Team', total: 12 })}
    ${teamRow({ pos: 5, teamId: 790, teamSlug: 'rutronik-racing', team: 'Rutronik Racing', total: 10 })}
    ${teamRow({ pos: 6, teamId: 800, teamSlug: 'garage-59', team: 'Garage 59', total: 7.5 })}
  </tbody>
</table>
</body></html>
`;

const TOO_FEW_ROWS_HTML = `
<html><body>
<table><tbody>
  <tr><td>POS</td><td>TEAM</td><td>TOTAL</td></tr>
  ${teamRow({ pos: 1, teamId: 1, teamSlug: 'x', team: 'X', total: 1 })}
  ${teamRow({ pos: 2, teamId: 2, teamSlug: 'y', team: 'Y', total: 0 })}
</tbody></table>
</body></html>
`;

const NO_TABLE_HTML = `<html><body><p>Site under maintenance.</p></body></html>`;

function mockFetchByUrl(routes: Record<string, string | { status: number }>) {
  return vi.fn(async (url: string) => {
    for (const key of Object.keys(routes)) {
      if (url.includes(key)) {
        const v = routes[key];
        if (typeof v === 'string') {
          return { ok: true, status: 200, text: async () => v } as Response;
        }
        return { ok: false, status: v.status, text: async () => '' } as Response;
      }
    }
    return { ok: false, status: 404, text: async () => '' } as Response;
  });
}

describe('buildStandingsUrl', () => {
  it('maps championship + category + view to the documented URL', () => {
    expect(
      buildStandingsUrl({
        season: 2026,
        championship: 'overall',
        category: 'overall',
        view: 'teams',
      }),
    ).toBe(
      'https://www.gt-world-challenge-europe.com/standings?filter_season_id=26&filter_standing_type=0_0_teams',
    );
    expect(
      buildStandingsUrl({
        season: 2026,
        championship: 'sprint',
        category: 'pro',
        view: 'drivers',
      }),
    ).toBe(
      'https://www.gt-world-challenge-europe.com/standings?filter_season_id=26&filter_standing_type=43_83_drivers',
    );
    expect(
      buildStandingsUrl({
        season: 2026,
        championship: 'endurance',
        category: 'bronze',
        view: 'teams',
      }),
    ).toBe(
      'https://www.gt-world-challenge-europe.com/standings?filter_season_id=26&filter_standing_type=42_80_teams',
    );
  });

  it('returns null for an unmapped season year', () => {
    expect(
      buildStandingsUrl({
        season: 2030,
        championship: 'overall',
        category: 'overall',
        view: 'teams',
      }),
    ).toBeNull();
  });
});

describe('parseStandingsHtml', () => {
  it('parses team rows and drops the POS header row', () => {
    const rows = parseStandingsHtml(TEAMS_OVERALL_HTML, (cells, anchor) => {
      const position = Number(cells[0]);
      const points = Number(cells[2]);
      const name = (anchor ?? cells[1]).trim();
      return { position, name, points };
    });
    expect(rows).not.toBeNull();
    expect(rows!).toHaveLength(8);
    expect(rows![0]).toEqual({ position: 1, name: 'Winward Racing', points: 40.5 });
    expect(rows![7]).toEqual({ position: 8, name: 'Haupt Racing Team', points: 10 });
  });

  it('returns null when fewer than MIN_ROWS data rows present', () => {
    const rows = parseStandingsHtml(TOO_FEW_ROWS_HTML, () => ({ x: 1 }));
    expect(rows).toBeNull();
  });

  it('returns null when no table present', () => {
    const rows = parseStandingsHtml(NO_TABLE_HTML, () => ({ x: 1 }));
    expect(rows).toBeNull();
  });
});

describe('fetchGtWorldStandings', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns Overall + Sprint + Endurance sections with drivers and teams', async () => {
    globalThis.fetch = mockFetchByUrl({
      '0_0_drivers': DRIVERS_OVERALL_HTML,
      '0_0_teams': TEAMS_OVERALL_HTML,
      '43_0_drivers': SPRINT_DRIVERS_HTML,
      '43_0_teams': SPRINT_TEAMS_HTML,
      '42_0_drivers': ENDURANCE_DRIVERS_HTML,
      '42_0_teams': ENDURANCE_TEAMS_HTML,
    }) as unknown as typeof fetch;

    const result = await fetchGtWorldStandings(2026);
    expect(result).not.toBeNull();
    expect(result!.season).toBe(2026);

    expect(result!.overall.drivers).toHaveLength(7);
    expect(result!.overall.drivers[0]).toEqual({
      position: 1,
      driverName: 'Lucas Auer',
      team: '',
      points: 39,
    });
    expect(result!.overall.drivers[1].driverName).toBe('Maro Engel');
    expect(result!.overall.teams).toHaveLength(8);
    expect(result!.overall.teams[0]).toEqual({
      position: 1,
      name: 'Winward Racing',
      points: 40.5,
    });

    expect(result!.sprint.drivers).toHaveLength(6);
    expect(result!.sprint.drivers[0].driverName).toBe('Lucas Auer');
    expect(result!.sprint.drivers[0].points).toBe(14);
    expect(result!.sprint.teams[0].name).toBe('Winward Racing');

    expect(result!.endurance.drivers).toHaveLength(6);
    expect(result!.endurance.drivers[0].driverName).toBe('Maro Engel');
    expect(result!.endurance.drivers[0].points).toBe(25);
    expect(result!.endurance.teams[0].name).toBe('Winward Racing');
  });

  it('returns null when every drivers fetch fails', async () => {
    globalThis.fetch = mockFetchByUrl({
      '0_0_teams': TEAMS_OVERALL_HTML,
      '43_0_teams': SPRINT_TEAMS_HTML,
      '42_0_teams': ENDURANCE_TEAMS_HTML,
      // drivers paths all 500
      '_drivers': { status: 500 },
    }) as unknown as typeof fetch;
    const result = await fetchGtWorldStandings(2026);
    expect(result).toBeNull();
  });

  it('drops a championship whose drivers table fails but keeps the rest', async () => {
    globalThis.fetch = mockFetchByUrl({
      '0_0_drivers': DRIVERS_OVERALL_HTML,
      '0_0_teams': TEAMS_OVERALL_HTML,
      '43_0_drivers': SPRINT_DRIVERS_HTML,
      '43_0_teams': SPRINT_TEAMS_HTML,
      // Endurance Cup drivers explicitly broken
      '42_0_drivers': NO_TABLE_HTML,
      '42_0_teams': ENDURANCE_TEAMS_HTML,
    }) as unknown as typeof fetch;
    const result = await fetchGtWorldStandings(2026);
    expect(result).not.toBeNull();
    expect(result!.overall.drivers.length).toBeGreaterThan(0);
    expect(result!.sprint.drivers.length).toBeGreaterThan(0);
    expect(result!.endurance.drivers).toEqual([]);
    expect(result!.endurance.teams.length).toBeGreaterThan(0);
  });

  it('returns null when fetch throws on every endpoint', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const result = await fetchGtWorldStandings(2026);
    expect(result).toBeNull();
  });

  it('returns null when the season is unmapped (no URL to fetch)', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => DRIVERS_OVERALL_HTML,
    })) as unknown as typeof fetch;
    const result = await fetchGtWorldStandings(2030);
    expect(result).toBeNull();
  });
});
