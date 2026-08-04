import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, ChevronLeft, MapPinned } from 'lucide-react';
import { INFO_TOPICS, getTopic } from '@/lib/information/topics';
import { getTopicEntries, isTopicIndexable } from '@/lib/information/registry';
import { entryHref } from '@/lib/information/types';
import { EntryRow, SectionHead, PillLink } from '@/components/information/InfoUi';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';

export const revalidate = 3600;
// Topics are a fixed set — anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return INFO_TOPICS.map((t) => ({ topic: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const t = getTopic(topic);
  if (!t) return { title: 'Not found' };
  const title = `${t.label} — Motorsport Answers`;
  const description = t.blurb;
  const indexable = await isTopicIndexable(topic);
  return {
    title,
    description,
    // Topic index goes noindex until it holds ≥1 verified entry (keeps the
    // all-draft tracks directory out of Google until reviewed).
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    ...withSocialMeta({ title, description, path: `/information/${topic}` }),
  };
}

// A callout shown above any list of still-unreviewed draft entries.
function DraftNotice({ label }: { label: string }) {
  return (
    <div className="mb-4 border border-border bg-surface rounded-md p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-text-faint mb-1">
        Pending review
      </p>
      <p className="text-sm text-text-muted leading-relaxed">{label}</p>
    </div>
  );
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  const t = getTopic(topic);
  if (!t) notFound();

  const entries = await getTopicEntries(topic);
  const verified = entries.filter((e) => e.review === 'verified');
  const drafts = entries.filter((e) => e.review === 'unverified');

  return (
    <div className={PAGE_WIDE}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Information', url: `${SITE_URL}/information` },
          { name: t.label, url: `${SITE_URL}/information/${topic}` },
        ])}
      />

      {/* Was a 70×16px text link — under the 24×24 WCAG 2.2 SC 2.5.8 minimum, and
          the only way back up the hierarchy on a phone. */}
      <div className="mb-6">
        <PillLink href="/information">
          <ChevronLeft size={13} aria-hidden="true" />
          All topics
        </PillLink>
      </div>

      <header className="mb-8 border-b border-border pb-5">
        <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-tight text-text">
          {t.label}
        </h1>
        <p className="mt-2 text-base text-text-muted leading-relaxed">{t.blurb}</p>
      </header>

      {topic === 'tracks' ? (
        <>
          <Link
            href="/information/map"
            className="group mb-6 inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-text transition-colors duration-(--duration-fast) hover:text-tint"
          >
            <MapPinned size={16} />
            View all circuits on the map
            <ArrowRight
              size={15}
              className="transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
            />
          </Link>
          {entries.filter((e) => e.kind !== 'track').length > 0 && (
            <section className="mb-8 border border-border bg-surface p-4 md:p-5">
              {/* Plain "&" — entities are not decoded inside a JSX attribute, so
                  &amp; here would render as literal "&amp;" on the page. */}
              <SectionHead title="Guides & tracks by country" />
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {entries
                  .filter((e) => e.kind !== 'track')
                  .sort(
                    (a, b) =>
                      Number(b.featured) - Number(a.featured) ||
                      a.question.localeCompare(b.question),
                  )
                  .map((e) => (
                    <EntryRow
                      key={entryHref(e)}
                      href={entryHref(e)}
                      question={e.question}
                      summary={e.summary}
                      draft={e.review === 'unverified'}
                    />
                  ))}
              </div>
            </section>
          )}
          <TrackDirectory entries={entries.filter((e) => e.kind === 'track')} />
        </>
      ) : (
        <>
          {verified.length > 0 && (
            /* Was a bare grid with no heading and no panel — the only h2 on a
               non-tracks topic page came from the footer. */
            <section className="mb-8 border border-border bg-surface p-4 md:p-5">
              <SectionHead title="Answers" sub={`${verified.length} verified`} />
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {verified.map((e) => (
                  <EntryRow
                    key={entryHref(e)}
                    href={entryHref(e)}
                    question={e.question}
                    summary={e.summary}
                  />
                ))}
              </div>
            </section>
          )}

          {drafts.length > 0 && (
            <section className="mb-8 border border-border bg-surface p-4 md:p-5">
              <SectionHead title="Drafts" sub={`${drafts.length} awaiting review`} />
              <DraftNotice label="These entries are drafted from web research and awaiting an editor’s fact-check. They are not shown in search or submitted to Google yet." />
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {drafts.map((e) => (
                  <EntryRow
                    key={entryHref(e)}
                    href={entryHref(e)}
                    question={e.question}
                    summary={e.summary}
                    draft
                  />
                ))}
              </div>
            </section>
          )}

          {verified.length === 0 && drafts.length === 0 && (
            <p className="text-sm text-text-muted">No answers here yet — check back soon.</p>
          )}
        </>
      )}
    </div>
  );
}

// Tracks grouped by country. The whole directory is web-researched (unverified)
// today, so it renders under a review notice and stays noindex.
function TrackDirectory({
  entries,
}: {
  entries: Awaited<ReturnType<typeof getTopicEntries>>;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-text-muted">The tracks directory is being curated.</p>;
  }
  const byCountry = new Map<string, typeof entries>();
  for (const e of entries) {
    const country = e.track?.country ?? 'Other';
    (byCountry.get(country) ?? byCountry.set(country, []).get(country)!).push(e);
  }
  const countries = [...byCountry.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <>
      <DraftNotice label="This tracks directory is drafted from web research and awaiting a fact-check, so it is not indexed by search engines yet. Coordinates are verified against our circuit data where a match exists." />
      {countries.map((country) => (
        <section key={country} className="mb-8">
          {/* A group label rather than a section head, so it stays compact and
              mono — but 11px was too small for the element that organises 140
              country groups. */}
          <h2 className="mb-2 border-b border-border pb-1.5 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-tint">
            {country}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {byCountry.get(country)!.map((e) => (
              <EntryRow
                key={entryHref(e)}
                href={entryHref(e)}
                question={e.question}
                summary={e.track?.type ? `${e.track.type}${e.track.lengthKm ? ` · ${e.track.lengthKm} km` : ''}` : e.summary}
                draft
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
