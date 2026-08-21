import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { groupByDay, groupByWeekend } from '@/lib/group';
import { DAY_MS } from '@/lib/rounds';
import { weekendLabel, weekendStartEnd } from '@/lib/weekend';
import { fetchAggregatedNews } from '@/lib/news';
import { fetchLatestPodium, HOME_RESULTS_SLUGS, type LatestRace } from '@/lib/home-results';
import { fetchStandingsBrief, isEligibleStandingsSeries } from '@/lib/standings/brief';
import { fetchHomeBlogLead } from '@/lib/blog';
import {
  HomeLead,
  type HomeLeadBlog,
  type HomeLeadChanged,
  type HomeLeadLiveWeekend,
  type HomeLeadNextItem,
  type HomeLeadResult,
  type HomeLeadWireItem,
} from '@/components/HomeLead';
import { PAGE_WIDE } from '@/lib/site';

export const revalidate = 300;

// The editorial home (design handoff §4.1): four fixed server-rendered blocks —
// the result that just happened, what it changed, what's next, the wire. The
// eighteen-widget gallery this replaced (HomeContent) is retired: full cutover,
// operator decision 2026-08-18; the deletion sweep is a follow-up PR. Follows
// stay device-local for now, so the lead is built from ALL series — identical
// for every visitor, which is also what keeps this page ISR-cacheable.

export const metadata: Metadata = {
  title: 'Your paddock — what just happened, and what it changed',
  description:
    'The latest result, what it changed in the championship, what races next and the motorsport wire — F1, MotoGP, WEC, IndyCar, NASCAR, WRC and more, in your local time.',
  alternates: { canonical: '/app' },
};

function ageLabel(pubDate: Date, now: Date): string {
  const mins = Math.max(0, Math.round((now.getTime() - pubDate.getTime()) / 60000));
  if (mins < 90) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function Home() {
  const now = new Date();
  const all = await loadAllSeries();
  const metaBySlug = new Map(all.map(s => [s.meta.slug, s.meta]));

  // ── 0. Happening now: the weekend whose session window straddles `now`. This
  // outranks the finished-result lead below — on Dutch GP Sunday the page led
  // with a Formula E finale that ended five days earlier, because "newest race
  // with a podium" has no concept of a weekend being underway. Live = not past,
  // AND first session already started or starting inside 24h, AND the last
  // session not yet over. Precedence is temporal, never editorial: candidates
  // sort by first start, so a weekend already running beats one about to start,
  // and no series is ever preferred or suppressed by name.
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

  let liveWeekend: HomeLeadLiveWeekend | null = null;
  const live = liveCandidates[0];
  if (live) {
    // A dateOnly session has no real hour (lib/types.ts, Session.dateOnly), so
    // it can never be a timed "next up" or an "also today" row — both carry a
    // clock time to the client.
    const timed = live.w.sessions.filter(x => !x.dateOnly);
    // Earliest session that has NOT finished — `end > now`, not `start > now`.
    // A running session must stay selected, otherwise the band skips straight
    // past it to the following one and the LIVE pill can never fire while a
    // session is actually on track.
    const nextUp =
      timed.filter(x => x.end > now).sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null;
    liveWeekend = {
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
      // already run stays listed under "Also today" — once FP1 starts, it would
      // sit beside Sprint Qualifying reading as though it were upcoming.
      alsoToday: nextUp
        ? (groupByDay(timed).find(d => d.sessions.some(x => x.uid === nextUp.uid))?.sessions ?? [])
            .filter(x => x.uid !== nextUp.uid && x.start > now)
            .map(x => ({ name: x.title, startIso: x.start.toISOString() }))
        : [],
    };
  }

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

  // ── 4. The wire: the five newest aggregated headlines, source named. ──
  const rawNews = await fetchAggregatedNews();
  const wire: HomeLeadWireItem[] = rawNews
    .slice()
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, 5)
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

  // ── 5. Our own writing: the newest published post. The fetcher returns a
  // series SLUG and only the page holds the series metadata, so the name and
  // colour for the card's chip are resolved here. Fail-soft — a Supabase
  // outage drops the band, it never blanks the page.
  let blog: HomeLeadBlog | null = null;
  try {
    const lead = await fetchHomeBlogLead();
    if (lead) {
      const meta = lead.seriesSlug ? metaBySlug.get(lead.seriesSlug) : undefined;
      const stamp = new Date(lead.publishedAtIso);
      blog = {
        ...lead,
        seriesName: meta?.name ?? null,
        seriesColor: meta?.color ?? null,
        // Same relative stamp the wire rows use, so a fresh post reads as news.
        ageLabel: Number.isNaN(stamp.getTime()) ? null : ageLabel(stamp, now),
      };
    }
  } catch {
    /* no blog lead this revalidation */
  }

  return (
    <div className={PAGE_WIDE}>
      <HomeLead
        blog={blog}
        liveWeekend={liveWeekend}
        result={result}
        changed={changed}
        next={next}
        wire={wire}
      />
    </div>
  );
}
