import { describe, it, expect } from 'vitest';
import { parseDraftMarkdown } from './blog-draft-md';

const SAMPLE = `<!--
DRAFT — sample preview.
Suggested metadata (DraftInput):
  slug:       motogp-german-grand-prix-2026-preview
  title:      Sachsenring, the title filter
  series:     motogp
  publishAt:  2026-07-09T12:00:00.000Z  (Thu 09 Jul, 15:00 Europe/Athens)
  summary:    A tight title fight heads to the Sachsenring.
-->

# Sachsenring, the title filter

MotoGP reaches the halfway point of its season this weekend.

## A section

More text.
`;

describe('parseDraftMarkdown', () => {
  it('extracts metadata and strips the comment block + leading H1', () => {
    const d = parseDraftMarkdown(SAMPLE);
    expect(d.slug).toBe('motogp-german-grand-prix-2026-preview');
    expect(d.title).toBe('Sachsenring, the title filter');
    expect(d.summary).toBe('A tight title fight heads to the Sachsenring.');
    expect(d.seriesSlug).toBe('motogp');
    expect(d.publishAt).toBe('2026-07-09T12:00:00.000Z'); // trailing note dropped
    expect(d.heroImage).toBeNull();
    expect(d.body.startsWith('MotoGP reaches')).toBe(true); // comment + H1 gone
    expect(d.body).not.toContain('<!--');
    expect(d.body).toContain('## A section');
  });

  it('accepts "excerpt" as a summary synonym', () => {
    const md = SAMPLE.replace('summary:    ', 'excerpt:    ');
    expect(parseDraftMarkdown(md).summary).toBe('A tight title fight heads to the Sachsenring.');
  });

  it('defaults series/hero/publishAt to null when absent', () => {
    const md = `<!--
  slug: some-post
  title: A title
  summary: A summary.
-->
Body text here.`;
    const d = parseDraftMarkdown(md);
    expect(d.seriesSlug).toBeNull();
    expect(d.heroImage).toBeNull();
    expect(d.publishAt).toBeNull();
    expect(d.body).toBe('Body text here.');
  });

  it('throws on a non-kebab slug', () => {
    const md = SAMPLE.replace('motogp-german-grand-prix-2026-preview', 'Bad Slug');
    expect(() => parseDraftMarkdown(md)).toThrow(/kebab/);
  });

  it('throws when the body is empty', () => {
    const md = `<!--
  slug: x-post
  title: T
  summary: S.
-->`;
    expect(() => parseDraftMarkdown(md)).toThrow(/empty article body/);
  });
});
