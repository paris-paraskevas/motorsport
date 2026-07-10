import Link from 'next/link';
import type { Metadata } from 'next';
import { loadAllSeriesMeta } from '@/lib/series';
import { topicForSeries } from '@/lib/information/topics';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { SITE_URL, PAGE_WIDE } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';

// Dedicated "Series guides" landing — every championship's about/history/rules
// in one indexable page (the Learn + Series nav menus link here). The per-series
// history/rules guides live in /information/<topic>/... (curated.ts guides);
// "overview" points at the series page. A static route, so it takes precedence
// over the dynamic /information/[topic] and is indexed via the sitemap.
export const revalidate = 3600;

const TITLE = 'Series guides — every motorsport championship explained';
const DESCRIPTION =
  'Guides to every championship we cover — what each series is, its full history, and how the racing and points work: F1, MotoGP, NASCAR, WEC, IndyCar, WRC, F2, F3 and more.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/information/series-guides' },
  ...withSocialMeta({ title: TITLE, description: DESCRIPTION, path: '/information/series-guides' }),
};

export default async function SeriesGuidesPage() {
  const series = (await loadAllSeriesMeta()).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={PAGE_WIDE}>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: SITE_URL },
          { name: 'Information', url: `${SITE_URL}/information` },
          { name: 'Series guides', url: `${SITE_URL}/information/series-guides` },
        ])}
      />

      <header className="mb-8 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-tint mb-3">
          Learn
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-wide leading-[0.95] text-text">
          Series guides<span className="text-tint">.</span>
        </h1>
        <p className="mt-4 text-base text-text-muted leading-relaxed max-w-2xl">
          Every championship we cover — what it is, its full history, and how the racing and
          points work. New to the sport? Start with{' '}
          <Link
            href="/information/general/types-of-motorsport"
            className="text-tint hover:underline underline-offset-2"
          >
            the different types of motorsport
          </Link>
          .
        </p>
      </header>

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {series.map((s) => {
          const topic = topicForSeries(s.slug);
          const links: Array<{ label: string; href: string }> = [
            { label: 'overview', href: `/series/${s.slug}` },
            { label: 'history', href: `/information/${topic}/the-history-of-${s.slug}` },
            { label: 'rules', href: `/information/${topic}/${s.slug}-rules-explained` },
          ];
          return (
            <div key={s.slug} className="border-b border-border py-2">
              <div className="text-text font-semibold">{s.name}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 font-mono text-[10px] uppercase tracking-[0.12em]">
                {links.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="text-text-faint hover:text-tint transition-colors duration-(--duration-fast)"
                  >
                    {l.label} →
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
