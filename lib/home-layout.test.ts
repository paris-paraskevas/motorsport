import { beforeEach, describe, it, expect, vi } from 'vitest';

// A fake page_layout table for the read helpers. The two reads are told apart
// by what they select: the live read asks for published_at, the draft read for
// created_at. Everything above the reads is pure and never touches this.
let configured = true;
let liveResult: { data: unknown; error: { message: string } | null } = { data: null, error: null };
let draftResult: { data: unknown; error: { message: string } | null } = { data: null, error: null };
vi.mock('./betting/client', () => ({
  isBettingConfigured: () => configured,
  betDb: () => ({
    from: () => ({
      select: (columns: string) => {
        const result = columns.includes('published_at') ? liveResult : draftResult;
        const q = {
          eq: () => q,
          not: () => q,
          is: () => q,
          gt: () => q,
          order: () => q,
          limit: () => q,
          maybeSingle: async () => result,
        };
        return q;
      },
    }),
  }),
}));

import {
  parseHomeLayout,
  visibleBlocks,
  layoutFromParams,
  loadHomeLayoutState,
  loadLiveHomeLayout,
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
      { id: 'blog', hidden: true },
      { id: 'blog' },
    ]);
    expect(ids(out).filter(i => i === 'blog')).toHaveLength(1);
    expect(out.blocks.find(b => b.id === 'blog')?.hidden).toBe(true);
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

describe('the retired pin (P2.24 C)', () => {
  it('a stored pinnedSlug is ignored: the lead post is the Lead story region’s business now', () => {
    expect(parseHomeLayout([{ id: 'blog', pinnedSlug: 'a-post' }]).blocks.find(b => b.id === 'blog')).toEqual({ id: 'blog', hidden: false });
    expect(parseHomeLayout([{ id: 'blog', pinnedSlug: 'a-post' }])).toEqual(parseHomeLayout([{ id: 'blog' }]));
  });
});

describe('visibleBlocks', () => {
  it('returns the operator order with hidden blocks removed', () => {
    const l = parseHomeLayout([
      { id: 'wire' },
      { id: 'blog', hidden: true },
      { id: 'result' },
      { id: 'live' },
    ]);
    expect(visibleBlocks(l)).toEqual(['wire', 'result', 'live']);
  });

  it('falls back to the default order when EVERY block is hidden', () => {
    // A blank home page is not a layout anyone should be able to publish.
    const l = parseHomeLayout(HOME_BLOCK_IDS.map(id => ({ id, hidden: true })));
    expect(visibleBlocks(l)).toEqual([...HOME_BLOCK_IDS]);
  });

  it('is the default order for the default layout', () => {
    expect(visibleBlocks(DEFAULT_HOME_LAYOUT)).toEqual([...HOME_BLOCK_IDS]);
  });
});

describe('layoutFromParams', () => {
  it('reads order and hidden out of the URL', () => {
    const l = layoutFromParams({ order: 'wire,blog,result,live', hidden: 'result' });
    expect(l.blocks.map(b => b.id)).toEqual(['wire', 'blog', 'result', 'live']);
    expect(visibleBlocks(l)).toEqual(['wire', 'blog', 'live']);
  });

  it('is the default layout when nothing is supplied', () => {
    expect(layoutFromParams({})).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('survives a hand-edited URL: junk ids are dropped, real ones kept', () => {
    const l = layoutFromParams({ order: 'wire,nonsense,blog' });
    expect(l.blocks.map(b => b.id).slice(0, 2)).toEqual(['wire', 'blog']);
    expect([...l.blocks.map(b => b.id)].sort()).toEqual([...HOME_BLOCK_IDS].sort());
  });

  it('ignores a hidden id that is not a real block', () => {
    const l = layoutFromParams({ order: 'blog,wire', hidden: 'nonsense' });
    expect(visibleBlocks(l)).toEqual(['blog', 'wire', 'live', 'result']);
  });
});

describe('loadHomeLayoutState — fail-soft reads', () => {
  beforeEach(() => {
    configured = true;
    liveResult = { data: null, error: null };
    draftResult = { data: null, error: null };
  });

  it('is empty when the database is not configured', async () => {
    configured = false;
    expect(await loadHomeLayoutState()).toEqual({ live: null, draft: null });
    expect(await loadLiveHomeLayout()).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('is empty on a query error, and the live layout falls back to the default', async () => {
    liveResult = { data: null, error: { message: 'boom' } };
    draftResult = { data: null, error: { message: 'boom' } };
    expect(await loadHomeLayoutState()).toEqual({ live: null, draft: null });
    expect(await loadLiveHomeLayout()).toEqual(DEFAULT_HOME_LAYOUT);
  });

  it('maps the live and draft rows, parsing their blocks defensively', async () => {
    liveResult = {
      data: { id: 'a', blocks: [{ id: 'wire' }, { id: 'nope' }], published_at: '2026-09-07T20:00:00Z' },
      error: null,
    };
    draftResult = {
      data: { id: 'b', blocks: [{ id: 'blog', hidden: true }], created_at: '2026-09-07T21:00:00Z' },
      error: null,
    };
    const state = await loadHomeLayoutState();
    expect(state.live).toMatchObject({ id: 'a', at: '2026-09-07T20:00:00Z' });
    expect(state.live?.layout.blocks.map(b => b.id)).toEqual(['wire', 'blog', 'live', 'result']);
    expect(state.draft).toMatchObject({ id: 'b', at: '2026-09-07T21:00:00Z' });
    expect(state.draft?.layout.blocks[0]).toMatchObject({ id: 'blog', hidden: true });
    expect(await loadLiveHomeLayout()).toEqual(state.live?.layout);
  });
});
