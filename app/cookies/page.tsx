import path from 'path';
import type { Metadata } from 'next';
import { loadMarkdownAsHtml } from '@/lib/content';
import { ReopenConsentButton } from '@/components/ReopenConsentButton';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Cookie Policy',
};

export default async function CookiesPage() {
  const html = await loadMarkdownAsHtml(
    path.join(process.cwd(), 'content', 'legal', 'cookies.md'),
  );

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-text-faint font-semibold mb-2">
          Legal
        </div>
      </header>

      <article
        className="prose dark:prose-invert prose-zinc max-w-none
                   prose-headings:tracking-tight
                   prose-h1:text-3xl md:prose-h1:text-4xl prose-h1:font-bold prose-h1:leading-tight prose-h1:mb-4
                   prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
                   prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
                   prose-p:leading-relaxed
                   prose-ul:my-2 prose-li:my-1
                   prose-strong:text-text
                   prose-a:text-text prose-a:underline-offset-4
                   prose-table:my-4 prose-table:text-sm
                   prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:text-left
                   prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:align-top"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="mt-8 rounded-2xl border border-border bg-surface/40 p-5 md:p-6">
        <div className="text-text text-base font-semibold mb-2">
          Change your cookie preferences
        </div>
        <p className="text-sm text-text-muted leading-relaxed mb-4">
          Re-open the consent banner to update which categories you allow. Your choice is saved immediately and applied site-wide.
        </p>
        <ReopenConsentButton />
      </div>
    </div>
  );
}
