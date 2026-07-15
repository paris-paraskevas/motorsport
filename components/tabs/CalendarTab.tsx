import Link from 'next/link';
import { Series } from '@/lib/types';
import { groupByWeekend } from '@/lib/group';
import { weekendLabel } from '@/lib/weekend';
import { matchCircuitEntry } from '@/lib/circuits';
import { getTrackInfoByCircuitSlug } from '@/lib/information/registry';
import { MonthScopedWeekends } from '@/components/MonthScopedWeekends';
import { CancelledRoundsSection } from '@/components/CancelledRounds';

export async function CalendarTab({ series }: { series: Series }) {
  const now = new Date();
  const weekends = groupByWeekend(series.sessions, now, series.rounds).map(
    weekend => ({
      weekend,
      round: weekend.round,
    }),
  );
  const nextWeekendKey = weekends.find(w => !w.weekend.isPast)?.weekend.key;

  // Season circuits → their /information profiles. Those track pages are near
  // internal-link orphans (only the tracks index + on-site search link them),
  // which suppresses indexing on a young domain; the series calendar is a
  // far-more-crawled hub. Resolve each round's venue through the SAME matcher
  // the weekend page uses, dedupe, and keep only venues with a verified
  // (indexable) profile.
  const trackMap = await getTrackInfoByCircuitSlug();
  const seen = new Set<string>();
  const circuitLinks: { name: string; href: string }[] = [];
  for (const { weekend, round } of weekends) {
    if (round < 1) continue;
    const location = weekend.sessions.find(s => s.location)?.location;
    const { title } = weekendLabel(weekend, round);
    const match = await matchCircuitEntry(location, title);
    if (!match) continue;
    const slug = trackMap.get(match.slug);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    circuitLinks.push({ name: match.circuit.name, href: `/information/tracks/${slug}` });
  }

  return (
    <>
      <MonthScopedWeekends
        weekends={weekends}
        color={series.meta.color}
        seriesSlug={series.meta.slug}
        nextWeekendKey={nextWeekendKey}
      />
      <CancelledRoundsSection
        cancelledRounds={series.rounds?.cancelledRounds}
      />
      {circuitLinks.length > 0 && (
        <section className="mt-8 border-t border-border pt-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-text-faint mb-3">
            Circuits this season
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {circuitLinks.map(c => (
              <Link
                key={c.href}
                href={c.href}
                className="text-sm text-text-muted hover:text-tint transition-colors duration-(--duration-fast)"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
