import { Series } from '@/lib/types';
import { fetchWikipediaSummary } from '@/lib/wikipedia';
import { PlaceholderTab } from './PlaceholderTab';

export async function HistoryTab({ series }: { series: Series }) {
  const page = series.meta.wikipediaPage;
  if (!page) return <PlaceholderTab tabLabel="History" />;

  const summary = await fetchWikipediaSummary(page);

  if (!summary) {
    return (
      <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-5">
        <div className="text-zinc-300 text-base font-medium mb-1">History</div>
        <div className="text-zinc-500 text-sm">
          Wikipedia article unavailable right now.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-5">
      <h2 className="text-zinc-100 text-xl font-semibold mb-2">History</h2>
      {summary.description && (
        <p className="text-zinc-400 text-sm italic mb-4">{summary.description}</p>
      )}
      <p className="text-zinc-200 text-base leading-relaxed whitespace-pre-line">
        {summary.extract}
      </p>
      <div className="mt-5 text-xs text-zinc-500">
        Source:{' '}
        <a
          href={summary.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
        >
          Wikipedia &rarr;
        </a>
      </div>
    </div>
  );
}
