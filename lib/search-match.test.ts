import { describe, it, expect } from 'vitest';
import { searchDocs } from './search-match';
import type { SearchDoc } from './search-index';

const docs: SearchDoc[] = [
  { type: 'driver', title: 'Lando Norris', subtitle: 'McLaren · Formula 1', url: '/drivers/lando-norris', keywords: 'NOR 4 f1 McLaren' },
  { type: 'driver', title: 'Max Verstappen', subtitle: 'Red Bull · Formula 1', url: '/drivers/max-verstappen', keywords: 'VER 1 f1 Red Bull' },
  { type: 'team', title: 'McLaren', subtitle: 'Formula 1', url: '/teams/mclaren', keywords: 'f1' },
  { type: 'series', title: 'Formula 1', subtitle: '2026 season', url: '/series/f1', keywords: 'f1' },
  { type: 'tab', title: 'Formula 1 Standings', subtitle: 'Formula 1 · tab', url: '/series/f1/standings', keywords: 'f1 standings' },
  { type: 'blog', title: 'Le Mans 2026 preview', subtitle: 'Blog', url: '/blog/le-mans-2026-preview' },
  { type: 'page', title: 'Calendar', subtitle: 'Every series, one timeline', url: '/calendar' },
];

describe('searchDocs', () => {
  it('returns nothing for an empty / whitespace query', () => {
    expect(searchDocs(docs, '   ')).toEqual([]);
  });

  it('ranks an exact title match first', () => {
    // 'McLaren' the team (exact title) beats Lando (whose team is McLaren).
    expect(searchDocs(docs, 'mclaren')[0].url).toBe('/teams/mclaren');
  });

  it('prefix-matches titles', () => {
    expect(searchDocs(docs, 'lando')[0].url).toBe('/drivers/lando-norris');
  });

  it('matches on hidden keywords (driver code)', () => {
    expect(searchDocs(docs, 'nor').some((d) => d.url === '/drivers/lando-norris')).toBe(true);
  });

  it('AND-matches every term of a multi-word query', () => {
    expect(searchDocs(docs, 'formula standings')[0].url).toBe('/series/f1/standings');
    // a single unrelated term must not surface the standings tab
    expect(searchDocs(docs, 'max').some((d) => d.url === '/series/f1/standings')).toBe(false);
  });

  it('does subsequence fuzzy matching', () => {
    // "vstpn" is a subsequence of "verstappen"
    expect(searchDocs(docs, 'vstpn').some((d) => d.url === '/drivers/max-verstappen')).toBe(true);
  });

  it('respects the result limit', () => {
    expect(searchDocs(docs, 'formula', 1).length).toBe(1);
  });
});
