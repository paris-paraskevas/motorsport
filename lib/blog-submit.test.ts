import { beforeEach, describe, expect, it, vi } from 'vitest';

// The submission loop (migration 20260803120000). `draft` used to do two jobs at
// once: a writer's private workspace AND the review queue, so a half-written save
// notified the operator and writers learned not to save. Now `draft` is private,
// `in_review` is an explicit submission, and only an admin decides.
//
// This harness mocks the query builder rather than the DB, so it asserts the exact
// status guards — the part that makes double-submits and re-decides impossible.

const calls: { update?: unknown; eq: unknown[][]; in: unknown[][]; select?: boolean } = { eq: [], in: [] };
let result: { data?: unknown[] | null; error?: { message: string } | null; count?: number | null } = {};

vi.mock('./betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: () => ({
      update: (fields: unknown, opts: unknown) => {
        calls.update = { fields, opts };
        const chain = {
          eq: (...a: unknown[]) => {
            calls.eq.push(a);
            return chain;
          },
          in: (...a: unknown[]) => {
            calls.in.push(a);
            return Promise.resolve(result);
          },
          select: () => {
            calls.select = true;
            return Promise.resolve(result);
          },
        };
        return chain;
      },
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
    }),
  }),
}));
vi.mock('./betting/friends', () => ({
  displayNames: async () => new Map([['user_1', 'Test Writer']]),
}));

const { submitPost, decidePost, DECIDABLE_STATUSES } = await import('./blog');

beforeEach(() => {
  calls.update = undefined;
  calls.eq = [];
  calls.in = [];
  calls.select = undefined;
  result = { error: null, count: 1, data: [{ id: 'p1', slug: 's', title: 'T', summary: '', body: '', status: 'in_review', author_id: 'user_1', created_at: '2026-08-03T00:00:00Z' }] };
});

describe('submitPost', () => {
  it('moves the post to in_review, guarded to draft only', async () => {
    const post = await submitPost('p1');
    expect((calls.update as { fields: Record<string, unknown> }).fields.status).toBe('in_review');
    expect((calls.update as { opts: unknown }).opts).toEqual({ count: 'exact' });
    expect(calls.eq).toEqual([['id', 'p1'], ['status', 'draft']]);
    expect(post.status).toBe('in_review');
  });

  // A second submit must not produce a second notification.
  it('rejects a re-submit as a domain error when nothing was updated', async () => {
    result = { error: null, count: 0, data: [] };
    await expect(submitPost('p1')).rejects.toThrow(/not a draft/i);
  });

  it('surfaces DB errors', async () => {
    result = { error: { message: 'boom' }, count: null, data: null };
    await expect(submitPost('p1')).rejects.toThrow(/boom/);
  });
});

describe('decidePost', () => {
  // The operator can still approve straight from `draft` — their own hand-authored
  // drafts and scripts/draft-post depend on it — so the guard is a set, not 'draft'.
  it('exposes draft and in_review as the decidable set', () => {
    expect(DECIDABLE_STATUSES).toEqual(['draft', 'in_review']);
  });

  it('rejects using the decidable set, not draft alone', async () => {
    await decidePost('p1', 'admin_1', false);
    expect((calls.update as { fields: Record<string, unknown> }).fields.status).toBe('rejected');
    expect(calls.in).toEqual([['status', DECIDABLE_STATUSES]]);
  });

  it('approves using the decidable set and records who decided', async () => {
    await decidePost('p1', 'admin_1', true, '2026-08-04T10:00:00Z');
    const fields = (calls.update as { fields: Record<string, unknown> }).fields;
    expect(fields.status).toBe('approved');
    expect(fields.approved_by).toBe('admin_1');
    expect(fields.publish_at).toBe('2026-08-04T10:00:00Z');
    expect(calls.in).toEqual([['status', DECIDABLE_STATUSES]]);
  });

  it('refuses to approve without a publish time', async () => {
    await expect(decidePost('p1', 'admin_1', true)).rejects.toThrow(/publish_at required/i);
  });

  it('maps an already-decided post to a domain error', async () => {
    result = { error: null, count: 0, data: [] };
    await expect(decidePost('p1', 'admin_1', true, '2026-08-04T10:00:00Z')).rejects.toThrow(
      /not awaiting a decision/i,
    );
  });
});
