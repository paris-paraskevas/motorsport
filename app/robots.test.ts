import { describe, expect, it } from 'vitest';
import robots from './robots';

// R15 (2026-09-28): the Filters region's chips link every combination of series, so a
// crawler finds the graph of all subsets (Ahrefs: 180,278 link targets on a site of
// 1,034 pages). Google's page on faceted navigation prefers robots.txt for filtered
// pages that need no indexing; the variants keep their noindex, canonical and nofollow.

/** Google's robots.txt matching for one rule: `*` matches any run of characters, a
 *  rule matches at the start of the path, `$` anchors the end. */
function matches(rule: string, pathAndQuery: string): boolean {
  const anchored = rule.endsWith('$');
  const body = anchored ? rule.slice(0, -1) : rule;
  const re = new RegExp('^' + body.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''));
  return re.test(pathAndQuery);
}

describe('robots.txt', () => {
  const rules = robots().rules;
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const disallow = ([] as string[]).concat(rule.disallow ?? []);
  const blocked = (url: string) => disallow.some(d => matches(d, url));

  it('keeps crawlers off the filter variants and the calendar\'s ?s= deep links, and nothing else new', () => {
    expect(disallow).toEqual(['/api/', '/settings', '/sign-in', '/sign-up', '/*?*filter=', '/calendar?s=']);
    expect(rule.allow).toBe('/');
    expect(rule.userAgent).toBe('*');
  });

  it('blocks a filtered calendar or news URL and any combination of chips', () => {
    for (const url of [
      '/calendar?filter=seriesName.in%3ADTM',
      '/calendar?filter=seriesName.in%3ADTM%2CFIA+WEC&filter=sessionType.in%3Arace',
      '/news?filter=seriesName.in%3AFormula+1',
      '/series/f1/standings?r.abc.filter=x',
    ]) expect(blocked(url), url).toBe(true);
  });

  it('blocks the calendar\'s ?s= deep links, with or without more parameters (X17), and nothing named alike', () => {
    for (const url of ['/calendar?s=f1', '/calendar?s=f1&races=1', '/calendar?s=motogp']) expect(blocked(url), url).toBe(true);
    for (const url of ['/calendar?series=f1', '/calendar?sessions=race', '/series/f1?s=x']) expect(blocked(url), url).toBe(false);
  });

  it('leaves the plain pages, the sitemap, a series link with another query and every sitemap page allowed', () => {
    for (const url of ['/', '/calendar', '/news', '/sitemap.xml', '/robots.txt', '/calendar?series=f1', '/series/f1/weekend/1', '/information/tracks/sachsenring', '/blog/f1-baku-2026-practice', '/drivers/pierre-gasly']) {
      expect(blocked(url), url).toBe(false);
    }
    // A sort or a view alone is a handful of links per page, not a combination graph; the line names filters only.
    for (const url of ['/calendar?sort=start', '/news?view=wire', '/series/f1/standings?r.abc.sort=pts']) {
      expect(blocked(url), url).toBe(false);
    }
  });
});
