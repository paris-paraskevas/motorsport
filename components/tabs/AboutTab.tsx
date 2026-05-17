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
          className="rounded-xl bg-surface/40 border border-border/60 p-5 md:p-6
                     prose prose-invert prose-sm max-w-none
                     prose-headings:tracking-tight prose-headings:text-text
                     prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:font-semibold
                     prose-p:leading-relaxed
                     prose-strong:text-text"
          dangerouslySetInnerHTML={{ __html: overview }}
        />
      )}
      {summary && (
        <div className="rounded-xl bg-surface/40 border border-border/60 p-5">
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
    </div>
  );
}
