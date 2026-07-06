import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Assistant',
  description: 'Ask Paddock how to use the site.',
  robots: { index: false, follow: false },
};

// Account-gated help assistant. The API route (/api/assistant) is the real
// security + cost boundary (auth + rate limits there); this page just shows the
// panel to signed-in users and a sign-in teaser to everyone else.
export default async function AssistantPage() {
  const { userId } = await auth();

  return (
    <div className="max-w-2xl lg:max-w-3xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden className="w-1 shrink-0 bg-brand" />
        <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
          Assistant<span className="text-brand">.</span>
        </h1>
      </header>

      {userId ? (
        <AssistantPanel />
      ) : (
        <div className="rounded-2xl border border-border bg-surface-elevated p-6">
          <p className="text-sm text-text-muted leading-relaxed">
            Ask how to use Paddock — following series, customising your home,
            playing the prediction game, finding standings and results. Sign in
            (it&apos;s free) to use the assistant.
          </p>
          <Link
            href="/sign-in"
            className="mt-4 inline-flex items-center rounded-lg bg-text px-4 py-2 text-sm font-medium text-bg transition-opacity duration-(--duration-fast) hover:opacity-90"
          >
            Sign in — it&apos;s free
          </Link>
        </div>
      )}
    </div>
  );
}
