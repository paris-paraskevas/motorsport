import { NextResponse } from 'next/server';
import { loadAllSeries } from '@/lib/series';
import { JUST_MISSED_WINDOW_MS } from '@/lib/date';
import { looksLikeRaceSession } from '@/lib/results-ready';
import {
  fetchLatestPodium,
  homeResultsSupported,
  type JustMissedItem,
} from '@/lib/home-results';
import { loadMedia, highlightForRound } from '@/lib/media';

// JUST MISSED data for the home, served as cacheable Ajax instead of computed
// in the /app render. This is what un-sticks /app from dynamic: the WEC podium
// path triggers a `no-store` live-component fetch, which forced the whole /app
// route dynamic (cold-start ~20s, never edge-cached). Here it runs off the
// static page path; the JSON response is CDN-cached (s-maxage) so the heavy
// fetch fan-out runs at most once per window, not per visit.
export const dynamic = 'force-dynamic';

export async function GET() {
  const all = await loadAllSeries();
  const now = new Date();
  const seriesBySlug = new Map(all.map(s => [s.meta.slug, s.meta]));
  const flat = all
    .flatMap(s => s.sessions.map(session => ({ session, seriesSlug: s.meta.slug })))
    .sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  const jmWindowStart = now.getTime() - JUST_MISSED_WINDOW_MS;
  const activeInWindow = new Set<string>();
  for (const x of flat) {
    const end = x.session.end.getTime();
    if (!x.session.dateOnly && end <= now.getTime() && end >= jmWindowStart) {
      activeInWindow.add(x.seriesSlug);
    }
  }

  const justMissed: JustMissedItem[] = [];
  await Promise.all(
    [...activeInWindow].filter(homeResultsSupported).map(async slug => {
      const meta = seriesBySlug.get(slug);
      if (!meta) return;
      const latest = await fetchLatestPodium(slug);
      if (!latest || new Date(latest.date).getTime() < jmWindowStart) return;
      justMissed.push({
        seriesSlug: slug,
        seriesName: meta.name,
        color: meta.color,
        raceName: latest.raceName,
        date: latest.date,
        round: latest.round,
        podium: latest.podium,
        highlight: highlightForRound(await loadMedia(slug), latest.round),
        resultsHref: `/series/${slug}?tab=results`,
      });
    }),
  );

  const uncoveredRecent = new Map<string, (typeof flat)[number]>();
  for (const x of flat) {
    if (homeResultsSupported(x.seriesSlug)) continue;
    const s = x.session;
    if (s.dateOnly || !looksLikeRaceSession(s.title)) continue;
    const end = s.end.getTime();
    if (end > now.getTime() || end < jmWindowStart) continue;
    uncoveredRecent.set(x.seriesSlug, x); // flat ascending → last = most recent
  }
  for (const [slug, x] of uncoveredRecent) {
    const meta = seriesBySlug.get(slug);
    if (!meta) continue;
    justMissed.push({
      seriesSlug: slug,
      seriesName: meta.name,
      color: meta.color,
      raceName: x.session.location?.split(',')[0].trim() || x.session.title,
      date: x.session.end.toISOString(),
      resultsHref: `/series/${slug}?tab=results`,
    });
  }
  justMissed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json(justMissed, {
    headers: {
      // Edge-cache the JSON so the fetch fan-out (incl. WEC's live component)
      // runs at most once per window, served stale-while-revalidate after.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
