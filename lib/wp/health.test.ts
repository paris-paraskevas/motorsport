import { describe, it, expect } from 'vitest';
import { decideFeed, resultsShrank, statusPage, type FeedHealth } from './health';
import type { ResultRound } from './render';

const nonEmpty = (v: number[]) => v.length > 0;

describe('decideFeed', () => {
  it('uses a usable fetch', () => {
    expect(decideFeed({ data: [1] }, [0], nonEmpty)).toEqual({ data: [1], status: 'OK', note: '' });
  });

  it('keeps the stored data when the fetch failed or came back empty', () => {
    expect(decideFeed({ data: null, error: 'timeout after 30s' }, [0], nonEmpty)).toEqual({ data: [0], status: 'STALE', note: 'timeout after 30s' });
    expect(decideFeed({ data: [] }, [0], nonEmpty)).toEqual({ data: [0], status: 'STALE', note: 'empty answer' });
  });

  it('never trades a stored table for a partial one, but takes a partial one over nothing', () => {
    expect(decideFeed({ data: [1], partial: true }, [0, 0], nonEmpty)).toEqual({ data: [0, 0], status: 'STALE', note: 'partial answer' });
    expect(decideFeed({ data: [1], partial: true }, null, nonEmpty)).toEqual({ data: [1], status: 'OK', note: 'partial' });
  });

  it('is MISSING with nothing usable anywhere', () => {
    expect(decideFeed({ data: null, error: 'HTTP 403' }, null, nonEmpty)).toEqual({ data: null, status: 'MISSING', note: 'HTTP 403' });
    expect(decideFeed<number[]>({ data: [] }, [], nonEmpty)).toEqual({ data: null, status: 'MISSING', note: 'no data' });
  });
});

describe('resultsShrank', () => {
  const round = (n: number, date: string, races = 1): ResultRound => ({
    round: n,
    name: `Round ${n}`,
    date,
    sessions: Array.from({ length: races }, (_, i) => ({ label: `Race ${i + 1}`, tables: [] })),
  });
  const season = [round(1, '2026-03-08', 2), round(2, '2026-03-22', 2), round(3, '2026-04-05', 2)];

  it('sees fewer rounds, or fewer races, than the stored season', () => {
    expect(resultsShrank(season.slice(0, 2), season)).toBe(true);
    expect(resultsShrank([round(1, '2026-03-08', 2), round(2, '2026-03-22', 2), round(3, '2026-04-05', 1)], season)).toBe(true);
  });

  it('takes a season that grew or stayed, a first season, and a new season starting small', () => {
    expect(resultsShrank([...season, round(4, '2026-04-19', 2)], season)).toBe(false);
    expect(resultsShrank(season, season)).toBe(false);
    expect(resultsShrank(season.slice(0, 1), null)).toBe(false);
    expect(resultsShrank([round(1, '2027-03-07', 2)], season)).toBe(false);
  });

  it("counts races only, never a round's other sessions (O15: every finisher, practice and qualifying stored)", () => {
    const practised = season.map(r => ({ ...r, others: [{ label: 'Practice 1', tables: [] }, { label: 'Qualifying', tables: [] }] }));
    expect(resultsShrank(season, practised)).toBe(false);
    expect(resultsShrank(practised, season)).toBe(false);
    expect(resultsShrank(practised.slice(0, 2), season)).toBe(true);
  });
});

describe('statusPage', () => {
  const row = (name: string, kind: FeedHealth['kind'], status: FeedHealth['status'], since: string | null = '2026-10-18', note = ''): FeedHealth => ({
    slug: name.toLowerCase(),
    name,
    kind,
    status,
    note,
    since,
  });

  it('lists every feed by series, standings before results before calendar', () => {
    const page = statusPage(
      [row('WRC', 'calendar', 'OK'), row('DTM', 'results', 'STALE', '2026-10-12', 'timeout'), row('DTM', 'standings', 'OK'), row('NLS', 'results', 'MISSING', null, 'HTTP 403')],
      new Date('2026-10-20T08:47:00Z'),
    );
    expect(page.path).toBe('/status/');
    // Dated by the day, so the page changes once a day, not every run.
    expect(page.body).toContain('Checked 20 Oct 2026. 2 of 4 feeds did not answer this time.');
    const order = ['<td>DTM</td><td>Standings</td>', '<td>DTM</td><td>Results</td><td>STALE</td><td>12 Oct 2026</td><td>timeout</td>', '<td>NLS</td>', '<td>WRC</td>'];
    const at = order.map(s => page.body.indexOf(s));
    expect(at.every(i => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('escapes what it prints', () => {
    const page = statusPage([row('A<b>', 'results', 'MISSING', null, '<i>x</i>')], new Date('2026-10-20T08:47:00Z'));
    expect(page.body).not.toContain('<b>');
    expect(page.body).toContain('A&lt;b&gt;');
    expect(page.body).toContain('1 of 1 feeds did not answer this time.');
  });
});
