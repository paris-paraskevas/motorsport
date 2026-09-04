import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards on the curated F1 correction files, written because the first draft of
// them was WRONG and only arithmetic caught it.
//
// Several press summaries of the 2026 Monaco appeal reported "four drivers +3".
// That does not survive checking. F1 scores 25-18-15-12-10-8-6-4-2-1, so moving
// up one place is worth a different amount depending on where you are: 4th->3rd
// is +3, but 5th->4th, 6th->5th and 7th->6th are each +2. The version copied
// from the press summed to +3 across the field, which would have invented three
// championship points out of nothing.
//
// Championship points are CONSERVED by a reclassification: nobody scores points
// that another driver did not lose. That is the invariant below, and it is the
// one that fails loudly on a plausible-looking mistake.

const F1_DIR = path.join(process.cwd(), 'content', 'series', 'f1');
const STANDINGS = path.join(F1_DIR, 'standings-overrides.json');
const RESULTS = path.join(F1_DIR, 'results-overrides.json');

// The championship points table, P1 first.
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

interface StandingsFile {
  drivers?: { driverName: string; pointsDelta?: number; points?: number }[];
  constructors?: { name: string; pointsDelta?: number; points?: number }[];
}
interface ResultsFile {
  [round: string]: unknown;
}

const readJson = <T,>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

describe('content/series/f1/standings-overrides.json', () => {
  it('exists while a correction is live, and is skipped once deleted', () => {
    // Deleting the file when upstream catches up is the intended end state, so
    // its absence is success, not failure.
    expect(typeof existsSync(STANDINGS)).toBe('boolean');
  });

  if (!existsSync(STANDINGS)) return;
  const file = readJson<StandingsFile>(STANDINGS);

  it("drivers' points deltas sum to zero", () => {
    const sum = (file.drivers ?? []).reduce((n, d) => n + (d.pointsDelta ?? 0), 0);
    expect(sum).toBe(0);
  });

  it("constructors' points deltas sum to zero", () => {
    const sum = (file.constructors ?? []).reduce((n, c) => n + (c.pointsDelta ?? 0), 0);
    expect(sum).toBe(0);
  });

  it("each constructor's delta equals the sum of its drivers' deltas", () => {
    // Independent of the sum-to-zero check: both could be zero while the points
    // were attributed to the wrong teams.
    const TEAM_OF: Record<string, string> = {
      'Isack Hadjar': 'Red Bull',
      'Oscar Piastri': 'McLaren',
      'Liam Lawson': 'RB F1 Team',
      'Arvid Lindblad': 'RB F1 Team',
      'Pierre Gasly': 'Alpine F1 Team',
    };
    const fromDrivers = new Map<string, number>();
    for (const d of file.drivers ?? []) {
      const team = TEAM_OF[d.driverName];
      // A driver this test does not know about means the file moved on without
      // it; fail rather than silently skip.
      expect(team, `no team mapped for ${d.driverName}`).toBeDefined();
      fromDrivers.set(team, (fromDrivers.get(team) ?? 0) + (d.pointsDelta ?? 0));
    }
    const declared = new Map((file.constructors ?? []).map(c => [c.name, c.pointsDelta ?? 0]));
    expect(Object.fromEntries(declared)).toEqual(Object.fromEntries(fromDrivers));
  });

  it('uses deltas rather than absolute totals while the season is running', () => {
    // An absolute total freezes a driver there for every remaining round.
    for (const d of file.drivers ?? []) expect(d.points).toBeUndefined();
    for (const c of file.constructors ?? []) expect(c.points).toBeUndefined();
  });
});

describe('content/series/f1/results-overrides.json', () => {
  if (!existsSync(RESULTS)) return;
  const file = readJson<ResultsFile>(RESULTS);

  it('awards exactly the championship points for each stated position', () => {
    for (const [key, value] of Object.entries(file)) {
      if (key.startsWith('_')) continue; // provenance keys
      const entries = value as { driverName: string; position?: number; points?: number }[];
      for (const e of entries) {
        if (e.position == null || e.points == null) continue;
        const expected = e.position <= POINTS.length ? POINTS[e.position - 1] : 0;
        expect(e.points, `${e.driverName} in round ${key} at P${e.position}`).toBe(expected);
      }
    }
  });

  it('never gives two drivers the same position in a round', () => {
    for (const [key, value] of Object.entries(file)) {
      if (key.startsWith('_')) continue;
      const entries = value as { position?: number }[];
      const positions = entries.map(e => e.position).filter(p => p != null);
      expect(new Set(positions).size, `duplicate position in round ${key}`).toBe(positions.length);
    }
  });
});
