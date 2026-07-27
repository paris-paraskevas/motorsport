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
    }),
  }),
}));
vi.mock('./betting/friends', () => ({ displayNames: vi.fn() }));

import { updatePostContent, TITLE_MAX, BODY_MAX } from './blog';

beforeEach(() => {
  updateMock.mockClear();
  eqMock.mockClear();
  inMock.mockReset();
  inMock.mockResolvedValue({ error: null, count: 1 });
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

  it('status-guards the UPDATE to draft|approved (exact count)', async () => {
    await updatePostContent('id-1', { title: 'T' });
    expect(updateMock.mock.calls[0][1]).toEqual({ count: 'exact' });
    expect(eqMock).toHaveBeenCalledWith('id', 'id-1');
    expect(inMock).toHaveBeenCalledWith('status', ['draft', 'approved']);
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
