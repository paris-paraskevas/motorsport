import { loadAllSeries } from '@/lib/series';
import { FilteredSessions } from '@/components/FilteredSessions';

export const dynamic = 'force-dynamic';

const MAX_SESSIONS = 100;

export default async function CalendarPage() {
  const all = await loadAllSeries();
  const now = new Date();

  const flat = all
    .flatMap(s =>
      s.sessions.map(session => ({
        session,
        color: s.meta.color,
        seriesSlug: s.meta.slug,
      })),
    )
    .sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  const upcoming = flat
    .filter(x => x.session.end >= now)
    .slice(0, MAX_SESSIONS);

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-semibold mb-2">
          Schedule
        </div>
        <h1 className="text-zinc-50 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          Calendar
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          Upcoming sessions across the championships you follow.
        </p>
      </header>

      <FilteredSessions items={upcoming} />
    </div>
  );
}
