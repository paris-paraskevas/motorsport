// @vitest-environment jsdom
//
// The components' server half: each Home component draws from the page's
// assembly with its settings applied, the first component in the Body carries
// the h1, an unknown key draws nothing, a renderer that throws draws nothing
// for its own region only, and the race-weekend fact follows the live band.

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { PageDocument, Region } from './page-document';

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
const buildWire = vi.fn(async (count: number) => Array.from({ length: count }, (_, i) => ({ title: `More ${i + 1}`, link: `https://example.com/m${i}`, sourceHost: 'example.com', ageLabel: '1h ago', seriesName: 'Formula 1', seriesColor: '#e10600' })));
vi.mock('@/lib/home-model', () => ({
  loadHomeModel: async () => model,
  buildWire: (count: number) => buildWire(count),
  loadSeriesMeta: async () => new Map([['f1', { name: 'Formula 1', color: '#e10600' }]]),
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
    expect(buildWire).toHaveBeenCalledWith(8);
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
