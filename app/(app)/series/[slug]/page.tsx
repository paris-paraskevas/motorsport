import type { Metadata } from 'next';
import { listSeriesSlugs } from '@/lib/series';
import { SeriesPageView, seriesTabMetadata } from '@/components/SeriesPageView';

// The bare series URL is the calendar (default) landing. Path-based tabs (B11)
// let this be statically ISR-cacheable — it was `force-dynamic` only because the
// old `?tab=` read defeated prerendering.
export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await listSeriesSlugs();
  return slugs.map(slug => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return seriesTabMetadata(slug, 'calendar');
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <SeriesPageView slug={slug} activeTab="calendar" />;
}
