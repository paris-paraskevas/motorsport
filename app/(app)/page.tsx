import type { Metadata } from 'next';
import { loadHomeModel } from '@/lib/home-model';
import { HomeLead } from '@/components/HomeLead';
import { withSocialMeta } from '@/lib/seo';
import { PAGE_WIDE, SITE_TITLE } from '@/lib/site';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';

export const revalidate = 300;

// THE SITE'S FRONT DOOR, at `/`. It lived at `/app` behind a separate marketing
// landing page until 0.334.42, when the operator retired that page: "i have a
// big issue with the existence of the landing page now the home page is better.
// want to reimagine it? we might not even need it." The landing was 281 lines of
// hero copy, a templated 01/02/03 feature row and two panels this page already
// does better — so the thinnest page on the site was sitting on its most
// valuable URL, which is also the AdSense low-value-content problem in miniature.
// `/app` now redirects here (next.config.ts).
//
// The editorial home (design handoff §4.1): four server-rendered bands — our own
// writing, the weekend in progress, the result that just happened with what it
// changed and what's next, and the wire. The eighteen-widget gallery this
// replaced (HomeContent) is retired: full cutover, operator decision 2026-08-18.
//
// The bands' ORDER and which of them appear are the operator's, read from one
// Supabase row at render (lib/home-layout.ts) and fail-soft to the automatic
// composition. Follows stay device-local, and the layout is global rather than
// per-visitor, so this page is still identical for everyone — which is what
// keeps it ISR-cacheable.
//
// The assembly itself lives in lib/home-model.ts because the admin composer
// previews a DRAFT layout with the same data; two copies would drift and the
// preview would stop being a preview.

const BASE_METADATA: Metadata = {
  // The root's own title, not the layout's template: this is the page people
  // land on from a search for the site itself, so it carries the site name and
  // what it does rather than an internal label.
  title: {
    absolute: `${SITE_TITLE} — every result, in your own time zone`,
  },
  // Within Google's width (R13, the SEO check of 2026-09-27: 239 characters drew 1524px against 1000): 148 characters.
  description: 'Fifteen motorsport championships in one place: the latest result, what it changed, what races next, and the wire. F1, MotoGP, WEC, IndyCar and more.',
  alternates: { canonical: '/' },
  ...withSocialMeta({
    title: `${SITE_TITLE} — every result, in your own time zone`,
    description:
      'Fifteen motorsport championships in one place — schedules, standings, results and sourced explainers, in your own time zone. Free to browse, no account needed.',
    path: '/',
  }),
};
export const generateMetadata = pageMetadata('/', BASE_METADATA);

// Once per request (lib/home-model.ts loadHomeModel): the same assembly the
// Home components read when the operator has split this page in the designer.
// Then the frame (lib/design/page-frame.tsx) draws the published revision's
// components and leaves this body out; until then this is the page.
async function Home() {
  const model = await loadHomeModel();

  return (
    <div className={PAGE_WIDE}>
      <HomeLead {...model} />
    </div>
  );
}

export default withPageGate('/', Home);
