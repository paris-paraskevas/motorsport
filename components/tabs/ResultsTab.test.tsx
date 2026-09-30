import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import type { RaceResult, Series } from '@/lib/types';
import { sessionSlug } from '@/lib/weekend';

// THE RESULTS TAB'S ROWS (X6 B). A results tab carried every round's full
// classification in the page, folded; now the latest round is open with its
// classification, every earlier round is one line (the race to its weekend
// page, the date, the winner, "Classification →" to the race session page,
// which shows every class), and a round without a race session page keeps its
// closed accordion. The fetchers are stand-ins over fixture seasons; the
// weekends come from the fixture series' sessions through groupByWeekend.

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: unknown; children: React.ReactNode; className?: string }) => (
    <a href={String(href)} className={className}>
      {children}
    </a>
  ),
}));
const f1 = vi.fn(async (): Promise<RaceResult[]> => []);
const f2 = vi.fn(async () => ({ feature: [] as RaceResult[], sprint: [] as RaceResult[] }));
const wec = vi.fn(async () => [] as unknown[]);
const gt = vi.fn(async () => [] as unknown[]);
const wrc = vi.fn(async (): Promise<RaceResult[]> => []);
const dtm = vi.fn(async (): Promise<RaceResult[]> => []);
const nls = vi.fn(async (): Promise<RaceResult[]> => []);
vi.mock('@/lib/results/f1', () => ({ fetchF1SeasonResults: () => f1() }));
vi.mock('@/lib/results/f2', () => ({ fetchF2SeasonResults: () => f2() }));
vi.mock('@/lib/results/f3', () => ({ fetchF3SeasonResults: async () => [] }));
vi.mock('@/lib/results/formula-e', () => ({ fetchFormulaESeasonResults: async () => [] }));
vi.mock('@/lib/results/gt-world', () => ({ fetchAllGtWorldSeasonRaces: () => gt() }));
vi.mock('@/lib/results/imsa', () => ({ fetchImsaSeasonResults: async () => [] }));
vi.mock('@/lib/results/wec', () => ({ fetchWecSeasonResults: () => wec(), WEC_RESULT_CLASSES: ['Hypercar', 'LMP2', 'LMGT3'] }));
vi.mock('@/lib/results/indycar', () => ({ fetchIndyCarSeasonResults: async () => [] }));
vi.mock('@/lib/results/motogp', () => ({ fetchMotoGPSeasonResults: async () => [] }));
vi.mock('@/lib/results/nascar-cup', () => ({ fetchNascarCupSeasonResults: async () => [] }));
vi.mock('@/lib/results/wsbk', () => ({ fetchWsbkSeasonResults: async () => [] }));
vi.mock('@/lib/results/wrc', () => ({ fetchWRCSeasonResults: () => wrc() }));
vi.mock('@/lib/results/dtm', () => ({ fetchDTMSeasonResults: () => dtm() }));
vi.mock('@/lib/results/nls', () => ({ fetchNlsSeasonResults: () => nls(), NLS_SOURCE_URL: 'https://vln.example' }));
vi.mock('@/lib/series-content', () => ({ loadCuratedDrivers: async () => [], loadResultsOverrides: async () => [] }));

import { ResultsTab, raceSessionFor } from './ResultsTab';

const at = (iso: string) => new Date(iso);
const session = (seriesSlug: string, title: string, start: string, hours = 2) => ({
  uid: `${seriesSlug}-${title}-${start}`,
  seriesSlug,
  title,
  start: at(start),
  end: new Date(at(start).getTime() + hours * 3600 * 1000),
});
const series = (slug: string, name: string, sessions: ReturnType<typeof session>[]): Series =>
  ({ meta: { slug, name, color: '#f00', icsUrl: '', season: 2026, category: 'single-seater' }, sessions, overview: '', drivers: '', significance: '', fetchedAt: new Date(), stale: false, configured: true }) as unknown as Series;
const entry = (position: number, driverName: string, points = 25 - position) => ({ position, driverName, driverCode: driverName.slice(0, 3).toUpperCase(), team: 'Team', time: '1:30:00', status: 'Finished', points });
const race = (round: number, raceName: string, date: string, drivers: string[]): RaceResult => ({ round, raceName, date: at(date), circuit: 'Circuit', results: drivers.map((d, i) => entry(i + 1, d)) });

const html = async (s: Series) => renderToStaticMarkup(await ResultsTab({ series: s }));
const detailsCount = (h: string) => (h.match(/<details/g) ?? []).length;
const openCount = (h: string) => (h.match(/<details[^>]*\bopen\b/g) ?? []).length;
const opens = (text: string) => new RegExp(`<details[^>]*\\bopen\\b[^>]*>[\\s\\S]*${text}`);

describe('the results tab’s rows', () => {
  const f1Series = series('f1', 'Formula 1', [
    session('f1', 'F1 - Qualifying', '2026-03-07T14:00:00Z', 1),
    session('f1', 'F1 - Race', '2026-03-08T14:00:00Z'),
    session('f1', 'F1 - Race', '2026-03-22T14:00:00Z'),
    session('f1', 'F1 - Race', '2026-04-05T14:00:00Z'),
  ]);

  it('opens the latest round with its classification, draws every earlier round as one line with the race session link, and keeps the accordion where no race session page exists', async () => {
    f1.mockResolvedValueOnce([
      race(1, 'Australian Grand Prix', '2026-03-08', ['Norris', 'Ocon', 'Gasly']),
      race(3, 'Japanese Grand Prix', '2026-04-05', ['Verstappen', 'Russell', 'Hadjar']),
      race(2, 'Chinese Grand Prix', '2026-03-22', ['Piastri', 'Stroll', 'Albon']),
      race(4, 'Bahrain Grand Prix', '2026-04-19', ['Leclerc', 'Sainz', 'Alonso']),
      race(5, 'Pre-season race', '2026-02-01', ['Bottas', 'Zhou']),
    ]);
    const h = await html(f1Series);
    // Round 4 is the latest (by date): open with its rows, page or no page. Round 5 has no weekend in the fixture's
    // sessions and is not the latest: its accordion stays, closed, its rows in the page. Rounds 1 to 3: one line each.
    expect(detailsCount(h)).toBe(2);
    expect(openCount(h)).toBe(1);
    expect(h).toMatch(opens('Bahrain Grand Prix'));
    expect(h).not.toMatch(opens('Pre-season race'));
    expect(h).toContain('Sainz');
    expect(h).toContain('Alonso');
    expect(h).toContain('Zhou');
    // The earlier rounds: no rows (their winners stay in the meta line), the weekend link and the classification link.
    expect(h).not.toContain('Ocon');
    expect(h).not.toContain('Stroll');
    expect(h).not.toContain('Hadjar');
    expect(h).toContain('href="/series/f1/weekend/1"');
    expect(h).toContain(`href="/series/f1/weekend/1/${sessionSlug('F1 - Race')}"`);
    expect(h).toContain(`href="/series/f1/weekend/2/${sessionSlug('F1 - Race')}"`);
    expect(h).toContain(`href="/series/f1/weekend/3/${sessionSlug('F1 - Race')}"`);
    expect((h.match(/Classification →/g) ?? []).length).toBe(3);
    expect(h).toContain('WIN</span> <span class="text-text-muted normal-case">Norris — Team');
  });

  it('decides the latest round by date first, then by round number', async () => {
    f1.mockResolvedValueOnce([
      race(2, 'Second by number, later by date', '2026-04-05', ['A', 'B']),
      race(3, 'Third by number, earlier by date', '2026-03-22', ['C', 'D']),
    ]);
    const h = await html(f1Series);
    expect(h).toMatch(opens('Second by number'));
    expect(h).not.toMatch(opens('Third by number'));
    f1.mockResolvedValueOnce([race(2, 'Round two', '2026-03-22', ['A']), race(3, 'Round three', '2026-03-22', ['C'])]);
    const same = await html(f1Series);
    expect(same).toMatch(opens('Round three'));
  });

  it('opens the latest race of each panel (F2’s feature and sprint) and links each earlier race to its own session', async () => {
    const f2Series = series('f2', 'Formula 2', [
      session('f2', 'F2 - Sprint Race', '2026-03-07T10:00:00Z', 1),
      session('f2', 'F2 - Feature Race', '2026-03-08T10:00:00Z', 1),
      session('f2', 'F2 - Sprint Race', '2026-03-21T10:00:00Z', 1),
      session('f2', 'F2 - Feature Race', '2026-03-22T10:00:00Z', 1),
    ]);
    f2.mockResolvedValueOnce({
      feature: [race(1, 'Feature Race', '2026-03-08', ['Tsolov', 'Browning']), race(2, 'Feature Race', '2026-03-22', ['Browning', 'Tsolov'])],
      sprint: [race(1, 'Sprint Race', '2026-03-07', ['Dunne', 'Tsolov']), race(2, 'Sprint Race', '2026-03-21', ['Tsolov', 'Dunne'])],
    });
    const h = await html(f2Series);
    expect(openCount(h)).toBe(2);
    expect(detailsCount(h)).toBe(2);
    expect(h).toContain(`href="/series/f2/weekend/1/${sessionSlug('F2 - Feature Race')}"`);
    expect(h).toContain(`href="/series/f2/weekend/1/${sessionSlug('F2 - Sprint Race')}"`);
  });

  it('opens every class card of the latest WEC round and lines the earlier rounds’ classes to the race session, which shows every class', async () => {
    const wecSeries = series('wec', 'FIA WEC', [
      session('wec', '6 Hours of Imola (Race)', '2026-04-19T11:00:00Z', 6),
      session('wec', '6 Hours of Fuji (Race)', '2026-09-27T02:00:00Z', 6),
    ]);
    const crew = (position: number, team: string) => ({ position, carNumber: String(position), team, drivers: 'A · B', vehicle: 'Car', gap: position === 1 ? '' : '+1 lap', elapsedTime: '6:00:00', status: 'Finished' });
    wec.mockResolvedValueOnce([
      { round: 1, eventName: '6 Hours of Imola', dateStart: at('2026-04-17'), dateEnd: at('2026-04-19'), perClass: { Hypercar: [crew(1, 'Ferrari AF Corse')], LMGT3: [crew(1, 'Manthey')] } },
      { round: 2, eventName: '6 Hours of Fuji', dateStart: at('2026-09-25'), dateEnd: at('2026-09-27'), perClass: { Hypercar: [crew(1, 'Toyota Gazoo Racing')], LMGT3: [crew(1, 'Vista AF Corse')] } },
    ]);
    const h = await html(wecSeries);
    expect(openCount(h)).toBe(2);
    expect(detailsCount(h)).toBe(2);
    expect(h).toContain('Toyota Gazoo Racing');
    expect(h).toContain('Vista AF Corse');
    expect((h.match(new RegExp(`href="/series/wec/weekend/1/${sessionSlug('6 Hours of Imola (Race)')}"`, 'g')) ?? []).length).toBe(2);
    expect(h).not.toContain('Manthey · Car');
  });

  it('takes GT World’s latest race by round, then by its place in the feed, and keeps the accordion for a race without a round', async () => {
    const gtSeries = series('gt-world', 'GT World Challenge Europe', [
      session('gt-world', 'GTWCE - Race 1', '2026-04-11T13:00:00Z', 1),
      session('gt-world', 'GTWCE - Race 2', '2026-04-12T13:00:00Z', 1),
      session('gt-world', 'GTWCE - Race 1', '2026-05-16T13:00:00Z', 1),
      session('gt-world', 'GTWCE - Race 2', '2026-05-17T13:00:00Z', 1),
    ]);
    const car = (position: number, team: string, cup: string) => ({ position, carNumber: String(position), team, drivers: ['X', 'Y'], car: 'GT3', cup, gap: '', time: '1:00:00' });
    gt.mockResolvedValueOnce([
      { raceId: 1, raceName: 'Race 1', eventName: 'Brands Hatch', eventSlug: 'brands', championship: 'sprint', round: 1, entries: [car(1, 'Team One', 'pro')] },
      { raceId: 2, raceName: 'Race 2', eventName: 'Brands Hatch', eventSlug: 'brands', championship: 'sprint', round: 1, entries: [car(1, 'Team Two', 'pro')] },
      { raceId: 3, raceName: 'Race 1', eventName: 'Misano', eventSlug: 'misano', championship: 'sprint', round: 2, entries: [car(1, 'Team Three', 'pro'), car(2, 'Team Four', 'silver')] },
      { raceId: 4, raceName: 'Race', eventName: 'Unmapped 3 Hours', eventSlug: 'unmapped', championship: 'endurance', entries: [car(1, 'Team Five', 'pro')] },
    ]);
    const h = await html(gtSeries);
    // Misano's two cups (the greatest round) open; the unmapped race keeps its closed accordion; Brands Hatch's two races line.
    expect(openCount(h)).toBe(2);
    expect(detailsCount(h)).toBe(3);
    expect(h).toContain('Team Three');
    expect(h).toContain('Team Five');
    expect(h).not.toContain('Team One · GT3');
    expect(h).toContain(`href="/series/gt-world/weekend/1/${sessionSlug('GTWCE - Race 1')}"`);
    expect(h).toContain(`href="/series/gt-world/weekend/1/${sessionSlug('GTWCE - Race 2')}"`);
  });

  it('keeps the accordion for a series whose race session page cannot show a classification (DTM has no per-race source), latest open', async () => {
    const dtmSeries = series('dtm', 'DTM', [
      session('dtm', 'DTM - Race 1', '2026-04-25T11:00:00Z', 1),
      session('dtm', 'DTM - Race 2', '2026-04-26T11:00:00Z', 1),
      session('dtm', 'DTM - Race 1', '2026-05-23T11:00:00Z', 1),
      session('dtm', 'DTM - Race 2', '2026-05-24T11:00:00Z', 1),
    ]);
    dtm.mockResolvedValueOnce([
      race(1, 'Oschersleben — Race 1', '2026-04-25', ['Auer', 'Preining']),
      race(1, 'Oschersleben — Race 2', '2026-04-26', ['Preining', 'Auer']),
      race(2, 'Lausitzring — Race 1', '2026-05-23', ['Güven', 'Auer']),
      race(2, 'Lausitzring — Race 2', '2026-05-24', ['Auer', 'Güven']),
    ]);
    const h = await html(dtmSeries);
    expect(detailsCount(h)).toBe(4);
    expect(openCount(h)).toBe(1);
    expect(h).toMatch(opens('Lausitzring — Race 2'));
    expect(h).not.toContain('Classification →');
    expect(h).toContain('Preining');
    expect(h).toContain('href="/series/dtm/weekend/1"');
  });

  it('leaves a winners-only season (NLS) as flat rows without a classification link', async () => {
    const nlsSeries = series('nls', 'NLS', [session('nls', 'Westfalenfahrt', '2026-03-28T10:00:00Z', 4)]);
    nls.mockResolvedValueOnce([
      { round: 1, raceName: 'Westfalenfahrt', date: at('2026-03-28'), circuit: 'Nürburgring', results: [{ position: 1, driverName: 'Crew One', team: 'Team One', time: undefined, status: 'Winner', points: 0 }] },
      { round: 2, raceName: 'Eifelrennen', date: at('2026-04-18'), circuit: 'Nürburgring', results: [{ position: 1, driverName: 'Crew Two', team: 'Team Two', time: undefined, status: 'Winner', points: 0 }] },
    ]);
    const h = await html(nlsSeries);
    expect(detailsCount(h)).toBe(0);
    expect(h).not.toContain('Classification →');
    expect(h).toContain('Crew One');
    expect(h).toContain('Overall winners');
  });

  it('leaves a winners-only season (WRC) as flat rows without a classification link', async () => {
    const wrcSeries = series('wrc', 'WRC', [session('wrc', 'WRC - Rallye Monte-Carlo', '2026-01-25T10:00:00Z', 8)]);
    wrc.mockResolvedValueOnce([
      { round: 1, raceName: 'Rallye Monte-Carlo', date: at('2026-01-25'), circuit: 'Monaco', results: [{ position: 1, driverName: 'Ogier', team: 'Toyota', time: undefined, status: 'Winner', points: 0 }] },
      { round: 2, raceName: 'Rally Sweden', date: at('2026-02-15'), circuit: 'Umeå', results: [{ position: 1, driverName: 'Rovanperä', team: 'Toyota', time: undefined, status: 'Winner', points: 0 }] },
    ]);
    const h = await html(wrcSeries);
    expect(detailsCount(h)).toBe(0);
    expect(h).not.toContain('Classification →');
    expect(h).toContain('Ogier');
  });
});

describe('raceSessionFor', () => {
  const weekend = (titles: string[]) => ({ sessions: titles.map((t, i) => session('x', t, `2026-03-0${i + 1}T10:00:00Z`)) }) as never;
  it('picks the session that names the race: sprint, superpole, race 1 or 2, else the main race', () => {
    const w = weekend(['F2 - Practice', 'F2 - Sprint Race', 'F2 - Feature Race']);
    expect(raceSessionFor(w, 'Sprint Race')?.title).toBe('F2 - Sprint Race');
    expect(raceSessionFor(w, 'Feature Race')?.title).toBe('F2 - Feature Race');
    const sbk = weekend(['WorldSBK - Race 1', 'WorldSBK - Superpole Race', 'WorldSBK - Race 2']);
    expect(raceSessionFor(sbk, 'Race 1')?.title).toBe('WorldSBK - Race 1');
    expect(raceSessionFor(sbk, 'Superpole Race')?.title).toBe('WorldSBK - Superpole Race');
    expect(raceSessionFor(sbk, 'Race 2')?.title).toBe('WorldSBK - Race 2');
    expect(raceSessionFor(weekend(['F1 - Qualifying', 'F1 - Race']), 'Australian Grand Prix')?.title).toBe('F1 - Race');
    expect(raceSessionFor(weekend(['F1 - Practice 1']), 'Australian Grand Prix')).toBeNull();
  });
});
