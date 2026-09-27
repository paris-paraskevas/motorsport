// @vitest-environment jsdom
//
// The home's editorial lead after it became six components (R2b): the
// composed page keeps its bands in the operator's order with one h1, and each
// piece renders on its own with the props the component renderers hand it.

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: unknown; children: ReactNode; className?: string }) => (
    <a href={String(href)} className={className}>
      {children}
    </a>
  ),
}));

import { HomeLatestResult, HomeLead, HomeLeadStory, HomeThisWeekend, HomeWhatChanged, HomeWhatsNext, HomeWire } from './HomeLead';

const blog = { slug: 'monza-2026', title: 'Monza, a history', summary: 'A century of speed.', heroImage: null, publishedAtIso: '2026-09-08T10:00:00Z', readMinutes: 6, seriesName: 'Formula 1', seriesColor: '#e10600', ageLabel: '2h ago', suggested: [{ slug: 'a', title: 'A' }, { slug: 'b', title: 'B' }] };
const result = { seriesSlug: 'f1', seriesName: 'Formula 1', color: '#e10600', raceName: 'Italian Grand Prix', round: 13, dateIso: '2026-09-06T13:00:00Z', podium: [{ position: 1, name: 'Andrea Kimi Antonelli', detail: 'Mercedes' }, { position: 2, name: 'George Russell', detail: 'Mercedes', time: '+3.857' }], margin: '+3.857', weekendHref: '/series/f1/weekend/13' };
const changed = { seriesName: 'Formula 1', leader: { name: 'Andrea Kimi Antonelli', points: 267 }, gapToSecond: 66, top: [{ position: 1, name: 'Andrea Kimi Antonelli', points: 267 }, { position: 2, name: 'George Russell', points: 201 }, { position: 3, name: 'Lewis Hamilton', points: 191 }], winnerName: 'Andrea Kimi Antonelli' };
const next = [{ seriesSlug: 'f1', seriesName: 'Formula 1', color: '#e10600', title: 'Spanish Grand Prix (Madrid)', dateRangeLabel: '11–13 Sept', firstStartIso: null, href: '/series/f1/weekend/14' }];
const wire = [{ title: 'Headline', link: 'https://example.com/1', sourceHost: 'example.com', ageLabel: '1h ago', seriesName: 'Formula 1', seriesColor: '#e10600' }];
const live = [{ seriesSlug: 'f1', seriesName: 'Formula 1', color: '#e10600', eventName: 'Italian Grand Prix', href: '/series/f1/weekend/13', nextSession: null, alsoSameDay: [], alsoDayIso: null }];

describe('HomeLead', () => {
  it('composes the bands in the given order with exactly one h1, on the lead story, and demotes the result beneath it', () => {
    const html = renderToStaticMarkup(<HomeLead blog={blog} liveWeekends={live} result={result} changed={changed} next={next} wire={wire} />);
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toMatch(/<h1[^>]*>.*Monza, a history/);
    expect(html).toMatch(/<h2[^>]*>Andrea Kimi Antonelli wins the Italian Grand Prix<\/h2>/);
    const at = (s: string) => html.indexOf(s);
    expect(at('Latest from the blog')).toBeLessThan(at('This weekend'));
    expect(at('This weekend')).toBeLessThan(at('Latest result'));
    expect(at('Latest result')).toBeLessThan(at('What it changed'));
    expect(at('What it changed')).toBeLessThan(at('The wire'));
    // The operator's order: the wire first demotes the result to h2; the result leading carries the h1.
    const reordered = renderToStaticMarkup(<HomeLead result={result} changed={changed} next={next} wire={wire} order={['wire', 'result']} />);
    expect(reordered.indexOf('The wire')).toBeLessThan(reordered.indexOf('Latest result'));
    expect(reordered).toMatch(/<h2[^>]*>Andrea Kimi Antonelli wins/);
    const leading = renderToStaticMarkup(<HomeLead result={result} changed={changed} next={next} wire={wire} order={['result', 'wire']} />);
    expect(leading).toMatch(/<h1[^>]*>Andrea Kimi Antonelli wins/);
  });

  it('each piece renders on its own with its settings: further reading capped, table rows capped, headings by place', () => {
    expect((renderToStaticMarkup(<HomeLeadStory blog={blog} suggested={1} />).match(/\/blog\/(a|b)"/g) ?? []).length).toBe(1);
    expect((renderToStaticMarkup(<HomeWhatChanged changed={changed} rows={2} />).match(/border-b border-border py-1.5/g) ?? []).length).toBe(2);
    expect(renderToStaticMarkup(<HomeLatestResult result={result} changed={changed} heading="h2" compact />)).toMatch(/<h2[^>]*text-24/);
    // The twin of the Podium view's column (R11): min-w-0, so the box stays inside a phone's screen.
    expect(renderToStaticMarkup(<HomeLatestResult result={result} changed={changed} heading="h2" compact />)).toContain('<div class="min-w-0"><div class="flex items-baseline justify-between border-b border-text pb-1">');
    expect(renderToStaticMarkup(<HomeWhatsNext next={next} />)).toContain('Spanish Grand Prix (Madrid)');
    expect(renderToStaticMarkup(<HomeWire wire={wire} />)).toContain('example.com');
    expect(renderToStaticMarkup(<HomeThisWeekend liveWeekends={live} />)).toContain('Italian Grand Prix');
    expect(renderToStaticMarkup(<HomeThisWeekend liveWeekends={[]} alsoRacing={[]} />)).toBe('');
    expect(renderToStaticMarkup(<HomeWire wire={[]} />)).toBe('');
  });
});
