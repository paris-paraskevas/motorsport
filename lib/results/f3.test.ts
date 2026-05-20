import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchF3SeasonResults,
  parseRaceTables,
  parseRoundsFromStandings,
} from './f3';

// The standings page is the canonical source of "rounds that count this
// season" — when Bahrain (raceid=1070) was cancelled it simply disappears
// from the column header list, so the round number is the position of the
// surviving `/Results?raceid=NNN` link, not the raceid itself.
function standingsHeaderHtml(
  rounds: Array<{ raceid: number; venue: string; dates: string }>,
): string {
  const ths = rounds
    .map(
      r => `<th>
        <div class="country">
          <a href="/Results?raceid=${r.raceid}">
            <div class="country-name"><span>${r.venue}</span></div>
            <div class="dates">${r.dates}</div>
          </a>
        </div>
      </th>`,
    )
    .join('');
  return `
    <html><body>
      <table class="table table-bordered">
        <thead><tr>
          <th class="sticky-col col-three driver-name-col"><div class="heading">Driver</div></th>
          <th class="sticky-col col-four"><div class="heading">Points</div></th>
          ${ths}
        </tr></thead>
        <tbody></tbody>
      </table>
    </body></html>
  `;
}

function raceRow(opts: {
  pos: number;
  name: string;
  code: string;
  team: string;
  laps?: string;
  time?: string;
  gap?: string;
}): string {
  // Mirrors the actual fiaformula3.com /Results table row: driver-name-wrapper
  // holds pos + abbreviation; the team is a `.team-name` span inside the
  // driver-name block; subsequent <td> cells wrap each metric in a single
  // `.score-wrapper` (LAPS, TIME, GAP, INT, KPH, BEST, LAP).
  return `
    <tr>
      <td class="sticky-col col-one">
        <div class="driver-name-wrapper">
          <div class="pos">${opts.pos}</div>
          <div class="car-no">${opts.pos * 2}</div>
          <div class="driver-name">
            <span class="visible-desktop-up">${opts.name}</span>
            <span class="visible-desktop-down">${opts.code}</span>
            <span class="team-name">${opts.team}</span>
          </div>
        </div>
      </td>
      <td><div class="score-wrapper">${opts.laps ?? '23'}</div></td>
      <td><div class="score-wrapper">${opts.time ?? (opts.pos === 1 ? '42:59.653' : '-')}</div></td>
      <td><div class="score-wrapper">${opts.gap ?? (opts.pos === 1 ? '-' : '+' + (opts.pos * 0.5).toFixed(3))}</div></td>
      <td><div class="score-wrapper">-</div></td>
      <td><div class="score-wrapper">169.4</div></td>
      <td><div class="score-wrapper">1:37.0</div></td>
      <td><div class="score-wrapper">${opts.pos}</div></td>
    </tr>
  `;
}

function raceTable(rows: string): string {
  return `<table class="table table-bordered">
    <thead><tr><th>POS</th><th>LAPS</th><th>TIME</th><th>GAP</th><th>INT.</th><th>KPH</th><th>BEST</th><th>LAP</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildResultsPage(opts: {
  featureRows?: string;
  sprintRows?: string;
  includeQualifying?: boolean;
  includePractice?: boolean;
}): string {
  const sections: string[] = [];

  if (opts.featureRows) {
    sections.push(`
      <div class="collapsible">
        <div class="collapsible-header"><h2><p><span>Feature Race</span> Results </p></h2></div>
        <div class="collapsible-content">${raceTable(opts.featureRows)}</div>
      </div>
    `);
  } else {
    // Pre-race: header but no table.
    sections.push(`
      <div class="collapsible">
        <div class="collapsible-header"><h2><p><span>Feature Race</span> Results </p></h2></div>
        <div class="collapsible-content"></div>
      </div>
    `);
  }

  if (opts.sprintRows) {
    sections.push(`
      <div class="collapsible">
        <div class="collapsible-header"><h2><p><span>Sprint Race</span> Results </p></h2></div>
        <div class="collapsible-content">${raceTable(opts.sprintRows)}</div>
      </div>
    `);
  } else {
    sections.push(`
      <div class="collapsible">
        <div class="collapsible-header"><h2><p><span>Sprint Race</span> Results </p></h2></div>
        <div class="collapsible-content"></div>
      </div>
    `);
  }

  // Qualifying + Practice headers are always present on the live site. We
  // include them in the fixture so the parser proves it can skip them.
  if (opts.includeQualifying ?? true) {
    sections.push(`
      <div class="collapsible">
        <div class="collapsible-header"><h2><p><span>Qualifying</span> Results </p></h2></div>
        <div class="collapsible-content">${raceTable(
          Array.from({ length: 10 }, (_, i) => raceRow({ pos: i + 1, name: `Q${i + 1}`, code: `Q${i}`, team: 'TeamQ' })).join(''),
        )}</div>
      </div>
    `);
  }
  if (opts.includePractice ?? true) {
    sections.push(`
      <div class="collapsible">
        <div class="collapsible-header"><h2><p><span>Practice</span> Results </p></h2></div>
        <div class="collapsible-content">${raceTable(
          Array.from({ length: 10 }, (_, i) => raceRow({ pos: i + 1, name: `P${i + 1}`, code: `P${i}`, team: 'TeamP' })).join(''),
        )}</div>
      </div>
    `);
  }

  return `<html><body>${sections.join('\n')}</body></html>`;
}

// Builds a 12-row race table (Feature or Sprint format).
function twelveRows(): string {
  return Array.from({ length: 12 }, (_, i) =>
    raceRow({
      pos: i + 1,
      name: `Driver${i + 1}`,
      code: `D${String(i + 1).padStart(2, '0')}`,
      team: `Team${(i % 4) + 1}`,
    }),
  ).join('');
}

describe('parseRoundsFromStandings', () => {
  it('extracts round descriptors in the order the column headers appear', () => {
    const html = standingsHeaderHtml([
      { raceid: 1069, venue: 'Melbourne', dates: '06-08 Mar ' },
      { raceid: 1071, venue: 'Monaco', dates: '04-07 Jun ' },
      { raceid: 1072, venue: 'Barcelona', dates: '12-14 Jun ' },
    ]);
    const rounds = parseRoundsFromStandings(html);
    expect(rounds).toHaveLength(3);
    expect(rounds[0]).toEqual({
      raceId: 1069,
      round: 1,
      venue: 'Melbourne',
      dateRange: '06-08 Mar',
    });
    // Monaco is round 2 even though the raceid jumped from 1069 to 1071 —
    // Bahrain (raceid=1070) was cancelled and so does not appear.
    expect(rounds[1]).toEqual({
      raceId: 1071,
      round: 2,
      venue: 'Monaco',
      dateRange: '04-07 Jun',
    });
    expect(rounds[2].round).toBe(3);
  });
});

describe('parseRaceTables', () => {
  it('returns both feature + sprint tables and skips quali / practice', () => {
    const html = buildResultsPage({
      featureRows: twelveRows(),
      sprintRows: twelveRows(),
    });
    const tables = parseRaceTables(html);
    expect(tables).toHaveLength(2);
    expect(tables[0].type).toBe('feature');
    expect(tables[1].type).toBe('sprint');
    expect(tables[0].rows).toHaveLength(12);
    // Winner of the feature race gets full 25 points.
    expect(tables[0].rows[0]).toMatchObject({
      position: 1,
      driverName: 'Driver1',
      driverCode: 'D01',
      team: 'Team1',
      status: 'Finished',
      points: 25,
    });
    // P9 in a Feature race scores 2 points; P11 scores 0.
    expect(tables[0].rows[8].points).toBe(2);
    expect(tables[0].rows[10].points).toBe(0);
    // Sprint Race awards 15 to the winner, not 25.
    expect(tables[1].rows[0].points).toBe(15);
    // P9 in a Sprint race is outside the 8-driver points cutoff.
    expect(tables[1].rows[8].points).toBe(0);
  });

  it('skips a race section whose header has no table (race not run yet)', () => {
    const html = buildResultsPage({
      featureRows: twelveRows(),
      // Sprint hasn't run — header exists, no table.
    });
    const tables = parseRaceTables(html);
    expect(tables).toHaveLength(1);
    expect(tables[0].type).toBe('feature');
  });

  it('skips a race section whose body is below the sanity floor', () => {
    const html = buildResultsPage({
      featureRows: Array.from({ length: 3 }, (_, i) =>
        raceRow({
          pos: i + 1,
          name: `D${i}`,
          code: `D0${i}`,
          team: 'T',
        }),
      ).join(''),
      sprintRows: twelveRows(),
    });
    const tables = parseRaceTables(html);
    // Only the well-populated sprint table survives.
    expect(tables).toHaveLength(1);
    expect(tables[0].type).toBe('sprint');
  });

  it('marks a DNF row as such and zeroes its points even when finishing P1', () => {
    const dnfFirst =
      raceRow({
        pos: 1,
        name: 'Ghost',
        code: 'GHO',
        team: 'TeamX',
        time: 'DNF',
        gap: '-',
      }) +
      Array.from({ length: 11 }, (_, i) =>
        raceRow({
          pos: i + 2,
          name: `D${i + 2}`,
          code: `D0${i + 2}`,
          team: 'T',
        }),
      ).join('');
    const html = buildResultsPage({ featureRows: dnfFirst });
    const tables = parseRaceTables(html);
    expect(tables[0].rows[0]).toMatchObject({
      position: 1,
      driverName: 'Ghost',
      status: 'DNF',
      points: 0,
    });
  });
});

describe('fetchF3SeasonResults', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('iterates rounds from standings and assembles RaceResult per finished race', async () => {
    const standingsHtml = standingsHeaderHtml([
      { raceid: 1069, venue: 'Melbourne', dates: '06-08 Mar ' },
      { raceid: 1071, venue: 'Monaco', dates: '04-07 Jun ' },
    ]);
    const melbourneHtml = buildResultsPage({
      featureRows: twelveRows(),
      sprintRows: twelveRows(),
    });
    // Monaco hasn't run yet — no race tables, just session headers.
    const monacoHtml = buildResultsPage({});

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/Standings/Driver')) {
          return { ok: true, status: 200, text: async () => standingsHtml } as Response;
        }
        if (url.includes('raceid=1069')) {
          return { ok: true, status: 200, text: async () => melbourneHtml } as Response;
        }
        if (url.includes('raceid=1071')) {
          return { ok: true, status: 200, text: async () => monacoHtml } as Response;
        }
        return { ok: false, status: 404, text: async () => '' } as Response;
      }),
    );

    const races = await fetchF3SeasonResults(2026);
    expect(races).toHaveLength(2);
    expect(races[0].round).toBe(1);
    expect(races[0].raceName).toBe('Melbourne Feature Race');
    expect(races[0].circuit).toBe('Melbourne');
    // 8 Mar 2026, anchored at UTC midnight.
    expect(races[0].date.toISOString().startsWith('2026-03-08')).toBe(true);
    expect(races[1].round).toBe(1);
    expect(races[1].raceName).toBe('Melbourne Sprint Race');
  });

  it('returns empty array when the standings fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      }) as Response),
    );
    const races = await fetchF3SeasonResults(2026);
    expect(races).toEqual([]);
  });

  it('returns empty array when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const races = await fetchF3SeasonResults(2026);
    expect(races).toEqual([]);
  });

  it('returns empty array when the standings page renders no rounds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => '<html><body><p>Empty</p></body></html>',
      }) as Response),
    );
    const races = await fetchF3SeasonResults(2026);
    expect(races).toEqual([]);
  });
});
