import { Series } from '@/lib/types';
import { fetchWikipediaSummary } from '@/lib/wikipedia';
import { fetchWikipediaSection } from '@/lib/wikipedia-article';
import { PlaceholderTab } from './PlaceholderTab';

const RULES_HEADINGS = [
  'Race format',
  'Format',
  'Regulations',
  'Sporting regulations',
  'Technical regulations',
  'Points system',
  'Points scoring',
  'Scoring',
  'Points',
  'Rules',
];

export async function RulesTab({ series }: { series: Series }) {
  const overview = series.overview?.trim() ?? '';
  const page = series.meta.wikipediaPage;

  const section = page ? await fetchWikipediaSection(page, RULES_HEADINGS) : null;

  if (!section && overview.length === 0) {
    if (!page) return <PlaceholderTab tabLabel="Rules" />;
    const summary = await fetchWikipediaSummary(page);
    if (!summary) return <PlaceholderTab tabLabel="Rules" />;
    return (
      <article className="rounded-2xl bg-surface/40 border border-border/60 p-5 md:p-6">
        <header className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-text text-xl font-bold tracking-tight">Rules</h2>
          <span className="text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold">
            Overview
          </span>
        </header>
        {summary.description && (
          <p className="text-text-muted text-sm italic mb-4">{summary.description}</p>
        )}
        <p className="text-text text-base leading-relaxed">{summary.extract}</p>
        <ExternalSources series={series} primaryUrl={summary.url} />
      </article>
    );
  }

  return (
    <div className="space-y-4">
      {section && (
        <article className="rounded-2xl bg-surface/40 border border-border/60 p-5 md:p-6">
          <header className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-text text-xl font-bold tracking-tight">
              {section.sectionName}
            </h2>
            <span className="text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold">
              Wikipedia
            </span>
          </header>
          <div
            className="prose dark:prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:text-text prose-a:text-text-muted prose-table:text-sm"
            dangerouslySetInnerHTML={{ __html: section.html }}
          />
          <footer className="mt-6 pt-4 border-t border-border text-xs text-text-faint">
            Source:{' '}
            <a
              href={section.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
            >
              {series.meta.name} on Wikipedia ↗
            </a>
          </footer>
        </article>
      )}

      {overview.length > 0 && (
        <article className="rounded-2xl bg-surface/40 border border-border/60 p-5 md:p-6">
          <header className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-text text-xl font-bold tracking-tight">Notes</h2>
            <span className="text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold">
              Curated
            </span>
          </header>
          <div
            className="prose dark:prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: overview }}
          />
        </article>
      )}

      <ExternalSourcesCard series={series} />
    </div>
  );
}

function ExternalSources({
  series,
  primaryUrl,
}: {
  series: Series;
  primaryUrl: string;
}) {
  return (
    <footer className="mt-6 pt-4 border-t border-border text-xs text-text-faint">
      Source:{' '}
      <a
        href={primaryUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
      >
        Wikipedia ↗
      </a>
      {series.meta.officialSite && (
        <>
          {' · '}
          <a
            href={series.meta.officialSite}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
          >
            Official site ↗
          </a>
        </>
      )}
    </footer>
  );
}

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
    <div className="rounded-2xl bg-surface/20 border border-border/60 p-5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold mb-3">
        Further reading
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-3 py-1.5 transition-colors duration-(--duration-fast)"
          >
            {item.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
