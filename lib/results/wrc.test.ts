import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  fetchWRCSeasonResults,
  parseCalendarFromHtml,
  parseSeasonSummaryFromHtml,
  parseRallyClassificationFromHtml,
  parseSeasonChartPointsFromHtml,
  parseRallyDate,
  parseSeasonResultsFromHtml,
} from './wrc';

const FIXTURE_DIR = join(__dirname, '..', '..', 'tests', 'fixtures');

const load = (slug: string) =>
  readFileSync(join(FIXTURE_DIR, `wrc-${slug}-2026.html`), 'utf-8');

const seasonHtml = load('season');
const rallyHtmls: Record<string, string> = {
  'monte-carlo': load('rally-monte-carlo'),
  sweden: load('rally-sweden'),
  safari: load('rally-safari'),
  croatia: load('rally-croatia'),
  canarias: load('rally-canarias'),
  portugal: load('rally-portugal'),
};

describe('parseRallyDate', () => {
  it('parses "22–25 January" style ranges', () => {
    const d = parseRallyDate('22–25 January', 2026);
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe('2026-01-22');
  });

  it('parses "January 22-25" inversed', () => {
    const d = parseRallyDate('January 22-25', 2026);
    expect(d!.toISOString().slice(0, 10)).toBe('2026-01-22');
  });

  it('parses a bare day-month', () => {
    const d = parseRallyDate('12 March', 2026);
    expect(d!.toISOString().slice(0, 10)).toBe('2026-03-12');
  });

  it('returns null on garbage', () => {
    expect(parseRallyDate('not a date', 2026)).toBeNull();
  });
});

describe('parseCalendarFromHtml', () => {
  it('reads all 14 rounds from the 2026 season fixture', () => {
    const rows = parseCalendarFromHtml(seasonHtml, 2026);
    expect(rows).toHaveLength(14);
    expect(rows[0].round).toBe(1);
    expect(rows[0].rallyName).toBe('Rallye Automobile Monte Carlo');
    expect(rows[0].date.toISOString().slice(0, 10)).toBe('2026-01-22');
    expect(rows[5].rallyName).toBe('Rally de Portugal');
    expect(rows[5].date.toISOString().slice(0, 10)).toBe('2026-05-07');
  });
});

describe('parseSeasonSummaryFromHtml', () => {
  it('reads completed rounds with winner + per-rally URL', () => {
    const rows = parseSeasonSummaryFromHtml(seasonHtml);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    const r1 = rows.find(r => r.round === 1)!;
    expect(r1.winnerName).toBe('Oliver Solberg');
    expect(r1.coDriverName).toBe('Elliott Edmondson');
    expect(r1.team).toBe('Toyota Gazoo Racing WRT');
    expect(r1.perRallyUrl).toBe(
      'https://en.wikipedia.org/wiki/2026_Monte_Carlo_Rally',
    );
  });

  it('marks upcoming rounds with winnerName=null', () => {
    const rows = parseSeasonSummaryFromHtml(seasonHtml);
    const r7 = rows.find(r => r.round === 7);
    expect(r7).toBeDefined();
    expect(r7!.winnerName).toBeNull();
  });
});

describe('parseRallyClassificationFromHtml', () => {
  it('Portugal: Neuville P1 with 30 pts (15+1+4 sub-totals)', () => {
    const entries = parseRallyClassificationFromHtml(rallyHtmls.portugal);
    expect(entries.length).toBeGreaterThanOrEqual(5);
    expect(entries[0]).toMatchObject({
      position: 1,
      driverName: 'Thierry Neuville',
      team: 'Hyundai Shell Mobis WRT',
      points: 30,
      status: 'Finished',
    });
    expect(entries[1].driverName).toBe('Oliver Solberg');
    expect(entries[1].points).toBe(24);
  });

  it('Canarias: P1 Ogier scores 32 (25+4+3)', () => {
    const entries = parseRallyClassificationFromHtml(rallyHtmls.canarias);
    expect(entries[0]).toMatchObject({
      position: 1,
      driverName: 'Sébastien Ogier',
      points: 32,
    });
  });

  it('uses class position (not overall) for Rally1 drivers who crashed', () => {
    // Croatia: Solberg finished P42 overall but P8 in Rally1. Parser must
    // surface P8 because this table is filtered to WRC Rally1.
    const entries = parseRallyClassificationFromHtml(rallyHtmls.croatia);
    const solberg = entries.find(e => e.driverName === 'Oliver Solberg');
    // Solberg's class position at Croatia was P8 (Wikipedia 2026 data).
    expect(solberg).toBeDefined();
    expect(solberg!.position).toBeLessThan(20); // class position, not overall
  });

  it('surfaces retired entries with status starting "Retired"', () => {
    // Canarias has 4-5 retired Rally1 entries (Solberg / Paddon / Neuville /
    // Fourmaux / Katsuta all hit trouble in 2026).
    const entries = parseRallyClassificationFromHtml(rallyHtmls.canarias);
    const retired = entries.filter(e => /retired/i.test(e.status));
    expect(retired.length).toBeGreaterThan(0);
    for (const r of retired) {
      expect(r.points).toBe(0);
    }
  });

  it('returns empty for HTML without a WRC Rally1 section', () => {
    expect(parseRallyClassificationFromHtml('<html></html>')).toEqual([]);
  });
});

describe('parseSeasonChartPointsFromHtml', () => {
  it('returns one round per completed rally', () => {
    const races = parseSeasonChartPointsFromHtml(seasonHtml, 2026);
    expect(races).toHaveLength(6);
    expect(races.map(r => r.round)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('per-driver sums reconcile to the standings table totals', async () => {
    const races = parseSeasonChartPointsFromHtml(seasonHtml, 2026);
    const { parseStandingsFromHtml } = await import('../standings/wrc');
    const standings = parseStandingsFromHtml(seasonHtml);
    expect(standings).not.toBeNull();

    const summed = new Map<string, number>();
    for (const r of races) {
      for (const e of r.results) {
        summed.set(e.driverName, (summed.get(e.driverName) ?? 0) + e.points);
      }
    }
    for (const d of standings!.drivers) {
      const total = summed.get(d.driverName) ?? 0;
      expect({ driver: d.driverName, total }).toEqual({
        driver: d.driverName,
        total: d.points,
      });
    }
  });
});

describe('parseSeasonResultsFromHtml (legacy winners-only fallback)', () => {
  it('emits one winner entry per completed round', () => {
    const races = parseSeasonResultsFromHtml(seasonHtml, 2026);
    expect(races).toHaveLength(6);
    expect(races[0].results).toHaveLength(1);
    expect(races[0].results[0]).toMatchObject({
      position: 1,
      driverName: 'Oliver Solberg / Elliott Edmondson',
      team: 'Toyota Gazoo Racing WRT',
      points: 25,
      status: 'Winner',
    });
  });
});

describe('fetchWRCSeasonResults', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fans out per-rally fetches and returns full classifications', async () => {
    // Mock: season URL returns the season HTML; per-rally URLs return the
    // matching rally HTML.
    const urlToHtml = new Map<string, string>([
      ['https://en.wikipedia.org/wiki/2026_World_Rally_Championship', seasonHtml],
      ['https://en.wikipedia.org/wiki/2026_Monte_Carlo_Rally', rallyHtmls['monte-carlo']],
      ['https://en.wikipedia.org/wiki/2026_Rally_Sweden', rallyHtmls.sweden],
      ['https://en.wikipedia.org/wiki/2026_Safari_Rally', rallyHtmls.safari],
      ['https://en.wikipedia.org/wiki/2026_Croatia_Rally', rallyHtmls.croatia],
      ['https://en.wikipedia.org/wiki/2026_Rally_Islas_Canarias', rallyHtmls.canarias],
      ['https://en.wikipedia.org/wiki/2026_Rally_de_Portugal', rallyHtmls.portugal],
    ]);
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const html = urlToHtml.get(url);
      return {
        ok: html !== undefined,
        status: html ? 200 : 404,
        text: async () => html ?? '',
      } as Response;
    }) as unknown as typeof fetch;

    const races = await fetchWRCSeasonResults(2026);
    expect(races).toHaveLength(6);
    expect(races[0].round).toBe(1);
    expect(races[0].results.length).toBeGreaterThan(1);
    // Portugal at R6 — Neuville winner with 30 pts.
    const portugal = races.find(r => r.round === 6)!;
    expect(portugal.results[0].driverName).toBe('Thierry Neuville');
    expect(portugal.results[0].points).toBe(30);
  });

  it('falls back to winners-only entries when a per-rally page is unreachable', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === 'https://en.wikipedia.org/wiki/2026_World_Rally_Championship') {
        return { ok: true, status: 200, text: async () => seasonHtml } as Response;
      }
      return { ok: false, status: 404, text: async () => '' } as Response;
    }) as unknown as typeof fetch;

    const races = await fetchWRCSeasonResults(2026);
    expect(races).toHaveLength(6);
    // Each falls back to a single-entry winners-only row.
    for (const r of races) {
      expect(r.results).toHaveLength(1);
      expect(r.results[0].status).toBe('Winner');
    }
  });

  it('returns [] when the season page fetch itself fails', async () => {
    globalThis.fetch = vi.fn(async () =>
      ({ ok: false, status: 500, text: async () => '' }) as Response,
    ) as unknown as typeof fetch;
    const races = await fetchWRCSeasonResults(2026);
    expect(races).toEqual([]);
  });
});
