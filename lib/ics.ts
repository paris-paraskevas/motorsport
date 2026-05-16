import * as ical from 'node-ical';
import { Session } from './types';

// node-ical attaches `dateOnly: true` (non-enumerable) on the Date instance
// produced from DTSTART;VALUE=DATE entries. We can't trust the Date alone
// because date-only is just midnight UTC, which would render at 02:00–03:00
// in Athens (EEST/EET) and confuse users into thinking a race starts then.
function hasDateOnly(d: Date | undefined): boolean {
  if (!d) return false;
  return (d as Date & { dateOnly?: boolean }).dateOnly === true;
}

export function parseIcs(text: string, seriesSlug: string): Session[] {
  if (!text.trim()) return [];
  const events = ical.sync.parseICS(text);
  const sessions: Session[] = [];
  for (const key of Object.keys(events)) {
    const ev = events[key] as ical.VEvent;
    if (ev.type !== 'VEVENT') continue;
    const start = ev.start as Date;
    const end = ev.end as Date;
    const dateOnly = hasDateOnly(start) || hasDateOnly(end);
    sessions.push({
      uid: String(ev.uid ?? key),
      seriesSlug,
      title: String(ev.summary ?? ''),
      start,
      end,
      location: ev.location ? String(ev.location) : undefined,
      ...(dateOnly ? { dateOnly: true } : {}),
    });
  }
  return sessions.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function fetchIcsText(url: string): Promise<string> {
  const res = await fetch(url, { next: { revalidate: 21600 } } as RequestInit);
  if (!res.ok) throw new Error(`ICS fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}
