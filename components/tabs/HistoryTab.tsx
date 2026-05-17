import { Series } from '@/lib/types';
import { fetchWikipediaSummary } from '@/lib/wikipedia';
import { fetchWikipediaSection } from '@/lib/wikipedia-article';
import { PlaceholderTab } from './PlaceholderTab';

const HISTORY_HEADINGS = [
  'History',
  'Origins',
  'Background',
  'Origin and history',
];

export async function HistoryTab({ series }: { series: Series }) {
  const page = series.meta.wikipediaPage;
  if (!page) return <PlaceholderTab tabLabel="History" />;

  const section = await fetchWikipediaSection(page, HISTORY_HEADINGS);
  if (section) {
    return (
      <article className="rounded-2xl bg-surface/40 border border-border/60 p-5 md:p-6">
        <header className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-text text-xl font-bold tracking-tight">History</h2>
          <span className="text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold">
            Wikipedia
          </span>
        </header>
        <div
          className="prose dark:prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:text-text prose-a:text-text-muted prose-a:underline-offset-2 prose-img:rounded-lg"
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
    );
  }

  const summary = await fetchWikipediaSummary(page);
  if (!summary) {
    return (
      <div className="rounded-2xl bg-surface/40 border border-border/60 p-6 text-center">
        <div className="text-text text-base font-medium mb-1">History</div>
        <div className="text-text-faint text-sm">
          Wikipedia article unavailable right now.
        </div>
      </div>
    );
  }

  return (
    <article className="rounded-2xl bg-surface/40 border border-border/60 p-5 md:p-6">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-text text-xl font-bold tracking-tight">History</h2>
        <span className="text-[10px] uppercase tracking-[0.16em] text-text-faint font-semibold">
          Overview
        </span>
      </header>
      {summary.description && (
        <p className="text-text-muted text-sm italic mb-4">{summary.description}</p>
      )}
      <p className="text-text text-base leading-relaxed">{summary.extract}</p>
      <footer className="mt-6 pt-4 border-t border-border text-xs text-text-faint">
        Source:{' '}
        <a
          href={summary.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:text-text underline underline-offset-2 transition-colors duration-(--duration-fast)"
        >
          Wikipedia ↗
        </a>
      </footer>
    </article>
  );
}
