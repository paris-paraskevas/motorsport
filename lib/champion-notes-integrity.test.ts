import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Invariants for every curated champion-notes.json (the AdSense enrichment
// sidecars: `clinched` + `note` + `sources` per season, read fail-soft by the
// champion answer pages).
//
// These exist because the session-30 close recorded an honest open risk: of the
// 30 F1 notes shipped in 0.324.0, only 8 had been re-verified against primary
// sources, and nothing in the repo checked the other 22 at all. A note is prose,
// so most of it cannot be machine-checked — but the parts that CAN be are
// exactly the parts that go wrong when a batch is written from a season list:
// a note attached to the wrong year, or a points figure that contradicts the
// curated table on the same page.
//
// Deliberately NOT checked: win counts pulled out of the prose. The 2001 note
// correctly says Schumacher "equalled Alain Prost's all-time record of 51 wins",
// a CAREER figure, and every regex that catches a season total also catches that.
// A check that fires on correct data is worse than no check, and the fix would
// have been to special-case the sentence, which is weakening it. Points pairs
// carry the same risk and are unambiguous, so they are checked instead.
const ROOT = path.join(process.cwd(), 'content', 'series');

interface Champion {
  year: number;
  driver: string;
  points?: number;
  runnerUpPoints?: number;
}

interface Note {
  clinched?: string;
  note?: string;
  sources?: unknown;
}

const sets = readdirSync(ROOT)
  .map((slug) => ({
    slug,
    notesFile: path.join(ROOT, slug, 'champion-notes.json'),
    championsFile: path.join(ROOT, slug, 'champions.json'),
  }))
  .filter(({ notesFile, championsFile }) => existsSync(notesFile) && existsSync(championsFile))
  .map(({ slug, notesFile, championsFile }) => ({
    slug,
    notes: JSON.parse(readFileSync(notesFile, 'utf8')) as Record<string, Note>,
    champions: JSON.parse(readFileSync(championsFile, 'utf8')) as Champion[],
  }));

const cases = sets.map((s) => [s.slug, s.notes, s.champions] as const);

/** "395.5 points to 387.5" or plain "123 to 65" — the champion/runner-up pair as
 *  the prose states it. Two shapes because both are used across the notes. */
const POINTS_PAIR = /(\d{2,4}(?:\.\d)?)\s+points\s+to\s+(\d{2,4}(?:\.\d)?)|(\d{2,4}(?:\.\d)?)\s+to\s+(\d{2,4}(?:\.\d)?)/;

describe('champion-notes.json integrity', () => {
  it('finds note files to check', () => {
    expect(sets.length).toBeGreaterThan(0);
  });

  // An orphan note renders nowhere: the answer pages key off the champions row.
  it.each(cases)('%s: every note has a champions.json row', (_slug, notes, champions) => {
    const years = new Set(champions.map((c) => String(c.year)));
    for (const year of Object.keys(notes)) {
      expect(years.has(year), `${year}: note with no champions.json row`).toBe(true);
    }
  });

  // The transposition guard, and the reason this file exists: a note written
  // from a season list and attached to the wrong year almost never names that
  // year's actual champion.
  it.each(cases)('%s: every note names its own champion', (_slug, notes, champions) => {
    const byYear = new Map(champions.map((c) => [String(c.year), c]));
    for (const [year, note] of Object.entries(notes)) {
      const champion = byYear.get(year);
      if (!champion) continue;
      const surname = champion.driver.trim().split(/\s+/).slice(-1)[0];
      const blob = `${note.clinched ?? ''} ${note.note ?? ''}`;
      expect(blob, `${year}: note never names ${surname}`).toContain(surname);
    }
  });

  it.each(cases)('%s: the clinch line carries its own season', (_slug, notes) => {
    for (const [year, note] of Object.entries(notes)) {
      expect(note.clinched ?? '', `${year}: clinch line lacks the year`).toContain(year);
    }
  });

  // Where the prose states the final points as a pair, it must agree with the
  // curated table — the two are rendered on the SAME page, and disagreeing with
  // itself in one view is the defect class that has bitten this repo before.
  it.each(cases)('%s: stated points agree with champions.json', (_slug, notes, champions) => {
    const byYear = new Map(champions.map((c) => [String(c.year), c]));
    for (const [year, note] of Object.entries(notes)) {
      const champion = byYear.get(year);
      if (!champion || champion.points == null || champion.runnerUpPoints == null) continue;
      const match = POINTS_PAIR.exec(`${note.clinched ?? ''} ${note.note ?? ''}`);
      if (!match) continue;
      const [first, second] = match.slice(1).filter((g) => g !== undefined).map(Number);
      expect([first, second], `${year}: prose says ${first}/${second}`).toEqual([
        champion.points,
        champion.runnerUpPoints,
      ]);
    }
  });

  // Two sources minimum is the standard the enrichment waves were written to.
  it.each(cases)('%s: every note cites at least two real sources', (_slug, notes) => {
    for (const [year, note] of Object.entries(notes)) {
      const sources = note.sources;
      expect(Array.isArray(sources), `${year}: sources is not a list`).toBe(true);
      const list = sources as unknown[];
      expect(list.length, `${year}: fewer than two sources`).toBeGreaterThanOrEqual(2);
      for (const s of list) {
        expect(typeof s, `${year}: non-string source`).toBe('string');
        expect(String(s), `${year}: source is not a URL`).toMatch(/^https?:\/\//);
      }
    }
  });

  it.each(cases)('%s: no note is empty', (_slug, notes) => {
    for (const [year, note] of Object.entries(notes)) {
      expect((note.clinched ?? '').trim().length, `${year}: empty clinch line`).toBeGreaterThan(0);
      expect((note.note ?? '').trim().length, `${year}: empty note`).toBeGreaterThan(0);
    }
  });
});
