import { seriesCard } from '@/lib/og-cards';

// Per-series social share card, for the bare /series/<slug> landing.
//
// Why it exists: measured on prod 2026-08-28, every series page shared the one
// generic /opengraph-image, so a link to Formula 1 and a link to WorldSBK
// produced the identical picture.
//
// The tab routes need their own copy of this file (see lib/og-cards.tsx) —
// metadata routes are not inherited by nested dynamic segments.
//
// Node runtime — loadSeriesMeta reads the content bundle.
export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Paddock Tracker — series';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return seriesCard(slug);
}
