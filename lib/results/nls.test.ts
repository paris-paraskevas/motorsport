import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  fetchNlsSeasonResults,
  parseNlsCalendar,
  parseNlsSeasonResults,
  parseNlsDate,
} from './nls';

const FIXTURE_DIR = join(__dirname, '..', '..', 'tests', 'fixtures');
const seasonHtml = readFileSync(
  join(FIXTURE_DIR, 'nls-season-2026.html'),
  'utf-8',
);

describe('parseNlsDate', () => {
  it('parses a bare day-month', () => {
    const d = parseNlsDate('14 March', 2026);
    expect(d!.toISOString().slice(0, 10)).toBe('2026-03-14');
  });

  it('parses a day range, taking the first day', () => {
    const d = parseNlsDate('18–19 April', 2026);
    expect(d!.toISOString().slice(0, 10)).toBe('2026-04-18');
  });

  it('returns null on garbage', () => {
    expect(parseNlsDate('not a date', 2026)).toBeNull();
  });
});

describe('parseNlsCalendar', () => {
  it('reads numeric round + event label + date for every calendar row', () => {
    const rows = parseNlsCalendar(seasonHtml, 2026);
    expect(rows.length).toBeGreaterThanOrEqual(8);

    const r1 = rows.find(r => r.round === 1)!;
    expect(r1.label).toBe('NLS1');
    expect(r1.raceName).toContain('Westfalenfahrt');
    expect(r1.date.toISOString().slice(0, 10)).toBe('2026-03-14');

    // The 24h qualifier rounds keep their non-"NLSn" labels.
    const q1 = rows.find(r => r.label === '24H-Q1');
    expect(q1).toBeDefined();
    expect(q1!.round).toBe(4);
  });
});

describe('parseNlsSeasonResults', () => {
  it('reads the overall WINNER crew + entrant (not pole) per round', () => {
    const winners = parseNlsSeasonResults(seasonHtml);

    const nls2 = winners.find(w => w.label === 'NLS2')!;
    expect(nls2.winnerTeam).toContain('Rowe Racing');
    // Winner crew from the sub-row's winner column — NOT the pole crew
    // (Verstappen / Gounon / Juncadella).
    expect(nls2.winnerDrivers).toContain('Dan Harper');
    expect(nls2.winnerDrivers).toContain('Jordan Pepper');
    expect(nls2.winnerDrivers).not.toContain('Verstappen');

    const nls6 = winners.find(w => w.label === 'NLS6')!;
    expect(nls6.winnerTeam).toContain('Dunlop');
    expect(nls6.winnerDrivers).toContain('Nico Menzel');
    expect(nls6.winnerDrivers).toContain('Sven M');
  });

  it('emits empty winner for cancelled/abandoned rounds', () => {
    const winners = parseNlsSeasonResults(seasonHtml);
    // NLS1 was cancelled (weather); 24H-Q1 abandoned (driver death). Both have
    // no winner columns.
    const nls1 = winners.find(w => w.label === 'NLS1');
    expect(nls1).toBeDefined();
    expect(nls1!.winnerDrivers).toBe('');
    expect(nls1!.winnerTeam).toBe('');
  });

  it('returns empty for HTML without a Results section', () => {
    expect(parseNlsSeasonResults('<html></html>')).toEqual([]);
  });
});

describe('fetchNlsSeasonResults', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('emits winners-only RaceResults keyed to numeric rounds', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        ({ ok: true, status: 200, text: async () => seasonHtml }) as Response,
    ) as unknown as typeof fetch;

    const races = await fetchNlsSeasonResults(2026);
    expect(races.length).toBeGreaterThanOrEqual(3);

    // Every emitted race is winners-only: exactly one entry, status "Winner",
    // zero points (NLS carries no championship points).
    for (const r of races) {
      expect(r.results).toHaveLength(1);
      expect(r.results[0].status).toBe('Winner');
      expect(r.results[0].points).toBe(0);
      expect(r.results[0].position).toBe(1);
    }

    // Cancelled/abandoned rounds (NLS1, 24H-Q1) are dropped — no winner.
    const rounds = races.map(r => r.round);
    expect(rounds).not.toContain(1); // NLS1 cancelled

    // NLS2 (round 2) is present with the Rowe crew.
    const nls2 = races.find(r => r.round === 2)!;
    expect(nls2).toBeDefined();
    expect(nls2.results[0].team).toContain('Rowe Racing');
    expect(nls2.results[0].driverName).toContain('Dan Harper');

    // Sorted ascending by round.
    const sorted = [...rounds].sort((a, b) => a - b);
    expect(rounds).toEqual(sorted);
  });

  it('returns [] when the season page fetch fails', async () => {
    globalThis.fetch = vi.fn(
      async () => ({ ok: false, status: 500, text: async () => '' }) as Response,
    ) as unknown as typeof fetch;
    expect(await fetchNlsSeasonResults(2026)).toEqual([]);
  });
});
