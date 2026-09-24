import { beforeEach, describe, expect, it, vi } from 'vitest';

const currentAccount = vi.fn();
vi.mock('@/lib/auth/server', () => ({ currentAccount: () => currentAccount(), accountId: async () => ((await currentAccount()) as { id?: string } | null)?.id ?? null }));

// A fake store: reads answer per table; insert and update record their
// payloads and answer with what the test set.
type Answer = { data: unknown; error: { code?: string; message: string } | null };
let tables: Record<string, Answer> = {};
const insert = vi.fn();
const update = vi.fn();
let inserted: Answer = { data: { updated_at: '2026-09-17T11:05:00.000001+00:00' }, error: null };
let updated: Answer = { data: [{ updated_at: '2026-09-17T11:06:00.000001+00:00' }], error: null };
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
      return {
        ...chain,
        insert: (payload: unknown) => {
          insert(payload);
          return { select: () => ({ single: async () => inserted }) };
        },
        update: (payload: unknown) => {
          update(payload);
          const w = { eq: () => w, select: () => w, then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(updated).then(resolve, reject) };
          return w;
        },
      };
    },
  }),
}));

import { PUT } from './route';
import { loadOverlays, resetDefinitionsMemo } from '@/lib/design/definitions';

const admin = { id: 'user_admin', role: 'admin' };
const STAMP = '2026-09-17T11:00:00.000001+00:00';
const CAL = 'a1b2c3d4-0000-4000-8000-000000000001';
const accent = { key: 'accent', label: 'Accent', kind: 'colour', default: '#8c1c13', group: 'colours' };
const badge = { key: 'badge', label: 'Badge', kind: 'text', default: '', maxLength: 20 };
const colours = { key: 'colours', title: 'Colours', seq: 10 };
const region = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({ id, kind, title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, ...extra });

const put = (key: string, body: unknown) =>
  PUT(new Request(`https://paddock-tracker.com/api/admin/design/definitions/${key}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ key }) });

describe('PUT /api/admin/design/definitions/[key]', () => {
  beforeEach(() => {
    resetDefinitionsMemo();
    currentAccount.mockReset();
    currentAccount.mockResolvedValue(admin);
    insert.mockReset();
    update.mockReset();
    inserted = { data: { updated_at: '2026-09-17T11:05:00.000001+00:00' }, error: null };
    updated = { data: [{ updated_at: '2026-09-17T11:06:00.000001+00:00' }], error: null };
    tables = { component_definition: { data: [], error: null }, page: { data: [], error: null }, page_revision: { data: [], error: null } };
    process.env.PADDOCK_ENV = 'production';
  });

  it('is not found for anyone but an administrator, for a key the code does not define, and read-only off production', async () => {
    currentAccount.mockResolvedValue(null);
    expect((await put('page.heading', { overlay: {}, updatedAt: null })).status).toBe(404);
    currentAccount.mockResolvedValue(admin);
    expect((await put('nope.x', { overlay: {}, updatedAt: null })).status).toBe(404);
    process.env.PADDOCK_ENV = 'preview';
    expect((await put('page.heading', { overlay: {}, updatedAt: null })).status).toBe(403);
  });

  it('refuses a body without the stamp field, and an overlay outside the rules, in words', async () => {
    expect((await put('page.heading', { overlay: {} })).status).toBe(400);
    const res = await put('page.heading', { overlay: { attributes: [{ ...accent, default: 'red' }], groups: [colours] }, updatedAt: null });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { problems: string[] }).problems).toEqual(['attribute accent: the default: Accent must be a colour as #rrggbb']);
  });

  it('inserts the row for a definition with none (the stamp null), and answers the merged definition with its new stamp', async () => {
    const res = await put('page.heading', { overlay: { attributes: [accent], groups: [colours] }, updatedAt: null });
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({ application_key: 'paddock', key: 'page.heading', overlay: { attributes: [accent], groups: [colours] }, updated_by: 'user_admin' });
    expect(update).not.toHaveBeenCalled();
    const body = (await res.json()) as { ok: boolean; definition: { key: string; updatedAt: string; definition: { settings: { key: string }[] } } };
    expect(body.ok).toBe(true);
    expect(body.definition.key).toBe('page.heading');
    expect(body.definition.definition.settings.map(s => s.key)).toEqual(['text', 'accent']);
  });

  it('a row created meanwhile is a conflict with the current list', async () => {
    inserted = { data: null, error: { code: '23505', message: 'duplicate key' } };
    const res = await put('page.heading', { overlay: { attributes: [accent], groups: [colours] }, updatedAt: null });
    expect(res.status).toBe(409);
    expect((await res.json()) as { current: unknown[] }).toHaveProperty('current');
  });

  it('updates the row on the stamp loaded; a stamp that moved is a conflict', async () => {
    tables.component_definition = { data: [{ key: 'page.heading', overlay: { attributes: [accent], groups: [colours] }, updated_at: STAMP, updated_by: 'user_admin' }], error: null };
    const res = await put('page.heading', { overlay: { attributes: [accent, badge], groups: [colours] }, updatedAt: STAMP });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ overlay: { attributes: [accent, badge], groups: [colours] }, updated_by: 'user_admin' });
    updated = { data: [], error: null };
    expect((await put('page.heading', { overlay: { attributes: [accent, badge], groups: [colours] }, updatedAt: STAMP })).status).toBe(409);
  });

  it('the guard: an attribute a page’s newest or live revision still carries cannot be removed; an unused one can', async () => {
    tables.component_definition = { data: [{ key: 'page.heading', overlay: { attributes: [accent, badge], groups: [colours] }, updated_at: STAMP, updated_by: 'user_admin' }], error: null };
    tables.page = { data: [{ id: CAL, path: '/calendar', name: 'Calendar' }], error: null };
    tables.page_revision = { data: [{ page_id: CAL, created_at: '2026-09-17T10:00:00Z', published_at: null, document: { version: 1, actions: [], regions: [region('heading', 'component', { component: 'page.heading', settings: { text: '', accent: '#123456' } })] } }], error: null };
    const refused = await put('page.heading', { overlay: { attributes: [badge], groups: [colours] }, updatedAt: STAMP });
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { error: string }).error).toBe('Accent is on a page, Calendar: their regions have carried it since they were last saved. It stays while any page carries it.');
    expect(update).not.toHaveBeenCalled();
    const allowed = await put('page.heading', { overlay: { attributes: [accent], groups: [colours] }, updatedAt: STAMP });
    expect(allowed.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('the guard reads the row as it is now, not a memo: an attribute added since this isolate last read the rows is still kept (the reviewer’s scenario)', async () => {
    // This isolate remembers the row without badge…
    tables.component_definition = { data: [{ key: 'page.heading', overlay: { attributes: [accent], groups: [colours] }, updated_at: STAMP, updated_by: 'user_admin' }], error: null };
    await loadOverlays();
    // …then badge is added elsewhere and a page saves a value for it.
    tables.component_definition = { data: [{ key: 'page.heading', overlay: { attributes: [accent, badge], groups: [colours] }, updated_at: STAMP, updated_by: 'user_admin' }], error: null };
    tables.page = { data: [{ id: CAL, path: '/calendar', name: 'Calendar' }], error: null };
    tables.page_revision = { data: [{ page_id: CAL, created_at: '2026-09-17T10:00:00Z', published_at: null, document: { version: 1, actions: [], regions: [region('heading', 'component', { component: 'page.heading', settings: { text: '', accent: '#8c1c13', badge: 'new' } })] } }], error: null };
    const refused = await put('page.heading', { overlay: { attributes: [accent], groups: [colours] }, updatedAt: STAMP });
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { error: string }).error).toMatch(/^Badge is on a page, Calendar/);
    expect(update).not.toHaveBeenCalled();
  });

  it('a row that cannot be read stops the write: no guard, no save', async () => {
    tables.component_definition = { data: null, error: { message: 'down' } };
    const res = await put('page.heading', { overlay: { attributes: [accent], groups: [colours] }, updatedAt: null });
    expect(res.status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
  });
});
