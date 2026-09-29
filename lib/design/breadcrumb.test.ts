// The Breadcrumb's trail (P2.17): an address's prefixes, each the page that answers it, a code page of the registry labelled
// by its resolver or a live row page by its name; nothing where no page is. The label sources are spied on their modules
// (never a factory mock: the trail imports them on demand and would get the real module).
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as pageFrame from './page-frame';
import * as pages from './pages';
import * as seriesLib from '@/lib/series';
import * as info from '@/lib/information/registry';
import * as topics from '@/lib/information/topics';
import * as authors from '@/lib/authors';
import * as people from '@/lib/people';
import type { Series } from '@/lib/types';
import { matchCodePage } from './composed-page';
import { INFO_TOPICS } from '@/lib/information/topics';
import { breadcrumbTrail, fillPattern, ownsBreadcrumbLd, siblingPages, trailPrefixes, wordsFromSegment } from './breadcrumb';

const NAMES: Record<string, string> = { '/': 'Home', '/series': 'Series', '/information': 'Learn', '/social': 'Social', '/social/leagues': 'Leagues' };
const frames = () => vi.spyOn(pageFrame, 'loadPageFrame').mockImplementation(async path => (path in NAMES ? ({ name: NAMES[path] } as unknown as pageFrame.PageFrame) : null));
const rows = (map: Record<string, { path: string; name: string }>) => vi.spyOn(pages, 'loadPageDestinations').mockResolvedValue(map);
// The grouping keeps a window around now (lib/group.ts), so the fixture's weekend sits a month ahead of the clock.
const at = (days: number, hours: number) => new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
const f1 = {
  meta: { slug: 'f1', name: 'Formula 1', color: '#e10600', season: 2026 },
  sessions: [
    { uid: 'p1', seriesSlug: 'f1', title: 'F1 - Practice 1', start: at(30, 0), end: at(30, 1), location: 'Bahrain International Circuit' },
    { uid: 'race', seriesSlug: 'f1', title: 'F1 - Race', start: at(32, 0), end: at(32, 2), location: 'Bahrain International Circuit' },
  ],
} as unknown as Series;
const hrefs = (trail: { label: string; href: string; current: boolean }[]) => trail.map(c => `${c.label}@${c.href}${c.current ? '!' : ''}`);
const on = { home: true, current: true };

afterEach(() => vi.restoreAllMocks());

describe('the Breadcrumb trail (P2.17)', () => {
  it('walks an address by its prefixes and fills a pattern with its parts', () => {
    expect(trailPrefixes('/series/f1/standings')).toEqual(['/', '/series', '/series/f1', '/series/f1/standings']);
    expect(trailPrefixes('/')).toEqual(['/']);
    expect(fillPattern('/series/[slug]/[tab]', { slug: 'f1', tab: 'standings' })).toBe('/series/f1/standings');
    expect(fillPattern('/about', {})).toBe('/about');
    expect(wordsFromSegment('pierre-gasly')).toBe('Pierre Gasly');
    expect(wordsFromSegment('f1')).toBe('F1');
  });

  it('matches a literal address to a code page of the registry: the literal wins, then the fewest parts; a row address matches none', () => {
    expect(matchCodePage('/information/map')).toEqual({ page: expect.objectContaining({ path: '/information/map' }), params: {} });
    expect(matchCodePage('/information/rules')).toEqual({ page: expect.objectContaining({ path: '/information/[topic]' }), params: { topic: 'rules' } });
    expect(matchCodePage('/series/f1/standings')).toEqual({ page: expect.objectContaining({ path: '/series/[slug]/[tab]' }), params: { slug: 'f1', tab: 'standings' } });
    // Structurally a tab; the tab resolver decides there is no page here.
    expect(matchCodePage('/series/f1/weekend')?.page.path).toBe('/series/[slug]/[tab]');
    expect(matchCodePage('/social/leagues/join')?.page.path).toBe('/social/leagues/[id]');
    expect(matchCodePage('/history/monza')).toBeNull();
    expect(matchCodePage('/')?.page.path).toBe('/');
  });

  it('a series tab: Home, Series, the series by name, the tab by its label; the labels of the literal pages are their rows’ names; the live row pages are never read', async () => {
    frames();
    const live = rows({});
    vi.spyOn(seriesLib, 'loadSeries').mockResolvedValue(f1);
    const trail = await breadcrumbTrail({ path: '/series/[slug]/[tab]', params: { slug: 'f1', tab: 'standings' } }, on);
    expect(hrefs(trail)).toEqual(['Home@/', 'Series@/series', 'Formula 1@/series/f1', 'Standings@/series/f1/standings!']);
    expect(live).not.toHaveBeenCalled();
  });

  it('a weekend and a session: the weekend by its title, the session by its name; /series/f1/weekend is no page, so no crumb', async () => {
    frames();
    vi.spyOn(seriesLib, 'loadSeries').mockResolvedValue(f1);
    const weekend = await breadcrumbTrail({ path: '/series/[slug]/weekend/[round]', params: { slug: 'f1', round: '1' } }, on);
    expect(hrefs(weekend)).toEqual(['Home@/', 'Series@/series', 'Formula 1@/series/f1', 'Bahrain International Circuit@/series/f1/weekend/1!']);
    const session = await breadcrumbTrail({ path: '/series/[slug]/weekend/[round]/[session]', params: { slug: 'f1', round: '1', session: 'race' } }, on);
    expect(hrefs(session)).toEqual(['Home@/', 'Series@/series', 'Formula 1@/series/f1', 'Bahrain International Circuit@/series/f1/weekend/1', 'Race@/series/f1/weekend/1/race!']);
  });

  it('a Learn answer: the topic by its label, the answer by its question', async () => {
    frames();
    vi.spyOn(topics, 'getTopic').mockImplementation(id => (id === 'rules' ? { id: 'rules', label: 'Rules', blurb: '' } : undefined));
    vi.spyOn(info, 'getInfoEntry').mockResolvedValue({ question: 'What is DRS?' } as unknown as Awaited<ReturnType<typeof info.getInfoEntry>>);
    const trail = await breadcrumbTrail({ path: '/information/[topic]/[slug]', params: { topic: 'rules', slug: 'what-is-drs' } }, on);
    expect(hrefs(trail)).toEqual(['Home@/', 'Learn@/information', 'Rules@/information/rules', 'What is DRS?@/information/rules/what-is-drs!']);
  });

  it('a row page under a row page: the ancestor by its name from the live pages, read once; the page itself by its title; a deleted ancestor leaves the trail (P1.12)', async () => {
    frames();
    const live = rows({ a: { path: '/history', name: 'History' }, b: { path: '/history/monza', name: 'Monza' } });
    const page = { path: '/history/monza', name: 'Monza', title: 'Monza, a history' };
    expect(hrefs(await breadcrumbTrail({ path: '/history/monza', params: {}, page }, on))).toEqual(['Home@/', 'History@/history', 'Monza, a history@/history/monza!']);
    expect(live).toHaveBeenCalledTimes(1);
    rows({ b: { path: '/history/monza', name: 'Monza' } });
    expect(hrefs(await breadcrumbTrail({ path: '/history/monza', params: {}, page }, on))).toEqual(['Home@/', 'Monza, a history@/history/monza!']);
  });

  it('a pattern page without a resolver is no crumb as an ancestor (nothing vouches for the address) and its segment in words as the page itself', async () => {
    frames();
    vi.spyOn(people, 'findDriverBySlug').mockResolvedValue(null);
    // /social/leagues/join matches /social/leagues/[id] with the id "join": not a page.
    const join = await breadcrumbTrail({ path: '/social/leagues/join/[token]', params: { token: 'abc' } }, on);
    expect(hrefs(join)).toEqual(['Home@/', 'Social@/social', 'Leagues@/social/leagues', 'Abc@/social/leagues/join/abc!']);
    // A resolver that answers null for the page itself: its words.
    const driver = await breadcrumbTrail({ path: '/drivers/[slug]', params: { slug: 'pierre-gasly' } }, on);
    expect(hrefs(driver)).toEqual(['Home@/', 'Pierre Gasly@/drivers/pierre-gasly!']);
  });

  it('a resolver that throws: no crumb for an ancestor, the words for the page itself; the registry’s names when the rows cannot be read', async () => {
    vi.spyOn(pageFrame, 'loadPageFrame').mockResolvedValue(null);
    vi.spyOn(seriesLib, 'loadSeries').mockRejectedValue(new Error('no such series'));
    expect(hrefs(await breadcrumbTrail({ path: '/series/[slug]/[tab]', params: { slug: 'zzz', tab: 'standings' } }, on))).toEqual(['Home@/', 'Series@/series', 'Standings@/series/zzz/standings!']);
    expect(hrefs(await breadcrumbTrail({ path: '/series/[slug]', params: { slug: 'zzz' } }, on))).toEqual(['Home@/', 'Series@/series', 'Zzz@/series/zzz!']);
  });

  it('Home alone is one crumb; Show Home off drops the first, This page off drops the last', async () => {
    frames();
    vi.spyOn(seriesLib, 'loadSeries').mockResolvedValue(f1);
    expect(hrefs(await breadcrumbTrail({ path: '/', params: {} }, on))).toEqual(['Home@/!']);
    const where = { path: '/series/[slug]/[tab]', params: { slug: 'f1', tab: 'standings' } };
    expect(hrefs(await breadcrumbTrail(where, { home: false, current: true }))).toEqual(['Series@/series', 'Formula 1@/series/f1', 'Standings@/series/f1/standings!']);
    expect(hrefs(await breadcrumbTrail(where, { home: true, current: false }))).toEqual(['Home@/', 'Series@/series', 'Formula 1@/series/f1']);
  });

  it('P2.10: the sibling pages of an address: the series tab’s sub-pages and News with the current one marked; the Learn topics; the row pages under the same parent by name; nothing elsewhere', async () => {
    vi.spyOn(seriesLib, 'loadSeries').mockResolvedValue(f1);
    const marks = (list: { label: string; href: string; current: boolean }[]) => list.map(p => `${p.label}@${p.href}${p.current ? '!' : ''}`);
    const tab = await siblingPages({ path: '/series/[slug]/[tab]', params: { slug: 'f1', tab: 'standings' } });
    expect(marks(tab)).toEqual([
      'Calendar@/series/f1',
      'Standings@/series/f1/standings!',
      'Results@/series/f1/results',
      'Rounds@/series/f1/tracks',
      'Drivers@/series/f1/drivers',
      'Champions@/series/f1/champions',
      'Blog@/series/f1/blog',
      'News@/series/f1/news',
    ]);
    const hub = await siblingPages({ path: '/series/[slug]', params: { slug: 'f1' } });
    expect(marks(hub)[0]).toBe('Calendar@/series/f1!');
    const topics = await siblingPages({ path: '/information/[topic]', params: { topic: INFO_TOPICS[0].id } });
    expect(topics).toHaveLength(INFO_TOPICS.length);
    expect(topics[0]).toEqual({ label: INFO_TOPICS[0].label, href: `/information/${INFO_TOPICS[0].id}`, current: true });
    rows({ a: { path: '/history/monza', name: 'Monza, a history' }, b: { path: '/history/imola', name: 'Imola, a history' }, c: { path: '/history', name: 'History' }, d: { path: '/about-us', name: 'About us' } });
    const row = await siblingPages({ path: '/history/monza', params: {}, page: { title: null, name: 'Monza, a history' } });
    expect(marks(row)).toEqual(['Imola, a history@/history/imola', 'Monza, a history@/history/monza!']);
    expect(await siblingPages({ path: '/about', params: {} })).toEqual([]);
    vi.spyOn(seriesLib, 'loadSeries').mockRejectedValue(new Error('no such series'));
    expect(await siblingPages({ path: '/series/[slug]/[tab]', params: { slug: 'zzz', tab: 'standings' } })).toEqual([]);
  });

  it('knows which pages print their own BreadcrumbList, so the region prints none there', () => {
    expect(ownsBreadcrumbLd('/series/[slug]/[tab]')).toBe(true);
    expect(ownsBreadcrumbLd('/calendar')).toBe(true);
    expect(ownsBreadcrumbLd('/drivers/[slug]')).toBe(false);
    expect(ownsBreadcrumbLd('/history/monza')).toBe(false);
    expect(authors).toBeTruthy();
  });
});
