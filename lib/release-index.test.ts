import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseReleaseIndex, releaseSlug } from './release-index';
import { RELEASE_INDEX } from './content-bundle.generated';

// THE RELEASE INDEX (X6 A). RELEASES.md stays out of the Worker bundle (its
// size grows with every push), so the Worker knows the releases only through
// this index: key, label and address slug of every `# ` header, about a
// kilobyte, emitted by scripts/bundle-content.mts. The release pages are
// prerendered at build from the file; the sitemap, regenerated on the Worker
// every six hours, lists them from the index. The drift test at the end is the
// pair to app/(app)/changelog/releases.test.ts's "stays out of the bundle".

const md = (...lines: string[]) => lines.join('\n');
const REAL = fs.readFileSync(path.join(process.cwd(), 'RELEASES.md'), 'utf8');

describe('parseReleaseIndex', () => {
  it('reads every release header in file order, the key and the label split on the separator, the slug from the label', () => {
    const index = parseReleaseIndex(
      md('Intro line.', '', '# 1.0 · Lights out', '', 'The story.', '', '## 1.0.1 — 2026-09-21', '', 'Body.', '', '# Release 15 · The finishing pass', '', '## 0.334.30 — 2026-08-24'),
    );
    expect(index).toEqual([
      { key: '1.0', label: 'Lights out', slug: 'lights-out' },
      { key: 'Release 15', label: 'The finishing pass', slug: 'the-finishing-pass' },
    ]);
  });

  it('takes a header without the separator as key and label both; a `## ` entry is never a release', () => {
    expect(parseReleaseIndex(md('# Pre-release', '## 0.1.0 — 2026-05-01'))).toEqual([{ key: 'Pre-release', label: 'Pre-release', slug: 'pre-release' }]);
    expect(parseReleaseIndex(md('## 0.1.0 — 2026-05-01', 'Body.'))).toEqual([]);
  });

  it('slugs the label, the key when the label gives nothing', () => {
    expect(releaseSlug({ key: 'Release 2', label: 'The calendar tells the truth' })).toBe('the-calendar-tells-the-truth');
    expect(releaseSlug({ key: 'unfiled', label: '···' })).toBe('unfiled');
  });
});

describe('the real RELEASES.md', () => {
  const index = parseReleaseIndex(REAL);

  it('has sixteen or more releases with unique, non-empty slugs, the newest first', () => {
    expect(index.length).toBeGreaterThanOrEqual(16);
    for (const r of index) expect(r.slug, r.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(index.map(r => r.slug)).size).toBe(index.length);
    expect(index[0].slug).toBe('lights-out');
    expect(index.at(-1)?.slug).toBe('first-light');
  });

  it('is bundled as RELEASE_INDEX, in step with the file (out of step: run npx tsx scripts/bundle-content.mts)', () => {
    expect(RELEASE_INDEX).toEqual(index);
  });
});
