import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchFormulaESeasonResults,
  parseMotorsportweekClassification,
} from './formula-e';

// Two-layer test:
//   1) Season-page parser — discovery layer. We mock the Wikipedia season
//      article (REAL_SEASON_HTML) and verify the parser discovers per-event
//      URLs from the "Report" column, including rowspan-aware doubleheaders.
//   2) Per-event parser — full classification. We mock per-event Wikipedia
//      article fetches and verify the parser extracts all ~20 drivers,
//      assigns correct positions / points / status / time, handles DNF rows,
//      and applies the Citroën Racing → DS Penske team-name alias.
//
// We also test the fallback paths: per-event 500 → winners-only fallback for
// that round; entirely-missing per-event article → winners-only fallback;
// season-page 500 → empty result; <3 parseable rounds → empty result.

function seasonRaceRow(opts: {
  round: number;
  ePrix: string;
  ePrixHref: string;     // /wiki/<ePrixName>_ePrix (the generic name page)
  winningDriver: string;
  winningTeam: string;
  reportHref?: string;   // /wiki/<year>_<ePrixName>_ePrix (the year-specific article)
  reportRowspan?: number; // For doubleheaders: parent row has rowspan=2 on Report
}): string {
  return `
    <tr>
      <td>${opts.round}</td>
      <td><a href="${opts.ePrixHref}">${opts.ePrix}</a></td>
      <td>Pole driver<sup>[a]</sup></td>
      <td>FL driver<sup>[b]</sup></td>
      <td>${opts.winningDriver}</td>
      <td>${opts.winningTeam}</td>
      <td>Porsche</td>
      ${opts.reportHref
        ? `<td${opts.reportRowspan ? ` rowspan="${opts.reportRowspan}"` : ''}><a href="${opts.reportHref}">Report</a></td>`
        : '<td>Report</td>'}
    </tr>
  `;
}

function seasonRaceRowChild(opts: {
  round: number;
  winningDriver: string;
  winningTeam: string;
}): string {
  // Doubleheader child row — E-Prix and Report cells are physically absent
  // because the parent rowspans them. Mirrors Wikipedia's real DOM shape.
  return `
    <tr>
      <td>${opts.round}</td>
      <td>Pole driver<sup>[a]</sup></td>
      <td>FL driver<sup>[b]</sup></td>
      <td>${opts.winningDriver}</td>
      <td>${opts.winningTeam}</td>
      <td>Porsche</td>
    </tr>
  `;
}

function seasonRaceTable(rows: string): string {
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

function seasonCalendarTable(rows: Array<{ round: number; date: string }>): string {
  return `
    <table class="wikitable">
      <tbody>
        <tr>
          <th>Round</th><th>E-Prix</th><th>Country</th><th>Circuit</th><th>Date</th>
        </tr>
        ${rows.map(r => `<tr><td>${r.round}</td><td>X</td><td>Y</td><td>Z</td><td>${r.date}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}

// REAL_SEASON_HTML covers all 10 currently-raced rounds of 2025-26 FE.
// Doubleheaders: rounds 4+5 (Jeddah), 7+8 (Berlin), 9+10 (Monaco). Parent
// rows use rowspan="2" on the Report column to mirror Wikipedia's DOM.
const REAL_SEASON_ROWS = [
  seasonRaceRow({
    round: 1, ePrix: 'São Paulo', ePrixHref: '/wiki/S%C3%A3o_Paulo_ePrix',
    winningDriver: 'Jake Dennis', winningTeam: 'Andretti Formula E',
    reportHref: '/wiki/2025_S%C3%A3o_Paulo_ePrix',
  }),
  seasonRaceRow({
    round: 2, ePrix: 'Mexico City', ePrixHref: '/wiki/Mexico_City_ePrix',
    winningDriver: 'Nick Cassidy', winningTeam: 'Citroën Racing',
    reportHref: '/wiki/2026_Mexico_City_ePrix',
  }),
  seasonRaceRow({
    round: 3, ePrix: 'Miami', ePrixHref: '/wiki/Miami_ePrix',
    winningDriver: 'Mitch Evans', winningTeam: 'Jaguar TCS Racing',
    reportHref: '/wiki/2026_Miami_ePrix',
  }),
  seasonRaceRow({
    round: 4, ePrix: 'Jeddah', ePrixHref: '/wiki/Jeddah_ePrix',
    winningDriver: 'Pascal Wehrlein', winningTeam: 'Porsche Formula E Team',
    reportHref: '/wiki/2026_Jeddah_ePrix', reportRowspan: 2,
  }),
  seasonRaceRowChild({
    round: 5, winningDriver: 'António Félix da Costa', winningTeam: 'Jaguar TCS Racing',
  }),
  seasonRaceRow({
    round: 6, ePrix: 'Madrid', ePrixHref: '/wiki/Madrid_ePrix',
    winningDriver: 'António Félix da Costa', winningTeam: 'Jaguar TCS Racing',
    reportHref: '/wiki/2026_Madrid_ePrix',
  }),
  seasonRaceRow({
    round: 7, ePrix: 'Berlin', ePrixHref: '/wiki/Berlin_ePrix',
    winningDriver: 'Nico Müller', winningTeam: 'Porsche Formula E Team',
    reportHref: '/wiki/2026_Berlin_ePrix', reportRowspan: 2,
  }),
  seasonRaceRowChild({
    round: 8, winningDriver: 'Mitch Evans', winningTeam: 'Jaguar TCS Racing',
  }),
  seasonRaceRow({
    round: 9, ePrix: 'Monaco', ePrixHref: '/wiki/Monaco_ePrix',
    winningDriver: 'Nyck de Vries', winningTeam: 'Mahindra Racing',
    reportHref: '/wiki/2026_Monaco_ePrix', reportRowspan: 2,
  }),
  seasonRaceRowChild({
    round: 10, winningDriver: 'Oliver Rowland', winningTeam: 'Nissan Formula E Team',
  }),
  // Future rounds: present in the table but with em-dash markers.
  `<tr><td>11</td><td><a href="/wiki/Sanya_ePrix">Sanya</a></td><td></td><td></td><td>—</td><td>—</td><td></td><td>Report</td></tr>`,
].join('');

const CALENDAR_ROWS = [
  { round: 1, date: '6 December 2025' },
  { round: 2, date: '10 January 2026' },
  { round: 3, date: '31 January 2026' },
  { round: 4, date: '13 February 2026' },
  { round: 5, date: '14 February 2026' },
  { round: 6, date: '21 March 2026' },
  { round: 7, date: '2 May 2026' },
  { round: 8, date: '3 May 2026' },
  { round: 9, date: '16 May 2026' },
  { round: 10, date: '17 May 2026' },
];

const REAL_SEASON_HTML = `<!DOCTYPE html>
<html><body>
${seasonCalendarTable(CALENDAR_ROWS)}
${seasonRaceTable(REAL_SEASON_ROWS)}
</body></html>`;

// Per-event classification fixture — mirrors the real Wikipedia structure.
// Headers: Pos. | No. | Driver | Team | Laps | Time/Retired | Grid | Points.
// Position is in a <th>; the rest are <td>. Last row is a "Source: [n]" footer
// with colspan=8 — must be skipped.
function classificationTable(
  drivers: Array<{
    pos: string;
    no: number;
    driver: string;
    team: string;
    laps: number;
    time: string;
    grid: number;
    points: string;
  }>,
): string {
  return `
    <table class="wikitable">
      <tbody>
        <tr>
          <th>Pos.</th><th>No.</th><th>Driver</th><th>Team</th>
          <th>Laps</th><th>Time/Retired</th><th>Grid</th><th>Points</th>
        </tr>
        ${drivers.map(d => `
          <tr>
            <th>${d.pos}</th>
            <td>${d.no}</td>
            <td>${d.driver}</td>
            <td>${d.team}</td>
            <td>${d.laps}</td>
            <td>${d.time}</td>
            <td>${d.grid}</td>
            <td>${d.points}</td>
          </tr>
        `).join('')}
        <tr><th colspan="8">Source:<sup>[6]</sup></th></tr>
      </tbody>
    </table>
  `;
}

function eventArticleHtml(classificationTables: string[]): string {
  return `<!DOCTYPE html>
<html><body>
<h2>Background</h2>
<table class="wikitable"><tr><th>Junk header</th></tr><tr><td>data</td></tr></table>
<h2>Classification</h2>
<h3>Qualifying</h3>
<table class="wikitable">
  <tbody>
    <tr><th>Pos.</th><th>No.</th><th>Driver</th><th>Team</th><th>A</th><th>B</th></tr>
    ${[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22].map(p => `
      <tr><th>${p}</th><td>${p}</td><td>Q-Driver ${p}</td><td>Team ${p}</td><td>1:10.0</td><td>1:09.5</td></tr>
    `).join('')}
  </tbody>
</table>
<h3>Race</h3>
${classificationTables.join('\n')}
</body></html>`;
}

const SAO_PAULO_CLASSIFICATION = classificationTable([
  { pos: '1', no: 27, driver: 'Jake Dennis', team: 'Andretti-Porsche', laps: 30, time: '59:23.013', grid: 1, points: '25' },
  { pos: '2', no: 1, driver: 'Oliver Rowland', team: 'Nissan', laps: 30, time: '+1:349', grid: 13, points: '18' },
  { pos: '3', no: 37, driver: 'Nick Cassidy', team: 'Citroën', laps: 30, time: '+1.876', grid: 17, points: '15' },
  { pos: '4', no: 94, driver: 'Pascal Wehrlein', team: 'Porsche', laps: 30, time: '+2.449', grid: 4, points: '12' },
  { pos: '5', no: 51, driver: 'Nico Müller', team: 'Porsche', laps: 30, time: '+3.775', grid: 11, points: '10' },
  { pos: '6', no: 7, driver: 'Maximilian Günther', team: 'DS Penske', laps: 30, time: '+4.436', grid: 16, points: '8' },
  { pos: '7', no: 14, driver: 'Joel Eriksson', team: 'Envision-Jaguar', laps: 30, time: '+4.832', grid: 18, points: '6' },
  { pos: '8', no: 16, driver: 'Sébastien Buemi', team: 'Envision-Jaguar', laps: 30, time: '+5.289', grid: 10, points: '4' },
  { pos: '9', no: 21, driver: 'Nyck de Vries', team: 'Mahindra', laps: 30, time: '+5.370', grid: 5, points: '2' },
  { pos: '10', no: 22, driver: 'Zane Maloney', team: 'Lola Yamaha ABT', laps: 30, time: '+6.095', grid: 19, points: '1' },
  { pos: '11', no: 13, driver: 'António Félix da Costa', team: 'Jaguar', laps: 30, time: '+6.581', grid: 6, points: '' },
  { pos: '12', no: 28, driver: 'Felipe Drugovich', team: 'Andretti-Porsche', laps: 30, time: '+8.187', grid: 17, points: '' },
  { pos: '13', no: 77, driver: 'Taylor Barnard', team: 'DS Penske', laps: 29, time: '+1 lap', grid: 12, points: '' },
  { pos: 'DNF', no: 3, driver: 'Pepe Martí', team: 'Cupra Kiro-Porsche', laps: 27, time: 'Collision', grid: 14, points: '' },
  { pos: 'DNF', no: 25, driver: 'Jean-Éric Vergne', team: 'Citroën', laps: 27, time: 'Collision damage', grid: 8, points: '' },
  { pos: 'DNF', no: 9, driver: 'Mitch Evans', team: 'Jaguar', laps: 26, time: 'Spun out', grid: 9, points: '' },
  { pos: 'DNF', no: 48, driver: 'Edoardo Mortara', team: 'Mahindra', laps: 22, time: 'Collision damage', grid: 3, points: '' },
  { pos: 'DNF', no: 11, driver: 'Lucas di Grassi', team: 'Lola Yamaha ABT', laps: 22, time: 'Collision', grid: 20, points: '' },
  { pos: 'DNF', no: 23, driver: 'Norman Nato', team: 'Nissan', laps: 17, time: 'Collision damage', grid: 7, points: '' },
  { pos: 'DNF', no: 33, driver: 'Dan Ticktum', team: 'Cupra Kiro-Porsche', laps: 16, time: 'Collision damage', grid: 2, points: '' },
]);

// Mexico City — Cassidy listed as "Citroën Racing" on Wikipedia (known-wrong;
// real team is DS Penske per fiaformulae.com). Verifies the team-alias map.
const MEXICO_CITY_CLASSIFICATION = classificationTable([
  { pos: '1', no: 37, driver: 'Nick Cassidy', team: 'Citroën Racing', laps: 38, time: '49:25.393', grid: 13, points: '25' },
  { pos: '2', no: 48, driver: 'Edoardo Mortara', team: 'Mahindra Racing', laps: 38, time: '+0.651', grid: 3, points: '18' },
  { pos: '3', no: 1, driver: 'Oliver Rowland', team: 'Nissan', laps: 38, time: '+0.945', grid: 8, points: '15' },
  { pos: '4', no: 77, driver: 'Taylor Barnard', team: 'DS Penske', laps: 38, time: '+1.436', grid: 2, points: '12' },
  { pos: '5', no: 27, driver: 'Jake Dennis', team: 'Andretti-Porsche', laps: 38, time: '+1.647', grid: 7, points: '10' },
  { pos: '6', no: 94, driver: 'Pascal Wehrlein', team: 'Porsche Formula E Team', laps: 38, time: '+1.936', grid: 11, points: '8' },
  { pos: '7', no: 3, driver: 'Pepe Martí', team: 'Cupra Kiro-Porsche', laps: 38, time: '+3.894', grid: 20, points: '6' },
  { pos: '8', no: 25, driver: 'Jean-Éric Vergne', team: 'Citroën Racing', laps: 38, time: '+4.943', grid: 18, points: '4' },
  { pos: '9', no: 51, driver: 'Nico Müller', team: 'Porsche Formula E Team', laps: 38, time: '+5.143', grid: 5, points: '2' },
  { pos: '10', no: 23, driver: 'Norman Nato', team: 'Nissan', laps: 38, time: '+5.843', grid: 12, points: '1' },
  { pos: '11', no: 9, driver: 'Mitch Evans', team: 'Jaguar Racing', laps: 38, time: '+6.168', grid: 4, points: '' },
  { pos: '12', no: 7, driver: 'Maximilian Günther', team: 'DS Penske', laps: 38, time: '+9.113', grid: 9, points: '' },
  { pos: '13', no: 11, driver: 'Lucas di Grassi', team: 'Lola Yamaha ABT', laps: 38, time: '+10.370', grid: 16, points: '' },
  { pos: '14', no: 14, driver: 'Joel Eriksson', team: 'Envision-Jaguar', laps: 38, time: '+10.614', grid: 15, points: '' },
  { pos: '15', no: 28, driver: 'Felipe Drugovich', team: 'Andretti-Porsche', laps: 38, time: '+13.200', grid: 17, points: '' },
  { pos: '16', no: 22, driver: 'Zane Maloney', team: 'Lola Yamaha ABT', laps: 38, time: '+27.458', grid: 14, points: '' },
  { pos: '17', no: 16, driver: 'Sébastien Buemi', team: 'Envision-Jaguar', laps: 38, time: '+1:00.202', grid: 1, points: '' },
  { pos: 'DNF', no: 33, driver: 'Dan Ticktum', team: 'Cupra Kiro-Porsche', laps: 25, time: 'Retired', grid: 6, points: '' },
  { pos: 'DNF', no: 13, driver: 'António Félix da Costa', team: 'Jaguar Racing', laps: 25, time: 'Retired', grid: 10, points: '' },
  { pos: 'DNF', no: 21, driver: 'Nyck de Vries', team: 'Mahindra Racing', laps: 16, time: 'Retired', grid: 19, points: '' },
]);

// Doubleheader article — Jeddah has TWO classification tables. Real article
// structure: Race one + Race two siblings, each with its own wikitable.
const JEDDAH_CLASSIFICATION_RACE1 = classificationTable(
  // Race 1 winner: Wehrlein. Simplified 12-row table — covers the "1 round
  // → 1 classification" path. Real articles have ~20 rows; >=10 row floor
  // in findClassificationTables() keeps the test honest.
  [
    { pos: '1', no: 94, driver: 'Pascal Wehrlein', team: 'Porsche Formula E Team', laps: 35, time: '50:00.000', grid: 1, points: '25' },
    { pos: '2', no: 27, driver: 'Jake Dennis', team: 'Andretti-Porsche', laps: 35, time: '+0.512', grid: 5, points: '18' },
    { pos: '3', no: 9, driver: 'Mitch Evans', team: 'Jaguar Racing', laps: 35, time: '+1.020', grid: 3, points: '15' },
    { pos: '4', no: 13, driver: 'António Félix da Costa', team: 'Jaguar Racing', laps: 35, time: '+1.500', grid: 6, points: '12' },
    { pos: '5', no: 1, driver: 'Oliver Rowland', team: 'Nissan', laps: 35, time: '+2.100', grid: 4, points: '10' },
    { pos: '6', no: 37, driver: 'Nick Cassidy', team: 'DS Penske', laps: 35, time: '+2.800', grid: 7, points: '8' },
    { pos: '7', no: 21, driver: 'Nyck de Vries', team: 'Mahindra Racing', laps: 35, time: '+3.200', grid: 8, points: '6' },
    { pos: '8', no: 7, driver: 'Maximilian Günther', team: 'DS Penske', laps: 35, time: '+3.800', grid: 9, points: '4' },
    { pos: '9', no: 25, driver: 'Jean-Éric Vergne', team: 'DS Penske', laps: 35, time: '+4.100', grid: 10, points: '2' },
    { pos: '10', no: 48, driver: 'Edoardo Mortara', team: 'Mahindra Racing', laps: 35, time: '+4.500', grid: 11, points: '1' },
    { pos: '11', no: 51, driver: 'Nico Müller', team: 'Porsche Formula E Team', laps: 35, time: '+5.000', grid: 2, points: '' },
    { pos: 'DNF', no: 33, driver: 'Dan Ticktum', team: 'Cupra Kiro-Porsche', laps: 20, time: 'Mechanical', grid: 12, points: '' },
  ],
);
const JEDDAH_CLASSIFICATION_RACE2 = classificationTable([
  { pos: '1', no: 13, driver: 'António Félix da Costa', team: 'Jaguar Racing', laps: 35, time: '49:50.000', grid: 1, points: '25' },
  { pos: '2', no: 9, driver: 'Mitch Evans', team: 'Jaguar Racing', laps: 35, time: '+0.250', grid: 2, points: '18' },
  { pos: '3', no: 94, driver: 'Pascal Wehrlein', team: 'Porsche Formula E Team', laps: 35, time: '+0.800', grid: 3, points: '15' },
  { pos: '4', no: 27, driver: 'Jake Dennis', team: 'Andretti-Porsche', laps: 35, time: '+1.400', grid: 4, points: '12' },
  { pos: '5', no: 51, driver: 'Nico Müller', team: 'Porsche Formula E Team', laps: 35, time: '+2.000', grid: 5, points: '10' },
  { pos: '6', no: 1, driver: 'Oliver Rowland', team: 'Nissan', laps: 35, time: '+2.600', grid: 6, points: '8' },
  { pos: '7', no: 7, driver: 'Maximilian Günther', team: 'DS Penske', laps: 35, time: '+3.200', grid: 7, points: '6' },
  { pos: '8', no: 77, driver: 'Taylor Barnard', team: 'DS Penske', laps: 35, time: '+3.800', grid: 8, points: '4' },
  { pos: '9', no: 14, driver: 'Joel Eriksson', team: 'Envision-Jaguar', laps: 35, time: '+4.400', grid: 9, points: '2' },
  { pos: '10', no: 21, driver: 'Nyck de Vries', team: 'Mahindra Racing', laps: 35, time: '+5.000', grid: 10, points: '1' },
  { pos: '11', no: 16, driver: 'Sébastien Buemi', team: 'Envision-Jaguar', laps: 35, time: '+5.500', grid: 11, points: '' },
  { pos: 'DNF', no: 23, driver: 'Norman Nato', team: 'Nissan', laps: 15, time: 'Mechanical', grid: 12, points: '' },
]);

const SAO_PAULO_HTML = eventArticleHtml([SAO_PAULO_CLASSIFICATION]);
const MEXICO_CITY_HTML = eventArticleHtml([MEXICO_CITY_CLASSIFICATION]);
const JEDDAH_HTML = eventArticleHtml([JEDDAH_CLASSIFICATION_RACE1, JEDDAH_CLASSIFICATION_RACE2]);

// All other rounds: serve a placeholder article that has no classification
// table. The parser should fall back to winners-only for those rounds.
const PLACEHOLDER_ARTICLE_HTML = '<!DOCTYPE html><html><body><p>Stub article</p></body></html>';

const SPA_SHELL_HTML = '<!DOCTYPE html><html><body><div id="root"></div><p>Loading…</p></body></html>';

// Minimal HTML with just 2 race rows in the season table — must trigger the
// MIN_ROUNDS=3 fail-closed floor.
const TWO_ROUND_HTML = `<!DOCTYPE html>
<html><body>
${seasonCalendarTable([{ round: 1, date: '6 December 2025' }, { round: 2, date: '10 January 2026' }])}
${seasonRaceTable([
  seasonRaceRow({
    round: 1, ePrix: 'São Paulo', ePrixHref: '/wiki/S%C3%A3o_Paulo_ePrix',
    winningDriver: 'Jake Dennis', winningTeam: 'Andretti Formula E',
    reportHref: '/wiki/2025_S%C3%A3o_Paulo_ePrix',
  }),
  seasonRaceRow({
    round: 2, ePrix: 'Mexico City', ePrixHref: '/wiki/Mexico_City_ePrix',
    winningDriver: 'Nick Cassidy', winningTeam: 'Citroën Racing',
    reportHref: '/wiki/2026_Mexico_City_ePrix',
  }),
].join(''))}
</body></html>`;

interface MockEntry {
  match: (url: string) => boolean;
  status: number;
  body: string;
}

function mockFetchSequence(entries: MockEntry[]) {
  globalThis.fetch = vi.fn().mockImplementation((url: RequestInfo | URL) => {
    const u = typeof url === 'string' ? url : url.toString();
    const entry = entries.find(e => e.match(u));
    if (!entry) {
      return Promise.resolve({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      });
    }
    return Promise.resolve({
      ok: entry.status >= 200 && entry.status < 300,
      status: entry.status,
      text: async () => entry.body,
    });
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

describe('fetchFormulaESeasonResults — per-event subpage scrape', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses 10 completed rounds (including 3 doubleheaders) from season + per-event articles', async () => {
    mockFetchSequence([
      { match: u => u.includes('Formula_E_World_Championship'), status: 200, body: REAL_SEASON_HTML },
      { match: u => u.includes('2025_S%C3%A3o_Paulo_ePrix') || u.includes('2025_São_Paulo_ePrix'), status: 200, body: SAO_PAULO_HTML },
      { match: u => u.includes('2026_Mexico_City_ePrix'), status: 200, body: MEXICO_CITY_HTML },
      { match: u => u.includes('2026_Jeddah_ePrix'), status: 200, body: JEDDAH_HTML },
      // All others (Miami, Madrid, Berlin, Monaco) — stub article triggers winners-only fallback.
      { match: () => true, status: 200, body: PLACEHOLDER_ARTICLE_HTML },
    ]);
    const races = await fetchFormulaESeasonResults();
    expect(races).toHaveLength(10);
    expect(races.map(r => r.round)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    // Round 1 (São Paulo) — full classification, 20 entries (13 finishers + 7 DNFs).
    const round1 = races.find(r => r.round === 1)!;
    expect(round1.results.length).toBe(20);
    expect(round1.results[0].position).toBe(1);
    expect(round1.results[0].driverName).toBe('Jake Dennis');
    expect(round1.results[0].team).toBe('Andretti-Porsche');
    expect(round1.results[0].points).toBe(25);
    expect(round1.results[0].time).toBe('59:23.013');

    // Round 4 + 5 (Jeddah doubleheader) — both rounds get full classification
    // from the same shared URL. Race 1 winner Wehrlein, Race 2 winner Felix
    // da Costa.
    const round4 = races.find(r => r.round === 4)!;
    expect(round4.results.length).toBe(12);
    expect(round4.results[0].driverName).toBe('Pascal Wehrlein');
    expect(round4.results[0].points).toBe(25);

    const round5 = races.find(r => r.round === 5)!;
    expect(round5.results.length).toBe(12);
    expect(round5.results[0].driverName).toBe('António Félix da Costa');
    expect(round5.results[0].points).toBe(25);

    // Rounds 3/6/7/8/9/10 (placeholder per-event stub) — fall back to
    // winners-only RaceResultEntry (1 row at position 1 with 25 pts).
    const round3 = races.find(r => r.round === 3)!;
    expect(round3.results.length).toBe(1);
    expect(round3.results[0].position).toBe(1);
    expect(round3.results[0].status).toBe('Race winner');
    expect(round3.results[0].driverName).toBe('Mitch Evans');
    expect(round3.results[0].points).toBe(25);
  });

  it('applies Citroën Racing → DS Penske team-name alias', async () => {
    mockFetchSequence([
      { match: u => u.includes('Formula_E_World_Championship'), status: 200, body: REAL_SEASON_HTML },
      { match: u => u.includes('2026_Mexico_City_ePrix'), status: 200, body: MEXICO_CITY_HTML },
      { match: () => true, status: 200, body: PLACEHOLDER_ARTICLE_HTML },
    ]);
    const races = await fetchFormulaESeasonResults();
    const mexico = races.find(r => r.round === 2)!;
    // Cassidy listed as "Citroën Racing" on Wikipedia → normalised to "DS Penske".
    const cassidy = mexico.results.find(r => r.driverName === 'Nick Cassidy')!;
    expect(cassidy.team).toBe('DS Penske');
    // Vergne (also "Citroën Racing" on Wikipedia) → "DS Penske".
    const vergne = mexico.results.find(r => r.driverName === 'Jean-Éric Vergne')!;
    expect(vergne.team).toBe('DS Penske');
    // Season-page winners-only row team-name also normalised — round 2 entry
    // should carry DS Penske even on the winners-only fallback path.
    // (Per-event succeeded here so we use the full classification — but we
    // also assert the season-row → winners-only path applies the alias.)
  });

  it('normalises Citroën Racing → DS Penske on the winners-only fallback path', async () => {
    mockFetchSequence([
      { match: u => u.includes('Formula_E_World_Championship'), status: 200, body: REAL_SEASON_HTML },
      // All per-event fetches return a stub article — every round falls
      // through to the winners-only path.
      { match: () => true, status: 200, body: PLACEHOLDER_ARTICLE_HTML },
    ]);
    const races = await fetchFormulaESeasonResults();
    const mexico = races.find(r => r.round === 2)!;
    expect(mexico.results.length).toBe(1);
    expect(mexico.results[0].driverName).toBe('Nick Cassidy');
    expect(mexico.results[0].team).toBe('DS Penske');
  });

  it('classification entries carry position / time / status / points for finishers and DNFs', async () => {
    mockFetchSequence([
      { match: u => u.includes('Formula_E_World_Championship'), status: 200, body: REAL_SEASON_HTML },
      { match: u => u.includes('2025_S%C3%A3o_Paulo_ePrix') || u.includes('2025_São_Paulo_ePrix'), status: 200, body: SAO_PAULO_HTML },
      { match: () => true, status: 200, body: PLACEHOLDER_ARTICLE_HTML },
    ]);
    const races = await fetchFormulaESeasonResults();
    const sp = races.find(r => r.round === 1)!;
    // Finisher in P2 — time set, status='Finished'.
    const rowland = sp.results.find(r => r.driverName === 'Oliver Rowland')!;
    expect(rowland.position).toBe(2);
    expect(rowland.status).toBe('Finished');
    expect(rowland.time).toBe('+1:349');
    expect(rowland.points).toBe(18);
    // DNF in P14+ — status carries Wikipedia's retirement reason; time undefined.
    const evans = sp.results.find(r => r.driverName === 'Mitch Evans')!;
    expect(evans.position).toBe(100);
    expect(evans.status).toBe('Spun out');
    expect(evans.time).toBeUndefined();
    expect(evans.points).toBe(0);
  });

  it('falls back to winners-only when a single per-event article fails', async () => {
    mockFetchSequence([
      { match: u => u.includes('Formula_E_World_Championship'), status: 200, body: REAL_SEASON_HTML },
      { match: u => u.includes('2025_S%C3%A3o_Paulo_ePrix') || u.includes('2025_São_Paulo_ePrix'), status: 500, body: 'Internal' },
      { match: () => true, status: 200, body: PLACEHOLDER_ARTICLE_HTML },
    ]);
    const races = await fetchFormulaESeasonResults();
    const sp = races.find(r => r.round === 1)!;
    expect(sp.results.length).toBe(1);
    expect(sp.results[0].driverName).toBe('Jake Dennis');
    expect(sp.results[0].position).toBe(1);
    expect(sp.results[0].status).toBe('Race winner');
    expect(sp.results[0].points).toBe(25);
  });

  it('falls back to winners-only for both rounds of a doubleheader when its shared article fails', async () => {
    mockFetchSequence([
      { match: u => u.includes('Formula_E_World_Championship'), status: 200, body: REAL_SEASON_HTML },
      { match: u => u.includes('2026_Jeddah_ePrix'), status: 500, body: 'Internal' },
      { match: () => true, status: 200, body: PLACEHOLDER_ARTICLE_HTML },
    ]);
    const races = await fetchFormulaESeasonResults();
    const round4 = races.find(r => r.round === 4)!;
    const round5 = races.find(r => r.round === 5)!;
    expect(round4.results.length).toBe(1);
    expect(round4.results[0].driverName).toBe('Pascal Wehrlein');
    expect(round5.results.length).toBe(1);
    expect(round5.results[0].driverName).toBe('António Félix da Costa');
  });

  it('returns an empty array when fewer than 3 rounds parse cleanly (sanity floor)', async () => {
    mockFetchSequence([
      { match: u => u.includes('Formula_E_World_Championship'), status: 200, body: TWO_ROUND_HTML },
      { match: () => true, status: 200, body: PLACEHOLDER_ARTICLE_HTML },
    ]);
    const races = await fetchFormulaESeasonResults();
    expect(races).toEqual([]);
  });

  it('returns an empty array when the season page is an SPA shell with no race table', async () => {
    mockFetchSequence([
      { match: () => true, status: 200, body: SPA_SHELL_HTML },
    ]);
    const races = await fetchFormulaESeasonResults();
    expect(races).toEqual([]);
  });

  it('returns an empty array when the season-page fetch 500s', async () => {
    mockFetch500();
    const races = await fetchFormulaESeasonResults();
    expect(races).toEqual([]);
  });

  it('returns an empty array when the season-page fetch errors', async () => {
    mockFetchReject();
    const races = await fetchFormulaESeasonResults();
    expect(races).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// motorsportweek.com fallback parser.
// ---------------------------------------------------------------------------

function mwRow(opts: {
  position: number | string;
  driver: string;
  team: string;
  gap?: string;
}): string {
  return (
    `<tr>` +
    `<td>${opts.position}</td>` +
    `<td>${opts.driver}</td>` +
    `<td>${opts.team}</td>` +
    `<td>${opts.gap ?? ''}</td>` +
    `</tr>`
  );
}

function mwClassificationHtml(rows: string[]): string {
  return (
    `<!doctype html><html><body>` +
    `<figure class="wp-block-table">` +
    `<table class="has-fixed-layout">` +
    `<thead><tr><th>Position</th><th>Drivers</th><th>Team</th><th>Gap</th></tr></thead>` +
    `<tbody>` + rows.join('') + `</tbody>` +
    `</table>` +
    `</figure>` +
    `</body></html>`
  );
}

describe('parseMotorsportweekClassification', () => {
  it('parses the WP wp-block-table into typed RaceResultEntry rows', () => {
    // Mirrors the R7 Berlin sample from the Phase 1 brief — 20 rows total.
    const rows = [
      mwRow({ position: 1, driver: 'Nico Mueller', team: 'Porsche', gap: '' }),
      mwRow({ position: 2, driver: 'Nick Cassidy', team: 'Citroen', gap: '4.798' }),
      mwRow({ position: 3, driver: 'Oliver Rowland', team: 'Nissan', gap: '5.252' }),
      mwRow({ position: 4, driver: 'Edoardo Mortara', team: 'Mahindra', gap: '5.898' }),
      mwRow({ position: 5, driver: 'Jake Dennis', team: 'Andretti', gap: '8.117' }),
      mwRow({ position: 6, driver: 'Mitch Evans', team: 'Jaguar', gap: '8.917' }),
      mwRow({ position: 7, driver: 'Pepe Marti', team: 'Kiro', gap: '10.142' }),
      mwRow({ position: 8, driver: 'Taylor Barnard', team: 'DS Penske', gap: '10.529' }),
      mwRow({ position: 9, driver: 'Nyck de Vries', team: 'Mahindra', gap: '11.141' }),
      mwRow({ position: 10, driver: 'Antonio Felix da Costa', team: 'Jaguar', gap: '13.051' }),
      mwRow({ position: 11, driver: 'Maximilian Guenther', team: 'DS Penske', gap: '13.836' }),
      mwRow({ position: 20, driver: 'Dan Ticktum', team: 'Kiro', gap: '1 Lap' }),
    ];
    const entries = parseMotorsportweekClassification(mwClassificationHtml(rows));
    expect(entries.length).toBe(12);

    // P1 = Mueller / Porsche / 25 pts. Note Porsche normalised to "Porsche Team".
    expect(entries[0]).toMatchObject({
      position: 1,
      driverName: 'Nico Mueller',
      team: 'Porsche Team',
      status: 'Finished',
      points: 25,
    });
    expect(entries[0].time).toBeUndefined(); // empty Gap → undefined

    // P2 Cassidy on "Citroen" — must normalise to "DS Penske" (Stellantis FE entry).
    expect(entries[1].team).toBe('DS Penske');
    expect(entries[1].points).toBe(18);

    // P7 Marti on "Kiro" → "Cupra Kiro" alias.
    expect(entries[6].team).toBe('Cupra Kiro');
    expect(entries[6].points).toBe(6);

    // P11 (Guenther) is outside the points-paying band; should score 0.
    expect(entries[10].points).toBe(0);

    // P20 (Ticktum) lapped runner — preserves the "1 Lap" string in time.
    expect(entries[11].time).toBe('1 Lap');
    expect(entries[11].points).toBe(0);
  });

  it('returns an empty array when no wp-block-table is present', () => {
    const html = `<!doctype html><html><body><p>No results yet.</p></body></html>`;
    expect(parseMotorsportweekClassification(html)).toEqual([]);
  });

  it('returns an empty array when the table has fewer than 5 rows (sanity floor)', () => {
    const html = mwClassificationHtml([
      mwRow({ position: 1, driver: 'A', team: 'Porsche' }),
      mwRow({ position: 2, driver: 'B', team: 'Jaguar' }),
    ]);
    expect(parseMotorsportweekClassification(html)).toEqual([]);
  });

  it('skips rows whose position cell does not parse to a number', () => {
    const rows = [
      mwRow({ position: 1, driver: 'A', team: 'Porsche' }),
      mwRow({ position: 2, driver: 'B', team: 'Jaguar' }),
      mwRow({ position: 3, driver: 'C', team: 'Nissan' }),
      mwRow({ position: 4, driver: 'D', team: 'Mahindra' }),
      mwRow({ position: 5, driver: 'E', team: 'Andretti' }),
      mwRow({ position: 'DNF', driver: 'X', team: 'Porsche' }),
      mwRow({ position: '', driver: 'Y', team: 'Jaguar' }),
    ];
    const entries = parseMotorsportweekClassification(mwClassificationHtml(rows));
    // 5 numeric rows survive; DNF and empty position are skipped.
    expect(entries.length).toBe(5);
    expect(entries.every(e => e.status === 'Finished')).toBe(true);
  });
});
