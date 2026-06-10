import Link from 'next/link';
import type { SeriesMeta } from '@/lib/types';

// "15 series. One timetable." — every series as a chip in its own color,
// linking into the workstation series pages.
export function SeriesStrip({ seriesList }: { seriesList: SeriesMeta[] }) {
  return (
    <section id="series" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-extrabold uppercase tracking-tight text-text sm:text-4xl">
          {seriesList.length} series. <span className="text-text-muted">One timetable.</span>
        </h2>
        <ul className="mt-8 flex flex-wrap gap-2.5">
          {seriesList.map(s => (
            <li key={s.slug}>
              <Link
                href={`/series/${s.slug}`}
                className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-text transition-colors duration-(--duration-fast) hover:border-(--chip)"
                style={{ '--chip': s.color } as React.CSSProperties}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
