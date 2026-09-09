import 'server-only';
import { cache } from 'react';
import type { Metadata } from 'next';
import { loadAllSeries } from '@/lib/series';
import { buildRoundLookupAcrossSeries } from '@/lib/weekend';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';
import type { CalendarEntry } from '@/components/calendar/types';
import type { PageFamily } from '../page-families';

// The Calendar family (the components programme, R4.1): the first page whose
// route file left the code. What app/(app)/calendar/page.tsx used to hold, in
// two parts the catch-all and the Calendar component read: the page's metadata
// and structured data, and the assembly the component draws from. The
// assembly is the route's, moved as it was.

const CALENDAR_TITLE = 'Calendar';
const CALENDAR_DESCRIPTION =
  'Upcoming F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA and more sessions in one timeline — month-by-month, in your local time.';

const METADATA: Metadata = {
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

export interface CalendarModel {
  items: CalendarEntry[];
  roundByKey: Record<string, number>;
  roundNames: Record<string, string>;
  serverNow: string;
}

/** Every session of every series, the round lookups and the round names, once per request. */
export const loadCalendarModel = cache(async (): Promise<CalendarModel> => {
  const all = await loadAllSeries();
  const now = new Date();

  const items = all
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

  return { items, roundByKey, roundNames, serverNow: now.toISOString() };
});

export const family: PageFamily = {
  metadata: async () => METADATA,
  extras: async () => (
    <JsonLd
      data={breadcrumbLd([
        { name: 'Home', url: SITE_URL },
        { name: 'Calendar', url: `${SITE_URL}/calendar` },
      ])}
    />
  ),
};
