import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { bucketByDay } from '@/lib/calendar-grid';
import { MonthView } from './MonthView';
import type { CalendarEntry } from './types';

const entry = (uid: string, title: string, start: string, [seriesSlug, seriesName, color] = ['f1', 'Formula 1', '#e10600']): CalendarEntry => ({
  seriesSlug,
  seriesName,
  color,
  session: { uid, seriesSlug, title, start: new Date(start), end: new Date(new Date(start).getTime() + 3_600_000) },
});

const BARS = /<div class="mt-1 flex gap-\[2px\] md:hidden" aria-hidden="true">((?:<span[^>]*><\/span>)+)<\/div>/g;
const barsPerDay = (html: string) => [...html.matchAll(BARS)].map(m => (m[1].match(/<span/g) ?? []).length);

describe('MonthView, the grid at every width (R12)', () => {
  it('draws the seven-column grid on a phone too: no agenda, a day’s sessions as series bars below md and as lines md+, a tap opening the day', () => {
    const anchor = new Date(2030, 8, 1);
    const now = new Date(2030, 8, 2, 12);
    const entries = [
      entry('fp1', 'Practice 1', '2030-09-06T11:30:00'),
      entry('fp2', 'Practice 2', '2030-09-06T15:00:00'),
      entry('q', 'Qualifying', '2030-09-07T14:00:00'),
    ];
    const html = renderToStaticMarkup(<MonthView anchor={anchor} now={now} buckets={bucketByDay(entries)} onSelectDay={() => {}} />);
    // The agenda of 2026-08-25 is gone (the operator's word of 2026-09-27); the weekday row and the weeks show at every width.
    expect(html).not.toContain('class="md:hidden"');
    expect(html).not.toContain('aria-label="Open Fri 6"');
    // The cell is the only tappable surface below md: its name for a reader starts with the day, as the agenda's button did ("Open Fri 6" with the date that follows); md+ unchanged.
    expect(html).toContain('<span class="sr-only md:hidden">Open Fri</span>');
    expect(html).toContain('class="grid grid-cols-7 border-b border-text"');
    expect(html).not.toContain('hidden grid-cols-7');
    // Friday the 6th and Saturday the 7th: a bar per run below md (Friday's two practices collapse into one run), the bars sharing the cell's width; the lines md+ as before.
    expect(barsPerDay(html)).toEqual([1, 1]);
    expect(html).toContain('<span class="h-[5px] min-w-0 flex-1" style="background-color:#e10600"></span>');
    expect(html).toContain('class="mt-1 hidden min-w-0 flex-col gap-[3px] md:flex"');
    // The cell keeps its tap, a shorter floor on a phone and the desktop's floor as it was (one md floor: the reviewer's finding).
    expect(html).toContain('class="flex min-h-[52px] cursor-pointer flex-col border-b border-r border-border');
    expect(html).not.toContain('md:min-h-[72px]');
    expect(html).toContain('hover:bg-surface md:min-h-[100px]');
    expect(html).toContain('role="button"');
  });

  it('caps the bars at the desktop\u2019s three lines: four series on one day show three bars, the fourth behind the day (md+ says +1 more)', () => {
    const anchor = new Date(2030, 8, 1);
    const now = new Date(2030, 8, 2, 12);
    const entries = [
      entry('a', 'Practice 1', '2030-09-08T09:00:00'),
      entry('b', 'Practice 1', '2030-09-08T10:00:00', ['f2', 'Formula 2', '#0090d0']),
      entry('c', 'Practice 1', '2030-09-08T11:00:00', ['f3', 'Formula 3', '#e8002d']),
      entry('d', 'Practice 1', '2030-09-08T12:00:00', ['motogp', 'MotoGP', '#c00']),
    ];
    const html = renderToStaticMarkup(<MonthView anchor={anchor} now={now} buckets={bucketByDay(entries)} onSelectDay={() => {}} />);
    expect(barsPerDay(html)).toEqual([3]);
    expect(html).toContain('+1 more');
  });
});
