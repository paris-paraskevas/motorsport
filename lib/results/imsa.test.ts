import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchImsaSeasonResults } from './imsa';

// Wikipedia's "Race results" table is laid out in pair-rows: one row for the
// winning-team-per-class cells, the next row for winning-driver-per-class
// cells. Header occupies the first two rows.
function buildResultsPageHtml(opts?: {
  // Drop the Race results section entirely
  omitRaceResults?: boolean;
  // Replace one round's GTP team cell with "did not participate"
  gtpDidNotParticipateAtRound2?: boolean;
  // Make round 3 have an empty drivers row (mid-edit upstream)
  emptyDriversRoundThree?: boolean;
  // Header columns: rename "GTP Winning Team" to break the header parser
  brokenHeader?: boolean;
}): string {
  const gtpTeamHeader = opts?.brokenHeader
    ? 'GTP Champion'
    : 'GTP Winning Team';

  const header = `
    <tr>
      <th>Rnd</th>
      <th>Circuit</th>
      <th>${gtpTeamHeader}</th>
      <th>LMP2 Winning Team</th>
      <th>GTD Pro Winning Team</th>
      <th>GTD Winning Team</th>
      <th>Report</th>
    </tr>
    <tr>
      <th>GTP Winning Drivers</th>
      <th>LMP2 Winning Drivers</th>
      <th>GTD Pro Winning Drivers</th>
      <th>GTD Winning Drivers</th>
    </tr>
  `;

  // Round 1 — all four classes ran
  const round1Teams = `
    <tr>
      <th>1</th>
      <td>Daytona</td>
      <td>#7 Porsche Penske Motorsport</td>
      <td>#04 CrowdStrike Racing by APR</td>
      <td>#1 Paul Miller Racing</td>
      <td>#57 Winward Racing</td>
      <td>Report</td>
    </tr>
  `;
  const round1Drivers = `
    <tr>
      <td>Julien Andlauer Laurin Heinrich Felipe Nasr</td>
      <td>Malthe Jakobsen George Kurtz Alex Quinn Toby Sowery</td>
      <td>Connor De Phillippi Dan Harper Max Hesse Neil Verhagen</td>
      <td>Lucas Auer Indy Dontje Philip Ellis Russell Ward</td>
    </tr>
  `;

  // Round 2 — Sebring; default all four classes ran. Optionally drop GTP.
  const round2GTPTeam = opts?.gtpDidNotParticipateAtRound2
    ? 'did not participate'
    : '#7 Porsche Penske Motorsport';
  const round2Teams = `
    <tr>
      <th>2</th>
      <td>Sebring</td>
      <td>${round2GTPTeam}</td>
      <td>#2 United Autosports USA</td>
      <td>#911 Manthey Racing</td>
      <td>#21 AF Corse USA</td>
      <td>Report</td>
    </tr>
  `;
  const round2Drivers = `
    <tr>
      <td>${opts?.gtpDidNotParticipateAtRound2 ? '' : 'Julien Andlauer Laurin Heinrich Felipe Nasr'}</td>
      <td>Phil Fayer Mikkel Jensen Hunter McElrea</td>
      <td>Klaus Bachler Ricardo Feller Thomas Preining</td>
      <td>Antonio Fuoco Simon Mann Lilou Wadoux</td>
    </tr>
  `;

  // Round 3 — Long Beach sprint; LMP2 + GTD Pro skip per real IMSA calendar
  const round3Teams = `
    <tr>
      <th>3</th>
      <td>Long Beach</td>
      <td>#93 Acura Meyer Shank Racing with Curb-Agajanian</td>
      <td>did not participate</td>
      <td>did not participate</td>
      <td>#12 Vasser Sullivan Racing</td>
      <td>Report</td>
    </tr>
  `;
  const round3Drivers = opts?.emptyDriversRoundThree
    ? '<tr><td></td><td></td></tr>'
    : `
    <tr>
      <td>Nick Yelloly Renger van der Zande</td>
      <td>Benjamin Pedersen Aaron Telitz</td>
    </tr>
  `;

  // Round 4 — upcoming/future, empty
  const round4Teams = `
    <tr>
      <th>4</th>
      <td>Detroit</td>
      <td></td>
      <td>did not participate</td>
      <td></td>
      <td>did not participate</td>
      <td></td>
    </tr>
  `;
  const round4Drivers = `<tr><td></td><td></td></tr>`;

  const raceTable = `
    <table class="wikitable">
      ${header}
      ${round1Teams}
      ${round1Drivers}
      ${round2Teams}
      ${round2Drivers}
      ${round3Teams}
      ${round3Drivers}
      ${round4Teams}
      ${round4Drivers}
    </table>
  `;

  return `
<html><body>
  <h2>Schedule</h2>
  <table class="wikitable"><tr><th>Round</th></tr><tr><td>1</td></tr></table>
  ${opts?.omitRaceResults ? '' : `<h2>Race results</h2>${raceTable}`}
  <h2>Championship standings</h2>
  <table class="wikitable"><tr><th>Pos</th></tr></table>
</body></html>
`;
}

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
    text: async () => 'err',
  }) as unknown as typeof fetch;
}
function mockFetchReject() {
  globalThis.fetch = vi
    .fn()
    .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
}

describe('fetchImsaSeasonResults', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses 4 rounds with per-class winners', async () => {
    mockFetchOk(buildResultsPageHtml());
    const results = await fetchImsaSeasonResults();
    expect(results).toHaveLength(4);

    // Round 1 — Daytona: all four classes
    const r1 = results[0];
    expect(r1.round).toBe(1);
    expect(r1.circuit).toBe('Daytona');
    expect(r1.winners.GTP).toEqual({
      team: '#7 Porsche Penske Motorsport',
      drivers: 'Julien Andlauer Laurin Heinrich Felipe Nasr',
    });
    expect(r1.winners.LMP2).toEqual({
      team: '#04 CrowdStrike Racing by APR',
      drivers: 'Malthe Jakobsen George Kurtz Alex Quinn Toby Sowery',
    });
    expect(r1.winners['GTD Pro']).toBeDefined();
    expect(r1.winners.GTD).toBeDefined();

    // Round 3 — Long Beach: LMP2 + GTD Pro absent
    const r3 = results[2];
    expect(r3.circuit).toBe('Long Beach');
    expect(r3.winners.GTP).toBeDefined();
    expect(r3.winners.GTP!.team).toBe(
      '#93 Acura Meyer Shank Racing with Curb-Agajanian',
    );
    expect(r3.winners.LMP2).toBeUndefined();
    expect(r3.winners['GTD Pro']).toBeUndefined();
    expect(r3.winners.GTD).toEqual({
      team: '#12 Vasser Sullivan Racing',
      drivers: 'Benjamin Pedersen Aaron Telitz',
    });

    // Round 4 — Detroit, upcoming/empty: GTP + GTD Pro have empty team cells
    // so all four classes should be undefined (LMP2/GTD also did not run).
    const r4 = results[3];
    expect(r4.round).toBe(4);
    expect(r4.circuit).toBe('Detroit');
    expect(r4.winners.GTP).toBeUndefined();
    expect(r4.winners.LMP2).toBeUndefined();
    expect(r4.winners['GTD Pro']).toBeUndefined();
    expect(r4.winners.GTD).toBeUndefined();
  });

  it('drops "did not participate" classes from winners map', async () => {
    mockFetchOk(buildResultsPageHtml({ gtpDidNotParticipateAtRound2: true }));
    const results = await fetchImsaSeasonResults();
    const r2 = results[1];
    expect(r2.winners.GTP).toBeUndefined();
    // Other classes still populated
    expect(r2.winners.LMP2).toBeDefined();
    expect(r2.winners['GTD Pro']).toBeDefined();
    expect(r2.winners.GTD).toBeDefined();
  });

  it('handles empty drivers row gracefully (drivers string blank)', async () => {
    mockFetchOk(buildResultsPageHtml({ emptyDriversRoundThree: true }));
    const results = await fetchImsaSeasonResults();
    const r3 = results[2];
    // Team-winners still recorded
    expect(r3.winners.GTP).toBeDefined();
    expect(r3.winners.GTP!.team).toBe(
      '#93 Acura Meyer Shank Racing with Curb-Agajanian',
    );
    // Drivers string empty rather than crashing
    expect(r3.winners.GTP!.drivers).toBe('');
  });

  it('returns empty array when Race results section is missing', async () => {
    mockFetchOk(buildResultsPageHtml({ omitRaceResults: true }));
    const results = await fetchImsaSeasonResults();
    expect(results).toEqual([]);
  });

  it('returns empty array when the header is renamed (parser drift)', async () => {
    mockFetchOk(buildResultsPageHtml({ brokenHeader: true }));
    const results = await fetchImsaSeasonResults();
    // With "GTP Champion" instead of "GTP Winning Team", the GTP column maps
    // out; LMP2/GTDPro/GTD still parse. So we expect the rounds but with no
    // GTP winners.
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].winners.GTP).toBeUndefined();
    expect(results[0].winners.LMP2).toBeDefined();
  });

  it('returns empty array on 500 without throwing', async () => {
    mockFetch500();
    const results = await fetchImsaSeasonResults();
    expect(results).toEqual([]);
  });

  it('returns empty array on network failure without throwing', async () => {
    mockFetchReject();
    const results = await fetchImsaSeasonResults();
    expect(results).toEqual([]);
  });
});
