import { beforeEach, describe, expect, it, vi } from 'vitest';

// updatePostContent contract (spec docs/superpowers/specs/
// 2026-07-03-draft-inline-edit-design.md): trims, enforces the createDraft
// limits, requires at least one field, and status-guards the UPDATE to
// draft|approved with an exact count so published/rejected posts — including
// the publish-cron mid-edit race — surface a domain error instead of being
// silently rewritten.

const updateMock = vi.fn();
const eqMock = vi.fn();
const inMock = vi.fn();

// The read side (fetchHomeBlogLead) needs its own chain: select → eq → order ×2
// → limit → maybeSingle. Recorded separately from the update chain so the query
// shape (the NULL-ordering guard and the tiebreak) is assertable.
const readChain: { select: unknown[][]; eq: unknown[][]; order: unknown[][]; limit: unknown[][] } = {
  select: [],
  eq: [],
  order: [],
  limit: [],
};
let readResult: { data: Record<string, unknown> | null; error: { message: string } | null } = {
  data: null,
  error: null,
};

vi.mock('./betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: () => ({
      update: (...args: unknown[]) => {
        updateMock(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            eqMock(...eqArgs);
            return { in: inMock };
          },
        };
      },
      select: (...args: unknown[]) => {
        readChain.select.push(args);
        const chain = {
          eq: (...a: unknown[]) => {
            readChain.eq.push(a);
            return chain;
          },
          order: (...a: unknown[]) => {
            readChain.order.push(a);
            return chain;
          },
          limit: (...a: unknown[]) => {
            readChain.limit.push(a);
            return chain;
          },
          maybeSingle: () => Promise.resolve(readResult),
        };
        return chain;
      },
    }),
  }),
}));
vi.mock('./betting/friends', () => ({ displayNames: vi.fn() }));

import { updatePostContent, normalizeOriginalUrl, fetchHomeBlogLead, TITLE_MAX, BODY_MAX } from './blog';

beforeEach(() => {
  updateMock.mockClear();
  eqMock.mockClear();
  inMock.mockReset();
  inMock.mockResolvedValue({ error: null, count: 1 });
  readChain.select = [];
  readChain.eq = [];
  readChain.order = [];
  readChain.limit = [];
  readResult = { data: null, error: null };
});

describe('updatePostContent', () => {
  it('rejects an empty patch before touching the DB', async () => {
    await expect(updatePostContent('id-1', {})).rejects.toThrow(/at least one/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects empty and over-limit fields before touching the DB', async () => {
    await expect(updatePostContent('id-1', { title: '   ' })).rejects.toThrow(/title/);
    await expect(
      updatePostContent('id-1', { title: 'x'.repeat(TITLE_MAX + 1) }),
    ).rejects.toThrow(/title/);
    await expect(
      updatePostContent('id-1', { body: 'x'.repeat(BODY_MAX + 1) }),
    ).rejects.toThrow(/body/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('trims provided fields and updates only them', async () => {
    await updatePostContent('id-1', { title: '  Silverstone preview  ', body: '  text  ' });
    const [fields] = updateMock.mock.calls[0] as [Record<string, string>];
    expect(fields.title).toBe('Silverstone preview');
    expect(fields.body).toBe('text');
    expect(fields.summary).toBeUndefined();
    expect(fields.updated_at).toBeTruthy();
  });

  // in_review joined the editable set with migration 20260803120000: a submitted
  // post stays editable while it waits on a decision, which is the difference
  // between submitting and publishing. published/rejected remain locked.
  it('status-guards the UPDATE to draft|in_review|approved (exact count)', async () => {
    await updatePostContent('id-1', { title: 'T' });
    expect(updateMock.mock.calls[0][1]).toEqual({ count: 'exact' });
    expect(eqMock).toHaveBeenCalledWith('id', 'id-1');
    expect(inMock).toHaveBeenCalledWith('status', ['draft', 'in_review', 'approved']);
  });

  it('maps a zero-count update (published/rejected — incl. the cron race) to a domain error', async () => {
    inMock.mockResolvedValue({ error: null, count: 0 });
    await expect(updatePostContent('id-1', { title: 'T' })).rejects.toThrow(/not editable/);
  });

  it('surfaces DB errors', async () => {
    inMock.mockResolvedValue({ error: { message: 'boom' }, count: null });
    await expect(updatePostContent('id-1', { title: 'T' })).rejects.toThrow(/boom/);
  });

  // Hero image (0.230.0): editable cover for social share cards. https:// or
  // root-relative only — the OG card and the post <img> embed it verbatim.
  it('accepts an https hero image alone (trimmed) and updates hero_image', async () => {
    await updatePostContent('id-1', { heroImage: '  https://upload.wikimedia.org/spa.jpg  ' });
    const [fields] = updateMock.mock.calls[0] as [Record<string, string | null>];
    expect(fields.hero_image).toBe('https://upload.wikimedia.org/spa.jpg');
    expect(fields.title).toBeUndefined();
  });

  it('accepts a root-relative hero path', async () => {
    await updatePostContent('id-1', { heroImage: '/blog/covers/spa-2026.jpg' });
    const [fields] = updateMock.mock.calls[0] as [Record<string, string | null>];
    expect(fields.hero_image).toBe('/blog/covers/spa-2026.jpg');
  });

  it('clears hero_image on null and on blank', async () => {
    await updatePostContent('id-1', { heroImage: null });
    await updatePostContent('id-1', { heroImage: '   ' });
    for (const call of updateMock.mock.calls) {
      expect((call[0] as Record<string, string | null>).hero_image).toBeNull();
    }
  });

  it('rejects non-https / non-root-relative hero shapes before touching the DB', async () => {
    for (const bad of ['http://insecure.example/x.jpg', 'javascript:alert(1)', '//evil.example/x.jpg', 'covers/x.jpg']) {
      await expect(updatePostContent('id-1', { heroImage: bad })).rejects.toThrow(/hero image/);
    }
    expect(updateMock).not.toHaveBeenCalled();
  });
});

// Import provenance (item 13, migration 20260803130000): the stored URL is
// emitted verbatim as rel=canonical and as the provenance href, so the shape
// gate is stricter than hero_image — absolute https:// with a real host, or
// nothing. Root-relative is meaningless for an EXTERNAL original.
describe('normalizeOriginalUrl', () => {
  it('passes a clean https URL through verbatim (trimmed)', () => {
    expect(normalizeOriginalUrl('  https://www.motorsport.com/f1/news/example-123/  ')).toBe(
      'https://www.motorsport.com/f1/news/example-123/',
    );
  });

  it('maps null / undefined / blank to null (an original piece)', () => {
    expect(normalizeOriginalUrl(null)).toBeNull();
    expect(normalizeOriginalUrl(undefined)).toBeNull();
    expect(normalizeOriginalUrl('   ')).toBeNull();
  });

  it('rejects everything that is not an absolute https URL with a dotted host', () => {
    for (const bad of [
      'http://insecure.example/story',
      'javascript:alert(1)',
      '//protocol-relative.example/story',
      '/blog/our-own-path',
      'motorsport.com/bare-domain',
      'https://localhost/story',
    ]) {
      expect(() => normalizeOriginalUrl(bad)).toThrow(/original URL/);
    }
  });

  it('caps the length at 2048', () => {
    expect(() => normalizeOriginalUrl(`https://a.example/${'x'.repeat(2048)}`)).toThrow(/2048/);
  });
});

// The /app home lead. Fail-soft like the other public readers (publishedPosts et
// al): an empty blog, a DB error or a corrupt timestamp yields null, never a
// throw, because the home page renders around it.
describe('fetchHomeBlogLead', () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'p1',
    slug: 'dutch-gp-preview',
    title: 'Dutch GP preview',
    summary: 'Zandvoort returns.',
    body: words(400),
    series_slug: 'f1',
    tags: [],
    status: 'published',
    author_id: 'user_1',
    publish_at: null,
    published_at: '2026-08-20T10:00:00+00:00',
    hero_image: '/blog/covers/zandvoort.jpg',
    original_url: null,
    created_at: '2026-08-19T09:00:00+00:00',
    ...over,
  });

  it('returns null when nothing is published', async () => {
    expect(await fetchHomeBlogLead()).toBeNull();
  });

  it('returns null on a DB error instead of throwing', async () => {
    readResult = { data: null, error: { message: 'boom' } };
    expect(await fetchHomeBlogLead()).toBeNull();
  });

  // nullsFirst:false because Postgres sorts NULLs FIRST on DESC and a
  // hand-published post keeps published_at null; created_at breaks ties inside a
  // single cron batch, which stamps one timestamp across every post it flips.
  it('queries published only, published_at DESC (nulls last) then created_at DESC, one row', async () => {
    readResult = { data: row(), error: null };
    await fetchHomeBlogLead();
    expect(readChain.eq).toEqual([['status', 'published']]);
    expect(readChain.order).toEqual([
      ['published_at', { ascending: false, nullsFirst: false }],
      ['created_at', { ascending: false }],
    ]);
    expect(readChain.limit).toEqual([[1]]);
  });

  it('maps a row onto the lead shape', async () => {
    readResult = { data: row(), error: null };
    expect(await fetchHomeBlogLead()).toEqual({
      slug: 'dutch-gp-preview',
      title: 'Dutch GP preview',
      summary: 'Zandvoort returns.',
      heroImage: '/blog/covers/zandvoort.jpg',
      seriesSlug: 'f1',
      publishedAtIso: '2026-08-20T10:00:00.000Z',
      readMinutes: 2,
    });
  });

  it('maps a missing hero image and series to null', async () => {
    readResult = { data: row({ hero_image: null, series_slug: null }), error: null };
    const lead = await fetchHomeBlogLead();
    expect(lead?.heroImage).toBeNull();
    expect(lead?.seriesSlug).toBeNull();
  });

  // Only publishDuePosts stamps published_at, so a post flipped by hand has none.
  it('falls back to created_at when published_at is null', async () => {
    readResult = { data: row({ published_at: null }), error: null };
    expect((await fetchHomeBlogLead())?.publishedAtIso).toBe('2026-08-19T09:00:00.000Z');
  });

  it('returns null when neither timestamp is usable', async () => {
    readResult = { data: row({ published_at: null, created_at: 'not-a-date' }), error: null };
    expect(await fetchHomeBlogLead()).toBeNull();
  });

  // 220 wpm, rounded, floored at 1 — the same divisor the post page's eyebrow
  // uses, so one body never reports two different read times. 300 words is the
  // round-DOWN case (1.36 -> 1); 330 is the round-half-up case (1.5 -> 2).
  it('derives readMinutes from the word count at 220 wpm, minimum 1', async () => {
    for (const [count, minutes] of [[0, 1], [1, 1], [220, 1], [300, 1], [330, 2], [440, 2], [660, 3]] as const) {
      readResult = { data: row({ body: words(count) }), error: null };
      expect((await fetchHomeBlogLead())?.readMinutes).toBe(minutes);
    }
  });
});
