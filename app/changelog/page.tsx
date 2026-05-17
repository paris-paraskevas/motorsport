import path from 'path';
import { loadMarkdownAsHtml } from '@/lib/content';
import { APP_VERSION } from '@/lib/version';

export const dynamic = 'force-static';

export default async function ChangelogPage() {
  const html = await loadMarkdownAsHtml(
    path.join(process.cwd(), 'RELEASES.md'),
  );

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 font-semibold mb-2">
          Release notes
        </div>
        <h1 className="text-zinc-50 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
          Changelog
        </h1>
        <p className="mt-3 text-sm text-zinc-400">
          Currently running <span className="text-zinc-200 font-medium tnum">v{APP_VERSION}</span>.
        </p>
      </header>

      <article
        className="prose prose-invert prose-zinc max-w-none
                   prose-headings:tracking-tight
                   prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
                   prose-h3:text-sm prose-h3:uppercase prose-h3:tracking-[0.14em] prose-h3:text-zinc-500 prose-h3:font-semibold prose-h3:mt-5
                   prose-ul:my-2 prose-li:my-1
                   prose-strong:text-zinc-100"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
