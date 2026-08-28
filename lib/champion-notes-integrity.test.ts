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
  season?: string;
  race?: string;
  note?: string;
  sources?: unknown;
}

/** A note carries EXACTLY ONE lead clause, and which one it is decides the label
 *  the page renders (`noteLead` in lib/information/generated.ts). Two set at once
 *  is the defect this guards: the renderer would silently pick `clinched` and the
 *  other would vanish from the page while still looking authored in the file. */
const LEAD_KEYS = ['clinched', 'season', 'race'] as const;
const leadsOf = (n: Note) => LEAD_KEYS.filter((k) => (n[k] ?? '').trim().length > 0);
const leadText = (n: Note) => LEAD_KEYS.map((k) => n[k] ?? '').join(' ');

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

/** "395.5 points to 387.5", plain "123 to 65", and — since 0.334.102 — the shape
 *  good prose actually uses, "498 points to Sykes's 447". The narrow form matched
 *  only when the two totals were adjacent, so naming the rival made the check
 *  silently skip the note: it went from checking 69 of the 193 notes that have
 *  both totals in champions.json to checking 109.
 *
 *  Three things here are load-bearing:
 *
 *  - The gap is NON-capturing and `\D`-only, so it can never step over a number
 *    and pair the wrong two. Bounded at 24 characters: long enough for a name
 *    and a possessive, short enough that it cannot reach into the next clause.
 *  - Years are excluded. Without `(?!19\d\d|20\d\d)`, "the first since 1973 to
 *    hold titles in the 125 and 250 classes" reads as a points pair. No real
 *    total lands in that band — the largest figure anywhere in champions.json is
 *    678 (IndyCar 2018), measured, not assumed.
 *  - ORDER IS THE POINT. The champion's total is stated first, and comparing the
 *    pair in order is what catches a transposed note. That makes it a house rule
 *    for these notes: when a note gives both totals, name the champion's first.
 *    The f1 1993 note was accurate but stated the runner-up first ("Ayrton Senna
 *    finished runner-up on 73 points to Prost's 99"), so it was reworded rather
 *    than exempted.
 *
 *  If this ever fails, the fix is the prose or the data — NOT making the
 *  comparison order-insensitive. That would trade away the transposition guard,
 *  which is most of what this check is for. */
const POINTS_PAIR =
  /\b(?!19\d\d|20\d\d)(\d{2,4}(?:\.\d)?)\s+points\s+to\s+(?:\D{0,24}?)\b(?!19\d\d|20\d\d)(\d{2,4}(?:\.\d)?)\b|\b(?!19\d\d|20\d\d)(\d{2,4}(?:\.\d)?)\s+to\s+\b(?!19\d\d|20\d\d)(\d{2,4}(?:\.\d)?)\b/;

// The pattern's own tests. Without these the corpus assertion below can only
// fail LOUDER when the regex breaks, never when it quietly stops matching — and
// a check that silently matches nothing is indistinguishable from a passing one.
describe('POINTS_PAIR', () => {
  const pair = (s: string) => {
    const m = POINTS_PAIR.exec(s);
    return m ? m.slice(1).filter((g) => g !== undefined).map(Number) : null;
  };

  it.each([
    ['489 points to 361', [489, 361]],
    ["498 points to Sykes's 447", [498, 447]],
    ['395.5 points to 387.5', [395.5, 387.5]],
    ["99 points to Ayrton Senna's 73", [99, 73]],
  ])('reads %s', (prose, expected) => {
    expect(pair(prose as string)).toEqual(expected);
  });

  // Both of these are real sentences from the corpus shape. A four-digit year
  // beside "to" is the one false positive broadening the pattern could create.
  it.each([
    'the first since 1973 to hold titles in the 125 and 250 classes',
    'won the title in 2001 with a race to spare',
  ])('does not read a year as a points pair: %s', (prose) => {
    expect(pair(prose)).toBeNull();
  });
});

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
      const blob = `${leadText(note)} ${note.note ?? ''}`;
      expect(blob, `${year}: note never names ${surname}`).toContain(surname);
    }
  });

  it.each(cases)('%s: every note has exactly one lead clause', (_slug, notes) => {
    for (const [year, note] of Object.entries(notes)) {
      expect(leadsOf(note), `${year}: expected one of ${LEAD_KEYS.join('/')}`).toHaveLength(1);
    }
  });

  it.each(cases)('%s: the lead clause carries its own season', (_slug, notes) => {
    for (const [year, note] of Object.entries(notes)) {
      expect(leadText(note), `${year}: lead clause lacks the year`).toContain(year);
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
      const match = POINTS_PAIR.exec(`${leadText(note)} ${note.note ?? ''}`);
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
      expect(leadText(note).trim().length, `${year}: empty lead clause`).toBeGreaterThan(0);
      expect((note.note ?? '').trim().length, `${year}: empty note`).toBeGreaterThan(0);
    }
  });
});
