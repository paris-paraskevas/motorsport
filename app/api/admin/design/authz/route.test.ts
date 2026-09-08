import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));

// `rows` answers the reads; `insert` records its payload and answers with
// `inserted` (or `insertError`).
const insert = vi.fn();
let inserted: { data: unknown; error: { code?: string; message: string } | null } = { data: [], error: null };
let rows: { data: unknown; error: { message: string } | null } = { data: [], error: null };
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

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const STAMP = '2026-09-08T18:00:00.505502+00:00';
const seeded = [
  { key: 'public', label: 'Public', type: 'public', value: null, message: null, updated_at: STAMP },
  { key: 'signed_in', label: 'Signed in', type: 'signed_in', value: null, message: 'Sign in to see this.', updated_at: STAMP },
];
const post = (body: unknown) =>
  POST(
    new Request('https://paddock-tracker.com/api/admin/design/authz', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
const mods = { key: 'moderators', label: 'Moderators', type: 'role', value: 'moderator', message: 'For the moderators.' };

describe('/api/admin/design/authz', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    insert.mockReset();
    rows = { data: seeded, error: null };
    inserted = { data: [{ key: 'moderators', label: 'Moderators', type: 'role', value: 'moderator', message: 'For the moderators.', updated_at: STAMP }], error: null };
    process.env.PADDOCK_ENV = 'production';
  });
  afterEach(() => {
    delete process.env.PADDOCK_ENV;
  });

  it('GET is 404 for a non-admin and lists the schemes with their stamps for an admin', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await GET()).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { schemes: { key: string; updatedAt: string | null }[] };
    expect(json.schemes.map(s => s.key)).toEqual(['public', 'signed_in']);
    expect(json.schemes[0].updatedAt).toBe(STAMP);
  });

  it('POST is 404 for a non-admin and 403 off production, before anything is written', async () => {
    currentUser.mockResolvedValue({ id: 'u', publicMetadata: {} });
    expect((await post(mods)).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    delete process.env.PADDOCK_ENV;
    expect((await post(mods)).status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it('POST refuses a bad key, a shipped key, an empty label, a public or unknown check, a role without a role, a domain that is not one, and a long message', async () => {
    expect((await post({ ...mods, key: 'Not A Key' })).status).toBe(400);
    expect((await post({ ...mods, key: 'signed_in' })).status).toBe(409);
    expect((await post({ ...mods, label: ' ' })).status).toBe(400);
    expect((await post({ ...mods, type: 'public' })).status).toBe(400);
    expect((await post({ ...mods, type: 'magic' })).status).toBe(400);
    expect((await post({ ...mods, value: '' })).status).toBe(400);
    expect((await post({ ...mods, type: 'email_domain', value: 'not a domain' })).status).toBe(400);
    expect((await post({ ...mods, message: 'x'.repeat(201) })).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it('POST stores a role scheme with its role, an email scheme with a leading @, and no value for the others', async () => {
    const res = await post(mods);
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({ application_key: 'paddock', key: 'moderators', label: 'Moderators', type: 'role', value: 'moderator', message: 'For the moderators.', updated_by: 'user_admin' });
    const json = (await res.json()) as { scheme: { key: string; type: string; value: string; updatedAt: string } };
    expect(json.scheme).toMatchObject({ key: 'moderators', type: 'role', value: 'moderator', updatedAt: STAMP });
    await post({ key: 'staff', label: 'Staff', type: 'email_domain', value: 'Paddock-Tracker.com', message: '' });
    expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'staff', type: 'email_domain', value: '@paddock-tracker.com', message: null }));
    await post({ key: 'members', label: 'Members', type: 'signed_in', value: 'ignored', message: '' });
    expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'members', type: 'signed_in', value: null }));
  });

  it('POST answers 409 with the current rows when the database says the key exists', async () => {
    inserted = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
    const res = await post(mods);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { current: unknown[] }).current).toHaveLength(2);
  });
});
