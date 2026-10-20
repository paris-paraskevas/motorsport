import { describe, it, expect } from 'vitest';
import { decideFeed, statusPage, type FeedHealth } from './health';

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
    expect(page.body).toContain('Checked Tue 20 Oct, 08:47 UTC. 2 of 4 feeds did not answer this time.');
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
