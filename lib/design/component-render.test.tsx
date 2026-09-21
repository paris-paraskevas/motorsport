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
  default: ({ href, children, className }: { href: unknown; children: ReactNode; className?: string }) => (
    <a href={String(href)} className={className}>
      {children}
    </a>
  ),
}));

const model = {
  blog: { slug: 'monza-2026', title: 'Monza, a history', summary: 'A century of speed.', heroImage: null, publishedAtIso: '2026-09-08T10:00:00Z', readMinutes: 6, seriesName: 'Formula 1', seriesColor: '#e10600', ageLabel: '2h ago', suggested: [{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }, { slug: 'c', title: 'C' }] },
  liveWeekends: [{ seriesSlug: 'f1', seriesName: 'Formula 1', color: '#e10600', eventName: 'Italian Grand Prix', href: '/series/f1/weekend/13', nextSession: null, alsoSameDay: [], alsoDayIso: null }],
  alsoRacing: [],
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

  it('P2.2 B1, the test per preset: every one of the seven results presets draws the Rounds layout from a fixture of its shape: a round or class per fold with its chip, its title linked to the weekend page, the winner in the meta line, the entries as the site draws them; a winners-only round flat', async () => {
    const draw = async (preset: string, series: string, rows: Record<string, string | number | null>[]) => {
      results(series, rows);
      const out = await renderComponents(doc([region('r', 'data.region', { preset, view: 'list', rows: 50, heading: '' }, { source: `results?series=${series}&season=2026` } as Partial<Region>)]), { path: '/x' });
      return html(out.r);
    };
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
