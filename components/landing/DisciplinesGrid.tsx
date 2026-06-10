import Link from 'next/link';
import type { SeriesMeta } from '@/lib/types';
import { groupSeriesByCategory } from '@/lib/categories';

// One card per discipline, fed by the same category taxonomy the app's
// sidebar uses — names and counts stay true automatically.
export function DisciplinesGrid({ seriesList }: { seriesList: SeriesMeta[] }) {
  const groups = groupSeriesByCategory(seriesList);

  return (
    <section id="disciplines" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight text-text sm:text-5xl">
          Every discipline. <span className="text-text-faint">One roof.</span>
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => (
            <div key={group.category.id} className="rounded-2xl border border-border bg-surface/60 p-5">
              <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-text">
                {group.category.label}
              </h3>
              <ul className="mt-4 space-y-2">
                {group.series.map(s => (
                  <li key={s.slug}>
                    <Link
                      href={`/series/${s.slug}`}
                      className="group flex items-center gap-2.5 text-sm text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{s.name}</span>
                      <span className="ml-auto text-text-faint opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
