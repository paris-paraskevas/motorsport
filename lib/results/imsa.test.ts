import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchImsaRoundResults,
  fetchImsaSeasonResults,
} from './imsa';
import manifest from '@/content/series/imsa/alkamel-rounds.json';

// Real-fixture-driven tests. Every fixture under `tests/fixtures/` was
// captured directly from `imsa.results.alkamelcloud.com` during the
// 2026-05-22 probe (see CHANGELOG 0.12.11 + `docs/HANDOFF.md`). Using real
// upstream payloads catches schema quirks that synthetic JSON misses — the
// 0.11.x regressions (FE colspan, WRC mw-heading) that survived synthetic
// fixtures motivated this rule.
const FIXTURE_DIR = path.join(process.cwd(), 'tests', 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

function mockFetchText(text: string) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => text,
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

function mockFetchByUrl(map: Record<string, string>) {
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    const body = map[url];
    if (body === undefined) {
      return Promise.resolve({
        ok: false,
        status: 404,
        text: async () => 'not found',
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => body,
    } as Response);
  }) as unknown as typeof fetch;
}

describe('fetchImsaRoundResults — Daytona (full IMEC field)', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    mockFetchText(loadFixture('imsa-results-daytona-2026.json'));
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses all four classes', async () => {
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    expect(result).not.toBeNull();
    expect(result!.round).toBe(1);
    expect(result!.eventName).toBe('Rolex 24 at Daytona');
    expect(result!.circuit).toBe('Daytona International Speedway');
    expect(Object.keys(result!.perClass).sort()).toEqual([
      'GTD',
      'GTD Pro',
      'GTP',
      'LMP2',
    ]);
  });

  it('normalises GTDPRO → "GTD Pro"', async () => {
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    expect(result!.perClass['GTD Pro']).toBeDefined();
    expect(result!.perClass['GTD Pro']!.length).toBeGreaterThan(0);
  });

  it('emits GTP winner as #7 Porsche Penske Motorsport with three drivers space-joined', async () => {
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    const gtpWinner = result!.perClass.GTP![0];
    expect(gtpWinner.position).toBe(1);
    expect(gtpWinner.carNumber).toBe('7');
    expect(gtpWinner.team).toBe('Porsche Penske Motorsport');
    expect(gtpWinner.drivers).toBe('Felipe Nasr Julien Andlauer Laurin Heinrich');
    expect(gtpWinner.vehicle).toBe('Porsche 963');
    expect(gtpWinner.manufacturer).toBe('Porsche');
    expect(gtpWinner.gap).toBe('');
    expect(gtpWinner.elapsedTime).toBe('24:01:20.108');
  });

  it('preserves the leading zero in #04 (LMP2 winner)', async () => {
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    const lmp2Winner = result!.perClass.LMP2![0];
    expect(lmp2Winner.carNumber).toBe('04');
    expect(lmp2Winner.team).toBe('Crowdstrike Racing by APR');
  });

  it('records gap_first for the runner-up', async () => {
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    const gtpRunnerUp = result!.perClass.GTP![1];
    expect(gtpRunnerUp.position).toBe(2);
    expect(gtpRunnerUp.gap).toBe('+1.569');
  });

  it('parses the event date as 24 Jan 2026 (UTC) ignoring the upstream HH:MM', async () => {
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    expect(result!.date.toISOString().startsWith('2026-01-24')).toBe(true);
  });

  it('accepts slash-separated dates — Detroit 2026 filed "30/05/2026" and the dash-only regex dropped the round', async () => {
    const slashFixture = loadFixture('imsa-results-daytona-2026.json').replace(
      /"session_date":\s*"24-01-2026/,
      '"session_date": "30/05/2026',
    );
    mockFetchText(slashFixture);
    const result = await fetchImsaRoundResults('https://example.test/race.json', 5);
    expect(result).not.toBeNull();
    expect(result!.date.toISOString().startsWith('2026-05-30')).toBe(true);
  });

  it('strips the UTF-8 BOM before parsing', async () => {
    const fixture = loadFixture('imsa-results-daytona-2026.json');
    expect(fixture.charCodeAt(0)).toBe(0xfeff);
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    expect(result).not.toBeNull();
  });
});

describe('fetchImsaRoundResults — Sebring (Not Started entry)', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    mockFetchText(loadFixture('imsa-results-sebring-2026.json'));
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('preserves "Not Started" status verbatim and records zero laps', async () => {
    const result = await fetchImsaRoundResults('https://example.test/race.json', 2);
    const dns = result!.perClass.LMP2!.find(e => e.status === 'Not Started');
    expect(dns).toBeDefined();
    expect(dns!.laps).toBe(0);
    expect(dns!.position).toBe(12);
  });
});

describe('fetchImsaRoundResults — Long Beach (sprint, GTP+GTD only)', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    mockFetchText(loadFixture('imsa-results-longbeach-2026.json'));
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('omits LMP2 + GTD Pro from sprint-round perClass map', async () => {
    const result = await fetchImsaRoundResults('https://example.test/race.json', 3);
    expect(result!.perClass.GTP).toBeDefined();
    expect(result!.perClass.GTD).toBeDefined();
    expect(result!.perClass.LMP2).toBeUndefined();
    expect(result!.perClass['GTD Pro']).toBeUndefined();
  });

  it('emits GTP winner #93 Acura with two-driver crew', async () => {
    const result = await fetchImsaRoundResults('https://example.test/race.json', 3);
    const winner = result!.perClass.GTP![0];
    expect(winner.carNumber).toBe('93');
    expect(winner.drivers).toBe('Renger van der Zande Nick Yelloly');
  });
});

describe('fetchImsaRoundResults — Laguna Seca (LMP2 absent, GTD Pro present)', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    mockFetchText(loadFixture('imsa-results-lagunaseca-2026.json'));
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('emits three classes (no LMP2 — Monterey is not an IMEC round)', async () => {
    const result = await fetchImsaRoundResults('https://example.test/race.json', 4);
    expect(result!.perClass.GTP).toBeDefined();
    expect(result!.perClass['GTD Pro']).toBeDefined();
    expect(result!.perClass.GTD).toBeDefined();
    expect(result!.perClass.LMP2).toBeUndefined();
  });
});

describe('fetchImsaRoundResults — error paths', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns null on 500', async () => {
    mockFetch500();
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    expect(result).toBeNull();
  });

  it('returns null on network failure', async () => {
    mockFetchReject();
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    expect(result).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    mockFetchText('not actually json {{{');
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    expect(result).toBeNull();
  });

  it('returns null when the JSON shape is missing classifications', async () => {
    mockFetchText('{"session": {"event_name": "X"}}');
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    expect(result).toBeNull();
  });

  it('returns null when no recognised class names appear', async () => {
    mockFetchText(
      JSON.stringify({
        session: {
          event_name: 'X',
          session_date: '01-01-2026 00:00',
          circuit: { name: 'X' },
        },
        classifications: [
          { name: 'Unknown', classification: [{ position: 1 }] },
        ],
      }),
    );
    const result = await fetchImsaRoundResults('https://example.test/race.json', 1);
    expect(result).toBeNull();
  });
});

describe('fetchImsaSeasonResults — aggregates manifest rounds', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns rounds ordered by round number, skipping any that fail to fetch', async () => {
    const daytona = loadFixture('imsa-results-daytona-2026.json');
    const longbeach = loadFixture('imsa-results-longbeach-2026.json');
    const r1 = manifest.rounds.find(r => r.round === 1)!;
    const r3 = manifest.rounds.find(r => r.round === 3)!;
    // Only return success for R1 + R3; R2 + R4 will 404 → null → skipped.
    mockFetchByUrl({
      [r1.url]: daytona,
      [r3.url]: longbeach,
    });
    const results = await fetchImsaSeasonResults();
    expect(results.map(r => r.round)).toEqual([1, 3]);
    expect(results[0].eventName).toBe('Rolex 24 at Daytona');
    expect(results[1].eventName).toBe('Acura Grand Prix of Long Beach');
  });
});
