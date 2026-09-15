import { describe, expect, it, vi } from 'vitest';
import type { PageDocument, Region } from './page-document';
import type { PageRow } from './pages';

// The Debug trace (P1.9): the acceptance of the slot. A page with Home's six
// components traced at App Trace lists every component with a source and a
// time and the loader run behind it, names the rules that fired for the
// visitor, and at Info keeps the steps and the components alone.

const page: PageRow = {
  id: 'c0de0001-0000-4000-8000-000000000001',
  path: '/',
  name: 'Home',
  kind: 'code',
  served: 'rows',
  group: 'home',
  template: 'paddock-standard',
  authz: 'public',
  title: null,
  rendering: 'cached',
  indexable: true,
  comments: null,
  updatedAt: '2026-09-10T10:00:00Z',
};
const component = (id: string, key: string, over: Record<string, unknown> = {}): Region =>
  ({ id, kind: 'component', component: key, settings: {}, title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, ...over }) as Region;
const text = (id: string, title: string, over: Record<string, unknown> = {}): Region =>
  ({ id, kind: 'static', title, position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'Words.', ...over }) as Region;
const home: PageDocument = {
  version: 2,
  actions: [{ id: 'a1', name: 'Unfold', when: { event: 'click', region: 'lead' }, do: [{ action: 'toggle', region: 'wire' }] }],
  regions: [
    component('lead', 'home.lead'),
    component('live', 'home.live', { seq: 20 }),
    component('result', 'home.result', { seq: 30 }),
    component('changed', 'home.changed', { seq: 40 }),
    component('next', 'home.next', { seq: 50 }),
    component('wire', 'home.wire', { seq: 60, settings: { items: 5 } }),
    text('members', 'Members', { seq: 70, authz: 'signed_in' }),
    text('join', 'Join', { seq: 80, show: 'signed-in' }),
    text('weather', 'Weather', { seq: 90, buildOption: 'weather' }),
    text('old', 'Old note', { seq: 95, commentedOut: true }),
  ],
};
const monza: PageRow = { ...page, id: 'a1b2c3d4-0000-4000-8000-000000000010', path: '/history/monza', name: 'Monza, a history', kind: 'row', served: undefined };

const resolvePage = vi.fn(async (path: string) => (path === '/' ? { kind: 'composed', page, pattern: '/', params: {}, document: home } : null));
vi.mock('./resolve-page', () => ({ resolvePage: (p: string) => resolvePage(p) }));
vi.mock('./live-page', () => ({
  loadRevisionPreview: async (id: string) =>
    id === 'b1b2c3d4-0000-4000-8000-000000000002'
      ? { page: monza, revisionId: id, createdAt: '2026-09-10T11:00:00Z', publishedAt: null, isLive: false, problems: [], document: { version: 2, actions: [], regions: [component('heading', 'page.heading')] } }
      : null,
}));
vi.mock('./authz-evaluate', () => ({ currentVisitor: async () => ({ signedIn: false, role: null, author: false, emails: [] }), allowedKeys: () => new Set<string>() }));
vi.mock('./authz', () => ({ loadAuthzSchemes: async () => [{ key: 'signed_in', label: 'Signed in', type: 'signed_in', message: null }] }));
vi.mock('./build-options', () => ({ loadBuildOptions: async () => ({ ghost_lap_3d: 'include', weather: 'exclude', social: 'include', studio: 'include' }) }));
vi.mock('./component-render', async importOriginal => {
  const mod = await importOriginal<typeof import('./component-render')>();
  return {
    ...mod,
    raceWeekendNow: async () => true,
    renderComponents: async (d: PageDocument, _w: unknown, hooks?: { onRendered?: (id: string, c: string, ms: number, ok: boolean) => void }) => {
      for (const r of d.regions) if (r.kind === 'component') hooks?.onRendered?.(r.id, r.component, r.id === 'wire' ? 41.5 : 12, r.id !== 'result');
      return {};
    },
  };
});
vi.mock('@/lib/source-snapshot', () => ({
  readSnapshotMeta: async () => ({
    'standings:f1': { run: 'warm-live-data#77', at: '2026-09-10T11:20:00.000Z', F: 812, W: 40 },
    'news:aggregate:3': { run: 'warm-live-data#77', at: '2026-09-10T11:21:00.000Z', F: 1200, W: 35 },
    'paddock:home:podium:v2:f1:2026': { run: 'local', at: '2026-09-10T09:00:00.000Z', F: 300, W: 20 },
  }),
}));

import { tracePage } from './debug-trace';

describe('the Debug trace (P1.9)', () => {
  it('lists every component of Home with a source and a time, the rules that fired, and the loader runs behind the sources at App Trace', async () => {
    const r = await tracePage({ path: '/' }, 6, 'cid12345');
    expect(r).not.toBeNull();
    const phases = r!.entries.map(e => e.phase);
    for (const p of ['resolve', 'session', 'authz', 'show', 'build', 'refs', 'render']) expect(phases).toContain(p);
    const renders = r!.entries.filter(e => e.phase.startsWith('render:'));
    expect(renders.map(e => e.phase)).toEqual(['render:lead', 'render:live', 'render:result', 'render:changed', 'render:next', 'render:wire']);
    expect(renders.every(e => e.ms !== undefined && e.src !== undefined && e.src.length > 0)).toBe(true);
    expect(renders.find(e => e.phase === 'render:wire')).toMatchObject({ ms: 41.5, text: 'The wire', src: ['snapshot:news:aggregate:'] });
    expect(renders.find(e => e.phase === 'render:result')!.text).toMatch(/failed/);
    expect(renders.find(e => e.phase === 'render:changed')!.run).toBe('standings:f1 · warm-live-data#77 · 2026-09-10 11:20Z · F 812ms · W 40ms');
    expect(renders.find(e => e.phase === 'render:result')!.run).toContain('paddock:home:podium:v2:f1:2026 · local');
    expect(renders.find(e => e.phase === 'render:next')!.run).toBeUndefined();
    expect(r!.entries.find(e => e.phase === 'authz:members')!.text).toBe('Members: scheme signed_in refused for you');
    expect(r!.entries.find(e => e.phase === 'show:join')!.text).toBe('Join hidden by the rule signed-in');
    expect(r!.entries.find(e => e.phase === 'build:weather')!.text).toBe('Weather excluded by weather');
    // Comment Out (P1.11) leaves at the same step, named apart from the build options.
    expect(r!.entries.find(e => e.phase === 'build:old')!.text).toBe('Old note commented out');
    expect(r!.entries.find(e => e.phase === 'build' && e.text.includes('excluded by a build option'))!.text).toBe('1 region excluded by a build option, 1 commented out');
    expect(r!.entries.find(e => e.phase === 'show' && e.text.includes('hidden by a show rule'))!.text).toContain('1 region hidden by a show rule (signed in: false');
    expect(r!.entries.find(e => e.phase === 'resolve' && e.text.startsWith('Home'))!.text).toBe('Home: 10 regions, 1 dynamic action');
    expect(r).toMatchObject({ cid: 'cid12345', level: 6, page: '/' });
    expect(r!.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("at Info keeps the steps and the components but not a region's verdicts; nothing at a path no page answers; a revision by its id", async () => {
    const info = await tracePage({ path: '/' }, 4, 'c');
    expect(info!.entries.some(e => e.phase.startsWith('authz:') || e.phase.startsWith('show:') || e.phase.startsWith('build:'))).toBe(false);
    expect(info!.entries.filter(e => e.phase.startsWith('render:'))).toHaveLength(6);
    expect(info!.entries.find(e => e.phase === 'render:changed')!.run).toBeUndefined();
    expect(await tracePage({ path: '/nowhere' }, 4, 'c')).toBeNull();
    const rev = await tracePage({ revisionId: 'b1b2c3d4-0000-4000-8000-000000000002' }, 9, 'c');
    expect(rev!.page).toBe('revision b1b2c3d4');
    expect(rev!.entries.map(e => e.phase)).toContain('render:heading');
    expect(rev!.entries.filter(e => e.phase === 'render:heading').map(e => e.text)).toEqual(['Page heading', 'settings {}']);
    expect(await tracePage({ revisionId: 'nope' }, 4, 'c')).toBeNull();
  });
});
