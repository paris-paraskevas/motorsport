import Link from 'next/link';
import type { Metadata } from 'next';
import { loadAllSeriesMeta } from '@/lib/series';
import { topicForSeries, aboutGuideForSeries } from '@/lib/information/topics';
import { JsonLd } from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/json-ld';
import { fitDescription, fitTitle, PAGE_WIDE, SITE_URL } from '@/lib/site';
import { withSocialMeta } from '@/lib/seo';
import { pageMetadata, withPageGate } from '@/lib/design/page-frame';

// Dedicated "Series guides" landing — every championship's about/history/rules
// in one indexable page (the Learn + Series nav menus link here). The per-series
// history/rules guides live in /information/<topic>/... (curated.ts guides);
// "overview" points at the series page. A static route, so it takes precedence
// over the dynamic /information/[topic] and is indexed via the sitemap.
export const revalidate = 3600;

// X10b: within Seobility's widths (the old title measured 705 px, the description 1,109).
const TITLE = fitTitle(['Series guides: every championship explained', 'Series guides, every championship', 'Series guides']);
const DESCRIPTION = fitDescription(
  'Guides to every championship we cover: what each series is, its history, and how the racing and points work, from F1 and MotoGP to WEC, IndyCar and WRC.',
);

const BASE_METADATA: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/information/series-guides' },
  ...withSocialMeta({ title: TITLE, description: DESCRIPTION, path: '/information/series-guides' }),
};
export const generateMetadata = pageMetadata('/information/series-guides', BASE_METADATA);

async function SeriesGuidesPage() {
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
        <p className="font-mono text-11 uppercase tracking-[0.18em] font-semibold text-tint mb-3">
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
          const about = aboutGuideForSeries(s.slug);
          const links: Array<{ label: string; href: string }> = [
            ...(about ? [{ label: 'about', href: about }] : []),
            { label: 'overview', href: `/series/${s.slug}` },
            { label: 'history', href: `/information/${topic}/the-history-of-${s.slug}` },
            { label: 'rules', href: `/information/${topic}/${s.slug}-rules-explained` },
          ];
          return (
            <div key={s.slug} className="border-b border-border py-2">
              <div className="text-text font-semibold">{s.name}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 font-mono text-10 uppercase tracking-[0.12em]">
                {links.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="text-text-faint hover:text-tint transition-colors duration-(--duration-fast)"
                  >
                    {l.label} →<span className="sr-only">{` — ${s.name}`}</span>
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

export default withPageGate('/information/series-guides', SeriesGuidesPage);
