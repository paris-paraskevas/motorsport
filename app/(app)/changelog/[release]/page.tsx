import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { fitDescription, fitTitle, PAGE_WIDE, SITE_URL } from '@/lib/site';
import { RELEASE_INDEX } from '@/lib/content-bundle.generated';
import { EYEBROW, ReleaseHeading, ReleaseUpdates } from '@/components/changelog/ReleaseEntries';
import { findRelease, loadReleaseGroups, releaseSlug, releasesFilePath } from '../releases';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';

// One release's every update (X6 A). RELEASES.md exists at build alone (it
// stays out of the Worker bundle), so the page is prerendered for every
// release of the bundled index and any other address answers 404 without a
// render: force-static with build-time params and dynamicParams off is the
// contract, the same as /changelog and the archive pages. The changelog lists
// the releases and the newest one's newest updates; this page holds the rest.

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return RELEASE_INDEX.map(r => ({ release: r.slug }));
}

type Params = Promise<{ release: string }>;

async function releaseFor(params: Params) {
  const { release } = await params;
  const groups = await loadReleaseGroups(releasesFilePath());
  return findRelease(groups, release);
}

/** The story's first sentence as the description, its tags and spacing gone; a
 *  sentence of the release's own when the story is empty. */
function storySummary(storyHtml: string, label: string, key: string): string {
  const text = storyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const sentence = /^(.+?[.!?])(\s|$)/.exec(text)?.[1] ?? text;
  return (sentence || `Every update of ${label}, the release ${key} of Paddock Tracker.`).slice(0, 160);
}

async function baseMetadata({ params }: { params: Params }): Promise<Metadata> {
  const release = await releaseFor(params);
  if (!release) return { title: 'Release not found' };
  return {
    // X10b: a long release name loses the words after it for the tab (five releases measured over 580 px).
    title: fitTitle([`${release.label} — release notes`, `${release.label} release notes`, release.label]),
    // X10: a one-line story gets the release notes' own sentence so the description clears Bing's floor.
    description: fitDescription(storySummary(release.storyHtml, release.label, release.key), { tail: `The release notes of ${release.label}, update by update.` }),
    alternates: { canonical: `${SITE_URL}/changelog/${releaseSlug(release)}` },
  };
}
export const generateMetadata = pageMetadata('/changelog/[release]', baseMetadata);

async function ReleasePage({ params }: { params: Params }) {
  const release = await releaseFor(params);
  if (!release) notFound();
  const href = `/changelog/${releaseSlug(release)}`;
  return (
    <div className={PAGE_WIDE}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Changelog', url: `${SITE_URL}/changelog` },
          { name: release.label, url: `${SITE_URL}${href}` },
        ])}
      />
      <Link href="/changelog" className={`${EYEBROW} inline-block text-text-muted hover:text-text`}>
        ← Changelog
      </Link>
      <header className="mt-4 mb-8 border-b border-text pb-6">
        <ReleaseHeading release={release} level="h1" />
      </header>
      <ReleaseUpdates release={release} />
    </div>
  );
}

export default withPageGate('/changelog/[release]', ReleasePage);
