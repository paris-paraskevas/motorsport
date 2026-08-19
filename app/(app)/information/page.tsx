import Link from 'next/link';
import type { Metadata } from 'next';
import { INFO_TOPICS, topicForSeries } from '@/lib/information/topics';
import { getAllInfoEntries, getIndexedInfoEntries } from '@/lib/information/registry';
import { entryHref } from '@/lib/information/types';
import { loadAllSeriesMeta } from '@/lib/series';
import { AskField } from '@/components/information/AskField';
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

// Series slug → the token its weekend-works answer slug carries (where they
// differ). F1 and ADAC have no weekend-works answer yet (content gap).
const WEEKEND_WORKS_KEY: Record<string, string> = {
  wsbk: 'worldsbk',
  'gt-world': 'gt-world-challenge',
};

// The three numbered first reads for someone arriving cold (§4.3 rail).
const FIRST_READS = [
  { href: '/information/general/types-of-motorsport', label: 'The types of motorsport' },
  { href: '/information/general', label: 'Motorsport 101 — the basics' },
  { href: '/information/series-guides', label: 'A guide to every championship' },
];

// The inverted hub (design handoff §4.3, panel 9a): the ~75 written answers
// ARE the product, so they lead — ask field, most-asked, the weekend-format
// band — and the topic filing cabinet drops to the foot.
export default async function InformationHub() {
  const [all, featured, seriesMeta] = await Promise.all([
    getAllInfoEntries(),
    getIndexedInfoEntries(),
    loadAllSeriesMeta(),
  ]);

  const verifiedByTopic = new Map<string, number>();
  for (const e of all) {
    if (e.review === 'verified') {
      verifiedByTopic.set(e.topic, (verifiedByTopic.get(e.topic) ?? 0) + 1);
    }
  }

  const mostAsked = featured.filter(e => e.kind === 'qa').slice(0, 10);
  const askIndex = all
    .filter(e => e.kind === 'qa')
    .map(e => ({ q: e.question, href: entryHref(e) }));

  const weekendChips = seriesMeta
    .map(m => {
      const key = WEEKEND_WORKS_KEY[m.slug] ?? m.slug;
      const entry = all.find(e => e.slug.includes('weekend-works') && e.slug.includes(key));
      return entry ? { name: m.name, color: m.color, href: entryHref(entry) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={PAGE_WIDE}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Information', url: `${SITE_URL}/information` },
        ])}
      />
      <div>
        {/* 1 — title + the ask field. */}
        <header className="mb-8">
          <h1 className="font-serif text-[40px] font-medium leading-none tracking-[-0.02em] text-text lg:text-[50px]">
            Motorsport, explained
          </h1>
          <p className="mt-2 mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            {askIndex.length} answers, all sourced · linked into the live data
          </p>
          <AskField entries={askIndex} />
        </header>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            {/* 2 — most asked. */}
            {mostAsked.length > 0 && (
              <section aria-label="Most asked" className="mb-10">
                <div className="mb-3 border-b border-text pb-1">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Most asked
                  </span>
                </div>
                <div className="grid gap-x-10 md:grid-cols-2">
                  {mostAsked.map(e => (
                    <Link key={entryHref(e)} href={entryHref(e)} className="group block border-b border-border py-2.5">
                      <span className="block font-serif text-[17px] font-semibold leading-snug text-text group-hover:underline">
                        {e.question}
                      </span>
                      {e.summary && (
                        <span className="mt-0.5 line-clamp-1 block text-sm text-text-muted">{e.summary}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* 4 — how a race weekend works, one chip per championship: the
                most useful thing here for a first-time viewer of an
                unfamiliar series (§4.3). */}
            {weekendChips.length > 0 && (
              <section aria-label="How a race weekend works" className="mb-10">
                <div className="mb-3 flex items-baseline justify-between border-b border-text pb-1">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    How a race weekend works
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-text-faint">{weekendChips.length}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {weekendChips.map(c => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className="inline-flex min-h-11 items-center gap-2 border border-border-strong px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted transition-colors duration-(--duration-fast) hover:border-text hover:text-text"
                    >
                      <span aria-hidden="true" className="h-[13px] w-[3px] shrink-0" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* 5 — the ten topics, at the foot where a filing cabinet belongs. */}
            <section aria-label="Browse by topic">
              <div className="mb-3 border-b border-text pb-1">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Browse by topic
                </span>
              </div>
              <div className="grid gap-x-8 sm:grid-cols-2">
                {INFO_TOPICS.map(t => (
                  <Link
                    key={t.id}
                    href={`/information/${t.id}`}
                    className="flex min-h-11 items-baseline justify-between gap-3 border-b border-border py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-[16px] font-semibold text-text">{t.label}</span>
                      <span className="block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">
                        /{t.id} →
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-text-faint">
                      {verifiedByTopic.get(t.id) ?? 0}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* 3 — the rail: three numbered first reads + the circuit map. */}
          <aside>
            <div className="mb-3 border-b border-text pb-1">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                New to motorsport?
              </span>
            </div>
            <ol>
              {FIRST_READS.map((r, i) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="flex min-h-11 items-baseline gap-3 border-b border-border py-2 transition-colors duration-(--duration-fast) hover:bg-surface"
                  >
                    <span className="w-4 shrink-0 text-right font-mono text-[12px] font-semibold tabular-nums text-brand">
                      {i + 1}
                    </span>
                    <span className="font-serif text-[15px] font-semibold leading-snug text-text">{r.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <Link
              href="/information/map"
              className="mt-4 block border border-border-strong p-3 transition-colors duration-(--duration-fast) hover:border-text"
            >
              <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
                Circuit map
              </span>
              <span className="mt-1 block font-serif text-[15px] font-semibold leading-snug text-text">
                All 138 venues on one map
              </span>
            </Link>
            <div className="mt-6 border-t border-border pt-3">
              <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                Per-series guides
              </span>
              <div className="mt-2 grid grid-cols-2 gap-x-3">
                {[...seriesMeta]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(s => (
                    <Link
                      key={s.slug}
                      href={`/information/${topicForSeries(s.slug)}/the-history-of-${s.slug}`}
                      className="truncate py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint hover:text-text"
                    >
                      {s.name}
                    </Link>
                  ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
