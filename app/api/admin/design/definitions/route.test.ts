import { beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

let tables: Record<string, { data: unknown; error: { message: string } | null }> = {};
vi.mock('@/lib/betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(tables[table] ?? { data: [], error: null }).then(resolve, reject),
      };
      return chain;
    },
  }),
}));

import { GET } from './route';
import { resetDefinitionsMemo } from '@/lib/design/definitions';
import { DEFINITIONS } from '@/lib/design/component-definitions';

const admin = { id: 'user_admin', role: 'admin' };

describe('GET /api/admin/design/definitions', () => {
  beforeEach(() => {
    resetDefinitionsMemo();
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    tables = { component_definition: { data: [], error: null }, page: { data: [], error: null }, page_revision: { data: [], error: null } };
  });

  it('is not found for anyone but an administrator', async () => {
    currentAccount.mockResolvedValue(null);
    expect((await GET()).status).toBe(404);
  });

  it('lists every definition for editing: the code’s, no rows yet, no usage', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { definitions: { key: string; updatedAt: string | null; usedOn: unknown[] }[] };
    expect(body.definitions.map(d => d.key)).toEqual(DEFINITIONS.map(d => d.key));
    expect(body.definitions.every(d => d.updatedAt === null && d.usedOn.length === 0)).toBe(true);
  });

  it('answers 500 in words when the rows cannot be read', async () => {
    tables.component_definition = { data: null, error: { message: 'down' } };
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
