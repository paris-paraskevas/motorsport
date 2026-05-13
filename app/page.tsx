import Link from 'next/link';
import { loadAllSeries } from '@/lib/series';
import { isThisWeekend, isWithinNextNDays } from '@/lib/date';
import { SessionList } from '@/components/SessionList';
import { SeriesBadge } from '@/components/SeriesBadge';

export const revalidate = 21600;

export default async function Home() {
  const all = await loadAllSeries();
  const now = new Date();

  const flat = all.flatMap(s =>
    s.sessions.map(session => ({ session, color: s.meta.color })),
  ).sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  const weekend = flat.filter(x => isThisWeekend(x.session.start, now));
  const next7 = flat.filter(x =>
    !isThisWeekend(x.session.start, now) &&
    isWithinNextNDays(x.session.start, 7, now),
  );

  return (
    <main className="max-w-2xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-zinc-100 text-lg">Motorsport</h1>
        <Link href="/about" className="text-xs text-zinc-500 hover:text-zinc-300">
          about
        </Link>
      </header>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">This weekend</h2>
        <SessionList items={weekend} />
      </section>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Next 7 days</h2>
        <SessionList items={next7} />
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
