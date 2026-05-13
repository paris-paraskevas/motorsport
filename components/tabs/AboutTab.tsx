import { Series } from '@/lib/types';
import { fetchWikipediaSummary } from '@/lib/wikipedia';
import { PlaceholderTab } from './PlaceholderTab';

function firstSentences(text: string, count: number): string {
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!matches || matches.length === 0) return text.trim();
  return matches.slice(0, count).join('').trim();
}

export async function AboutTab({ series }: { series: Series }) {
  const page = series.meta.wikipediaPage;
  if (!page) return <PlaceholderTab tabLabel="About" />;

  const summary = await fetchWikipediaSummary(page);

  if (!summary) {
    return (
      <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-5">
        <div className="text-zinc-300 text-base font-medium mb-1">About {series.meta.name}</div>
        <div className="text-zinc-500 text-sm">
          Wikipedia summary unavailable right now.
        </div>
      </div>
    );
  }

  const lede = firstSentences(summary.extract, 3);

  return (
    <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-5">
      <h2 className="text-zinc-100 text-lg font-semibold mb-3">About {series.meta.name}</h2>
      {summary.description && (
        <p className="text-zinc-400 text-sm mb-3">{summary.description}</p>
      )}
      <blockquote className="border-l-2 border-zinc-700 pl-4 text-zinc-300 text-sm leading-relaxed">
        {lede}
      </blockquote>
      <div className="mt-4 text-xs text-zinc-500">
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
