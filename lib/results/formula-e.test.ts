import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchFormulaESeasonResults } from './formula-e';

// Realistic fixture mirroring Wikipedia REST HTML for the 2025–26 FE season
// race-results table. Wikipedia exposes the race winners per round in a
// wikitable with the Round / E-Prix / Pole / Fastest lap / Winning driver /
// Winning team / Winning manufacturer / Report columns.

function raceRow(opts: {
  round: number;
  ePrix: string;
  pole?: string;
  fastest?: string;
  winningDriver: string;
  winningTeam: string;
  date?: string;
}): string {
  return `
    <tr>
      <td>${opts.round}</td>
      <td>${opts.ePrix}${opts.date ? ` (${opts.date})` : ''}</td>
      <td>${opts.pole ?? 'TBD'}<sup>[a]</sup></td>
      <td>${opts.fastest ?? 'TBD'}<sup>[b]</sup></td>
      <td>${opts.winningDriver}</td>
      <td>${opts.winningTeam}</td>
      <td>Porsche</td>
      <td><a href="#report">Report</a></td>
    </tr>
  `;
}

function raceTable(rows: string): string {
  return `
    <table class="wikitable">
      <tbody>
        <tr>
          <th>Round</th><th>E-Prix</th>
          <th>Pole position</th><th>Fastest lap</th>
          <th>Winning driver</th><th>Winning team</th>
          <th>Winning manufacturer</th><th>Report</th>
        </tr>
        ${rows}
      </tbody>
    </table>
  `;
}

const REAL_ROWS = [
  raceRow({ round: 1, ePrix: 'São Paulo ePrix', winningDriver: 'Jake Dennis', winningTeam: 'Andretti Formula E', date: '6 December 2025' }),
  raceRow({ round: 2, ePrix: 'Mexico City ePrix', winningDriver: 'Nick Cassidy', winningTeam: 'Citroën Racing', date: '10 January 2026' }),
  raceRow({ round: 3, ePrix: 'Miami ePrix', winningDriver: 'Mitch Evans', winningTeam: 'Jaguar TCS Racing', date: '31 January 2026' }),
  raceRow({ round: 4, ePrix: 'Jeddah ePrix', winningDriver: 'Pascal Wehrlein', winningTeam: 'Porsche Formula E Team', date: '13 February 2026' }),
  raceRow({ round: 5, ePrix: 'Jeddah ePrix', winningDriver: 'António Félix da Costa', winningTeam: 'Jaguar TCS Racing', date: '14 February 2026' }),
  raceRow({ round: 6, ePrix: 'Madrid ePrix', winningDriver: 'António Félix da Costa', winningTeam: 'Jaguar TCS Racing', date: '21 March 2026' }),
  raceRow({ round: 7, ePrix: 'Berlin ePrix', winningDriver: 'Nico Müller', winningTeam: 'Porsche Formula E Team', date: '2 May 2026' }),
  raceRow({ round: 8, ePrix: 'Berlin ePrix', winningDriver: 'Mitch Evans', winningTeam: 'Jaguar TCS Racing', date: '3 May 2026' }),
  raceRow({ round: 9, ePrix: 'Monaco ePrix', winningDriver: 'Nyck de Vries', winningTeam: 'Mahindra Racing', date: '16 May 2026' }),
  raceRow({ round: 10, ePrix: 'Monaco ePrix', winningDriver: 'Oliver Rowland', winningTeam: 'Nissan Formula E Team', date: '17 May 2026' }),
  // Future rounds with TBD / em-dash markers — parser should skip these
  raceRow({ round: 11, ePrix: 'Sanya ePrix', winningDriver: '—', winningTeam: '—', date: '20 June 2026' }),
  raceRow({ round: 12, ePrix: 'Shanghai ePrix', winningDriver: 'TBA', winningTeam: 'TBA', date: '4 July 2026' }),
].join('');

const REAL_HTML = `<!DOCTYPE html>
<html><body>
${raceTable(REAL_ROWS)}
</body></html>`;

const SPA_SHELL_HTML = `<!DOCTYPE html>
<html><body><div id="root"></div><p>Loading…</p></body></html>`;

const TWO_ROUND_HTML = `<!DOCTYPE html>
<html><body>
${raceTable(
  [
    raceRow({ round: 1, ePrix: 'São Paulo ePrix', winningDriver: 'Jake Dennis', winningTeam: 'Andretti Formula E', date: '6 December 2025' }),
    raceRow({ round: 2, ePrix: 'Mexico City ePrix', winningDriver: 'Nick Cassidy', winningTeam: 'Citroën Racing', date: '10 January 2026' }),
  ].join(''),
)}
</body></html>`;

const NO_DATE_HTML = `<!DOCTYPE html>
<html><body>
${raceTable(
  [
    // No date at all — parser should skip these rows
    raceRow({ round: 1, ePrix: 'São Paulo', winningDriver: 'Jake Dennis', winningTeam: 'Andretti Formula E' }),
    raceRow({ round: 2, ePrix: 'Mexico City', winningDriver: 'Nick Cassidy', winningTeam: 'Citroën Racing' }),
    raceRow({ round: 3, ePrix: 'Miami', winningDriver: 'Mitch Evans', winningTeam: 'Jaguar TCS Racing' }),
  ].join(''),
)}
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

describe('fetchFormulaESeasonResults', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses 10 completed rounds and skips em-dash / TBA future rounds', async () => {
    mockFetchOk(REAL_HTML);
    const races = await fetchFormulaESeasonResults();
    expect(races).toHaveLength(10);
    expect(races[0].round).toBe(1);
    expect(races[0].raceName).toBe('São Paulo ePrix');
    expect(races[0].circuit).toBe('São Paulo ePrix');
    expect(races[0].date.toISOString().startsWith('2025-12-06')).toBe(true);
    expect(races[0].results).toHaveLength(1);
    expect(races[0].results[0]).toEqual({
      position: 1,
      driverName: 'Jake Dennis',
      team: 'Andretti Formula E',
      status: 'Race winner',
      points: 25,
    });
    expect(races[9].round).toBe(10);
    expect(races[9].results[0].driverName).toBe('Oliver Rowland');
    expect(races[9].results[0].team).toBe('Nissan Formula E Team');
    // Future round 11 ("—") and 12 ("TBA") MUST be skipped
    expect(races.find((r) => r.round === 11)).toBeUndefined();
    expect(races.find((r) => r.round === 12)).toBeUndefined();
  });

  it('parses winners with extra-character names like António Félix da Costa', async () => {
    mockFetchOk(REAL_HTML);
    const races = await fetchFormulaESeasonResults();
    const round5 = races.find((r) => r.round === 5);
    expect(round5).toBeDefined();
    expect(round5!.results[0].driverName).toBe('António Félix da Costa');
    expect(round5!.results[0].team).toBe('Jaguar TCS Racing');
  });

  it('sorts races by round even if Wikipedia emits them out of order', async () => {
    const reversed = [
      raceRow({ round: 5, ePrix: 'Jeddah ePrix', winningDriver: 'António Félix da Costa', winningTeam: 'Jaguar TCS Racing', date: '14 February 2026' }),
      raceRow({ round: 4, ePrix: 'Jeddah ePrix', winningDriver: 'Pascal Wehrlein', winningTeam: 'Porsche Formula E Team', date: '13 February 2026' }),
      raceRow({ round: 3, ePrix: 'Miami ePrix', winningDriver: 'Mitch Evans', winningTeam: 'Jaguar TCS Racing', date: '31 January 2026' }),
      raceRow({ round: 2, ePrix: 'Mexico City ePrix', winningDriver: 'Nick Cassidy', winningTeam: 'Citroën Racing', date: '10 January 2026' }),
      raceRow({ round: 1, ePrix: 'São Paulo ePrix', winningDriver: 'Jake Dennis', winningTeam: 'Andretti Formula E', date: '6 December 2025' }),
    ].join('');
    const html = `<!DOCTYPE html><html><body>${raceTable(reversed)}</body></html>`;
    mockFetchOk(html);
    const races = await fetchFormulaESeasonResults();
    expect(races.map((r) => r.round)).toEqual([1, 2, 3, 4, 5]);
    expect(races[0].results[0].driverName).toBe('Jake Dennis');
    expect(races[4].results[0].driverName).toBe('António Félix da Costa');
  });

  it('returns an empty array when fewer than 3 rounds parse cleanly (sanity floor)', async () => {
    mockFetchOk(TWO_ROUND_HTML);
    const races = await fetchFormulaESeasonResults();
    expect(races).toEqual([]);
  });

  it('returns an empty array when no race table is present at all', async () => {
    mockFetchOk(SPA_SHELL_HTML);
    const races = await fetchFormulaESeasonResults();
    expect(races).toEqual([]);
  });

  it('falls back to a season-end placeholder date when no Date column or Calendar table provides one', async () => {
    // Updated in 0.11.3: Wikipedia's actual FE Race-results table has no
    // Date column. Skipping every dateless row dropped the entire results
    // tab to "temporarily unavailable" — the bug 0.11.3 fixes. Parser now
    // emits a placeholder date (Jan 1 of the season-end year) when neither
    // the results table nor a sibling Calendar table supplies one. Better
    // to ship a row with a slightly-off date label than no row at all.
    mockFetchOk(NO_DATE_HTML);
    const races = await fetchFormulaESeasonResults();
    expect(races.length).toBeGreaterThan(0);
    for (const r of races) {
      expect(Number.isNaN(r.date.getTime())).toBe(false);
    }
  });

  it('returns an empty array on 500 without throwing', async () => {
    mockFetch500();
    const races = await fetchFormulaESeasonResults();
    expect(races).toEqual([]);
  });

  it('returns an empty array on network failure without throwing', async () => {
    mockFetchReject();
    const races = await fetchFormulaESeasonResults();
    expect(races).toEqual([]);
  });
});
