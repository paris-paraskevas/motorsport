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

describe('MonthView, the phone agenda', () => {
  it('pins the date gutter to the top of its day, so a day of many sessions is named where its list starts and not halfway down it (the operator’s report, 2026-09-26)', () => {
    const anchor = new Date(2030, 8, 1);
    const now = new Date(2030, 8, 2, 12);
    const entries = [
      entry('fp1', 'Practice 1', '2030-09-06T11:30:00'),
      entry('fp2', 'Practice 2', '2030-09-06T15:00:00'),
      entry('q', 'Qualifying', '2030-09-07T14:00:00'),
    ];
    const html = renderToStaticMarkup(<MonthView anchor={anchor} now={now} buckets={bucketByDay(entries)} onSelectDay={() => {}} />);
    const gutter = /<button[^>]*aria-label="Open Fri 6"[^>]*>/.exec(html)?.[0];
    expect(gutter).toBeDefined();
    expect(gutter).toMatch(/class="[^"]*\bself-start\b/);
  });
});
