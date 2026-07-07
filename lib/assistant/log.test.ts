import { describe, it, expect } from 'vitest';
import { normalizeQuestion } from './log';

// Frequency counting groups equivalent questions, so normalization is the load-
// bearing bit — verify it collapses the obvious variants to one key.
describe('normalizeQuestion', () => {
  it('lowercases, trims, collapses whitespace, drops trailing punctuation', () => {
    expect(normalizeQuestion('  How   do I   Follow a Series??  ')).toBe('how do i follow a series');
  });

  it('groups case/punctuation variants to the same key', () => {
    const a = normalizeQuestion('Where are the standings?');
    const b = normalizeQuestion('where are the standings');
    expect(a).toBe(b);
  });

  it('caps length', () => {
    expect(normalizeQuestion('x'.repeat(500)).length).toBe(200);
  });
});
