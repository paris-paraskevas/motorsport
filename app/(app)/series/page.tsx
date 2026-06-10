import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { loadAllSeries } from '@/lib/series';
import { groupSeriesByCategory } from '@/lib/categories';
import { SectionHead } from '@/components/SectionHead';
import type { Session } from '@/lib/types';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Series',
  description:
    'Every championship Paddock tracks — F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more. Schedules, standings, results and news per series.',
  alternates: { canonical: '/series' },
};

// Day-level labels only: stable across timezones for practical purposes and
// rendered fully on the server, so this page ships zero hydration risk.
function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

export default async function SeriesHubPage() {
  const all = await loadAllSeries();
  const now = new Date();

  const nextBySlug = new Map<string, Session | undefined>();
  for (const s of all) {
    const next = [...s.sessions]
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .find(x => (x.dateOnly ? x.end > now : x.start > now));
    nextBySlug.set(s.meta.slug, next);
  }

  const groups = groupSeriesByCategory(all.map(s => s.meta));

  return (
    <div className="max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <h1 className="sr-only">All championships on Paddock Tracker</h1>
      <SectionHead title="Series" sub={`${all.length} championships`} />

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 xl:gap-x-16">
        {groups.map(group => (
          <section key={group.category.id} className="mb-7" aria-label={group.category.label}>
            <div className="mb-1 font-display text-sm font-extrabold uppercase tracking-wide text-text">
              {group.category.label}
              <span className="ml-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-faint">
                {group.series.length}
              </span>
            </div>
            <div className="border-y border-border divide-y divide-border">
              {group.series.map(s => {
                const next = nextBySlug.get(s.slug);
                return (
                  <Link
                    key={s.slug}
                    href={`/series/${s.slug}`}
                    className="group flex items-center gap-3 py-3 px-2 -mx-2 min-w-0 transition-colors duration-(--duration-fast) hover:bg-surface"
                  >
                    <span
                      className="self-stretch w-[3px] shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold text-text tracking-tight truncate">
                        {s.name}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-text-faint truncate">
                        {next ? `Next · ${next.title}` : 'No upcoming sessions'}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-text-muted tnum">
                      {next ? dayLabel(next.start) : '—'}
                    </span>
                    <ArrowUpRight
                      size={14}
                      className="shrink-0 text-text-faint group-hover:text-text-muted transition-colors duration-(--duration-fast)"
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
