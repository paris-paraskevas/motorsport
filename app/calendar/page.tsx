import { loadAllSeries } from '@/lib/series';
import { groupByDay } from '@/lib/group';
import { SessionCard } from '@/components/SessionCard';
import { DayHeader } from '@/components/DayHeader';

export const dynamic = 'force-dynamic';

const MAX_SESSIONS = 60;

export default async function CalendarPage() {
  const all = await loadAllSeries();
  const now = new Date();

  const flat = all
    .flatMap(s =>
      s.sessions.map(session => ({
        session,
        color: s.meta.color,
        seriesName: s.meta.name,
        seriesSlug: s.meta.slug,
      })),
    )
    .sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  const upcoming = flat
    .filter(x => x.session.end >= now)
    .slice(0, MAX_SESSIONS);

  const colorByUid: Record<string, string> = {};
  upcoming.forEach(x => {
    colorByUid[x.session.uid] = x.color;
  });

  const byDay = groupByDay(upcoming.map(x => x.session));

  const totalSeries = new Set(upcoming.map(x => x.seriesSlug)).size;

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
          Next {upcoming.length} sessions across {totalSeries}{' '}
          {totalSeries === 1 ? 'championship' : 'championships'}.
        </p>
      </header>

      {byDay.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-8 text-center">
          <div className="text-zinc-300 text-base font-medium mb-1">
            Nothing scheduled
          </div>
          <div className="text-zinc-500 text-sm">
            No upcoming sessions across the configured series.
          </div>
        </div>
      ) : (
        <section>
          {byDay.map(day => (
            <div key={day.label} className="mb-3">
              <DayHeader label={day.label} count={day.sessions.length} />
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {day.sessions.map(s => (
                  <SessionCard
                    key={`${s.seriesSlug}-${s.uid}`}
                    session={s}
                    color={colorByUid[s.uid]}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
