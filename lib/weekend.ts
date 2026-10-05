import { Series, Session, Weekend } from './types';
import { groupByWeekend } from './group';
import { fitTitle } from './site';

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

/** B2 put the Honda Indy 200 at Mid-Ohio at IndyCar's round 11 and moved the rounds from Music City on to 12–18, so an
 *  address written before it names the same session one round early; the session page sends it on (X14). The table
 *  names the renumbered span per series; nothing else is touched. */
export const RENUMBERED_ROUNDS: Readonly<Record<string, { from: number; to: number; shift: number }>> = {
  indycar: { from: 11, to: 17, shift: 1 },
};

/** The round a session slug moved to, or null: only for a series in RENUMBERED_ROUNDS, a round inside its span, a slug
 *  absent at the asked round (or an unknown round) and present at the shifted one. A slug both rounds share (a practice)
 *  stays where it was asked. */
export function renumberedSessionTarget(series: Series, round: number, slug: string, now: Date = new Date()): number | null {
  const rule = RENUMBERED_ROUNDS[series.meta.slug];
  if (!rule || round < rule.from || round > rule.to) return null;
  const asked = weekendFor(series, round, now);
  if (asked && sessionBySlug(asked, slug)) return null;
  const moved = weekendFor(series, round + rule.shift, now);
  return moved && sessionBySlug(moved, slug) ? round + rule.shift : null;
}

/** The series whose weekend schedules link their session pages, and whose session pages the sitemap lists (X13). The
 *  session route answers every series; NLS and the ADAC 24h have no race session pages worth a link and stay off. */
export const SESSION_PAGE_SERIES = ['f1', 'f2', 'f3', 'formula-e', 'indycar', 'motogp', 'wsbk', 'nascar-cup', 'wec', 'imsa', 'gt-world', 'wrc', 'dtm'] as const;

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

// X10 (the Seobility crawl of 1 October 2026): the <title> of a session page and of a weekend page, fitted under the
// layout's suffix by lib/site.ts (the round once, the series once, never a word twice, never cut mid-word). A label the feed
// prefixed with its own series name ("WRC | Rally Italia Sardegna") loses the prefix; a label too wide for the budget gives
// way to the weekend's place ("Spa-Francorchamps" for "TotalEnergies 6 Hours of Spa-Francorchamps"); a label that is only
// "Round n" names the series and the number instead.
const LABEL_PREFIX_RE = /^(?:f[123]|formula\s*[123e]|fia\s+wec|wec|gt\s*world(?:\s+challenge)?|gtwce|imsa|indycar|nascar(?:\s+cup)?|dtm|nls(?:\s+nürburgring)?|wsbk|worldsbk|motogp|wrc|adac(?:\s+ravenol)?(?:\s+24h)?(?:\s+nürburgring)?)\s*[:|\-–—·]\s*/i;
const ROUND_ONLY_RE = /^round\s+\d+$/i;
/** A round's label without the feed's series prefix, a leading "Round n ·" or a trailing " Round" (DTM's and WorldSBK's
 *  "Red Bull Ring Round", which would repeat the word beside the round number). */
export function roundShortLabel(label: string): string {
  return label.replace(LABEL_PREFIX_RE, '').replace(/^round\s+\d+\s*[:|\-–—·]\s*/i, '').replace(/\s+round$/i, '').trim();
}
/** The names a session page may carry beside its session: the series' full name, then the feed's own short code ("F2" from
 *  "F2 - Qualifying": the support series share Formula 1's round names, so the series must survive where the full name
 *  does not fit), each with and without the round's name. */
export function sessionPageTitle(seriesName: string, weekendTitle: string, sessionName: string, round: number, place?: string, seriesShort?: string, kind?: 'race' | 'none'): string {
  const roundShort = roundShortLabel(weekendTitle);
  // The session's own name loses the feed's series prefix too ("IndyCar | Laguna Seca"); a code is one word of letters.
  const session = roundShortLabel(sessionName) || sessionName.trim();
  const code = seriesShort?.trim();
  const short = code && /^[A-Za-z0-9]{1,8}$/.test(code) && code.toLowerCase() !== seriesName.toLowerCase() ? code : undefined;
  const names = short ? [seriesName, short] : [seriesName];
  const withRound = (label: string, s = session) => [...names.map(n => `${s}, ${label} — ${n}`), ...names.map(n => `${s} · ${n} round ${round}`), `${s}, ${label}`, `${s} · round ${round}`];
  const spotName = place?.trim() && place.trim().toLowerCase() !== roundShort.toLowerCase() ? place.trim() : undefined;
  if (!roundShort || ROUND_ONLY_RE.test(roundShort)) {
    return fitTitle([...(spotName ? names.map(n => `${session}, ${spotName} — ${n}`) : []), ...names.map(n => `${session} · ${n} round ${round}`), ...(spotName ? [`${session}, ${spotName}`] : []), `${session} · round ${round}`]);
  }
  const a = session.toLowerCase();
  const b = roundShort.toLowerCase();
  // The round's name inside the session's ("6 Hours of Fuji (Race)", "Free Training (NLS1 71st ADAC Westfalenfahrt)"): the
  // session keeps what is its own ("Race", "Free Training"); a session that IS the round ("Rally Italia Sardegna") or sits
  // inside the round's name ("Bass Pro Shops Night Race" in "… (Bristol)") lets the round speak for it.
  const own = a.includes(b) ? session.replace(new RegExp(`\\(?[^()]*${roundShort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^()]*\\)?`, 'i'), '').replace(/\s+/g, ' ').trim().replace(/^\((.*)\)$/, '$1') : session;
  if (!own || b.includes(a)) {
    const [longer, shorter] = roundShort.length >= session.length ? [roundShort, session] : [session, roundShort];
    // An event-named session IS the race in every series but a rally's (the feeds name IndyCar's, NASCAR's and IMSA's race
    // after the event, with or without the word): it says so, and its title never equals its weekend page's.
    const word = kind === 'none' ? undefined : 'race';
    const said = word ? [...names.map(n => `${shorter} ${word} — ${n}`), `${shorter} ${word}`, ...names.map(n => `${shorter} ${word} · ${n} round ${round}`)] : [];
    // When even the event's name with the word is too wide, the race keeps the series and the round number before the bare
    // name is allowed, so the pair still reads apart.
    const bare = word ? [...names.map(n => `${word[0].toUpperCase()}${word.slice(1)} · ${n} round ${round}`)] : [];
    const weekendTitleHere = weekendPageTitle(seriesName, weekendTitle, round, place);
    const own2 = [...said, ...names.map(n => `${longer} — ${n}`), ...names.map(n => `${shorter} — ${n}`), longer, shorter].filter(v => v !== weekendTitleHere);
    return fitTitle([...own2, ...bare]);
  }
  const variants = withRound(roundShort, own);
  const spot = spotName ? [...names.map(n => `${own}, ${spotName} — ${n}`), `${own}, ${spotName}`] : [];
  return fitTitle([...variants.slice(0, names.length * 2), ...spot, ...variants.slice(names.length * 2)]);
}
export function weekendPageTitle(seriesName: string, label: string, round: number, place?: string): string {
  const short = roundShortLabel(label);
  const spot = place?.trim() && place.trim().toLowerCase() !== short.toLowerCase() ? [`${place.trim()} — ${seriesName} round ${round}`, `${place.trim()} — ${seriesName}`] : [];
  if (!short || ROUND_ONLY_RE.test(short)) return fitTitle([...spot, `${seriesName} round ${round}`]);
  return fitTitle([`${short} — ${seriesName} round ${round}`, `${short} — ${seriesName}`, `${short} — round ${round}`, ...spot, short, `${seriesName} round ${round}`]);
}

// X12 (the Seobility crawl's "link anchor text duplicates for different pages"): the identity a link to a weekend or a
// session page carries for a crawler and a screen reader, printed after the visible label in a visually hidden span.
// Seobility judges a link text site-wide, so "FP1" leading to 97 pages is one fault on every page that carries the rail.
// A weekend is its series and its round's name ("Formula 1 Azerbaijan Grand Prix": 17 round names are shared by two to
// four series), the number when the label is only "Round n"; a session is the feed's title whole, then its weekend
// ("F1 - Qualifying, Formula 1 Azerbaijan Grand Prix": the title is what tells DTM's two qualifyings apart).
export function weekendAnchorName(seriesName: string, weekendTitle: string, round: number): string {
  const short = roundShortLabel(weekendTitle);
  if (!short || ROUND_ONLY_RE.test(short)) return `${seriesName} round ${round}`;
  return short.toLowerCase().startsWith(`${seriesName.toLowerCase()} `) ? short : `${seriesName} ${short}`;
}
export function sessionAnchorName(seriesName: string, weekendTitle: string, round: number, sessionTitle: string): string {
  const title = sessionTitle.trim();
  const short = roundShortLabel(weekendTitle);
  // A session named after its event ("IndyCar - Big Machine Music City Grand Prix") already carries the weekend: the
  // name is not said twice (Seobility flags a link text over about 120 characters as too long).
  if (short && !ROUND_ONLY_RE.test(short) && title.toLowerCase().includes(short.toLowerCase())) {
    return title.toLowerCase().includes(seriesName.toLowerCase()) ? title : `${title}, ${seriesName}`;
  }
  return `${title}, ${weekendAnchorName(seriesName, weekendTitle, round)}`;
}
