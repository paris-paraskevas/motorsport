import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchNascarCupSeasonResults } from './nascar-cup';

const ROUNDS_FIXTURE = [
  { round: 1, startDate: '2026-02-15', name: 'Daytona 500' },
  { round: 2, startDate: '2026-02-22', name: 'Autotrader 400' },
  { round: 3, startDate: '2026-03-01', name: 'DuraMAX Texas Grand Prix' },
  { round: 4, startDate: '2026-03-08', name: 'Straight Talk Wireless 500' },
  { round: 5, startDate: '2026-03-15', name: 'Pennzoil 400' },
];

// Wikipedia race-results table row: 8 cells per row when present, fewer for
// rowspan continuation rows of the preseason block (Cook Out Clash + Duels).
// Header: No. | Race | Pole position | Most laps led | Fastest race lap |
//         Winning driver | Manufacturer | Report.
function raceRow(opts: {
  raceNumber?: string;
  raceName: string;
  pole: string;
  mostLaps: string;
  fastest: string;
  winner: string;
  manufacturer: string;
}): string {
  return `
    <tr>
      <th>${opts.raceNumber ?? ''}</th>
      <td><a>${opts.raceName}</a></td>
      <td><a>${opts.pole}</a></td>
      <td><a>${opts.mostLaps}</a></td>
      <td><a>${opts.fastest}</a></td>
      <td><a>${opts.winner}</a></td>
      <td><a>${opts.manufacturer}</a></td>
      <td><a>Report</a></td>
    </tr>
  `;
}

function buildRaceResultsPageHtml(opts: {
  rows: Array<{
    raceNumber?: string;
    raceName: string;
    pole: string;
    mostLaps: string;
    fastest: string;
    winner: string;
    manufacturer: string;
  }>;
}): string {
  return `<!DOCTYPE html>
<html><body>
<h3 id="Race_results">Race results</h3>
<table class="wikitable sortable">
  <tbody>
  <tr>
    <th>No.</th>
    <th>Race</th>
    <th>Pole position</th>
    <th>Most laps led</th>
    <th>Fastest race lap</th>
    <th>Winning driver</th>
    <th>Manufacturer</th>
    <th class="unsortable">Report</th>
  </tr>
  ${opts.rows.map(raceRow).join('')}
  </tbody>
</table>
</body></html>`;
}

const SAMPLE_ROWS = [
  {
    raceNumber: '',
    raceName: 'Cook Out Clash',
    pole: 'Kyle Larson',
    mostLaps: 'Kyle Larson',
    fastest: '—',
    winner: 'Ryan Preece',
    manufacturer: 'Ford',
  },
  {
    raceNumber: '1',
    raceName: 'Daytona 500',
    pole: 'Kyle Busch',
    mostLaps: 'Bubba Wallace',
    fastest: 'Carson Hocevar',
    winner: 'Tyler Reddick',
    manufacturer: 'Toyota',
  },
  {
    raceNumber: '2',
    raceName: 'Autotrader 400',
    pole: 'Tyler Reddick',
    mostLaps: 'Tyler Reddick',
    fastest: 'Cole Custer',
    winner: 'Tyler Reddick',
    manufacturer: 'Toyota',
  },
  {
    raceNumber: '3',
    raceName: 'DuraMAX Texas Grand Prix',
    pole: 'Tyler Reddick',
    mostLaps: 'Tyler Reddick',
    fastest: 'Ross Chastain',
    winner: 'Tyler Reddick',
    manufacturer: 'Toyota',
  },
  {
    raceNumber: '4',
    raceName: 'Straight Talk Wireless 500',
    pole: 'Joey Logano',
    mostLaps: 'Christopher Bell',
    fastest: 'Joey Logano',
    winner: 'Ryan Blaney',
    manufacturer: 'Ford',
  },
];

const FULL_HTML = buildRaceResultsPageHtml({ rows: SAMPLE_ROWS });

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

describe('fetchNascarCupSeasonResults', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses the Race_results table into one RaceResult per points round', async () => {
    mockFetchOk(FULL_HTML);
    const races = await fetchNascarCupSeasonResults({ rounds: ROUNDS_FIXTURE });
    // The Clash row has no race number and should be excluded.
    expect(races).toHaveLength(4);
    expect(races[0].round).toBe(1);
    expect(races[0].raceName).toBe('Daytona 500');
    expect(races[0].results).toHaveLength(1);
    expect(races[0].results[0]).toEqual({
      position: 1,
      driverName: 'Tyler Reddick',
      team: 'Toyota',
      status: 'Winner',
      time: undefined,
      points: 0,
    });
  });

  it('uses the rounds.json lookup for the race date', async () => {
    mockFetchOk(FULL_HTML);
    const races = await fetchNascarCupSeasonResults({ rounds: ROUNDS_FIXTURE });
    expect(races[0].date.toISOString().startsWith('2026-02-15')).toBe(true);
    expect(races[3].date.toISOString().startsWith('2026-03-08')).toBe(true);
  });

  it('skips rows whose round has no entry in the rounds lookup', async () => {
    const reducedRounds = ROUNDS_FIXTURE.slice(0, 2); // rounds 1 + 2 only
    mockFetchOk(FULL_HTML);
    const races = await fetchNascarCupSeasonResults({ rounds: reducedRounds });
    expect(races).toHaveLength(2);
    expect(races.map((r) => r.round)).toEqual([1, 2]);
  });

  it('returns empty array when fewer than 1 race parsed (no data yet)', async () => {
    const emptyHtml = buildRaceResultsPageHtml({ rows: [] });
    mockFetchOk(emptyHtml);
    const races = await fetchNascarCupSeasonResults({ rounds: ROUNDS_FIXTURE });
    expect(races).toEqual([]);
  });

  it('returns empty array when the Race_results section is missing', async () => {
    const html = '<!DOCTYPE html><html><body><h3 id="Other">Other</h3></body></html>';
    mockFetchOk(html);
    const races = await fetchNascarCupSeasonResults({ rounds: ROUNDS_FIXTURE });
    expect(races).toEqual([]);
  });

  it('returns empty array on 500 without throwing', async () => {
    mockFetch500();
    const races = await fetchNascarCupSeasonResults({ rounds: ROUNDS_FIXTURE });
    expect(races).toEqual([]);
  });

  it('returns empty array on network failure without throwing', async () => {
    mockFetchReject();
    const races = await fetchNascarCupSeasonResults({ rounds: ROUNDS_FIXTURE });
    expect(races).toEqual([]);
  });

  it('sorts results by round number', async () => {
    const shuffled = [SAMPLE_ROWS[4], SAMPLE_ROWS[1], SAMPLE_ROWS[3], SAMPLE_ROWS[2]];
    const html = buildRaceResultsPageHtml({ rows: shuffled });
    mockFetchOk(html);
    const races = await fetchNascarCupSeasonResults({ rounds: ROUNDS_FIXTURE });
    expect(races.map((r) => r.round)).toEqual([1, 2, 3, 4]);
  });
});