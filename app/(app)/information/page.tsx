import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { INFO_TOPICS } from '@/lib/information/topics';
import { getAllInfoEntries, getIndexedInfoEntries } from '@/lib/information/registry';
import { entryHref } from '@/lib/information/types';
import { TopicCard, EntryRow } from '@/components/information/InfoUi';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL } from '@/lib/site';
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
  const [all, featured] = await Promise.all([
    getAllInfoEntries(),
    getIndexedInfoEntries(),
  ]);

  // Verified-entry count per topic for the topic-card badges (honest: only
  // reviewed answers are tallied).
  const verifiedByTopic = new Map<string, number>();
  for (const e of all) {
    if (e.review === 'verified') {
      verifiedByTopic.set(e.topic, (verifiedByTopic.get(e.topic) ?? 0) + 1);
    }
  }

  const featuredQa = featured.filter((e) => e.kind === 'qa').slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
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

      <section className="mb-10">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-4">
          Browse by topic
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
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
        <section className="mb-10">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-2">
            Popular answers
          </h2>
          <div className="divide-y divide-border/60">
            {featuredQa.map((e) => (
              <EntryRow key={entryHref(e)} href={entryHref(e)} question={e.question} summary={e.summary} />
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-border pt-6">
        <Link
          href="/series"
          className="group inline-flex items-center gap-2 text-text hover:text-tint transition-colors duration-(--duration-fast)"
        >
          <span className="font-display text-lg font-extrabold uppercase tracking-wide">
            Explore every series
          </span>
          <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform duration-(--duration-fast)" />
        </Link>
        <p className="mt-1 text-sm text-text-muted">
          Live standings, results, calendars and champions for 15 championships.
        </p>
      </section>
    </div>
  );
}
