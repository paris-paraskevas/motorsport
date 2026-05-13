import { Series } from '@/lib/types';
import { fetchWikipediaSummary } from '@/lib/wikipedia';
import { PlaceholderTab } from './PlaceholderTab';

export async function RulesTab({ series }: { series: Series }) {
  const overview = series.overview?.trim() ?? '';

  if (overview.length > 0) {
    return (
      <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-5">
        <h2 className="text-zinc-100 text-xl font-semibold mb-4">Rules</h2>
        <article
          className="prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: overview }}
        />
        <div className="mt-5 text-xs text-zinc-500">
          Source: {series.meta.name} overview.md
        </div>
      </div>
    );
  }

  const page = series.meta.wikipediaPage;
  if (!page) return <PlaceholderTab tabLabel="Rules" />;

  const summary = await fetchWikipediaSummary(page);
  if (!summary) return <PlaceholderTab tabLabel="Rules" />;

  return (
    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-5">
      <h2 className="text-zinc-100 text-xl font-semibold mb-2">Rules</h2>
      {summary.description && (
        <p className="text-zinc-400 text-sm italic mb-4">{summary.description}</p>
      )}
      <article className="prose prose-invert prose-sm max-w-none">
        <p className="whitespace-pre-line">{summary.extract}</p>
      </article>
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
