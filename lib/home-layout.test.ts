import { describe, it, expect } from 'vitest';
import {
  parseHomeLayout,
  pinnedLeadSlug,
  DEFAULT_HOME_LAYOUT,
  HOME_BLOCK_IDS,
  type HomeLayout,
} from './home-layout';

// The whole point of this module is that a hand-typed JSON blob can never break
// the site's most-visited page. Every one of these cases must land on the
// automatic composition rather than on an empty or partial home page.
describe('parseHomeLayout — fail-soft matrix', () => {
  const ids = (l: HomeLayout) => l.blocks.map(b => b.id);

  it('returns the default for a missing column', () => {
    expect(parseHomeLayout(undefined)).toEqual(DEFAULT_HOME_LAYOUT);
    expect(parseHomeLayout(null)).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('returns the default when the value is not an array', () => {
    expect(parseHomeLayout({ blog: 'x' })).toEqual(DEFAULT_HOME_LAYOUT);
    expect(parseHomeLayout('blog,live')).toEqual(DEFAULT_HOME_LAYOUT);
    expect(parseHomeLayout(42)).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('returns the default for an empty array', () => {
    expect(parseHomeLayout([])).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('returns the default when nothing in the array is recognisable', () => {
    expect(parseHomeLayout([{ id: 'nope' }, 'blog', null, 7])).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('drops unknown ids but keeps the recognisable ones', () => {
    const out = parseHomeLayout([{ id: 'wire' }, { id: 'not-a-block' }, { id: 'blog' }]);
    expect(ids(out).slice(0, 2)).toEqual(['wire', 'blog']);
    expect(ids(out)).not.toContain('not-a-block');
  });

  it('keeps the first of a duplicated id', () => {
    const out = parseHomeLayout([
      { id: 'blog', pinnedSlug: 'first' },
      { id: 'blog', pinnedSlug: 'second' },
    ]);
    expect(ids(out).filter(i => i === 'blog')).toHaveLength(1);
    expect(pinnedLeadSlug(out)).toBe('first');
  });

  it('appends any block the operator never mentioned, so a new block needs no rewrite', () => {
    const out = parseHomeLayout([{ id: 'wire' }]);
    expect(ids(out)[0]).toBe('wire');
    expect([...ids(out)].sort()).toEqual([...HOME_BLOCK_IDS].sort());
  });

  it('preserves the operator order', () => {
    const out = parseHomeLayout([{ id: 'wire' }, { id: 'result' }, { id: 'live' }, { id: 'blog' }]);
    expect(ids(out)).toEqual(['wire', 'result', 'live', 'blog']);
  });

  it('treats hidden as strictly boolean true', () => {
    const out = parseHomeLayout([
      { id: 'blog', hidden: true },
      { id: 'wire', hidden: 'yes' },
      { id: 'live' },
    ]);
    expect(out.blocks.find(b => b.id === 'blog')?.hidden).toBe(true);
    expect(out.blocks.find(b => b.id === 'wire')?.hidden).toBe(false);
    expect(out.blocks.find(b => b.id === 'live')?.hidden).toBe(false);
  });
});

describe('pinnedLeadSlug', () => {
  it('is null when nothing is pinned', () => {
    expect(pinnedLeadSlug(DEFAULT_HOME_LAYOUT)).toBeNull();
  });

  it('reads the pin off the blog block', () => {
    expect(pinnedLeadSlug(parseHomeLayout([{ id: 'blog', pinnedSlug: 'a-post' }]))).toBe('a-post');
  });

  it('trims, and treats a blank or non-string pin as no pin', () => {
    expect(pinnedLeadSlug(parseHomeLayout([{ id: 'blog', pinnedSlug: '  a-post  ' }]))).toBe('a-post');
    expect(pinnedLeadSlug(parseHomeLayout([{ id: 'blog', pinnedSlug: '   ' }]))).toBeNull();
    expect(pinnedLeadSlug(parseHomeLayout([{ id: 'blog', pinnedSlug: 123 }]))).toBeNull();
  });

  it('ignores a pin set on a block that is not the lead', () => {
    expect(pinnedLeadSlug(parseHomeLayout([{ id: 'wire', pinnedSlug: 'a-post' }]))).toBeNull();
  });
});
