import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { listSeriesSlugs, loadSeriesMeta } from '@/lib/series';
import { tabsFor, type TabKey } from '@/lib/tabs';
import { SeriesPageView, seriesTabMetadata } from '@/components/SeriesPageView';

// Path-based series tabs (B11): /series/[slug]/standings etc. The calendar tab
// lives at the bare /series/[slug] (this route 301-redirects `calendar` there),
// so every entry here is a non-calendar tab. Statically ISR-cacheable — the
// whole point of the migration off the `force-dynamic` `?tab=` page.
export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await listSeriesSlugs();
  const params: { slug: string; tab: string }[] = [];
  for (const slug of slugs) {
    const meta = await loadSeriesMeta(slug).catch(() => null);
    // Single-event series carry a reduced tab set; only emit tabs that series
    // actually shows (and never `calendar` — that's the bare path).
    for (const t of tabsFor(meta?.singleEvent)) {
      if (t.key !== 'calendar') params.push({ slug, tab: t.key });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; tab: string }>;
}): Promise<Metadata> {
  const { slug, tab } = await params;
  return seriesTabMetadata(slug, tab);
}

export default async function SeriesTabPage({
  params,
}: {
  params: Promise<{ slug: string; tab: string }>;
}) {
  const { slug, tab } = await params;
  // The calendar tab is the bare-path landing — never a /calendar segment.
  if (tab === 'calendar') redirect(`/series/${slug}`);

  const meta = await loadSeriesMeta(slug).catch(() => null);
  if (!meta) notFound();
  const allowed = tabsFor(meta.singleEvent).map(t => t.key) as string[];
  if (!allowed.includes(tab)) notFound();

  return <SeriesPageView slug={slug} activeTab={tab as TabKey} />;
}
