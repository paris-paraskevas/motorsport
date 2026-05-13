import Link from 'next/link';
import { loadAllSeries } from '@/lib/series';

export const revalidate = 21600;

export default async function About() {
  const all = await loadAllSeries();
  return (
    <main className="max-w-2xl mx-auto p-4">
      <header className="mb-6">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">← home</Link>
        <h1 className="text-zinc-100 text-xl mt-2">About</h1>
      </header>

      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Sources</h2>
        <ul className="space-y-2 text-sm">
          {all.map(s => (
            <li key={s.meta.slug} className="text-zinc-400">
              <span className="text-zinc-200">{s.meta.name}</span>
              {' — '}
              {s.meta.icsUrl ? (
                <span className="text-zinc-500 break-all">{s.meta.icsUrl}</span>
              ) : (
                <span className="text-zinc-600 italic">no feed configured</span>
              )}
              {' · '}
              <span className={s.stale ? 'text-amber-400' : 'text-zinc-500'}>
                {s.stale ? 'stale' : 'fresh'}
              </span>
              {' · fetched '}
              <span className="text-zinc-500">{s.fetchedAt.toISOString()}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Notes</h2>
        <p className="text-sm text-zinc-400">
          Personal-use PWA. Data fetched at build with 6-hour revalidation. All times rendered in Europe/Athens.
        </p>
      </section>
    </main>
  );
}
