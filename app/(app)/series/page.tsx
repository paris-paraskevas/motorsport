import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { loadAllSeries } from '@/lib/series';
import { groupSeriesByCategory } from '@/lib/categories';
import { seriesSubPages } from '@/lib/tabs';
import { SectionHead } from '@/components/SectionHead';
import { Accordion } from '@/components/Accordion';
import type { Session } from '@/lib/types';
import { PAGE_WIDE } from '@/lib/site';

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
    <div className={PAGE_WIDE}>
      <h1 className="sr-only">All championships on Paddock Tracker</h1>
      <SectionHead title="Series" sub={`${all.length} championships`} />

      <div className="border-t border-border">
        {groups.map(group => (
          <Accordion
            key={group.category.id}
            title={group.category.label}
            titleClassName="font-display uppercase tracking-wide"
            count={`${group.series.length}`}
          >
            <div className="divide-y divide-border">
              {group.series.map(s => {
                const next = nextBySlug.get(s.slug);
                const subPages = seriesSubPages(s);
                return (
                  <div key={s.slug} className="flex items-stretch gap-3 py-3 px-2 -mx-2 min-w-0">
                    <span
                      className="self-stretch w-[3px] shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/series/${s.slug}`}
                        className="group flex items-center gap-3 min-w-0"
                      >
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
                      {/* Jump straight to a section instead of landing on the hub
                          then tabbing across — the mobile counterpart to the
                          desktop Series mega-menu's detail pane. */}
                      {subPages.length > 1 && (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {subPages.map(p => (
                            <Link
                              key={p.key}
                              href={p.href}
                              className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
                            >
                              {p.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Accordion>
        ))}
      </div>
    </div>
  );
}
