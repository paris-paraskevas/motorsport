import path from 'path';
import { Series } from '@/lib/types';
import { loadMarkdownWithFrontmatter } from '@/lib/content';
import { PlaceholderTab } from './PlaceholderTab';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatLastUpdated(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!iso) return value;
  const day = parseInt(iso[3], 10);
  const monthIndex = parseInt(iso[2], 10) - 1;
  const year = iso[1];
  if (!MONTHS[monthIndex]) return value;
  return `${day} ${MONTHS[monthIndex]} ${year}`;
}

export async function HistoryTab({ series }: { series: Series }) {
  const filePath = path.join(
    process.cwd(),
    'content',
    'series',
    series.meta.slug,
    'history.md',
  );
  const { html, frontmatter } = await loadMarkdownWithFrontmatter(filePath);

  if (!html) return <PlaceholderTab tabLabel="History" />;

  const author = typeof frontmatter.author === 'string' ? frontmatter.author : null;
  const lastUpdated = formatLastUpdated(frontmatter['last-updated']);

  return (
    <article className="rounded-2xl bg-surface/40 border border-border/60 p-5 md:p-6">
      <header className="mb-4">
        <h2 className="text-text text-xl font-bold tracking-tight">History</h2>
      </header>
      <div
        className="prose dark:prose-invert prose-sm max-w-none
                   prose-headings:font-semibold prose-headings:text-text
                   prose-h2:text-base prose-h2:mt-6 prose-h2:mb-3
                   prose-h3:text-sm prose-h3:mt-5 prose-h3:mb-2
                   prose-p:leading-relaxed
                   prose-a:text-text-muted prose-a:underline-offset-2"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {author && (
        <footer className="mt-6 pt-4 border-t border-border text-xs text-text-faint">
          Authored by {author}.
          {lastUpdated && ` Last updated ${lastUpdated}.`}
        </footer>
      )}
    </article>
  );
}
