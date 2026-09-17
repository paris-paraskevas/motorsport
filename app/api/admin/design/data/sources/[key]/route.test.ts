import { beforeEach, describe, expect, it, vi } from 'vitest';

// GET /api/admin/design/data/sources/<key>?<parameters> (P2.1): the preview
// of a source through the reader, the parameters read by the catalogue's own
// rule (400 with the problems), the rows capped at fifty. Admin-only; an
// unknown key is 404.

const currentUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ currentUser: () => currentUser() }));
const readSource = vi.fn();
vi.mock('@/lib/design/source-read', () => ({ readSource: (...a: unknown[]) => readSource(...a) }));

import { GET } from './route';

const admin = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const url = (key: string, query = '') => new Request(`http://localhost/api/admin/design/data/sources/${key}${query}`);
const params = (key: string) => ({ params: Promise.resolve({ key }) });
const read = {
  columns: [{ key: 'kind', label: 'Kind', type: 'text' }],
  rows: [{ kind: 'driver', position: 1, name: 'Kimi Antonelli', code: 'ANT', team: 'Mercedes', points: 267, wins: 7, class: null }],
  total: 44,
  provenance: { ref: { source: 'standings', params: { series: 'f1', season: 2026 } }, label: 'Standings · Formula 1 · 2026', tier: 'rows', keys: ['standings:f1', 'f1:standings'], rows: 44, ms: 12, run: { id: 'run-1', status: 'ok', finished: '2026-09-17T12:20:04Z', rows: 44, runner: 'warm-live-data#77' } },
};

describe('GET /api/admin/design/data/sources/[key]', () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue(admin);
    readSource.mockReset();
    readSource.mockResolvedValue(read);
  });

  it('is not found for anyone but an administrator, and for a key the catalogue lacks', async () => {
    currentUser.mockResolvedValue(null);
    expect((await GET(url('standings', '?series=f1&season=2026'), params('standings'))).status).toBe(404);
    currentUser.mockResolvedValue(admin);
    expect((await GET(url('nope'), params('nope'))).status).toBe(404);
    expect(readSource).not.toHaveBeenCalled();
  });

  it('reads the parameters by the catalogue’s rule and answers the preview: the label, the columns, the rows capped at fifty, the total and the provenance', async () => {
    const res = await GET(url('standings', '?series=f1&season=2026'), params('standings'));
    expect(res.status).toBe(200);
    expect(readSource).toHaveBeenCalledWith({ source: 'standings', params: { series: 'f1', season: 2026 } }, { limit: 50 });
    const body = (await res.json()) as { key: string; label: string; columns: unknown[]; rows: unknown[]; total: number; provenance: { tier: string } };
    expect(body.key).toBe('standings');
    expect(body.label).toBe('Standings · Formula 1 · 2026');
    expect(body.columns).toEqual(read.columns);
    expect(body.rows).toEqual(read.rows);
    expect(body.total).toBe(44);
    expect(body.provenance.tier).toBe('rows');
  });

  it('refuses a bad pick in words, the season clamp among them, and reads a source without parameters', async () => {
    const bad = await GET(url('standings', '?series=f1&season=2025'), params('standings'));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Season must be 2026 (the season the loader keeps)', problems: ['Season must be 2026 (the season the loader keeps)'] });
    expect((await GET(url('standings', '?season=2026'), params('standings'))).status).toBe(400);
    expect(readSource).not.toHaveBeenCalled();
    readSource.mockResolvedValue({ ...read, provenance: { ...read.provenance, ref: { source: 'authors', params: {} }, label: 'Authors', tier: 'db', keys: [], run: null } });
    const ok = await GET(url('authors'), params('authors'));
    expect(ok.status).toBe(200);
    expect(readSource).toHaveBeenCalledWith({ source: 'authors', params: {} }, { limit: 50 });
  });
});
