import { describe, it, expect } from 'vitest';
import {
  splitReleases,
  dateRangeLabel,
  deriveSpan,
  UNFILED_KEY,
  type ReleaseEntry,
} from './releases';

const md = (...lines: string[]) => lines.join('\n');

describe('splitReleases', () => {
  it('parses a release header, its story, and its entries in file order', () => {
    const secs = splitReleases(
      md(
        'Intro line (discarded).',
        '',
        '# Release 15 · The finishing pass',
        '',
        'The story of the release.',
        '',
        '## 0.334.30 — 2026-08-24',
        '',
        'Body two.',
        '',
        '## 0.334.29 — 2026-08-24',
        '',
        'Body one.',
      ),
    );
    expect(secs).toHaveLength(1);
    expect(secs[0].key).toBe('Release 15');
    expect(secs[0].label).toBe('The finishing pass');
    expect(secs[0].story).toBe('The story of the release.');
    expect(secs[0].entries.map(e => e.version)).toEqual(['0.334.30', '0.334.29']);
    expect(secs[0].entries[0].body).toBe('Body two.');
    expect(secs[0].entries[1].body).toBe('Body one.');
  });

  it('keeps releases separate and newest-first', () => {
    const secs = splitReleases(
      md('# Release 2 · Later', '', 'Story B.', '', '## 0.2.0 — 2026-07-08', '', 'b', '',
         '# Release 1 · Earlier', '', 'Story A.', '', '## 0.1.0 — 2026-07-01', '', 'a'),
    );
    expect(secs.map(s => s.key)).toEqual(['Release 2', 'Release 1']);
    expect(secs[1].story).toBe('Story A.');
    expect(secs[1].entries.map(e => e.version)).toEqual(['0.1.0']);
  });

  // Regression: closing the story on the entry COUNT rather than on "no entry is
  // open" made an empty-story release swallow its first entry's body, so the
  // body rendered twice — once as the story, once as the entry.
  it('does not turn the first entry body into the story when there is no story', () => {
    const secs = splitReleases(md('# Release 1 · No story', '', '## 0.1.0 — 2026-07-01', '', 'Only the entry body.'));
    expect(secs[0].story).toBe('');
    expect(secs[0].entries[0].body).toBe('Only the entry body.');
  });

  // Regression: flushEntry clears the buffer unconditionally, so flushing before
  // capturing the story lost the story of any release that had no entries yet.
  it('keeps the story of a release that has no entries', () => {
    const secs = splitReleases(md('# 1.1 · Announced, unshipped', '', 'Coming next.', '', '# Release 1 · Shipped', '', 's', '', '## 0.1.0 — 2026-07-01', '', 'b'));
    expect(secs[0].key).toBe('1.1');
    expect(secs[0].story).toBe('Coming next.');
    expect(secs[0].entries).toEqual([]);
    expect(secs[1].story).toBe('s');
  });

  it('files an entry that appears above any release header under Unreleased', () => {
    const secs = splitReleases(md('## 0.9.9 — 2026-08-25', '', 'orphan', '', '# Release 1 · Filed', '', '## 0.1.0 — 2026-07-01', '', 'b'));
    expect(secs[0].key).toBe(UNFILED_KEY);
    expect(secs[0].label).toBe('Unreleased');
    expect(secs[0].entries.map(e => e.version)).toEqual(['0.9.9']);
    expect(secs[1].key).toBe('Release 1');
  });

  it('treats a header with no separator as its own label', () => {
    const secs = splitReleases(md('# Paddock Tracker 1.0', '', '## 1.0.0 — 2026-08-25', '', 'b'));
    expect(secs[0].key).toBe('Paddock Tracker 1.0');
    expect(secs[0].label).toBe('Paddock Tracker 1.0');
  });

  it('tolerates a version range (en-dash) and an undated entry', () => {
    const secs = splitReleases(
      md('# Release 1 · First light', '', '## 0.9.0–0.9.7 — 2026-05-16', '', 'x', '', '## Pre-0.8.0', '', 'y'),
    );
    expect(secs[0].entries[0].version).toBe('0.9.0–0.9.7');
    expect(secs[0].entries[0].dateISO).toBe('2026-05-16');
    expect(secs[0].entries[1].version).toBe('Pre-0.8.0');
    expect(secs[0].entries[1].dateISO).toBeNull();
  });
});

describe('dateRangeLabel', () => {
  it('collapses whatever the two dates share', () => {
    expect(dateRangeLabel('2026-08-24', '2026-08-24')).toBe('24 Aug 2026');
    expect(dateRangeLabel('2026-08-20', '2026-08-24')).toBe('20–24 Aug 2026');
    expect(dateRangeLabel('2026-07-23', '2026-08-06')).toBe('23 Jul – 6 Aug 2026');
    expect(dateRangeLabel('2026-12-28', '2027-01-03')).toBe('28 Dec 2026 – 3 Jan 2027');
  });
  it('falls back to the raw strings on an unparseable date', () => {
    expect(dateRangeLabel('not-a-date', 'not-a-date')).toBe('not-a-date');
  });
});

const entry = (version: string, dateISO: string | null): ReleaseEntry => ({
  version,
  dateISO,
  bodyHtml: '',
});

describe('deriveSpan', () => {
  it('reads the span off the entries, oldest to newest', () => {
    const span = deriveSpan([
      entry('0.334.29', '2026-08-24'),
      entry('0.320.0', '2026-08-20'),
      entry('0.310.0', '2026-08-20'),
    ]);
    expect(span.versionSpan).toBe('0.310.0 → 0.334.29');
    expect(span.dateRange).toBe('20–24 Aug 2026');
  });

  it('shows a single version alone rather than an arrow to itself', () => {
    expect(deriveSpan([entry('1.0.0', '2026-08-25')]).versionSpan).toBe('1.0.0');
  });

  it('derives the range from dated entries only', () => {
    const span = deriveSpan([entry('0.8.0', '2026-05-15'), entry('Pre-0.8.0', null)]);
    expect(span.dateRange).toBe('15 May 2026');
    expect(span.versionSpan).toBe('Pre-0.8.0 → 0.8.0');
  });

  it('reports no range when nothing is dated, and nothing at all when empty', () => {
    expect(deriveSpan([entry('Pre-0.8.0', null)]).dateRange).toBeNull();
    expect(deriveSpan([])).toEqual({ dateRange: null, versionSpan: null });
  });
});
