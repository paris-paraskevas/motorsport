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

/** A calendar week (Monday-start, UTC) within a month, newest release first. */
export interface WeekGroup {
  /** The week's Monday as an ISO date ("YYYY-MM-DD"), or "undated". */
  key: string;
  /** Compact range label, e.g. "6–12 Jul" / "30 Jun – 6 Jul", or "Earlier". */
  label: string;
  releases: ReleaseEntry[];
}

export interface MonthGroup {
  /** Sort/identity key: "YYYY-MM" for dated groups, "0000-00" for undated. */
  key: string;
  /** Human label, e.g. "July 2026" or "Earlier". */
  label: string;
  /** One-line thematic summary of the month's releases, or null if none curated. */
  abstract: string | null;
  /** All the month's releases, newest first (drives the group's release count). */
  releases: ReleaseEntry[];
  /** The releases split into calendar weeks (Monday-start, UTC), newest first. */
  weeks: WeekGroup[];
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

/** Curated one-line summary per calendar month (key = "YYYY-MM", or the undated
 *  key for the "Earlier" bucket). Shown under the month header so a collapsed
 *  month still previews what shipped. Grounded in that month's RELEASES.md
 *  entries — add a line when a new month opens; months without one fall back to
 *  the release count alone (see `abstract: … ?? null`). */
export const MONTH_ABSTRACTS: Record<string, string> = {
  '2026-07':
    'A realistic 3D onboard for qualifying replays, plus a round of polish — a clearer decoder chart, friendlier error pages, and this grouped changelog.',
  '2026-06':
    'The big build month: the predictions & social game (friend leagues, forecast markets), a full F1 telemetry suite (qualifying decoder, race story, 3D ghost cars, leaderboards), customisable home widgets, and the blog pipeline.',
  '2026-05':
    'Foundations — live standings and results across the grid, curated champions for every series, the search-and-discoverability push, legal pages, and the content-authoring workflow.',
  [UNDATED_KEY]: 'The earliest releases, from before these per-version notes began.',
};

/** The Monday (UTC) of the ISO week containing `dateISO`, as "YYYY-MM-DD". ISO
 *  weeks start Monday; Sunday (getUTCDay 0) belongs to the week that began the
 *  previous Monday. UTC throughout to match the rest of the date rendering. */
export function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateISO;
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

/** Compact label for the week beginning `mondayISO`, e.g. "6–12 Jul" (same
 *  month) or "30 Jun – 6 Jul" (spanning months). UTC. */
export function weekLabel(mondayISO: string): string {
  const mon = new Date(`${mondayISO}T00:00:00Z`);
  if (Number.isNaN(mon.getTime())) return mondayISO;
  const sun = new Date(mon);
  sun.setUTCDate(sun.getUTCDate() + 6);
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString('en-GB', {
      day: 'numeric',
      ...(withMonth ? { month: 'short' as const } : {}),
      timeZone: 'UTC',
    });
  return mon.getUTCMonth() === sun.getUTCMonth()
    ? `${fmt(mon, false)}–${fmt(sun, true)}`
    : `${fmt(mon, true)} – ${fmt(sun, true)}`;
}

/** Split a month's (already newest-first) releases into calendar weeks, newest
 *  week first; any undated entries collect into a trailing "Earlier" week. */
export function groupByWeek(releases: ReleaseEntry[]): WeekGroup[] {
  const weeks = new Map<string, WeekGroup>();
  for (const r of releases) {
    const key = r.dateISO ? mondayOf(r.dateISO) : 'undated';
    let wg = weeks.get(key);
    if (!wg) {
      wg = { key, label: key === 'undated' ? 'Earlier' : weekLabel(key), releases: [] };
      weeks.set(key, wg);
    }
    wg.releases.push(r);
  }
  return [...weeks.values()].sort((a, b) => {
    if (a.key === 'undated') return 1;
    if (b.key === 'undated') return -1;
    return b.key.localeCompare(a.key);
  });
}

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
        abstract: MONTH_ABSTRACTS[key] ?? null,
        releases: [],
        weeks: [],
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
    group.weeks = groupByWeek(group.releases);
  }

  // Sort groups newest month first; the undated key sorts last naturally.
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** Absolute path to RELEASES.md at the repo root, resolved from cwd. */
export function releasesFilePath(): string {
  return path.join(process.cwd(), 'RELEASES.md');
}
