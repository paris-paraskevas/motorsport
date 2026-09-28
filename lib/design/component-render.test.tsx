// @vitest-environment jsdom
//
// The components' server half: the Data region draws its preset over its
// Source, the Live band the weekends under way from the live model, the first
// page-level component in the Body carries the h1 (never a sub region, P1.4),
// an unknown key or one of Home's six retired keys draws nothing (P2.24 C: the
// parser upgrades those before a render), a renderer that throws draws nothing
// for its own region only, and the race-weekend fact follows the live band.

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { PageDocument, Region } from './page-document';
import * as homeModel from '@/lib/home-model';
import * as sourceRead from './source-read';
import * as savedViews from './views';

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
      { session: { uid: 'a', seriesSlug: 'f1', title: 'F1 - Race', start: new Date('2026-09-13T13:00:00Z'), end: new Date('2026-09-13T15:00:00Z') }, color: '#e10600', seriesSlug: 'f1', seriesName: 'Formula 1' },
      { session: { uid: 'b', seriesSlug: 'motogp', title: 'MotoGP - Practice 1', start: new Date('2026-09-11T08:00:00Z'), end: new Date('2026-09-11T09:00:00Z') }, color: '#0af', seriesSlug: 'motogp', seriesName: 'MotoGP' },
    ],
    roundByKey: { 'f1:14': 14 },
    roundNames: { 'f1:14': 'Spanish Grand Prix (Madrid)' },
    serverNow: '2026-09-09T12:00:00.000Z',
  }),
}));
vi.mock('@/components/calendar/CalendarView', () => ({
  CalendarView: (props: { items: unknown[]; serverNow: string; roundNames?: Record<string, string>; seriesNames?: string[] | null; sessionKinds?: string[] | null }) => (
    <div data-calendar={props.serverNow} data-series={(props.seriesNames ?? []).join('|')} data-kinds={(props.sessionKinds ?? []).join('|')}>
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
    expect(lead).toMatch(/<a href="\/blog\/monza-2026" aria-hidden="true" tabindex="-1"[^>]*><img src="https:\/\/img\.example\/monza\.jpg" alt="Monza, a history" width="1200" height="750" fetchpriority="high"/i);
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
    expect(lead).toMatch(/<a href="\/blog\/third"[^>]*><img src="https:\/\/img\.example\/third\.jpg" alt="Third story" width="1200" height="630"/);
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
    expect(table).toMatch(/<td[^>]*><img src="https:\/\/img\.example\/monza\.jpg" alt="Monza, a history"/);
    // R13: a card's media names the card (its link names itself already, so a reader hears nothing twice).
    const covers = await drawOver('posts?count=10', POSTS.slice(0, 1), { preset: 'lead-story', view: 'cards', rows: 5, heading: '', cardMedia: 'hero' });
    expect(covers).toMatch(/<img src="https:\/\/img\.example\/monza\.jpg" alt="Monza, a history" width="1200" height="750" class="h-9 w-9 object-cover"/);
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
    const titled = await renderComponents(doc([region('heading', 'page.heading')]), { path: '/calendar', page: { ...page, title: 'Race calendar 2026' } });
    expect(html(titled.heading)).toContain('>Race calendar 2026<');
    const own = await renderComponents(doc([region('heading', 'page.heading', { text: 'Every session' })]), { path: '/calendar', page });
    expect(html(own.heading)).toContain('>Every session<');
    expect(html(own.heading)).toMatch(/<h1 class="font-serif text-34[^"]*">Every session<\/h1>/);
    // R13 (the SEO check of 2026-09-27): a heading region that is not the first showing in the Body is an h2 of the same look;
    // Home's eight section headings drew eight h1s.
    const second = await renderComponents(doc([region('month', 'calendar.month', {}, { seq: 10 }), region('heading', 'page.heading', { text: 'Below the month' }, { seq: 20 })]), { path: '/calendar', params: {}, page });
    expect(html(second.heading)).toMatch(/<h2 class="font-serif text-34[^"]*">Below the month<\/h2>/);
    expect(html(second.heading)).not.toContain('<h1');
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
