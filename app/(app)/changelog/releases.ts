import path from 'path';
import fs from 'fs/promises';
import matter from 'gray-matter';
import { renderMarkdown } from '@/lib/content';

// ── Changelog parsing/grouping ──────────────────────────────────────────────
// The /changelog page renders RELEASES.md, which is a flat, newest-first list of
//   ## <version> — <YYYY-MM-DD>
// sections (the em-dash is U+2014). This module parses those sections and buckets
// them by calendar month so the page can render a grouped, scannable timeline
// instead of one long blob.
//
// Two shapes appear in the wild and must not crash the parser:
//   - a version range, e.g. `## 0.9.0–0.9.7 — 2026-05-16` (the range uses an
//     en-dash U+2013, distinct from the U+2014 date separator);
//   - an undated header, `## Pre-0.8.0`, with no date at all.
// Undated entries fall into a trailing "Earlier" bucket.
//
// Each release body is rendered through the shared sanitised markdown pipeline
// (lib/content#renderMarkdown), the same one the rest of the file-backed content
// uses, so output is XSS-safe and goes straight to dangerouslySetInnerHTML.

export interface ReleaseEntry {
  /** The version token as written, e.g. "0.132.0" or "0.9.0–0.9.7" or "Pre-0.8.0". */
  version: string;
  /** ISO date (YYYY-MM-DD) if the header carried one, else null. */
  dateISO: string | null;
  /** Sanitised HTML of the release body (may be empty). */
  bodyHtml: string;
}

export interface MonthGroup {
  /** Sort/identity key: "YYYY-MM" for dated groups, "0000-00" for undated. */
  key: string;
  /** Human label, e.g. "July 2026" or "Earlier". */
  label: string;
  releases: ReleaseEntry[];
}

// Header form: "<version>" optionally followed by " — <YYYY-MM-DD>".
// The version capture is non-greedy so a trailing " — date" isn't swallowed.
const HEADER_RE = /^##\s+(.+?)(?:\s+—\s+(\d{4}-\d{2}-\d{2}))?\s*$/;

interface RawSection {
  version: string;
  dateISO: string | null;
  body: string;
}

/** Split raw markdown into `## `-delimited sections. Content before the first
 *  `## ` header (the file's intro line) is discarded — it isn't a release. */
export function splitSections(markdown: string): RawSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: RawSection[] = [];
  let current: RawSection | null = null;
  const bodyLines: string[] = [];

  const flush = () => {
    if (current) {
      current.body = bodyLines.join('\n').trim();
      sections.push(current);
    }
    bodyLines.length = 0;
  };

  for (const line of lines) {
    const m = HEADER_RE.exec(line);
    if (m) {
      flush();
      current = { version: m[1].trim(), dateISO: m[2] ?? null, body: '' };
    } else if (current) {
      bodyLines.push(line);
    }
  }
  flush();
  return sections;
}

/** UTC-safe month label from an ISO date, e.g. "2026-07-01" → "July 2026".
 *  UTC matches the rest of the file-backed date rendering (blog index) and keeps
 *  a plain calendar date from drifting a month at build time in any timezone. */
function monthLabel(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const UNDATED_KEY = '0000-00';

/** Parse RELEASES.md into month groups, newest month first, and newest release
 *  first within each month. Undated entries collect into a trailing "Earlier"
 *  group. File order is preserved as the tiebreaker for same-date entries (the
 *  file is authored newest-first). */
export async function loadReleaseGroups(filePath: string): Promise<MonthGroup[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    return [];
  }
  const { content } = matter(raw);
  const sections = splitSections(content);

  // Render bodies (async) preserving order.
  const entries: ReleaseEntry[] = await Promise.all(
    sections.map(async (s) => ({
      version: s.version,
      dateISO: s.dateISO,
      bodyHtml: await renderMarkdown(s.body),
    })),
  );

  const groups = new Map<string, MonthGroup>();
  entries.forEach((entry) => {
    const key = entry.dateISO ? entry.dateISO.slice(0, 7) : UNDATED_KEY;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: entry.dateISO ? monthLabel(entry.dateISO) : 'Earlier',
        releases: [],
      };
      groups.set(key, group);
    }
    group.releases.push(entry);
  });

  // Sort releases within a month: date desc, then original file order (stable).
  for (const group of groups.values()) {
    group.releases.sort((a, b) => {
      const da = a.dateISO ?? '';
      const db = b.dateISO ?? '';
      if (da !== db) return db.localeCompare(da);
      return 0; // Array.prototype.sort is stable → keeps newest-first file order.
    });
  }

  // Sort groups newest month first; the undated key sorts last naturally.
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** Absolute path to RELEASES.md at the repo root, resolved from cwd. */
export function releasesFilePath(): string {
  return path.join(process.cwd(), 'RELEASES.md');
}
