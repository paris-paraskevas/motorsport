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

  // Prefer a real "History" section from the full article.
  const section = await fetchWikipediaSection(page, HISTORY_HEADINGS);
  if (section) {
    return (
      <article className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-5 md:p-6">
        <header className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-zinc-50 text-xl font-bold tracking-tight">History</h2>
          <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">
            Wikipedia
          </span>
        </header>
        <div
          className="prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-headings:text-zinc-100 prose-a:text-zinc-300 prose-a:underline-offset-2 prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: section.html }}
        />
        <footer className="mt-6 pt-4 border-t border-zinc-800 text-xs text-zinc-500">
          Source:{' '}
          <a
            href={section.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-300 hover:text-zinc-100 underline underline-offset-2"
          >
            {series.meta.name} on Wikipedia ↗
          </a>
        </footer>
      </article>
    );
  }

  // Fall back to the article summary — at least something rather than nothing.
  const summary = await fetchWikipediaSummary(page);
  if (!summary) {
    return (
      <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-6 text-center">
        <div className="text-zinc-300 text-base font-medium mb-1">History</div>
        <div className="text-zinc-500 text-sm">
          Wikipedia article unavailable right now.
        </div>
      </div>
    );
  }

  return (
    <article className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-5 md:p-6">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-zinc-50 text-xl font-bold tracking-tight">History</h2>
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">
          Overview
        </span>
      </header>
      {summary.description && (
        <p className="text-zinc-400 text-sm italic mb-4">{summary.description}</p>
      )}
      <p className="text-zinc-200 text-base leading-relaxed">{summary.extract}</p>
      <footer className="mt-6 pt-4 border-t border-zinc-800 text-xs text-zinc-500">
        Source:{' '}
        <a
          href={summary.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-300 hover:text-zinc-100 underline underline-offset-2"
        >
          Wikipedia ↗
        </a>
      </footer>
    </article>
  );
}
