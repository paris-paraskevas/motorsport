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

export async function RulesTab({ series }: { series: Series }) {
  const filePath = path.join(
    process.cwd(),
    'content',
    'series',
    series.meta.slug,
    'rules.md',
  );
  const { html, frontmatter } = await loadMarkdownWithFrontmatter(filePath);

  const author = typeof frontmatter.author === 'string' ? frontmatter.author : null;
  const lastUpdated = formatLastUpdated(frontmatter['last-updated']);

  return (
    <div className="space-y-4">
      {html ? (
        <article className="rounded-2xl bg-surface/40 border border-border/60 p-5 md:p-6">
          <header className="mb-4">
            <h2 className="text-text text-xl font-bold tracking-tight">Rules</h2>
          </header>
          <div
            className="prose dark:prose-invert prose-sm max-w-none
                       prose-headings:font-semibold prose-headings:text-text
                       prose-h2:text-base prose-h2:mt-6 prose-h2:mb-3
                       prose-h3:text-sm prose-h3:mt-5 prose-h3:mb-2
                       prose-p:leading-relaxed
                       prose-a:text-text-muted prose-a:underline-offset-2
                       prose-table:text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {author && (
            <footer className="mt-6 pt-4 border-t border-border text-xs text-text-faint">
              Authored by {author}.
              {lastUpdated && ` Last updated ${lastUpdated}.`}
            </footer>
          )}
        </article>
      ) : (
        <PlaceholderTab tabLabel="Rules" />
      )}
      <ExternalSourcesCard series={series} />
    </div>
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
