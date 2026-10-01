import path from 'path';
import fs from '@/lib/content-fs';
import matter from 'gray-matter';
import { renderMarkdown } from '@/lib/content';
import { releaseHeader, releaseSlug } from '@/lib/release-index';

// ── Changelog parsing/grouping ──────────────────────────────────────────────
// RELEASES.md is two levels, newest first:
//
//   # Release 15 · The finishing pass      <- a named release + its story
//   <prose>
//   ## 0.334.30 — 2026-08-24               <- one push inside that release
//   <prose>
//
// The release is the unit a reader cares about; the `## ` entries are the audit
// trail underneath it. This replaced a month → week → version nesting (0.134.x):
// a release spans days by definition, so calendar buckets cut across the thing
// being described and 707 pushes read as 707 releases, which none of them are.
//
// WHY THE HEADER CARRIES SO LITTLE: everything derivable is derived from the
// entries it contains — the date range, the version span, the count. A header
// cannot therefore drift out of step with its own contents, which is exactly
// what a hand-maintained "0.310.0 → 0.334.29" in the prose would eventually do.
//
// Three shapes appear in the wild and must not crash the parser:
//   - a version range, e.g. `## 0.9.0–0.9.7 — 2026-05-16` (the range uses an
//     en-dash U+2013, distinct from the U+2014 date separator);
//   - an undated header, `## Pre-0.8.0`, with no date at all;
//   - entries with no release header above them (a push that forgot one) —
//     these collect into a trailing unfiled group rather than vanishing.
//
// Each body is rendered through the shared sanitised markdown pipeline
// (lib/content#renderMarkdown), so output is XSS-safe and goes straight to
// dangerouslySetInnerHTML.

export interface ReleaseEntry {
  /** The version token as written, e.g. "0.132.0" or "0.9.0–0.9.7" or "Pre-0.8.0". */
  version: string;
  /** ISO date (YYYY-MM-DD) if the header carried one, else null. */
  dateISO: string | null;
  /** Sanitised HTML of the entry body (may be empty). */
  bodyHtml: string;
}

export interface ReleaseGroup {
  /** Identity token from the header, e.g. "Release 15" or "1.1"; "unfiled" for
   *  entries that appeared above any release header. Used as the React key. */
  key: string;
  /** Display name, e.g. "The finishing pass". */
  label: string;
  /** Sanitised HTML of the release's own story (may be empty). */
  storyHtml: string;
  /** "20–24 Aug 2026", or null when the release holds no dated entry. Derived. */
  dateRange: string | null;
  /** "0.310.0 → 0.334.29", or a single version when it holds one. Derived. */
  versionSpan: string | null;
  /** The pushes inside this release, newest first (file order). */
  entries: ReleaseEntry[];
}

// The version capture is non-greedy so a trailing " — date" isn't swallowed.
const ENTRY_RE = /^##\s+(.+?)(?:\s+—\s+(\d{4}-\d{2}-\d{2}))?\s*$/;

interface RawEntry {
  version: string;
  dateISO: string | null;
  body: string;
}

interface RawRelease {
  key: string;
  label: string;
  story: string;
  entries: RawEntry[];
}

/** The bucket that catches entries appearing before any `# ` header — in
 *  practice, a push added above the top release. Named rather than dropped: a
 *  note that forgets its release header should still publish, the same way
 *  parseHomeLayout tolerates block ids it does not know. */
export const UNFILED_KEY = 'unfiled';

/** Split raw markdown into releases, each holding its `## ` entries. Content
 *  before the first header of either level (the file's intro line) is
 *  discarded — it isn't a release or an entry. */
export function splitReleases(markdown: string): RawRelease[] {
  const releases: RawRelease[] = [];
  let release: RawRelease | null = null;
  let entry: RawEntry | null = null;
  let buffer: string[] = [];

  /** The story is whatever sits between a `# ` header and its first `## `
   *  entry, so it can only ever be closed while no entry is open. Guarding on
   *  `!entry` (not on the entry count) is what stops a release with an empty
   *  story from swallowing its first entry's body. */
  const closeStory = () => {
    if (release && !entry && !release.story && buffer.length) {
      release.story = buffer.join('\n').trim();
    }
  };
  const flushEntry = () => {
    if (entry) {
      entry.body = buffer.join('\n').trim();
      release?.entries.push(entry);
      entry = null;
    }
    buffer = [];
  };
  const flushRelease = () => {
    closeStory(); // before flushEntry, which clears the buffer unconditionally
    flushEntry();
    if (release) {
      releases.push(release);
      release = null;
    }
  };

  for (const line of markdown.split(/\r?\n/)) {
    const header = releaseHeader(line);
    if (header) {
      flushRelease();
      release = { ...header, story: '', entries: [] };
      continue;
    }
    const ent = ENTRY_RE.exec(line);
    if (ent) {
      // An entry with no release above it: open a bucket so it still renders.
      if (!release) release = { key: UNFILED_KEY, label: 'Unreleased', story: '', entries: [] };
      closeStory();
      flushEntry();
      entry = { version: ent[1].trim(), dateISO: ent[2] ?? null, body: '' };
      continue;
    }
    // Body text belongs to the open entry, else to the open release's story.
    if (entry || release) buffer.push(line);
  }
  flushRelease();
  return releases;
}

/** UTC-safe day-month-year parts. UTC throughout so a plain calendar date can't
 *  drift a day at build time in any timezone. */
function parts(dateISO: string): { d: number; m: number; y: number } | null {
  const dt = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return { d: dt.getUTCDate(), m: dt.getUTCMonth(), y: dt.getUTCFullYear() };
}

function monthShort(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'short',
    timeZone: 'UTC',
  });
}

/** Compact span for a release, collapsing whatever the two dates share:
 *    same day    → "24 Aug 2026"
 *    same month  → "20–24 Aug 2026"
 *    same year   → "23 Jul – 6 Aug 2026"
 *    else        → "28 Dec 2026 – 3 Jan 2027"
 *  Both arguments are ISO dates; `from` is the older. */
export function dateRangeLabel(fromISO: string, toISO: string): string {
  const a = parts(fromISO);
  const b = parts(toISO);
  if (!a || !b) return fromISO === toISO ? fromISO : `${fromISO} – ${toISO}`;
  const full = (iso: string, p: { d: number; y: number }) => `${p.d} ${monthShort(iso)} ${p.y}`;
  if (a.y === b.y && a.m === b.m && a.d === b.d) return full(toISO, b);
  if (a.y === b.y && a.m === b.m) return `${a.d}–${b.d} ${monthShort(toISO)} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${monthShort(fromISO)} – ${b.d} ${monthShort(toISO)} ${b.y}`;
  return `${full(fromISO, a)} – ${full(toISO, b)}`;
}

/** The derived header facts for a release: its date range and version span.
 *  Both read off the entries, so neither can contradict what is listed below. */
export function deriveSpan(entries: ReleaseEntry[]): {
  dateRange: string | null;
  versionSpan: string | null;
} {
  if (!entries.length) return { dateRange: null, versionSpan: null };
  const dated = entries.map((e) => e.dateISO).filter((d): d is string => !!d);
  const dateRange = dated.length
    ? dateRangeLabel(
        dated.reduce((min, d) => (d < min ? d : min), dated[0]),
        dated.reduce((max, d) => (d > max ? d : max), dated[0]),
      )
    : null;
  const newest = entries[0].version;
  const oldest = entries[entries.length - 1].version;
  const versionSpan = entries.length === 1 || newest === oldest ? newest : `${oldest} → ${newest}`;
  return { dateRange, versionSpan };
}

/** Parse RELEASES.md into named releases, newest first, each holding its pushes
 *  in file order (the file is authored newest-first). */
export async function loadReleaseGroups(filePath: string): Promise<ReleaseGroup[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return [];
  }
  const { content } = matter(raw);

  // Render bodies (async) preserving order.
  return Promise.all(
    splitReleases(content).map(async (r) => {
      const entries: ReleaseEntry[] = await Promise.all(
        r.entries.map(async (e) => ({
          version: e.version,
          dateISO: e.dateISO,
          bodyHtml: await renderMarkdown(e.body),
        })),
      );
      return {
        key: r.key,
        label: r.label,
        storyHtml: await renderMarkdown(r.story),
        ...deriveSpan(entries),
        entries,
      };
    }),
  );
}

/** Absolute path to RELEASES.md at the repo root, resolved from cwd. */
export function releasesFilePath(): string {
  return path.join(process.cwd(), 'RELEASES.md');
}

/** The address segment of a release (lib/release-index: the label’s slug, the key’s when the label yields nothing). */
export { releaseSlug };

/** The release at an address, or null. */
export function findRelease(groups: ReleaseGroup[], slug: string): ReleaseGroup | null {
  return groups.find(g => releaseSlug(g) === slug) ?? null;
}
