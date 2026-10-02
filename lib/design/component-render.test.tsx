// @vitest-environment jsdom
//
// The components' server half: the Data region draws its preset over its
// Source, the Live band the weekends under way from the live model, the first
// page-level component in the Body carries the h1 (never a sub region, P1.4),
// an unknown key or one of Home's six retired keys draws nothing (P2.24 C: the
// parser upgrades those before a render), a renderer that throws draws nothing
// for its own region only, and the race-weekend fact follows the live band.

import { describe, expect, it, vi } from 'vitest';
import { CURRENT_SEASON } from './sources';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { PageDocument, Region } from './page-document';
import * as homeModel from '@/lib/home-model';
import * as sourceRead from './source-read';
import * as savedViews from './views';
import * as seriesLib from '@/lib/series';
import * as circuitsLib from '@/lib/circuits';
import * as pageFrame from './page-frame';
import * as pagesLib from './pages';
import * as weatherLib from '@/lib/weather';
import * as buildOptionsLib from './build-options';
import * as peopleLib from '@/lib/people';
import * as circuitLayoutLib from '@/lib/circuit-layout';
import * as informationLib from '@/lib/information/registry';
import type { InfoEntry } from '@/lib/information/types';
import type { Series, Session } from '@/lib/types';

vi.mock('next/link', () => ({
  // The anchor as given: the class, an aria-label, and the lead's redundant cover link's aria-hidden and tabIndex (P2.24 A).
  default: ({ href, children, ...rest }: { href: unknown; children: ReactNode; className?: string; 'aria-label'?: string; 'aria-hidden'?: 'true'; tabIndex?: number }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));

// The live model (P2.24 C): what the Live band and the race-weekend fact read; the rest of Home's assembly is the route's alone now.
const LIVE_MODEL = {
  liveWeekends: [{ seriesSlug: 'f1', seriesName: 'Formula 1', color: '#e10600', eventName: 'Italian Grand Prix', href: '/series/f1/weekend/13', nextSession: null, alsoSameDay: [], alsoDayIso: null }],
  alsoRacing: [],
  // P2.9: every weekend under way as a box, in Home's ranked order; MotoGP's is not featured on Home but a page may show it alone.
  liveAll: [
    { seriesSlug: 'f1', seriesName: 'Formula 1', color: '#e10600', eventName: 'Italian Grand Prix', href: '/series/f1/weekend/13', nextSession: null, alsoSameDay: [], alsoDayIso: null },
    { seriesSlug: 'motogp', seriesName: 'MotoGP', color: '#cc0000', eventName: 'Japanese Grand Prix', href: '/series/motogp/weekend/15', nextSession: null, alsoSameDay: [], alsoDayIso: null },
  ],
};
// Spies on the real module, not a vi.mock factory: the renderers import the
// home model in parallel, one dynamic import per region, and vitest's runner
// hands a factory mock to only the first of concurrent imports of one module
// from one importer; the rest receive the real module (its own comment: "this
// will not work if user does Promise.all(import(), import())"). A spy sits on
// the one namespace every import resolves to.
type LiveModel = Awaited<ReturnType<typeof homeModel.loadLiveModel>>;
const loadLiveModel = vi.spyOn(homeModel, 'loadLiveModel').mockResolvedValue(LIVE_MODEL as unknown as LiveModel);
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
vi.mock('./families/calendar', () => ({
  // Two sessions (P2.5 PR B): the Filters region over the calendar facets on the series' names and the sessions' kinds.
  loadCalendarModel: async () => ({
    items: [
      { session: { uid: 'a', seriesSlug: 'f1', title: 'F1 - Race', start: new Date('2026-09-13T13:00:00Z'), end: new Date('2026-09-13T15:00:00Z') }, color: '#e10600', seriesSlug: 'f1', seriesName: 'Formula 1', round: 14 },
      { session: { uid: 'b', seriesSlug: 'motogp', title: 'MotoGP - Practice 1', start: new Date('2026-09-11T08:00:00Z'), end: new Date('2026-09-11T09:00:00Z') }, color: '#0af', seriesSlug: 'motogp', seriesName: 'MotoGP' },
    ],
    roundNames: { 'f1:14': 'Spanish Grand Prix (Madrid)' },
    serverNow: '2026-09-09T12:00:00.000Z',
  }),
}));
vi.mock('@/components/calendar/CalendarView', () => ({
  CalendarView: (props: { items: { round?: number }[]; serverNow: string; roundNames?: Record<string, string>; seriesNames?: string[] | null; sessionKinds?: string[] | null }) => (
    <div data-calendar={props.serverNow} data-series={(props.seriesNames ?? []).join('|')} data-kinds={(props.sessionKinds ?? []).join('|')} data-rounds={props.items.map(i => i.round ?? '').join('|')} data-lookup={'roundByKey' in props ? 'yes' : 'no'}>
      {Object.values(props.roundNames ?? {}).join(', ')}
    </div>
  ),
}));

import { canRender, raceWeekendNow, renderComponents } from './component-render';
import { PRESETS } from './presets';

const region = (id: string, component: string, settings: Record<string, string | number | boolean> = {}, over: Partial<Region> = {}): Region =>
  ({ id, kind: 'component', component, settings, title: '', position: 'body', seq: 10, column: 1, span: 12, newRow: true, hidden: false, authz: null, ...over }) as Region;
const doc = (regions: Region[]): PageDocument => ({ version: 1, actions: [], regions });
const html = (node: ReactNode) => renderToStaticMarkup(<>{node}</>);

describe('renderComponents', () => {
  const DRIVERS = { preset: 'drivers', view: 'table', rows: 10, heading: '' };
  const F1 = { source: 'standings?series=f1&season=2026' } as Partial<Region>;

  it('draws a component from its renderer, the first in the Body with the h1, and nothing for a key it does not know, the transitional body, or one of Home’s six retired keys (P2.24 C: the parser upgrades those before a render)', async () => {
    const out = await renderComponents(doc([region('d', 'data.region', DRIVERS, F1), region('code', 'page.body', {}, { seq: 30 }), region('odd', 'home.nothing', {}, { seq: 40 }), region('old', 'home.wire', { items: 5 }, { seq: 50 })]), { path: '/' });
    expect(Object.keys(out).sort()).toEqual(['d']);
    expect(html(out.d)).toMatch(/<h1[^>]*>Drivers<\/h1>/);
    expect(canRender('data.region')).toBe(true);
    expect(canRender('series.live')).toBe(true);
    for (const key of ['home.lead', 'home.live', 'home.result', 'home.changed', 'home.next', 'home.wire', 'home.nothing']) expect(canRender(key), key).toBe(false);
  });

  it('P1.4: the h1 goes to the first page-level Body region, never to a sub region that comes first in the document', async () => {
    // Document order: a component inside a parent first, then the page-level
    // component it sits in. firstBodyRegion (page-document.ts) picks the parent.
    const out = await renderComponents(doc([region('inner', 'data.region', DRIVERS, { ...F1, parent: 'story', seq: 5 }), region('story', 'data.region', DRIVERS, { ...F1, seq: 10 })]), { path: '/' });
    expect(Object.keys(out).sort()).toEqual(['inner', 'story']);
    expect(html(out.inner)).toMatch(/<h2[^>]*>Drivers<\/h2>/);
    expect(html(out.inner)).not.toMatch(/<h1/);
    expect(html(out.story)).toMatch(/<h1[^>]*>Drivers<\/h1>/);
  });

  it('tells the Debug trace how each component went: its id, its key, its time, and whether it drew (P1.9)', async () => {
    const seen: [string, string, boolean][] = [];
    await renderComponents(doc([region('d', 'data.region', DRIVERS, F1), region('odd', 'home.nothing', {}, { seq: 20 }), region('code', 'page.body', {}, { seq: 30 })]), { path: '/' }, {
      onRendered: (id, component, ms, ok) => {
        expect(typeof ms).toBe('number');
        seen.push([id, component, ok]);
      },
    });
    expect(seen.sort()).toEqual([
      ['d', 'data.region', true],
      ['odd', 'home.nothing', false],
    ]);
  });

  it('P2.1: a component’s Source picks standings · f1 · 2026 and the renderer reads it, telling the trace what it read; rows that hold no driver draw nothing (P2.24 C: the Leader template over the Source, where What it changed stood)', async () => {
    const reads: [string, string, string][] = [];
    const LEADER = { preset: 'what-it-changed', view: 'leader', rows: 5, heading: '' };
    const out = await renderComponents(doc([region('changed', 'data.region', LEADER, F1)]), { path: '/history/monza' }, { onSourceRead: (id, p) => reads.push([id, p.label, p.tier]) });
    expect(readSource).toHaveBeenCalledWith({ source: 'standings', params: { series: 'f1', season: 2026 } });
    const sourced = html(out.changed);
    expect(sourced).toContain('Andrea Kimi Antonelli leads by 66 points');
    expect(sourced).toContain('George Russell');
    expect(sourced).toMatch(/Drivers(?:&#x27;|') championship/);
    // The constructors' rows are not drivers: two rows in the table.
    expect((sourced.match(/<li /g) ?? []).length).toBe(2);
    expect(reads).toEqual([['changed', 'Standings · Formula 1 · 2026', 'rows']]);
    // A source whose rows hold no driver draws nothing.
    readSource.mockResolvedValueOnce({ columns: [], total: 0, rows: [], provenance: { ref: { source: 'standings', params: { series: 'wec', season: 2026 } }, label: 'Standings · FIA WEC · 2026', tier: 'snapshot', keys: ['standings:wec'], rows: 0, ms: 1 } });
    const empty = await renderComponents(doc([region('changed', 'data.region', LEADER, { source: 'standings?series=wec&season=2026' } as Partial<Region>)]), { path: '/history/monza' });
    expect(html(empty.changed)).toBe('');
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

  it('P2.2, the acceptance’s test per preset: every one of the twenty-seven standings presets (the twenty-six tables and Home’s What it changed, P2.24 B2) draws its table from a fixture of its shape, headed as the site heads it, the name column labelled as it says, its own class’s first row first', async () => {
    const standings = PRESETS.filter(p => p.source === 'standings');
    expect(standings).toHaveLength(27);
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

  it('P2.4 PR A: the results’ round groups take the highlight rules and, with Followed series on, each entry’s series slug; with neither, today’s markup byte for byte', async () => {
    const chinese = { round: 2, race: 'Chinese Grand Prix', circuit: 'Shanghai', date: '2026-03-15T07:00:00.000Z' };
    const rows = [
      raceRow({ series: 'f1' }),
      raceRow({ series: 'f1', position: 2, driver: 'George Russell', code: 'RUS', time: '+4.1s', points: 18 }),
      raceRow({ series: 'f1', ...chinese, driver: 'Lando Norris', code: 'NOR', team: 'McLaren' }),
      raceRow({ series: 'f1', ...chinese, position: 2, driver: 'Oscar Piastri', code: 'PIA', team: 'McLaren', time: '+2.0s', points: 18 }),
    ];
    const ENTRY = '<li class="flex items-baseline gap-3 py-2 break-inside-avoid"';
    const count = (s: string, part: string) => s.split(part).length - 1;
    const plain = await draw('season-results', 'f1', rows);
    expect(plain).toContain('<details');
    expect(count(plain, `${ENTRY}>`)).toBe(4);
    expect(plain).not.toContain('data-series');
    const styled = await draw('season-results', 'f1', rows, 'list', 50, { highlight1: 'position.eq:1' });
    expect(count(styled, '<li class="flex items-baseline gap-3 py-2 break-inside-avoid text-brand font-bold">')).toBe(2);
    expect(count(styled, `${ENTRY}>`)).toBe(2);
    const followed = await draw('season-results', 'f1', rows, 'list', 50, { highlightFollowed: true });
    expect(count(followed, `${ENTRY} data-series="f1">`)).toBe(4);
  });

  it('P2.4 PR B: a results driver links to the page its row carries inside the driver’s own cell, which keeps its look; a driver without a page draws today’s cell', async () => {
    const rows = [raceRow({ profile: '/drivers/kimi-antonelli' }), raceRow({ position: 2, driver: 'George Russell', code: 'RUS', time: '+4.1s', points: 18 })];
    const DRIVER_CELL = '<td class="py-2 pr-3 align-baseline text-xs text-text-muted">';
    const table = await draw('season-results', 'f1', rows, 'table');
    expect(table).toMatch(new RegExp(`${DRIVER_CELL}<a href="/drivers/kimi-antonelli"[^>]*>Andrea Kimi Antonelli</a></td>`));
    expect(table).toContain(`${DRIVER_CELL}George Russell</td>`);
  });

  it('P2.4 PR C: a master’s rows write the detail’s filter into the address, its own keys only; the detail shows that value under “Showing <value> · Show all”; a detail is keyed whatever its menus and its view', async () => {
    const chinese = { round: 2, race: 'Chinese Grand Prix', circuit: 'Shanghai', date: '2026-03-15T07:00:00.000Z' };
    const rows = [
      raceRow({}),
      raceRow({ position: 2, driver: 'George Russell', code: 'RUS', time: '+4.1s', points: 18 }),
      raceRow({ ...chinese, driver: 'Lando Norris', code: 'NOR', team: 'McLaren' }),
      raceRow({ ...chinese, position: 2, driver: 'Oscar Piastri', code: 'PIA', team: 'McLaren', time: '+2.0s', points: 18 }),
    ];
    const SRC = { source: 'results?series=f1&season=2026' } as Partial<Region>;
    const drawPair = async (view: string, master: Record<string, string | number | boolean> = {}) => {
      results('f1', rows);
      results('f1', rows);
      const out = await renderComponents(
        doc([
          region('season', 'data.region', { preset: 'season-results', view: 'list', rows: 10, heading: 'Season', detailRegion: 'race', detailKey: 'round', ...master }, SRC),
          region('race', 'data.region', { preset: 'season-results', view: 'list', rows: 10, heading: 'Race' }, SRC),
        ]),
        { path: '/x', href: '/x', view },
      );
      return { season: html(out.season), race: html(out.race) };
    };
    // No choice yet: each fold of the season list (the race is the row) writes its round, in bare keys since the detail is the page's one keyed region.
    const plain = await drawPair('');
    expect(plain.season).toContain('<a href="/x?filter=round.eq%3A1" rel="nofollow"');
    expect(plain.season).toContain('<a href="/x?filter=round.eq%3A2" rel="nofollow"');
    expect(plain.season).not.toContain('aria-current');
    expect(plain.race).not.toContain('Showing');
    expect(plain.race).toContain('George Russell');
    expect(plain.race).toContain('Lando Norris');
    // Round 2 chosen (with a sort of the detail's own): the detail, a List with no menu, shows round 2 alone under the line and
    // its reset; the master marks that fold; its other links keep the detail's sort and replace only the filter.
    const two = await drawPair('sort=-points&filter=round.eq:2');
    expect(two.race).toContain('Lando Norris');
    expect(two.race).not.toContain('George Russell');
    expect(two.race).toContain('Showing 2 · <a href="/x?sort=-points" rel="nofollow"');
    expect(two.race).toMatch(/Showing 2 · <a [^>]*>Show all<\/a>/);
    expect(two.season).toMatch(/<a href="\/x\?sort=-points&amp;filter=round.eq%3A2" rel="nofollow" aria-current="true"[^>]*>Show 2<\/a>/);
    expect(two.season).toContain('<a href="/x?sort=-points&amp;filter=round.eq%3A1" rel="nofollow"');
    // A Table master with its own controls: two keyed regions read their keys under r.<id>., and each row leads with its link.
    const table = await drawPair('', { view: 'table', sortable: true });
    expect(table.season).toMatch(/<tr[^>]*><td[^>]*><a href="\/x\?r\.race\.filter=round\.eq%3A1" rel="nofollow"[^>]*>Show 1<\/a><\/td>/);
    // No Detail region: today's markup, no link.
    const alone = await drawPair('', { detailRegion: '', detailKey: '' });
    expect(alone.season).not.toContain('rel="nofollow"');
  });

  it('P2.4 PR C, the reviewer’s findings: a value the vocabulary cannot carry gets no link; a template cannot be a detail; two masters on one detail each get their Showing line; the chosen row is marked as the filter reads it', async () => {
    const long = 'A'.repeat(81);
    const rows = [raceRow({}), raceRow({ round: 2, race: long, position: 1, driver: 'Lando Norris', code: 'NOR', team: 'McLaren' }), raceRow({ round: 2, race: long, position: 2, driver: 'Oscar Piastri', code: 'PIA', team: 'McLaren', time: '+2.0s', points: 18 })];
    const SRC = { source: 'results?series=f1&season=2026' } as Partial<Region>;
    const three = async (view: string, regions: Region[]) => {
      for (let i = 0; i < regions.length; i++) results('f1', rows);
      const out = await renderComponents(doc(regions), { path: '/x', href: '/x', view });
      return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, html(v)]));
    };
    const master = (id: string, key: string, over: Record<string, string | number | boolean> = {}) => region(id, 'data.region', { preset: 'season-results', view: 'list', rows: 10, heading: id, detailRegion: 'race', detailKey: key, ...over }, SRC);
    const detail = (view = 'table') => region('race', 'data.region', { preset: 'season-results', view, rows: 10, heading: 'Race' }, SRC);
    // The race's name is 81 characters, one over VALUE_MAX: that fold gets no link; round 1's fold keeps its own.
    const byRace = await three('', [master('season', 'race'), detail()]);
    expect(byRace.season).toContain('href="/x?filter=race.eq%3AAustralian+Grand+Prix"');
    expect(byRace.season).not.toContain('race.eq%3AAAAA');
    expect((byRace.season.match(/rel="nofollow"/g) ?? []).length).toBe(1);
    // A Podium is a template: no Show link, no Showing line, so it is not a detail and the master draws no links.
    const podium = await three('', [master('season', 'round'), detail('podium')]);
    expect(podium.season).not.toContain('rel="nofollow"');
    // Two masters, two keys, one detail: the line follows whichever filter the address carries.
    const both = await three('filter=race.eq:Australian%20Grand%20Prix', [master('season', 'round'), master('season-2', 'race'), detail()]);
    expect(both.race).toContain('Showing Australian Grand Prix · <a href="/x" rel="nofollow"');
    expect(both['season-2']).toMatch(/aria-current="true"[^>]*>Show Australian Grand Prix<\/a>/);
    expect(both.season).not.toContain('aria-current');
    // The chosen row is marked as the filter reads it: "01" chooses round 1 by number, as rowPasses compares.
    const padded = await three('filter=round.eq:01', [master('season', 'round'), detail()]);
    expect(padded.race).toContain('Showing 01 ·');
    expect(padded.season).toMatch(/aria-current="true"[^>]*>Show 1<\/a>/);
    // A master drawn as a template (the Timeline here; a stored Detail region outlives a View change) draws no Show link, so it
    // keys no detail: the address's filter on the key is not read and no Showing line is drawn.
    const templ = await three('filter=round.eq:1', [master('season', 'round', { view: 'timeline' }), detail()]);
    expect(templ.season).not.toMatch(/>Show \d/);
    expect(templ.race).not.toContain('Showing');
    expect(templ.race).toContain('Lando Norris');
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
    // The pages map may arrive as a promise: the cards wait for it, and the Live band beside them does not (it is drawn while the pages are still pending).
    let release: (p: typeof pages) => void = () => {};
    const pending = new Promise<typeof pages>(resolve => {
      release = resolve;
    });
    const drawn: string[] = [];
    const run = renderComponents(doc([region('lead', 'series.live'), region('p', 'data.region', { preset: 'drivers', view: 'cards', rows: 10, heading: '', actionButton: 'page:11111111-1111-4111-8111-111111111111' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x', pages: pending }, { onRendered: id => drawn.push(id) });
    // The band lands while the pages are still pending: a poll, not a fixed wait (the file's first dynamic import is slow under a busy suite).
    await vi.waitFor(() => expect(drawn).toEqual(['lead']), { timeout: 5000 });
    release(pages);
    const later = await run;
    expect(drawn).toEqual(['lead', 'p']);
    expect(html(later.p)).toMatch(/<a href="\/history\/monza"[^>]*>Open<\/a>/);
  });

  // P2.24 A: Home's Lead story and The wire as the Data region's templates over the posts and news sources; the clock fixed at noon.
  const NOON = new Date('2026-09-22T12:00:00Z');
  const postRow = (over: Record<string, string | number | null>) => ({ slug: 'monza-2026', title: 'Monza, a history', summary: 'A century of speed.', series: 'f1', author: 'Paris', published: '2026-09-22T10:00:00.000Z', hero: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Monza.jpg?utm_source=commons.wikimedia.org&utm_campaign=index', link: '/blog/monza-2026', seriesName: 'Formula 1', colour: '#e10600', minutes: 6, ...over });
  const POSTS = [
    postRow({}),
    postRow({ slug: 'second', title: 'Second story', summary: 'Two.', series: null, hero: null, link: '/blog/second', seriesName: null, colour: null, minutes: 3, published: '2026-09-21T10:00:00.000Z' }),
    postRow({ slug: 'third', title: 'Third story', summary: 'Three.', hero: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Third.jpg/1920px-Third.jpg', link: '/blog/third', published: '2026-09-20T10:00:00.000Z' }),
    postRow({ slug: 'fourth', title: 'Fourth story', hero: null, link: '/blog/fourth', published: '2026-09-19T10:00:00.000Z' }),
    postRow({ slug: 'fifth', title: 'Fifth story', hero: null, link: '/blog/fifth', published: '2026-09-18T10:00:00.000Z' }),
  ];
  const newsRow = (i: number, over: Record<string, string | number | null> = {}) => ({ title: `Headline ${i}`, link: `https://www.example.com/${i}`, source: 'example.com', published: `2026-09-22T0${9 - i}:00:00.000Z`, series: 'f1', seriesName: 'Formula 1', colour: '#e10600', ...over });
  const NEWS = [newsRow(1), newsRow(2), newsRow(3, { seriesName: null, colour: null })];
  /** Draws a Data region over a posts or news fixture at noon; `first: false` puts a heading region before it. */
  const drawOver = async (source: string, rows: Record<string, string | number | boolean | null>[], settings: Record<string, string | number | boolean>, first = true) => {
    readSource.mockResolvedValueOnce({ columns: [], total: rows.length, rows, provenance: { ref: { source: source.split('?')[0], params: {} }, label: source, tier: 'db', keys: [], rows: rows.length, ms: 1 } });
    const regions = first ? [region('t', 'data.region', settings, { source } as Partial<Region>)] : [region('h', 'page.heading'), region('t', 'data.region', settings, { source, seq: 20 } as Partial<Region>)];
    const out = await renderComponents(doc(regions), { path: '/x', page: { path: '/x', name: 'X', title: null }, now: NOON });
    return html(out.t);
  };

  it('P2.24 A, the Lead story template: Home’s lead box over the posts source, verbatim: the cover as a redundant link (the series’ name in the panel without one, Paddock without a series), the eyebrow with the region’s heading, the age, the series’ bar and name, the read time, the title linked as the page’s h1 when first, the summary, the button, and More reading over the rows that follow with their thumbnails; Rows counts the lead and its further reading; a pinned slug leads, an unknown one leaves the newest; nothing without rows; an h2 when not first', async () => {
    const lead = await drawOver('posts?count=10', POSTS, { preset: 'lead-story', view: 'lead-story', rows: 4, heading: '' });
    expect(lead).toContain('<section aria-label="Latest from the blog"');
    // R13 (the SEO check of 2026-09-27): the cover names its story; the link is aria-hidden, so the words serve crawlers alone.
    // R13 PR C: the cover at the 960 bucket of Commons' thumbnail service, the srcset for the browser's own choice, the box's sizes, eager.
    expect(lead).toMatch(new RegExp('<a href="\\/blog\\/monza-2026" aria-hidden="true" tabindex="-1"[^>]*><img src="https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/a\/a9\/Monza\.jpg\/960px-Monza\\.jpg" srcset="https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/a\/a9\/Monza\.jpg\/500px-Monza\\.jpg 500w, https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/a\/a9\/Monza\.jpg\/960px-Monza\\.jpg 960w, https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/a\/a9\/Monza\.jpg\/1280px-Monza\\.jpg 1280w" sizes="\\(min-width: 1024px\\) 46vw, 100vw" alt="Monza, a history" width="1200" height="750" fetchpriority="high"', 'i'));
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
    expect(lead).toMatch(new RegExp('<a href="\\/blog\\/third"[^>]*><img src="https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/b\/b2\/Third\.jpg\/250px-Third\\.jpg" alt="Third story" width="1200" height="630" loading="lazy"'));
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

  it('P2.5 PR C, the Headlines view: the News page’s list over the news source: two columns from md, each headline an external link with the series’ bar, “Series · source” (the source alone without a series) and its age, each row marked with its series for the reader’s scope; no rule, no heading of its own; the route’s box without rows', async () => {
    const list = await drawOver('news?per=10', NEWS, { preset: 'wire', view: 'headlines', rows: 150, heading: '' }, false);
    expect(list).toContain('<section aria-label="The wire"');
    expect(list).toContain('class="border-t border-text md:columns-2 md:gap-10"');
    expect((list.match(/<a href="https:\/\/www\.example\.com\/\d" target="_blank" rel="nofollow noopener noreferrer"/g) ?? []).length).toBe(3);
    expect(list).toMatch(/<h2 class="[^"]*font-serif text-17[^"]*">Headline 1<\/h2>/);
    expect(list).toContain('Formula 1 · example.com');
    expect(list).toMatch(/>example\.com<\/span>/);
    expect(list).toContain('>4h ago<');
    expect((list.match(/data-series="f1"/g) ?? []).length).toBe(3);
    expect((list.match(/background-color:#e10600/g) ?? []).length).toBe(2);
    expect(list).not.toContain('Reported elsewhere');
    expect(list).not.toContain('<h1');
    expect(list).not.toContain('>The wire<');
    const empty = await drawOver('news?per=10', [], { preset: 'wire', view: 'headlines', rows: 150, heading: '' }, false);
    expect(empty).toContain('No stories');
    expect(empty).toContain('href="https://www.motorsport.com/"');
  });

  it('P2.7, Metric cards: from a saved document over the standings, a card per figure: the leader’s name with the points beneath, the gap of the row a rule names, a number with its trend, the count of the preset’s rows, a share as a percent; the columns per row; the rule above; a card without a value skipped; a dash where no row passes; nothing without a card', async () => {
    const settings = { preset: 'drivers', heading: 'Drivers’ championship', columns: '4', card1Label: 'Leader', card1Value: 'name', card1Description: 'points', card2Label: 'Gap to second', card2Value: 'gap', card2Description: 'name', card2Row: 'position.eq:2', card3Label: 'Wins', card3Value: 'wins', card3Trend: 'wins', card4Label: 'Drivers classified', card4Figure: 'count' };
    const m = html((await renderComponents(doc([region('m', 'data.metrics', settings, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' })).m);
    expect(m).toContain('<section aria-label="Drivers’ championship"');
    expect(m).toContain('>Drivers’ championship<');
    expect(m).toContain('class="grid gap-3 md:grid-cols-4"');
    expect((m.match(/font-serif text-30/g) ?? []).length).toBe(4);
    expect(m).toContain('>Leader<');
    expect(m).toContain('>Andrea Kimi Antonelli<');
    expect(m).toContain('>267 pts<');
    expect(m).toContain('>Gap to second<');
    expect(m).toContain('>−66<');
    expect(m).toContain('>George Russell<');
    expect(m).toContain('>Wins<');
    expect(m).toContain('>7<');
    expect(m).toContain('<span aria-hidden="true">▲</span><span class="sr-only">up</span> 7');
    expect(m).toContain('>Drivers classified<');
    expect(m).toContain('>2<');
    // A card without a value is skipped; a label left empty takes the column’s; a share draws as a whole percent; no rule passing draws a dash; a heading left empty draws no rule.
    const some = html((await renderComponents(doc([region('m', 'data.metrics', { preset: 'drivers', card1Value: 'share', card2Value: 'name', card2Row: 'position.eq:9', card3Label: 'Nothing here' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' })).m);
    expect((some.match(/font-serif text-30/g) ?? []).length).toBe(2);
    expect(some).toContain('>Share<');
    expect(some).toContain('>100%<');
    expect(some).toContain('>—<');
    expect(some).not.toContain('Nothing here');
    expect(some).toContain('<section aria-label="Metrics"');
    expect(some).not.toContain('border-b border-text pb-1');
    expect(html((await renderComponents(doc([region('m', 'data.metrics', { preset: 'drivers' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x' })).m)).toBe('');
    // The reviewer's findings: a link column draws its words alone whatever the row's address (a card carries no link in this slot); a name
    // column's default label is the preset's own; a count card ignores a value, a description and a trend left from before; first in the
    // Body, the heading is the page's h1.
    readSource.mockResolvedValueOnce({ columns: [], total: 1, rows: [{ kind: 'co-driver', position: 1, name: 'Vincent Landais', code: null, team: 'Toyota', points: 100, wins: 3, class: null, profile: '/drivers/vincent-landais' }], provenance: { ref: { source: 'standings', params: { series: 'wrc', season: 2026 } }, label: 'Standings · WRC · 2026', tier: 'db', keys: [], rows: 1, ms: 1 } });
    const co = html((await renderComponents(doc([region('m', 'data.metrics', { preset: 'co-drivers', heading: 'Co-drivers', card1Value: 'name', card1Description: 'name', card2Figure: 'count', card2Value: 'name', card2Description: 'points', card2Trend: 'wins' }, { source: 'standings?series=wrc&season=2026' } as Partial<Region>)]), { path: '/x' })).m);
    expect(co).not.toContain('<a ');
    expect((co.match(/>Vincent Landais</g) ?? []).length).toBe(2);
    expect(co).toContain('>Co-Driver<');
    expect(co).toMatch(/<h1 class="[^"]*">Co-drivers<\/h1>/);
    expect(co).toContain('>Rows<');
    expect(co).toContain('>1<');
    expect(co).not.toContain('100 pts');
    expect(co).not.toContain('sr-only');
    // Not first in the Body (a heading region before it), the rule's words are a span, as the wire's.
    const second = html((await renderComponents(doc([region('h', 'page.heading'), region('m', 'data.metrics', { preset: 'drivers', heading: 'Below', card1Value: 'points' }, { source: 'standings?series=f1&season=2026', seq: 20 } as Partial<Region>)]), { path: '/x' })).m);
    expect(second).not.toContain('<h1');
    expect(second).toContain('>Below<');
  });

  it('P2.24 A, the image column and the shapes without a position: the Table over posts draws the cover as a thumbnail and the title linked to the post; the Standard cards draw the picture in the Media box (an empty box without one) and format a date slot; the compact List and Detail head their rows by the title and format the date; over news the title leaves the site in a new tab from the Table cell and from a Full Card zone', async () => {
    const table = await drawOver('posts?count=10', POSTS.slice(0, 2), { preset: 'lead-story', view: 'table', rows: 10, heading: '' });
    expect(table).toContain('<table');
    expect(table).toMatch(/<th[^>]*>Cover<\/th>/);
    expect(table).toMatch(new RegExp('<td[^>]*><img src="https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/a\/a9\/Monza\.jpg\/250px-Monza\\.jpg" alt="Monza, a history" width="1200" height="750" loading="lazy"'));
    // R13: a card's media names the card (its link names itself already, so a reader hears nothing twice).
    const covers = await drawOver('posts?count=10', POSTS.slice(0, 1), { preset: 'lead-story', view: 'cards', rows: 5, heading: '', cardMedia: 'hero' });
    expect(covers).toMatch(new RegExp('<img src="https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/a\/a9\/Monza\.jpg\/120px-Monza\\.jpg" alt="Monza, a history" width="1200" height="750" loading="lazy" class="h-9 w-9 object-cover"'));
    expect(table).toMatch(/<a href="\/blog\/monza-2026" class="[^"]*">Monza, a history<\/a>/);
    expect(table).toContain('>22 Sept 2026<');
    expect(table).toMatch(/<th[^>]*>Read time<\/th>/);
    expect(table).toContain('>6<');
    const cards = await drawOver('posts?count=10', POSTS.slice(0, 2), { preset: 'lead-story', view: 'cards', rows: 10, heading: '' });
    expect(cards).toMatch(new RegExp('<span aria-hidden="true" class="[^"]*h-9 w-9[^"]*"><img src="https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/a\/a9\/Monza\.jpg\/120px-Monza\\.jpg"'));
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

  it('P2.24 B1, the Coming weekends template: Home’s What’s next over the weekends source, verbatim: the section named by the heading, the rule with “All series” (the series’ name when the Source names one, R8), each weekend a link to its page with the series’ bar, the title and the series’ name, the first row still to start carrying the countdown and every other its dates; Rows cuts; a first row already under way shows its dates; the heading replaces the words; nothing without rows; the Table links the title to the weekend page', async () => {
    // The starts lie in 2030: the countdown's initial state reads the real clock and draws nothing once its target has passed.
    const weekendRow = (i: number, over: Record<string, string | number | null> = {}) => ({ series: 'f1', seriesName: 'Formula 1', colour: '#e10600', round: 16 + i, title: `Grand Prix ${i}`, start: `2030-0${i}-05T09:30:00.000Z`, end: `2030-0${i}-07T14:00:00.000Z`, dates: `${i}–${i + 2} Mar`, weekend: `/series/f1/weekend/${16 + i}`, ...over });
    const WEEKENDS = [weekendRow(1, { dates: '25–27 Sept' }), weekendRow(2, { series: 'wec', seriesName: 'FIA WEC', colour: '#0b3d91', weekend: '/series/wec/weekend/7' }), weekendRow(3), weekendRow(4)];
    const settings = { preset: 'whats-next', view: 'coming-weekends', rows: 3, heading: '' };
    const next = await drawOver('weekends?count=10', WEEKENDS, settings);
    expect(next).toMatch(/<section aria-label="What(&#x27;|')s next" class="min-w-0">/);
    expect(next).toMatch(/>What(&#x27;|')s next</);
    expect(next).toContain('>All series<');
    expect((next.match(/<li>/g) ?? []).length).toBe(3);
    expect(next).toMatch(/<a href="\/series\/f1\/weekend\/17" class="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 [^"]*">/);
    expect(next).toContain('>Grand Prix 1<');
    expect(next).toContain('>Formula 1<');
    expect(next).toContain('>FIA WEC<');
    expect(next).toContain('style="background-color:#0b3d91"');
    expect(next).toContain('aria-label="Time until 25–27 Sept"');
    expect(next).toContain('style="border-color:#e10600"');
    expect((next.match(/aria-label="Time until/g) ?? []).length).toBe(1);
    expect(next).toContain('>2–4 Mar<');
    expect(next).not.toContain('Grand Prix 4');
    // A first weekend already under way (its start before noon) shows its dates, no countdown.
    const live = await drawOver('weekends?count=10', [weekendRow(1, { start: '2026-09-22T09:00:00.000Z', dates: 'Under way' }), WEEKENDS[1]], settings);
    expect(live).not.toContain('Time until');
    expect(live).toContain('>Under way<');
    // The region's Heading replaces the section's name and the rule's words.
    const headed = await drawOver('weekends?count=10', WEEKENDS, { ...settings, heading: 'Coming up' });
    expect(headed).toContain('<section aria-label="Coming up"');
    expect(headed).toContain('>Coming up<');
    expect(await drawOver('weekends?count=10', [], settings)).toBe('');
    // R8: a Source naming a series puts its name on the rule where Home reads All series (the operator's report of 2026-09-23).
    const f1 = await drawOver('weekends?series=f1&count=10', [WEEKENDS[0], WEEKENDS[2]], settings);
    expect(f1).toContain('<span class="font-mono text-10 uppercase tracking-[0.14em] text-text-faint">Formula 1</span>');
    expect(f1).not.toContain('All series');
    const table = await drawOver('weekends?count=10', WEEKENDS.slice(0, 2), { ...settings, view: 'table', rows: 10 });
    expect(table).toContain('<table');
    expect(table).toMatch(/<a href="\/series\/f1\/weekend\/17" class="[^"]*">Grand Prix 1<\/a>/);
    expect(table).toContain('>25–27 Sept<');
    expect(table).toContain('>5 Jan 2030<');
  });

  // P2.24 B2: Home's Latest result and What it changed as templates over the results and standings sources, the rows carrying the series' facts.
  const podiumRow = (position: number, driver: string, team: string, time: string | null, over: Record<string, string | number | boolean | null> = {}) => ({
    round: 13,
    race: 'Italian Grand Prix',
    raceId: null,
    date: '2026-09-06T13:00:00.000Z',
    circuit: 'Monza',
    class: null,
    session: 'race',
    position,
    driver,
    code: null,
    car: null,
    team,
    vehicle: null,
    manufacturer: null,
    laps: null,
    status: 'Finished',
    time,
    gap: null,
    points: 25,
    weekend: '/series/f1/weekend/13',
    seriesName: 'Formula 1',
    colour: '#e10600',
    final: false,
    champion: null,
    ...over,
  });
  const PODIUM = [podiumRow(1, 'Andrea Kimi Antonelli', 'Mercedes', '1:20:12.345'), podiumRow(2, 'George Russell', 'Mercedes', '+3.857'), podiumRow(3, 'Charles Leclerc', 'Ferrari', '+12.001')];
  const PODIUM_SETTINGS = { preset: 'latest-result', view: 'podium', rows: 3, heading: '' };
  const HOME = 'results?series=home&season=2026';

  it('P2.24 B2, the Podium template: Home’s Latest result over the results source, verbatim: the section named by the heading, the series’ bar and name, the round and the day, the headline as the page’s h1 when first (an h2 a size down otherwise), the winning margin from second’s time or the winner’s detail, the report link to the weekend page, the classification of the podium rows; Rows cuts; champion mode when the season is complete; a sportscar race names the team with its crew and the gap; nothing without a winner or rows; the Table over the shape; a stored podium view over Season results draws the Table', async () => {
    const podium = await drawOver(HOME, PODIUM, PODIUM_SETTINGS);
    expect(podium).toContain('<section aria-label="Latest result" class="border-[1.5px] border-text bg-surface-elevated shadow-lg p-[18px] lg:p-5">');
    // The classification column is a grid item (R11): without min-w-0 its no-wrap names set the column's floor and the box runs past a phone's edge (the operator's report, 2026-09-26).
    expect(podium).toContain('<div class="min-w-0"><div class="flex items-baseline justify-between border-b border-text pb-1">');
    expect(podium).toContain('style="background-color:#e10600"');
    expect(podium).toContain('>Formula 1<');
    expect(podium).toContain('Round 13 · Sunday 6 September');
    expect(podium).toMatch(/<h1 class="mt-3 font-serif font-semibold leading-\[1\.1\] text-text text-30 lg:text-40">Andrea Kimi Antonelli wins the Italian Grand Prix<\/h1>/);
    expect(podium).toContain('Winning margin <span class="text-text">+3.857</span>');
    expect(podium).toContain('<a href="/series/f1/weekend/13" class="mt-4 inline-block font-mono text-10 font-semibold uppercase tracking-[0.16em] text-brand hover:underline">Full weekend report →</a>');
    expect(podium).toContain('>Classification<');
    expect((podium.match(/<li class="flex items-baseline gap-3 border-b border-border py-2">/g) ?? []).length).toBe(3);
    expect(podium).toContain('>Charles Leclerc<');
    expect(podium).toContain('>Ferrari<');
    expect(podium).toContain('>+12.001<');
    expect(podium).not.toContain('Season complete');
    expect(((await drawOver(HOME, PODIUM, { ...PODIUM_SETTINGS, rows: 2 })).match(/<li class="flex items-baseline/g) ?? []).length).toBe(2);
    const second = await drawOver(HOME, PODIUM, PODIUM_SETTINGS, false);
    expect(second).toMatch(/<h2 class="mt-3 font-serif font-semibold leading-\[1\.1\] text-text text-24 lg:text-30">Andrea Kimi Antonelli wins the Italian Grand Prix<\/h2>/);
    // Champion mode: the season complete and the champion known; the race takes the second line and the classification names it.
    const crowned = await drawOver(HOME, PODIUM.map(r => ({ ...r, final: true, champion: 'Andrea Kimi Antonelli' })), PODIUM_SETTINGS);
    expect(crowned).toContain('>Season complete<');
    expect(crowned).toMatch(/<h1 class="mt-1\.5 [^"]*">Andrea Kimi Antonelli is Formula 1 champion<\/h1>/);
    expect(crowned).toContain('Andrea Kimi Antonelli wins the Italian Grand Prix — winning margin +3.857.');
    expect(crowned).toContain('>Italian Grand Prix · Classification<');
    // Without a margin the winner's detail stands: second's time is a total, not a gap.
    const total = await drawOver(HOME, [PODIUM[0], podiumRow(2, 'George Russell', 'Mercedes', '1:20:16.202')], PODIUM_SETTINGS);
    expect(total).not.toContain('Winning margin');
    expect(total).toContain('<p class="mt-2 font-mono text-11 tabular-nums text-text-muted">Mercedes</p>');
    // A sportscar race (a car number on the row): the team is the name, the crew the detail, the gap the time; a gap as the margin.
    const car = (position: number, team: string, crew: string, gap: string) => podiumRow(position, crew, team, null, { car: String(5 + position), gap, class: 'Hypercar', race: '6 Hours of Fuji', round: 6, seriesName: 'FIA WEC', colour: '#0b3d91', weekend: '/series/wec/weekend/6' });
    const fuji = await drawOver(HOME, [car(1, 'Porsche Penske Motorsport', 'Estre Campbell Vanthoor', '6:00:12.345'), car(2, 'Ferrari AF Corse', 'Fuoco Molina Nielsen', '+1 Lap')], PODIUM_SETTINGS);
    expect(fuji).toMatch(/<h1 [^>]*>Porsche Penske Motorsport wins the 6 Hours of Fuji<\/h1>/);
    expect(fuji).toContain('>Estre Campbell Vanthoor<');
    expect(fuji).toContain('>6:00:12.345<');
    expect(fuji).toContain('Winning margin <span class="text-text">+1 Lap</span>');
    expect(fuji).toContain('<a href="/series/wec/weekend/6"');
    // No weekend page for the round: no report link, never a typed address.
    expect(await drawOver(HOME, PODIUM.map(r => ({ ...r, weekend: null })), PODIUM_SETTINGS)).not.toContain('Full weekend report');
    expect(await drawOver(HOME, PODIUM.slice(1), PODIUM_SETTINGS)).toBe('');
    expect(await drawOver(HOME, [], PODIUM_SETTINGS)).toBe('');
    const table = await drawOver(HOME, PODIUM, { ...PODIUM_SETTINGS, view: 'table' });
    expect(table).toContain('<table');
    expect(table).toMatch(/<a href="\/series\/f1\/weekend\/13" class="[^"]*">Italian Grand Prix<\/a>/);
    expect(table).toContain('>Formula 1<');
    // The gate (the critic's finding): the Podium stands on its own shape; a stored podium view over Season results draws the Table.
    expect(await drawOver('results?series=f1&season=2026', PODIUM, { preset: 'season-results', view: 'podium', rows: 3, heading: '' })).toContain('<table');
  });

  const leaderRow = (position: number, name: string, points: number, over: Record<string, string | number | boolean | null> = {}) => ({ kind: 'driver', position, name, code: null, team: 'Team', points, wins: null, class: null, seriesName: 'Formula 1', colour: '#e10600', winner: false, final: false, ...over });
  const LEADER = [leaderRow(1, 'Driver 1', 300), leaderRow(2, 'Driver 2', 280, { winner: true }), leaderRow(3, 'Driver 3', 260), leaderRow(4, 'Driver 4', 240), leaderRow(5, 'Driver 5', 220), leaderRow(6, 'Driver 6', 200)];
  const LEADER_SETTINGS = { preset: 'what-it-changed', view: 'leader', rows: 5, heading: '' };
  const LATEST = 'standings?series=latest&season=2026';

  it('P2.24 B2, the Leader template: Home’s What it changed over the standings source, verbatim: the rule with the heading and “<series> · Drivers’ championship”, the headline (leads by N points, one point, leads the championship without a second row; takes the title by, is champion when the season is complete), the rows with the winner’s bold row and brand bar, the leader’s text bar and the gap column; Rows cuts; the heading replaces the label; nothing without rows; a stored leader view over Constructors draws the Table', async () => {
    const leader = await drawOver(LATEST, LEADER, LEADER_SETTINGS);
    expect(leader).toContain('<section aria-label="What it changed" class="min-w-0">');
    expect(leader).toContain('>What it changed<');
    expect(leader).toMatch(/>Formula 1 · Drivers(?:&#x27;|') championship</);
    expect(leader).toContain('<h2 class="font-serif text-22 font-semibold leading-snug text-text lg:text-26">Driver 1 leads by 20 points</h2>');
    expect((leader.match(/<li class="flex items-center gap-3 border-b border-border py-1\.5">/g) ?? []).length).toBe(5);
    expect(leader).not.toContain('Driver 6');
    expect(leader).toContain('<span class="w-28 shrink-0 truncate text-sm sm:w-36 font-semibold text-text">Driver 2</span>');
    expect(leader).toContain('<span class="w-28 shrink-0 truncate text-sm sm:w-36 text-text-muted">Driver 1</span>');
    expect(leader).toContain('<span class="block h-full bg-brand" style="width:93%"></span>');
    expect(leader).toContain('<span class="block h-full bg-text" style="width:100%"></span>');
    expect(leader).toContain('<span class="block h-full bg-border-strong" style="width:87%"></span>');
    expect(leader).toContain('>—<');
    expect(leader).toContain('>−20<');
    expect(await drawOver(LATEST, [leaderRow(1, 'Driver 1', 300), leaderRow(2, 'Driver 2', 299)], LEADER_SETTINGS)).toContain('Driver 1 leads by 1 point</h2>');
    expect(await drawOver(LATEST, [leaderRow(1, 'Driver 1', 300)], LEADER_SETTINGS)).toContain('Driver 1 leads the championship</h2>');
    const final = await drawOver(LATEST, LEADER.map(r => ({ ...r, final: true })), LEADER_SETTINGS);
    expect(final).toContain('>Formula 1 · Final standings<');
    expect(final).toContain('Driver 1 takes the title by 20 points</h2>');
    expect(await drawOver(LATEST, [leaderRow(1, 'Driver 1', 300, { final: true })], LEADER_SETTINGS)).toContain('Driver 1 is champion</h2>');
    const headed = await drawOver(LATEST, LEADER, { ...LEADER_SETTINGS, heading: 'The championship', rows: 3 });
    expect(headed).toContain('<section aria-label="The championship"');
    expect(headed).toContain('>The championship<');
    expect((headed.match(/<li class="flex items-center/g) ?? []).length).toBe(3);
    expect(await drawOver(LATEST, [], LEADER_SETTINGS)).toBe('');
    // The gate (the critic's finding): the Leader stands on the driver rows' shape; a stored leader view over Constructors draws the Table.
    expect(await drawOver('standings?series=f1&season=2026', [{ ...leaderRow(1, 'Mercedes', 500), kind: 'constructor' }], { preset: 'constructors', view: 'leader', rows: 5, heading: '' })).toContain('<table');
  });

  it('P2.9: the Live band draws the weekends under way as Home does (the featured boxes, the Also racing row), drops the row when asked, shows one series’ weekend alone from every live box, and nothing for a series not under way (This weekend, Home’s retired piece, upgrades to it on read: page-document.test.ts)', async () => {
    const band = async (settings: Record<string, string | number | boolean>) => html((await renderComponents(doc([region('b', 'series.live', settings)]), { path: '/x' })).b);
    expect(canRender('series.live')).toBe(true);
    const every = await band({ series: '', also: true });
    expect(every).toContain('This weekend');
    expect(every).toContain('Italian Grand Prix');
    expect(every).not.toContain('Japanese Grand Prix');
    expect(every).not.toContain('Also racing');
    // The Also racing row follows the toggle.
    const busy = { ...LIVE_MODEL, alsoRacing: [{ seriesSlug: 'dtm', seriesName: 'DTM', color: '#000000', eventName: 'Red Bull Ring', href: '/series/dtm/weekend/7', sessionName: 'Race 1', startIso: '2026-09-26T11:30:00Z' }] };
    loadLiveModel.mockResolvedValueOnce(busy as unknown as LiveModel);
    const withRow = await band({ series: '', also: true });
    expect(withRow).toContain('Also racing');
    expect(withRow).toContain('DTM');
    loadLiveModel.mockResolvedValueOnce(busy as unknown as LiveModel);
    const noRow = await band({ series: '', also: false });
    expect(noRow).toContain('Italian Grand Prix');
    expect(noRow).not.toContain('Also racing');
    // One series: its box alone, whether Home features it or not; a series not under way draws nothing.
    const one = await band({ series: 'motogp', also: true });
    expect(one).toContain('Japanese Grand Prix');
    expect(one).not.toContain('Italian Grand Prix');
    expect(one).not.toContain('Also racing');
    expect(await band({ series: 'wec', also: true })).toBe('');
  });

  it('P2.8: the Countdown draws the next session of one series or the nearest across every series from a saved document: its name and its weekend as links, the reader’s time and the time at the track, the tick with its live end; a date-only weekend without digits; one line when nothing is to come; the heading or the weekend’s title as the h1 when first', async () => {
    // The tick (NextRaceCountdown) reads the machine's clock, not the render's instant: a session already begun draws no digits
    // on the server (the LIVE pill is the client's), one to come draws them. So the fixtures sit around the real now.
    const AT = new Date();
    const h = (n: number) => new Date(AT.getTime() + n * 3_600_000);
    const mk = (slug: string, name: string, color: string, sessions: Partial<Session>[]): Series =>
      ({
        meta: { slug, name, color, season: 2026 },
        sessions: sessions.map((s, i) => ({ uid: `${slug}-${i}`, seriesSlug: slug, title: s.title ?? 'Race', start: s.start!, end: s.end!, location: s.location, dateOnly: s.dateOnly })),
      }) as unknown as Series;
    const f1 = mk('f1', 'Formula 1', '#e10600', [
      { title: 'F1 - Qualifying', start: h(-22), end: h(-21), location: 'Baku City Circuit' },
      { title: 'F1 - Race', start: h(-1), end: h(1), location: 'Baku City Circuit' },
    ]);
    const motogp = mk('motogp', 'MotoGP', '#cc0000', [{ title: 'MotoGP: Race', start: h(2), end: h(3), location: 'Motegi' }]);
    const wrc = mk('wrc', 'WRC', '#005f9e', [{ title: 'Rally Chile', start: h(4 * 24), end: h(7 * 24), location: 'Concepción', dateOnly: true }]);
    const wec = mk('wec', 'FIA WEC', '#0f4c81', [{ title: 'WEC - Race', start: h(-14 * 24), end: h(-14 * 24 + 6), location: 'Fuji Speedway' }]);
    const bySlug: Record<string, Series> = { f1, motogp, wrc, wec };
    const loadAll = vi.spyOn(seriesLib, 'loadAllSeries').mockResolvedValue([motogp, f1, wrc]);
    const loadOne = vi.spyOn(seriesLib, 'loadSeries').mockImplementation(async slug => bySlug[slug]);
    const circuit = vi.spyOn(circuitsLib, 'matchCircuit').mockImplementation(async (...names) => (names.some(n => n && /baku/i.test(n)) ? { name: 'Baku City Circuit', lat: 40.37, lon: 49.85, aliases: [], tz: 'Asia/Baku' } : null));
    const draw = async (settings: Record<string, string | number | boolean>, before: Region[] = []) =>
      html((await renderComponents(doc([...before, region('c', 'series.countdown', settings, { seq: 20 })]), { path: '/x', now: AT })).c);
    expect(canRender('series.countdown')).toBe(true);

    // Every series: F1’s race is under way and ranks first; its weekend and session are links; the reader’s time and the track’s
    // (Baku, GMT+4); a session begun draws no digits on the server, the LIVE pill being the client’s.
    const every = await draw({ series: '' });
    expect(every).toContain('<section aria-label="Countdown"');
    expect(every).toContain('Formula 1 · Round 1');
    expect(every).toMatch(/<h1 class="[^"]*"><a href="\/series\/f1\/weekend\/1"[^>]*>Baku City Circuit<\/a><\/h1>/);
    expect(every).toMatch(/<a href="\/series\/f1\/weekend\/1\/race"[^>]*>F1 - Race<\/a>/);
    expect(every).toMatch(/[A-Z][a-z]{2}, \d{2}:\d{2} GMT\+4 at the track/);
    expect(every).not.toContain('Time until');
    expect(every).not.toContain('MotoGP');
    expect(circuit).toHaveBeenCalledWith('Baku City Circuit', 'Baku City Circuit');
    expect(loadAll).toHaveBeenCalled();

    // One series: MotoGP’s race in two hours counts down (the digits with the weekend’s dates as their label); the circuit is
    // unknown, so the reader’s time alone; a heading is the h1 when first.
    const one = await draw({ series: 'motogp', heading: 'Next up' });
    expect(one).toContain('<section aria-label="Next up"');
    expect(one).toMatch(/<h1 class="[^"]*">Next up<\/h1>/);
    expect(one).toContain('MotoGP · Round 1');
    expect(one).toMatch(/<a href="\/series\/motogp\/weekend\/1"[^>]*>Motegi<\/a>/);
    expect(one).toContain('MotoGP: Race');
    expect(one).toMatch(/aria-label="Time until [^"]+"/);
    expect(one).toMatch(/\d{2}:\d{2}:\d{2}</);
    expect(one).not.toContain('at the track');
    expect(one).not.toMatch(/<h1 class="[^"]*"><a/);
    expect(loadOne).toHaveBeenCalledWith('motogp');

    // The time at the track off, and the links off: words alone.
    const plain = await draw({ series: 'f1', venueTime: false, link: false });
    expect(plain).not.toContain('at the track');
    expect(plain).not.toContain('<a ');
    expect(plain).toContain('Baku City Circuit');
    expect(plain).toContain('F1 - Race');

    // A date-only weekend: its dates and “times to be confirmed”, no digits.
    const rally = await draw({ series: 'wrc' });
    expect(rally).toContain('Concepción');
    expect(rally).toContain('times to be confirmed');
    expect(rally).not.toContain('Time until');

    // Nothing to come: one line, not a hole; first in the Body without a heading, that line is the page's h1 (the reviewer's finding).
    const over = await draw({ series: 'wec' });
    expect(over).toMatch(/<h1 class="[^"]*">Season complete\.<\/h1>/);
    loadAll.mockResolvedValueOnce([wec]);
    expect(await draw({ series: '' })).toMatch(/<h1 class="[^"]*">No session to come\.<\/h1>/);
    loadAll.mockResolvedValueOnce([wec]);
    expect(await draw({ series: '', heading: 'Next up' })).toMatch(/<p class="[^"]*">No session to come\.<\/p>/);

    // Not first in the Body: the heading is the rule’s words and the weekend’s title a span.
    const second = await draw({ series: 'f1', heading: 'Below' }, [region('h', 'page.heading', {}, { seq: 10 })]);
    expect(second).not.toContain('<h1');
    expect(second).toContain('>Below<');
    expect(second).toMatch(/<span class="[^"]*"><a href="\/series\/f1\/weekend\/1"[^>]*>Baku City Circuit<\/a><\/span>/);
    loadAll.mockRestore();
    loadOne.mockRestore();
    circuit.mockRestore();
  });

  it('the race-weekend fact follows the live band’s model: a box or a row under way is true; nothing under way, or a model that cannot be read, is false', async () => {
    expect(await raceWeekendNow()).toBe(true);
    loadLiveModel.mockResolvedValueOnce({ liveWeekends: [], alsoRacing: [], liveAll: [] } as unknown as LiveModel);
    expect(await raceWeekendNow()).toBe(false);
    loadLiveModel.mockRejectedValueOnce(new Error('down'));
    expect(await raceWeekendNow()).toBe(false);
  });

  it('R4.1: the page heading draws the page’s title, its name, or words of its own; the calendar draws its family’s assembly', async () => {
    const page = { path: '/calendar', name: 'Calendar', title: null };
    const out = await renderComponents(doc([region('heading', 'page.heading'), region('month', 'calendar.month', {}, { seq: 20 })]), { path: '/calendar', params: {}, page });
    expect(html(out.heading)).toMatch(/<h1[^>]*>Calendar<\/h1>/);
    expect(html(out.month)).toContain('data-calendar="2026-09-09T12:00:00.000Z"');
    expect(html(out.month)).toContain('Spanish Grand Prix (Madrid)');
    // X6 C: the round rides on each entry; the calendar receives no lookup keyed by the feed’s ids.
    expect(html(out.month)).toContain('data-rounds="14|"');
    expect(html(out.month)).toContain('data-lookup="no"');
    const titled = await renderComponents(doc([region('heading', 'page.heading')]), { path: '/calendar', page: { ...page, title: 'Race calendar 2026' } });
    expect(html(titled.heading)).toContain('>Race calendar 2026<');
    const own = await renderComponents(doc([region('heading', 'page.heading', { text: 'Every session' })]), { path: '/calendar', page });
    expect(html(own.heading)).toContain('>Every session<');
    expect(html(own.heading)).toMatch(/<h1 class="font-serif text-34[^"]*">Every session<\/h1>/);
    expect(html(own.heading)).not.toContain('<p');
    // R18: the eyebrow above the heading in the series pages' season-line face, the standfirst below it in the blog's prose face.
    const dressed = await renderComponents(doc([region('heading', 'page.heading', { text: 'Formula 2 champions', eyebrow: 'Formula 2 · Roll of honour', standfirst: 'Every champion since 2005.' })]), { path: '/calendar', page });
    expect(html(dressed.heading)).toMatch(/^<header><p class="mb-2 font-mono[^"]*">Formula 2 · Roll of honour<\/p><h1[^>]*>Formula 2 champions<\/h1><p class="mt-3[^"]*font-serif[^"]*">Every champion since 2005\.<\/p><\/header>$/);
    // R13 (the SEO check of 2026-09-27): a heading region that is not the first showing in the Body is an h2 of the same look;
    // Home's eight section headings drew eight h1s.
    const second = await renderComponents(doc([region('month', 'calendar.month', {}, { seq: 10 }), region('heading', 'page.heading', { text: 'Below the month' }, { seq: 20 })]), { path: '/calendar', params: {}, page });
    expect(html(second.heading)).toMatch(/<h2 class="font-serif text-34[^"]*">Below the month<\/h2>/);
    expect(html(second.heading)).not.toContain('<h1');
  });

  it('X6 C: the calendar’s own model carries each session’s round on the entry and a short key, never the round map or the feed’s ids', async () => {
    const real = await vi.importActual<typeof import('./families/calendar')>('./families/calendar');
    const s = (uid: string, title: string, start: string) => ({ uid, seriesSlug: 'f1', title, start: new Date(start), end: new Date(new Date(start).getTime() + 3_600_000), location: 'Monza' });
    vi.spyOn(seriesLib, 'loadAllSeries').mockResolvedValue([
      { meta: { slug: 'f1', name: 'Formula 1', color: '#e10600', season: 2026 }, sessions: [s('ics-uid-one-very-long-identifier@example', 'F1 - Qualifying', '2026-09-05T14:00:00Z'), s('ics-uid-two-very-long-identifier@example', 'F1 - Race', '2026-09-06T13:00:00Z'), s('ics-uid-three-very-long-identifier@example', 'F1 - Race', '2026-09-20T13:00:00Z')] } as unknown as Series,
    ]);
    const m = await real.loadCalendarModel();
    expect(Object.keys(m).sort()).toEqual(['items', 'roundNames', 'serverNow']);
    expect(m.items.map(i => i.round)).toEqual([1, 1, 2]);
    expect(m.items.map(i => i.session.uid)).toEqual(['0', '1', '2']);
    expect(m.items[0].session.location).toBe('Monza');
    expect(JSON.stringify(m)).not.toContain('very-long-identifier');
    // The bound on the payload: a session weighs its own fields (two dates, a title, the series' name, slug and colour, a
    // location, a round), about 230 bytes; the map and the feed's ids that rode along before were another 130.
    expect(JSON.stringify(m).length / m.items.length).toBeLessThan(300);
  });
  it('P2.17: the Breadcrumb draws the page’s place from its address in the Breadcrumb Bar: Home, the pages above as links, the page itself current, a separator between; its BreadcrumbList except where the page prints its own; nothing on Home', async () => {
    const names: Record<string, string> = { '/': 'Home', '/series': 'Series' };
    vi.spyOn(pageFrame, 'loadPageFrame').mockImplementation(async path => (path in names ? ({ name: names[path] } as unknown as pageFrame.PageFrame) : null));
    vi.spyOn(seriesLib, 'loadSeries').mockResolvedValue({ meta: { slug: 'f1', name: 'Formula 1', color: '#e10600', season: 2026 }, sessions: [] } as unknown as Series);
    vi.spyOn(pagesLib, 'loadPageDestinations').mockResolvedValue({});
    const draw = async (settings: Record<string, string | number | boolean>, where: { path: string; params?: Record<string, string>; page?: { path: string; name: string; title: string | null; id?: string } }) =>
      (await renderComponents(doc([region('b', 'page.breadcrumb', settings, { position: 'breadcrumb' })]), where)).b;
    expect(canRender('page.breadcrumb')).toBe(true);

    // The series tab: the trail as a nav with a list; the ancestors links, the tab current; the page prints its own BreadcrumbList.
    const tab = html(await draw({}, { path: '/series/[slug]/[tab]', params: { slug: 'f1', tab: 'standings' } }));
    expect(tab).toContain('<nav aria-label="Breadcrumb"');
    expect(tab).toContain('<ol');
    expect(tab).toContain('<a href="/"');
    expect(tab).toMatch(/<a href="\/series\/f1"[^>]*>Formula 1<\/a>/);
    expect(tab).toMatch(/<span aria-current="page"[^>]*>Standings<\/span>/);
    expect(tab.split('›').length - 1).toBe(3);
    expect(tab).not.toContain('application/ld+json');
    expect(tab).not.toContain('<h1');

    // A row page: the trail and the BreadcrumbList with it, Home first, the page's title last.
    const row = html(await draw({}, { path: '/history/monza', params: {}, page: { path: '/history/monza', name: 'Monza', title: 'Monza, a history', id: 'p1' } }));
    expect(row).toMatch(/<span aria-current="page"[^>]*>Monza, a history<\/span>/);
    expect(row).toContain('application/ld+json');
    expect(row).toContain('"@type":"BreadcrumbList"');
    expect(row).toContain('"position":2,"name":"Monza, a history","item":"https://paddock-tracker.com/history/monza"');
    expect(row).toContain('"position":1,"name":"Home","item":"https://paddock-tracker.com"');

    // Show Home off, the slash, This page off: no link to Home, no current page, the slash between.
    const bare = html(await draw({ home: false, separator: 'slash', current: false }, { path: '/series/[slug]/[tab]', params: { slug: 'f1', tab: 'standings' } }));
    expect(bare).not.toContain('<a href="/"');
    expect(bare).not.toContain('aria-current');
    expect(bare).toContain('Formula 1</a>');
    expect(bare.split('›').length - 1).toBe(0);
    expect(bare).toMatch(/aria-hidden="true"[^>]*>\/</);

    // Home, or one crumb: nothing.
    expect(await draw({}, { path: '/', params: {} })).toBeNull();
    expect(await draw({ home: false }, { path: '/about', params: {} })).toBeNull();
  });

  it('P2.10: the Tabs draw a strip over the page’s regions that opt in, in order, Show all first, the icons when asked, nothing with one tab; or a strip of the sibling pages, the current one marked', async () => {
    const opt = (id: string, seq: number, over: Partial<Region> = {}): Region =>
      ({ id, kind: 'static', title: id.toUpperCase(), position: 'body', seq, column: 1, span: 12, newRow: true, hidden: false, authz: null, text: 'x', selector: true, ...over }) as Region;
    const where = { path: '/history/monza', params: {} };
    const out = await renderComponents(doc([region('tabs', 'page.tabs', {}, { seq: 5 }), opt('preview', 10, { icon: 'flag' }), opt('report', 20), opt('aside', 30, { selector: undefined })]), where);
    const strip = html(out.tabs);
    expect(strip).toContain('role="tablist"');
    expect(strip).toMatch(/<button[^>]*role="tab"[^>]*aria-selected="true"[^>]*aria-controls="region-preview"/);
    expect(strip).toMatch(/aria-selected="false"[^>]*aria-controls="region-report"/);
    expect(strip).not.toContain('region-aside');
    expect(strip.indexOf('Show all')).toBeLessThan(strip.indexOf('PREVIEW'));
    expect(strip.indexOf('PREVIEW')).toBeLessThan(strip.indexOf('REPORT'));
    expect(strip).not.toContain('<svg');
    const icons = html((await renderComponents(doc([region('tabs', 'page.tabs', { icons: true, showAll: false }, { seq: 5 }), opt('preview', 10, { icon: 'flag' }), opt('report', 20)]), where)).tabs);
    expect(icons).toContain('<svg');
    expect(icons).not.toContain('Show all');
    // One tab: nothing. A sub region and another position never count.
    expect((await renderComponents(doc([region('tabs', 'page.tabs', {}, { seq: 5 }), opt('preview', 10), opt('sub', 30, { parent: 'preview' }), opt('foot', 10, { position: 'footer' })]), where)).tabs).toBeNull();
    // Sibling pages: the series tab's sub-pages and News as links, the current one marked; nothing where the address has no siblings.
    vi.spyOn(seriesLib, 'loadSeries').mockResolvedValue({ meta: { slug: 'f1', name: 'Formula 1', color: '#e10600', season: 2026 }, sessions: [] } as unknown as Series);
    const pages = html((await renderComponents(doc([region('tabs', 'page.tabs', { over: 'pages' }, { seq: 5 })]), { path: '/series/[slug]/[tab]', params: { slug: 'f1', tab: 'standings' } })).tabs);
    expect(pages).toContain('<nav aria-label="Pages"');
    expect(pages).toMatch(/<a[^>]*href="\/series\/f1"[^>]*>Calendar<\/a>/);
    expect(pages).toMatch(/<a[^>]*href="\/series\/f1\/standings"[^>]*>Standings<\/a>/);
    expect(pages.match(/aria-current="page"/g)).toHaveLength(1);
    expect(pages).toMatch(/aria-current="page"[^>]*>Standings<\/a>|href="\/series\/f1\/standings"[^>]*aria-current="page"/);
    expect(pages).toContain('>News</a>');
    expect((await renderComponents(doc([region('tabs', 'page.tabs', { over: 'pages' }, { seq: 5 })]), { path: '/about', params: {} })).tabs).toBeNull();
  });

  it('P2.14: the Weather draws the forecast at the track for the page’s weekend or the series’ next, by venue-local time, hour by hour by session or day by day with the sessions; the curated venue first; nothing without the build option; one line without a forecast', async () => {
    // Clock-relative fixtures (the grouping keeps a window around now): a weekend three days ahead, its round curated to Sepang
    // while its sessions say Bahrain, so the venue rule shows. The forecast is venue-local (UTC+2 in the fixture) as Open-Meteo
    // returns it under timezone=auto: its keys are computed from the same instants.
    const day = (n: number, h: number, m = 0) => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() + n);
      d.setUTCHours(h, m);
      return d;
    };
    const OFFSET = 7200;
    const iso = (d: Date) => new Date(d.getTime() + OFFSET * 1000).toISOString().slice(0, 10);
    const hourKey = (d: Date) => `${new Date(d.getTime() + OFFSET * 1000).toISOString().slice(0, 13)}:00`;
    const fp1 = { start: day(3, 11, 30), end: day(3, 12, 30) };
    const race = { start: day(5, 13), end: day(5, 15) };
    const f1 = {
      meta: { slug: 'f1', name: 'Formula 1', color: '#e10600', season: 2026 },
      sessions: [
        { uid: 'fp1', seriesSlug: 'f1', title: 'F1 - Practice 1', start: fp1.start, end: fp1.end, location: 'Bahrain International Circuit' },
        { uid: 'race', seriesSlug: 'f1', title: 'F1 - Race', start: race.start, end: race.end, location: 'Bahrain International Circuit' },
      ],
      rounds: { season: 2026, rounds: [{ round: 16, name: 'Bahrain Grand Prix', venue: 'Sepang International Circuit', startDate: iso(fp1.start), endDate: iso(race.end) }] },
    } as unknown as Series;
    const hours: string[] = [];
    for (let t = day(3, 0).getTime(); t <= day(6, 0).getTime(); t += 3_600_000) hours.push(hourKey(new Date(t)));
    const forecast: weatherLib.WeatherForecast = {
      lat: 2.76,
      lon: 101.74,
      fetchedAt: new Date().toISOString(),
      utcOffsetSeconds: OFFSET,
      daily: [iso(fp1.start), iso(day(4, 12)), iso(race.start)].map((date, i) => ({ date, maxC: 30 + i, minC: 24, precipProb: 10 * i, precipMm: 0, windKph: 12, weatherCode: 2 })),
      hourly: hours.map((time, i) => ({ time, tempC: 25 + (i % 7), precipProb: (i * 7) % 100, precipMm: 0, windKph: 10, weatherCode: 2 })),
    };
    vi.spyOn(seriesLib, 'loadSeries').mockResolvedValue(f1);
    vi.spyOn(seriesLib, 'loadAllSeries').mockResolvedValue([f1]);
    const circuit = vi.spyOn(circuitsLib, 'matchCircuit').mockImplementation(async (...names) => (names.some(n => n && /sepang/i.test(n)) ? { name: 'Sepang International Circuit', lat: 2.76, lon: 101.74, aliases: [], tz: 'Asia/Kuala_Lumpur' } : null));
    const fetched = vi.spyOn(weatherLib, 'fetchWeather').mockResolvedValue(forecast);
    const included = vi.spyOn(buildOptionsLib, 'isBuildOptionIncluded').mockResolvedValue(true);
    const draw = async (settings: Record<string, string | number | boolean>, where: { path: string; params?: Record<string, string> }, before: Region[] = []) =>
      (await renderComponents(doc([...before, region('w', 'series.weather', settings, { seq: 20 })]), { ...where, now: new Date() })).w;
    expect(canRender('series.weather')).toBe(true);

    // The weekend page: its own weekend from the address; the curated venue (Sepang) first; a tile per session, the hours venue-local.
    const page = { path: '/series/[slug]/weekend/[round]', params: { slug: 'f1', round: '16' } };
    const sessions = html(await draw({}, page));
    expect(sessions).toContain('<section aria-label="Weather"');
    expect(sessions).toContain('Formula 1 · Round 16');
    expect(sessions).toContain('Source: Open-Meteo · Sepang International Circuit');
    expect(circuit.mock.calls[0][0]).toBe('Sepang International Circuit');
    expect(fetched).toHaveBeenCalledWith(2.76, 101.74);
    expect(sessions).toContain('>FP1<');
    expect(sessions).toContain('>RACE<');
    expect(sessions).toContain(`${hourKey(race.start).slice(11, 16)}-${hourKey(race.end).slice(11, 16)}`);
    // FP1 13:30-14:30 local reads 13:00, 14:00, 15:00; the race 15:00-17:00 local reads 15:00, 16:00, 17:00.
    expect(sessions.split('<li').length - 1).toBe(3 + 3);
    // Rows per session 2: each tile keeps its first and last hour.
    const thin = html(await draw({ hours: 2 }, page));
    expect(thin.split('<li').length - 1).toBe(2 + 2);
    // Day by day, with the sessions: one tile per venue-local day, the sessions under their day with the hour's reading.
    const daily = html(await draw({ view: 'daily' }, page));
    expect(daily).toContain('<section aria-label="Weather"');
    expect(daily.match(/data-day="/g)).toHaveLength(2);
    expect(daily.indexOf('>FP1<')).toBeLessThan(daily.indexOf('>RACE<'));
    expect(daily).toContain(`${hourKey(race.start).slice(11, 16)}`);
    expect(daily).toContain('30°');
    // Every series, no address: the nearest weekend to come is the same one.
    const nearest = html(await draw({ series: '' }, { path: '/x' }));
    expect(nearest).toContain('Formula 1 · Round 16');
    // A heading is the rule; first in the Body without one, the eyebrow line is the page's h1.
    expect(html(await draw({ heading: 'At the track' }, page))).toContain('>At the track<');
    expect(html(await draw({}, page))).toMatch(/<h1[^>]*>Formula 1 · Round 16/);
    // No circuit: one line, the h1 when first without a heading; the Weather build option excluded: nothing at all.
    circuit.mockResolvedValue(null);
    const none = html(await draw({}, page));
    expect(none).toMatch(/<h1[^>]*>No forecast for Bahrain Grand Prix yet\.<\/h1>/);
    included.mockResolvedValue(false);
    expect(await draw({}, page)).toBeNull();
  });
});

describe('the Chart (P2.11; APEX: the Chart region)', () => {
  const draw = async (settings: Record<string, string | number | boolean>, over: Partial<Region> = {}, where: { path: string; params?: Record<string, string> } = { path: '/x' }) =>
    (await renderComponents(doc([region('c', 'data.chart', settings, { source: 'standings?series=f1&season=2026', ...over } as Partial<Region>)]), where)).c;
  const trendRows = (kind: string, name: string, code: string | null, team: string, byRound: number[]) =>
    byRound.map((points, i) => ({ kind, round: i + 1, race: ['Australian Grand Prix', 'Chinese Grand Prix', 'Japanese Grand Prix'][i], name, code, team, points, gained: points - (byRound[i - 1] ?? 0), total: byRound[byRound.length - 1], profile: null, seriesName: 'Formula 1', colour: '#e10600' }));
  const TREND = [
    ...trendRows('driver', 'Andrea Kimi Antonelli', 'ANT', 'Mercedes', [25, 43, 68]),
    ...trendRows('driver', 'George Russell', 'RUS', 'Mercedes', [18, 43, 58]),
    ...trendRows('driver', 'Isack Hadjar', 'HAD', 'RB F1 Team', [6, 10, 22]),
    ...trendRows('driver', 'Liam Lawson', 'LAW', 'RB F1 Team', [0, 2, 3]),
    ...trendRows('constructor', 'Mercedes', null, 'Mercedes', [43, 86, 126]),
    ...trendRows('constructor', 'RB F1 Team', null, 'RB F1 Team', [6, 12, 25]),
  ];
  const trend = () => readSource.mockResolvedValueOnce({ columns: [], total: TREND.length, rows: TREND, provenance: { ref: { source: 'trend', params: { series: 'f1', season: 2026 } }, label: 'Season trend · Formula 1 · 2026', tier: 'snapshot', keys: ['f1:results', 'f1:sprints', 'f1:last-race'], rows: TREND.length, ms: 2 } });
  const F1_TREND = { source: 'trend?series=f1&season=2026' } as Partial<Region>;

  it('from a saved document over the standings draws a bar chart of the drivers’ points on the preset’s own mapping, the data as a hidden table, the heading the preset’s name as the h1 when first; nothing without a value column of the shape; one line without rows; not first, the rule is a span', async () => {
    expect(canRender('data.chart')).toBe(true);
    // The default mock rows: the Drivers preset keeps the two driver rows, the constructor's goes; its own mapping is bars of points by name.
    const bars = html(await draw({ preset: 'drivers' }));
    expect(bars).toContain('<section aria-label="Drivers"');
    expect(bars).toMatch(/<h1[^>]*>Drivers<\/h1>/);
    expect(bars).toContain('data-chart-type="bar"');
    expect(bars).toContain('data-decimals="false"');
    expect(bars).toContain('style="height:320px"');
    // The hidden table: the label column's heading (the preset's name label), one series named by the value column, the two rows with their points.
    expect(bars).toMatch(/<table class="sr-only"[^>]*>.*<th[^>]*>Driver<\/th><th[^>]*>Pts<\/th>.*<td[^>]*>Andrea Kimi Antonelli<\/td><td[^>]*>267<\/td>.*<td[^>]*>George Russell<\/td><td[^>]*>201<\/td>/);
    expect(bars).not.toContain('Mercedes');
    // One series: no legend, no chips; the foot names what is drawn by what.
    expect(bars).not.toContain('<button');
    expect(bars).toContain('Pts by Driver');
    // A shape without a chart mapping and nothing set draws nothing; a mapping naming a column the shape lacks too.
    expect(await draw({ preset: 'season-results-imsa' }, { source: 'results?series=imsa&season=2026' } as Partial<Region>)).toBeNull();
    expect(await draw({ preset: 'drivers', value: 'nope' })).toBeNull();
    // No rows: one line under the rule.
    readSource.mockResolvedValueOnce({ columns: [], total: 0, rows: [], provenance: { ref: { source: 'standings', params: { series: 'f1', season: 2026 } }, label: 'Standings · Formula 1 · 2026', tier: 'rows', keys: [], rows: 0, ms: 1 } });
    const none = html(await draw({ preset: 'drivers', heading: 'Points' }));
    expect(none).toMatch(/<h1[^>]*>Points<\/h1>/);
    expect(none).toContain('No data yet.');
    expect(none).not.toContain('data-chart-type');
    const second = html((await renderComponents(doc([region('h', 'page.heading'), region('c', 'data.chart', { preset: 'drivers' }, { source: 'standings?series=f1&season=2026', seq: 20 } as Partial<Region>)]), { path: '/x' })).c);
    expect(second).not.toContain('<h1');
    expect(second).toContain('>Drivers<');
  });

  it('over the season trend draws a line per driver with the legend’s chips and their last value, the series shown at first the leaders and the rest behind “+N more”; a row rule keeps two drivers’ lines; the emphasis on a team’s page goes through its curated drivers (Racing Bulls is “RB F1 Team” in the feed), on a driver’s page to the driver’s own line', async () => {
    trend();
    const lines = html(await draw({ preset: 'drivers-trend', shown: 2 }, F1_TREND));
    expect(lines).toContain('<section aria-label="Drivers&#x27; season trend"');
    expect(lines).toContain('data-chart-type="line"');
    // The chips: the two leaders by their last value pressed, the other two behind "+2 more"; each chip its label and last value.
    expect(lines.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(lines).not.toContain('aria-pressed="false"');
    expect(lines).toMatch(/aria-pressed="true"[^>]*>.*?Andrea Kimi Antonelli<span[^>]*>68<\/span>/);
    expect(lines).toContain('+2 more');
    // The hidden table: a heading per series in rank order, a row per round with the points.
    expect(lines).toMatch(/<th[^>]*>Round<\/th><th[^>]*>Andrea Kimi Antonelli<\/th><th[^>]*>George Russell<\/th><th[^>]*>Isack Hadjar<\/th><th[^>]*>Liam Lawson<\/th>/);
    expect(lines).toMatch(/<td[^>]*>3<\/td><td[^>]*>68<\/td><td[^>]*>58<\/td><td[^>]*>22<\/td><td[^>]*>3<\/td>/);
    expect(lines).toContain('Points by Round');
    // A row rule keeps two drivers' lines: the comparison.
    trend();
    const two = html(await draw({ preset: 'drivers-trend', rule: 'name.in:George Russell,Liam Lawson' }, F1_TREND));
    expect(two).toMatch(/<th[^>]*>Round<\/th><th[^>]*>George Russell<\/th><th[^>]*>Liam Lawson<\/th><\/tr>/);
    // A team's page: its curated drivers name the feed's team, so both drivers' lines are emphasised and drawn whatever the cap; the
    // constructors' trend emphasises the team's own line; the foot names the team.
    vi.spyOn(peopleLib, 'findTeamBySlug').mockResolvedValue({ slug: 'racing-bulls', name: 'Racing Bulls', seriesSlug: 'f1', seriesName: 'Formula 1', seriesColor: '#e10600', drivers: [{ name: 'Isack Hadjar', slug: 'isack-hadjar' }, { name: 'Liam Lawson', slug: 'liam-lawson' }] });
    trend();
    const team = html(await draw({ preset: 'drivers-trend', shown: 2, emphasis: 'page' }, F1_TREND, { path: '/teams/[slug]', params: { slug: 'racing-bulls' } }));
    expect(team).toContain('data-emphasis="s2 s3"');
    expect(team.match(/aria-pressed="true"/g)).toHaveLength(4);
    expect(team).not.toContain('more');
    expect(team).toContain('Racing Bulls highlighted');
    trend();
    const teams = html(await draw({ preset: 'constructors-trend', emphasis: 'page' }, F1_TREND, { path: '/teams/[slug]', params: { slug: 'racing-bulls' } }));
    expect(teams).toContain('data-emphasis="s1"');
    expect(teams).toMatch(/<th[^>]*>Round<\/th><th[^>]*>Mercedes<\/th><th[^>]*>RB F1 Team<\/th><\/tr>/);
    // A driver's page emphasises the driver's own line (the roster's spelling against the feed's).
    vi.spyOn(peopleLib, 'findDriverBySlug').mockResolvedValue({ slug: 'kimi-antonelli', name: 'Kimi Antonelli', team: 'Mercedes', teamSlug: 'mercedes', seriesSlug: 'f1', seriesName: 'Formula 1', seriesColor: '#e10600' });
    trend();
    const driver = html(await draw({ preset: 'drivers-trend', emphasis: 'page' }, F1_TREND, { path: '/drivers/[slug]', params: { slug: 'kimi-antonelli' } }));
    expect(driver).toContain('data-emphasis="s0"');
    expect(driver).toContain('Kimi Antonelli highlighted');
    // Elsewhere the emphasis setting draws nothing thick.
    trend();
    expect(html(await draw({ preset: 'drivers-trend', emphasis: 'page' }, F1_TREND))).toContain('data-emphasis=""');
  });

  it('reads a session’s gaps as numbers (+0.100 → 0.1) with a decimal value axis, the pole sitter’s empty gap drawing no bar', async () => {
    readSource.mockResolvedValueOnce({
      columns: [],
      total: 2,
      rows: [
        { round: 15, session: 'qualifying', position: 1, driver: 'Kimi Antonelli', code: 'ANT', team: 'Mercedes', laps: 18, time: '1:40.123', gap: null, interval: null, q1: null, q2: null, q3: null, compound: 'Soft', points: null, status: null, weekend: '/series/f1/weekend/15', profile: null },
        { round: 15, session: 'qualifying', position: 2, driver: 'George Russell', code: 'RUS', team: 'Mercedes', laps: 17, time: '1:40.223', gap: '+0.100', interval: '+0.100', q1: null, q2: null, q3: null, compound: 'Soft', points: null, status: null, weekend: '/series/f1/weekend/15', profile: null },
      ],
      provenance: { ref: { source: 'session-results', params: { series: 'f1', season: 2026, round: 'latest', session: 'qualifying' } }, label: 'Session results · Formula 1 · 2026 · Latest captured · Qualifying', tier: 'db', keys: [], rows: 2, ms: 1 },
    });
    const gaps = html(await draw({ preset: 'session' }, { source: 'session-results?series=f1&season=2026&round=latest&session=qualifying' } as Partial<Region>));
    expect(gaps).toContain('data-chart-type="bar"');
    expect(gaps).toContain('data-decimals="true"');
    expect(gaps).toMatch(/<td[^>]*>Kimi Antonelli<\/td><td[^>]*><\/td>.*<td[^>]*>George Russell<\/td><td[^>]*>0\.1<\/td>/);
    expect(gaps).toContain('Gap by Driver');
  });
});

describe('the Circuit (P2.15; ours by name: the round’s venue)', () => {
  // Clock-relative fixtures (the grouping keeps a window around now): round 14 a week ahead, the Spanish Grand Prix (Madrid) with
  // no curated venue (the title resolves it, the 1.0.97 rule); round 15 two weeks ahead, Baku, with a curated drawing.
  const day = (n: number, h: number) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + n);
    d.setUTCHours(h);
    return d;
  };
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const f1 = {
    meta: { slug: 'f1', name: 'Formula 1', color: '#e10600', season: 2026 },
    sessions: [
      { uid: 'r14-fp1', seriesSlug: 'f1', title: 'F1 - Practice 1', start: day(7, 11), end: day(7, 12) },
      { uid: 'r14-race', seriesSlug: 'f1', title: 'F1 - Race', start: day(9, 13), end: day(9, 15) },
      { uid: 'r15-fp1', seriesSlug: 'f1', title: 'F1 - Practice 1', start: day(14, 9), end: day(14, 10) },
      { uid: 'r15-race', seriesSlug: 'f1', title: 'F1 - Race', start: day(16, 11), end: day(16, 13) },
    ],
    rounds: {
      season: 2026,
      rounds: [
        { round: 14, name: 'Spanish Grand Prix (Madrid)', startDate: iso(day(7, 0)), endDate: iso(day(9, 0)) },
        { round: 15, name: 'Azerbaijan Grand Prix', startDate: iso(day(14, 0)), endDate: iso(day(16, 0)) },
      ],
    },
  } as unknown as Series;
  const MADRING = { slug: 'madring', circuit: { name: 'Madring', countryCode: 'ES', lat: 40.46528, lon: -3.61528, aliases: [], tz: 'Europe/Madrid' } };
  const BAKU = { slug: 'baku', circuit: { name: 'Baku City Circuit', countryCode: 'AZ', lat: 40.3725, lon: 49.8533, aliases: [], tz: 'Asia/Baku' } };
  const entry = (slug: string, question: string, track: Record<string, unknown>) => ({ kind: 'track', topic: 'tracks', slug, question, track }) as unknown as InfoEntry;
  const MADRING_ENTRY = entry('madring', 'Madring', { country: 'Spain', countryCode: 'ES', location: { lat: 40.46528, lng: -3.61528 }, type: 'street', categories: ['f1'], lengthKm: 5.416, turns: 22, opened: 2026 });
  const BAKU_ENTRY = entry('baku-city-circuit', 'Baku City Circuit', { country: 'Azerbaijan', countryCode: 'AZ', location: { lat: 40.3725, lng: 49.8533 }, type: 'street', categories: ['f1'], lengthKm: 6.003, turns: 20, opened: 2016 });

  it('draws the page’s weekend’s venue or the series’ next: the name and place, the facts from the hub’s track entry across the bridge, the drawing with its credit where one is curated, the map with one marker; Madring for round 14 by the title; a matched circuit without an entry keeps its country; one line without a match; the switches', async () => {
    const loadOne = vi.spyOn(seriesLib, 'loadSeries').mockResolvedValue(f1);
    const loadAll = vi.spyOn(seriesLib, 'loadAllSeries').mockResolvedValue([f1]);
    const circuit = vi.spyOn(circuitsLib, 'matchCircuitEntry').mockImplementation(async (...names) => (names.some(n => n && /madrid|madring/i.test(n)) ? MADRING : names.some(n => n && /azerbaijan|baku/i.test(n)) ? BAKU : null));
    const layout = vi.spyOn(circuitLayoutLib, 'circuitLayoutFor').mockImplementation(async (...names) => (names.some(n => n && /azerbaijan|baku/i.test(n)) ? { svg: '/circuits/baku.svg', source: 'f1db', license: 'CC BY 4.0', sourceUrl: 'https://github.com/f1db/f1db', name: 'Baku City Circuit' } : null));
    const bridge = vi.spyOn(informationLib, 'getTrackInfoByCircuitSlug').mockResolvedValue(new Map([['madring', 'madring'], ['baku', 'baku-city-circuit']]));
    const info = vi.spyOn(informationLib, 'getInfoEntry').mockImplementation(async (topic, slug) => (topic !== 'tracks' ? null : slug === 'madring' ? MADRING_ENTRY : slug === 'baku-city-circuit' ? BAKU_ENTRY : null));
    const draw = async (settings: Record<string, string | number | boolean>, where: { path: string; params?: Record<string, string> }, before: Region[] = []) =>
      (await renderComponents(doc([...before, region('v', 'series.circuit', settings, { seq: 20 })]), { ...where, now: new Date() })).v;
    try {
      expect(canRender('series.circuit')).toBe(true);
      // Round 14 on the weekend page: Madring by the title alone (no location, no curated venue), never Barcelona.
      const page14 = { path: '/series/[slug]/weekend/[round]', params: { slug: 'f1', round: '14' } };
      const madring = html(await draw({}, page14));
      expect(circuit.mock.calls[0]).toEqual([undefined, 'Spanish Grand Prix (Madrid)']);
      expect(madring).toContain('<section aria-label="The venue"');
      expect(madring).toMatch(/<h1[^>]*>Formula 1 · Round 14 · Spanish Grand Prix \(Madrid\)<\/h1>/);
      expect(madring).toContain('>Madring<');
      expect(madring).not.toContain('Barcelona');
      for (const fact of ['>Country<', '>Spain<', '>Type<', '>Street<', '>Length<', '>5.416 km<', '>Turns<', '>22<', '>Opened<', '>2026<']) expect(madring).toContain(fact);
      expect(madring).not.toContain('<figure');
      expect(madring).toContain('data-map-background="canvas"');
      expect(madring).toContain('style="height:280px"');
      expect(madring).toMatch(/<ul class="sr-only"[^>]*><li><a href="\/information\/tracks\/madring">Madring<\/a> · Spain<\/li><\/ul>/);
      expect(madring).toContain('Circuit guide →');
      expect(info).toHaveBeenCalledWith('tracks', 'madring');
      // Round 15: Baku's drawing with the credit its licence asks, the map, the facts and the guide across the bridge (the slugs differ).
      const baku = html(await draw({ heading: 'Where they race' }, { path: '/series/[slug]/weekend/[round]/[session]', params: { slug: 'f1', round: '15', session: 'race' } }));
      expect(baku).toContain('<section aria-label="Where they race"');
      expect(baku).toMatch(/<h1[^>]*>Where they race<\/h1>/);
      expect(baku).toContain('<figure');
      expect(baku).toContain('src="/circuits/baku.svg"');
      expect(baku).toContain('alt="Baku City Circuit track layout"');
      expect(baku).toContain('href="https://github.com/f1db/f1db"');
      expect(baku).toContain('f1db (CC BY 4.0)');
      expect(baku).toContain('>Azerbaijan<');
      expect(baku).toContain('>6.003 km<');
      expect(baku).toContain('href="/information/tracks/baku-city-circuit"');
      expect(layout).toHaveBeenCalledWith(undefined, 'Azerbaijan Grand Prix');
      expect(info).toHaveBeenCalledWith('tracks', 'baku-city-circuit');
      // A matched circuit the hub has no entry for: the name and its country from the code, no other fact, no guide, no popup link.
      bridge.mockResolvedValueOnce(new Map());
      const bare = html(await draw({}, page14));
      expect(bare).toContain('>Madring<');
      expect(bare).toContain('>Spain<');
      expect(bare).not.toContain('>Length<');
      expect(bare).not.toContain('Circuit guide');
      expect(bare).toMatch(/<li>Madring · Spain<\/li>/);
      // Not on a weekend page: one series' next weekend (round 14 is the nearest), or the nearest across every series.
      const hub = html(await draw({ series: 'f1' }, { path: '/series/[slug]', params: { slug: 'f1' } }));
      expect(hub).toContain('Formula 1 · Round 14 · Spanish Grand Prix (Madrid)');
      expect(hub).toContain('>Madring<');
      expect(html(await draw({}, { path: '/' }))).toContain('>Madring<');
      // The switches.
      const off = html(await draw({ map: false, layout: false, facts: false, guide: false }, { path: '/series/[slug]/weekend/[round]/[session]', params: { slug: 'f1', round: '15', session: 'race' } }));
      expect(off).toContain('>Baku City Circuit<');
      expect(off).not.toContain('data-map-background');
      expect(off).not.toContain('<figure');
      expect(off).not.toContain('<dl');
      expect(off).not.toContain('Circuit guide');
      // Nothing matched: one line naming the weekend.
      circuit.mockResolvedValueOnce(null);
      expect(html(await draw({}, page14))).toContain('No venue known for Spanish Grand Prix (Madrid) yet.');
      // Not first in the Body: the eyebrow a paragraph, the rule a span.
      const second = html(await draw({}, page14, [region('h', 'page.heading')]));
      expect(second).not.toContain('<h1');
      expect(second).toContain('>The venue<');
      expect(second).toContain('Formula 1 · Round 14 · Spanish Grand Prix (Madrid)');
    } finally {
      loadOne.mockRestore();
      loadAll.mockRestore();
      circuit.mockRestore();
      layout.mockRestore();
      bridge.mockRestore();
      info.mockRestore();
    }
  });
});

describe('the Map (P2.12; APEX: the Map region)', () => {
  const GUIDES = [
    { slug: 'monza', name: 'Autodromo Nazionale Monza', country: 'Italy', countryCode: 'IT', category: 'f1', categories: 'f1, endurance', lat: 45.6156, lon: 9.2811, page: '/information/tracks/monza', colour: '#ff4136' },
    { slug: 'spa', name: 'Circuit de Spa-Francorchamps', country: 'Belgium', countryCode: 'BE', category: 'endurance', categories: 'endurance', lat: 50.4372, lon: 5.9714, page: '/information/tracks/spa', colour: '#3b82f6' },
    { slug: 'nowhere', name: 'Nowhere', country: 'Nowhere', countryCode: null, category: null, categories: null, lat: null, lon: null, page: '/information/tracks/nowhere', colour: '#94a3b8' },
  ];
  const guides = (rows = GUIDES) => readSource.mockResolvedValueOnce({ columns: [], total: rows.length, rows, provenance: { ref: { source: 'guides', params: {} }, label: 'Circuit guides', tier: 'content', keys: [], rows: rows.length, ms: 1 } });
  const draw = async (settings: Record<string, string | number | boolean>, over: Partial<Region> = {}, where: { path: string; params?: Record<string, string> } = { path: '/x' }) =>
    (await renderComponents(doc([region('g', 'data.map', { preset: 'circuit-guides', ...settings }, { source: 'guides', ...over } as Partial<Region>)]), where)).g;

  it('from a saved document over the circuit guides marks the rows with coordinates on the Canvas background: the box at the height, the markers as a hidden list of links, the foot, the heading the preset’s name as the h1 when first; World with a row rule and a title column; the circuits without links; nothing without a coordinate column; one line without a place; not first, the rule a span', async () => {
    expect(canRender('data.map')).toBe(true);
    guides();
    const m = html(await draw({}));
    expect(m).toContain('<section aria-label="Circuit guides"');
    expect(m).toMatch(/<h1[^>]*>Circuit guides<\/h1>/);
    expect(m).toContain('data-map-background="canvas"');
    expect(m).toContain('data-map-view="auto"');
    expect(m).toContain('style="height:520px"');
    expect(m).toMatch(/<ul class="sr-only"[^>]*>.*<a href="\/information\/tracks\/monza"[^>]*>Autodromo Nazionale Monza<\/a> · Italy.*<a href="\/information\/tracks\/spa"[^>]*>Circuit de Spa-Francorchamps<\/a> · Belgium/);
    expect(m).not.toContain('Nowhere');
    expect(m).toContain('2 markers · Canvas');
    guides();
    const one = html(await draw({ view: 'world', rule: 'category.eq:endurance', heading: 'Endurance', title: 'country' }));
    expect(one).toContain('data-map-view="world"');
    expect(one).toMatch(/<h1[^>]*>Endurance<\/h1>/);
    expect(one).toContain('>Belgium</a>');
    expect(one).not.toContain('Monza');
    expect(one).toContain('1 marker · Canvas');
    readSource.mockResolvedValueOnce({ columns: [], total: 1, rows: [{ slug: 'monza', name: 'Autodromo Nazionale Monza', country: 'IT', lat: 45.6156, lon: 9.2811 }], provenance: { ref: { source: 'tracks', params: {} }, label: 'Tracks', tier: 'content', keys: [], rows: 1, ms: 1 } });
    const circuits = html(await draw({ preset: 'circuits' }, { source: 'tracks' } as Partial<Region>));
    expect(circuits).toMatch(/<li>Autodromo Nazionale Monza · IT<\/li>/);
    expect(circuits).not.toContain('<a ');
    expect(await draw({ preset: 'circuits', latitude: 'nope' }, { source: 'tracks' } as Partial<Region>)).toBeNull();
    guides([GUIDES[2]]);
    const none = html(await draw({}));
    expect(none).toContain('No places yet.');
    expect(none).not.toContain('data-map-background');
    guides();
    const second = html((await renderComponents(doc([region('h', 'page.heading'), region('g', 'data.map', { preset: 'circuit-guides' }, { source: 'guides', seq: 20 } as Partial<Region>)]), { path: '/x' })).g);
    expect(second).not.toContain('<h1');
    expect(second).toContain('>Circuit guides<');
  });
});

describe('the table’s controls and the reader’s state (P2.3 PR A)', () => {
  const NOON = new Date('2026-09-22T12:00:00.000Z');
  const DRIVERS = { preset: 'drivers', view: 'table', rows: 10, heading: '' };
  const ON = { ...DRIVERS, sortable: true, actions: true };
  const F1 = { source: 'standings?series=f1&season=2026' } as Partial<Region>;
  const page = { path: '/history/monza', name: 'Monza', title: null };
  const draw = async (settings: Record<string, string | number | boolean>, where: { href?: string; view?: string }, regions?: Region[]) => {
    const out = await renderComponents(doc(regions ?? [region('t', 'data.region', settings, F1)]), { path: '/history/monza', page, now: NOON, ...where });
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, html(v)]));
  };

  it('draws exactly today’s markup while the toggles are off, whether or not a state can arrive, and while they are on where no state can arrive (a framed code route)', async () => {
    const plain = (await draw(DRIVERS, {})).t;
    expect(plain).toContain('<table');
    expect((await draw(DRIVERS, { href: '/history/monza', view: '' })).t).toBe(plain);
    expect((await draw(DRIVERS, { href: '/history/monza', view: 'sort=name' })).t).toBe(plain);
    expect((await draw(ON, {})).t).toBe(plain);
    expect(plain).not.toContain('Actions');
    expect(plain).not.toContain('nofollow');
  });

  it('with the toggles on and a state arriving: the rows sorted, the sorted heading marked and every sortable heading a link that toggles ascending → descending → none, the percent column plain; the Actions menu with Select Columns as a GET form carrying the rest of the state, and Reset to the plain path', async () => {
    const t = (await draw(ON, { href: '/history/monza', view: 'sort=points' })).t;
    expect(t.indexOf('George Russell')).toBeLessThan(t.indexOf('Andrea Kimi Antonelli'));
    expect(t).toMatch(/<th scope="col" aria-sort="ascending" class="[^"]*"><a href="\/history\/monza\?sort=-points" rel="nofollow"[^>]*>Pts/);
    expect(t).toMatch(/<a href="\/history\/monza\?sort=name" rel="nofollow"[^>]*>Driver/);
    expect(t).not.toMatch(/sort=-?share/);
    expect(t).toContain('<span class="sr-only">Share</span>');
    expect(t).toMatch(/<details[^>]*><summary[^>]*>Actions<\/summary>/);
    expect(t).toMatch(/<form [^>]*action="\/history\/monza"[^>]*>/);
    expect(t).toMatch(/<form [^>]*method="get"[^>]*>/);
    expect(t).toContain('<input type="hidden" name="sort" value="points"/>');
    expect(t).toMatch(/<input type="checkbox"[^>]*name="cols" checked="" value="name"\/>/);
    expect(t).toMatch(/<input type="checkbox"[^>]*name="cols" checked="" value="team"\/>/);
    expect(t).toContain('>Select Columns<');
    expect(t).toMatch(/<button type="submit"[^>]*>Apply<\/button>/);
    expect(t).toMatch(/<a href="\/history\/monza"[^>]*>Reset<\/a>/);
    // Descending toggles to none: the plain path.
    const d = (await draw(ON, { href: '/history/monza', view: 'sort=-points' })).t;
    expect(d.indexOf('Andrea Kimi Antonelli')).toBeLessThan(d.indexOf('George Russell'));
    expect(d).toMatch(/<th scope="col" aria-sort="descending" class="[^"]*"><a href="\/history\/monza" rel="nofollow"/);
  });

  it('cols draws the reader’s columns alone, as an allow-list, the boxes ticked to match; a state the shape cannot honour is dropped silently', async () => {
    const t = (await draw(ON, { href: '/history/monza', view: 'cols=name,points&sort=nope&filter=team.gt:M' })).t;
    expect((t.match(/<th /g) ?? []).length).toBe(2);
    expect(t).toMatch(/<th [^>]*>(<a [^>]*>)?Driver/);
    expect(t).toMatch(/<th [^>]*>(<a [^>]*>)?Pts/);
    expect(t).not.toMatch(/<th [^>]*>(<a [^>]*>)?Team/);
    expect(t).toMatch(/<input type="checkbox"[^>]*name="cols" checked="" value="points"\/>/);
    expect(t).toMatch(/<input type="checkbox"[^>]*name="cols" value="team"\/>/);
    expect(t).not.toContain('aria-sort');
    // The sort links keep the reader's columns.
    expect(t).toContain('href="/history/monza?sort=points&amp;cols=name%2Cpoints"');
  });

  it('two regions with controls read their own keys under r.<id>.; a template view and the List ignore the state and draw no controls; the Cards draw Sort by links in the Actions menu', async () => {
    const two = [region('a', 'data.region', ON, F1), region('b', 'data.region', ON, { ...F1, seq: 20 })];
    const out = await draw(ON, { href: '/history/monza', view: 'r.a.sort=points' }, two);
    expect(out.a).toContain('href="/history/monza?r.a.sort=-points"');
    expect(out.a.indexOf('George Russell')).toBeLessThan(out.a.indexOf('Andrea Kimi Antonelli'));
    // A link of one region carries the other's state along: sorting b never resets a.
    expect(out.b).toContain('href="/history/monza?r.a.sort=points&amp;r.b.sort=points"');
    expect(out.b.indexOf('Andrea Kimi Antonelli')).toBeLessThan(out.b.indexOf('George Russell'));
    expect(out.b).toContain('<input type="hidden" name="r.a.sort" value="points"/>');
    const list = (await draw({ ...ON, view: 'list' }, { href: '/history/monza', view: 'sort=points' })).t;
    expect(list).not.toContain('Actions');
    expect(list).not.toContain('nofollow');
    const cards = (await draw({ ...ON, view: 'cards' }, { href: '/history/monza', view: 'sort=points' })).t;
    expect(cards).toMatch(/<details[^>]*><summary[^>]*>Actions<\/summary>/);
    expect(cards).toContain('>Sort by<');
    expect(cards).toContain('<a href="/history/monza?sort=-points" rel="nofollow"');
    expect(cards).toContain('<a href="/history/monza?sort=name" rel="nofollow"');
    expect(cards).not.toContain('Select Columns');
    expect(cards.indexOf('George Russell')).toBeLessThan(cards.indexOf('Andrea Kimi Antonelli'));
  });
});

describe('the saved views and the download (P2.3 PR B)', () => {
  const NOON = new Date('2026-09-22T12:00:00.000Z');
  const ON = { preset: 'drivers', view: 'table', rows: 10, heading: '', sortable: true, actions: true, views: true, download: true };
  const F1 = { source: 'standings?series=f1&season=2026' } as Partial<Region>;
  const page = { id: 'p1', path: '/history/monza', name: 'Monza', title: null };
  const TOP = { key: 'top-five', pageId: 'p1', regionId: 't', name: 'Top five', definition: { sort: { column: 'points', desc: true }, cols: ['name', 'points'], filters: [] }, seq: 10 };
  const loadViewsFor = vi.spyOn(savedViews, 'loadViewsFor').mockResolvedValue([TOP]);
  const draw = async (settings: Record<string, string | number | boolean>, view: string) =>
    html((await renderComponents(doc([region('t', 'data.region', settings, F1)]), { path: '/history/monza', page, now: NOON, href: '/history/monza', view })).t);

  it('?view=<key> draws the Alternative’s definition under the address’s own parameters, lists the views with the current one marked and links the CSV route with the state as shown; an unknown key is the Primary; nothing is read while the menu is off and no key arrives', async () => {
    const t = await draw(ON, 'view=top-five');
    expect(loadViewsFor).toHaveBeenCalledWith('p1', 't');
    expect((t.match(/<th /g) ?? []).length).toBe(2);
    expect(t.indexOf('Andrea Kimi Antonelli')).toBeLessThan(t.indexOf('George Russell'));
    expect(t).toMatch(/<details><summary[^>]*>Views<\/summary>/);
    expect(t).toMatch(/<a href="\/history\/monza" rel="nofollow" class="[^"]*">Primary<\/a>/);
    expect(t).toMatch(/<a href="\/history\/monza\?view=top-five" rel="nofollow" class="[^"]*" aria-current="true">Top five ●<\/a>/);
    expect(t).toContain('href="/api/data/csv?page=%2Fhistory%2Fmonza&amp;region=t&amp;sort=-points&amp;cols=name%2Cpoints"');
    expect(t).toMatch(/>Download CSV<\/a>/);
    // The address's own sort wins over the view's; its columns stay.
    const over = await draw(ON, 'view=top-five&sort=-name');
    expect(over.indexOf('George Russell')).toBeLessThan(over.indexOf('Andrea Kimi Antonelli'));
    expect((over.match(/<th /g) ?? []).length).toBe(2);
    // An unknown key is the Primary: every column, the designed order, Primary marked.
    const primary = await draw(ON, 'view=nope');
    expect((primary.match(/<th /g) ?? []).length).toBeGreaterThan(2);
    expect(primary).toMatch(/href="\/history\/monza" rel="nofollow" class="[^"]*" aria-current="true">Primary/);
    expect(primary).not.toContain('aria-current="true">Top five');
    loadViewsFor.mockClear();
    const off = await draw({ ...ON, views: false, download: false }, 'sort=points');
    expect(loadViewsFor).not.toHaveBeenCalled();
    expect(off).not.toContain('Views</summary>');
    expect(off).not.toContain('Download CSV');
    // Saved views alone, or Download CSV alone, are controls of their own: the Views menu draws without Actions; the download
    // stands where the Actions menu would (the reviewer's finding on PR B).
    const viewsOnly = await draw({ ...ON, sortable: false, actions: false, download: false }, 'view=top-five');
    expect(viewsOnly).toMatch(/<details><summary[^>]*>Views<\/summary>/);
    expect(viewsOnly).not.toContain('Actions</summary>');
    expect(viewsOnly).not.toContain('nofollow" class="underline-offset-4 hover:text-tint hover:underline">Pts');
    expect(viewsOnly.indexOf('Andrea Kimi Antonelli')).toBeLessThan(viewsOnly.indexOf('George Russell'));
    const downloadOnly = await draw({ ...ON, sortable: false, actions: false, views: false }, 'sort=points');
    expect(downloadOnly).not.toContain('Actions</summary>');
    expect(downloadOnly).toMatch(/<a href="\/api\/data\/csv\?page=%2Fhistory%2Fmonza&amp;region=t&amp;sort=points" rel="nofollow"[^>]*>Download CSV<\/a>/);
  });
});

describe('the highlight rules and the followed-series tint (P2.4 PR A)', () => {
  const NOON = new Date('2026-09-22T12:00:00.000Z');
  const F1 = { source: 'standings?series=f1&season=2026' } as Partial<Region>;
  const page = { id: 'p1', path: '/history/monza', name: 'Monza', title: null };
  const draw = async (settings: Record<string, string | number | boolean>, over: Partial<Region> = F1) => html((await renderComponents(doc([region('t', 'data.region', settings, over)]), { path: '/history/monza', page, now: NOON })).t);

  it('styles a row by the first rule it meets — the Table’s row, the Cards’ card, the List’s row — and draws today’s markup byte for byte when no rule is set; a rule the shape cannot read is ignored', async () => {
    const base = { preset: 'drivers', view: 'table', rows: 10, heading: '' };
    const plain = await draw(base);
    expect(plain).toMatch(/<tbody[^>]*><tr><td/);
    expect(plain).not.toMatch(/<tr class="(text-brand|bg-surface-elevated|text-text-faint)/);
    expect(await draw({ ...base, highlight1: '', highlight1Style: 'brand', highlight2: '', highlight2Style: 'brand', highlight3: '', highlight3Style: 'brand', highlightFollowed: false })).toBe(plain);
    const styled = await draw({ ...base, highlight1: 'position.eq:1', highlight2: 'position.lte:3', highlight2Style: 'emphasis', highlight3: 'nope' });
    expect(styled).toMatch(/<tr class="text-brand font-bold"><td[^>]*>1<\/td>/);
    expect(styled).toMatch(/<tr class="bg-surface-elevated font-semibold"><td[^>]*>2<\/td>/);
    expect((styled.match(/<tr class="(text-brand|bg-surface-elevated|text-text-faint)/g) ?? []).length).toBe(2);
    const muted = await draw({ ...base, highlight1: 'team.eq:mercedes', highlight1Style: 'muted' });
    expect((muted.match(/<tr class="text-text-faint">/g) ?? []).length).toBe(2);
    const cards = await draw({ ...base, view: 'cards', highlight1: 'position.eq:1' });
    expect(cards).toContain('<li class="border border-border bg-surface/40 p-4 text-brand font-bold">');
    expect(cards).toContain('<li class="border border-border bg-surface/40 p-4">');
    expect(await draw({ ...base, view: 'cards' })).not.toContain('text-brand font-bold">\n');
    const list = await draw({ ...base, view: 'list', highlight1: 'position.eq:1' });
    expect(list).toContain('<li class="flex items-baseline gap-3 py-2 text-brand font-bold">');
    expect(list).toContain('<li class="flex items-baseline gap-3 py-2">');
    // A template ignores the rules.
    const leader = await draw({ preset: 'what-it-changed', view: 'leader', rows: 5, heading: '', highlight1: 'position.eq:1' }, { source: 'standings?series=latest&season=2026' } as Partial<Region>);
    expect(leader).not.toContain('text-brand font-bold"><td');
  });

  it('with Followed series on, every row carries its series slug for the tint the browser adds; nothing is marked without the toggle', async () => {
    const weekendRow = (i: number, series: string) => ({ series, seriesName: series === 'f1' ? 'Formula 1' : 'FIA WEC', colour: '#e10600', round: 16 + i, title: `Round ${i}`, start: `2030-0${i}-05T09:30:00.000Z`, end: `2030-0${i}-07T14:00:00.000Z`, dates: `${i}–${i + 2} Mar`, weekend: `/series/${series}/weekend/${16 + i}` });
    const rows = [weekendRow(1, 'f1'), weekendRow(2, 'wec')];
    const provenance = { ref: { source: 'weekends', params: {} }, label: 'Weekends', tier: 'live' as const, keys: [], rows: 2, ms: 1 };
    readSource.mockResolvedValueOnce({ columns: [], total: 2, rows, provenance });
    const on = await draw({ preset: 'whats-next', view: 'table', rows: 10, heading: '', highlightFollowed: true }, { source: 'weekends?count=10' } as Partial<Region>);
    expect(on).toContain('<tr data-series="f1">');
    expect(on).toContain('<tr data-series="wec">');
    readSource.mockResolvedValueOnce({ columns: [], total: 2, rows, provenance });
    const off = await draw({ preset: 'whats-next', view: 'table', rows: 10, heading: '' }, { source: 'weekends?count=10' } as Partial<Region>);
    expect(off).not.toContain('data-series');
  });

  it('P2.4 PR B: a driver’s name links to the page its row carries, in the name’s own cell, and stays text without one; the Cards’ zone follows it', async () => {
    const rows = [
      { kind: 'driver', position: 1, name: 'Andrea Kimi Antonelli', code: 'ANT', team: 'Mercedes', points: 267, wins: 7, class: null, profile: '/drivers/kimi-antonelli' },
      { kind: 'driver', position: 2, name: 'George Russell', code: 'RUS', team: 'Mercedes', points: 201, wins: 2, class: null, profile: null },
    ];
    const provenance = { ref: { source: 'standings', params: { series: 'f1', season: 2026 } }, label: 'Standings · Formula 1 · 2026', tier: 'rows' as const, keys: [], rows: 2, ms: 1 };
    const NAME_CELL = '<td class="py-2 pr-3 align-baseline font-condensed text-15 font-semibold text-text">';
    readSource.mockResolvedValueOnce({ columns: [], total: 2, rows, provenance });
    const table = await draw({ preset: 'drivers', view: 'table', rows: 10, heading: '' });
    expect(table).toMatch(new RegExp(`${NAME_CELL}<a href="/drivers/kimi-antonelli"[^>]*>Andrea Kimi Antonelli</a></td>`));
    expect(table).toContain(`${NAME_CELL}George Russell</td>`);
    readSource.mockResolvedValueOnce({ columns: [], total: 2, rows, provenance });
    const cards = await draw({ preset: 'drivers', view: 'cards', rows: 10, heading: '', actionFullCard: 'row:name' });
    expect((cards.match(/href="\/drivers\/kimi-antonelli"/g) ?? []).length).toBe(1);
    expect(cards).not.toContain('href="/drivers/george');
  });
});

// The followed-series tint's client component reads the reader's followed series through Clerk's hook; the render tests stand
// outside a ClerkProvider, so the hook answers nothing here (the component's own test drives it).
vi.mock('@/lib/useFollowedSeries', () => ({ useFollowedSeries: () => ({ followed: null, hydrated: false, setFollowed: () => {}, clearFollowed: () => {} }) }));

describe('the Filters region (P2.5; APEX: Smart Filters)', () => {
  const DRIVERS = { preset: 'drivers', view: 'table', rows: 10, heading: '' };
  const F1 = { source: 'standings?series=f1&season=2026' } as Partial<Region>;
  const FILTERS = { filteredRegion: 'd', facet1: 'team', facet2: 'name', facet2DependsOn: 'facet1' };
  const pair = () => doc([region('f', 'data.filters', FILTERS, { seq: 5 }), region('d', 'data.region', DRIVERS, F1)]);
  it('draws the facets of its Data region from that region’s rows, one read shared by both; a dependent facet waits for its parent; nothing where no state can arrive', async () => {
    readSource.mockClear();
    const out = await renderComponents(pair(), { path: '/x', view: '' });
    const chips = html(out.f);
    expect(readSource).toHaveBeenCalledTimes(1);
    expect(chips).toContain('Team');
    expect(chips).toContain('Mercedes');
    expect(chips).toContain('team.in%3AMercedes');
    // The Driver facet waits for a Team.
    expect(chips).toContain('Pick Team first');
    expect(chips).not.toContain('Antonelli');
    // With a team picked, the Driver facet opens over the narrowed rows, and the table itself narrows to them.
    const picked = await renderComponents(pair(), { path: '/x', view: 'filter=team.in:Mercedes' });
    expect(html(picked.f)).toContain('Antonelli');
    expect(html(picked.f)).toContain('Russell');
    expect(html(picked.d)).toContain('Antonelli');
    // Nowhere a state can arrive (a framed code route), the Filters region draws nothing and the table is as it was.
    const none = await renderComponents(pair(), { path: '/x' });
    expect(none.f).toBeNull();
    const alone = await renderComponents(doc([region('d', 'data.region', DRIVERS, F1)]), { path: '/x' });
    expect(html(none.d)).toBe(html(alone.d));
  });
});

describe('the Filters region over the calendar (P2.5 PR B)', () => {
  const FILTERS = { filteredRegion: 'month', facet1: 'seriesName', facet2: 'sessionType' };
  const page = () => doc([region('f', 'data.filters', FILTERS, { seq: 5 }), region('month', 'calendar.month', {}, { seq: 10 })]);
  it('facets on the series’ names and the sessions’ kinds from the calendar’s own model, and hands the picks to the calendar; nothing changes without a state', async () => {
    const out = await renderComponents(page(), { path: '/calendar', view: '' });
    const chips = html(out.f);
    expect(chips).toContain('Formula 1');
    expect(chips).toContain('MotoGP');
    expect(chips).toContain('practice');
    expect(chips).toContain('seriesName.in%3AFormula+1');
    expect(html(out.month)).toContain('data-series=""');
    const picked = await renderComponents(page(), { path: '/calendar', view: 'filter=seriesName.in:Formula 1&filter=sessionType.in:race' });
    expect(html(picked.month)).toContain('data-series="Formula 1"');
    expect(html(picked.month)).toContain('data-kinds="race"');
    expect(html(picked.f)).toContain('aria-current="true"');
    const none = await renderComponents(page(), { path: '/calendar' });
    expect(none.f).toBeNull();
    const alone = await renderComponents(doc([region('month', 'calendar.month', {}, { seq: 10 })]), { path: '/calendar' });
    expect(html(none.month)).toBe(html(alone.month));
  });
});

// R18: the champions page's two templates over the Champions source, and the List view's foot for the rows it cuts.
describe('the champions page’s views (R18)', () => {
  const NOON = new Date('2026-10-01T12:00:00Z');
  const season = (over: Record<string, string | number | boolean | null> = {}) => ({
    kind: 'season', year: 2025, driver: 'Leonardo Fornaroli', profile: '/drivers/leonardo-fornaroli', nationality: 'ITA', team: 'Invicta Racing', teamPage: '/teams/invicta-racing', points: 211, wins: 4, podiums: 9, margin: 36, runnerUp: 'Jak Crawford', runnerUpTeam: null, runnerUpPoints: 175, teamsChampion: 'Invicta Racing', teamsChampionPage: '/teams/invicta-racing', teamsTitles: 2, teamsRun: 2, driverTitles: 1, era: 'FIA Formula 2 Championship', decade: '2020s', rookie: true, name: null, titles: null, page: null, seriesName: 'Formula 2', colour: '#38bdf8', ...over,
  });
  const SEASONS = [
    season(),
    season({ year: 2024, driver: 'Gabriel Bortoleto', profile: null, nationality: 'BRA', podiums: null, margin: 22.5, runnerUp: 'Isack Hadjar', runnerUpPoints: 192, teamsTitles: 1, teamsRun: 1 }),
    season({ year: 2017, driver: 'Charles Leclerc', profile: null, nationality: 'MON', team: 'Prema Racing', teamPage: null, points: 282, wins: 7, podiums: 10, margin: 72, runnerUp: 'Artem Markelov', runnerUpPoints: 210, teamsChampion: 'Russian Time', teamsChampionPage: null, teamsTitles: 2, teamsRun: 1, decade: '2010s', rookie: true }),
    season({ year: 2016, driver: 'Pierre Gasly', profile: null, nationality: 'FRA', team: 'Prema Racing', teamPage: null, points: 219, wins: 4, podiums: 9, margin: 8, runnerUp: 'Antonio Giovinazzi', runnerUpPoints: 211, teamsChampion: 'Prema Racing', teamsChampionPage: null, teamsTitles: 1, teamsRun: 1, era: 'GP2 Series', decade: '2010s', rookie: false }),
  ];
  const tally = (name: string, titles: number) => ({ kind: 'driver-titles', year: null, driver: null, profile: null, nationality: null, team: null, teamPage: null, points: null, wins: null, podiums: null, margin: null, runnerUp: null, runnerUpTeam: null, runnerUpPoints: null, teamsChampion: null, teamsChampionPage: null, teamsTitles: null, teamsRun: null, driverTitles: null, era: null, decade: null, rookie: null, name, titles, page: null, seriesName: 'Formula 2', colour: '#38bdf8' });
  const draw = async (rows: Record<string, string | number | boolean | null>[], settings: Record<string, string | number | boolean>, id = 't') => {
    readSource.mockResolvedValueOnce({ columns: [], total: rows.length, rows, provenance: { ref: { source: 'champions', params: { series: 'f2' } }, label: 'Champions · Formula 2', tier: 'content', keys: [], rows: rows.length, ms: 1 } });
    const out = await renderComponents(doc([region('h', 'page.heading', { text: 'Formula 2 champions' }), region(id, 'data.region', settings, { source: 'champions?series=f2', seq: 20 } as Partial<Region>)]), { path: '/series/f2/champions', page: { path: '/series/f2/champions', name: 'Champions', title: null }, now: NOON });
    return html(out[id]);
  };

  it('the Reigning champion template: the newest season as a card: the badge and the season, the name linked to the profile, the country from the code, the team linked, the rookie note, the four tiles (points, wins, podiums, the margin over the runner-up), the teams’ champion with its run, the actions; a tile without a value and the profile action without a page are left out, and a first teams’ title has no run', async () => {
    const card = await draw(SEASONS, { preset: 'champions', view: 'reigning', rows: 1, heading: 'Reigning champion' });
    expect(card).toContain('aria-label="Reigning champion"');
    expect(card).toContain('>Reigning champion<');
    expect(card).toContain('>2025 season<');
    expect(card).toMatch(/<h2 class="[^"]*font-serif[^"]*"><a href="\/drivers\/leonardo-fornaroli"[^>]*>Leonardo Fornaroli<\/a><\/h2>/);
    expect(card).toContain('>Italy<');
    expect(card).toMatch(/<a href="\/teams\/invicta-racing"[^>]*>Invicta Racing<\/a>/);
    expect(card).toContain('>Rookie season<');
    // The tiles: a term then its value (dt before dd, the value drawn on top), the strip sized to the tiles it holds.
    expect(card).toContain('style="--tiles:4"');
    for (const [value, label] of [['211', 'Points'], ['4', 'Wins'], ['9', 'Podiums'], ['+36', 'Over Jak Crawford']]) expect(card, label).toMatch(new RegExp(`<dt[^>]*>${label}<\\/dt><dd[^>]*>${value.replace('+', '\\+')}<\\/dd>`));
    expect(card).toContain('Teams’ champion: ');
    expect(card).toContain(', a second title in a row.');
    expect(card).toMatch(/<a href="\/drivers\/leonardo-fornaroli"[^>]*>Driver profile<\/a>/);
    expect(card).toMatch(new RegExp(`<a href="\\/series\\/f2\\/standings"[^>]*>${CURRENT_SEASON} title race →<\\/a>`));
    expect(card).not.toContain('<table');
    // The second season alone: no profile, no podiums, a first teams' title, a champion still a rookie.
    const second = await draw([SEASONS[1]], { preset: 'champions', view: 'reigning', rows: 1, heading: 'Reigning champion' });
    expect(second).toContain('>2024 season<');
    expect(second).toContain('>Gabriel Bortoleto<');
    expect(second).not.toContain('Podiums');
    expect(second).toContain('style="--tiles:3"');
    expect(second).not.toContain('Driver profile');
    expect(second).toContain('>Brazil<');
    expect(second).toContain('>Rookie season<');
    expect(second).toContain('Teams’ champion: ');
    expect(second).not.toContain('in a row');
    expect(second).toContain('>+22.5<');
    // Nothing without rows.
    expect(await draw([], { preset: 'champions', view: 'reigning', rows: 1, heading: 'Reigning champion' })).toBe('');
  });

  it('the Roll of honour template: the seasons by decade, newest first, each decade a section with its count; the sticky Jump-to bar with the decades, the older era and the count of seasons; the table’s seven columns and the cards’ stat line; the era row where the era changes; the nationality code, the runner-up’s points, the teams’ champion’s title number', async () => {
    const roll = await draw(SEASONS, { preset: 'champions', view: 'honours', rows: 150, heading: 'Every season' }, 'honours');
    expect(roll).toContain('aria-label="Every season"');
    expect(roll).toMatch(/<nav aria-label="Jump to" class="sticky top-14 /);
    expect(roll).toMatch(/>Jump to</);
    expect(roll).toMatch(/<a href="#honours-2020s"[^>]*>2020s<\/a>/);
    expect(roll).toMatch(/<a href="#honours-2010s"[^>]*>2010s<\/a>/);
    expect(roll).toMatch(/<a href="#honours-era"[^>]*>GP2 era<\/a>/);
    expect(roll).toContain('>4 seasons<');
    expect(roll).toMatch(/id="honours-2020s"[\s\S]*>2020s<[\s\S]*>2 seasons</);
    expect(roll).toMatch(/id="honours-2010s"[\s\S]*>2010s<[\s\S]*>2 seasons</);
    for (const label of ['Year', 'Champion', 'Pts', 'Wins', 'Margin', 'Runner-up', 'Teams’ champion']) expect(roll, label).toContain(`>${label}<`);
    // The table from lg, the cards below it (the review of the 1st: at md the names were cut).
    expect(roll).toContain(' lg:grid lg:grid-cols-[');
    expect(roll).toContain(' lg:hidden"');
    expect(roll).not.toContain('md:grid');
    expect(roll).not.toContain('md:hidden');
    expect(roll).toContain('>2025<');
    expect(roll).toMatch(/<a href="\/drivers\/leonardo-fornaroli"[^>]*>Leonardo Fornaroli<\/a>/);
    expect(roll).toContain('>ITA<');
    expect(roll).toContain('>175 pts<');
    expect(roll).toContain('>2nd title<');
    expect(roll).toContain('>1st title<');
    // The era row sits between 2017 and 2016, with the older era below it.
    expect(roll).toMatch(/>2017<[\s\S]*id="honours-era"[\s\S]*>Era change<[\s\S]*>2017: GP2 Series becomes the FIA Formula 2 Championship<[\s\S]*>Seasons below raced as GP2 Series<[\s\S]*>2016</);
    expect(roll).toMatch(/id="honours-era" class="[^"]*scroll-mt-28/);
    // The cards below lg follow the operator's drawing of the 2nd: a band with the season, the points and the wins; the two
    // champions side by side with their labels; the runner-up's row with their points and the margin; every cell ruled.
    // Each card its own rounded box with space between (the operator's second look); the ruled strip is the table's from lg.
    expect(roll).toContain('class="grid gap-3 lg:gap-px lg:overflow-hidden lg:rounded-lg lg:border lg:border-border lg:bg-border"');
    const cards = roll.split('class="rounded-lg border border-border bg-surface lg:hidden"').slice(1);
    expect(cards).toHaveLength(4);
    const [first, second] = cards;
    // The season in red bold capitals, the points figure in red.
    expect(first).toMatch(/<div class="[^"]*uppercase[^"]*text-brand[^"]*">2025 season<\/div>/);
    expect(first).toMatch(/>PTS<\/span><span class="[^"]*text-brand[^"]*">211<\/span>/);
    expect(first).toMatch(/>WINS<\/span><span[^>]*>4<\/span>/);
    expect(first).toContain('>Drivers’ champion<');
    expect(first).toMatch(/<a href="\/drivers\/leonardo-fornaroli"[^>]*>Leonardo Fornaroli<\/a>/);
    expect(first).toContain('>ITA<');
    expect(first).toMatch(/<a href="\/teams\/invicta-racing"[^>]*>Invicta Racing<\/a>/);
    expect(first).toContain('>Rookie season<');
    expect(first).toContain('>Teams’ champion<');
    expect(first).toContain('>2nd title<');
    expect(first).toMatch(/>Runner-up<\/div><div[^>]*>Jak Crawford<\/div>/);
    expect(first).toMatch(/>Points<\/div><div[^>]*>175<\/div>/);
    expect(first).toMatch(/>Margin<\/div><div[^>]*>−36<\/div>/);
    // The second season: no profile (a span), a first teams' title, a half-point margin.
    expect(second).toContain('>2024 season<');
    expect(second).toMatch(/>PTS<\/span><span[^>]*>211<\/span>/);
    expect(second).toMatch(/<span class="[^"]*font-serif[^"]*">Gabriel Bortoleto<\/span>/);
    expect(second).toContain('>1st title<');
    expect(second).toMatch(/>Runner-up<\/div><div[^>]*>Isack Hadjar<\/div>/);
    expect(second).toMatch(/>Margin<\/div><div[^>]*>−22.5<\/div>/);
    // Three of the four champions were rookies.
    expect(roll.match(/>Rookie season</g)).toHaveLength(3);
    // A season without a runner-up on record draws no runner-up row; the band and the champions stay.
    const bare = await draw([season({ runnerUp: null, runnerUpPoints: null, margin: null })], { preset: 'champions', view: 'honours', rows: 150, heading: 'Every season' }, 'honours');
    const bareCard = bare.split('class="rounded-lg border border-border bg-surface lg:hidden"')[1];
    expect(bareCard).not.toContain('>Runner-up<');
    expect(bareCard).toMatch(/>PTS<\/span><span[^>]*>211<\/span>/);
    expect(bareCard).toContain('>Teams’ champion<');
    expect(roll).not.toContain('<table');
    // A stored honours view over another source's shape draws the Table (the parser refuses it; the renderer stands).
    readSource.mockResolvedValueOnce({ columns: [], total: 1, rows: [{ kind: 'driver', position: 1, name: 'A', code: 'A', team: 'T', points: 1, wins: 0, class: null }], provenance: { ref: { source: 'standings', params: { series: 'f1', season: 2026 } }, label: 'Standings', tier: 'rows', keys: [], rows: 1, ms: 1 } });
    const table = html((await renderComponents(doc([region('t', 'data.region', { preset: 'drivers', view: 'honours', rows: 10, heading: '' }, { source: 'standings?series=f1&season=2026' } as Partial<Region>)]), { path: '/x', now: NOON })).t);
    expect(table).toContain('<table');
  });

  it('the List view’s foot: the rows the count cut, as “+ n more”, the tallies naming the teams and whether each has one title', async () => {
    const seven = [tally('ART Grand Prix', 7), tally('Prema Racing', 4), tally('DAMS', 3), tally('Invicta Racing', 2), tally('Racing Engineering', 2), tally('MP Motorsport', 1), tally('Rapax', 1)];
    const list = await draw(seven, { preset: 'drivers-titles-by-team', view: 'list', rows: 5, heading: "Drivers' titles" });
    expect(list).toContain('>ART Grand Prix<');
    expect(list).not.toContain('MP Motorsport');
    expect(list).toContain('>+ 2 more teams with one title each<');
    const mixed = await draw([...seven.slice(0, 4), tally('Racing Engineering', 2), tally('MP Motorsport', 2), tally('Rapax', 1)], { preset: 'drivers-titles-by-team', view: 'list', rows: 5, heading: '' });
    expect(mixed).toContain('>+ 2 more teams<');
    const whole = await draw(seven.slice(0, 3), { preset: 'drivers-titles-by-team', view: 'list', rows: 5, heading: '' });
    expect(whole).not.toContain('more');
  });
});
