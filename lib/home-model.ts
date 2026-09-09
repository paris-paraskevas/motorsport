import 'server-only';
import { cache } from 'react';
import { loadAllSeries } from '@/lib/series';
import { groupByDay, groupByWeekend } from '@/lib/group';
import { DAY_MS } from '@/lib/rounds';
import { weekendLabel, weekendStartEnd } from '@/lib/weekend';
import { fetchAggregatedNews } from '@/lib/news';
import { fetchLatestPodium, HOME_RESULTS_SLUGS, type LatestRace } from '@/lib/home-results';
import { fetchStandingsBrief, isEligibleStandingsSeries } from '@/lib/standings/brief';
import { fetchHomeBlogLead, publishedPosts } from '@/lib/blog';
import { loadLiveHomeLayout, pinnedLeadSlug, visibleBlocks, type HomeLayout } from '@/lib/home-layout';
import { loadSettings } from '@/lib/design/settings';
import { DEFAULT_SETTINGS } from '@/lib/design/setting-defaults';
import type {
  HomeLeadBlog,
  HomeLeadChanged,
  HomeLeadAlsoRacing,
  HomeLeadLiveWeekend,
  HomeLeadNextItem,
  HomeLeadResult,
  HomeLeadWireItem,
} from '@/components/HomeLead';
import type { HomeBlockId } from '@/lib/home-layout';

// Everything the home page renders, assembled once. Extracted from
// app/(app)/app/page.tsx in 0.334.24 because the admin composer needs the SAME
// data to preview a draft layout, and two copies of a 250-line assembly would
// drift — the preview would stop being a preview. Both callers now build the
// page from this one function, so the composer's preview IS the page.
//
// The layout only ever SELECTS and ORDERS. Nothing here invents content for a
// block, and every band still fails soft to null / empty on its own.

export interface HomeModel {
  blog: HomeLeadBlog | null;
  /** Every live weekend that earns its own box: F1 first, then the named
   *  majors by soonest next session. See the selection block for the why. */
  liveWeekends: HomeLeadLiveWeekend[];
  /** Live weekends that do not get a box, as one compact row. */
  alsoRacing: HomeLeadAlsoRacing[];
  result: HomeLeadResult | null;
  changed: HomeLeadChanged | null;
  next: HomeLeadNextItem[];
  wire: HomeLeadWireItem[];
  /** Block ids to render, in the operator's order, hidden ones already removed. */
  order: HomeBlockId[];
}

// OPERATOR DECISION, 2026-09-04. Home-page precedence used to be purely
// temporal, with no series ever preferred by name. On Italian Grand Prix Friday
// that put FORMULA 3 in the hero band, because F3's qualifying happened to come
// before F1's second practice, and the Grand Prix appeared nowhere on the page.
// Since 1.0.44 the names are Application Settings (`home.lead_series`,
// `home.major_series`, lib/design/setting-defaults.ts) and the values below are
// what the code ships and falls back to.
export interface HomePriority {
  /** The series that always leads the live band when it is running. */
  lead: string;
  /** The series that earn their own box when running. */
  majors: readonly string[];
}
const SHIPPED_PRIORITY: HomePriority = {
  lead: DEFAULT_SETTINGS['home.lead_series'],
  majors: DEFAULT_SETTINGS['home.major_series'],
};

/**
 * Decide which live weekends get their own box and in what order.
 *
 * The lead series always leads when it is running. Each of the other
 * championships named as majors gets its own box, ordered by whichever has
 * the next session SOONEST — the reader's question is "what is about to
 * happen", so a series with nothing left to run sinks rather than jumping the
 * queue. Everything else goes to `also`, which the page renders as one compact
 * row so a busy Saturday cannot bury the lead story behind seven boxes.
 *
 * `candidates` must already be sorted by weekend start, which is what the
 * fallback relies on.
 *
 * Pure and exported so the ranking can be tested without loading every series.
 */
export function rankLiveWeekends<T extends { slug: string; nextStartMs: number }>(
  candidates: readonly T[],
  priority: HomePriority = SHIPPED_PRIORITY,
): { featured: T[]; also: T[] } {
  const lead = candidates.filter(c => c.slug === priority.lead);
  const majors = candidates
    .filter(c => priority.majors.includes(c.slug))
    .sort((a, b) => a.nextStartMs - b.nextStartMs);

  let featured = [...lead, ...majors];
  // Nothing named is running, so the band would be empty on a weekend that is
  // demonstrably busy. Fall back to the old behaviour: feature the weekend that
  // started soonest, whatever series it belongs to.
  if (featured.length === 0 && candidates.length > 0) featured = [candidates[0]];

  const chosen = new Set<T>(featured);
  const also = candidates.filter(c => !chosen.has(c)).sort((a, b) => a.nextStartMs - b.nextStartMs);
  return { featured, also };
}

function ageLabel(pubDate: Date, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - pubDate.getTime()) / 60000));
  if (mins < 90) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** The wire's rows: the newest `count` aggregated headlines, source named, the
 *  series resolved to its name and colour. Shared by the page's assembly and
 *  by The wire component, which may ask for more than the page setting. */
export async function buildWire(count: number, metaBySlug: ReadonlyMap<string, { name: string; color: string }>, now = new Date()): Promise<HomeLeadWireItem[]> {
  const rawNews = await fetchAggregatedNews();
  return rawNews
    .slice()
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, count)
    .flatMap(item => {
      const meta = metaBySlug.get(item.seriesSlug);
      if (!meta) return [];
      let sourceHost = 'source';
      try {
        sourceHost = new URL(item.link).hostname.replace(/^www\./, '');
      } catch {
        /* keep the fallback label */
      }
      return [{
        title: item.title,
        link: item.link,
        sourceHost,
        ageLabel: ageLabel(item.pubDate, now),
        seriesName: meta.name,
        seriesColor: meta.color,
      }];
    });
}

/** The page's assembly once per request (React's cache), so the home route and
 *  the components a revision places both read the same model. */
export const loadHomeModel = cache(async (): Promise<HomeModel> => buildHomeModel(await loadLiveHomeLayout()));

/** The series metadata by slug, for a component that resolves names and colours itself. */
export const loadSeriesMeta = cache(async (): Promise<Map<string, { name: string; color: string }>> => {
  const all = await loadAllSeries();
  return new Map(all.map(s => [s.meta.slug, { name: s.meta.name, color: s.meta.color }]));
});

export async function buildHomeModel(layout: HomeLayout, now = new Date()): Promise<HomeModel> {
  const all = await loadAllSeries();
  const metaBySlug = new Map(all.map(s => [s.meta.slug, s.meta]));
  // The operator's named values (the designer's Application Settings), the
  // shipped ones on any failure: which series lead, and how long two bands are.
  const settings = await loadSettings();

  // ── 0. Happening now: the weekend whose session window straddles `now`. This
  // outranks the finished-result lead below — on Dutch GP Sunday the page led
  // with a Formula E finale that ended five days earlier, because "newest race
  // with a podium" has no concept of a weekend being underway. Live = not past,
  // AND first session already started or starting inside 24h, AND the last
  // session not yet over. This step is purely temporal and finds EVERY live
  // weekend; which of them earn a box, and in what order, is decided in 0a
  // below and is now editorial (it was not before 2026-09-04 — see there).
  // NOT lib/weekend.ts weekendIsLive(): that is `start <= now <= end` on a
  // single session, i.e. "a session is running this second". This band must also
  // catch the Friday morning before FP1 has turned a wheel, hence the DAY_MS
  // lookahead. Do not "simplify" one into the other — they answer different
  // questions, and the band would go dark between sessions.
  const liveCandidates = all
    .flatMap(s => {
      try {
        return groupByWeekend(s.sessions, now, s.rounds)
          .filter(w => !w.isPast)
          .flatMap(w => {
            const { start, end } = weekendStartEnd(w);
            return start.getTime() <= now.getTime() + DAY_MS && end >= now ? [{ s, w, start }] : [];
          });
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // ── 0a. Which live weekends get a box, and in what order. The ranking itself
  // lives in `rankLiveWeekends` above, pure and tested; this only feeds it.
  //
  // A dateOnly session has no real hour (lib/types.ts, Session.dateOnly), so it
  // can never be a timed "next up" or an "also today" row — both carry a clock
  // time to the client.
  //
  // Earliest session that has NOT finished — `end > now`, not `start > now`. A
  // running session must stay selected, otherwise the band skips straight past
  // it to the following one and the LIVE pill can never fire while a session is
  // actually on track.
  const nextTimed = (cand: (typeof liveCandidates)[number]) =>
    cand.w.sessions
      .filter(x => !x.dateOnly && x.end > now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null;

  const ranked = rankLiveWeekends(
    liveCandidates.map(c => ({
      cand: c,
      slug: c.s.meta.slug,
      nextStartMs: nextTimed(c)?.start.getTime() ?? Number.POSITIVE_INFINITY,
    })),
    { lead: settings['home.lead_series'], majors: settings['home.major_series'] },
  );

  const liveWeekends: HomeLeadLiveWeekend[] = ranked.featured.map(({ cand: live }) => {
    const timed = live.w.sessions.filter(x => !x.dateOnly);
    const nextUp = nextTimed(live);
    return {
      seriesSlug: live.s.meta.slug,
      seriesName: live.s.meta.name,
      color: live.s.meta.color,
      eventName: weekendLabel(live.w, live.w.round).title,
      href: `/series/${live.s.meta.slug}/weekend/${live.w.round}`,
      // Full session titles, not shortSessionLabel's FP1/SQ chips: that helper
      // is built for the cramped session rail, and "SQ" is opaque in a hero
      // band. The operator's reference build spells them out ("F1 - Sprint
      // Qualifying"), and the ICS SUMMARY already reads that way.
      nextSession: nextUp
        ? {
            name: nextUp.title,
            startIso: nextUp.start.toISOString(),
            // The client uses this to flip the countdown into a LIVE pill; the
            // server never decides liveness, because ISR would bake it stale.
            endIso: nextUp.end.toISOString(),
          }
        : null,
      // Same session day as `nextUp`, by the same day-bucketing every other
      // schedule surface uses (groupByDay; the repo has no per-venue timezone
      // data — circuits.json carries lat/lon only and Open-Meteo resolves the
      // zone itself at request time).
      // Still to come only. Without the `start > now` guard a session that has
      // already run stays listed as upcoming — once FP1 starts, it would sit
      // beside Sprint Qualifying reading as though it were still to come.
      //
      // NOT "also today": this is `nextUp`'s day, and on a Friday evening that
      // is Saturday. The heading is named by SessionDayNote from `alsoDayIso`,
      // in the browser, because only the device knows what "today" is.
      alsoSameDay: nextUp
        ? (groupByDay(timed).find(d => d.sessions.some(x => x.uid === nextUp.uid))?.sessions ?? [])
            .filter(x => x.uid !== nextUp.uid && x.start > now)
            .map(x => ({ name: x.title, startIso: x.start.toISOString() }))
        : [],
      alsoDayIso: nextUp ? nextUp.start.toISOString().slice(0, 10) : null,
    };
  });

  // Everything else that is racing, already ordered by soonest session. A
  // weekend with no timed session left to run is dropped rather than listed
  // with no time beside it.
  const alsoRacing: HomeLeadAlsoRacing[] = ranked.also
    .map(({ cand: c }) => ({ c, up: nextTimed(c) }))
    .flatMap(({ c, up }) =>
      up
        ? [
            {
              seriesSlug: c.s.meta.slug,
              seriesName: c.s.meta.name,
              color: c.s.meta.color,
              eventName: weekendLabel(c.w, c.w.round).title,
              href: `/series/${c.s.meta.slug}/weekend/${c.w.round}`,
              sessionName: up.title,
              startIso: up.start.toISOString(),
            },
          ]
        : [],
    );

  // ── 1. The result that just happened: newest finished race across every
  // covered series (KV-warmed feeds; fail-soft nulls just drop the band). ──
  const latest = (
    await Promise.all(
      HOME_RESULTS_SLUGS.map(async slug => {
        const race = await fetchLatestPodium(slug);
        return race ? { slug, race } : null;
      }),
    )
  )
    .filter((x): x is { slug: string; race: LatestRace } => x !== null)
    .sort((a, b) => new Date(b.race.date).getTime() - new Date(a.race.date).getTime())[0];

  let result: HomeLeadResult | null = null;
  if (latest) {
    const meta = metaBySlug.get(latest.slug);
    const p2 = latest.race.podium.find(p => p.position === 2);
    if (meta) {
      result = {
        seriesSlug: latest.slug,
        seriesName: meta.name,
        color: meta.color,
        raceName: latest.race.raceName,
        round: latest.race.round,
        dateIso: latest.race.date,
        podium: latest.race.podium,
        // Only a value that reads as a gap is a margin (winner rows carry
        // total time; some feeds carry status strings instead).
        margin: p2?.time && p2.time.startsWith('+') ? p2.time : undefined,
        weekendHref: `/series/${latest.slug}/weekend/${latest.race.round}`,
      };
    }
  }

  // ── 2. What it changed: the lead series' championship top-5 + leader gap. ──
  let changed: HomeLeadChanged | null = null;
  if (result && isEligibleStandingsSeries(result.seriesSlug)) {
    const meta = metaBySlug.get(result.seriesSlug);
    const brief = meta ? await fetchStandingsBrief(result.seriesSlug, meta.season) : null;
    if (brief && brief.top.length > 0) {
      // No weekend left to run in the lead series → the table is final, so the
      // headline crowns a champion instead of naming a leader (the FE finale
      // read "leads by 5 points" days after the title was decided).
      const leadSeries = all.find(s => s.meta.slug === result.seriesSlug);
      const leadWeekends = (() => {
        try {
          return leadSeries && !leadSeries.meta.singleEvent
            ? groupByWeekend(leadSeries.sessions, now, leadSeries.rounds)
            : [];
        } catch {
          return [];
        }
      })();
      const seasonComplete =
        leadWeekends.length > 0 && !leadWeekends.some(w => !w.isPast && w.sessions.some(x => x.end >= now));
      changed = {
        seriesName: result.seriesName,
        leader: brief.leader,
        gapToSecond: brief.gapToSecond,
        top: brief.top,
        winnerName: result.podium.find(p => p.position === 1)?.name,
        seasonComplete,
      };
    }
  }

  // ── 3. What's next: the next three weekends across all series. ──
  const upcomingWeekends = all
    .flatMap(s => {
      try {
        return groupByWeekend(s.sessions, now, s.rounds)
          .filter(w => !w.isPast && w.sessions.some(x => x.end >= now))
          .map(w => ({ s, w, firstStart: w.sessions.reduce((min, x) => (x.start < min ? x.start : min), w.sessions[0].start) }));
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.firstStart.getTime() - b.firstStart.getTime())
    .slice(0, 3);

  const next: HomeLeadNextItem[] = upcomingWeekends.map(({ s, w, firstStart }) => ({
    seriesSlug: s.meta.slug,
    seriesName: s.meta.name,
    color: s.meta.color,
    title: weekendLabel(w, w.round).title,
    dateRangeLabel: w.dateRangeLabel,
    firstStartIso: firstStart > now ? firstStart.toISOString() : null,
    href: `/series/${s.meta.slug}/weekend/${w.round}`,
  }));

  // ── 4. The wire: the newest aggregated headlines, source named; how many is
  // the `home.wire_count` setting (five shipped). ──
  const wire = await buildWire(settings['home.wire_count'], metaBySlug, now);

  // ── 5. Our own writing: the pinned post if the operator chose one, else the
  // newest. The fetcher returns a series SLUG and only this layer holds the
  // series metadata, so the name and colour for the card's chip are resolved
  // here. Fail-soft — a Supabase outage drops the band, it never blanks the
  // page — and a pin that no longer resolves falls back to the automatic lead
  // rather than leaving a hole.
  let blog: HomeLeadBlog | null = null;
  try {
    const pinned = pinnedLeadSlug(layout);
    const lead = (pinned ? await fetchHomeBlogLead(pinned) : null) ?? (await fetchHomeBlogLead());
    if (lead) {
      const meta = lead.seriesSlug ? metaBySlug.get(lead.seriesSlug) : undefined;
      const stamp = new Date(lead.publishedAtIso);
      // Further reading beside the cover, as many as the
      // `home.blog_suggested_count` setting says (three shipped). A second read
      // of the same table, but publishedPosts() is the warm path /blog and the
      // feed already use and the table is a couple of dozen rows; the
      // alternative was duplicating fetchHomeBlogLead's ordering rules here.
      const suggested = (await publishedPosts())
        .filter(p => p.slug !== lead.slug)
        .slice(0, settings['home.blog_suggested_count'])
        .map(p => ({ slug: p.slug, title: p.title, heroImage: p.heroImage ?? null }));
      blog = {
        ...lead,
        seriesName: meta?.name ?? null,
        seriesColor: meta?.color ?? null,
        // Same relative stamp the wire rows use, so a fresh post reads as news.
        ageLabel: Number.isNaN(stamp.getTime()) ? null : ageLabel(stamp, now),
        suggested,
      };
    }
  } catch {
    /* no blog lead this revalidation */
  }

  return { blog, liveWeekends, alsoRacing, result, changed, next, wire, order: visibleBlocks(layout) };
}
