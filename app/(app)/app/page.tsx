import type { Metadata } from 'next';
import { loadLiveHomeLayout } from '@/lib/home-layout';
import { buildHomeModel } from '@/lib/home-model';
import { HomeLead } from '@/components/HomeLead';
import { PAGE_WIDE } from '@/lib/site';

export const revalidate = 300;

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

export const metadata: Metadata = {
  title: 'Your paddock — what just happened, and what it changed',
  description:
    'The latest result, what it changed in the championship, what races next and the motorsport wire — F1, MotoGP, WEC, IndyCar, NASCAR, WRC and more, in your local time.',
  alternates: { canonical: '/app' },
};

export default async function Home() {
  const layout = await loadLiveHomeLayout();
  const model = await buildHomeModel(layout);

  return (
    <div className={PAGE_WIDE}>
      <HomeLead {...model} />
    </div>
  );
}
