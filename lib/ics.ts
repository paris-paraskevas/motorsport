import ICAL from 'ical.js';
import { Session } from './types';
import { fetchUpstream } from './fetch-upstream';

// ICS parsing uses ical.js (pure JS) rather than node-ical: node-ical pulls in
// Node-only internals that return nothing under the Cloudflare Workers runtime,
// silently emptying every schedule. ical.js parses identically (verified against
// node-ical on the live feeds, byte-for-byte on start/end/summary) and runs on
// Workers. DTSTART;VALUE=DATE (all-day) entries surface via ICAL.Time#isDate.

// Many non-F1 feeds (Google Calendar exports, ECAL exports, scraper-built
// ICS) emit race weekends as DTSTART:YYYYMMDDT000000Z rather than
// DTSTART;VALUE=DATE. A real motorsport session starting exactly at UTC
// midnight is implausible (races run in venue-local prime time), so when
// BOTH start and end fall on a UTC midnight boundary we treat the entry
// as effectively date-only — render "TBC" instead of inventing "Sat 03:00".
function looksLikeDateOnlyMidnight(start: Date, end: Date | undefined): boolean {
  const isUtcMidnight = (d: Date): boolean =>
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  if (!isUtcMidnight(start)) return false;
  if (!end) return true;
  return isUtcMidnight(end);
}

export function parseIcs(text: string, seriesSlug: string): Session[] {
  if (!text.trim()) return [];
  let vevents;
  try {
    vevents = new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent');
  } catch {
    return []; // malformed ICS — degrade to empty, callers already fail soft
  }
  const sessions: Session[] = [];
  for (const ve of vevents) {
    try {
      const ev = new ICAL.Event(ve);
      const start = ev.startDate.toJSDate();
      const startIsDate = ev.startDate.isDate === true;
      // End is best-effort: default to the start when a feed omits DTEND/DURATION
      // (Session.end is a required Date; a zero-length session beats a null crash).
      let end: Date = start;
      let endIsDate = false;
      try {
        const ed = ev.endDate;
        if (ed) {
          end = ed.toJSDate();
          endIsDate = ed.isDate === true;
        }
      } catch {
        /* no usable end — keep the start-as-end default */
      }
      const dateOnly = startIsDate || endIsDate || looksLikeDateOnlyMidnight(start, end);
      sessions.push({
        uid: String(ev.uid || ve.getFirstPropertyValue('uid') || ''),
        seriesSlug,
        title: String(ev.summary || ''),
        start,
        end,
        location: ev.location ? String(ev.location) : undefined,
        ...(dateOnly ? { dateOnly: true } : {}),
      });
    } catch {
      continue; // event missing/invalid DTSTART — skip it, keep the rest
    }
  }
  return sessions.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function fetchIcsText(url: string): Promise<string> {
  const res = await fetchUpstream(url, { next: { revalidate: 21600 } });
  if (!res.ok) throw new Error(`ICS fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}
