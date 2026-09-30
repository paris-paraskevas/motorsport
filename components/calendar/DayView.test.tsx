import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { bucketByDay } from '@/lib/calendar-grid';
import type { SignificanceFlag } from '@/lib/types';
import { DayView } from './DayView';
import type { CalendarEntry } from './types';

// THE DAY VIEW'S CARDS (X6 C, the reviewer's finding): the calendar's entries carry their round and a short key, and the
// session's location and significance stay on them, because the day's cards draw the pin, the tier and the note.

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: unknown; children: React.ReactNode; className?: string }) => (
    <a href={String(href)} className={className}>
      {children}
    </a>
  ),
}));

const entry = (uid: string, title: string, start: string, over: Partial<CalendarEntry['session']> = {}, round?: number): CalendarEntry => ({
  seriesSlug: 'f1',
  seriesName: 'Formula 1',
  color: '#e10600',
  round,
  session: { uid, seriesSlug: 'f1', title, start: new Date(start), end: new Date(new Date(start).getTime() + 3_600_000), ...over },
});

describe('DayView', () => {
  it('draws a day’s cards from the entries: the pin from the location, the tier and the note from the significance, the link from the round', () => {
    const significance = { tier: 'Season finale', note: 'The title can be decided here.' } as unknown as SignificanceFlag;
    const entries = [
      entry('0', 'F1 - Qualifying', '2030-11-30T14:00:00', { location: 'Yas Marina Circuit, Abu Dhabi', significance }, 24),
      entry('1', 'F1 - Practice 1', '2030-11-30T10:30:00'),
    ];
    const html = renderToStaticMarkup(<DayView anchor={new Date(2030, 10, 30)} now={new Date(2030, 10, 29, 12)} buckets={bucketByDay(entries)} />);
    expect(html).toContain('Yas Marina Circuit');
    expect(html).toContain('Season finale');
    expect(html).toContain('The title can be decided here.');
    expect(html).toContain('href="/series/f1/weekend/24"');
    // A session outside every round links the series.
    expect(html).toContain('href="/series/f1"');
    expect((html.match(/F1 - /g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
