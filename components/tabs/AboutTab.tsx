import path from 'node:path';
import { Series } from '@/lib/types';
import { fetchWikipediaSummary } from '@/lib/wikipedia';
import { loadMarkdownWithFrontmatter } from '@/lib/content';
import { PlaceholderTab } from './PlaceholderTab';

function firstSentences(text: string, count: number): string {
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!matches || matches.length === 0) return text.trim();
  return matches.slice(0, count).join('').trim();
}

export async function AboutTab({ series }: { series: Series }) {
  const page = series.meta.wikipediaPage;
  const overview = series.overview?.trim() ?? '';
  // F1's curated overview (content/series/f1/overview.md — race-weekend shape,
  // points, the 2026 reset) is the flagship series' introduction, so give it a
  // labelled section header like its About-tab siblings (Rules essentials /
  // About {name}) instead of rendering as an orphaned intro block. Other series
  // keep the bare render — this is an F1-only surface polish, guarded by slug
  // the same way SeriesPageView gates the F1 Telemetry hub.
  const isF1 = series.meta.slug === 'f1';
  // Rules essentials live INSIDE About (operator decision 2026-06-11 — the
  // Rules tab stays retired per 0.19.0). Curated per series under
  // content/series/<slug>/rules.md; absent file = no section.
  const rulesPath = path.join(
    process.cwd(),
    'content',
    'series',
    series.meta.slug,
    'rules.md',
  );
  const rules = await loadMarkdownWithFrontmatter(rulesPath).catch(() => null);
  const summary = page ? await fetchWikipediaSummary(page) : null;

  if (!overview && !summary) {
    return (
      <div className="space-y-4">
        <PlaceholderTab tabLabel="About" />
        <ExternalSourcesCard series={series} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {overview &&
        (isF1 ? (
          <section className="border-y border-border py-5 md:py-6">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
              Series overview
            </h2>
            <article
              className="prose dark:prose-invert prose-sm max-w-none
                         prose-headings:tracking-tight prose-headings:text-text
                         prose-h2:text-base prose-h2:mt-6 prose-h2:mb-3 prose-h2:font-semibold
                         prose-p:leading-relaxed
                         prose-strong:text-text"
              dangerouslySetInnerHTML={{ __html: overview }}
            />
          </section>
        ) : (
          <article
            className="border-y border-border py-5 md:py-6
                       prose dark:prose-invert prose-sm max-w-none
                       prose-headings:tracking-tight prose-headings:text-text
                       prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:font-semibold
                       prose-p:leading-relaxed
                       prose-strong:text-text"
            dangerouslySetInnerHTML={{ __html: overview }}
          />
        ))}
      {rules?.html && (
        <section className="border-y border-border py-5 md:py-6">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-text mb-3">
            Rules essentials
          </h2>
          <article
            className="prose dark:prose-invert prose-sm max-w-none
                       prose-headings:tracking-tight prose-headings:text-text
                       prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-h2:font-semibold
                       prose-p:leading-relaxed prose-li:leading-relaxed
                       prose-strong:text-text"
            dangerouslySetInnerHTML={{ __html: rules.html }}
          />
        </section>
      )}
      {summary && (
        <div className="border-y border-border py-5">
          <h2 className="text-text text-lg font-semibold mb-3">
            About {series.meta.name}
          </h2>
          {summary.description && (
            <p className="text-text-muted text-sm mb-3">{summary.description}</p>
          )}
          <blockquote className="border-l-2 border-border-strong pl-4 text-text-muted text-sm leading-relaxed">
            {firstSentences(summary.extract, 3)}
          </blockquote>
          <div className="mt-4 text-xs text-text-faint">
            Source:{' '}
            <a
              href={summary.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
            >
              Wikipedia &rarr;
            </a>
          </div>
        </div>
      )}
      <ExternalSourcesCard series={series} />
    </div>
  );
}

// Official links (formerly the Rules tab's "Further reading" card — that tab
// was retired in 0.19.0; no series ever shipped a curated rules.md).
function ExternalSourcesCard({ series }: { series: Series }) {
  const items: Array<{ label: string; url: string }> = [];
  if (series.meta.officialSite) {
    items.push({ label: 'Official site', url: series.meta.officialSite });
  }
  if (series.meta.officialStandingsUrl) {
    items.push({ label: 'Standings', url: series.meta.officialStandingsUrl });
  }
  if (items.length === 0) return null;

  return (
    <div className="border-y border-border py-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold mb-3">
        Further reading
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-text-muted hover:text-text border border-border hover:border-border-strong px-3 py-1.5 transition-colors duration-(--duration-fast)"
          >
            {item.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
