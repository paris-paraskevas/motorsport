import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { countryName } from './nationalities';

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
  nationality?: string;
  podiums?: number;
  rookie?: boolean;
  era?: string;
  sources?: string[];
}

// The series' official hosts (R18): a sourced row's points must come from one of them (an archive copy included).
const OFFICIAL_HOSTS: Record<string, readonly string[]> = { f2: ['gp2series.com', 'fiaformula2.com'] };
const officialHosts = (slug: string): readonly string[] => OFFICIAL_HOSTS[slug] ?? [];

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
      for (const key of ['points', 'wins', 'podiums', 'runnerUpPoints'] as const) {
        const v = r[key];
        if (v == null) continue;
        expect(Number.isFinite(v), `${r.year}.${key}`).toBe(true);
        expect(v, `${r.year}.${key}`).toBeGreaterThanOrEqual(0);
      }
      if (r.wins != null) expect(Number.isInteger(r.wins)).toBe(true);
      if (r.podiums != null) expect(Number.isInteger(r.podiums)).toBe(true);
    }
  });

  // R18: the fields the champions page draws. A nationality is one of the FIA's three-letter codes the site can name; a
  // podium count holds the wins; an era on one row is an era on every row of that file; a sourced row names https pages,
  // each once, and an official one beside Wikipedia's wherever the row carries points.
  it.each(files.map((f) => [f.slug, f.rows] as const))('%s: nationality is a code the site names, podiums hold the wins, an era is on every row or none', (_slug, rows) => {
    for (const r of rows) {
      if (r.nationality != null) expect(countryName(r.nationality), `${r.year}: nationality ${r.nationality}`).not.toBeNull();
      if (r.podiums != null && r.wins != null) expect(r.podiums, `${r.year}: podiums below wins`).toBeGreaterThanOrEqual(r.wins);
      if (r.rookie != null) expect(typeof r.rookie).toBe('boolean');
    }
    const eras = rows.filter((r) => typeof r.era === 'string' && r.era.trim().length > 0).length;
    expect(eras === 0 || eras === rows.length, 'era on some rows only').toBe(true);
    // Formula 2's eras split where lib/information/generated.ts seriesNameForYear splits them: 2017.
    if (_slug === 'f2') for (const r of rows) expect(r.era, String(r.year)).toBe(r.year >= 2017 ? 'FIA Formula 2 Championship' : 'GP2 Series');
  });

  it.each(files.map((f) => [f.slug, f.rows] as const))('%s: a sourced row names https pages once each, an official one beside Wikipedia where it carries points', (_slug, rows) => {
    for (const r of rows) {
      if (!r.sources) continue;
      expect(r.sources.length, `${r.year}: no sources`).toBeGreaterThan(0);
      expect(new Set(r.sources).size, `${r.year}: a source twice`).toBe(r.sources.length);
      for (const s of r.sources) expect(s, `${r.year}: ${s}`).toMatch(/^https:\/\//);
      if (r.points != null) expect(r.sources.some((s) => officialHosts(_slug).some((h) => s.includes(`${h}/`))), `${r.year}: points without an official source`).toBe(true);
    }
  });
});
