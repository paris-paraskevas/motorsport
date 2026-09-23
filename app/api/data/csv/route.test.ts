import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolvePage = vi.fn();
vi.mock('@/lib/design/resolve-page', () => ({ resolvePage: (p: string) => resolvePage(p) }));
const readSource = vi.fn();
vi.mock('@/lib/design/source-read', () => ({ readSource: (ref: unknown) => readSource(ref) }));
const loadViewsFor = vi.fn<(pageId: string, regionId: string) => Promise<unknown[]>>(async () => []);
vi.mock('@/lib/design/views', () => ({ REGION_ID: /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/, loadViewsFor: (p: string, r: string) => loadViewsFor(p, r) }));
// A Response's text() drops a leading byte-order mark as the Fetch standard says; the bytes show it.
const body = async (res: Response) => {
  const bytes = new Uint8Array(await res.clone().arrayBuffer());
  return { bom: [...bytes.slice(0, 3)], text: await res.text() };
};
const currentVisitor = vi.fn();
vi.mock('@/lib/design/authz-evaluate', async () => {
  const actual = await vi.importActual<typeof import('@/lib/design/authz-evaluate')>('@/lib/design/authz-evaluate');
  return { ...actual, currentVisitor: () => currentVisitor() };
});
vi.mock('@/lib/design/authz', async () => {
  const d = await vi.importActual<typeof import('@/lib/design/authz-defaults')>('@/lib/design/authz-defaults');
  return { loadAuthzSchemes: async () => d.DEFAULT_AUTHZ_SCHEMES };
});

import { CSV_MAX, GET, csvOf } from './route';

const ANON = { signedIn: false, role: null, author: false, emails: [] };
const page = { id: 'p1', path: '/history/monza', name: 'Monza', kind: 'row', group: 'editorial', template: 'paddock-standard', authz: 'public', title: null, rendering: 'cached', indexable: true, comments: null, updatedAt: null };
const region = (over: Record<string, unknown> = {}) => ({ id: 't', kind: 'component', component: 'data.region', title: '', position: 'body', seq: 20, column: 1, span: 12, newRow: true, hidden: false, authz: null, settings: { preset: 'drivers', view: 'table', rows: 10, heading: '', download: true }, source: 'standings?series=f1&season=2026', ...over });
const resolved = (regions: unknown[], over: Record<string, unknown> = {}) => ({ kind: 'row', page: { ...page, ...over }, document: { version: 1, actions: [], regions } });
const driver = (position: number, name: string, team: string, points: number) => ({ kind: 'driver', position, name, code: name.slice(0, 3).toUpperCase(), team, points, wins: 0, class: null });
const ROWS = [driver(2, 'George Russell', 'Mercedes', 201), driver(1, 'Andrea Kimi Antonelli', 'Mercedes, AMG', 267), { kind: 'constructor', position: 1, name: 'Mercedes', code: null, team: null, points: 468, wins: 9, class: null }];
const provenance = (rows: number) => ({ ref: { source: 'standings', params: {} }, label: 'x', tier: 'db', keys: [], rows, ms: 1 });
const get = (q: string) => GET(new Request(`https://paddock-tracker.com/api/data/csv?${q}`));

describe('/api/data/csv', () => {
  beforeEach(() => {
    resolvePage.mockReset();
    resolvePage.mockResolvedValue(resolved([region()]));
    readSource.mockReset();
    readSource.mockResolvedValue({ columns: [], total: ROWS.length, rows: ROWS, provenance: provenance(3) });
    loadViewsFor.mockClear();
    loadViewsFor.mockResolvedValue([]);
    currentVisitor.mockReset();
    currentVisitor.mockResolvedValue(ANON);
  });

  it('answers 404 for a path or a region outside the rules, an address with no page, a region that is not a Data region, or one without Download CSV on', async () => {
    expect((await get('page=..%2Fx&region=t')).status).toBe(404);
    expect((await get('page=/history/monza&region=t%20u')).status).toBe(404);
    resolvePage.mockResolvedValue(null);
    expect((await get('page=/history/monza&region=t')).status).toBe(404);
    resolvePage.mockResolvedValue(resolved([region({ id: 'other' })]));
    expect((await get('page=/history/monza&region=t')).status).toBe(404);
    resolvePage.mockResolvedValue(resolved([region({ settings: { preset: 'drivers', view: 'table', rows: 10, heading: '' } })]));
    expect((await get('page=/history/monza&region=t')).status).toBe(404);
    expect(readSource).not.toHaveBeenCalled();
  });

  it('writes the rows as sorted, filtered and columned from the source: RFC 4180 with a byte-order mark and CRLF, a header of the columns’ labels, quoted where a cell needs it; an attachment never cached', async () => {
    const res = await get('page=/history/monza&region=t&sort=-points&cols=name,points,team');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="history-monza-t.csv"');
    expect(res.headers.get('cache-control')).toBe('no-store');
    // The columns in the shape's order whatever the address said, as the served table draws them.
    const b = await body(res);
    expect(b.bom).toEqual([0xef, 0xbb, 0xbf]);
    expect(b.text).toBe('Driver,Team,Pts\r\nAndrea Kimi Antonelli,"Mercedes, AMG",267\r\nGeorge Russell,Mercedes,201\r\n');
    expect(readSource).toHaveBeenCalledWith({ source: 'standings', params: { series: 'f1', season: 2026 } });
    expect(loadViewsFor).not.toHaveBeenCalled();
  });

  it('applies a saved view named in the address under the address’s own parameters, and caps the rows', async () => {
    loadViewsFor.mockResolvedValue([{ key: 'top', pageId: 'p1', regionId: 't', name: 'Top', definition: { cols: ['name'], filters: [{ column: 'team', op: 'eq', value: 'Mercedes' }] }, seq: 10 }]);
    const res = await get('page=/history/monza&region=t&view=top');
    expect(loadViewsFor).toHaveBeenCalledWith('p1', 't');
    expect(await res.text()).toBe('Driver\r\nGeorge Russell\r\n');
    readSource.mockResolvedValue({ columns: [], total: 6000, rows: Array.from({ length: 6000 }, (_, i) => driver(i + 1, `Driver ${i + 1}`, 'Team', 6000 - i)), provenance: provenance(6000) });
    const capped = await (await get('page=/history/monza&region=t&cols=name')).text();
    expect(capped.split('\r\n').length).toBe(CSV_MAX + 2);
  });

  it('checks the page’s and the region’s schemes as the served page does: a refused reader gets 404, a signed-in one the rows', async () => {
    resolvePage.mockResolvedValue(resolved([region()], { authz: 'signed_in' }));
    expect((await get('page=/history/monza&region=t')).status).toBe(404);
    expect(currentVisitor).toHaveBeenCalled();
    resolvePage.mockResolvedValue(resolved([region({ authz: 'signed_in' })]));
    expect((await get('page=/history/monza&region=t')).status).toBe(404);
    currentVisitor.mockResolvedValue({ signedIn: true, role: null, author: false, emails: [] });
    expect((await get('page=/history/monza&region=t')).status).toBe(200);
  });

  it('csvOf writes a link column as its address, absolute for a path of this site, and an empty cell for nothing', () => {
    expect(csvOf([{ key: 'race', label: 'Race', type: 'link', href: 'weekend' }, { key: 'points', label: 'Pts', type: 'number' }], [{ race: 'Italian Grand Prix', weekend: '/series/f1/weekend/16', points: 25 }, { race: 'x', weekend: null, points: null }])).toBe('Race,Pts\r\nhttps://paddock-tracker.com/series/f1/weekend/16,25\r\n,\r\n');
  });
});
