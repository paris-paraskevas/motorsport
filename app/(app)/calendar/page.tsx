import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { CalendarView } from '@/components/calendar/CalendarView';
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
    path: '/calendar',
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

  // Pass the whole season (past + future), not just upcoming — otherwise the
  // month navigator has no past months to page into. It defaults to the
  // current month (pickDefaultMonth) and the ← button steps back through the
  // season; past sessions render with their past/finished styling.
  const roundLookup = buildRoundLookupAcrossSeries(all, now);
  const roundByKey: Record<string, number> = {};
  for (const [k, v] of roundLookup) roundByKey[k] = v;

  return (
    <div className="max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Calendar', url: `${SITE_URL}/calendar` },
        ])}
      />
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
            Calendar<span className="text-brand">.</span>
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Every session · your followed series · one timeline
          </p>
        </div>
      </header>

      <CalendarView items={flat} roundByKey={roundByKey} serverNow={now.toISOString()} />
    </div>
  );
}
