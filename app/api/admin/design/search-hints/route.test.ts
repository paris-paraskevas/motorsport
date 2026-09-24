import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock('@/lib/search-index', () => ({
  buildSearchIndex: async () => [
    { type: 'page', title: 'Calendar', subtitle: 'Every series, one timeline', url: '/calendar', keywords: 'race schedule next' },
    { type: 'tab', title: 'Formula 1 standings', url: '/series/f1/standings', keywords: 'f1 points leader' },
  ],
}));

const insert = vi.fn();
let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
let inserted: { data: unknown; error: { message: string } | null } = { data: [], error: null };
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: () => {
      const read = {
        select: () => read,
        eq: () => read,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(rows).then(resolve, reject),
      };
      return {
        select: () => read,
        insert: (payload: unknown) => {
          insert(payload);
          return { select: async () => inserted };
        },
      };
    },
  }),
}));

import { GET, POST } from './route';

const admin = { id: 'user_admin', role: 'admin' };
const STAMP = '2026-09-08T18:00:00.505502+00:00';
const A = 'a1b2c3d4-0000-4000-8000-000000000001';
const existing = { id: A, question: 'Who leads the F1 standings?', seq: 10, leads_to: '/series/f1/standings', leads_title: 'Formula 1 standings', updated_at: STAMP };
const post = (body: unknown) =>
  POST(
    new Request('https://paddock-tracker.com/api/admin/design/search-hints', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

describe('/api/admin/design/search-hints', () => {
  beforeEach(() => {
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    insert.mockReset();
    revalidatePath.mockReset();
    rows = { data: [existing], error: null };
    inserted = { data: [{ id: 'a1b2c3d4-0000-4000-8000-000000000002', question: 'When is the next race?', seq: 20, leads_to: '/calendar', leads_title: 'Calendar', updated_at: STAMP }], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin and lists the hints in order for an admin', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await GET()).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { hints: { question: string; leadsTitle: string }[] }).hints).toEqual([
      { id: A, question: 'Who leads the F1 standings?', seq: 10, leadsTo: '/series/f1/standings', leadsTitle: 'Formula 1 standings', updatedAt: STAMP },
    ]);
  });

  it('POST is 404 for a non-admin and 403 off production, and refuses an empty or over-long question, before anything is written', async () => {
    currentAccount.mockResolvedValue({ id: 'u' });
    expect((await post({ question: 'When is the next race?' })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await post({ question: 'When is the next race?' })).status).toBe(403);
    process.env.PADDOCK_ENV = 'production';
    expect((await post({ question: '  ' })).status).toBe(400);
    expect((await post({ question: 'x'.repeat(121) })).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('POST asks the search and refuses a question that finds nothing (422), writing nothing', async () => {
    const res = await post({ question: 'zzzz qqqq' });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toMatch(/leads nowhere/);
    expect(insert).not.toHaveBeenCalled();
  });

  it('POST stores a question that finds a page, with where it leads, appended last, and revalidates the layout', async () => {
    const res = await post({ question: '  When is the   next race? ' });
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({
      application_key: 'paddock',
      question: 'When is the next race?',
      seq: 20,
      leads_to: '/calendar',
      leads_title: 'Calendar',
      updated_by: 'user_admin',
    });
    expect(((await res.json()) as { hint: { question: string; leadsTo: string } }).hint).toMatchObject({ question: 'When is the next race?', leadsTo: '/calendar' });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });
});
