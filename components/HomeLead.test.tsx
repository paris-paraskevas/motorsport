// @vitest-environment jsdom
//
// The home's editorial lead after it became six components (R2b): the
// composed page keeps its bands in the operator's order with one h1, and each
// piece renders on its own with the props the component renderers hand it.

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { formatLocal } from '@/lib/date';

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

  it('the lead’s cover and a thumbnail name their story (R13, the SEO check of 2026-09-27); the cover’s link stays hidden from a reader', () => {
    const covered = renderToStaticMarkup(<HomeLeadStory blog={{ ...blog, heroImage: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Monza.jpg' }} suggested={1} />);
    // The file's Link mock drops aria-hidden and tabindex; the cover's words and its size are what this asserts (the hidden link is
    // component-render.test.tsx's; React 19 writes srcSet as given). R13 PR C: the 960 bucket of Commons' thumbnail service with the srcset and the box's sizes.
    expect(covered).toContain('<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Monza.jpg/960px-Monza.jpg" srcSet="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Monza.jpg/500px-Monza.jpg 500w, https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Monza.jpg/960px-Monza.jpg 960w, https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Monza.jpg/1280px-Monza.jpg 1280w" sizes="(min-width: 1024px) 46vw, 100vw" alt="Monza, a history"');
    // A cover on another host is drawn as it is, without a srcset.
    const other = renderToStaticMarkup(<HomeLeadStory blog={{ ...blog, heroImage: 'https://img.example/monza.jpg' }} suggested={1} />);
    expect(other).toContain('<img src="https://img.example/monza.jpg" alt="Monza, a history"');
    expect(other).not.toContain('srcset');
    expect(covered).not.toContain('alt=""');
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

  it('the This weekend box’s times go through LocalTime: the server render carries the fixed Athens time with its zone label, never the Worker’s bare clock (R17)', () => {
    // The countdown reads the clock and draws nothing once its target has passed, so the clock is pinned before the session.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
    try {
      const weekend = [{ ...live[0], nextSession: { name: 'F1 Bahrain GP - Practice 1', startIso: '2026-10-02T04:30:00Z', endIso: '2026-10-02T05:30:00Z' }, alsoSameDay: [{ name: 'F1 Bahrain GP - Practice 2', startIso: '2026-10-02T08:00:00Z' }], alsoDayIso: '2026-10-02' }];
      const also = [{ seriesSlug: 'motogp', seriesName: 'MotoGP', color: '#ff8000', eventName: 'Japanese Grand Prix', href: '/series/motogp/weekend/17', sessionName: 'MotoGP - FP1', startIso: '2026-10-02T01:45:00Z' }];
      const html = renderToStaticMarkup(<HomeThisWeekend liveWeekends={weekend} alsoRacing={also} />);
      expect(html).toContain(formatLocal(new Date('2026-10-02T04:30:00Z')));
      expect(html).toContain(formatLocal(new Date('2026-10-02T08:00:00Z')));
      expect(html).toContain(formatLocal(new Date('2026-10-02T01:45:00Z')));
      expect(html).toContain('Time until F1 Bahrain GP - Practice 1');
      expect(html).not.toMatch(/>0?4:30</);
    } finally {
      vi.useRealTimers();
    }
  });
});
