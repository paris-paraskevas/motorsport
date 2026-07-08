import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft, ExternalLink, ArrowRight, MapPin } from 'lucide-react';
import { getInfoEntry, getIndexedInfoEntries, isEntryIndexed } from '@/lib/information/registry';
import { getTopic } from '@/lib/information/topics';
import type { InfoEntry } from '@/lib/information/types';
import { renderMarkdown } from '@/lib/content';
import { POST_ARTICLE_CLASS } from '@/components/blog/PostHeader';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd, qaPageLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';

export const revalidate = 3600;

// Prerender only the INDEXED (verified + featured) entries; the long tail of
// verified-but-un-featured and draft entries renders on-demand and caches
// (mirrors /drivers/[slug]). Keeps the build fast at hundreds of entries.
export async function generateStaticParams() {
  const indexed = await getIndexedInfoEntries();
  return indexed.map((e) => ({ topic: e.topic, slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string; slug: string }>;
}): Promise<Metadata> {
  const { topic, slug } = await params;
  const entry = await getInfoEntry(topic, slug);
  if (!entry) return { title: 'Not found' };
  const indexed = await isEntryIndexed(entry);
  return {
    title: entry.question,
    description: entry.summary,
    ...(indexed ? {} : { robots: { index: false, follow: true } }),
    ...withSocialMeta({
      title: entry.question,
      description: entry.summary,
      path: `/information/${topic}/${slug}`,
    }),
  };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2026-07-08" → "8 July 2026" (or null if not a valid ISO date). */
function formatUpdated(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const monthIndex = parseInt(m[2], 10) - 1;
  return MONTHS[monthIndex] ? `${parseInt(m[3], 10)} ${MONTHS[monthIndex]} ${m[1]}` : null;
}

function TrackFactsBlock({ entry }: { entry: InfoEntry }) {
  const t = entry.track;
  if (!t) return null;
  const rows: Array<[string, string]> = [];
  rows.push(['Country', t.country]);
  if (t.type) rows.push(['Type', t.type]);
  if (t.lengthKm) rows.push(['Length', `${t.lengthKm} km`]);
  if (t.turns) rows.push(['Turns', String(t.turns)]);
  if (t.opened) rows.push(['Opened', String(t.opened)]);
  const maps =
    t.location != null
      ? `https://www.google.com/maps/search/?api=1&query=${t.location.lat},${t.location.lng}`
      : null;
  return (
    <section className="mb-8 border-y border-border py-4">
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
        Circuit facts
      </h2>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold">
              {k}
            </dt>
            <dd className="mt-1 text-text font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {maps && (
        <a
          href={maps}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-tint hover:underline underline-offset-2"
        >
          <MapPin size={14} />
          View on Google Maps
          {t.coordsVerified && (
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
              · coords verified
            </span>
          )}
        </a>
      )}
    </section>
  );
}

export default async function InfoEntryPage({
  params,
}: {
  params: Promise<{ topic: string; slug: string }>;
}) {
  const { topic, slug } = await params;
  const entry = await getInfoEntry(topic, slug);
  if (!entry) notFound();

  const t = getTopic(topic);
  const [bodyHtml, indexed] = await Promise.all([
    renderMarkdown(entry.bodyMarkdown),
    isEntryIndexed(entry),
  ]);
  const url = `${SITE_URL}/information/${topic}/${slug}`;
  const lastUpdated = entry.author ? formatUpdated(entry.updated) : null;

  return (
    <div className="max-w-2xl lg:max-w-3xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Information', url: `${SITE_URL}/information` },
          { name: t?.label ?? topic, url: `${SITE_URL}/information/${topic}` },
          { name: entry.question, url },
        ])}
      />
      {/* QAPage structured data only where the page is actually indexable. */}
      {indexed && (
        <JsonLd
          data={qaPageLd({
            question: entry.question,
            answerText: entry.summary,
            url,
            dateModified: entry.updated,
          })}
        />
      )}

      <Link
        href={`/information/${topic}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-text-faint hover:text-text-muted transition-colors duration-(--duration-fast) mb-6"
      >
        <ChevronLeft size={14} />
        {t?.label ?? 'Back'}
      </Link>

      {entry.review === 'unverified' && (
        <div className="mb-6 border border-border bg-surface rounded-md p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] font-semibold text-text-faint mb-1">
            Draft · pending review
          </p>
          <p className="text-sm text-text-muted leading-relaxed">
            This entry was compiled from web research and hasn’t been fact-checked by an
            editor yet. Details may be incomplete or imprecise.
          </p>
        </div>
      )}

      <header className="mb-6">
        <h1 className="text-text text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          {entry.question}
        </h1>
        {entry.kind !== 'track' && (
          <p className="mt-4 text-lg text-text-muted leading-relaxed">{entry.summary}</p>
        )}
      </header>

      {entry.kind === 'track' && <TrackFactsBlock entry={entry} />}

      {entry.bodyMarkdown.trim() && (
        <article className={POST_ARTICLE_CLASS}>
          <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </article>
      )}

      {entry.author && (
        <p className="mt-6 text-xs text-text-faint">
          Curated and fact-checked by {entry.author}.
          {lastUpdated ? ` Last updated ${lastUpdated}.` : ''}
        </p>
      )}

      {entry.sources.length > 0 && (
        <section className="mt-8 border-t border-border pt-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-text-faint mb-2">
            Sources
          </h2>
          <ul className="space-y-1">
            {entry.sources.map((s, i) => (
              <li key={i} className="text-sm text-text-muted">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-text underline underline-offset-2"
                  >
                    {s.label}
                    <ExternalLink size={11} className="shrink-0" />
                  </a>
                ) : (
                  s.label
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {entry.related.length > 0 && (
        <section className="mt-8 border-t border-border pt-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-text-faint mb-3">
            Keep exploring
          </h2>
          <ul className="space-y-2">
            {entry.related.map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className="group inline-flex items-center gap-1.5 text-text hover:text-tint transition-colors duration-(--duration-fast)"
                >
                  <ArrowRight size={14} className="text-text-faint group-hover:text-tint group-hover:translate-x-0.5 transition-all duration-(--duration-fast)" />
                  <span className="font-medium">{r.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
