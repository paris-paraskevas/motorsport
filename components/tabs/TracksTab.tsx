import Link from 'next/link';
import { Series } from '@/lib/types';
import { groupByWeekend } from '@/lib/group';
import { weekendLabel } from '@/lib/weekend';
import { circuitLayoutFor, type CircuitLayout } from '@/lib/circuit-layout';
import { PlaceholderTab } from './PlaceholderTab';

// Tracks tab: the season's circuits as a grid of schematic maps (the f1db
// SVGs the weekend hero + home widget already use), each card linking to its
// race weekend. Coverage-gated per series in lib/tabs (TRACKS_TAB_SLUGS) —
// today F1 only. Rounds without a curated layout (e.g. a brand-new venue
// f1db hasn't drawn yet) still get a card so the season reads complete.

interface TrackCard {
  round: number;
  title: string;
  location?: string;
  layout: CircuitLayout | null;
}

export async function TracksTab({ series }: { series: Series }) {
  const now = new Date();
  const weekends = groupByWeekend(series.sessions, now, series.rounds).filter(
    w => w.round >= 1,
  );

  const cards: TrackCard[] = [];
  for (const w of weekends) {
    const location = w.sessions.find(s => s.location)?.location;
    const { title } = weekendLabel(w, w.round);
    const layout = await circuitLayoutFor(location, title);
    cards.push({
      round: w.round,
      title: layout?.name ?? title,
      location,
      layout,
    });
  }

  if (cards.length === 0) return <PlaceholderTab tabLabel="Tracks" />;

  // One credit line for the whole grid — every curated layout shares the same
  // licensed source (content/circuits-layout.json keeps them accurate).
  const credit = cards.find(c => c.layout)?.layout;

  return (
    <section>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {cards.map(c => (
          <Link
            key={c.round}
            href={`/series/${series.meta.slug}/weekend/${c.round}`}
            className="group rounded-lg border border-border bg-surface/40 p-3 transition-colors duration-(--duration-fast) hover:bg-surface"
          >
            <div className="aspect-square w-full">
              {c.layout ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={c.layout.svg}
                  alt={`${c.title} circuit layout`}
                  loading="lazy"
                  width={208}
                  height={208}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-border font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
                  No map yet
                </div>
              )}
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint tnum">
              Round {c.round}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-text leading-snug group-hover:text-tint transition-colors duration-(--duration-fast)">
              {c.title}
            </div>
            {c.location && (
              <div className="mt-0.5 truncate text-xs text-text-muted">{c.location}</div>
            )}
          </Link>
        ))}
      </div>

      {credit && (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          Circuit maps ·{' '}
          <a
            href={credit.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-text-muted"
          >
            {credit.source}
          </a>{' '}
          ({credit.license})
        </p>
      )}
    </section>
  );
}
