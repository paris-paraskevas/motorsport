import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Invariants for every curated weekend-notes.json — the authored account of a
// race weekend, rendered on the live weekend page and on its archive copy.
//
// The failure this file exists to prevent is specific and silent. The live URL
// `/series/<slug>/weekend/<round>` carries no season, so a note attached to the
// wrong season renders on a DIFFERENT RACE and nothing complains: the page
// still looks enriched. Hence the key is `<season>-<round>`, hence every check
// below anchors on the season archive rather than on the live series data,
// which only ever describes the current season.
//
// Deliberately not checked: anything about the prose beyond naming the winner
// and a length floor. A race report is writing, and most of it is not
// machine-checkable — the same line champion-notes-integrity.test.ts draws.
const SERIES_ROOT = path.join(process.cwd(), 'content', 'series');
const ARCHIVE_ROOT = path.join(process.cwd(), 'data', 'season-archive');

interface Note {
  lead?: string;
  note?: string;
  sources?: unknown;
}

interface ArchivedRound {
  round: number;
  roundName: string | null;
}

interface ArchiveFile {
  season: number;
  weekends: ArchivedRound[];
  results: unknown;
}

const KEY = /^(\d{4})-(\d{1,2})$/;

/** Winner of a round from the archived results, when the shape allows it. The
 *  per-series result payloads differ, so this resolves only the common one
 *  (`[{round, results:[{position, driverName}]}]`) and returns null otherwise —
 *  a check that cannot read the data must not fail the note. */
function winnerOf(results: unknown, round: number): string | null {
  if (!Array.isArray(results)) return null;
  const entry = results.find(
    (r): r is { round: number; results: { position: number; driverName?: string }[] } =>
      !!r && typeof r === 'object' && (r as { round?: number }).round === round &&
      Array.isArray((r as { results?: unknown }).results),
  );
  if (!entry) return null;
  const first = entry.results.find(x => x?.position === 1);
  return first?.driverName ?? null;
}

const archiveFor = (season: string, slug: string): ArchiveFile | null => {
  const p = path.join(ARCHIVE_ROOT, season, `${slug}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8')) as ArchiveFile;
};

const sets = readdirSync(SERIES_ROOT)
  .map(slug => ({ slug, file: path.join(SERIES_ROOT, slug, 'weekend-notes.json') }))
  .filter(({ file }) => existsSync(file))
  .map(({ slug, file }) => ({
    slug,
    notes: JSON.parse(readFileSync(file, 'utf8')) as Record<string, Note>,
  }));

const cases = sets.map(s => [s.slug, s.notes] as const);

describe('weekend-notes.json integrity', () => {
  it('finds note files to check', () => {
    expect(sets.length).toBeGreaterThan(0);
  });

  // A bare round number, or "2026" nested as its own object, is the defect: V8
  // orders integer-like keys ascending regardless of insertion order, and a
  // season-less key reattaches to a different race every January.
  it.each(cases)('%s: every key is <season>-<round>', (_slug, notes) => {
    for (const key of Object.keys(notes)) {
      expect(KEY.test(key), `${key}: expected "<season>-<round>"`).toBe(true);
    }
  });

  // The anchor. A note for a season or round we have no archive of is either a
  // typo or a note written against the wrong series.
  it.each(cases)('%s: every note maps to an archived round', (slug, notes) => {
    for (const key of Object.keys(notes)) {
      const m = KEY.exec(key);
      if (!m) continue;
      const [, season, round] = m;
      const archive = archiveFor(season, slug);
      expect(archive, `${key}: no season archive for ${slug} ${season}`).not.toBeNull();
      expect(
        (archive as ArchiveFile).weekends.some(w => w.round === Number(round)),
        `${key}: round ${round} is not in the ${season} ${slug} archive`,
      ).toBe(true);
    }
  });

  // The transposition guard: a note written for the wrong round almost never
  // names that round's actual winner. Skipped where the archive's result shape
  // does not expose one, rather than failing on data it cannot read.
  it.each(cases)('%s: every note names the winner where one is recorded', (slug, notes) => {
    for (const [key, note] of Object.entries(notes)) {
      const m = KEY.exec(key);
      if (!m) continue;
      const [, season, round] = m;
      const archive = archiveFor(season, slug);
      if (!archive) continue;
      const winner = winnerOf(archive.results, Number(round));
      if (!winner) continue;
      const surname = winner.trim().split(/\s+/).slice(-1)[0];
      const blob = `${note.lead ?? ''} ${note.note ?? ''}`;
      expect(blob, `${key}: note never names the winner (${winner})`).toContain(surname);
    }
  });

  // A race report nobody can check is worth less than none (RULE #1), and two
  // citations on one host is one citation.
  it.each(cases)('%s: every note cites two sources on distinct hosts', (_slug, notes) => {
    for (const [key, note] of Object.entries(notes)) {
      const sources = note.sources;
      expect(Array.isArray(sources), `${key}: sources is not a list`).toBe(true);
      const list = sources as unknown[];
      expect(list.length, `${key}: fewer than two sources`).toBeGreaterThanOrEqual(2);
      const hosts = new Set<string>();
      for (const s of list) {
        expect(typeof s, `${key}: non-string source`).toBe('string');
        expect(String(s), `${key}: source is not a URL`).toMatch(/^https?:\/\//);
        hosts.add(new URL(String(s)).host.replace(/^www\./, ''));
      }
      expect(hosts.size, `${key}: all sources share a host`).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(cases)('%s: no note is empty or a stub', (_slug, notes) => {
    for (const [key, note] of Object.entries(notes)) {
      const lead = (note.lead ?? '').trim();
      expect(lead.length, `${key}: empty lead`).toBeGreaterThan(0);
      // The renderer appends the full stop, so a lead carrying one renders "..".
      expect(lead.endsWith('.'), `${key}: lead ends in a full stop`).toBe(false);
      const body = (note.note ?? '').trim();
      expect(
        body.split(/\s+/).filter(Boolean).length,
        `${key}: note is a stub`,
      ).toBeGreaterThanOrEqual(60);
    }
  });
});
