import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchWRCSeasonResults, parseSeasonResultsFromHtml } from './wrc';

// Wikipedia's 2026 WRC calendar/results table has columns roughly like:
// Round | Rally | Surface | Date | HQ | Stages | Winning driver | Co-driver | Manufacturer
// Upcoming rounds have empty winner cells. Completed rounds have all fields.
function buildCalendarRow(opts: {
  round: number;
  rally: string;
  surface: string;
  date: string;
  hq: string;
  stages: string;
  winner?: string;
  coDriver?: string;
  team?: string;
}): string {
  return `
    <tr>
      <td>${opts.round}</td>
      <td><a href="/wiki/${opts.rally.replace(/ /g, '_')}">${opts.rally}</a></td>
      <td>${opts.surface}</td>
      <td>${opts.date}</td>
      <td>${opts.hq}</td>
      <td>${opts.stages}</td>
      <td>${opts.winner ? `<a href="/wiki/${opts.winner.replace(/ /g, '_')}">${opts.winner}</a>` : ''}</td>
      <td>${opts.coDriver ?? ''}</td>
      <td>${opts.team ?? ''}</td>
    </tr>
  `;
}

const FULL_CALENDAR_HTML = `
<!DOCTYPE html>
<html><body>
<h2 id="Calendar">Calendar</h2>
<table class="wikitable">
  <tbody>
    <tr>
      <th>Round</th>
      <th>Rally</th>
      <th>Surface</th>
      <th>Date</th>
      <th>Headquarters</th>
      <th>Stages</th>
      <th>Winning driver</th>
      <th>Co-driver</th>
      <th>Manufacturer</th>
    </tr>
    ${buildCalendarRow({
      round: 1,
      rally: 'Rallye Monte-Carlo',
      surface: 'Tarmac',
      date: '22–25 January',
      hq: 'Gap',
      stages: '17',
      winner: 'Oliver Solberg',
      coDriver: 'Elliott Edmondson',
      team: 'Toyota Gazoo Racing WRT',
    })}
    ${buildCalendarRow({
      round: 2,
      rally: 'Rally Sweden',
      surface: 'Snow',
      date: '12–15 February',
      hq: 'Umeå',
      stages: '18',
      winner: 'Elfyn Evans',
      coDriver: 'Scott Martin',
      team: 'Toyota Gazoo Racing WRT',
    })}
    ${buildCalendarRow({
      round: 3,
      rally: 'Safari Rally Kenya',
      surface: 'Gravel',
      date: '12–15 March',
      hq: 'Nairobi',
      stages: '19',
      winner: 'Takamoto Katsuta',
      coDriver: 'Aaron Johnston',
      team: 'Toyota Gazoo Racing WRT',
    })}
    ${buildCalendarRow({
      round: 4,
      rally: 'Croatia Rally',
      surface: 'Tarmac',
      date: '9–12 April',
      hq: 'Rijeka',
      stages: '20',
      winner: 'Takamoto Katsuta',
      coDriver: 'Aaron Johnston',
      team: 'Toyota Gazoo Racing WRT',
    })}
    ${buildCalendarRow({
      round: 5,
      rally: 'Rally Islas Canarias',
      surface: 'Tarmac',
      date: '23–26 April',
      hq: 'Las Palmas',
      stages: '15',
      winner: 'Sébastien Ogier',
      coDriver: 'Vincent Landais',
      team: 'Toyota Gazoo Racing WRT',
    })}
    ${buildCalendarRow({
      round: 6,
      rally: 'Rally de Portugal',
      surface: 'Gravel',
      date: '7–10 May',
      hq: 'Matosinhos',
      stages: '21',
      winner: 'Thierry Neuville',
      coDriver: 'Martijn Wydaeghe',
      team: 'Hyundai Shell Mobis WRT',
    })}
    ${buildCalendarRow({
      round: 7,
      rally: 'Rally Japan',
      surface: 'Tarmac',
      date: '28–31 May',
      hq: 'Toyota',
      stages: 'TBC',
    })}
    ${buildCalendarRow({
      round: 8,
      rally: 'Acropolis Rally Greece',
      surface: 'Gravel',
      date: '25–28 June',
      hq: 'Loutraki',
      stages: 'TBC',
    })}
  </tbody>
</table>
</body></html>
`;

const NO_TABLE_HTML = `
<!DOCTYPE html>
<html><body>
<h2 id="Calendar">Calendar</h2>
<p>To be announced.</p>
</body></html>
`;

const EMPTY_HTML = `<html><body></body></html>`;

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
    status: 500,
    text: async () => 'Error',
  }) as unknown as typeof fetch;
}

function mockReject() {
  globalThis.fetch = vi
    .fn()
    .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
}

describe('parseSeasonResultsFromHtml', () => {
  it('parses completed rallies from the calendar table and skips upcoming ones', () => {
    const races = parseSeasonResultsFromHtml(FULL_CALENDAR_HTML, 2026);
    expect(races).toHaveLength(6);
    expect(races.map(r => r.round)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(races[0].raceName).toBe('Rallye Monte-Carlo');
    expect(races[0].date.toISOString().startsWith('2026-01-22')).toBe(true);
    expect(races[0].results[0]).toEqual({
      position: 1,
      driverName: 'Oliver Solberg / Elliott Edmondson',
      team: 'Toyota Gazoo Racing WRT',
      status: 'Winner',
      points: 25,
    });
    expect(races[5].raceName).toBe('Rally de Portugal');
    expect(races[5].results[0].driverName).toBe('Thierry Neuville / Martijn Wydaeghe');
    expect(races[5].results[0].team).toBe('Hyundai Shell Mobis WRT');
  });

  it('sorts rallies by round number', () => {
    const races = parseSeasonResultsFromHtml(FULL_CALENDAR_HTML, 2026);
    for (let i = 1; i < races.length; i++) {
      expect(races[i].round).toBeGreaterThan(races[i - 1].round);
    }
  });

  it('parses dates in February correctly (cross-month month names)', () => {
    const races = parseSeasonResultsFromHtml(FULL_CALENDAR_HTML, 2026);
    const sweden = races.find(r => r.round === 2)!;
    expect(sweden.date.toISOString().startsWith('2026-02-12')).toBe(true);
  });

  it('returns empty array when calendar table is missing', () => {
    expect(parseSeasonResultsFromHtml(NO_TABLE_HTML, 2026)).toEqual([]);
  });

  it('returns empty array on empty HTML', () => {
    expect(parseSeasonResultsFromHtml(EMPTY_HTML, 2026)).toEqual([]);
  });
});

describe('fetchWRCSeasonResults', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns parsed rallies on successful fetch', async () => {
    mockOk(FULL_CALENDAR_HTML);
    const races = await fetchWRCSeasonResults(2026);
    expect(races).toHaveLength(6);
    expect(races[0].raceName).toBe('Rallye Monte-Carlo');
  });

  it('returns empty array on fetch failure', async () => {
    mockFail();
    const races = await fetchWRCSeasonResults(2026);
    expect(races).toEqual([]);
  });

  it('returns empty array when network throws', async () => {
    mockReject();
    const races = await fetchWRCSeasonResults(2026);
    expect(races).toEqual([]);
  });
});
