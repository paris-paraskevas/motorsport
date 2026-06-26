import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';

export const revalidate = 21600;

export const metadata: Metadata = {
  title: 'About',
  description:
    'How Paddock Tracker works: data sources for each championship, refresh cadence, freshness indicators, and what powers the live timeline.',
};

export default async function About() {
  const all = await loadAllSeries();
  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'About', url: `${SITE_URL}/about` },
        ])}
      />
      <header className="mb-6">
        <h1 className="text-text text-2xl font-bold tracking-tight">About</h1>
      </header>

      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-wider text-text-faint mb-2 font-semibold">Sources</h2>
        <ul className="space-y-2 text-sm">
          {all.map(s => (
            <li key={s.meta.slug} className="text-text-muted">
              <span className="text-text">{s.meta.name}</span>
              {' — '}
              {s.meta.icsUrl ? (
                <span className="text-text-faint break-all font-mono">{s.meta.icsUrl}</span>
              ) : (
                <span className="text-text-faint italic">no feed configured</span>
              )}
              {' · '}
              <span className={s.stale ? 'text-amber-400' : 'text-text-faint'}>
                {s.stale ? 'stale' : 'fresh'}
              </span>
              {' · fetched '}
              <span className="text-text-faint font-mono">{s.fetchedAt.toISOString()}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-text-faint mb-2 font-semibold">Notes</h2>
        <p className="text-sm text-text-muted">
          Personal-use PWA. Data fetched at build with 6-hour revalidation. Session times are shown in your device&apos;s local timezone.
        </p>
      </section>
    </div>
  );
}
