import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { CalendarView } from '@/components/calendar/CalendarView';
import { buildRoundLookupAcrossSeries } from '@/lib/weekend';
import { groupByWeekend } from '@/lib/group';
import type { CalendarWeekend } from '@/components/calendar/types';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
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
        seriesName: s.meta.name,
      })),
    )
    .sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

  // Weekends for the agenda view. groupByWeekend is the same resolution the
  // per-series Calendar tab and the ICS feed run on, so a round's number, name
  // and date range read identically wherever they appear. Flattened across
  // series and sorted by first session, since the agenda interleaves them.
  const weekends: CalendarWeekend[] = all
    .flatMap(s =>
      groupByWeekend(s.sessions, now, s.rounds).map(w => ({
        key: `${s.meta.slug}:${w.key}`,
        seriesSlug: s.meta.slug,
        seriesName: s.meta.name,
        color: s.meta.color,
        round: w.round,
        roundName: w.roundName ?? w.label,
        dateRangeLabel: w.dateRangeLabel,
        location: w.sessions.find(x => x.location)?.location,
        isPast: w.isPast,
        rescheduleNote: w.rescheduleNote,
        sessions: w.sessions,
      })),
    )
    .sort((a, b) => a.sessions[0].start.getTime() - b.sessions[0].start.getTime());

  // Pass the whole season (past + future), not just upcoming — otherwise the
  // month navigator has no past months to page into. It defaults to the
  // current month (pickDefaultMonth) and the ← button steps back through the
  // season; past sessions render with their past/finished styling.
  const roundLookup = buildRoundLookupAcrossSeries(all, now);
  const roundByKey: Record<string, number> = {};
  for (const [k, v] of roundLookup) roundByKey[k] = v;

  return (
    <div className={PAGE_WIDE}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Calendar', url: `${SITE_URL}/calendar` },
        ])}
      />
      {/* The nav already marks Calendar as the active section and the control
          deck below carries the month as its dominant type, so a second giant
          "CALENDAR." wordmark was pure duplication. The heading survives for
          crawlers and screen readers, the same trade /app makes. */}
      <h1 className="sr-only">
        Motorsport calendar — every F1, MotoGP, WEC, Formula E, WRC, IndyCar,
        NASCAR, IMSA and DTM session, in your timezone
      </h1>

      <CalendarView
        items={flat}
        weekends={weekends}
        roundByKey={roundByKey}
        serverNow={now.toISOString()}
      />
    </div>
  );
}
