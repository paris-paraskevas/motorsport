// @vitest-environment jsdom
//
// The components' server half: each Home component draws from the page's
// assembly with its settings applied, the first page-level component in the
// Body carries the h1 (never a sub region, P1.4), an unknown key draws
// nothing, a renderer that throws draws nothing for its own region only, and
// the race-weekend fact follows the live band.

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { PageDocument, Region } from './page-document';
import * as homeModel from '@/lib/home-model';
import * as sourceRead from './source-read';

vi.mock('next/link', () => ({
  // The anchor as given: the class, an aria-label, and the lead's redundant cover link's aria-hidden and tabIndex (P2.24 A).
  default: ({ href, children, ...rest }: { href: unknown; children: ReactNode; className?: string; 'aria-label'?: string; 'aria-hidden'?: 'true'; tabIndex?: number }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

const model = {
  blog: { slug: 'monza-2026', title: 'Monza, a history', summary: 'A century of speed.', heroImage: null, publishedAtIso: '2026-09-08T10:00:00Z', readMinutes: 6, seriesName: 'Formula 1', seriesColor: '#e10600', ageLabel: '2h ago', suggested: [{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }, { slug: 'c', title: 'C' }] },
  liveWeekends: [{ seriesSlug: 'f1', seriesName: 'Formula 1', color: '#e10600', eventName: 'Italian Grand Prix', href: '/series/f1/weekend/13', nextSession: null, alsoSameDay: [], alsoDayIso: null }],
  alsoRacing: [],
  // P2.9: every weekend under way as a box, in Home's ranked order; MotoGP's is not featured on Home but a page may show it alone.
  liveAll: [
    { seriesSlug: 'f1', seriesName: 'Formula 1', color: '#e10600', eventName: 'Italian Grand Prix', href: '/series/f1/weekend/13', nextSession: null, alsoSameDay: [], alsoDayIso: null },
    { seriesSlug: 'motogp', seriesName: 'MotoGP', color: '#cc0000', eventName: 'Japanese Grand Prix', href: '/series/motogp/weekend/15', nextSession: null, alsoSameDay: [], alsoDayIso: null },
  ],
  result: { seriesSlug: 'f1', seriesName: 'Formula 1', color: '#e10600', raceName: 'Italian Grand Prix', round: 13, dateIso: '2026-09-06T13:00:00Z', podium: [{ position: 1, name: 'Andrea Kimi Antonelli', detail: 'Mercedes' }, { position: 2, name: 'George Russell', detail: 'Mercedes', time: '+3.857' }], margin: '+3.857', weekendHref: '/series/f1/weekend/13' },
  changed: { seriesName: 'Formula 1', leader: { name: 'Andrea Kimi Antonelli', points: 267 }, gapToSecond: 66, top: [1, 2, 3, 4, 5, 6, 7].map(i => ({ position: i, name: `Driver ${i}`, points: 300 - i * 20 })), winnerName: 'Driver 1' },
  next: [{ seriesSlug: 'f1', seriesName: 'Formula 1', color: '#e10600', title: 'Spanish Grand Prix (Madrid)', dateRangeLabel: '11–13 Sept', firstStartIso: null, href: '/series/f1/weekend/14' }],
  wire: [1, 2, 3, 4, 5].map(i => ({ title: `Headline ${i}`, link: `https://example.com/${i}`, sourceHost: 'example.com', ageLabel: `${i}h ago`, seriesName: 'Formula 1', seriesColor: '#e10600' })),
  order: ['blog', 'live', 'result', 'wire'],
};
// Spies on the real module, not a vi.mock factory: the renderers import the
// home model in parallel, one dynamic import per region, and vitest's runner
// hands a factory mock to only the first of concurrent imports of one module
// from one importer; the rest receive the real module (its own comment: "this
// will not work if user does Promise.all(import(), import())"). A spy sits on
// the one namespace every import resolves to.
type HomeModel = Awaited<ReturnType<typeof homeModel.loadHomeModel>>;
vi.spyOn(homeModel, 'loadHomeModel').mockResolvedValue(model as unknown as HomeModel);
const buildWire = vi.spyOn(homeModel, 'buildWire').mockImplementation(async (count: number) => Array.from({ length: count }, (_, i) => ({ title: `More ${i + 1}`, link: `https://example.com/m${i}`, sourceHost: 'example.com', ageLabel: '1h ago', seriesName: 'Formula 1', seriesColor: '#e10600' })));
vi.spyOn(homeModel, 'loadSeriesMeta').mockResolvedValue(new Map([['f1', { name: 'Formula 1', color: '#e10600' }]]));
// The source reader (P2.1), spied on its namespace for the same reason.
const readSource = vi.spyOn(sourceRead, 'readSource').mockImplementation(async ref => ({
  columns: [],
  total: 2,
  rows: [
    { kind: 'driver', position: 1, name: 'Andrea Kimi Antonelli', code: 'ANT', team: 'Mercedes', points: 267, wins: 7, class: null },
    { kind: 'driver', position: 2, name: 'George Russell', code: 'RUS', team: 'Mercedes', points: 201, wins: 2, class: null },
    { kind: 'constructor', position: 1, name: 'Mercedes', code: null, team: null, points: 468, wins: 9, class: null },
  ],
  provenance: { ref, label: 'Standings · Formula 1 · 2026', tier: 'rows', keys: ['standings:f1', 'f1:standings'], rows: 3, ms: 3, run: { id: 'run-1', status: 'ok', finished: '2026-09-17T12:20:04Z', rows: 44, runner: 'warm-live-data#77' } },
}));
const fetchHomeBlogLead = vi.fn(async (slug?: string | null) => (slug === 'pinned-post' ? { slug: 'pinned-post', title: 'The pinned one', summary: 'Pinned.', heroImage: null, publishedAtIso: '2026-09-01T10:00:00Z', readMinutes: 4, seriesSlug: 'f1' } : null));
vi.mock('@/lib/blog', () => ({ fetchHomeBlogLead: (slug?: string | null) => fetchHomeBlogLead(slug) }));
vi.mock('./families/calendar', () => ({
  loadCalendarModel: async () => ({ items: [], roundByKey: { 'f1:14': 14 }, roundNames: { 'f1:14': 'Spanish Grand Prix (Madrid)' }, serverNow: '2026-09-09T12:00:00.000Z' }),
}));
vi.mock('@/components/calendar/CalendarView', () => ({
  CalendarView: (props: { items: unknown[]; serverNow: string; roundNames?: Record<string, string> }) => <div data-calendar={props.serverNow}>{Object.values(props.roundNames ?? {}).join(', ')}</div>,
}));

import { canRender, raceWeekendNow, renderComponents } from './component-render';
import { PRESETS } from './presets';

const region = (id: string, component: string, settings: Record<string, string | number | boolean> = {}, over: Partial<Region> = {}): Region =>
  ({ id, kind: 'component', component, settings, title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, ...over }) as Region;
const doc = (regions: Region[]): PageDocument => ({ version: 1, actions: [], regions });
const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);

describe('renderComponents', () => {
  it('draws each Home component from the assembly, the first in the Body with the h1, and nothing for a key it does not know or the transitional body', async () => {
    const out = await renderComponents(doc([region('result', 'home.result'), region('lead', 'home.lead', {}, { seq: 20 }), region('code', 'page.body', {}, { seq: 30 }), region('odd', 'home.nothing', {}, { seq: 40 })]), { path: '/' });
    expect(Object.keys(out).sort()).toEqual(['lead', 'result']);
    expect(html(out.result)).toMatch(/<h1[^>]*>Andrea Kimi Antonelli wins the Italian Grand Prix<\/h1>/);
    expect(html(out.lead)).toMatch(/<h1[^>]*>.*Monza, a history/);
    expect(canRender('home.wire')).toBe(true);
    expect(canRender('home.nothing')).toBe(false);
  });

  it('P1.4: the h1 goes to the first page-level Body region, never to a sub region that comes first in the document', async () => {
    // Document order: a component inside a parent first, then the page-level
    // component it sits in. firstBodyRegion (page-document.ts) picks the parent.
    const out = await renderComponents(doc([region('inner', 'home.result', {}, { parent: 'story', seq: 5 }), region('story', 'home.result', {}, { seq: 10 })]), { path: '/' });
    expect(Object.keys(out).sort()).toEqual(['inner', 'story']);
    expect(html(out.inner)).toMatch(/<h2[^>]*>Andrea Kimi Antonelli wins the Italian Grand Prix<\/h2>/);
    expect(html(out.inner)).not.toMatch(/<h1/);
    expect(html(out.story)).toMatch(/<h1[^>]*>Andrea Kimi Antonelli wins the Italian Grand Prix<\/h1>/);
  });

  it('tells the Debug trace how each component went: its id, its key, its time, and whether it drew (P1.9)', async () => {
    const seen: [string, string, boolean][] = [];
    await renderComponents(doc([region('result', 'home.result'), region('odd', 'home.nothing', {}, { seq: 20 }), region('code', 'page.body', {}, { seq: 30 })]), { path: '/' }, {
      onRendered: (id, component, ms, ok) => {
        expect(typeof ms).toBe('number');
        seen.push([id, component, ok]);
      },
    });
    expect(seen.sort()).toEqual([
      ['odd', 'home.nothing', false],
      ['result', 'home.result', true],
    ]);
  });

  it('applies the settings: rows on the table, items on the wire (reading more when the page holds fewer), a pinned post and further reading on the lead', async () => {
    const out = await renderComponents(
      doc([region('changed', 'home.changed', { rows: 3 }), region('wire', 'home.wire', { items: 8 }, { seq: 20 }), region('few', 'home.wire', { items: 3 }, { seq: 30 }), region('lead', 'home.lead', { pinned: 'pinned-post', suggested: 1 }, { seq: 40 }), region('next', 'home.next', {}, { seq: 50 }), region('live', 'home.live', {}, { seq: 60 })]),
      { path: '/' },
    );
    expect((html(out.changed).match(/Driver \d/g) ?? []).length).toBe(3);
    expect((html(out.wire).match(/More \d/g) ?? []).length).toBe(8);
    expect(buildWire).toHaveBeenCalledWith(8, expect.any(Map));
    expect((html(out.few).match(/Headline \d/g) ?? []).length).toBe(3);
    const lead = html(out.lead);
    expect(lead).toContain('The pinned one');
    expect((lead.match(/\/blog\/(a|b|c)"/g) ?? []).length).toBe(1);
    expect(html(out.next)).toContain('Spanish Grand Prix (Madrid)');
    expect(html(out.live)).toContain('Italian Grand Prix');
    // Not first in the Body: the result demotes to h2 and the compact size.
    const second = await renderComponents(doc([region('lead', 'home.lead'), region('result', 'home.result', {}, { seq: 20 })]), { path: '/' });
    expect(html(second.result)).toMatch(/<h2[^>]*>Andrea Kimi Antonelli wins/);
  });

  it('P2.1: a component’s Source picks standings · f1 · 2026 and the renderer reads it, telling the trace what it read; without a source the assembly’s table stands', async () => {
    const reads: [string, string, string][] = [];
    const out = await renderComponents(
      doc([region('changed', 'home.changed', { rows: 5 }, { source: 'standings?series=f1&season=2026' } as Partial<Region>), region('plain', 'home.changed', { rows: 3 }, { seq: 20 })]),
      { path: '/history/monza' },
      { onSourceRead: (id, p) => reads.push([id, p.label, p.tier]) },
    );
    expect(readSource).toHaveBeenCalledWith({ source: 'standings', params: { series: 'f1', season: 2026 } });
    const sourced = html(out.changed);
    expect(sourced).toContain('Andrea Kimi Antonelli leads by 66 points');
    expect(sourced).toContain('George Russell');
    expect(sourced).toContain('Formula 1');
    expect(sourced).not.toContain('Driver 1');
    // The constructors' rows are not drivers: two rows in the table.
    expect((sourced.match(/<li /g) ?? []).length).toBe(2);
    expect(html(out.plain)).toContain('Driver 1');
    expect(reads).toEqual([['changed', 'Standings · Formula 1 · 2026', 'rows']]);
    // A source whose rows hold no driver draws nothing, as an empty assembly does.
    readSource.mockResolvedValueOnce({ columns: [], total: 0, rows: [], provenance: { ref: { source: 'standings', params: { series: 'wec', season: 2026 } }, label: 'Standings · FIA WEC · 2026', tier: 'snapshot', keys: ['standings:wec'], rows: 0, ms: 1 } });
    const empty = await renderComponents(doc([region('changed', 'home.changed', {}, { source: 'standings?series=wec&season=2026' } as Partial<Region>)]), { path: '/history/monza' });
    expect(empty.changed).toBeNull();
  });

  it('P2.2: the Data region draws a preset’s table from its Source: F1’s Constructors and MotoGP’s Drivers from one region kind, the heading the preset’s or the region’s own, the first in the Body with the h1, the columns by type', async () => {
    const reads: string[] = [];
    const out = await renderComponents(
      doc([
        region('teams', 'data.region', { preset: 'constructors', view: 'table', rows: 10, heading: '' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>),
        region('riders', 'data.region', { preset: 'drivers', view: 'table', rows: 1, heading: 'Riders' }, { seq: 20, source: 'standings?series=motogp&season=2026' } as Partial<Region>),
      ]),
      { path: '/history/monza' },
      { onSourceRead: (id, p) => reads.push(`${id}:${p.tier}`) },
    );
    const teams = html(out.teams);
    expect(teams).toMatch(/<h1[^>]*>Constructors<\/h1>/);
    expect(teams).toContain('<caption class="sr-only">Constructors</caption>');
    expect(teams).toMatch(/<th[^>]*>Constructor<\/th>/);
    expect(teams).toContain('Mercedes');
    expect(teams).toContain('468');
    expect(teams).not.toContain('Andrea Kimi Antonelli');
    const riders = html(out.riders);
    expect(riders).toMatch(/<h2[^>]*>Riders<\/h2>/);
    expect(riders).toMatch(/<th[^>]*>Driver<\/th>/);
    expect(riders).toContain('Andrea Kimi Antonelli');
    expect(riders).toContain('ANT');
    expect(riders).not.toContain('George Russell');
    expect(reads).toEqual(['teams:rows', 'riders:rows']);
    // The gap and the share columns against the leader: the leader dashes, the rest count down; the bar's width is the share.
    const two = html((await renderComponents(doc([region('d', 'data.region', { preset: 'drivers', view: 'table', rows: 10, heading: '' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' })).d);
    expect(two).toContain('−66');
    expect(two).toContain('width:75%');
    expect((two.match(/<tr/g) ?? []).length).toBe(3);
  });

  it('P2.2, the acceptance’s test per preset: every one of the twenty-six standings presets draws its table from a fixture of its shape, headed as the site heads it, the name column labelled as it says, its own class’s first row first', async () => {
    const standings = PRESETS.filter(p => p.source === 'standings');
    expect(standings).toHaveLength(26);
    for (const preset of standings) {
      const cls = preset.where.class ?? null;
      const kind = preset.where.kind ?? 'driver';
      const other = preset.shape === 'driver-rows' ? 'manufacturer' : 'driver';
      // One fixture per shape, tagged with the preset's class, beside a row of another kind and, for a class family, of another class; neither shows.
      const rows: Record<string, string | number | null>[] = [
        { kind, position: 2, name: `${preset.key} second`, code: preset.shape === 'driver-rows' ? 'SEC' : null, team: preset.shape === 'driver-rows' ? 'Team B' : null, points: 80, wins: 1, class: cls },
        { kind, position: 1, name: `${preset.key} leader`, code: preset.shape === 'driver-rows' ? 'LEA' : null, team: preset.shape === 'driver-rows' ? 'Team A' : null, points: 100, wins: 3, class: cls },
        { kind: other, position: 1, name: 'Elsewhere', code: null, team: 'T', points: 999, wins: null, class: cls },
        ...(cls ? [{ kind, position: 1, name: 'Another class', code: null, team: null, points: 500, wins: null, class: 'Other' }] : []),
      ];
      const series = preset.series[0];
      readSource.mockResolvedValueOnce({ columns: [], total: rows.length, rows, provenance: { ref: { source: 'standings', params: { series, season: 2026 } }, label: `Standings · ${series} · 2026`, tier: 'snapshot', keys: [], rows: rows.length, ms: 1 } });
      const out = await renderComponents(doc([region('r', 'data.region', { preset: preset.key, view: 'table', rows: 10, heading: '' }, { source: `standings?series=${series}&season=2026` } as Partial<Region>)]), { path: '/x' });
      const table = html(out.r);
      expect(table, preset.key).toContain(`<caption class="sr-only">${preset.name}</caption>`);
      expect(table, preset.key).toMatch(new RegExp(`<th[^>]*>${preset.nameLabel}</th>`));
      const first = table.indexOf(`${preset.key} leader`);
      const second = table.indexOf(`${preset.key} second`);
      expect(first, preset.key).toBeGreaterThan(-1);
      expect(second, preset.key).toBeGreaterThan(first);
      expect(table, preset.key).not.toContain('Elsewhere');
      expect(table, preset.key).not.toContain('Another class');
      expect(table, preset.key).toContain('−20');
    }
  });

  it('P2.2: the same source flips to cards; a family preset filters its class; no Source draws nothing; a preset that waits for the Rounds view draws nothing', async () => {
    const cards = html((await renderComponents(doc([region('c', 'data.region', { preset: 'drivers', view: 'cards', rows: 10, heading: '' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' })).c);
    expect(cards).not.toContain('<table');
    expect(cards).toContain('Andrea Kimi Antonelli');
    expect(cards).toContain('Mercedes');
    expect(cards).toContain('267');
    expect((cards.match(/<li /g) ?? []).length).toBe(2);
    readSource.mockResolvedValueOnce({
      columns: [],
      total: 3,
      rows: [
        { kind: 'driver', position: 1, name: 'Estre Campbell Vanthoor', code: null, team: 'Porsche #6', points: 121, wins: null, class: 'Hypercar' },
        { kind: 'manufacturer', position: 1, name: 'Porsche', code: null, team: null, points: 150, wins: null, class: 'Hypercar' },
        { kind: 'driver', position: 1, name: 'Pier Guidi', code: null, team: 'AF Corse #51', points: 100, wins: null, class: 'LMGT3' },
      ],
      provenance: { ref: { source: 'standings', params: { series: 'wec', season: 2026 } }, label: 'Standings · FIA WEC · 2026', tier: 'snapshot', keys: ['standings:wec'], rows: 3, ms: 2 },
    });
    const wec = html((await renderComponents(doc([region('w', 'data.region', { preset: 'wec-hypercar-drivers', view: 'table', rows: 10, heading: '' }, { source: 'standings?series=wec&season=2026' } as Partial<Region>)]), { path: '/x' })).w);
    expect(wec).toContain('Hypercar — Drivers');
    expect(wec).toContain('Estre Campbell Vanthoor');
    expect(wec).not.toContain('Pier Guidi');
    expect(wec).not.toContain('>Porsche<');
    const none = await renderComponents(doc([region('n', 'data.region', { preset: 'drivers', view: 'table', rows: 10, heading: '' })]), { path: '/x' });
    expect(none.n).toBeNull();
    // The List view on a standings preset is the compact list: position, name, points; no table.
    const list = html((await renderComponents(doc([region('s', 'data.region', { preset: 'drivers', view: 'list', rows: 10, heading: '' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' })).s);
    expect(list).not.toContain('<table');
    expect(list).not.toContain('<details');
    expect((list.match(/<li /g) ?? []).length).toBe(2);
    expect(list).toContain('Andrea Kimi Antonelli');
    expect(list).toContain('267');
  });

  // P2.2 B1: the results side. A fixture per results shape; the seven presets each draw the Rounds layout the site draws.
  const raceRow = (over: Record<string, string | number | null>) => ({ round: 1, race: 'Australian Grand Prix', raceId: null, date: '2026-03-08T05:00:00.000Z', circuit: 'Albert Park', class: null, session: 'race', position: 1, driver: 'Andrea Kimi Antonelli', code: 'ANT', car: null, team: 'Mercedes', vehicle: null, manufacturer: null, laps: null, status: 'Finished', time: '1:31:04.2', gap: null, points: 25, weekend: '/series/f1/weekend/1', ...over });
  const carRow = (over: Record<string, string | number | null>) => ({ round: 1, race: 'Rolex 24 at Daytona', raceId: null, date: '2026-01-25T00:00:00.000Z', circuit: 'Daytona', class: 'GTP', session: 'race', position: 1, driver: 'Nasr Tandy', code: null, car: '7', team: 'Porsche Penske Motorsport', vehicle: 'Porsche 963', manufacturer: 'Porsche', laps: 781, status: 'Classified', time: null, gap: null, points: null, weekend: null, ...over });
  const cupRow = (over: Record<string, string | number | null>) => ({ round: 2, race: 'Brands Hatch Race 1', raceId: 501, date: null, circuit: null, class: 'Pro Cup', session: 'race', position: 1, driver: 'Vanthoor · Weerts', code: null, car: '32', team: 'Team WRT', vehicle: 'BMW M4 GT3', manufacturer: null, laps: 40, status: 'Classified', time: '1:00:01.234', gap: null, points: null, weekend: '/series/gt-world/weekend/2', ...over });
  const results = (series: string, rows: Record<string, string | number | null>[]) => {
    readSource.mockResolvedValueOnce({ columns: [], total: rows.length, rows, provenance: { ref: { source: 'results', params: { series, season: 2026 } }, label: `Results · ${series} · 2026`, tier: 'snapshot', keys: [`results:${series}`], rows: rows.length, ms: 2 } });
  };

  /** Draws a results preset from a fixture of its shape, in the List (the Rounds layout) unless another view is named, Rows 50 unless a count is, with any other settings given. */
  const draw = async (preset: string, series: string, rows: Record<string, string | number | null>[], view = 'list', count = 50, extra: Record<string, string | number | boolean> = {}) => {
    results(series, rows);
    const out = await renderComponents(doc([region('r', 'data.region', { preset, view, rows: count, heading: '', ...extra }, { source: `results?series=${series}&season=2026` } as Partial<Region>)]), { path: '/x' });
    return html(out.r);
  };

  it('P2.2 B1, the test per preset: every one of the seven results presets draws the Rounds layout from a fixture of its shape: a round or class per fold with its chip, its title linked to the weekend page, the winner in the meta line, the entries as the site draws them; a winners-only round flat', async () => {
    // Season results (F1): two rounds, the newer first; round 2's race has no weekend page.
    const f1 = await draw('season-results', 'f1', [
      raceRow({}),
      raceRow({ position: 2, driver: 'George Russell', code: 'RUS', time: '+4.1s', points: 18 }),
      raceRow({ round: 2, race: 'Chinese Grand Prix', circuit: 'Shanghai', date: '2026-03-15T07:00:00.000Z', driver: 'Lando Norris', code: 'NOR', team: 'McLaren', weekend: null }),
      raceRow({ round: 2, race: 'Chinese Grand Prix Sprint', session: 'sprint', driver: 'Oscar Piastri', code: 'PIA', team: 'McLaren', weekend: null }),
    ]);
    expect(f1).toMatch(/<h1[^>]*>Season results<\/h1>/);
    expect((f1.match(/<details/g) ?? []).length).toBe(2);
    expect(f1.indexOf('Chinese Grand Prix')).toBeLessThan(f1.indexOf('Australian Grand Prix'));
    expect(f1).not.toContain('Oscar Piastri');
    expect(f1).toContain('R2');
    expect(f1).toContain('href="/series/f1/weekend/1"');
    expect(f1).not.toContain('href="/series/f1/weekend/2"');
    expect(f1).toContain('WIN');
    expect(f1).toContain('Andrea Kimi Antonelli — Mercedes');
    expect(f1).toContain('8 Mar 2026');
    expect(f1).toContain('ANT');
    expect(f1).toContain('+4.1s');
    expect(f1).toContain('>18<');
    // Feature and Sprint races (F2): each preset its session only.
    const f2rows = [raceRow({ race: 'Melbourne Feature Race', session: 'feature', driver: 'Nikola Tsolov', code: 'TSO', team: 'Campos Racing', weekend: null }), raceRow({ race: 'Melbourne Sprint Race', session: 'sprint', driver: 'Leonardo Fornaroli', code: 'FOR', team: 'Invicta Racing', points: 10, weekend: null })];
    const feature = await draw('feature-races', 'f2', f2rows);
    expect(feature).toContain('Feature races');
    expect(feature).toContain('Nikola Tsolov');
    expect(feature).not.toContain('Fornaroli');
    const sprint = await draw('sprint-races', 'f2', f2rows);
    expect(sprint).toContain('Sprint races');
    expect(sprint).toContain('Leonardo Fornaroli');
    expect(sprint).not.toContain('Tsolov');
    // Overall winners (NLS): one winner per round, drawn flat.
    const nls = await draw('overall-winners', 'nls', [raceRow({ race: 'NLS 1', circuit: 'Nürburgring', driver: 'Crew One', code: null, team: 'Team One', status: 'Winner', time: null, points: 0, weekend: null })]);
    expect(nls).toContain('Overall winners');
    expect(nls).not.toContain('<details');
    expect(nls).toContain('NLS 1');
    expect(nls).toContain('Crew One — Team One');
    // Season results · IMSA and · WEC: a fold per round and class, the car rows.
    const imsa = await draw('season-results-imsa', 'imsa', [carRow({}), carRow({ position: 2, car: '6', driver: 'Campbell Jaminet', gap: '+2.5', laps: 780 }), carRow({ class: 'GTD', car: '1', driver: null, team: 'Paul Miller Racing', vehicle: 'BMW M4 GT3 EVO', manufacturer: 'BMW', laps: 700 })]);
    expect(imsa).toContain('Season results · IMSA');
    expect((imsa.match(/<details/g) ?? []).length).toBe(2);
    expect(imsa).toContain('Rolex 24 at Daytona — GTP');
    expect(imsa).toContain('Rolex 24 at Daytona — GTD');
    expect(imsa).toContain('#7');
    expect(imsa).toContain('+2.5');
    expect(imsa).toContain('Porsche Penske Motorsport · Porsche 963');
    expect(imsa).toContain('Nasr Tandy — Porsche Penske Motorsport');
    // A GTD entry without a crew names its team alone in the row and the meta line, as the site does.
    expect(imsa).toContain('Paul Miller Racing');
    expect(imsa).not.toContain('Paul Miller Racing — Paul Miller Racing');
    const wec = await draw('season-results-wec', 'wec', [carRow({ round: 3, race: '24 Hours of Le Mans', circuit: null, class: 'Hypercar', car: '6', driver: 'Estre Campbell Vanthoor', gap: '24:00:12.345', laps: 387, date: '2026-06-14T00:00:00.000Z' })]);
    expect(wec).toContain('Season results · WEC');
    expect(wec).toContain('24 Hours of Le Mans — Hypercar');
    expect(wec).toContain('24:00:12.345');
    expect(wec).toContain('14 Jun 2026');
    // Season results · GT World: a fold per race and cup; a race without a round shows the dot chip and no link.
    const gt = await draw('season-results-gt-world', 'gt-world', [cupRow({}), cupRow({ class: 'Gold Cup', car: '99', driver: 'A · B', team: 'Gold Team', vehicle: 'Audi R8', gap: '+10.0', time: null }), cupRow({ round: null, raceId: 777, race: 'Spa Race', driver: 'C · D · E', car: '51', team: 'AF Corse', vehicle: 'Ferrari 296', laps: 540, time: null, weekend: null })]);
    expect(gt).toContain('Season results · GT World');
    expect((gt.match(/<details/g) ?? []).length).toBe(3);
    expect(gt).toContain('Brands Hatch Race 1 — Pro Cup');
    expect(gt).toContain('Brands Hatch Race 1 — Gold Cup');
    expect(gt).toContain('Spa Race — Pro Cup');
    expect(gt).toContain('href="/series/gt-world/weekend/2"');
    expect(gt).toContain('#32');
    expect(gt).toContain('Team WRT · BMW M4 GT3');
    expect(gt).toContain('1:00:01.234');
    expect(gt).toContain('+10.0');
    expect(gt).toContain('Vanthoor · Weerts — Team WRT');
  });

  it('P2.2 B1: the same results source draws as a flat table with the race linked to its weekend page (plain text where none exists) and the date as the site formats it, and as cards', async () => {
    const rows = [raceRow({}), raceRow({ position: 2, driver: 'George Russell', code: 'RUS', time: '+4.1s', points: 18 }), raceRow({ round: 2, race: 'Chinese Grand Prix', circuit: 'Shanghai', driver: 'Lando Norris', code: 'NOR', team: 'McLaren', weekend: null })];
    results('f1', rows);
    const table = html((await renderComponents(doc([region('t', 'data.region', { preset: 'season-results', view: 'table', rows: 10, heading: 'Results' }, { source: 'results?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' })).t);
    expect(table).toContain('<caption class="sr-only">Results</caption>');
    expect(table).toMatch(/<th[^>]*>Race<\/th>/);
    expect(table).toMatch(/<th[^>]*>Driver<\/th>/);
    expect(table).toContain('<a href="/series/f1/weekend/1"');
    // A round without a weekend page draws its race as plain text: the link column's other branch.
    expect(table).toMatch(/<td[^>]*>Chinese Grand Prix<\/td>/);
    expect(table).not.toContain('/series/f1/weekend/2');
    expect(table).toContain('8 Mar 2026');
    expect((table.match(/<tr/g) ?? []).length).toBe(4);
    expect(table).not.toContain('<details');
    results('f1', rows);
    const cards = html((await renderComponents(doc([region('c', 'data.region', { preset: 'season-results', view: 'cards', rows: 10, heading: '' }, { source: 'results?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' })).c);
    expect(cards).not.toContain('<table');
    expect((cards.match(/<li /g) ?? []).length).toBe(3);
    expect(cards).toContain('George Russell');
    expect(cards).toContain('Mercedes');
  });

  it('P2.2 B2, the Timeline per results preset: every one of the seven draws one entry per race (or race and class), newest first, on a rail, with the date or the round chip, the title linked to the weekend page, the WIN line and the winner’s initials (APEX Timeline; Avatar); Rows counts races; a race without a position-1 row takes its first', async () => {
    const f1 = await draw('season-results', 'f1', [raceRow({}), raceRow({ position: 2, driver: 'George Russell', code: 'RUS', time: '+4.1s', points: 18 }), raceRow({ round: 2, race: 'Chinese Grand Prix', circuit: 'Shanghai', date: '2026-03-15T07:00:00.000Z', driver: 'Lando Norris', code: 'NOR', team: 'McLaren', weekend: null })], 'timeline');
    expect(f1).not.toContain('<table');
    expect(f1).not.toContain('<details');
    expect((f1.match(/<li /g) ?? []).length).toBe(2);
    expect(f1.indexOf('Chinese Grand Prix')).toBeLessThan(f1.indexOf('Australian Grand Prix'));
    expect(f1).toContain('15 Mar 2026');
    expect(f1).toContain('8 Mar 2026');
    expect(f1).toContain('<a href="/series/f1/weekend/1"');
    expect(f1).toMatch(/WIN<\/span> <span[^>]*>Andrea Kimi Antonelli — Mercedes</);
    expect(f1).toMatch(/WIN<\/span> <span[^>]*>Lando Norris — McLaren</);
    expect(f1).toContain('>AA<');
    expect(f1).toContain('>LN<');
    // Rows counts races.
    const one = await draw('season-results', 'f1', [raceRow({}), raceRow({ round: 2, race: 'Chinese Grand Prix', driver: 'Lando Norris', weekend: null })], 'timeline', 1);
    expect((one.match(/<li /g) ?? []).length).toBe(1);
    expect(one).toContain('Chinese Grand Prix');
    // F2: the session filter holds on the Timeline too.
    const f2 = await draw('feature-races', 'f2', [raceRow({ race: 'Melbourne Feature Race', session: 'feature', driver: 'Nikola Tsolov', code: 'TSO', team: 'Campos Racing', weekend: null }), raceRow({ race: 'Melbourne Sprint Race', session: 'sprint', driver: 'Leonardo Fornaroli', weekend: null })], 'timeline');
    expect((f2.match(/<li /g) ?? []).length).toBe(1);
    expect(f2).toContain('Melbourne Feature Race');
    expect(f2).toContain('>NT<');
    // NLS: a winners-only round is one entry, its crew the WIN line.
    const nls = await draw('overall-winners', 'nls', [raceRow({ race: 'NLS 1', circuit: 'Nürburgring', driver: 'Crew One', code: null, team: 'Team One', status: 'Winner', time: null, points: 0, weekend: null })], 'timeline');
    expect((nls.match(/<li /g) ?? []).length).toBe(1);
    expect(nls).toMatch(/WIN<\/span> <span[^>]*>Crew One — Team One</);
    // IMSA and WEC: an entry per round and class; a crew's initials are the first person's.
    const imsa = await draw('season-results-imsa', 'imsa', [carRow({}), carRow({ position: 2, driver: 'Campbell Jaminet', car: '6', gap: '+2.5' }), carRow({ class: 'GTD', driver: 'Ward Ellis', car: '1', team: 'Team One' })], 'timeline');
    expect((imsa.match(/<li /g) ?? []).length).toBe(2);
    expect(imsa).toContain('Rolex 24 at Daytona — GTP');
    expect(imsa).toContain('Rolex 24 at Daytona — GTD');
    expect(imsa).toContain('25 Jan 2026');
    expect(imsa).toContain('>NT<');
    const wec = await draw('season-results-wec', 'wec', [carRow({ round: 3, race: '24 Hours of Le Mans', class: 'Hypercar', driver: 'ANTONIO FUOCO, MIGUEL MOLINA, NICKLAS NIELSEN', car: '50', team: 'FERRARI AF CORSE', gap: '24:00:12.345', date: '2026-06-14T00:00:00.000Z' })], 'timeline');
    expect(wec).toContain('24 Hours of Le Mans — Hypercar');
    expect(wec).toContain('14 Jun 2026');
    expect(wec).toContain('>AF<');
    // GT World: no date, the round chip stands in ("·" without a round); a crew joined by the site's dot.
    const gt = await draw('season-results-gt-world', 'gt-world', [cupRow({ driver: 'Thierry Vermeulen · Ben Green' }), cupRow({ class: 'Gold Cup', car: '99', driver: 'A · B', team: 'Gold Team', vehicle: 'Audi R8', gap: '+10.0', time: null }), cupRow({ round: null, raceId: 777, race: 'Spa Race', driver: 'C · D · E', car: '51', team: 'AF Corse', vehicle: 'Ferrari 296', laps: 540, time: null, weekend: null })], 'timeline');
    expect((gt.match(/<li /g) ?? []).length).toBe(3);
    expect(gt).toContain('Brands Hatch Race 1 — Pro Cup');
    expect(gt).toContain('Brands Hatch Race 1 — Gold Cup');
    expect(gt).toContain('>R2<');
    expect(gt).toContain('>·<');
    expect(gt).toContain('>TV<');
    expect(gt).toContain('<a href="/series/gt-world/weekend/2"');
    expect(gt).not.toMatch(/\d{1,2} \w{3} 20\d\d/);
    // A race whose classification has no position-1 row: its first row leads.
    const noWinner = await draw('season-results', 'f1', [raceRow({ position: 2, driver: 'George Russell', code: 'RUS' }), raceRow({ position: 3, driver: 'Lando Norris', code: 'NOR', team: 'McLaren' })], 'timeline');
    expect(noWinner).toMatch(/WIN<\/span> <span[^>]*>George Russell — Mercedes</);
    expect(noWinner).toContain('>GR<');
  });

  it('P2.2 B2, Detail (APEX Value Attribute Pairs - Column): one block per row headed by the position and the name, the shape’s other columns as label and value pairs drawn as the table draws them, the leader’s gap and share; a results row’s Race as a link and its date as the site’s; never a table cell', async () => {
    const out = await renderComponents(doc([region('d', 'data.region', { preset: 'drivers', view: 'detail', rows: 10, heading: 'Drivers in detail' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' });
    const detail = html(out.d);
    expect(detail).toContain('Drivers in detail');
    expect(detail).not.toContain('<td');
    expect(detail).not.toContain('<table');
    expect((detail.match(/<dl/g) ?? []).length).toBe(2);
    expect(detail.indexOf('Andrea Kimi Antonelli')).toBeLessThan(detail.indexOf('George Russell'));
    for (const label of ['Team', 'Pts', 'Wins', 'Gap', 'Share']) expect(detail, label).toMatch(new RegExp(`<dt[^>]*>${label}</dt>`));
    expect(detail).not.toMatch(/<dt[^>]*>Pos<\/dt>/);
    expect(detail).not.toMatch(/<dt[^>]*>Driver<\/dt>/);
    expect(detail).toMatch(/<dt[^>]*>Team<\/dt><dd[^>]*>Mercedes<\/dd>/);
    expect(detail).toMatch(/<dt[^>]*>Code<\/dt><dd[^>]*><span[^>]*>ANT<\/span><\/dd>/);
    expect(detail).toMatch(/<dt[^>]*>Gap<\/dt><dd[^>]*>—<\/dd>/);
    expect(detail).toMatch(/<dt[^>]*>Share<\/dt><dd[^>]*>100%<\/dd>/);
    expect(detail).toMatch(/<dt[^>]*>Gap<\/dt><dd[^>]*>−66<\/dd>/);
    expect(detail).toMatch(/<dt[^>]*>Share<\/dt><dd[^>]*>75%<\/dd>/);
    const results = await draw('season-results', 'f1', [raceRow({}), raceRow({ position: 2, driver: 'George Russell', code: 'RUS', time: '+4.1s', points: 18 })], 'detail');
    expect((results.match(/<dl/g) ?? []).length).toBe(2);
    expect(results).toMatch(/<dt[^>]*>Race<\/dt><dd[^>]*><a href="\/series\/f1\/weekend\/1"/);
    expect(results).toMatch(/<dt[^>]*>Date<\/dt><dd[^>]*>8 Mar 2026<\/dd>/);
    expect(results).not.toMatch(/<dt[^>]*>Driver<\/dt>/);
    expect(results).toContain('Andrea Kimi Antonelli');
    expect(results).not.toContain('<td');
  });

  it('P2.2 B2, the Rounds layout aligned with the site’s rows: a cup row draws its drivers and never the team in their place; a car or cup row always draws the #car chip box; only a race-rows round with one winner is flat, a class fold stays a fold; a stored Timeline on a standings shape draws the table', async () => {
    const cup = await draw('season-results-gt-world', 'gt-world', [cupRow({ driver: '' })]);
    expect(cup).toContain('<span class="truncate font-condensed text-15 font-semibold text-text"></span>');
    expect(cup).toContain('>#32</span>');
    const car = await draw('season-results-imsa', 'imsa', [carRow({ car: '', driver: '' })]);
    expect(car).toMatch(/>#<\/span>/);
    expect(car).toContain('>Porsche Penske Motorsport</span>');
    const fold = await draw('season-results-wec', 'wec', [carRow({ status: 'Winner' })]);
    expect(fold).toContain('<details');
    const flat = await draw('overall-winners', 'nls', [raceRow({ race: 'NLS 1', driver: 'Crew One', code: null, team: 'Team One', status: 'Winner', time: null, points: 0, weekend: null })]);
    expect(flat).not.toContain('<details');
    const stored = await renderComponents(doc([region('s', 'data.region', { preset: 'drivers', view: 'timeline', rows: 10, heading: '' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' });
    expect(html(stored.s)).toContain('<table');
  });

  it('P2.2 B3, the Card slots and the action zones: a slot takes a column of the preset (the Title from the team, the Media as initials); Full Card wraps a card in one link to the row’s page, named after its title, and stands the other zones down, while a row without that page keeps its plain card and its other zones; a zone to the catalogue or a live page links its part, a page not given draws nothing, an external one opens in a new tab; the Button zone carries its label', async () => {
    // The slots over the default standings rows: the Title from the team, the Subtitle from the name, the Media the driver's initials; no link anywhere.
    const slots = html((await renderComponents(doc([region('c', 'data.region', { preset: 'drivers', view: 'cards', rows: 10, heading: '', cardTitle: 'team', cardSubtitle: 'name', cardMedia: 'name' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' })).c);
    expect(slots).toMatch(/<div class="[^"]*font-condensed[^"]*">Mercedes<\/div>/);
    expect(slots).toMatch(/<div class="[^"]*text-text-muted[^"]*">Andrea Kimi Antonelli<\/div>/);
    expect(slots).toContain('>AA<');
    expect(slots).toContain('>GR<');
    expect(slots).not.toContain('<a ');
    // Full Card to the row's weekend page: one anchor around the Antonelli card (round 1 has a page) and no other zone inside it;
    // the round-2 card has no page, so it stays plain and its Title zone links to the Calendar.
    const full = await draw('season-results', 'f1', [raceRow({}), raceRow({ round: 2, race: 'Chinese Grand Prix', driver: 'Lando Norris', code: 'NOR', team: 'McLaren', weekend: null })], 'cards', 50, { actionFullCard: 'row:race', actionTitle: 'calendar' });
    expect((full.match(/<a /g) ?? []).length).toBe(2);
    expect(full).toContain('<a href="/series/f1/weekend/1" class="block');
    expect(full).toContain('aria-label="Andrea Kimi Antonelli"');
    expect(full).toMatch(/<a href="\/calendar"[^>]*>Lando Norris<\/a>/);
    expect(full.split('/calendar').length - 1).toBe(1);
    // With Full Card Nowhere: the Title zone to the catalogue's Calendar, the Button zone to a live page with its label, the Media zone external in a new tab.
    const pages = { '11111111-1111-4111-8111-111111111111': { path: '/history/monza', name: 'Monza, a history' } };
    const zoned = html((await renderComponents(doc([region('z', 'data.region', { preset: 'drivers', view: 'cards', rows: 10, heading: '', cardMedia: 'name', actionTitle: 'calendar', actionMedia: 'external:support', actionButton: 'page:11111111-1111-4111-8111-111111111111', actionButtonLabel: 'Read' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x', pages })).z);
    expect(zoned).toMatch(/<a href="\/calendar"[^>]*>Andrea Kimi Antonelli<\/a>/);
    expect(zoned).toMatch(/<a href="\/history\/monza"[^>]*>Read<\/a>/);
    // The avatar is hidden from assistive technology, so its link is named after the title.
    expect(zoned).toMatch(/<a href="https:\/\/[^"]+" target="_blank" rel="noopener noreferrer"[^>]*aria-label="Andrea Kimi Antonelli"[^>]*><span[^>]*>AA<\/span><\/a>/);
    // Without the pages map the page zone draws nothing; a row link stored on a standings shape (no link column) draws nothing.
    const bare = html((await renderComponents(doc([region('b', 'data.region', { preset: 'drivers', view: 'cards', rows: 10, heading: '', actionFullCard: 'row:race', actionButton: 'page:11111111-1111-4111-8111-111111111111' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' })).b);
    expect(bare).not.toContain('<a ');
    expect(bare).not.toContain('Open');
    // The pages map may arrive as a promise: the cards wait for it, and a Home component beside them does not (it is drawn while the pages are still pending).
    let release: (p: typeof pages) => void = () => {};
    const pending = new Promise<typeof pages>(resolve => {
      release = resolve;
    });
    const drawn: string[] = [];
    const run = renderComponents(doc([region('lead', 'home.lead'), region('p', 'data.region', { preset: 'drivers', view: 'cards', rows: 10, heading: '', actionButton: 'page:11111111-1111-4111-8111-111111111111' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x', pages: pending }, { onRendered: id => drawn.push(id) });
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(drawn).toEqual(['lead']);
    release(pages);
    const later = await run;
    expect(drawn).toEqual(['lead', 'p']);
    expect(html(later.p)).toMatch(/<a href="\/history\/monza"[^>]*>Open<\/a>/);
  });

  // P2.24 A: Home's Lead story and The wire as the Data region's templates over the posts and news sources; the clock fixed at noon.
  const NOON = new Date('2026-09-22T12:00:00Z');
  const postRow = (over: Record<string, string | number | null>) => ({ slug: 'monza-2026', title: 'Monza, a history', summary: 'A century of speed.', series: 'f1', author: 'Paris', published: '2026-09-22T10:00:00.000Z', hero: 'https://img.example/monza.jpg', link: '/blog/monza-2026', seriesName: 'Formula 1', colour: '#e10600', minutes: 6, ...over });
  const POSTS = [
    postRow({}),
    postRow({ slug: 'second', title: 'Second story', summary: 'Two.', series: null, hero: null, link: '/blog/second', seriesName: null, colour: null, minutes: 3, published: '2026-09-21T10:00:00.000Z' }),
    postRow({ slug: 'third', title: 'Third story', summary: 'Three.', hero: 'https://img.example/third.jpg', link: '/blog/third', published: '2026-09-20T10:00:00.000Z' }),
    postRow({ slug: 'fourth', title: 'Fourth story', hero: null, link: '/blog/fourth', published: '2026-09-19T10:00:00.000Z' }),
    postRow({ slug: 'fifth', title: 'Fifth story', hero: null, link: '/blog/fifth', published: '2026-09-18T10:00:00.000Z' }),
  ];
  const newsRow = (i: number, over: Record<string, string | number | null> = {}) => ({ title: `Headline ${i}`, link: `https://www.example.com/${i}`, source: 'example.com', published: `2026-09-22T0${9 - i}:00:00.000Z`, series: 'f1', seriesName: 'Formula 1', colour: '#e10600', ...over });
  const NEWS = [newsRow(1), newsRow(2), newsRow(3, { seriesName: null, colour: null })];
  /** Draws a Data region over a posts or news fixture at noon; `first: false` puts a heading region before it. */
  const drawOver = async (source: string, rows: Record<string, string | number | null>[], settings: Record<string, string | number | boolean>, first = true) => {
    readSource.mockResolvedValueOnce({ columns: [], total: rows.length, rows, provenance: { ref: { source: source.split('?')[0], params: {} }, label: source, tier: 'db', keys: [], rows: rows.length, ms: 1 } });
    const regions = first ? [region('t', 'data.region', settings, { source } as Partial<Region>)] : [region('h', 'page.heading'), region('t', 'data.region', settings, { source, seq: 20 } as Partial<Region>)];
    const out = await renderComponents(doc(regions), { path: '/x', page: { path: '/x', name: 'X', title: null }, now: NOON });
    return html(out.t);
  };

  it('P2.24 A, the Lead story template: Home’s lead box over the posts source, verbatim: the cover as a redundant link (the series’ name in the panel without one, Paddock without a series), the eyebrow with the region’s heading, the age, the series’ bar and name, the read time, the title linked as the page’s h1 when first, the summary, the button, and More reading over the rows that follow with their thumbnails; Rows counts the lead and its further reading; a pinned slug leads, an unknown one leaves the newest; nothing without rows; an h2 when not first', async () => {
    const lead = await drawOver('posts?count=10', POSTS, { preset: 'lead-story', view: 'lead-story', rows: 4, heading: '' });
    expect(lead).toContain('<section aria-label="Latest from the blog"');
    expect(lead).toMatch(/<a href="\/blog\/monza-2026" aria-hidden="true" tabindex="-1"[^>]*><img src="https:\/\/img\.example\/monza\.jpg" alt="" width="1200" height="750" fetchpriority="high"/i);
    expect(lead).toContain('>Lead story<');
    expect(lead).toContain('>2h ago<');
    expect(lead).toContain('style="background-color:#e10600"');
    expect(lead).toContain('>Formula 1<');
    expect(lead).toContain('>6 min read<');
    expect(lead).toMatch(/<h1 class="[^"]*font-serif[^"]*"><a href="\/blog\/monza-2026"[^>]*>Monza, a history<\/a><\/h1>/);
    expect(lead).toContain('>A century of speed.<');
    expect(lead).toContain('Read the story →');
    expect(lead).toContain('>More reading<');
    expect(lead).toContain('>Second story<');
    expect(lead).toContain('>Third story<');
    expect(lead).toContain('>Fourth story<');
    expect(lead).not.toContain('Fifth story');
    expect(lead).toMatch(/<a href="\/blog\/third"[^>]*><img src="https:\/\/img\.example\/third\.jpg" alt="" width="1200" height="630"/);
    expect(lead).not.toContain('Two.');
    // No cover on the lead: the typographic panel with the series' name, or Paddock; no series, no bar; the age from the stamp.
    const bare = await drawOver('posts?count=10', [POSTS[1], POSTS[0]], { preset: 'lead-story', view: 'lead-story', rows: 4, heading: '' });
    expect(bare).toMatch(/<span class="[^"]*font-mono text-28[^"]*">Paddock<\/span>/);
    expect(bare).toContain('>26h ago<');
    expect(bare).not.toContain('background-color');
    expect(bare).toContain('>3 min read<');
    const named = await drawOver('posts?count=10', [POSTS[3]], { preset: 'lead-story', view: 'lead-story', rows: 4, heading: '' });
    expect(named).toMatch(/<span class="[^"]*font-mono text-28[^"]*">Formula 1<\/span>/);
    expect(named).not.toContain('More reading');
    // The pin: a matching slug leads and the rest follow it, cut to Rows; an unknown slug leaves the newest; Rows 1 is the lead alone.
    const pinned = await drawOver('posts?count=10', POSTS, { preset: 'lead-story', view: 'lead-story', rows: 4, heading: '', pinned: 'third' });
    expect(pinned).toMatch(/<h1[^>]*><a href="\/blog\/third"[^>]*>Third story<\/a><\/h1>/);
    expect(pinned).toContain('>Monza, a history<');
    expect(pinned).toContain('>Second story<');
    expect(pinned).toContain('>Fourth story<');
    expect(pinned).not.toContain('Fifth story');
    const unknown = await drawOver('posts?count=10', POSTS, { preset: 'lead-story', view: 'lead-story', rows: 4, heading: '', pinned: 'nope' });
    expect(unknown).toMatch(/<h1[^>]*><a href="\/blog\/monza-2026"/);
    const one = await drawOver('posts?count=10', POSTS, { preset: 'lead-story', view: 'lead-story', rows: 1, heading: '' });
    expect(one).toContain('Monza, a history');
    expect(one).not.toContain('More reading');
    expect(await drawOver('posts?count=10', [], { preset: 'lead-story', view: 'lead-story', rows: 4, heading: '' })).toBe('');
    // The region's Heading replaces the eyebrow's words; not first in the Body, the title is an h2.
    const headed = await drawOver('posts?count=10', POSTS, { preset: 'lead-story', view: 'lead-story', rows: 4, heading: 'From the paddock' });
    expect(headed).toContain('>From the paddock<');
    expect(headed).not.toContain('>Lead story<');
    const second = await drawOver('posts?count=10', POSTS, { preset: 'lead-story', view: 'lead-story', rows: 4, heading: '' }, false);
    expect(second).toMatch(/<h2[^>]*><a href="\/blog\/monza-2026"/);
    expect(second).not.toContain('<h1');
  });

  it('P2.24 A, The wire template: Home’s wire over the news source, verbatim: the section named by the heading, the rule with its right-hand words, each headline an external link with the series’ bar, “Series · source” (the source alone for a series the reader did not know) and its age; Rows cuts; nothing without rows; a stored template on another shape draws the table', async () => {
    const wire = await drawOver('news?per=3', NEWS, { preset: 'wire', view: 'wire', rows: 5, heading: '' });
    expect(wire).toContain('<section aria-label="The wire"');
    expect(wire).toContain('>The wire<');
    expect(wire).toContain('Reported elsewhere · linked out');
    expect((wire.match(/<a href="https:\/\/www\.example\.com\/\d" target="_blank" rel="noopener noreferrer"/g) ?? []).length).toBe(3);
    expect(wire).toContain('>Headline 1<');
    expect(wire).toContain('Formula 1 · example.com');
    expect(wire).toContain('>4h ago<');
    expect(wire).toContain('>6h ago<');
    expect(wire).toMatch(/>example\.com<\/span>/);
    expect((wire.match(/background-color:#e10600/g) ?? []).length).toBe(2);
    const cut = await drawOver('news?per=3', NEWS, { preset: 'wire', view: 'wire', rows: 2, heading: 'Elsewhere' });
    expect((cut.match(/<li>/g) ?? []).length).toBe(2);
    expect(cut).toContain('<section aria-label="Elsewhere"');
    expect(await drawOver('news?per=3', [], { preset: 'wire', view: 'wire', rows: 5, heading: '' })).toBe('');
    // A stored template view on a standings shape draws the table, as a stored Timeline does.
    const table = html((await renderComponents(doc([region('s', 'data.region', { preset: 'drivers', view: 'wire', rows: 10, heading: '' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' })).s);
    expect(table).toContain('<table');
  });

  it('P2.24 A, the image column and the shapes without a position: the Table over posts draws the cover as a thumbnail and the title linked to the post; the Standard cards draw the picture in the Media box (an empty box without one) and format a date slot; the compact List and Detail head their rows by the title and format the date; over news the title leaves the site in a new tab from the Table cell and from a Full Card zone', async () => {
    const table = await drawOver('posts?count=10', POSTS.slice(0, 2), { preset: 'lead-story', view: 'table', rows: 10, heading: '' });
    expect(table).toContain('<table');
    expect(table).toMatch(/<th[^>]*>Cover<\/th>/);
    expect(table).toMatch(/<td[^>]*><img src="https:\/\/img\.example\/monza\.jpg" alt=""/);
    expect(table).toMatch(/<a href="\/blog\/monza-2026" class="[^"]*">Monza, a history<\/a>/);
    expect(table).toContain('>22 Sept 2026<');
    expect(table).toMatch(/<th[^>]*>Read time<\/th>/);
    expect(table).toContain('>6<');
    const cards = await drawOver('posts?count=10', POSTS.slice(0, 2), { preset: 'lead-story', view: 'cards', rows: 10, heading: '' });
    expect(cards).toMatch(/<span aria-hidden="true" class="[^"]*h-9 w-9[^"]*"><img src="https:\/\/img\.example\/monza\.jpg"/);
    expect((cards.match(/<img /g) ?? []).length).toBe(1);
    expect(cards).toContain('>22 Sept 2026<');
    expect(cards).toContain('>Formula 1<');
    expect(cards).toContain('>Paris<');
    const list = await drawOver('posts?count=10', POSTS.slice(0, 2), { preset: 'lead-story', view: 'list', rows: 10, heading: '' });
    expect(list).not.toContain('<table');
    expect(list).toContain('>Monza, a history<');
    expect(list).toContain('>22 Sept 2026<');
    const detail = await drawOver('posts?count=10', POSTS.slice(0, 1), { preset: 'lead-story', view: 'detail', rows: 10, heading: '' });
    expect(detail).toContain('>Monza, a history<');
    expect(detail).toContain('<dt');
    expect(detail).toContain('>22 Sept 2026<');
    const newsTable = await drawOver('news?per=3', NEWS.slice(0, 1), { preset: 'wire', view: 'table', rows: 10, heading: '' });
    expect(newsTable).toMatch(/<td[^>]*><a href="https:\/\/www\.example\.com\/1" target="_blank" rel="noopener noreferrer" class="[^"]*">Headline 1<\/a><\/td>/);
    const newsCards = await drawOver('news?per=3', NEWS.slice(0, 1), { preset: 'wire', view: 'cards', rows: 10, heading: '', actionFullCard: 'row:title' });
    expect(newsCards).toMatch(/<a href="https:\/\/www\.example\.com\/1" target="_blank" rel="noopener noreferrer" class="block" aria-label="Headline 1">/);
  });

  it('P2.9: the Live band draws the weekends under way as Home does (the featured boxes, the Also racing row), drops the row when asked, shows one series’ weekend alone from every live box, and nothing for a series not under way; This weekend is its first instance', async () => {
    const band = async (settings: Record<string, string | number | boolean>) => html((await renderComponents(doc([region('b', 'series.live', settings)]), { path: '/x' })).b);
    expect(canRender('series.live')).toBe(true);
    const every = await band({ series: '', also: true });
    expect(every).toContain('This weekend');
    expect(every).toContain('Italian Grand Prix');
    expect(every).not.toContain('Japanese Grand Prix');
    expect(every).not.toContain('Also racing');
    // The Also racing row follows the toggle.
    const spy = vi.spyOn(homeModel, 'loadHomeModel');
    const busy = { ...model, alsoRacing: [{ seriesSlug: 'dtm', seriesName: 'DTM', color: '#000000', eventName: 'Red Bull Ring', href: '/series/dtm/weekend/7', sessionName: 'Race 1', startIso: '2026-09-26T11:30:00Z' }] };
    spy.mockResolvedValueOnce(busy as unknown as HomeModel);
    const withRow = await band({ series: '', also: true });
    expect(withRow).toContain('Also racing');
    expect(withRow).toContain('DTM');
    spy.mockResolvedValueOnce(busy as unknown as HomeModel);
    const noRow = await band({ series: '', also: false });
    expect(noRow).toContain('Italian Grand Prix');
    expect(noRow).not.toContain('Also racing');
    // One series: its box alone, whether Home features it or not; a series not under way draws nothing.
    const one = await band({ series: 'motogp', also: true });
    expect(one).toContain('Japanese Grand Prix');
    expect(one).not.toContain('Italian Grand Prix');
    expect(one).not.toContain('Also racing');
    expect(await band({ series: 'wec', also: true })).toBe('');
    // This weekend, Home's piece, is the band's first instance.
    expect(html((await renderComponents(doc([region('live', 'home.live')]), { path: '/' })).live)).toContain('Italian Grand Prix');
  });

  it('a pin that does not resolve keeps the assembly’s lead; the race-weekend fact follows the live band', async () => {
    const out = await renderComponents(doc([region('lead', 'home.lead', { pinned: 'gone' })]), { path: '/' });
    expect(html(out.lead)).toContain('Monza, a history');
    expect(await raceWeekendNow()).toBe(true);
  });

  it('R4.1: the page heading draws the page’s title, its name, or words of its own; the calendar draws its family’s assembly', async () => {
    const page = { path: '/calendar', name: 'Calendar', title: null };
    const out = await renderComponents(doc([region('heading', 'page.heading'), region('month', 'calendar.month', {}, { seq: 20 })]), { path: '/calendar', params: {}, page });
    expect(html(out.heading)).toMatch(/<h1[^>]*>Calendar<\/h1>/);
    expect(html(out.month)).toContain('data-calendar="2026-09-09T12:00:00.000Z"');
    expect(html(out.month)).toContain('Spanish Grand Prix (Madrid)');
    const titled = await renderComponents(doc([region('heading', 'page.heading')]), { path: '/calendar', page: { ...page, title: 'Race calendar 2026' } });
    expect(html(titled.heading)).toContain('>Race calendar 2026<');
    const own = await renderComponents(doc([region('heading', 'page.heading', { text: 'Every session' })]), { path: '/calendar', page });
    expect(html(own.heading)).toContain('>Every session<');
  });
});
