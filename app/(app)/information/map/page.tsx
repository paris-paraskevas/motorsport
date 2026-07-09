import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getTopicEntries } from '@/lib/information/registry';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';
import { TracksMap, type MapTrack } from '@/components/information/TracksMap';

// Revalidate hourly like the rest of the information hub (new/edited tracks
// flow in without a redeploy).
export const revalidate = 3600;

const TITLE = 'Circuit Map';
const DESCRIPTION =
  'Every circuit and racing venue we cover, mapped worldwide — search by name or country, filter by series, and open any circuit for the full guide.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...withSocialMeta({ title: TITLE, description: DESCRIPTION, path: '/information/map' }),
};

export default async function CircuitMapPage() {
  // Reuse the information loader (server-only) rather than re-reading the JSON.
  // getTopicEntries('tracks') also returns the country/famous aggregate Q&A
  // pages — keep only real track entries with usable coordinates.
  const entries = await getTopicEntries('tracks');
  const tracks: MapTrack[] = [];
  for (const e of entries) {
    if (e.kind !== 'track' || !e.track?.location) continue;
    const { lat, lng } = e.track.location;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    tracks.push({
      slug: e.slug,
      name: e.question,
      country: e.track.country,
      countryCode: e.track.countryCode,
      lat,
      lng,
      categories: e.track.categories ?? [],
    });
  }

  return (
    <div className={PAGE_WIDE}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Information', url: `${SITE_URL}/information` },
          { name: 'Tracks & Circuits', url: `${SITE_URL}/information/tracks` },
          { name: 'Circuit Map', url: `${SITE_URL}/information/map` },
        ])}
      />

      <Link
        href="/information/tracks"
        className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-text-faint transition-colors duration-(--duration-fast) hover:text-text-muted"
      >
        <ChevronLeft size={14} />
        All circuits
      </Link>

      <header className="mb-6 border-b border-border pb-5">
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-wide leading-tight text-text md:text-4xl">
          Circuit Map
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-muted">
          {tracks.length} circuits and racing venues around the world. Search for a track, filter by
          series, and open any marker for the full circuit guide.
        </p>
      </header>

      <TracksMap tracks={tracks} />
    </div>
  );
}
