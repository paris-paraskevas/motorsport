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
  const overview = series.overview?.trim() ?? '';
  const summary = page ? await fetchWikipediaSummary(page) : null;

  if (!overview && !summary) {
    return <PlaceholderTab tabLabel="About" />;
  }

  return (
    <div className="space-y-4">
      {overview && (
        <article
          className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-5 md:p-6
                     prose prose-invert prose-sm max-w-none
                     prose-headings:tracking-tight prose-headings:text-zinc-100
                     prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:font-semibold
                     prose-p:leading-relaxed
                     prose-strong:text-zinc-100"
          dangerouslySetInnerHTML={{ __html: overview }}
        />
      )}
      {summary && (
        <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-5">
          <h2 className="text-zinc-100 text-lg font-semibold mb-3">
            About {series.meta.name}
          </h2>
          {summary.description && (
            <p className="text-zinc-400 text-sm mb-3">{summary.description}</p>
          )}
          <blockquote className="border-l-2 border-zinc-700 pl-4 text-zinc-300 text-sm leading-relaxed">
            {firstSentences(summary.extract, 3)}
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
      )}
    </div>
  );
}
