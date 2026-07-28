import { describe, it, expect } from 'vitest';
import { slugify, tocFromMarkdown } from './toc';

// The three ToC consumers (DB id injection, MDX heading components, sidebar
// list) all share `slugify`, so a drift here silently breaks anchor links.
describe('slugify', () => {
  it('lowercases and hyphenates Latin headings', () => {
    expect(slugify('MERCEDES')).toBe('mercedes');
    expect(slugify('Racing bulls')).toBe('racing-bulls');
    expect(slugify('Ferrari & Co')).toBe('ferrari-co');
  });

  it('keeps Greek headings instead of collapsing them to the fallback', () => {
    // Regression: `[^a-z0-9]+` stripped every non-Latin character, so a
    // Greek-language post gave EVERY heading the id `section` — one shared
    // anchor, duplicate ids, and a table of contents pointing at one place.
    expect(slugify('Ο ΑΠΟΛΟΓΙΣΜΟΣ')).toBe('ο-απολογισμος');
    expect(slugify('ΘΕΤΙΚΑ')).not.toBe(slugify('ΑΡΝΗΤΙΚΑ'));
  });

  it('folds diacritics so accented and unaccented headings agree', () => {
    expect(slugify('Ο απολογισμός')).toBe('ο-απολογισμος');
    expect(slugify('Ο απολογισμός')).toBe(slugify('Ο ΑΠΟΛΟΓΙΣΜΟΣ'));
    expect(slugify('Café & Co')).toBe('cafe-co');
  });

  it('still falls back when a heading has no letters or digits', () => {
    expect(slugify('---')).toBe('section');
    expect(slugify('')).toBe('section');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  Ο απολογισμός!  ')).toBe('ο-απολογισμος');
  });
});

describe('tocFromMarkdown', () => {
  it('collects h2/h3 in document order with matching ids', () => {
    expect(tocFromMarkdown('## MERCEDES\ntext\n### ΘΕΤΙΚΑ\nmore\n## Ο απολογισμός')).toEqual([
      { id: 'mercedes', text: 'MERCEDES', level: 2 },
      { id: 'θετικα', text: 'ΘΕΤΙΚΑ', level: 3 },
      { id: 'ο-απολογισμος', text: 'Ο απολογισμός', level: 2 },
    ]);
  });

  it('dedupes repeated headings so ids stay unique', () => {
    const toc = tocFromMarkdown('## ΘΕΤΙΚΑ\na\n## ΘΕΤΙΚΑ\nb');
    expect(toc.map(t => t.id)).toEqual(['θετικα', 'θετικα-1']);
  });
});
