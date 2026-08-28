import { seriesCard } from '@/lib/og-cards';

// The series card again, for the tab routes (/series/<slug>/standings etc).
//
// This file has to exist: `opengraph-image.tsx` is NOT inherited by a nested
// dynamic segment. Measured 2026-08-28 — adding `ownCard: true` to
// `seriesTabMetadata` left all 73 tab pages with no og:image at all rather than
// falling through to the parent's card, the same defect class as 0.334.37.
// Re-exporting the parent route was tried first and fails outright: Next cannot
// recognise a re-exported `runtime` field, and the route 500s.
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
