import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ResultRound, SeriesData } from './render';
import {
  categorySlug,
  championColour,
  firstSentence,
  ordinal,
  pointsLeft,
  prose,
  recordLists,
  ROUND2_SERIES,
  seriesChampions,
  seriesFamily,
  seriesList,
  seriesOverview,
  seriesResults,
  seriesStandings,
  stillIn,
  tabs as tabStrip,
  teammates,
  teamTallies,
  titleCounts,
} from './series';

const race = (round: number, name: string, date: string, rows: string[][]): ResultRound => ({
  round,
  name,
  date,
  sessions: [{ label: 'Race', tables: [{ title: 'Race', columns: ['Pos', 'Driver', 'Team', 'Time', 'Pts'], rows }] }],
});

const drivers = [
  ['1', 'Max Verstappen', 'Red Bull Racing', '40'],
  ['2', 'Charles Leclerc', 'Ferrari', '30'],
  ['3', 'Kimi <b>Antonelli</b>', 'Mercedes', '20'],
  ...Array.from({ length: 9 }, (_, i) => [String(i + 4), `Driver ${i + 4}`, 'Haas F1 Team', String(9 - i)]),
];

const f1: SeriesData = {
  slug: 'f1',
  name: 'Formula 1',
  season: 2026,
  standings: [
    { title: 'Drivers', columns: ['Pos', 'Driver', 'Team', 'Pts'], rows: drivers },
    { title: 'Constructors', columns: ['Pos', 'Constructor', 'Pts'], rows: [['1', 'Red Bull Racing', '40'], ['2', 'Ferrari', '30'], ['3', 'Haas F1 Team', '9']] },
  ],
  // The feed names the race differently from rounds.json, as F1's round 16 does.
  results: [race(1, 'Singapore Grand Prix in Asia', '2026-09-27', [['1', 'Max Verstappen', 'Red Bull Racing', '1:42:00.785', '25'], ['2', 'Charles Leclerc', 'Ferrari', '+7.335', '18']])],
  calendar: [
    { start: '2026-10-23T17:30:00Z', end: '2026-10-23T18:30:00Z', dateOnly: false, event: 'United States Grand Prix', session: 'Practice 1', round: 2 },
    { start: '2026-10-25T20:00:00Z', end: '2026-10-25T22:00:00Z', dateOnly: false, event: 'United States Grand Prix', session: 'Race', round: 2 },
    { start: '2026-10-24T00:00:00Z', end: '2026-10-24T00:00:00Z', dateOnly: true, event: 'United States Grand Prix', session: 'Fan forum', round: 2 },
  ],
  rounds: [
    { round: 1, name: 'Singapore Grand Prix', startDate: '2026-09-25', endDate: '2026-09-27', venue: 'Marina Bay Street Circuit', place: 'Singapore', outline: 'marina-bay' },
    { round: 2, name: 'United States Grand Prix', startDate: '2026-10-23', endDate: '2026-10-25', venue: 'Circuit of The Americas', place: 'United States', outline: 'cota' },
    { round: 3, name: 'Mexico City Grand Prix', startDate: '2026-10-30', endDate: '2026-11-01', venue: null, outline: 'x" onmouseover="y' },
  ],
  teams: [
    { name: 'Red Bull Racing', colour: '#1E3A8A', drivers: [{ name: 'Max Verstappen', code: 'VER' }] },
    { name: 'Ferrari', colour: '#DC0000', drivers: [{ name: 'Charles Leclerc', code: 'LEC' }] },
    { name: 'Haas', colour: 'red;background:url(x)', drivers: [] },
  ],
  cancelled: [{ round: 5, name: 'Saudi Arabian Grand Prix', place: 'Saudi Arabia' }],
  about: 'Eleven teams & <two> cars each, in **2026**.\r\n\r\n## Points\r\n\r\nTwenty-five\r\nfor a win.',
};

const page = seriesOverview(f1);
const body = page.body;

describe('seriesOverview', () => {
  it('is the series address on the Wide template', () => {
    expect(page).toMatchObject({ path: '/series/f1/', title: 'Formula 1', template: 'page-wide' });
    expect(seriesFamily(f1).map(p => p.path)).toEqual(['/series/f1/', '/series/f1/results/', '/series/f1/standings/', '/series/f1/champions/']);
    expect(ROUND2_SERIES.has('f1')).toBe(true);
  });

  it('carries the five tabs at their own addresses, the Calendar showing only this series, a page not yet built greyed', () => {
    const tabs = [...body.matchAll(/<a href="([^"]+)"( aria-current="page")?>(Overview|Calendar|Standings|Results|Champions)<\/a>|<span class="is-off">(Standings|Champions)<\/span>/g)].map(m =>
      m[4] ? [m[4], null, false] : [m[3], m[1], Boolean(m[2])],
    );
    expect(tabs).toEqual([
      ['Overview', '/series/f1/', true],
      ['Calendar', '/calendar/#f1', false],
      ['Standings', '/series/f1/standings/', false],
      ['Results', '/series/f1/results/', false],
      ['Champions', '/series/f1/champions/', false],
    ]);
    expect(tabStrip({ ...f1, slug: 'f2', name: 'Formula 2' }, 'overview')).toContain('<span class="is-off">Standings</span><span class="is-off">Results</span><span class="is-off">Champions</span>');
  });

  it('draws the band: the season in a line, a bar of the rounds, the round to come named by the script', () => {
    expect(body).toContain('<h1>Formula 1</h1><p>2026 season · 3 rounds · 1 run · <span class="pd-wk" data-from="2026-10-23" data-to="2026-10-25" data-on="round 2 this weekend">next: round 2</span></p>');
    expect(body).toContain('<span class="pd-sr-bar" aria-hidden="true"><i class="is-done"></i><i class="is-now"></i><i></i></span>');
    expect(body).toContain('<button type="button" class="pd-sr-follow" data-pd-follow="f1" hidden>Follow</button><a class="pd-sr-emails" href="/subscribe/">Session emails</a>');
  });

  it('gives the round to come its timed sessions for the script, and the race in UTC', () => {
    expect(body).toContain('data-pd-ses="Practice%201|2026-10-23T17:30:00Z|2026-10-23T18:30:00Z;Race|2026-10-25T20:00:00Z|2026-10-25T22:00:00Z"');
    // A name holding the list's separators reaches the script whole (other series' feeds have them).
    const odd = seriesOverview({ ...f1, calendar: [{ ...f1.calendar![0], session: 'F3 | Sakhir; Race 1' }] }).body;
    expect(odd).toContain('data-pd-ses="F3%20%7C%20Sakhir%3B%20Race%201|2026-10-23T17:30:00Z|2026-10-23T18:30:00Z"');
    expect(body).toContain('<span class="pd-pill pd-pill-live" hidden>● Live</span><span>Round 2 · <span class="pd-wk" data-from="2026-10-23" data-to="2026-10-25" data-on="this weekend">next</span></span>');
    expect(body).toContain('<h2><a href="/series/f1/2026/round-2/">United States Grand Prix</a></h2><p class="pd-mut">Circuit of The Americas · 23–25 Oct</p>');
    expect(body).toContain('<span class="pd-sr-race">Race <span class="pd-t" data-utc="2026-10-25T20:00:00Z" data-f="wt">Sun 20:00 UTC</span></span>');
  });

  it("names the last race as rounds.json does, opening its weekend page, with its winner's team colour and margin", () => {
    expect(body).toContain('<p class="pd-sr-lab">Last race · Round 1</p><h2><a href="/series/f1/2026/round-1/">Singapore Grand Prix</a></h2><p class="pd-mut">Marina Bay Street Circuit · 27 Sep</p>');
    expect(body).toContain('<span class="pd-sr-win" style="--t:#1E3A8A"><b>Max Verstappen</b></span> <span class="pd-mut">Red Bull Racing · won by 7.335 s</span>');
    expect(body).toContain('<i class="pd-ol pd-ol-marina-bay pd-ol-big" aria-hidden="true"></i>');
  });

  it('tiles the season, each round opening its weekend page; without them, a finished round its Results line and a round to come its month on the Calendar', () => {
    expect(body).toContain('<a class="pd-sr-tile" href="/series/f1/2026/round-1/"><small>R1</small><b>Singapore</b><i class="pd-ol pd-ol-marina-bay" aria-hidden="true"></i><span class="pd-sr-win" style="--t:#1E3A8A"><b>VER</b>27 Sep</span></a>');
    expect(body).toContain('<a class="pd-sr-tile is-now" href="/series/f1/2026/round-2/"><small>R2</small><b>United States</b>');
    expect(body).toContain('data-on="This weekend · 23–25 Oct">Next · 23–25 Oct</span>');
    expect(body).toContain('<a class="pd-sr-tile is-ahead" href="/series/f1/2026/round-3/"><small>R3</small><b>Mexico City Grand Prix</b><span class="pd-sr-when">30 Oct–1 Nov</span></a>');
    expect(body).toContain('<span class="pd-sr-tile is-off"><small>—</small><b><s>Saudi Arabia</s></b><span class="pd-sr-when">Cancelled · was round 5</span></span>');
    // A weekend page needs the season in its address.
    const unseasoned = seriesOverview({ ...f1, season: undefined }).body;
    expect(unseasoned).toContain('<a class="pd-sr-tile" href="/series/f1/results/#r1"><small>R1</small>');
    expect(unseasoned).toContain('<a class="pd-sr-tile is-now" href="/calendar/2026-10/#f1"><small>R2</small>');
    expect(unseasoned).toContain('<a class="pd-sr-tile is-ahead" href="/calendar/2026-10/#f1"><small>R3</small>');
    expect(unseasoned).not.toContain('round-1/');
  });

  it('shows the top ten drivers with bars against the leader and race wins, and every constructor', () => {
    // The count opens the Standings page (O16).
    expect(body).toContain('<h2>Drivers</h2><p><a href="/series/f1/standings/">All 12 →</a></p>');
    expect(body.match(/<li><span class="pd-p">/g)).toHaveLength(10 + 3);
    expect(body).toContain('<li><span class="pd-p">2</span><span class="pd-d"><b>Charles Leclerc</b> <small>Ferrari</small><i class="pd-sr-pts"><i style="width:75.0%;--t:#DC0000"></i></i></span><span class="pd-pt">30</span><span class="pd-w">0 wins</span></li>');
    expect(body).toContain('<b>Red Bull Racing</b><i class="pd-sr-pts"><i style="width:100.0%;--t:#1E3A8A"></i></i></span><span class="pd-pt">40</span><span class="pd-w">1</span>');
  });

  it('keeps feed and content text as text, a bad colour out of the style and a bad outline key out of the class', () => {
    expect(body).toContain('<b>Kimi &lt;b&gt;Antonelli&lt;/b&gt;</b>');
    expect(body).not.toContain('<b>Antonelli</b>');
    expect(body).toContain('<b>Haas</b><i class="pd-sr-pts"><i style="width:22.5%;--t:#9aa3b2"></i></i>');
    expect(body).not.toContain('onmouseover');
    expect(body).not.toContain('url(x)');
  });

  it("asks the theme for the series' newest posts and sets About from overview.md", () => {
    expect(body).toContain('<!-- wp:shortcode -->\n[pd_series_posts category="formula-1" title="Formula 1" series="f1"]\n<!-- /wp:shortcode -->');
    expect(body).toContain('<h2>About Formula 1</h2></div><div class="pd-sr-prose"><p>Eleven teams &amp; &lt;two&gt; cars each, in <b>2026</b>.</p><h3>Points</h3><p>Twenty-five for a win.</p></div>');
  });

  it('writes the same page whatever the hour', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-23T03:00:00Z'));
      const early = seriesOverview(f1).body;
      vi.setSystemTime(new Date('2026-10-25T21:30:00Z'));
      expect(seriesOverview(f1).body).toBe(early);
      expect(early).toBe(body);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never counts a sprint as the round's race: a sprint weekend's Saturday has no winner yet", () => {
    const sprint = { label: 'Sprint', tables: [{ title: 'Sprint', columns: ['Pos', 'Driver', 'Team', 'Time', 'Pts'], rows: [['1', 'Charles Leclerc', 'Ferrari', '30:01.000', '8']] }] };
    const saturday = seriesOverview({ ...f1, results: [...f1.results!, { round: 2, name: 'United States Grand Prix', date: '2026-10-24', sessions: [sprint] }] }).body;
    expect(saturday).toContain('<p>2026 season · 3 rounds · 1 run · ');
    expect(saturday).toContain('<p class="pd-sr-lab">Last race · Round 1</p>');
    expect(saturday).toContain('<a class="pd-sr-tile is-now" href="/series/f1/2026/round-2/"><small>R2</small>');
    expect(saturday).toContain('<small>Ferrari</small><i class="pd-sr-pts"><i style="width:75.0%;--t:#DC0000"></i></i></span><span class="pd-pt">30</span><span class="pd-w">0 wins</span>');
  });

  it('leaves out what the data does not hold', () => {
    const bare: SeriesData = { slug: 'f1', name: 'Formula 1', standings: null, results: null, calendar: null };
    const b = seriesOverview(bare).body;
    expect(b).toContain('<p>0 rounds · 0 run</p>');
    expect(b).not.toContain('pd-sr-cards');
    expect(b).not.toContain('pd-sr-grid');
    expect(b).not.toContain('About Formula 1');
  });
});

describe('seriesResults', () => {
  const rows = (n: number, first: string[][] = []) => [...first, ...Array.from({ length: n - first.length }, (_, i) => [String(first.length + i + 1), `Driver ${first.length + i + 1}`, 'Ferrari', '+1 lap', '0'])];
  const ses = (label: string, columns: string[], body: string[][]) => ({ label, tables: [{ title: label, columns, rows: body }] });
  const at = (round: number, session: string, start: string) => ({ start, end: new Date(Date.parse(start) + 3_600_000).toISOString(), dateOnly: false, event: 'E', session, round });
  const fr: SeriesData = {
    ...f1,
    results: [
      {
        round: 1,
        name: 'Singapore Grand Prix in Asia',
        date: '2026-09-27',
        sessions: [
          ses('Sprint', ['Pos', 'Driver', 'Team', 'Time', 'Pts'], rows(8, [['1', 'Max Verstappen', 'Red Bull Racing', '39:48.162', '8']])),
          ses('Race', ['Pos', 'Driver', 'Team', 'Time', 'Pts'], rows(12, [['1', 'Max Verstappen', 'Red Bull Racing', '1:42:00.785', '25'], ['2', 'Kimi <b>Antonelli</b>', 'Haas F1 Team', '+7.335', '18']])),
        ],
        others: [
          ses('Practice 1', ['Pos', 'Driver', 'Team', 'Time', 'Gap', 'Laps'], [['1', 'Charles Leclerc', 'Ferrari', '1:31.002', '', '24']]),
          ses('Sprint Qualifying', ['Pos', 'Driver', 'Team', 'SQ1', 'SQ2', 'SQ3'], [['1', 'Max Verstappen', 'Red Bull Racing', '1:31.1', '1:30.9', '1:30.5']]),
          ses('Qualifying', ['Pos', 'Driver', 'Team', 'Q1', 'Q2', 'Q3'], [['1', 'Max Verstappen', 'Red Bull Racing', '1:30.4', '1:30.1', '1:29.8']]),
        ],
      },
      { round: 2, name: 'United States Grand Prix', date: '2026-10-25', sessions: [], others: [ses('Practice 1', ['Pos', 'Driver', 'Team', 'Time', 'Gap', 'Laps'], [['1', 'Max Verstappen', 'Red Bull Racing', '1:34.1', '', '22']])] },
    ],
    calendar: [
      at(1, 'Practice 1', '2026-09-25T09:30:00Z'),
      at(1, 'Sprint Qualifying', '2026-09-25T13:30:00Z'),
      at(1, 'Sprint', '2026-09-26T09:00:00Z'),
      at(1, 'Qualifying', '2026-09-26T13:00:00Z'),
      at(1, 'Race', '2026-09-27T12:00:00Z'),
      at(2, 'Practice 1', '2026-10-23T17:30:00Z'),
      at(2, 'Practice 2', '2026-10-23T21:00:00Z'),
      at(2, 'Practice 3', '2026-10-24T17:30:00Z'),
      at(2, 'Qualifying', '2026-10-24T21:00:00Z'),
      at(2, 'Race', '2026-10-25T20:00:00Z'),
    ],
  };
  const page = seriesResults(fr);
  const b = page.body;
  const fold = (n: number, of = b) => {
    const from = of.indexOf(`<details class="pd-rs-row" id="r${n}"`);
    return of.slice(from, of.indexOf('</div></details>', from) + 16);
  };
  const later = seriesResults({ ...fr, results: [...fr.results!, race(3, 'Mexico City Grand Prix', '2026-11-01', [['1', 'Charles Leclerc', 'Ferrari', '1:40:00.000', '25']])] }).body;
  const opened = (of: string) => [...of.matchAll(/<details class="pd-rs-row" id="(r\d+)" style="--t:#[0-9A-Fa-f]{6}"( open)?>/g)].map(m => [m[1], Boolean(m[2])]);

  it('is the Results address on the Wide template, its tab current', () => {
    expect(page).toMatchObject({ path: '/series/f1/results/', title: 'Formula 1 results', template: 'page-wide' });
    expect(b).toContain('<a href="/series/f1/results/" aria-current="page">Results</a>');
    expect(b).toContain('<div class="pd-sh"><h2>Results</h2><p>2026 · 1 of 3 rounds run · the latest first</p></div>');
  });

  it('rows a round that has raced in its winner’s colour, the latest first and open, each with its id for a link', () => {
    // Round 2 has run its first practice only: it joins the list with its race.
    expect(opened(b)).toEqual([['r1', true]]);
    expect(opened(later)).toEqual([
      ['r3', true],
      ['r1', false],
    ]);
    expect(later).toContain('<details class="pd-rs-row" id="r3" style="--t:#DC0000" open>');
  });

  it("lines a round up as rounds.json names it, with its place and dates, its format, its winner in the team's colour and its weekend page", () => {
    expect(fold(1)).toContain(
      '<summary><span class="pd-rs-n">1</span><span class="pd-rs-name"><b>Singapore Grand Prix</b><small>Singapore · 25–27 Sep · <em>Sprint</em></small></span>' +
        '<span class="pd-rs-win"><i class="pd-tc" style="--t:#1E3A8A"></i><b>Max Verstappen</b><small>Red Bull Racing · won the sprint too</small></span><a class="pd-rs-go" href="/series/f1/2026/round-1/">See weekend →</a></summary>',
    );
    expect(fold(3, later)).toContain('<span class="pd-rs-name"><b>Mexico City Grand Prix</b><small>30 Oct–1 Nov</small></span><span class="pd-rs-win"><i class="pd-tc" style="--t:#DC0000"></i><b>Charles Leclerc</b><small>Ferrari</small></span>');
    // A sprint won by another driver is named beside the race's winner.
    const lost = seriesResults({ ...fr, results: [{ ...fr.results![0], sessions: [ses('Sprint', ['Pos', 'Driver', 'Team', 'Time', 'Pts'], [['1', 'Charles Leclerc', 'Ferrari', '39:48.162', '8']]), fr.results![0].sessions[1]] }] }).body;
    expect(lost).toContain('<small>Red Bull Racing · sprint: Charles Leclerc</small>');
  });

  it("opens a round on its points, a sprint weekend's sprint, race and total for every scorer, the full order on the weekend page", () => {
    expect(fold(1)).toContain(
      '<table class="pd-wk-tbl pd-wk-pts"><thead><tr><th class="d">Driver</th><th class="tm">Team</th><th class="n" title="Sprint">S</th><th class="n" title="Race">R</th><th class="n tot">Total</th></tr></thead>',
    );
    expect(fold(1)).toContain('<tr><td class="d"><i class="pd-tc" style="--t:#1E3A8A"></i><b>VER</b><span>Max Verstappen</span></td><td class="tm">Red Bull Racing</td><td class="n">8</td><td class="n">25</td><td class="n tot">33</td></tr>');
    expect(fold(1).match(/<tr>/g)).toHaveLength(1 + 2);
    expect(fold(1)).toContain("<p class=\"pd-wk-note\">Every driver who scored this weekend (2), by the weekend's total; equal totals by the race result.</p>");
    expect(fold(1)).toContain('<a class="pd-rs-all" href="/series/f1/2026/round-1/">All 12 and every session on the weekend page →</a>');
    // A standard weekend: the race's scorers by their places.
    expect(fold(3, later)).toContain(
      '<thead><tr><th class="p">Pos</th><th class="d">Driver</th><th class="tm">Team</th><th class="n tot">Pts</th></tr></thead><tbody><tr><td class="p">1</td><td class="d"><i class="pd-tc" style="--t:#DC0000"></i><b>LEC</b><span>Charles Leclerc</span></td><td class="tm">Ferrari</td><td class="n tot">25</td></tr></tbody></table><p class="pd-wk-note">The driver who scored.</p>',
    );
    // Every session's times are the weekend pages' to show.
    expect(b).not.toContain('1:42:00.785');
    expect(b).not.toContain('39:48.162');
    expect(b).not.toContain('1:29.8');
    expect(seriesFamily(fr).map(p => p.path)).toEqual(['/series/f1/', '/series/f1/results/', '/series/f1/standings/', '/series/f1/champions/']);
  });

  it('keeps feed text as text and a bad colour out of the style', () => {
    expect(b).toContain('<span>Kimi &lt;b&gt;Antonelli&lt;/b&gt;</span></td><td class="tm">Haas</td><td class="n">–</td><td class="n">18</td><td class="n tot">18</td>');
    expect(b).not.toContain('<b>Antonelli</b>');
    expect(b).toContain('<i class="pd-tc" style="--t:#9aa3b2"></i><b>&lt;B&gt;</b><span>Kimi');
    expect(b).not.toContain('url(x)');
  });

  it('writes the same page whatever the hour, and a line when the season has no results', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-23T18:00:00Z'));
      expect(seriesResults(fr).body).toBe(b);
      vi.setSystemTime(new Date('2026-12-07T09:00:00Z'));
      expect(seriesResults(fr).body).toBe(b);
    } finally {
      vi.useRealTimers();
    }
    expect(seriesResults({ ...fr, results: null }).body).toContain('<p class="pd-mut">No results yet this season.</p>');
  });
});

describe('seriesStandings', () => {
  const R = ['Pos', 'Driver', 'Team', 'Time', 'Pts'];
  const ses = (label: string, rows: string[][]) => ({ label, tables: [{ title: label, columns: R, rows }] });
  const at = (round: number, session: string, start: string) => ({ start, end: new Date(Date.parse(start) + 3_600_000).toISOString(), dateOnly: false, event: 'E', session, round });
  // Round 1 a sprint weekend; in round 2 Lawson drives Hadjar's Red Bull and Tsunoda his Racing Bull; round 3, ahead, is
  // Las Vegas, whose race starts on Saturday night at the track and on Sunday in UTC.
  const sd: SeriesData = {
    slug: 'f1',
    name: 'Formula 1',
    season: 2026,
    standings: [
      {
        title: 'Drivers',
        columns: ['Pos', 'Driver', 'Team', 'Pts'],
        rows: [
          ['1', 'Max Verstappen', 'Red Bull Racing', '51'],
          ['2', 'Charles Leclerc', 'Ferrari', '44'],
          ['3', 'Lewis Hamilton', 'Ferrari', '35'],
          ['4', 'Liam Lawson', 'Racing Bulls', '32'],
          ['5', 'Arvid Lindblad', 'Racing Bulls', '19'],
          ['6', 'Isack Hadjar', 'Red Bull Racing', '18'],
          ['7', 'Yuki Tsunoda', 'Racing Bulls', '10'],
          ['8', 'Kimi <b>Antonelli</b>', 'Mercedes', '0'],
        ],
      },
      { title: 'Constructors', columns: ['Pos', 'Constructor', 'Pts'], rows: [['1', 'Red Bull Racing', '87'], ['2', 'Ferrari', '79'], ['3', 'Racing Bulls', '43'], ['4', 'Mercedes', '0']] },
    ],
    results: [
      {
        round: 1,
        name: 'Chinese GP',
        date: '2026-03-15',
        sessions: [
          ses('Sprint', [['1', 'Max Verstappen', 'Red Bull Racing', '30:00.000', '8'], ['2', 'Charles Leclerc', 'Ferrari', '+1.0', '7'], ['3', 'Isack Hadjar', 'Red Bull Racing', '+2.0', '6'], ['4', 'Lewis Hamilton', 'Ferrari', '+3.0', '5'], ['5', 'Liam Lawson', 'Racing Bulls', '+4.0', '4'], ['6', 'Arvid Lindblad', 'Racing Bulls', '+5.0', '3']]),
          ses('Race', [['1', 'Charles Leclerc', 'Ferrari', '1:30:00.000', '25'], ['2', 'Max Verstappen', 'Red Bull Racing', '+1.0', '18'], ['3', 'Lewis Hamilton', 'Ferrari', '+2.0', '15'], ['4', 'Isack Hadjar', 'Red Bull Racing', '+3.0', '12'], ['5', 'Liam Lawson', 'Racing Bulls', '+4.0', '10'], ['6', 'Arvid Lindblad', 'Racing Bulls', '+5.0', '8']]),
        ],
      },
      {
        round: 2,
        name: 'Japanese GP',
        date: '2026-03-29',
        sessions: [ses('Race', [['1', 'Max Verstappen', 'Red Bull Racing', '1:30:00.000', '25'], ['2', 'Liam Lawson', 'Red Bull Racing', '+1.0', '18'], ['3', 'Lewis Hamilton', 'Ferrari', '+2.0', '15'], ['4', 'Charles Leclerc', 'Ferrari', '+3.0', '12'], ['5', 'Yuki Tsunoda', 'Racing Bulls', '+4.0', '10'], ['6', 'Arvid Lindblad', 'Racing Bulls', '+5.0', '8']])],
      },
    ],
    calendar: [at(1, 'Sprint', '2026-03-14T03:00:00Z'), at(1, 'Race', '2026-03-15T07:00:00Z'), at(2, 'Race', '2026-03-29T05:00:00Z'), at(3, 'Race', '2026-11-22T04:00:00Z')],
    rounds: [
      { round: 1, name: 'Chinese Grand Prix', startDate: '2026-03-13', endDate: '2026-03-15', venue: null, tz: 'Asia/Shanghai' },
      { round: 2, name: 'Japanese Grand Prix', startDate: '2026-03-27', endDate: '2026-03-29', venue: null, tz: 'Asia/Tokyo' },
      { round: 3, name: 'Las Vegas Grand Prix', startDate: '2026-11-19', endDate: '2026-11-21', venue: null, tz: 'America/Los_Angeles' },
    ],
    teams: [
      { name: 'Red Bull Racing', colour: '#1E3A8A', drivers: [{ name: 'Max Verstappen' }, { name: 'Isack Hadjar' }] },
      { name: 'Ferrari', colour: '#DC0000', drivers: [{ name: 'Charles Leclerc' }, { name: 'Lewis Hamilton' }] },
      // The stand-in is listed after the team's two seats, as drivers.json lists Tsunoda for his car number.
      { name: 'Racing Bulls', colour: '#6692FF', drivers: [{ name: 'Liam Lawson' }, { name: 'Arvid Lindblad' }, { name: 'Yuki Tsunoda' }] },
      { name: 'Mercedes', colour: 'red;background:url(x)', drivers: [] },
    ],
    standingsNotes: [
      {
        round: 1,
        decided: '2026-04-02',
        note: 'the stewards <i>reviewed</i> the start',
        drivers: { 'Arvid Lindblad': 2, 'Charles Leclerc': -2 },
        sources: ['https://www.fia.com/x?a=1&b=2', 'javascript:alert(1)', 'http://insecure.example/'],
      },
    ],
  };
  const page = seriesStandings(sd);
  const b = page.body;
  const between = (from: string, to: string, of = b) => of.slice(of.indexOf(from), of.indexOf(to, of.indexOf(from)) + to.length);

  it('is the Standings address on the Wide template, its tab current', () => {
    expect(page).toMatchObject({ path: '/series/f1/standings/', title: 'Formula 1 standings', template: 'page-wide' });
    expect(b).toContain('<a href="/series/f1/standings/" aria-current="page">Standings</a>');
  });

  it('counts the points left on the 2026 scales: a Grand Prix to run, a sprint ahead, a sprint already run', () => {
    expect(pointsLeft(sd)).toEqual({ races: 1, sprints: 0, sprintsRun: 1, driver: 25, team: 43 });
    const sprintAhead: SeriesData = { ...sd, calendar: [...sd.calendar!, at(3, 'Sprint', '2026-11-21T22:00:00Z')] };
    expect(pointsLeft(sprintAhead)).toEqual({ races: 1, sprints: 1, sprintsRun: 1, driver: 33, team: 58 });
    const saturday: SeriesData = { ...sprintAhead, results: [...sd.results!, { round: 3, name: 'Las Vegas GP', date: null, sessions: [ses('Sprint', [['1', 'Charles Leclerc', 'Ferrari', '30:00.000', '8']])] }] };
    expect(pointsLeft(saturday)).toEqual({ races: 1, sprints: 0, sprintsRun: 2, driver: 25, team: 43 });
    expect(pointsLeft({ ...sd, rounds: sd.rounds!.slice(0, 2) })).toEqual({ races: 0, sprints: 0, sprintsRun: 1, driver: 0, team: 0 });
    // A round whose race is stored has run its sprint, though the sprint's result never arrived.
    const noSprint: SeriesData = { ...sd, results: [{ ...sd.results![0], sessions: [sd.results![0].sessions[1]] }, sd.results![1]] };
    expect(pointsLeft(noSprint)).toEqual({ races: 1, sprints: 0, sprintsRun: 1, driver: 25, team: 43 });
  });

  it('writes the page as of what the table counts when the standings lag the results by a session', () => {
    const table = (rows: string[][]): SeriesData => ({ ...sd, standings: [{ title: 'Drivers', columns: ['Pos', 'Driver', 'Team', 'Pts'], rows }, sd.standings![1]] });
    // The table after round 1 (121 points awarded), the results already holding round 2.
    const afterRound1 = seriesStandings(
      table([['1', 'Charles Leclerc', 'Ferrari', '32'], ['2', 'Max Verstappen', 'Red Bull Racing', '26'], ['3', 'Lewis Hamilton', 'Ferrari', '20'], ['4', 'Isack Hadjar', 'Red Bull Racing', '18'], ['5', 'Liam Lawson', 'Racing Bulls', '14'], ['6', 'Arvid Lindblad', 'Racing Bulls', '11']]),
    ).body;
    expect(afterRound1).toContain('<h2 class="pd-st-h">Standings after round 1</h2><p>Chinese Grand Prix, 15 March<span class="pd-st-next"> · next update after Sunday\'s Japanese Grand Prix</span></p>');
    expect(afterRound1).toContain('<p>50 points left: two Grands Prix at 25, the sprints all run.');
    // The band counts every stored result, as on the series' other pages.
    expect(afterRound1).toContain('<p>2026 season · 3 rounds · 2 run · ');
    // The table after round 1's sprint alone (33 points).
    const afterSprint = seriesStandings(
      table([['1', 'Max Verstappen', 'Red Bull Racing', '8'], ['2', 'Charles Leclerc', 'Ferrari', '7'], ['3', 'Isack Hadjar', 'Red Bull Racing', '6'], ['4', 'Lewis Hamilton', 'Ferrari', '5'], ['5', 'Liam Lawson', 'Racing Bulls', '4'], ['6', 'Arvid Lindblad', 'Racing Bulls', '3']]),
    ).body;
    expect(afterSprint).toContain('<h2 class="pd-st-h">Standings after the round 1 sprint</h2><p>Chinese Grand Prix sprint, 14 March<span class="pd-st-next"> · next update after Sunday\'s Chinese Grand Prix</span></p>');
    expect(afterSprint).toContain('<p>75 points left: three Grands Prix at 25, the sprints all run.');
    // A table matching no point in the running order (a deduction outside any race) is read as of every result.
    expect(seriesStandings(table([['1', 'Max Verstappen', 'Red Bull Racing', '40']])).body).toContain('<h2 class="pd-st-h">Standings after round 2</h2>');
  });

  it('keeps in it everyone who can still draw level with the leader on points', () => {
    const rows = [{ pts: 51 }, { pts: 44 }, { pts: 26 }, { pts: 25 }];
    expect(stillIn(rows, 25)).toBe(3);
    expect(stillIn(rows, 26)).toBe(4);
    expect(stillIn(rows, 0)).toBe(1);
    expect(stillIn([], 25)).toBe(0);
    // Level at the cut: both are in.
    expect(stillIn([{ pts: 50 }, { pts: 25 }, { pts: 25 }, { pts: 24 }], 25)).toBe(3);
  });

  it("heads the page with the round, its race and day, and the next points in the track's own weekday", () => {
    expect(b).toContain(
      '<div class="pd-st-head"><div><h2 class="pd-st-h">Standings after round 2</h2><p>Japanese Grand Prix, 29 March<span class="pd-st-next"> · next update after Saturday\'s Las Vegas Grand Prix</span></p></div>',
    );
    const sprintAhead = seriesStandings({ ...sd, calendar: [...sd.calendar!, at(3, 'Sprint', '2026-11-21T22:00:00Z')] }).body;
    expect(sprintAhead).toContain('<span class="pd-st-next"> · next update after Saturday\'s Las Vegas Grand Prix sprint</span>');
    // Saturday: the sprint's 8 points in the results and in the table.
    const counted = { ...sd.standings![0], rows: [['1', 'Charles Leclerc', 'Ferrari', '52'], ['2', 'Max Verstappen', 'Red Bull Racing', '51'], ...sd.standings![0].rows.slice(2)] };
    const saturday = seriesStandings({
      ...sd,
      standings: [counted, sd.standings![1]],
      calendar: [...sd.calendar!, at(3, 'Sprint', '2026-11-21T22:00:00Z')],
      results: [...sd.results!, { round: 3, name: 'Las Vegas GP', date: null, sessions: [ses('Sprint', [['1', 'Charles Leclerc', 'Ferrari', '30:00.000', '8']])] }],
    }).body;
    expect(saturday).toContain('<h2 class="pd-st-h">Standings after the round 3 sprint</h2><p>Las Vegas Grand Prix sprint, 21 November<span class="pd-st-next"> · next update after Saturday\'s Las Vegas Grand Prix</span></p>');
    // The season over: no next update.
    expect(seriesStandings({ ...sd, rounds: sd.rounds!.slice(0, 2) }).body).toContain('<p>Japanese Grand Prix, 29 March</p>');
    // A zone that is not one reads the weekday in UTC (Las Vegas's Saturday night is Sunday there), and an untimed race none.
    expect(seriesStandings({ ...sd, rounds: [...sd.rounds!.slice(0, 2), { ...sd.rounds![2], tz: 'Not/AZone' }] }).body).toContain("next update after Sunday's Las Vegas Grand Prix");
    expect(seriesStandings({ ...sd, calendar: sd.calendar!.slice(0, 3) }).body).toContain('<p>Japanese Grand Prix, 29 March</p>');
  });

  it('names no one in or out without the season’s rounds, and no second team for a table without teams', () => {
    const noRounds = seriesStandings({ ...sd, rounds: [] }).body;
    expect(noRounds).not.toContain('pd-st-who');
    expect(noRounds).not.toContain('class="cut"');
    expect(noRounds).not.toContain('The dashed line');
    const teamless = seriesStandings({ ...sd, standings: [{ title: 'Drivers', columns: ['Pos', 'Driver', 'Pts'], rows: sd.standings![0].rows.map(r => [r[0], r[1], r[3]]) }, sd.standings![1]] }).body;
    expect(teamless).not.toContain(' include ');
  });

  it('carries the switch, hidden until the script shows it, and none without a constructors table', () => {
    expect(b).toContain(
      '<div class="pd-st-seg" role="group" aria-label="Show" hidden><button type="button" data-pd-st="drivers">Drivers</button><button type="button" data-pd-st="constructors">Constructors</button><button type="button" class="both" data-pd-st="both">Both</button></div>',
    );
    expect(b).toContain('<section class="pd-sr-sec pd-stp"><div class="pd-st-head">');
    expect(seriesStandings({ ...sd, standings: [sd.standings![0]] }).body).not.toContain('pd-st-seg');
  });

  it('lists every driver with the team colour, both names, a bar against the leader, the gap and race wins, the leader tinted and the cut under the last one in', () => {
    const rows = [...b.matchAll(/<li( class="[a-z ]+")? style="--t:[^"]+"><span class="p">/g)].map(m => m[1] ?? '');
    expect(rows).toEqual([' class="lead"', '', '', ' class="cut"', '', '', '', '', ' class="lead"', '', '', '']);
    expect(b).toContain(
      '<li class="lead" style="--t:#1E3A8A"><span class="p">1</span><i class="tb"></i><span class="d"><b><span class="fn">Max Verstappen</span><span class="sn">M. Verstappen</span></b><small>Red Bull Racing</small></span><i class="bar"><i style="width:100.0%"></i></i><span class="pt">51</span><span class="g">—</span><span class="w">1</span></li>',
    );
    expect(b).toContain(
      '<li style="--t:#DC0000"><span class="p">2</span><i class="tb"></i><span class="d"><b><span class="fn">Charles Leclerc</span><span class="sn">C. Leclerc</span><sup>−2</sup></b><small>Ferrari</small></span><i class="bar"><i style="width:86.3%"></i></i><span class="pt">44</span><span class="g">−7</span><span class="w">1</span></li>',
    );
    expect(b).toContain('<span class="fn">Arvid Lindblad</span><span class="sn">A. Lindblad</span><sup>+2</sup></b>');
    // A driver with no race win shows none, and feed text stays text, a bad colour out of the style.
    expect(b).toContain('<span class="pt">0</span><span class="g">−51</span><span class="w"></span></li>');
    expect(b).toContain('<span class="fn">Kimi &lt;b&gt;Antonelli&lt;/b&gt;</span><span class="sn">K. &lt;b&gt;Antonelli&lt;/b&gt;</span>');
    expect(b).toContain('<li style="--t:#9aa3b2"><span class="p">8</span>');
    expect(b).not.toContain('url(x)');
  });

  it('writes under the drivers the ruling with its https sources, the dashed line, and a total scored for two teams', () => {
    expect(b).toContain(
      '<p class="pd-st-foot">Small numbers next to a name: points changed when the stewards &lt;i&gt;reviewed&lt;/i&gt; the start on 2 April (<a href="https://www.fia.com/x?a=1&amp;b=2">fia.com</a>). ' +
        "The dashed line marks the last driver who can still mathematically win. Lawson's 32 include 18 for Red Bull Racing, in round 2.</p>",
    );
    expect(b).not.toContain('javascript:');
    expect(b).not.toContain('insecure.example');
    // Without rulings, a cut or a driver of two teams, no line at all.
    const plainSeason = seriesStandings({ ...sd, standingsNotes: [], rounds: [...sd.rounds!, { round: 4, name: 'Qatar Grand Prix', startDate: '2026-11-27', endDate: '2026-11-29', venue: null }], results: [sd.results![0]] }).body;
    expect(plainSeason).not.toContain('pd-st-foot');
  });

  it('names who can still win it: the leader, those in with the share of the points left they need, and the first one out', () => {
    expect(between('<section class="pd-st-who">', '</section>')).toBe(
      '<section class="pd-st-who"><h3>Who can still win it</h3><p>25 points left: one Grand Prix at 25, the sprints all run. A bar is how much of that a driver needs just to draw level.</p><ol>' +
        '<li class="ld" style="--t:#1E3A8A"><b>Verstappen</b><span class="lab">Leader</span><span class="v">51</span></li>' +
        '<li style="--t:#DC0000"><b>Leclerc</b><i class="wb"><i style="width:28.0%"></i></i><span class="v">−7</span></li>' +
        '<li style="--t:#DC0000"><b>Hamilton</b><i class="wb"><i style="width:64.0%"></i></i><span class="v">−16</span></li>' +
        '<li style="--t:#6692FF"><b>Lawson</b><i class="wb"><i style="width:76.0%"></i></i><span class="v">−19</span></li>' +
        '<li class="out" style="--t:#6692FF"><b>Lindblad</b><i class="wb"><i style="width:100.0%"></i></i><span class="v">−32</span></li></ol>' +
        '<p class="pd-st-sum">Four drivers are still in it on paper. Lindblad is out by 7 points. Constructors: 43 left, so Ferrari is still alive.</p></section>',
    );
    const over = seriesStandings({ ...sd, rounds: sd.rounds!.slice(0, 2) }).body;
    expect(over).toContain('<p>No points left: the season is over.</p>');
    expect(over).toContain('<p class="pd-st-sum">Only Verstappen can still win it. Leclerc is out by 7 points. Constructors: 0 left, so only Red Bull Racing can still win it.</p>');
    const sprintAhead = seriesStandings({ ...sd, calendar: [...sd.calendar!, at(3, 'Sprint', '2026-11-21T22:00:00Z')] }).body;
    expect(sprintAhead).toContain('<p>33 points left: one Grand Prix at 25, one sprint at 8.');
  });

  it('tables the constructors with their gaps and race wins', () => {
    expect(b).toContain(
      '<div class="pd-st-cons"><h3 class="pd-st-ch">Constructors</h3><div class="pd-st-th c"><span>Pos</span><span></span><span>Constructor</span><span>Pts</span><span>Gap</span><span>Wins</span></div><ol class="pd-st-tbl c">' +
        '<li class="lead" style="--t:#1E3A8A"><span class="p">1</span><i class="tb"></i><span class="d"><b>Red Bull Racing</b></span><span class="pt">87</span><span class="g">—</span><span class="w">1</span></li>' +
        '<li style="--t:#DC0000"><span class="p">2</span><i class="tb"></i><span class="d"><b>Ferrari</b></span><span class="pt">79</span><span class="g">−8</span><span class="w">1</span></li>',
    );
  });

  it("splits each team's points by who scored them, the seats from drivers.json, a stand-in named with his rounds, each sum the constructors' total", () => {
    const splits = teammates(sd);
    expect(splits.map(s => [s.team, s.pair.map(m => `${m.name} ${m.points}`), s.also.map(m => `${m.name} ${m.points} ${m.rounds.join(',')}`)])).toEqual([
      ['Red Bull Racing', ['Max Verstappen 51', 'Isack Hadjar 18'], ['Liam Lawson 18 2']],
      ['Ferrari', ['Charles Leclerc 44', 'Lewis Hamilton 35'], []],
      ['Racing Bulls', ['Arvid Lindblad 19', 'Liam Lawson 14'], ['Yuki Tsunoda 10 2']],
    ]);
    const official = new Map(sd.standings![1].rows.map(r => [r[1], Number(r[2])]));
    for (const s of splits) expect(s.total, s.team).toBe(official.get(s.team));
    expect(b).toContain('<section class="pd-sr-sec pd-st-mates"><div class="pd-sh"><h2>Teammates</h2><p>Points split inside each team</p></div><div class="pd-st-grid">');
    expect(b).toContain(
      '<article class="pd-st-mate" style="--t:#1E3A8A"><h3>Red Bull Racing</h3><p class="a"><b>Verstappen</b><span>51</span></p><i class="split"><i style="width:58.6%"></i></i><p class="b"><b>Hadjar</b><span>18</span></p><p class="c">Also Lawson: 18 points in round 2</p></article>',
    );
    expect(b).toContain('<p class="b"><b>Lawson</b><span>14</span></p><p class="c">Also Tsunoda: 10 points in round 2</p></article>');
  });

  it('writes the same page whatever the hour, and lines for a season with nothing yet', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-21T23:00:00Z'));
      expect(seriesStandings(sd).body).toBe(b);
    } finally {
      vi.useRealTimers();
    }
    const empty = seriesStandings({ ...sd, standings: null, results: null }).body;
    expect(empty).toContain('<h2 class="pd-st-h">Standings</h2><p>No race has run yet this season.</p>');
    expect(empty).toContain('<p class="pd-mut">No standings yet this season.</p>');
    expect(empty).not.toContain('pd-st-who');
    expect(empty).not.toContain('pd-st-mates');
  });
});

describe('standings-notes.json', () => {
  const read = (slug: string, file: string) => JSON.parse(readFileSync(path.join(process.cwd(), 'content', 'series', slug, file), 'utf8'));
  const notes = read('f1', 'standings-notes.json') as Record<string, Array<{ round: number; decided: string; note: string; drivers: Record<string, number>; sources: string[] }>>;
  const roster = new Set((read('f1', 'drivers.json').teams as Array<{ drivers: Array<{ name: string }> }>).flatMap(t => t.drivers.map(x => x.name)));

  it('holds rulings by season, each dated, with drivers on the roster, whole points and an https source', () => {
    expect(Object.keys(notes).length).toBeGreaterThan(0);
    for (const [season, list] of Object.entries(notes)) {
      expect(season).toMatch(/^\d{4}$/);
      for (const n of list) {
        expect(Number.isInteger(n.round) && n.round > 0, `${season} round`).toBe(true);
        expect(n.decided, `${season} decided`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(`${n.decided}T00:00:00Z`).toISOString().slice(0, 10), `${season} decided`).toBe(n.decided);
        expect(n.decided.startsWith(season), `${season} decided in its season`).toBe(true);
        // The note completes "points changed when …", so it opens in lower case and ends without a stop.
        expect(n.note, `${season} note`).toMatch(/^[a-z].*[^.]$/);
        expect(Object.keys(n.drivers).length, `${season} drivers`).toBeGreaterThan(0);
        for (const [name, delta] of Object.entries(n.drivers)) {
          expect(roster.has(name), `${name} on the roster`).toBe(true);
          expect(Number.isInteger(delta) && delta !== 0, `${name} delta`).toBe(true);
        }
        expect(n.sources.length, `${season} sources`).toBeGreaterThan(0);
        for (const s of n.sources) expect(new URL(s).protocol, s).toBe('https:');
      }
    }
  });
});

describe('seriesChampions', () => {
  const file = (name: string) => JSON.parse(readFileSync(path.join(process.cwd(), 'content/series/f1', name), 'utf8'));
  const roster = file('drivers.json') as { teams: { name: string; color: string; drivers: { name: string; code?: string }[] }[] };
  const cd: SeriesData = {
    slug: 'f1',
    name: 'Formula 1',
    short: 'F1',
    season: 2026,
    standings: [{ title: 'Drivers', columns: ['Pos', 'Driver', 'Team', 'Pts'], rows: [['1', 'Kimi Antonelli', 'Mercedes', '300'], ['2', 'Max Verstappen', 'Red Bull Racing', '198']] }],
    results: null,
    calendar: null,
    rounds: [],
    teams: roster.teams.map(t => ({ name: t.name, colour: t.color, drivers: t.drivers })),
    // The page as of the 2025 champion, so adding 2026's by hand in December keeps these tests green; the colour test
    // below reads the whole file.
    champions: {
      seasons: file('champions.json').filter((s: { year: number }) => s.year <= 2025),
      notes: file('champion-notes.json'),
      records: file('record-notes.json'),
      historic: file('historic-team-colors.json').teams,
      names: file('team-names.json'),
    },
  };
  const page = seriesChampions(cd);
  const b = page.body;
  const row = (year: number) => b.match(new RegExp(`<tr data-find="${year} [^"]*">.*?</tr>`))?.[0] ?? '';

  it('is the roll of honour at /series/f1/champions/, wide, its tab lit, every season counted from the file', () => {
    expect(page.path).toBe('/series/f1/champions/');
    expect(page.template).toBe('page-wide');
    expect(b).toContain('<a href="/series/f1/champions/" aria-current="page">Champions</a>');
    expect(b).toContain("Every drivers' champion since 1950 and every constructors' champion since 1958, year by year: 76 seasons, 35 different drivers.");
    expect(b).toContain('<span class="pd-ch-count" data-of="76">76 seasons</span>');
    expect(seriesFamily(cd).map(p => p.path)).toContain('/series/f1/champions/');
  });

  it('counts each title: ×n for the driver, the nth for the constructors, none before 1958', () => {
    const marks = titleCounts(cd.champions!.seasons);
    expect(marks.get(2024)).toEqual({ nth: 4, teamNth: 9 });
    expect(marks.get(2020)).toEqual({ nth: 7, teamNth: 7 });
    expect(marks.get(2025)).toEqual({ nth: 1, teamNth: 10 });
    expect(marks.get(1957)?.teamNth).toBeNull();
    expect(row(2024)).toContain('<b>Max Verstappen<sup>×4</sup></b>');
    expect(row(2025)).toContain('<b>Lando Norris</b><small>McLaren</small>');
    expect(row(2025)).toContain('<td class="tc"><b>McLaren</b><small>10th title</small></td>');
  });

  it('derives each margin, half points included, and marks five points or fewer', () => {
    expect(row(1984)).toContain('<td class="mg close">+0.5</td>');
    expect(row(2021)).toContain('<td class="mg">+8</td>');
    expect(row(2025)).toContain('<td class="mg close">+2</td>');
    expect(row(2023)).toContain('<td class="mg">+290</td>');
  });

  it('marks where the teams’ title begins, with a dash before it', () => {
    expect(row(1958)).toContain('<td class="tc"><b>Vanwall</b><small>1st title</small></td>');
    expect(row(1957)).toContain('<td class="tc"><small>—</small></td>');
    const era = b.indexOf('<tr class="era" id="pd-ch-1958">');
    expect(era).toBeGreaterThan(b.indexOf('<tr data-find="1958 '));
    expect(era).toBeLessThan(b.indexOf('<tr data-find="1957 '));
    expect(b).toContain(`<a href="#pd-ch-1958" data-dec="1950s">1958: teams' title</a>`);
    expect(b).toContain('<a href="#pd-ch-2020s" data-dec="2020s" class="on">2020s</a>');
  });

  it('tallies the teams against counts taken by hand from champions.json', () => {
    expect(teamTallies(cd.champions!.seasons, 'drivers').slice(0, 6)).toEqual([
      { name: 'Ferrari', count: 15 },
      { name: 'McLaren', count: 13 },
      { name: 'Mercedes', count: 9 },
      { name: 'Red Bull', count: 8 },
      { name: 'Williams', count: 7 },
      { name: 'Lotus', count: 6 },
    ]);
    expect(teamTallies(cd.champions!.seasons, 'constructors').slice(0, 5)).toEqual([
      { name: 'Ferrari', count: 16 },
      { name: 'McLaren', count: 10 },
      { name: 'Williams', count: 9 },
      { name: 'Mercedes', count: 8 },
      { name: 'Lotus', count: 7 },
    ]);
    expect(b).toContain('<p class="more">+ 11 more teams</p>');
    expect(b).toContain('<p class="more">+ 10 more teams</p>');
  });

  it('orders level teams by who reached the count first', () => {
    const s = (year: number, team: string) => ({ year, driver: `D${year}`, constructor: team, constructorChampion: team });
    expect(teamTallies([s(2001, 'B'), s(2000, 'A'), s(2003, 'A'), s(2002, 'B')], 'drivers')).toEqual([
      { name: 'B', count: 2 },
      { name: 'A', count: 2 },
    ]);
  });

  it('lists the records: everyone level at the cut, the closest and biggest margins newest first when level', () => {
    const r = recordLists(cd.champions!.seasons);
    expect(r.most.map(x => `${x.name} ${x.titles.length}`)).toEqual(['Michael Schumacher 7', 'Lewis Hamilton 7', 'Juan Manuel Fangio 5', 'Alain Prost 4', 'Sebastian Vettel 4', 'Max Verstappen 4']);
    expect(r.closest.map(s => s.year)).toEqual([1984, 2008, 2007, 1994, 1981]);
    expect(r.biggest.map(s => s.year)).toEqual([2023, 2013, 2022, 2020, 2011]);
    expect(b).toContain('<li><span class="yr">1984</span><span class="who"><b>Lauda</b> <small>over Prost</small></span><span class="n">0.5</span></li>');
    expect(b).toContain('<b>Hamilton drew level with Schumacher&#39;s seven in the wet at Istanbul in 2020, sixteen years after Schumacher had set it.</b> One square per title');
  });

  it('colours every champion’s team from the roster, the alias or the heritage file, never grey', () => {
    const whole: NonNullable<SeriesData['champions']> = { ...cd.champions!, seasons: file('champions.json') };
    const teams = new Set(whole.seasons.flatMap(s => [typeof s.constructor === 'string' ? s.constructor : '', s.constructorChampion ?? ''].filter(Boolean)));
    for (const t of teams) expect(championColour(cd, t), t).not.toBe('#9aa3b2');
    expect(championColour(cd, 'Red Bull')).toBe('#1E3A8A');
    expect(championColour(cd, 'Lotus')).toBe('#C8A24B');
    expect(championColour(cd, 'Wolf')).toBe('#9aa3b2');
  });

  it('crowns the newest season: the tiles, the first title, the teams’ streak, the note’s first sentence, the title race', () => {
    expect(b).toContain('<section class="pd-ch-reign" style="--t:#FF8000">');
    expect(b).toContain('<span><b>423</b>Points</span><span><b>7</b>Wins</span><span><b>+2</b>Over Verstappen</span>');
    expect(b).toContain('<p class="pd-ch-sub"><b>McLaren</b><b>First title</b></p>');
    expect(b).toContain(
      "Teams' champion: <b>McLaren</b>, a second title in a row. Norris clinched his first championship at the Abu Dhabi finale on 7 December 2025, where third place behind race winner Max Verstappen and teammate Oscar Piastri was exactly enough.</p>",
    );
    expect(b).toContain('<a href="/series/f1/standings/">2026 title race →</a>');
    const decided = seriesChampions({
      ...cd,
      champions: { ...cd.champions!, seasons: [{ year: 2026, driver: 'Kimi Antonelli', constructor: 'Mercedes', constructorChampion: 'Mercedes', points: 400, wins: 9, runnerUp: 'Max Verstappen', runnerUpTeam: 'Red Bull', runnerUpPoints: 300 }, ...cd.champions!.seasons] },
    }).body;
    expect(decided).toContain('<a href="/series/f1/standings/">2026 final standings →</a>');
    expect(decided).toContain("Teams' champion: <b>Mercedes</b>, its 9th title.");
    expect(decided).toContain('77 seasons, 36 different drivers.');
    const navy = seriesChampions({ ...cd, champions: { ...cd.champions!, seasons: cd.champions!.seasons.filter(s => s.year <= 2024) } }).body;
    expect(navy).toContain('<section class="pd-ch-reign is-dark" style="--t:#1E3A8A">');
  });

  it('reads a note’s first sentence past an initial, and writes ordinals', () => {
    expect(firstSentence('J. M. Fangio won. Then more.')).toBe('J. M. Fangio won.');
    expect(firstSentence('One sentence only')).toBe('One sentence only');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
  });

  it('opens the doorways: More Formula 1 from the data, the three pages the site lacks greyed with no link', () => {
    expect(b).toContain('<a class="pd-ch-door" href="/series/f1/standings/"><small>/series/f1/standings/</small><b>Formula 1 standings</b><span>Antonelli leads by 102.</span><em>Open →</em></a>');
    expect(b).toContain('<a class="pd-ch-door" href="/category/formula-1/"><small>From the blog</small><b>Formula 1 posts</b>');
    expect(b).toContain('<span class="pd-ch-door is-off"><small>/series/f2/champions/</small><b>Formula 2 champions</b><span>Since 2005, including the GP2 years.</span><em>Coming</em></span>');
    for (const href of ['/series/f2/champions/', '/learn/', '/news/']) expect(b).not.toContain(`href="${href}"`);
    for (const href of ['/calendar/', '/series/', '/about/']) expect(b).toContain(`<a class="pd-ch-door" href="${href}">`);
    expect(b).toContain('<a href="/calendar/#f1">Open calendar</a>');
  });

  it('escapes every name from the files', () => {
    const evil = seriesChampions({
      ...cd,
      champions: { ...cd.champions!, seasons: [{ year: 2025, driver: '<img onerror=x>', constructor: 'A&B', constructorChampion: 'A&B', points: 1, wins: 1, runnerUp: '"Q"', runnerUpPoints: 0 }] },
    }).body;
    expect(evil).not.toContain('<img onerror');
    expect(evil).toContain('&lt;img onerror=x&gt;');
    expect(evil).toContain('A&amp;B');
    expect(evil).toContain('&quot;Q&quot;');
  });

  it('folds accents for the search, keeps the draft’s cards before 1958, and reads the edge cases', () => {
    expect(b).toContain('<tr data-find="2007 kimi raikkonen ferrari lewis hamilton ferrari">');
    const card1957 = b.match(new RegExp('<li data-find="1957 [^"]*">.*?</li>'))?.[0] ?? '';
    expect(card1957).toContain('Runner-up');
    expect(card1957).not.toContain('Teams');
    expect(b).not.toContain('<li class="era">');
    expect(row(2016)).toContain('<td class="mg close">+5</td>');
    expect(b).toContain('<li><b>Michael Schumacher</b><span class="sq"><i style="--t:#00A050"></i><i style="--t:#00A050"></i><i style="--t:#DC0000"></i>');
    const ahead = seriesChampions({ ...cd, rounds: [{ round: 18, name: 'United States Grand Prix', startDate: '2026-10-23', endDate: '2026-10-25', venue: null }] }).body;
    expect(ahead).toContain('<span>Antonelli leads by 102 with 25 points left.</span>');
    // A season with no team: parsed, as the file is, so `constructor` is Object's own and the page must not print it.
    const lone = seriesChampions({ ...cd, champions: { ...cd.champions!, seasons: [JSON.parse('{"year": 1999, "driver": "Nobody"}')] } }).body;
    expect(lone).toContain('<h3>Nobody</h3>');
    expect(lone).not.toContain('pd-ch-tiles');
    expect(lone).toContain('1 season, 1 different driver.');
    expect(firstSentence('He won! Then more.')).toBe('He won!');
  });

  it('says so when no champion is recorded', () => {
    expect(seriesChampions({ ...cd, champions: undefined }).body).toContain('No champions recorded yet.');
  });
});

describe('seriesList', () => {
  const rounds = (n: number, month = '05') =>
    Array.from({ length: n }, (_, i) => ({ round: i + 1, name: `Round ${i + 1} Grand Prix`, startDate: `2026-${month}-${String(i * 7 + 1).padStart(2, '0')}`, endDate: `2026-${month}-${String(i * 7 + 3).padStart(2, '0')}`, venue: null }));
  const raced = (...ns: number[]) => ns.map(n => race(n, `Round ${n}`, `2026-05-0${n}`, [['1', 'Winner', 'Team', '1:00:00.000', '25']]));
  const base = { standings: null, calendar: null, season: 2026 } as const;
  const all: SeriesData[] = [
    { ...base, slug: 'wrc', name: 'WRC', category: 'rally', colour: '#eab308', order: 9, rounds: rounds(2), results: [] },
    // Seasons over by 5 May: a result never closes a round before its dates have come.
    { ...base, slug: 'nls', name: 'NLS <b>Nürburgring</b>', category: 'endurance', colour: 'red;x', order: 10, rounds: rounds(2, '04'), results: raced(1, 2) },
    { ...base, slug: 'f3', name: 'Formula 3', category: 'formula', colour: '#818cf8', order: 14, rounds: rounds(2, '04'), results: raced(1, 2), champion: 'Ugo Ugochukwu' },
    { ...base, slug: 'f1', name: 'Formula 1', category: 'formula', colour: '#ff4136', order: 1, rounds: rounds(3), results: raced(1) },
    { ...base, slug: 'imsa', name: 'IMSA', category: 'endurance', colour: '#2dd4bf', order: 4, rounds: rounds(2, '04'), results: raced(1) },
    {
      ...base,
      slug: 'adac-ravenol-24h',
      name: 'ADAC Ravenol 24h Nürburgring',
      category: 'endurance',
      colour: '#fbbf24',
      order: 15,
      rounds: [],
      results: null,
      champion: 'Maro Engel, Maxime Martin',
      calendar: [{ start: '2026-05-16T14:00:00Z', end: '2026-05-17T14:00:00Z', dateOnly: false, event: '24h', session: 'Race', round: null }],
    },
  ];
  // 5 May: WRC's first round has ended without a result in its feed, and IMSA's whole April season has, with one.
  const now = new Date('2026-05-05T12:00:00Z');
  const page = seriesList(all, now);
  const b = page.body;
  const card = (slug: string) => b.slice(b.indexOf(`data-s="${slug}"`), b.indexOf('</article>', b.indexOf(`data-s="${slug}"`)));

  it('is /series/ on the Wide template, counting its championships in words', () => {
    expect(page).toMatchObject({ path: '/series/', title: 'Series', template: 'page-wide' });
    expect(b).toContain('<h1 class="pd-sx-h1">Six championships</h1>');
  });

  it('splits by status, then by type in the chips’ order, each group as wide as its cards', () => {
    const shape = [...b.matchAll(/<h2>([^<]+)<\/h2>|<div class="pd-sx-type pd-sx-span-(\d)" data-type="([a-z]+)">|data-s="([a-z0-9-]+)" style/g)].map(m => m[1] ?? (m[3] ? `${m[3]}×${m[2]}` : m[4]));
    expect(shape).toEqual(['Racing this weekend', 'Still racing', 'formula×1', 'f1', 'rally×1', 'wrc', 'Completed', 'formula×1', 'f3', 'endurance×3', 'adac-ravenol-24h', 'imsa', 'nls']);
    expect(b).toContain('<div class="pd-sx-type pd-sx-span-3" data-type="endurance"><h3>Endurance <small>3</small></h3><div class="pd-sx-grid pd-sx-cols-3">');
  });

  it('carries the next round as a label the script turns into This weekend, and the bar of rounds', () => {
    expect(card('f1')).toContain('<em class="pd-sx-pill"><span class="pd-wk" data-from="2026-05-08" data-to="2026-05-10" data-on="This weekend">Next</span></em>');
    // The countdown's slot, which the script fills with the days until the round's first day.
    expect(card('f1')).toContain('</em><span class="pd-sx-in" data-pd-days="2026-05-08" hidden></span></p>');
    for (const done of ['f3', 'nls', 'imsa', 'adac-ravenol-24h']) expect(card(done), done).not.toContain('data-pd-days');
    expect(card('f1')).toContain('<span class="pd-sx-bar" aria-hidden="true"><i class="is-done"></i><i class="is-next"></i><i></i></span>');
    expect(card('f1')).toContain('<span>1 of 3 rounds run</span>');
  });

  it('marks a finished championship with its champion as champions.json writes it, else its rounds run', () => {
    expect(b).toContain('<article class="pd-sx-card is-over" data-type="formula" data-s="f3"');
    expect(card('f3')).toContain('<em class="pd-sx-tag">Season complete</em></p><p class="pd-sx-ev"><b>2026 champion: Ugo Ugochukwu</b></p>');
    expect(card('nls')).toContain('<b>All 2 rounds run</b>');
    // A feed that stops early (IMSA's) never leaves a past round as Next: its dates count it run.
    expect(card('imsa')).toContain('<span>2 of 2 rounds run</span>');
    expect(card('imsa')).toContain('<b>All 2 rounds run</b>');
    expect(card('wrc')).toContain('<span>1 of 2 rounds run</span>');
    expect(card('adac-ravenol-24h')).toContain('<em class="pd-sx-tag">One race a year · May</em></p><p class="pd-sx-ev"><b>2026 winners: Maro Engel, Maxime Martin</b>');
    expect(b).toContain('<article class="pd-sx-card" data-type="rally" data-s="wrc"');
  });

  it('links what exists: Formula 1 its Overview, Standings and Results, every card the Calendar showing only that series', () => {
    expect(card('f1')).toContain('<b><a href="/series/f1/">Formula 1</a></b>');
    expect(card('f1')).toContain('<a href="/calendar/#f1">Calendar</a><a href="/series/f1/standings/">Standings</a><a href="/series/f1/results/">Results</a><a href="/series/f1/champions/">Champions</a>');
    expect(card('wrc')).toContain('<b>WRC</b>');
    expect(card('wrc')).toContain('<a href="/calendar/#wrc">Calendar</a><span class="is-off">Standings</span><span class="is-off">Results</span>');
  });

  it('holds every next round as a hidden weekend card, the section hidden until the script finds this weekend', () => {
    expect(b).toContain('<section class="pd-sx-sec pd-sx-weekend" hidden>');
    expect([...b.matchAll(/<article class="pd-sx-wk" data-from="([\d-]+)" data-to="([\d-]+)"[^>]*hidden><header><b>([^<]+)<\/b>/g)].map(m => `${m[3]} ${m[1]}`)).toEqual(['Formula 1 2026-05-08', 'WRC 2026-05-08']);
    expect(b).toContain('<div class="pd-sx-ctl" hidden>');
  });

  it("opens a weekend card's weekend page where its series has them, else the Calendar showing that series, named for its round", () => {
    expect(b).toContain('<header><b>Formula 1</b><small>Round 2</small></header><div><a href="/series/f1/2026/round-2/" aria-label="Formula 1, round 2: Round 2 GP, its weekend page"><b>Round 2 GP</b></a>');
    expect(b).toMatch(/<header><b>WRC<\/b><small>Round (\d+)<\/small><\/header><div><a href="\/calendar\/#wrc" aria-label="WRC, round \1: [^"]+, on the Calendar"><b>/);
  });

  it('closes a round raced twice only once its last race is over, and one without a result from the next UTC day', () => {
    const dtm: SeriesData = {
      ...base,
      slug: 'dtm',
      name: 'DTM',
      category: 'gt',
      colour: '#0ea5e9',
      order: 7,
      rounds: [{ round: 1, name: 'Hockenheim', startDate: '2026-05-09', endDate: '2026-05-10', venue: null }],
      calendar: [
        { start: '2026-05-09T12:00:00Z', end: '2026-05-09T13:00:00Z', dateOnly: false, event: 'Hockenheim', session: 'Race 1', round: 1 },
        { start: '2026-05-10T12:00:00Z', end: '2026-05-10T13:00:00Z', dateOnly: false, event: 'Hockenheim', session: 'Race 2', round: 1 },
      ],
      results: [{ round: 1, name: 'Hockenheim', date: '2026-05-09', sessions: [{ label: 'Race 1', tables: [{ title: 'Race 1', columns: ['Pos', 'Driver', 'Team', 'Time', 'Pts'], rows: [['1', 'Winner', 'Team', '1:00:00.000', '25']] }] }] }],
    };
    const run = (d: SeriesData, at: string) => seriesList([d], new Date(at)).body.match(/<span>(\d+) of 1 rounds run<\/span>/)?.[1];
    // Saturday night: Race 1 is in, Race 2 still to come, so the round stays Next and in Racing this weekend.
    expect(run(dtm, '2026-05-09T20:00:00Z')).toBe('0');
    expect(run(dtm, '2026-05-10T14:00:00Z')).toBe('1');
    // A feed with nothing yet, and an American evening race ending after midnight UTC (the round's local date is the
    // 10th): it reads run from the UTC day after the race ended, never while the race is still on.
    const lagging: SeriesData = { ...dtm, results: [], calendar: [dtm.calendar![0], { ...dtm.calendar![1], start: '2026-05-10T23:40:00Z', end: '2026-05-11T02:10:00Z' }] };
    expect(run(lagging, '2026-05-11T00:30:00Z')).toBe('0');
    expect(run(lagging, '2026-05-11T23:00:00Z')).toBe('0');
    expect(run(lagging, '2026-05-12T00:30:00Z')).toBe('1');
  });

  it('reads a Saturday round This weekend from the Friday too, and caps a group at four columns', () => {
    const sat = seriesList([{ ...base, slug: 'nls', name: 'NLS', category: 'endurance', colour: '#f59e0b', order: 10, rounds: [{ round: 1, name: 'NLS 1', startDate: '2026-05-09', endDate: '2026-05-09', venue: null }], results: [] }], now).body;
    expect(sat).toContain('<span class="pd-wk" data-from="2026-05-08" data-to="2026-05-09" data-on="This weekend">Next</span>');
    const five = seriesList(Array.from({ length: 5 }, (_, i) => ({ ...base, slug: `s${i}`, name: `S${i}`, category: 'stock', colour: '#123456', order: i, rounds: rounds(1, '06'), results: [] })), now).body;
    expect(five).toContain('<div class="pd-sx-type pd-sx-span-4" data-type="stock"><h3>Stock cars <small>5</small></h3><div class="pd-sx-grid pd-sx-cols-4">');
  });

  it('dates a one-day round once, and reads it This weekend from that weekend’s Friday', () => {
    const day = seriesList([{ ...base, slug: 'nascar-cup', name: 'NASCAR Cup', category: 'stock', colour: '#facc15', order: 8, rounds: [{ round: 1, name: 'YellaWood 500', startDate: '2026-05-10', endDate: '2026-05-10', venue: null }], results: [] }], now).body;
    expect(day.match(/<span>10 May<\/span>/g)).toHaveLength(2);
    expect(day).not.toContain('10–10 May');
    // A Sunday race: the card's label from Friday 8 May, the weekend card on its own date.
    expect(day).toContain('<span class="pd-wk" data-from="2026-05-08" data-to="2026-05-10" data-on="This weekend">Next</span>');
    // The countdown counts to the race's own day, the Sunday.
    expect(day).toContain('<span class="pd-sx-in" data-pd-days="2026-05-10" hidden></span>');
    expect(day).toContain('<article class="pd-sx-wk" data-from="2026-05-10" data-to="2026-05-10"');
  });

  it('keeps feed and content text as text and a bad colour out of the style, and writes the same page all day', () => {
    expect(b).toContain('NLS &lt;b&gt;Nürburgring&lt;/b&gt;');
    expect(card('nls')).toContain('style="--t:#9aa3b2"');
    const odd = seriesList(
      [
        { ...base, slug: 'x1', name: 'X', category: 'rally', colour: '#123456', order: 1, rounds: [{ round: 1, name: 'Rally <i>One</i>', startDate: '2026-05-08', endDate: '2026-05-10', venue: null }], results: [] },
        { ...base, slug: 'x2', name: 'Y', category: 'rally', colour: '#123456', order: 2, rounds: [], results: null, champion: 'Ann <b>Bee</b>', calendar: [{ start: '2026-05-16T14:00:00Z', end: '2026-05-17T14:00:00Z', dateOnly: false, event: 'Y', session: 'Race', round: null }] },
      ],
      now,
    ).body;
    expect(odd).toContain('Rally &lt;i&gt;One&lt;/i&gt;');
    expect(odd).toContain('Ann &lt;b&gt;Bee&lt;/b&gt;');
    expect(odd).not.toMatch(/<i>One<\/i>|<b>Bee<\/b>/);
    vi.useFakeTimers();
    try {
      // The wall clock after F1's round 2 has ended: a page reading it instead of `now` would count that round run.
      vi.setSystemTime(new Date('2026-05-12T12:00:00Z'));
      expect(seriesList(all, new Date('2026-05-05T23:59:00Z')).body).toBe(b);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('prose', () => {
  it('reads paragraphs, "## " heads and bold, and nothing else', () => {
    expect(prose('A [link](https://x) and _em_.\n\n## Head\n\nB')).toBe('<p>A [link](https://x) and _em_.</p><h3>Head</h3><p>B</p>');
  });
});

describe('categorySlug', () => {
  it('writes the slug WordPress gives a category of that name', () => {
    expect(categorySlug('Formula 1')).toBe('formula-1');
    expect(categorySlug('MotoGP')).toBe('motogp');
    expect(categorySlug('ADAC Ravenol 24h Nürburgring')).toBe('adac-ravenol-24h-nurburgring');
  });
});
