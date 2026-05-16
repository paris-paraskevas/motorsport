import { Series, Session, Weekend } from './types';
import { groupByWeekend } from './group';

const SESSION_SUFFIX_RE =
  /[\s\-–—|:]+\s*(practice\s*\d*|fp\s*\d|free practice\s*\d*|qualifying|qualif\.?|sprint(?:\s+(?:race|qualifying|qualif\.?))?|race(?:\s*\d)?|warm[\s-]?up|test|tt)\s*\d*\s*$/i;
const SERIES_PREFIX_RE = /^(?:f[12345]|motogp|moto2|moto3|fe|formula\s*e|wec|wsbk|imsa|dtm|wrc)\s*[:|\-–—]?\s*/i;

export function weekendLabel(weekend: Weekend, round: number): {
  title: string;
  subtitle?: string;
} {
  const location = weekend.sessions.find(s => s.location)?.location;
  const locationShort = location?.split(',')[0].trim() || undefined;
  const hint = deriveTitleHint(weekend.sessions[0]?.title);
  const title =
    weekend.label || weekend.roundName || locationShort || hint || `Round ${round}`;
  const subtitle =
    locationShort && weekend.label && weekend.label !== locationShort
      ? locationShort
      : undefined;
  return { title, subtitle };
}

export function deriveTitleHint(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(SERIES_PREFIX_RE, '').replace(SESSION_SUFFIX_RE, '').trim();
  if (!cleaned || cleaned === raw || cleaned.length <= 2) return undefined;
  return cleaned;
}

export function weekendFor(series: Series, round: number, now: Date = new Date()): Weekend | null {
  if (!Number.isInteger(round) || round < 1) return null;
  const weekends = groupByWeekend(series.sessions, now, series.rounds);
  return weekends.find(w => w.round === round) ?? null;
}

export function roundForSession(weekends: Weekend[], uid: string): number | undefined {
  for (const w of weekends) {
    if (w.sessions.some(s => s.uid === uid)) return w.round;
  }
  return undefined;
}

function lookupKey(seriesSlug: string, uid: string): string {
  return `${seriesSlug}:${uid}`;
}

export function buildRoundLookup(series: Series, now: Date = new Date()): Map<string, number> {
  const out = new Map<string, number>();
  const weekends = groupByWeekend(series.sessions, now, series.rounds);
  for (const w of weekends) {
    for (const s of w.sessions) {
      out.set(lookupKey(series.meta.slug, s.uid), w.round);
    }
  }
  return out;
}

export function buildRoundLookupAcrossSeries(
  allSeries: Series[],
  now: Date = new Date(),
): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of allSeries) {
    const single = buildRoundLookup(s, now);
    for (const [k, v] of single) out.set(k, v);
  }
  return out;
}

export function roundFor(lookup: Map<string, number>, seriesSlug: string, uid: string): number | undefined {
  return lookup.get(lookupKey(seriesSlug, uid));
}

export function weekendHref(seriesSlug: string, round: number): string {
  return `/series/${seriesSlug}/weekend/${round}`;
}

export function weekendStartEnd(weekend: Weekend): { start: Date; end: Date } {
  const sorted = [...weekend.sessions].sort((a, b) => a.start.getTime() - b.start.getTime());
  return { start: sorted[0].start, end: sorted[sorted.length - 1].end };
}

export function weekendIsLive(weekend: Weekend, now: Date = new Date()): boolean {
  return weekend.sessions.some(s => !s.dateOnly && s.start <= now && now <= s.end);
}

export function liveSessionsIn(weekend: Weekend, now: Date = new Date()): Session[] {
  return weekend.sessions.filter(s => !s.dateOnly && s.start <= now && now <= s.end);
}
