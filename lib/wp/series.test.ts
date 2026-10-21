import { describe, it, expect } from 'vitest';
import type { ResultRound, SeriesData } from './render';
import { categorySlug, prose, ROUND2_SERIES, seriesFamily, seriesOverview } from './series';

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
    expect(seriesFamily(f1).map(p => p.path)).toEqual(['/series/f1/']);
    expect(ROUND2_SERIES.has('f1')).toBe(true);
  });

  it('carries the five tabs at their own addresses, the Calendar showing only this series', () => {
    const tabs = [...body.matchAll(/<a href="([^"]+)"( aria-current="page")?>(Overview|Calendar|Standings|Results|Champions)<\/a>/g)].map(m => [m[3], m[1], Boolean(m[2])]);
    expect(tabs).toEqual([
      ['Overview', '/series/f1/', true],
      ['Calendar', '/calendar/#f1', false],
      ['Standings', '/series/f1/standings/', false],
      ['Results', '/series/f1/results/', false],
      ['Champions', '/series/f1/champions/', false],
    ]);
  });

  it('draws the band: the season in a line, a bar of the rounds, the round to come named by the script', () => {
    expect(body).toContain('<h1>Formula 1</h1><p>2026 season · 3 rounds · 1 run · <span class="pd-wk" data-from="2026-10-23" data-to="2026-10-25" data-on="round 2 this weekend">next: round 2</span></p>');
    expect(body).toContain('<span class="pd-sr-bar" aria-hidden="true"><i class="is-done"></i><i class="is-now"></i><i></i></span>');
    expect(body).toContain('<button type="button" class="pd-sr-follow" data-pd-follow="f1" hidden>Follow</button><a class="pd-sr-emails" href="/subscribe/">Session emails</a>');
  });

  it('gives the round to come its timed sessions for the script, and the race in UTC', () => {
    expect(body).toContain('data-pd-ses="Practice 1|2026-10-23T17:30:00Z|2026-10-23T18:30:00Z;Race|2026-10-25T20:00:00Z|2026-10-25T22:00:00Z"');
    expect(body).toContain('<span class="pd-pill pd-pill-live" hidden>● Live</span><span>Round 2 · <span class="pd-wk" data-from="2026-10-23" data-to="2026-10-25" data-on="this weekend">next</span></span>');
    expect(body).toContain('<p class="pd-mut">Circuit of The Americas · 23–25 Oct</p>');
    expect(body).toContain('<span class="pd-sr-race">Race <span class="pd-t" data-utc="2026-10-25T20:00:00Z" data-f="wt">Sun 20:00 UTC</span></span>');
  });

  it("names the last race as rounds.json does, with its winner's team colour and margin", () => {
    expect(body).toContain('<p class="pd-sr-lab">Last race · Round 1</p><h2>Singapore Grand Prix</h2><p class="pd-mut">Marina Bay Street Circuit · 27 Sep</p>');
    expect(body).toContain('<span class="pd-sr-win" style="--t:#1E3A8A"><b>Max Verstappen</b></span> <span class="pd-mut">Red Bull Racing · won by 7.335 s</span>');
    expect(body).toContain('<i class="pd-ol pd-ol-marina-bay pd-ol-big" aria-hidden="true"></i>');
  });

  it('tiles the season: a finished round opens its Results line, a round to come its month on the Calendar', () => {
    expect(body).toContain('<a class="pd-sr-tile" href="/series/f1/results/#r1"><small>R1</small><b>Singapore</b><i class="pd-ol pd-ol-marina-bay" aria-hidden="true"></i><span class="pd-sr-win" style="--t:#1E3A8A"><b>VER</b>27 Sep</span></a>');
    expect(body).toContain('<a class="pd-sr-tile is-now" href="/calendar/2026-10/#f1"><small>R2</small><b>United States</b>');
    expect(body).toContain('data-on="This weekend · 23–25 Oct">Next · 23–25 Oct</span>');
    expect(body).toContain('<a class="pd-sr-tile is-ahead" href="/calendar/2026-10/#f1"><small>R3</small><b>Mexico City Grand Prix</b><span class="pd-sr-when">30 Oct–1 Nov</span></a>');
    expect(body).toContain('<span class="pd-sr-tile is-off"><small>—</small><b><s>Saudi Arabia</s></b><span class="pd-sr-when">Cancelled · was round 5</span></span>');
  });

  it('shows the top ten drivers with bars against the leader and race wins, and every constructor', () => {
    expect(body).toContain('<a href="/series/f1/standings/">All 12 →</a>');
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
    expect(seriesOverview(f1).body).toBe(body);
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
