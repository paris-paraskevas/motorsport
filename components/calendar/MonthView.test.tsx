import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { bucketByDay } from '@/lib/calendar-grid';
import { MonthView } from './MonthView';
import type { CalendarEntry } from './types';

const entry = (uid: string, title: string, start: string): CalendarEntry => ({
  seriesSlug: 'f1',
  seriesName: 'Formula 1',
  color: '#e10600',
  session: { uid, seriesSlug: 'f1', title, start: new Date(start), end: new Date(new Date(start).getTime() + 3_600_000) },
});

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
    expect(html).toContain('class="grid grid-cols-7 border-b border-text"');
    expect(html).not.toContain('hidden grid-cols-7');
    // Friday the 6th: two bars below md (one per session, the series' colour), the lines md+ as before.
    const bars = /<div class="mt-1 flex flex-wrap gap-\[3px\] md:hidden" aria-hidden="true">((?:<span[^>]*><\/span>)+)<\/div>/g;
    const rows = [...html.matchAll(bars)].map(m => (m[1].match(/<span/g) ?? []).length);
    // Friday's two practices collapse into one line (collapseRuns), so one bar; Saturday's qualifying one bar.
    expect(rows).toEqual([1, 1]);
    expect(html).toContain('background-color:#e10600');
    expect(html).toContain('class="mt-1 hidden min-w-0 flex-col gap-[3px] md:flex"');
    // The cell keeps its tap and a shorter floor on a phone.
    expect(html).toContain('min-h-[52px] cursor-pointer flex-col md:min-h-[72px]');
    expect(html).toContain('role="button"');
  });
});
