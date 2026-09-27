import 'server-only';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';
import type { PageFamily } from '../page-families';

// The News family (P2.5 PR C): what app/(app)/news/page.tsx held once its route
// file left the code: the page's metadata (the title, the description, the
// card) and the breadcrumb it printed. The rows come from the news source
// through the page's composition (lib/design/components.ts SPLITS['/news']);
// its heading region draws the h1 the route drew.

const NEWS_TITLE = 'News';
const NEWS_DESCRIPTION =
  'Latest motorsport news across F1, MotoGP, WEC, Formula E, WRC, IndyCar, NASCAR, IMSA, DTM and more — one aggregated feed, filterable by series.';

const METADATA: Metadata = {
  title: NEWS_TITLE,
  description: NEWS_DESCRIPTION,
  alternates: { canonical: '/news' },
  ...withSocialMeta({
    // The root layout's title.template only applies to the document <title>,
    // not og:title / twitter:title, so the full title goes here.
    title: `${NEWS_TITLE} — Paddock Tracker`,
    description: NEWS_DESCRIPTION,
    path: '/news',
  }),
};

export const family: PageFamily = {
  metadata: async () => METADATA,
  extras: async () => (
    <JsonLd
      data={breadcrumbLd([
        { name: 'Home', url: SITE_URL },
        { name: 'News', url: `${SITE_URL}/news` },
      ])}
    />
  ),
};
