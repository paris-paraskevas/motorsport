import { Series, Session, Weekend } from './types';
import { groupByWeekend } from './group';

const SESSION_SUFFIX_RE =
  /[\s\-–—|:]+\s*(practice\s*\d*|fp\s*\d|free practice\s*\d*|qualifying|qualif\.?|sprint(?:\s+(?:race|qualifying|qualif\.?))?|race(?:\s*\d)?|warm[\s-]?up|test|tt)\s*\d*\s*$/i;
const SERIES_PREFIX_RE = /^(?:f[12345]|motogp|moto2|moto3|fe|formula\s*e|wec|wsbk|imsa|gtwce|dtm|wrc)\s*[:|\-–—]?\s*/i;

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

/**
 * URL slug for a session within its weekend — "F1 - Practice 1" →
 * "practice-1", "MotoGP: Sprint" → "sprint". The series prefix is stripped
 * so slugs read clean and match OpenF1's session names where they exist
 * (per-session pages, W1c).
 */
export function sessionSlug(title: string): string {
  return title
    .replace(SERIES_PREFIX_RE, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** First session in the weekend whose slug matches; null when absent. */
export function sessionBySlug(weekend: Weekend, slug: string): Session | null {
  return weekend.sessions.find(s => sessionSlug(s.title) === slug) ?? null;
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

export function weekendStartEnd(weekend: Weekend): { start: Date; end: Date } {
  const sorted = [...weekend.sessions].sort((a, b) => a.start.getTime() - b.start.getTime());
  return { start: sorted[0].start, end: sorted[sorted.length - 1].end };
}

/** The next session the Countdown (P2.8) draws: one series' or the nearest across several. The weekend is the series'
 *  first not past with a session still to end (the weekend pages' and the Weekends source's rule); the session is the timed
 *  one under way or next to start (Home's rule, lib/home-model.ts nextTimed), so a running session reads LIVE until its end
 *  rather than vanishing; `null` for a weekend whose remaining sessions carry no clock (a rally with hours to be confirmed),
 *  which is still the next weekend. The curated round's venue rides along for the circuit lookup (the 2026 Bahrain Grand
 *  Prix at Sepang: lib/types.ts SeriesRoundEntry.venue). */
export interface NextSession {
  series: { slug: string; name: string; color: string };
  weekend: { round: number; title: string; dateRangeLabel: string; href: string; venue?: string; location?: string };
  session: { title: string; slug: string; start: Date; end: Date } | null;
}

/** The series' next weekend, for the Countdown and the Weather (P2.8, P2.14): the first not past with a session still to end
 *  (the weekend pages' and the Weekends source's rule); null when nothing is to come or the grouping throws, so a broken feed
 *  contributes nothing, as the Weekends reader has it. */
export function nextWeekend(series: Series, now: Date = new Date()): Weekend | null {
  let weekends: Weekend[];
  try {
    weekends = groupByWeekend(series.sessions, now, series.rounds);
  } catch {
    return null;
  }
  return weekends.find(x => !x.isPast && x.sessions.some(x2 => x2.end >= now)) ?? null;
}

export function nextSessionAcross(series: readonly Series[], now: Date = new Date()): NextSession | null {
  const found: { at: number; next: NextSession }[] = [];
  for (const s of series) {
    const w = nextWeekend(s, now);
    if (!w) continue;
    const timed = w.sessions.filter(x => !x.dateOnly && x.end > now).sort((a, b) => a.start.getTime() - b.start.getTime());
    const session = timed[0] ?? null;
    const round = s.rounds?.rounds?.find(r => r.round === w.round);
    found.push({
      at: session ? session.start.getTime() : weekendStartEnd(w).start.getTime(),
      next: {
        series: { slug: s.meta.slug, name: s.meta.name, color: s.meta.color },
        weekend: {
          round: w.round,
          title: weekendLabel(w, w.round).title,
          dateRangeLabel: w.dateRangeLabel,
          href: `/series/${s.meta.slug}/weekend/${w.round}`,
          venue: round?.venue,
          // The weekend page's rule for the circuit lookup: the first session of the weekend that names a location.
          location: w.sessions.find(x => x.location)?.location,
        },
        session: session ? { title: session.title, slug: sessionSlug(session.title), start: session.start, end: session.end } : null,
      },
    });
  }
  found.sort((a, b) => a.at - b.at);
  return found[0]?.next ?? null;
}

export function weekendIsLive(weekend: Weekend, now: Date = new Date()): boolean {
  return weekend.sessions.some(s => !s.dateOnly && s.start <= now && now <= s.end);
}

/** Compact label for the session rail — fans think in FP1 / QUALI / RACE. */
export function shortSessionLabel(title: string): string {
  const cleaned = title.replace(/^.*?[-–—:]\s*/, '').trim() || title;
  const m = cleaned.match(/^(?:free\s+)?practice\s*(\d)/i);
  if (m) return `FP${m[1]}`;
  if (/^fp\s*(\d)/i.test(cleaned)) return cleaned.toUpperCase().replace(/\s+/g, '');
  if (/sprint\s+(qualifying|shootout)/i.test(cleaned)) return 'SQ';
  if (/^sprint/i.test(cleaned)) return 'SPRINT';
  if (/qualifying|superpole/i.test(cleaned)) return 'QUALI';
  if (/warm[\s-]?up/i.test(cleaned)) return 'WARM-UP';
  if (/^race\s*(\d)/i.test(cleaned)) return cleaned.toUpperCase().replace(/\s+/g, ' ');
  if (/^race/i.test(cleaned)) return 'RACE';
  return cleaned.toUpperCase().slice(0, 14);
}

/**
 * The weekend's sessions in running order, each with its page href — the
 * session-tab generator (series contract, rule 1): tabs come from the round's
 * REAL sessions, strictly chronological (DTM's Q2 runs after Race 1 and must
 * order that way), labelled in the series' own words. A session that doesn't
 * exist is simply absent. Slug collisions within a weekend (two
 * identically-titled sessions) resolve to the first occurrence — acceptable;
 * titles are unique in practice.
 */
export function weekendSessionNav(
  weekend: Weekend,
  slug: string,
  round: number,
  currentUid: string,
) {
  const ordered = [...weekend.sessions].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const items = ordered.map(s => ({
    uid: s.uid,
    label: shortSessionLabel(s.title),
    title: s.title,
    href: `/series/${slug}/weekend/${round}/${sessionSlug(s.title)}`,
    isCurrent: s.uid === currentUid,
  }));
  const idx = items.findIndex(i => i.isCurrent);
  return {
    items,
    prev: idx > 0 ? items[idx - 1] : null,
    next: idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null,
  };
}
