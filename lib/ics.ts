import * as ical from 'node-ical';
import { Session } from './types';

export function parseIcs(text: string, seriesSlug: string): Session[] {
  if (!text.trim()) return [];
  const events = ical.sync.parseICS(text);
  const sessions: Session[] = [];
  for (const key of Object.keys(events)) {
    const ev = events[key] as ical.VEvent;
    if (ev.type !== 'VEVENT') continue;
    sessions.push({
      uid: String(ev.uid ?? key),
      seriesSlug,
      title: String(ev.summary ?? ''),
      start: ev.start as Date,
      end: ev.end as Date,
      location: ev.location ? String(ev.location) : undefined,
    });
  }
  return sessions.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function fetchIcsText(url: string): Promise<string> {
  const res = await fetch(url, { next: { revalidate: 21600 } } as RequestInit);
  if (!res.ok) throw new Error(`ICS fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}
