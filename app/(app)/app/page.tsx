import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { groupByWeekend } from '@/lib/group';
import { weekendLabel } from '@/lib/weekend';
import { fetchAggregatedNews } from '@/lib/news';
import { fetchLatestPodium, HOME_RESULTS_SLUGS, type LatestRace } from '@/lib/home-results';
import { fetchStandingsBrief, isEligibleStandingsSeries } from '@/lib/standings/brief';
import {
  HomeLead,
  type HomeLeadChanged,
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
      changed = {
        seriesName: result.seriesName,
        leader: brief.leader,
        gapToSecond: brief.gapToSecond,
        top: brief.top,
        winnerName: result.podium.find(p => p.position === 1)?.name,
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

  return (
    <div className={PAGE_WIDE}>
      <HomeLead result={result} changed={changed} next={next} wire={wire} />
    </div>
  );
}
