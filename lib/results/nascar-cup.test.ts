import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  fetchNascarCupSeasonResults,
  parseRaceResultsHtml,
  parseSeasonRaceLinks,
} from './nascar-cup';

// Real-fixture-driven tests. Every fixture under `tests/fixtures/` was
// captured directly from racing-reference.info during the 2026-05-22 probe
// (see CHANGELOG 0.12.12 + `docs/HANDOFF.md`). The previous synthetic
// Wikipedia HTML tests were tied to the winners-only Wikipedia parser
// — they don't apply to the racing-reference full-class parser this file
// supersedes.
const FIXTURE_DIR = path.join(process.cwd(), 'tests', 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

const ROUNDS_FIXTURE = [
  { round: 1, startDate: '2026-02-15', name: 'Daytona 500' },
  { round: 2, startDate: '2026-02-22', name: 'Autotrader EchoPark Speedway 400' },
  { round: 3, startDate: '2026-03-01', name: 'DuraMax Texas Grand Prix' },
  { round: 4, startDate: '2026-03-08', name: 'Straight Talk Wireless 500' },
  { round: 5, startDate: '2026-03-15', name: 'Pennzoil 400' },
  { round: 6, startDate: '2026-03-22', name: 'Goodyear 400' },
  { round: 7, startDate: '2026-03-29', name: 'Cook Out 400' },
  { round: 8, startDate: '2026-04-05', name: 'Food City 500' },
  { round: 9, startDate: '2026-04-12', name: 'AdventHealth 400' },
  { round: 10, startDate: '2026-04-19', name: 'Jack Links 500' },
  { round: 11, startDate: '2026-05-03', name: 'Wurth 400' },
  { round: 12, startDate: '2026-05-10', name: 'Go Bowling at The Glen' },
];

describe('parseSeasonRaceLinks — racing-reference season-stats index', () => {
  it('enumerates every completed 2026 Cup race with its round number', () => {
    const html = loadFixture('nascar-cup-season-2026.html');
    const links = parseSeasonRaceLinks(html);
    expect(links).toHaveLength(12);
    expect(links[0]).toEqual({
      round: 1,
      url: 'https://www.racing-reference.info/race-results/2026_Daytona_500/W',
    });
    expect(links[11].round).toBe(12);
    expect(links[11].url).toContain('Go_Bowling_at_The_Glen');
  });

  it('deduplicates anchor occurrences (sidebar + main table both link to each race)', () => {
    const html = loadFixture('nascar-cup-season-2026.html');
    const links = parseSeasonRaceLinks(html);
    const urls = links.map(l => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('parseRaceResultsHtml — Daytona 500 (Tyler Reddick win)', () => {
  const html = loadFixture('nascar-cup-daytona500-2026.html');

  it('parses the full 41-car field', () => {
    const entries = parseRaceResultsHtml(html);
    expect(entries).toHaveLength(41);
  });

  it('emits Tyler Reddick as P1 (#45 / 23XI Racing / 58 pts / running)', () => {
    const entries = parseRaceResultsHtml(html);
    const winner = entries[0];
    expect(winner.position).toBe(1);
    expect(winner.driverName).toBe('Tyler Reddick');
    expect(winner.driverCode).toBe('45');
    expect(winner.team).toBe('23XI Racing');
    expect(winner.points).toBe(58);
    expect(winner.status).toBe('running');
  });

  it('extracts the owner-team from "Sponsor (Owner)" cells', () => {
    const entries = parseRaceResultsHtml(html);
    const p3 = entries[2];
    expect(p3.driverName).toBe('Joey Logano');
    expect(p3.team).toBe('Roger Penske');
  });

  it('preserves lowercase status tokens (e.g. "crash" for DNFs)', () => {
    const entries = parseRaceResultsHtml(html);
    const last = entries[entries.length - 1];
    expect(last.position).toBe(41);
    expect(last.status).toBe('crash');
    expect(last.points).toBe(1);
  });
});

describe('parseRaceResultsHtml — Wurth 400 (Chase Elliott win)', () => {
  const html = loadFixture('nascar-cup-wurth400-2026.html');

  it('parses a 38-car field', () => {
    const entries = parseRaceResultsHtml(html);
    expect(entries).toHaveLength(38);
  });

  it('emits Chase Elliott as P1 (#9 / Rick Hendrick / 69 pts)', () => {
    const entries = parseRaceResultsHtml(html);
    const winner = entries[0];
    expect(winner.driverName).toBe('Chase Elliott');
    expect(winner.driverCode).toBe('9');
    expect(winner.team).toBe('Rick Hendrick');
    expect(winner.points).toBe(69);
  });

  it('emits Denny Hamlin as P2 (Joe Gibbs owner team)', () => {
    const entries = parseRaceResultsHtml(html);
    expect(entries[1].driverName).toBe('Denny Hamlin');
    expect(entries[1].team).toBe('Joe Gibbs');
  });

  it('total points awarded equals 763 (race-weekend total, sanity floor)', () => {
    const entries = parseRaceResultsHtml(html);
    const total = entries.reduce((sum, e) => sum + e.points, 0);
    expect(total).toBe(763);
  });
});

describe('parseRaceResultsHtml — defensive parsing', () => {
  it('returns empty array when the race-results-tbl is absent', () => {
    expect(parseRaceResultsHtml('<html><body></body></html>')).toEqual([]);
  });

  it('skips rows whose position cell is non-numeric', () => {
    const entries = parseRaceResultsHtml(
      '<table class="race-results-tbl"><tr><th>Pos</th><th>St</th><th>#</th><th>Driver</th><th>Sponsor / Owner</th><th>Car</th><th>Laps</th><th>Status</th><th>Led</th><th>Pts</th></tr><tr><td>—</td><td>1</td><td>1</td><td>x</td><td>Sponsor (Team)</td><td>Ford</td><td>0</td><td>dnf</td><td>0</td><td>0</td></tr></table>',
    );
    expect(entries).toEqual([]);
  });
});

describe('fetchNascarCupSeasonResults — full pipeline', () => {
  function transportFromMap(
    map: Record<string, string>,
  ): (pathname: string) => Promise<{ status: number; body: string }> {
    return async pathname => {
      const body = map[pathname];
      if (body === undefined) {
        return { status: 404, body: 'not found' };
      }
      return { status: 200, body };
    };
  }

  it('fetches the season index then per-race pages, returns rounds in order', async () => {
    const seasonHtml = loadFixture('nascar-cup-season-2026.html');
    const daytonaHtml = loadFixture('nascar-cup-daytona500-2026.html');
    const wurthHtml = loadFixture('nascar-cup-wurth400-2026.html');
    const results = await fetchNascarCupSeasonResults({
      rounds: ROUNDS_FIXTURE,
      transport: transportFromMap({
        '/season-stats/2026/W/': seasonHtml,
        '/race-results/2026_Daytona_500/W': daytonaHtml,
        '/race-results/2026_Wurth_400/W': wurthHtml,
      }),
    });
    expect(results.map(r => r.round)).toEqual([1, 11]);
    expect(results[0].raceName).toBe('Daytona 500');
    expect(results[0].results).toHaveLength(41);
    expect(results[1].raceName).toBe('Wurth 400 Presented by LIQUI MOLY');
    expect(results[1].results).toHaveLength(38);
  });

  it('returns [] when the season index fetch fails', async () => {
    const results = await fetchNascarCupSeasonResults({
      rounds: ROUNDS_FIXTURE,
      transport: async () => ({ status: 500, body: 'err' }),
    });
    expect(results).toEqual([]);
  });

  it('returns [] when the season index has no race links', async () => {
    const results = await fetchNascarCupSeasonResults({
      rounds: ROUNDS_FIXTURE,
      transport: async () => ({
        status: 200,
        body: '<html><body><p>no races yet</p></body></html>',
      }),
    });
    expect(results).toEqual([]);
  });

  it('skips a race whose round number has no rounds.json entry', async () => {
    const seasonHtml = loadFixture('nascar-cup-season-2026.html');
    const daytonaHtml = loadFixture('nascar-cup-daytona500-2026.html');
    // rounds.json fixture omits R1 — round-1 race should drop, not crash.
    const results = await fetchNascarCupSeasonResults({
      rounds: ROUNDS_FIXTURE.filter(r => r.round !== 1),
      transport: transportFromMap({
        '/season-stats/2026/W/': seasonHtml,
        '/race-results/2026_Daytona_500/W': daytonaHtml,
      }),
    });
    expect(results).toEqual([]);
  });
});
