import { Weekend } from './types';
import { DAY_MS } from './rounds';
import { sessionSlug, weekendLabel } from './weekend';
import { SITE_URL } from './site';

// Per-series ICS feed generator (/api/calendar/[slug]). Pure — the route
// composes it from the SAME resolution the series calendar tab renders
// (loadSeries + groupByWeekend), so a subscribed calendar can never disagree
// with the page. RFC 5545: CRLF line endings, 75-octet folding, TEXT escaping.

/** Sessions older than this fall out of the feed; everything future stays. */
export const ICS_RECENT_PAST_MS = 30 * DAY_MS;

export interface SeriesIcsInput {
  slug: string;
  name: string;
  /** Round-assigned weekends from groupByWeekend — the calendar tab's shape. */
  weekends: Weekend[];
  now?: Date;
}

/** RFC 5545 §3.3.11 TEXT escaping: backslash, semicolon, comma, newline. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const encoder = new TextEncoder();

/**
 * RFC 5545 §3.1 line folding: physical lines are capped at 75 octets;
 * continuations start with a single space. Splits on code points so a
 * multi-byte character (emoji in upstream titles) never straddles a fold.
 */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    if (currentBytes + chBytes > 75) {
      out.push(current);
      current = ' ';
      currentBytes = 1;
    }
    current += ch;
    currentBytes += chBytes;
  }
  out.push(current);
  return out.join('\r\n');
}

/** 2026-07-03T14:00:00.000Z → 20260703T140000Z (UTC, RFC 5545 DATE-TIME). */
function formatUtcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]|\.\d{3}/g, '');
}

/** 2026-07-03T… → 20260703 (RFC 5545 DATE, for date-only sessions). */
function formatDateValue(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export function buildSeriesIcs({ slug, name, weekends, now = new Date() }: SeriesIcsInput): string {
  const host = new URL(SITE_URL).host;
  const cutoff = now.getTime() - ICS_RECENT_PAST_MS;
  const dtstamp = formatUtcStamp(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Paddock Tracker//Paddock//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`${name} — Paddock Tracker`)}`,
    // Hint subscribing clients to refetch twice a day — matches how often
    // curated session times realistically move.
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ];

  for (const weekend of weekends) {
    const { title } = weekendLabel(weekend, weekend.round);
    // Stable UIDs: <slug>-<round>-<sessionKey>@host. The dedupe counter runs
    // over EVERY session in the weekend (including ones the recent-past window
    // drops) so a session's UID never shifts as the window advances — a UID
    // change would duplicate the event in subscribed clients. Round 0
    // (non-championship weekends: tests, exhibitions) keys by weekend date
    // instead, since several round-0 weekends can coexist in a season.
    const seen = new Map<string, number>();
    for (const session of weekend.sessions) {
      const key = sessionSlug(session.title) || 'session';
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      if (!Number.isFinite(session.start.getTime())) continue;
      if (session.start.getTime() < cutoff) continue;

      const base =
        weekend.round >= 1
          ? `${slug}-${weekend.round}-${key}`
          : `${slug}-r0-${weekend.key}-${key}`;
      const uid = `${n > 1 ? `${base}-${n}` : base}@${host}`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      const endMs = session.end?.getTime() ?? NaN;
      if (session.dateOnly) {
        // No real clock time is known (DTSTART;VALUE=DATE upstream) — emit an
        // all-day event rather than inventing a midnight time (UI rule).
        const startDay = formatDateValue(session.start);
        let endDay = endMs > session.start.getTime() ? formatDateValue(session.end) : startDay;
        // DTEND for DATE values is exclusive; a same-day event ends next day.
        if (endDay === startDay) {
          endDay = formatDateValue(new Date(session.start.getTime() + DAY_MS));
        }
        lines.push(`DTSTART;VALUE=DATE:${startDay}`);
        lines.push(`DTEND;VALUE=DATE:${endDay}`);
      } else {
        lines.push(`DTSTART:${formatUtcStamp(session.start)}`);
        if (endMs > session.start.getTime()) {
          lines.push(`DTEND:${formatUtcStamp(session.end)}`);
        }
      }
      lines.push(`SUMMARY:${escapeIcsText(session.title)}`);
      if (session.location) lines.push(`LOCATION:${escapeIcsText(session.location)}`);
      if (weekend.round >= 1) {
        const url = `${SITE_URL}/series/${slug}/weekend/${weekend.round}`;
        lines.push(`DESCRIPTION:${escapeIcsText(`${title} — schedule, weather and results: ${url}`)}`);
        lines.push(`URL:${url}`);
      }
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
