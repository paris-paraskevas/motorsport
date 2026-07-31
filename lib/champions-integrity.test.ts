import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Invariants for every curated champions.json. These exist because the MotoGP
// 1949-2015 enrichment (2026-07-31) was extracted from Wikipedia season articles
// by a parser that, on its first three passes, produced 13 rows naming a real
// champion of a DIFFERENT class that season with plausible points attached. Only
// a cross-check against the independently curated champion name caught them.
// These assertions are the cheap, permanent version of that check.
const ROOT = path.join(process.cwd(), 'content', 'series');

interface Champion {
  year: number;
  driver: string;
  constructor?: string;
  points?: number;
  wins?: number;
  runnerUp?: string;
  runnerUpTeam?: string;
  runnerUpPoints?: number;
}

const files = readdirSync(ROOT)
  .map((slug) => ({ slug, file: path.join(ROOT, slug, 'champions.json') }))
  .filter(({ file }) => existsSync(file))
  .map(({ slug, file }) => ({ slug, rows: JSON.parse(readFileSync(file, 'utf8')) as Champion[] }));

describe('champions.json integrity', () => {
  it('finds champion files to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [f.slug, f.rows] as const))('%s: years are unique and plausible', (_slug, rows) => {
    const years = rows.map((r) => r.year);
    expect(new Set(years).size).toBe(years.length);
    for (const y of years) {
      expect(y).toBeGreaterThan(1900);
      expect(y).toBeLessThan(2100);
    }
  });

  it.each(files.map((f) => [f.slug, f.rows] as const))('%s: every row names a driver', (_slug, rows) => {
    for (const r of rows) expect(r.driver?.trim().length ?? 0).toBeGreaterThan(0);
  });

  // The transposition guard: a champion cannot have scored fewer points than the
  // runner-up, and cannot be their own runner-up.
  it.each(files.map((f) => [f.slug, f.rows] as const))('%s: champion outscores the runner-up', (_slug, rows) => {
    for (const r of rows) {
      if (r.points == null || r.runnerUpPoints == null) continue;
      expect(r.points, `${r.year}: champion points below runner-up`).toBeGreaterThanOrEqual(r.runnerUpPoints);
    }
  });

  it.each(files.map((f) => [f.slug, f.rows] as const))('%s: runner-up is a different person', (_slug, rows) => {
    for (const r of rows) {
      if (!r.runnerUp) continue;
      expect(r.runnerUp).not.toBe(r.driver);
    }
  });

  // Machine names leaked into runnerUpTeam during the MotoGP pass (MV500, YZR500,
  // RGV500, NSR500) along with a bare "2" — a place number. A team name should not
  // be a number or contain a model designation.
  it.each(files.map((f) => [f.slug, f.rows] as const))('%s: runnerUpTeam is a team, not a machine', (_slug, rows) => {
    for (const r of rows) {
      if (!r.runnerUpTeam) continue;
      expect(r.runnerUpTeam, `${r.year}: numeric runnerUpTeam`).not.toMatch(/^\d+$/);
      expect(r.runnerUpTeam, `${r.year}: model designation in runnerUpTeam`).not.toMatch(/\d{3}/);
    }
  });

  it.each(files.map((f) => [f.slug, f.rows] as const))('%s: counts are non-negative integers', (_slug, rows) => {
    for (const r of rows) {
      for (const key of ['points', 'wins', 'runnerUpPoints'] as const) {
        const v = r[key];
        if (v == null) continue;
        expect(Number.isFinite(v), `${r.year}.${key}`).toBe(true);
        expect(v, `${r.year}.${key}`).toBeGreaterThanOrEqual(0);
      }
      if (r.wins != null) expect(Number.isInteger(r.wins)).toBe(true);
    }
  });
});
