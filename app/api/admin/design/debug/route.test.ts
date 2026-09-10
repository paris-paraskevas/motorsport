import { beforeEach, describe, expect, it, vi } from 'vitest';

// GET /api/admin/design/debug (P1.9): a 404 for anyone but an administrator, a
// 400 for a named level that is not one or no target, a 404 where no page
// answers, else the trace at the level asked, the id from cf-ray.

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));
const tracePage = vi.fn();
vi.mock('@/lib/design/debug-trace', () => ({ tracePage: (...args: unknown[]) => tracePage(...args) }));

import { GET } from './route';

const admin = { publicMetadata: { role: 'admin' } };
const req = (query: string, headers: Record<string, string> = {}) => new Request(`https://paddock-tracker.com/api/admin/design/debug${query}`, { headers });

describe('GET /api/admin/design/debug', () => {
  beforeEach(() => {
    currentUser.mockReset();
    tracePage.mockReset();
    currentUser.mockResolvedValue(admin);
    tracePage.mockImplementation(async (target: { path?: string }, level: number, cid: string) => (target.path === '/nowhere' ? null : { cid, level, page: target.path ?? 'revision', startedAt: 'x', totalMs: 1, entries: [] }));
  });

  it('is the 404 for anyone but an administrator, before anything is traced', async () => {
    currentUser.mockResolvedValue(null);
    expect((await GET(req('?path=%2Fcalendar'))).status).toBe(404);
    currentUser.mockResolvedValue({ publicMetadata: { role: 'moderator' } });
    expect((await GET(req('?path=%2Fcalendar'))).status).toBe(404);
    expect(tracePage).not.toHaveBeenCalled();
  });

  it("traces a path at the level asked, Info when none is named, with the Worker's cf-ray as the id; refuses a level that is not one and a request naming no target", async () => {
    const res = await GET(req('?path=%2Fcalendar&level=app', { 'cf-ray': '8a1b2c3d4e5f6a7b-ATH' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ cid: '8a1b2c3d4e5f6a7b', level: 6, page: '/calendar' });
    expect(tracePage).toHaveBeenLastCalledWith({ path: '/calendar' }, 6, '8a1b2c3d4e5f6a7b');
    await GET(req('?path=%2Fcalendar'));
    expect(tracePage).toHaveBeenLastCalledWith({ path: '/calendar' }, 4, expect.stringMatching(/^[0-9a-f]{8}$/));
    await GET(req('?path=%2Fcalendar&level=LEVEL9'));
    expect(tracePage).toHaveBeenLastCalledWith({ path: '/calendar' }, 9, expect.any(String));
    expect((await GET(req('?path=%2Fcalendar&level=loud'))).status).toBe(400);
    expect((await GET(req(''))).status).toBe(400);
    expect((await GET(req('?path=calendar'))).status).toBe(400);
  });

  it('is the 404 where no page answers, and traces a revision by its id', async () => {
    expect((await GET(req('?path=%2Fnowhere'))).status).toBe(404);
    const res = await GET(req('?rev=b1b2c3d4-0000-4000-8000-000000000002&level=full'));
    expect(res.status).toBe(200);
    expect(tracePage).toHaveBeenLastCalledWith({ revisionId: 'b1b2c3d4-0000-4000-8000-000000000002' }, 9, expect.any(String));
    expect((await GET(req('?rev=not-an-id'))).status).toBe(400);
  });
});
