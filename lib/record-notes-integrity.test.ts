import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { driversOf } from './information/generated';

// Invariants for every curated record-notes.json — the authored enrichment for
// the two generated "who has won the most X" answers, read fail-soft by
// mostDriverTitlesEntry / mostConstructorTitlesEntry.
//
// Why these and not others: the record pages state a COUNT and a HOLDER, both
// derived live from champions.json on the same page the note renders on. So the
// two failure modes are a note that disagrees with the table beside it, and a
// note written for a half the generator does not emit — and both are exactly
// machine-checkable. The prose itself is not, and is not pretended to be.
//
// Deliberately NOT checked: that no number in the prose exceeds the record. A
// MotoGP riders' note legitimately mentioning Honda's 25 constructors' titles
// would fail it while being correct, and champion-notes-integrity.test.ts:19-22
// already settled that a check firing on correct data is worse than no check.
const ROOT = path.join(process.cwd(), 'content', 'series');

interface Champion {
  year: number;
  driver: string;
  constructorChampion?: string;
}

interface RecordNote {
  lead?: string;
  note?: string;
  sources?: unknown;
}

const HALVES = ['drivers', 'teams'] as const;
type Half = (typeof HALVES)[number];

/** Count titles per name and return everyone tied at the top — the same shape
 *  `topHolders(rankTitles(...))` produces in the generator, so the note is
 *  checked against precisely what the page renders. Counted PER PERSON via the
 *  generator's own `driversOf`, because the endurance families put a whole crew
 *  in one `driver` string. */
function topHolders(champs: Champion[], key: (c: Champion) => string[]): { names: string[]; count: number } {
  const counts = new Map<string, number>();
  for (const c of champs) {
    for (const name of key(c)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (ranked.length === 0) return { names: [], count: 0 };
  const count = ranked[0][1];
  return { names: ranked.filter(([, n]) => n === count).map(([n]) => n), count };
}

const recordFor = (champs: Champion[], half: Half) =>
  half === 'drivers'
    ? topHolders(champs, (c) => driversOf(c.driver))
    : topHolders(champs, (c) => (c.constructorChampion ? [c.constructorChampion] : []));

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty'];
/** 17 → "seventeen", 25 → "twenty-five". Covers every record in the curated set
 *  (highest is Honda's 25) with headroom. */
function inWords(n: number): string {
  if (n < 20) return ONES[n] ?? String(n);
  const rest = n % 10;
  return rest ? `${TENS[Math.floor(n / 10)]}-${ONES[rest]}` : TENS[Math.floor(n / 10)];
}

const blobOf = (n: RecordNote) => `${n.lead ?? ''} ${n.note ?? ''}`;
/** A team is named in full ("ART Grand Prix", "Renault e.dams") because it has
 *  no surname to fall back on; a driver by surname, as champion-notes does. */
const needle = (holder: string, half: Half) =>
  half === 'teams' ? holder : holder.trim().split(/\s+/).slice(-1)[0];

const sets = readdirSync(ROOT)
  .map((slug) => ({
    slug,
    notesFile: path.join(ROOT, slug, 'record-notes.json'),
    championsFile: path.join(ROOT, slug, 'champions.json'),
  }))
  .filter(({ notesFile }) => existsSync(notesFile));

const cases = sets.map(
  (s) =>
    [
      s.slug,
      JSON.parse(readFileSync(s.notesFile, 'utf8')) as Record<string, RecordNote>,
      existsSync(s.championsFile)
        ? (JSON.parse(readFileSync(s.championsFile, 'utf8')) as Champion[])
        : null,
      s.championsFile,
    ] as const,
);

describe('record-notes.json integrity', () => {
  it('finds note files to check', () => {
    expect(sets.length).toBeGreaterThan(0);
  });

  // Without a champions.json the generator emits no record page at all, so the
  // whole file would be dead content.
  it.each(cases)('%s: has a champions.json', (_slug, _notes, champions, file) => {
    expect(champions, `no champions.json at ${file}`).not.toBeNull();
    expect((champions ?? []).length).toBeGreaterThan(0);
  });

  // Both generators bail when the record is below 2 ("who has won the most" is
  // meaningless when nobody has won twice), so a note on that half renders
  // nowhere. The mirror case matters as much: a typo'd key ("team", "driver")
  // would be silently ignored and look authored in the file.
  it.each(cases)('%s: carries only halves the generator renders', (_slug, notes, champions) => {
    expect(Object.keys(notes).sort()).toEqual(
      Object.keys(notes)
        .filter((k) => (HALVES as readonly string[]).includes(k))
        .sort(),
    );
    for (const half of HALVES) {
      if (!notes[half]) continue;
      const { count } = recordFor(champions ?? [], half);
      expect(count, `${half}: record is ${count}, so no page is generated`).toBeGreaterThanOrEqual(2);
    }
  });

  // The transposition guard. A note pasted onto the wrong series or the wrong
  // half almost never names that page's actual record holder — and where the
  // record is shared, naming only some of the holders is the false-claim class
  // that put "2 titles, held by Jean-Éric Vergne" on twelve live pages (0.334.54).
  it.each(cases)('%s: every note names all of its record holders', (_slug, notes, champions) => {
    for (const half of HALVES) {
      const note = notes[half];
      if (!note) continue;
      const { names } = recordFor(champions ?? [], half);
      const blob = blobOf(note);
      for (const holder of names) {
        expect(blob, `${half}: note never names ${holder}`).toContain(needle(holder, half));
      }
    }
  });

  // The count is rendered from champions.json in the sentence above the note, so
  // a note stating a different one disagrees with itself in a single view.
  it.each(cases)('%s: every note states the record count', (_slug, notes, champions) => {
    for (const half of HALVES) {
      const note = notes[half];
      if (!note) continue;
      const { count } = recordFor(champions ?? [], half);
      const blob = blobOf(note).toLowerCase();
      const hasDigit = new RegExp(`\\b${count}\\b`).test(blob);
      expect(
        hasDigit || blob.includes(inWords(count)),
        `${half}: note states neither ${count} nor "${inWords(count)}"`,
      ).toBe(true);
    }
  });

  // "When the record was set" is the one thing the derived lines cannot say, so
  // the lead has to carry a year — and it must be a season this series actually
  // ran, which is what catches a lead written against the wrong family.
  it.each(cases)('%s: the lead carries a season from champions.json', (_slug, notes, champions) => {
    const seasons = new Set((champions ?? []).map((c) => String(c.year)));
    for (const half of HALVES) {
      const note = notes[half];
      if (!note) continue;
      const years = (note.lead ?? '').match(/\b(?:19|20)\d{2}\b/g) ?? [];
      expect(years.length, `${half}: lead states no year`).toBeGreaterThan(0);
      expect(
        years.some((y) => seasons.has(y)),
        `${half}: lead's years ${years.join('/')} are none of this series' seasons`,
      ).toBe(true);
    }
  });

  // Two sources on DIFFERENT hosts: a record claim checked twice against the
  // same site has been checked once (RULE #1).
  it.each(cases)('%s: every note cites two sources on distinct hosts', (_slug, notes) => {
    for (const half of HALVES) {
      const note = notes[half];
      if (!note) continue;
      const sources = note.sources;
      expect(Array.isArray(sources), `${half}: sources is not a list`).toBe(true);
      const list = sources as unknown[];
      expect(list.length, `${half}: fewer than two sources`).toBeGreaterThanOrEqual(2);
      const hosts = new Set<string>();
      for (const s of list) {
        expect(typeof s, `${half}: non-string source`).toBe('string');
        expect(String(s), `${half}: source is not a URL`).toMatch(/^https?:\/\//);
        hosts.add(new URL(String(s)).host.replace(/^www\./, ''));
      }
      expect(hosts.size, `${half}: all sources share a host`).toBeGreaterThanOrEqual(2);
    }
  });

  // A floor against a stub, not a proof of the target: these pages ran 42–81
  // rendered words before enrichment and the programme's bar is 180, so the note
  // carries the whole gap. 90 is well under what any of them is written to and
  // still catches a placeholder.
  it.each(cases)('%s: no note is empty or a stub', (_slug, notes) => {
    for (const half of HALVES) {
      const note = notes[half];
      if (!note) continue;
      const lead = (note.lead ?? '').trim();
      expect(lead.length, `${half}: empty lead`).toBeGreaterThan(0);
      // The renderer appends the full stop ("**The record:** ${lead}."), so a
      // lead ending in one renders "..".
      expect(lead.endsWith('.'), `${half}: lead ends in a full stop`).toBe(false);
      const body = (note.note ?? '').trim();
      expect(body.split(/\s+/).filter(Boolean).length, `${half}: note is a stub`).toBeGreaterThanOrEqual(90);
    }
  });
});
