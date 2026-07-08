import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { INFO_TOPICS, getTopic } from '@/lib/information/topics';
import { getTopicEntries, isTopicIndexable } from '@/lib/information/registry';
import { entryHref } from '@/lib/information/types';
import { EntryRow } from '@/components/information/InfoUi';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
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
    <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Information', url: `${SITE_URL}/information` },
          { name: t.label, url: `${SITE_URL}/information/${topic}` },
        ])}
      />

      <Link
        href="/information"
        className="inline-flex items-center gap-1 text-xs font-medium text-text-faint hover:text-text-muted transition-colors duration-(--duration-fast) mb-6"
      >
        <ChevronLeft size={14} />
        All topics
      </Link>

      <header className="mb-8 border-b border-border pb-5">
        <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-tight text-text">
          {t.label}
        </h1>
        <p className="mt-2 text-base text-text-muted leading-relaxed">{t.blurb}</p>
      </header>

      {topic === 'tracks' ? (
        <>
          {entries.filter((e) => e.kind !== 'track').length > 0 && (
            <section className="mb-10">
              <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
                Guides &amp; tracks by country
              </h2>
              <div className="divide-y divide-border/60">
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
            <section className="mb-10">
              <div className="divide-y divide-border/60">
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
            <section className="mb-10">
              <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
                Drafts
              </h2>
              <DraftNotice label="These entries are drafted from web research and awaiting an editor’s fact-check. They are not shown in search or submitted to Google yet." />
              <div className="divide-y divide-border/60">
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
          <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] font-semibold text-tint mb-2">
            {country}
          </h2>
          <div className="divide-y divide-border/60">
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
