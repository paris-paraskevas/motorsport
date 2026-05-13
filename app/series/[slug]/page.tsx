import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listSeriesSlugs, loadSeries } from '@/lib/series';
import { groupByWeekend } from '@/lib/group';
import { PastToggleSection } from '@/components/PastToggleSection';
import { StaleBanner } from '@/components/StaleBanner';
import { SeriesBadge } from '@/components/SeriesBadge';

export const revalidate = 21600;

export async function generateStaticParams() {
  const slugs = await listSeriesSlugs();
  return slugs.map(slug => ({ slug }));
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let series;
  try {
    series = await loadSeries(slug);
  } catch {
    notFound();
  }

  const now = new Date();
  const weekends = groupByWeekend(series.sessions, now);
  const pastWeekends = weekends.filter(w => w.isPast);
  const upcomingWeekends = weekends.filter(w => !w.isPast);
  const nextWeekendKey = upcomingWeekends[0]?.key;

  return (
    <main className="max-w-2xl mx-auto p-4">
      <header className="mb-6">
        <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">← home</Link>
        <div className="mt-2">
          <SeriesBadge name={series.meta.name} color={series.meta.color} />
        </div>
        <h1 className="text-zinc-100 text-xl mt-1">{series.meta.season} season</h1>
        <StaleBanner configured={series.configured} />
      </header>

      <PastToggleSection
        pastWeekends={pastWeekends}
        upcomingWeekends={upcomingWeekends}
        color={series.meta.color}
        nextWeekendKey={nextWeekendKey}
      />

      {series.overview && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Overview</h2>
          <article
            className="prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: series.overview }}
          />
        </section>
      )}
      {series.drivers && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Drivers</h2>
          <article
            className="prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: series.drivers }}
          />
        </section>
      )}
      {series.significance && (
        <section className="mb-8">
          <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Significance</h2>
          <article
            className="prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: series.significance }}
          />
        </section>
      )}
    </main>
  );
}
