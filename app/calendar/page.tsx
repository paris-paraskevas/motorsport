import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { FilteredSessions } from '@/components/FilteredSessions';
import { buildRoundLookupAcrossSeries } from '@/lib/weekend';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';

export const revalidate = 300;

const CALENDAR_TITLE = 'Calendar';
const CALENDAR_DESCRIPTION =
  'Upcoming F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA and more sessions in one timeline — month-by-month, in your local time.';

export const metadata: Metadata = {
  title: CALENDAR_TITLE,
  description: CALENDAR_DESCRIPTION,
  ...withSocialMeta({
    // OpenGraph + Twitter need the full title (root layout's title.template only
    // applies to the document <title>, not to og:title / twitter:title).
    title: `${CALENDAR_TITLE} — Paddock Tracker`,
    description: CALENDAR_DESCRIPTION,
  }),
};

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

  const upcoming = flat.filter(x => x.session.end >= now);

  const roundLookup = buildRoundLookupAcrossSeries(all, now);
  const roundByKey: Record<string, number> = {};
  for (const [k, v] of roundLookup) roundByKey[k] = v;

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Calendar', url: `${SITE_URL}/calendar` },
        ])}
      />
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
          Schedule
        </div>
        <h1 className="text-text text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          Calendar
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          Upcoming sessions across the championships you follow.
        </p>
      </header>

      <FilteredSessions items={upcoming} roundByKey={roundByKey} />
    </div>
  );
}
