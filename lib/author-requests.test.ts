import { beforeEach, describe, expect, it, vi } from 'vitest';

// createAuthorRequest validates before the DB (limits mirror the form), refuses
// a second pending application, and trims what it stores; decideAuthorRequest
// is status-guarded with an exact count so a double-click can't re-decide.

const fromMock = vi.fn();
const insertMock = vi.fn();
const updateMock = vi.fn();
let pendingDupe: { id: string } | null = null;
let decideResult: { error: { message: string } | null; count: number | null } = { error: null, count: 1 };

vi.mock('./betting/client', () => ({
  isBettingConfigured: () => true,
  betDb: () => ({
    from: (table: string) => {
      fromMock(table);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: pendingDupe }) }),
            order: async () => ({ data: [], error: null }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        insert: (row: Record<string, unknown>) => {
          insertMock(row);
          return { select: () => ({ single: async () => ({ data: { id: 'req-1' }, error: null }) }) };
        },
        update: (fields: Record<string, unknown>, opts: unknown) => {
          updateMock(fields, opts);
          return { eq: () => ({ eq: async () => decideResult }) };
        },
      };
    },
  }),
}));
vi.mock('./email', () => ({
  sendEmail: vi.fn(),
  renderBrandedEmail: () => ({ html: '', text: '' }),
}));

import { createAuthorRequest, decideAuthorRequest, PITCH_MAX } from './author-requests';

beforeEach(() => {
  fromMock.mockClear();
  insertMock.mockClear();
  updateMock.mockClear();
  pendingDupe = null;
  decideResult = { error: null, count: 1 };
});

describe('createAuthorRequest', () => {
  it('rejects empty and over-limit fields before touching the DB', async () => {
    await expect(createAuthorRequest('u1', { displayName: '', pitch: 'x' })).rejects.toThrow(/name/);
    await expect(
      createAuthorRequest('u1', { displayName: 'A', pitch: 'x'.repeat(PITCH_MAX + 1) }),
    ).rejects.toThrow(/pitch/);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('refuses a second pending application', async () => {
    pendingDupe = { id: 'existing' };
    await expect(
      createAuthorRequest('u1', { displayName: 'A', pitch: 'let me write' }),
    ).rejects.toThrow(/already in review/);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('inserts trimmed fields, blank optionals as null', async () => {
    const id = await createAuthorRequest('u1', {
      displayName: '  Kimi  ',
      pitch: '  I know where the wet patches are.  ',
      links: '   ',
      sample: undefined,
    });
    expect(id).toBe('req-1');
    const [row] = insertMock.mock.calls[0] as [Record<string, unknown>];
    expect(row.display_name).toBe('Kimi');
    expect(row.pitch).toBe('I know where the wet patches are.');
    expect(row.links).toBeNull();
    expect(row.sample).toBeNull();
    expect(row.clerk_user_id).toBe('u1');
  });
});

describe('decideAuthorRequest', () => {
  it('status-guards with an exact count', async () => {
    await decideAuthorRequest('req-1', 'admin-1', true);
    const [fields, opts] = updateMock.mock.calls[0] as [Record<string, unknown>, unknown];
    expect(fields.status).toBe('approved');
    expect(fields.decided_by).toBe('admin-1');
    expect(opts).toEqual({ count: 'exact' });
  });

  it('maps a zero-count update (already decided) to a domain error', async () => {
    decideResult = { error: null, count: 0 };
    await expect(decideAuthorRequest('req-1', 'admin-1', false)).rejects.toThrow(/not pending/);
  });
});
