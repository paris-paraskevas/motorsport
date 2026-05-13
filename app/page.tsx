import Link from 'next/link';
import { loadAllSeries } from '@/lib/series';
import { isThisWeekend, isWithinNextNDays } from '@/lib/date';
import { groupByDay } from '@/lib/group';
import { SessionList } from '@/components/SessionList';
import { SeriesBadge } from '@/components/SeriesBadge';
import { NextSessionCard } from '@/components/NextSessionCard';
import { DayHeader } from '@/components/DayHeader';

export const revalidate = 21600;

export default async function Home() {
  const all = await loadAllSeries();
  const now = new Date();

  const flat = all.flatMap(s =>
    s.sessions.map(session => ({ session, color: s.meta.color, seriesName: s.meta.name })),
  ).sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  const upcoming = flat.filter(x => x.session.end >= now);
  const next = upcoming[0];
  const weekend = upcoming.filter(x => isThisWeekend(x.session.start, now));
  const next7Raw = upcoming.filter(x =>
    !isThisWeekend(x.session.start, now) &&
    isWithinNextNDays(x.session.start, 7, now),
  );

  // Day-grouped Next 7 days
  const byDay = groupByDay(next7Raw.map(x => x.session));
  const colorByUid: Record<string, string> = {};
  next7Raw.forEach(x => { colorByUid[x.session.uid] = x.color; });

  return (
    <main className="max-w-2xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-zinc-100 text-lg">Motorsport</h1>
        <Link href="/about" className="text-xs text-zinc-500 hover:text-zinc-300">
          about
        </Link>
      </header>

      {next && (
        <NextSessionCard
          session={next.session}
          color={next.color}
          seriesName={next.seriesName}
        />
      )}

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">This weekend</h2>
        <SessionList items={weekend.map(({ session, color }) => ({ session, color }))} />
      </section>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Next 7 days</h2>
        {byDay.length === 0 ? (
          <div className="text-zinc-600 text-sm">Nothing scheduled.</div>
        ) : (
          byDay.map(day => (
            <div key={day.label}>
              <DayHeader label={day.label} />
              <SessionList
                items={day.sessions.map(s => ({ session: s, color: colorByUid[s.uid] }))}
              />
            </div>
          ))
        )}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Series</h2>
        <ul className="space-y-2">
          {all.map(s => (
            <li key={s.meta.slug}>
              <Link href={`/series/${s.meta.slug}`} className="block py-1">
                <SeriesBadge name={s.meta.name} color={s.meta.color} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
