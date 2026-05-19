import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchIndyCarStandings } from './indycar';

// Realistic fixture mirroring indycar.com/Standings shape — one <tr> per driver
// with the data-driver-data JSON button + sibling team-logo image cell.
function row(opts: {
  rank: number;
  firstName: string;
  lastName: string;
  team: string;
  points: number;
  wins: number;
  poles?: number;
}): string {
  const data = JSON.stringify({
    driverUrl: `/Drivers/${opts.firstName}-${opts.lastName}`,
    rank: opts.rank,
    wins: opts.wins,
    poles: opts.poles ?? 0,
    points: opts.points,
    firstName: opts.firstName,
    lastName: opts.lastName,
    teamLogoImg: '/-/media/IndyCar/Team/X.png',
  })
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
  return `
    <tr class="data-table-driver-row">
      <td>${opts.rank}</td>
      <td><img alt="${opts.firstName} ${opts.lastName} endplate" /></td>
      <td>
        <button class="data-table-driver-container" data-driver-data='${data}'>
          <p>${opts.firstName} ${opts.lastName}</p>
        </button>
      </td>
      <td>
        <div class="data-table-team-img-container">
          <img src="..." alt="${opts.team} Logo " />
        </div>
      </td>
      <td><img alt="Honda Logo" /></td>
      <td><button class="data-table-points-button"><b>${opts.points}</b></button></td>
    </tr>
  `;
}

const FULL_GRID_HTML = `
<!DOCTYPE html>
<html><body>
<table class="row-border nowrap hover">
  <thead><tr><th>#</th><th></th><th>Driver</th><th>Team</th><th>Eng</th><th>Pts</th></tr></thead>
  <tbody>
    ${row({ rank: 1, firstName: 'Alex', lastName: 'Palou', team: 'Chip Ganassi Racing', points: 237, wins: 3, poles: 2 })}
    ${row({ rank: 2, firstName: 'Kyle', lastName: 'Kirkwood', team: 'Andretti Global', points: 210, wins: 1 })}
    ${row({ rank: 3, firstName: 'Christian', lastName: 'Lundgaard', team: 'Arrow McLaren', points: 195, wins: 1 })}
    ${row({ rank: 4, firstName: 'Pato', lastName: "O'Ward", team: 'Arrow McLaren', points: 188, wins: 0 })}
    ${row({ rank: 5, firstName: 'Scott', lastName: 'Dixon', team: 'Chip Ganassi Racing', points: 175, wins: 0 })}
    ${row({ rank: 6, firstName: 'Josef', lastName: 'Newgarden', team: 'Team Penske', points: 162, wins: 0 })}
    ${row({ rank: 7, firstName: 'Will', lastName: 'Power', team: 'Andretti Global', points: 148, wins: 0 })}
    ${row({ rank: 8, firstName: 'Scott', lastName: 'McLaughlin', team: 'Team Penske', points: 142, wins: 0 })}
    ${row({ rank: 9, firstName: 'Felix', lastName: 'Rosenqvist', team: 'Meyer Shank Racing', points: 130, wins: 0 })}
    ${row({ rank: 10, firstName: 'Marcus', lastName: 'Ericsson', team: 'Andretti Global', points: 124, wins: 0 })}
    ${row({ rank: 11, firstName: 'Marcus', lastName: 'Armstrong', team: 'Meyer Shank Racing', points: 118, wins: 0 })}
    ${row({ rank: 12, firstName: 'Mick', lastName: 'Schumacher', team: 'Rahal Letterman Lanigan Racing', points: 109, wins: 0 })}
  </tbody>
</table>
</body></html>
`;

const PARTIAL_HTML = `
<!DOCTYPE html>
<html><body>
<table class="row-border nowrap hover">
  <tbody>
    ${row({ rank: 1, firstName: 'Alex', lastName: 'Palou', team: 'Chip Ganassi Racing', points: 237, wins: 3 })}
    ${row({ rank: 2, firstName: 'Kyle', lastName: 'Kirkwood', team: 'Andretti Global', points: 210, wins: 1 })}
    ${row({ rank: 3, firstName: 'Christian', lastName: 'Lundgaard', team: 'Arrow McLaren', points: 195, wins: 1 })}
  </tbody>
</table>
</body></html>
`;

const NO_DRIVERS_HTML = `
<!DOCTYPE html>
<html><body><p>Site is being updated. Please check back later.</p></body></html>
`;

const MALFORMED_JSON_HTML = `
<!DOCTYPE html>
<html><body>
<table>
  <tbody>
    <tr class="data-table-driver-row">
      <td>1</td>
      <td>
        <button data-driver-data="not-valid-json{">
          <p>Mystery Driver</p>
        </button>
      </td>
      <td><div class="data-table-team-img-container"><img alt="Some Team Logo " /></div></td>
    </tr>
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

function mockFetch500() {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    text: async () => 'Internal Server Error',
  }) as unknown as typeof fetch;
}

function mockFetchReject() {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
}

describe('fetchIndyCarStandings', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses a 12-driver standings table with rank / name / team / points / wins', async () => {
    mockFetchOnceOk(FULL_GRID_HTML);
    const result = await fetchIndyCarStandings();
    expect(result).not.toBeNull();
    expect(result!.drivers).toHaveLength(12);
    expect(result!.drivers[0]).toEqual({
      position: 1,
      driverName: 'Alex Palou',
      team: 'Chip Ganassi Racing',
      points: 237,
      wins: 3,
    });
    expect(result!.drivers[1].driverName).toBe('Kyle Kirkwood');
    expect(result!.drivers[1].team).toBe('Andretti Global');
    expect(result!.drivers[3].driverName).toBe("Pato O'Ward");
    expect(result!.drivers[11].driverName).toBe('Mick Schumacher');
  });

  it('sorts drivers by position even if the table emits them out of order', async () => {
    // Wrap the rows in reverse rank order; parser should resort
    const reversed = `
      <html><body><table><tbody>
        ${row({ rank: 12, firstName: 'M', lastName: 'Schumacher', team: 'RLL', points: 109, wins: 0 })}
        ${row({ rank: 11, firstName: 'M', lastName: 'Armstrong', team: 'MSR', points: 118, wins: 0 })}
        ${row({ rank: 10, firstName: 'M', lastName: 'Ericsson', team: 'Andretti', points: 124, wins: 0 })}
        ${row({ rank: 9, firstName: 'F', lastName: 'Rosenqvist', team: 'MSR', points: 130, wins: 0 })}
        ${row({ rank: 8, firstName: 'S', lastName: 'McLaughlin', team: 'Penske', points: 142, wins: 0 })}
        ${row({ rank: 7, firstName: 'W', lastName: 'Power', team: 'Andretti', points: 148, wins: 0 })}
        ${row({ rank: 6, firstName: 'J', lastName: 'Newgarden', team: 'Penske', points: 162, wins: 0 })}
        ${row({ rank: 5, firstName: 'S', lastName: 'Dixon', team: 'Ganassi', points: 175, wins: 0 })}
        ${row({ rank: 4, firstName: 'P', lastName: "O'Ward", team: 'McLaren', points: 188, wins: 0 })}
        ${row({ rank: 3, firstName: 'C', lastName: 'Lundgaard', team: 'McLaren', points: 195, wins: 1 })}
        ${row({ rank: 2, firstName: 'K', lastName: 'Kirkwood', team: 'Andretti', points: 210, wins: 1 })}
        ${row({ rank: 1, firstName: 'A', lastName: 'Palou', team: 'Ganassi', points: 237, wins: 3 })}
      </tbody></table></body></html>
    `;
    mockFetchOnceOk(reversed);
    const result = await fetchIndyCarStandings();
    expect(result).not.toBeNull();
    expect(result!.drivers.map((d) => d.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('returns null when fewer than 10 drivers parsed (sanity floor)', async () => {
    mockFetchOnceOk(PARTIAL_HTML);
    const result = await fetchIndyCarStandings();
    expect(result).toBeNull();
  });

  it('returns null when no driver-data attributes present at all', async () => {
    mockFetchOnceOk(NO_DRIVERS_HTML);
    const result = await fetchIndyCarStandings();
    expect(result).toBeNull();
  });

  it('skips rows with malformed JSON and returns null if total falls below floor', async () => {
    mockFetchOnceOk(MALFORMED_JSON_HTML);
    const result = await fetchIndyCarStandings();
    expect(result).toBeNull();
  });

  it('returns null on 500 without throwing', async () => {
    mockFetch500();
    const result = await fetchIndyCarStandings();
    expect(result).toBeNull();
  });

  it('returns null on network failure without throwing', async () => {
    mockFetchReject();
    const result = await fetchIndyCarStandings();
    expect(result).toBeNull();
  });
});
