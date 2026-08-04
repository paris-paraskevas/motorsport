import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { INFO_TOPICS, topicForSeries } from '@/lib/information/topics';
import { getAllInfoEntries, getIndexedInfoEntries } from '@/lib/information/registry';
import { entryHref } from '@/lib/information/types';
import { loadAllSeriesMeta } from '@/lib/series';
import { TopicCard, EntryRow, SectionHead, PillLink } from '@/components/information/InfoUi';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';

// The hub is curated + indexable. Entries revalidate hourly (new champions,
// newly-verified answers) without a redeploy.
export const revalidate = 3600;

const TITLE = 'Motorsport Answers & Information';
const DESCRIPTION =
  'Clear, sourced answers to motorsport questions — champions, records, rules, tracks and the junior ladder, across F1, MotoGP, endurance, rally, stock cars and more.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...withSocialMeta({ title: TITLE, description: DESCRIPTION, path: '/information' }),
};

export default async function InformationHub() {
  const [all, featured, seriesMeta] = await Promise.all([
    getAllInfoEntries(),
    getIndexedInfoEntries(),
    loadAllSeriesMeta(),
  ]);
  const seriesByName = [...seriesMeta].sort((a, b) => a.name.localeCompare(b.name));

  // Verified-entry count per topic for the topic-card badges (honest: only
  // reviewed answers are tallied).
  const verifiedByTopic = new Map<string, number>();
  for (const e of all) {
    if (e.review === 'verified') {
      verifiedByTopic.set(e.topic, (verifiedByTopic.get(e.topic) ?? 0) + 1);
    }
  }

  const allQa = featured.filter((e) => e.kind === 'qa');
  const featuredQa = allQa.slice(0, 10);
  const qaTotal = all.filter((e) => e.kind === 'qa' && e.review === 'verified').length;

  return (
    <div className={PAGE_WIDE}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Information', url: `${SITE_URL}/information` },
        ])}
      />

      <header className="mb-8 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-tint mb-3">
          Questions answered
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-[0.95] text-text">
          Motorsport, explained<span className="text-tint">.</span>
        </h1>
        <p className="mt-4 text-base text-text-muted leading-relaxed max-w-2xl">
          Straight, sourced answers to the questions fans actually ask — who won what, how
          the racing works, where the great circuits are, and who’s coming up next. Every
          answer links back into the live data across the site.
        </p>
      </header>

      <section className="mb-8 border border-border bg-surface p-4 md:p-5">
        <SectionHead
          title="Browse by topic"
          sub={`${INFO_TOPICS.length} topics`}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {INFO_TOPICS.map((t) => (
            <TopicCard
              key={t.id}
              id={t.id}
              label={t.label}
              blurb={t.blurb}
              count={verifiedByTopic.get(t.id) ?? 0}
            />
          ))}
        </div>
      </section>

      {featuredQa.length > 0 && (
        <section className="mb-8 border border-border bg-surface p-4 md:p-5">
          <SectionHead title="Popular answers" sub={`${featuredQa.length} of ${qaTotal}`} />
          {/* gap-y matters: as bare rows in a gap-x-only grid these ran together
              into three ragged text columns. As cards they need real gutters. */}
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {featuredQa.map((e) => (
              <EntryRow key={entryHref(e)} href={entryHref(e)} question={e.question} summary={e.summary} />
            ))}
          </div>
        </section>
      )}

      <section id="series-guides" className="mb-8 scroll-mt-20 border border-border bg-surface p-4 md:p-5">
        <SectionHead
          title="Series guides"
          sub={`${seriesByName.length} championships`}
          href="/information/series-guides"
        />
        <p className="mb-4 max-w-3xl text-sm md:text-[15px] leading-relaxed text-text-muted">
          A guide to every championship we cover — its full history and how the racing works.
          New to the sport? Start with{' '}
          <Link
            href="/information/general/types-of-motorsport"
            className="text-tint hover:underline underline-offset-2"
          >
            the different types of motorsport
          </Link>
          .
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {seriesByName.map((s) => {
            const topic = topicForSeries(s.slug);
            return (
              <div
                key={s.slug}
                className="flex h-full flex-col justify-between gap-2.5 border border-border bg-surface-elevated p-3"
              >
                <div className="font-display text-base font-extrabold uppercase tracking-wide leading-tight text-text">
                  {s.name}
                </div>
                {/* Pills, not 10px text links. These were 50×15px targets — under
                    the 24×24 WCAG 2.2 asks — and there are 30 of them. */}
                <div className="flex flex-wrap gap-2">
                  <PillLink href={`/information/${topic}/the-history-of-${s.slug}`}>History</PillLink>
                  <PillLink href={`/information/${topic}/${s.slug}-rules-explained`}>Rules</PillLink>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Closes the 80px void that used to run from this banner down to the
          footer: a real panel with the two onward routes, rather than a bare link
          floating over dead space. */}
      <section className="border border-border bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <Link
              href="/series"
              className="group inline-flex items-center gap-2 text-text transition-colors duration-(--duration-fast) hover:text-tint"
            >
              <span className="font-display text-2xl md:text-3xl font-extrabold uppercase tracking-wide">
                Explore every series
              </span>
              <ArrowRight
                size={20}
                className="transition-transform duration-(--duration-fast) group-hover:translate-x-0.5"
              />
            </Link>
            <p className="mt-1.5 max-w-2xl text-sm md:text-[15px] leading-relaxed text-text-muted">
              Live standings, results, calendars and champions for 15 championships.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PillLink href="/information/map">Circuit map</PillLink>
            <PillLink href="/calendar">Full calendar</PillLink>
          </div>
        </div>
      </section>
    </div>
  );
}
