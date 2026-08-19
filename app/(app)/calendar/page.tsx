import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { CalendarView } from '@/components/calendar/CalendarView';
import { buildRoundLookupAcrossSeries } from '@/lib/weekend';
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

  // Pass the whole season (past + future), not just upcoming — otherwise the
  // month navigator has no past months to page into. It defaults to the
  // current month (pickDefaultMonth) and the ← button steps back through the
  // season; past sessions render with their past/finished styling.
  const roundLookup = buildRoundLookupAcrossSeries(all, now);
  const roundByKey: Record<string, number> = {};
  for (const [k, v] of roundLookup) roundByKey[k] = v;

  // Round display names for the weekend banners, keyed `${slug}:${round}` —
  // far smaller than a per-session map. Curated rounds.json names only; a
  // round without one falls back to "Round N" client-side.
  const roundNames: Record<string, string> = {};
  for (const s of all) {
    for (const r of s.rounds?.rounds ?? []) {
      if (r.name) roundNames[`${s.meta.slug}:${r.round}`] = r.name;
    }
  }

  return (
    <div className={PAGE_WIDE}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Calendar', url: `${SITE_URL}/calendar` },
        ])}
      />
      {/* Compact Paper masthead — the display-caps register is gone, and the
          saved height is part of round-2 ⑥'s "make the month fit". */}
      <header className="mb-4">
        <h1 className="font-serif text-[34px] font-medium leading-none tracking-[-0.02em] text-text md:text-[40px]">
          Calendar
        </h1>
      </header>

      <CalendarView items={flat} roundByKey={roundByKey} roundNames={roundNames} serverNow={now.toISOString()} />
    </div>
  );
}
