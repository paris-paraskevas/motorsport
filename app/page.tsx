import { loadAllSeries } from '@/lib/series';
import { groupByDay } from '@/lib/group';
import { SessionList } from '@/components/SessionList';
import { NextSessionCard } from '@/components/NextSessionCard';
import { DayHeader } from '@/components/DayHeader';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const all = await loadAllSeries();
  const now = new Date();

  const flat = all.flatMap(s =>
    s.sessions.map(session => ({
      session,
      color: s.meta.color,
      seriesName: s.meta.name,
      seriesSlug: s.meta.slug,
    })),
  ).sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  const upcoming = flat.filter(x => x.session.end >= now);
  const next = upcoming[0];
  const remaining = upcoming.slice(1, 13);
  const colorByUid: Record<string, string> = {};
  remaining.forEach(x => { colorByUid[x.session.uid] = x.color; });
  const byDay = groupByDay(remaining.map(x => x.session));

  return (
    <div className="max-w-2xl mx-auto p-4 pb-16">
      {next ? (
        <NextSessionCard
          session={next.session}
          color={next.color}
          seriesName={next.seriesName}
          seriesSlug={next.seriesSlug}
        />
      ) : (
        <div className="mb-8 p-5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-500 text-sm">
          Nothing scheduled yet.
        </div>
      )}

      {byDay.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.14em] text-zinc-500 font-semibold mb-3">
            Upcoming
          </h2>
          {byDay.map(day => (
            <div key={day.label} className="mb-3">
              <DayHeader label={day.label} count={day.sessions.length} />
              <SessionList
                items={day.sessions.map(s => ({ session: s, color: colorByUid[s.uid] }))}
              />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
