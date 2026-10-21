import { describe, it, expect, vi } from 'vitest';
import type { ResultRound, SeriesData } from './render';
import { categorySlug, prose, ROUND2_SERIES, seriesFamily, seriesList, seriesOverview, seriesResults } from './series';

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
    expect(seriesFamily(f1).map(p => p.path)).toEqual(['/series/f1/', '/series/f1/results/']);
    expect(ROUND2_SERIES.has('f1')).toBe(true);
  });

  it('carries the five tabs at their own addresses, the Calendar showing only this series, a page not yet built greyed', () => {
    const tabs = [...body.matchAll(/<a href="([^"]+)"( aria-current="page")?>(Overview|Calendar|Standings|Results|Champions)<\/a>|<span class="is-off">(Standings|Champions)<\/span>/g)].map(m =>
      m[4] ? [m[4], null, false] : [m[3], m[1], Boolean(m[2])],
    );
    expect(tabs).toEqual([
      ['Overview', '/series/f1/', true],
      ['Calendar', '/calendar/#f1', false],
      ['Standings', null, false],
      ['Results', '/series/f1/results/', false],
      ['Champions', null, false],
    ]);
    expect(body).not.toContain('/series/f1/standings/');
    expect(body).not.toContain('/series/f1/champions/');
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
    // The Standings page comes with O16: until then the count stands greyed, linking nowhere.
    expect(body).toContain('<h2>Drivers</h2><p><span class="is-off">All 12</span></p>');
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
    expect(saturday).toContain('<a class="pd-sr-tile is-now" href="/calendar/2026-10/#f1"><small>R2</small>');
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
  const fold = (n: number) => {
    const from = b.indexOf(`<details class="pd-rs-round" id="r${n}"`);
    return b.slice(from, b.indexOf('</div></details>', from) + 16);
  };
  it('is the Results address on the Wide template, its tab current', () => {
    expect(page).toMatchObject({ path: '/series/f1/results/', title: 'Formula 1 results', template: 'page-wide' });
    expect(b).toContain('<a href="/series/f1/results/" aria-current="page">Results</a>');
    expect(b).toContain('<div class="pd-sh"><h2>Results</h2><p>2026 · 1 round run · the latest first</p></div>');
  });

  it('folds a round that has raced, the latest first and open, with the ids the Overview tiles link', () => {
    // Round 2 has run its first practice only: it joins the list with its race.
    expect([...b.matchAll(/<details class="pd-rs-round" id="(r\d+)"( open)?>/g)].map(m => [m[1], Boolean(m[2])])).toEqual([['r1', true]]);
    const later = seriesResults({ ...fr, results: [...fr.results!, race(3, 'Mexico City Grand Prix', '2026-11-01', [['1', 'Charles Leclerc', 'Ferrari', '1:40:00.000', '25']])] }).body;
    expect([...later.matchAll(/<details class="pd-rs-round" id="(r\d+)"( open)?>/g)].map(m => [m[1], Boolean(m[2])])).toEqual([
      ['r3', true],
      ['r1', false],
    ]);
  });

  it("lines a round up as rounds.json names it, with its format, its winner in the team's colour and its date", () => {
    expect(fold(1)).toContain(
      '<summary><span class="pd-rs-rn">R1</span><span class="pd-rs-name"><b>Singapore Grand Prix</b><em class="pd-rs-fmt">Sprint<span> weekend</span></em></span><span class="pd-sr-win" style="--t:#1E3A8A"><b>Max Verstappen</b></span><span class="pd-rs-dt">27 Sep</span></summary>',
    );
  });

  it('opens a round on its race, ten rows deep with the rest in a fold, the weekend held for its own pages', () => {
    expect(fold(1)).toContain('<div class="pd-rs-body"><h3>Race</h3><div class="pd-rs-th pd-rs-c2"><span>Pos</span><span>Driver</span><span>Time</span><span>Pts</span></div>');
    expect(fold(1)).toContain('<li><span class="pd-p">1</span><span class="pd-d"><i class="pd-rs-tb" style="--t:#1E3A8A"></i><b>Max Verstappen</b> <small>Red Bull Racing</small></span><span class="pd-v">1:42:00.785</span><span class="pd-v">25</span></li>');
    expect(fold(1)).toContain('<details class="pd-rs-more"><summary>All 12 · 2 more</summary>');
    expect(fold(1).match(/<li>/g)).toHaveLength(12);
    // The sprint, the qualifyings and the practice are stored, not drawn: the weekend pages come in their own slot.
    expect(b).not.toContain('39:48.162');
    expect(b).not.toContain('1:29.8');
    expect(seriesFamily(fr).map(p => p.path)).toEqual(['/series/f1/', '/series/f1/results/']);
  });

  it('keeps feed text as text and a bad colour out of the style', () => {
    expect(b).toContain('<b>Kimi &lt;b&gt;Antonelli&lt;/b&gt;</b> <small>Haas</small>');
    expect(b).not.toContain('<b>Antonelli</b>');
    expect(b).toContain('<i class="pd-rs-tb" style="--t:#9aa3b2"></i><b>Kimi');
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

describe('seriesList', () => {
  const rounds = (n: number, month = '05') =>
    Array.from({ length: n }, (_, i) => ({ round: i + 1, name: `Round ${i + 1} Grand Prix`, startDate: `2026-${month}-${String(i * 7 + 1).padStart(2, '0')}`, endDate: `2026-${month}-${String(i * 7 + 3).padStart(2, '0')}`, venue: null }));
  const raced = (...ns: number[]) => ns.map(n => race(n, `Round ${n}`, `2026-05-0${n}`, [['1', 'Winner', 'Team', '1:00:00.000', '25']]));
  const base = { standings: null, calendar: null, season: 2026 } as const;
  const all: SeriesData[] = [
    { ...base, slug: 'wrc', name: 'WRC', category: 'rally', colour: '#eab308', order: 9, rounds: rounds(2), results: [] },
    { ...base, slug: 'nls', name: 'NLS <b>Nürburgring</b>', category: 'endurance', colour: 'red;x', order: 10, rounds: rounds(2), results: raced(1, 2) },
    { ...base, slug: 'f3', name: 'Formula 3', category: 'formula', colour: '#818cf8', order: 14, rounds: rounds(2), results: raced(1, 2), champion: 'Ugo Ugochukwu' },
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

  it('links what exists: Formula 1 its Overview and Results, every card the Calendar showing only that series', () => {
    expect(card('f1')).toContain('<b><a href="/series/f1/">Formula 1</a></b>');
    expect(card('f1')).toContain('<a href="/calendar/#f1">Calendar</a><span class="is-off">Standings</span><a href="/series/f1/results/">Results</a><span class="is-off">Champions</span>');
    expect(card('wrc')).toContain('<b>WRC</b>');
    expect(card('wrc')).toContain('<a href="/calendar/#wrc">Calendar</a><span class="is-off">Standings</span><span class="is-off">Results</span>');
  });

  it('holds every next round as a hidden weekend card, the section hidden until the script finds this weekend', () => {
    expect(b).toContain('<section class="pd-sx-sec pd-sx-weekend" hidden>');
    expect([...b.matchAll(/<article class="pd-sx-wk" data-from="([\d-]+)" data-to="([\d-]+)"[^>]*hidden><header><b>([^<]+)<\/b>/g)].map(m => `${m[3]} ${m[1]}`)).toEqual(['Formula 1 2026-05-08', 'WRC 2026-05-08']);
    expect(b).toContain('<div class="pd-sx-ctl" hidden>');
  });

  it('dates a one-day round once, and reads it This weekend from that weekend’s Friday', () => {
    const day = seriesList([{ ...base, slug: 'nascar-cup', name: 'NASCAR Cup', category: 'stock', colour: '#facc15', order: 8, rounds: [{ round: 1, name: 'YellaWood 500', startDate: '2026-05-10', endDate: '2026-05-10', venue: null }], results: [] }], now).body;
    expect(day.match(/<span>10 May<\/span>/g)).toHaveLength(2);
    expect(day).not.toContain('10–10 May');
    // A Sunday race: the card's label from Friday 8 May, the weekend card on its own date.
    expect(day).toContain('<span class="pd-wk" data-from="2026-05-08" data-to="2026-05-10" data-on="This weekend">Next</span>');
    expect(day).toContain('<article class="pd-sx-wk" data-from="2026-05-10" data-to="2026-05-10"');
  });

  it('keeps feed and content text as text and a bad colour out of the style, and writes the same page all day', () => {
    expect(b).toContain('NLS &lt;b&gt;Nürburgring&lt;/b&gt;');
    expect(card('nls')).toContain('style="--t:#9aa3b2"');
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-05-09T12:00:00Z'));
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
