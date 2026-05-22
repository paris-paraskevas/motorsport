import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  fetchNascarCupSeasonResults,
  parseRaceResultsHtml,
  parseSeasonRaceLinks,
} from './nascar-cup';

// Real-fixture-driven tests. Fixtures captured from Wikipedia per-race
// articles during the 2026-05-22 prod-regression fallback probe (see
// CHANGELOG 0.12.12.1). Racing-reference was the original Phase-1 source
// but its Cloudflare WAF challenges Vercel datacenter IPs — Wikipedia is
// the working alternative.
const FIXTURE_DIR = path.join(process.cwd(), 'tests', 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

const ROUNDS_FIXTURE = [
  { round: 1, startDate: '2026-02-15', name: 'Daytona 500' },
  { round: 11, startDate: '2026-05-03', name: 'Wurth 400' },
];

describe('parseSeasonRaceLinks — 2026 NASCAR Cup season page', () => {
  it('enumerates per-race article URLs from the season schedule table', () => {
    const html = loadFixture('nascar-cup-wiki-season-2026.html');
    const links = parseSeasonRaceLinks(html);
    expect(links.length).toBeGreaterThanOrEqual(12);
    const daytona = links.find(l => l.url.endsWith('/wiki/2026_Daytona_500'));
    expect(daytona).toBeDefined();
    expect(daytona!.round).toBe(1);
    const wurth = links.find(l => l.url.includes('W%C3%BCrth_400'));
    expect(wurth).toBeDefined();
    expect(wurth!.round).toBe(11);
  });

  it('skips preseason rows (Clash, Duels) — they have no integer round number', () => {
    const html = loadFixture('nascar-cup-wiki-season-2026.html');
    const links = parseSeasonRaceLinks(html);
    const hasClash = links.some(l => l.url.includes('Cook_Out_Clash'));
    const hasDuel = links.some(l => l.url.includes('Florida_Duel'));
    expect(hasClash).toBe(false);
    expect(hasDuel).toBe(false);
  });
});

describe('parseRaceResultsHtml — Daytona 500 (3 matching tables, picks the biggest)', () => {
  const html = loadFixture('nascar-cup-wiki-daytona500-2026.html');

  it('picks the 41-car race table (not the 24-car Duel tables)', () => {
    const entries = parseRaceResultsHtml(html);
    expect(entries.length).toBeGreaterThanOrEqual(38);
    expect(entries.length).toBeLessThanOrEqual(42);
  });

  it('emits Tyler Reddick at P1 (#45, 23XI Racing, 58 pts)', () => {
    const entries = parseRaceResultsHtml(html);
    const winner = entries[0];
    expect(winner.position).toBe(1);
    expect(winner.driverName).toBe('Tyler Reddick');
    expect(winner.driverCode).toBe('45');
    expect(winner.team).toBe('23XI Racing');
    expect(winner.points).toBe(58);
  });

  it('emits Joey Logano at P3 (#22, Team Penske)', () => {
    const entries = parseRaceResultsHtml(html);
    const p3 = entries[2];
    expect(p3.driverName).toBe('Joey Logano');
    expect(p3.team).toBe('Team Penske');
  });
});

describe('parseRaceResultsHtml — Wurth 400 (single race table)', () => {
  const html = loadFixture('nascar-cup-wiki-wurth-2026.html');

  it('parses ~38 entries with Chase Elliott as P1', () => {
    const entries = parseRaceResultsHtml(html);
    expect(entries.length).toBeGreaterThanOrEqual(35);
    const winner = entries[0];
    expect(winner.driverName).toBe('Chase Elliott');
    expect(winner.driverCode).toBe('9');
    expect(winner.team).toBe('Hendrick Motorsports');
    expect(winner.points).toBe(69);
  });
});

describe('parseRaceResultsHtml — defensive parsing', () => {
  it('returns empty array when no race-results-shaped wikitable is present', () => {
    expect(parseRaceResultsHtml('<html><body></body></html>')).toEqual([]);
  });

  it('returns empty array when the table header lacks Points column', () => {
    const html =
      '<html><body><table class="wikitable"><tr><th>Pos</th><th>Driver</th><th>Team</th><th>Manufacturer</th><th>Laps</th></tr><tr><td>1</td><td>X</td><td>Y</td><td>Z</td><td>200</td></tr></table></body></html>';
    expect(parseRaceResultsHtml(html)).toEqual([]);
  });
});

describe('fetchNascarCupSeasonResults — full pipeline (injected fetch)', () => {
  function fetcherFromMap(map: Record<string, string>) {
    return async (url: string) => {
      const body = map[url];
      if (body === undefined) return { status: 404, body: 'not found' };
      return { status: 200, body };
    };
  }

  it('fetches the season page then per-race pages, returns rounds in order', async () => {
    const seasonHtml = loadFixture('nascar-cup-wiki-season-2026.html');
    const daytonaHtml = loadFixture('nascar-cup-wiki-daytona500-2026.html');
    const wurthHtml = loadFixture('nascar-cup-wiki-wurth-2026.html');
    const results = await fetchNascarCupSeasonResults({
      rounds: ROUNDS_FIXTURE,
      fetchImpl: fetcherFromMap({
        'https://en.wikipedia.org/wiki/2026_NASCAR_Cup_Series': seasonHtml,
        'https://en.wikipedia.org/wiki/2026_Daytona_500': daytonaHtml,
        'https://en.wikipedia.org/wiki/2026_W%C3%BCrth_400': wurthHtml,
      }),
    });
    expect(results.map(r => r.round)).toEqual([1, 11]);
    expect(results[0].raceName).toContain('Daytona 500');
    expect(results[0].results.length).toBeGreaterThanOrEqual(38);
    expect(results[1].raceName).toContain('Würth 400');
  });

  it('returns [] when the season fetch fails', async () => {
    const results = await fetchNascarCupSeasonResults({
      rounds: ROUNDS_FIXTURE,
      fetchImpl: async () => ({ status: 500, body: '' }),
    });
    expect(results).toEqual([]);
  });

  it('returns [] when the season page has no race links', async () => {
    const results = await fetchNascarCupSeasonResults({
      rounds: ROUNDS_FIXTURE,
      fetchImpl: async () => ({
        status: 200,
        body: '<html><body><p>no races</p></body></html>',
      }),
    });
    expect(results).toEqual([]);
  });

  it('skips races without a rounds.json entry (round date missing)', async () => {
    const seasonHtml = loadFixture('nascar-cup-wiki-season-2026.html');
    const daytonaHtml = loadFixture('nascar-cup-wiki-daytona500-2026.html');
    const results = await fetchNascarCupSeasonResults({
      // omit R1 → fetcher fetches Daytona but buildRaceResultFromPage returns
      // null because parseDateFromRoundsLookup can't find round=1.
      rounds: ROUNDS_FIXTURE.filter(r => r.round !== 1),
      fetchImpl: fetcherFromMap({
        'https://en.wikipedia.org/wiki/2026_NASCAR_Cup_Series': seasonHtml,
        'https://en.wikipedia.org/wiki/2026_Daytona_500': daytonaHtml,
      }),
    });
    expect(results).toEqual([]);
  });
});
