import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Database } from 'lucide-react';
import { PAGE_READ } from '@/lib/site';
import { ContributeForm } from './ContributeForm';

export const metadata: Metadata = {
  title: 'Add your series',
  description:
    'Run a karting, junior open-wheel or regional championship? Send us your schedule and results and we’ll add your series to Paddock.',
  // A public outreach page, but not a page we want ranking/competing in search.
  robots: { index: false, follow: true },
};

// Public feeder-series intake page (design: docs/research/2026-07-06-feeder-series-intake.md).
// Linked from an outreach email (optionally with a ?ref= attribution token). No
// account required. The form posts to /api/contribute → staging for operator review.
export default function ContributePage() {
  return (
    <div className={PAGE_READ}>
      <header className="mb-6 flex items-stretch gap-3">
        <span aria-hidden className="w-1 shrink-0 bg-brand-fill" />
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
            Add your series<span className="text-brand">.</span>
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-muted">
            Run a karting, junior open-wheel or regional championship? Send us your calendar and results in
            whatever format you already have — a spreadsheet, a PDF, a JSON export, or just a link — and we’ll
            do the work of turning it into a series page on Paddock.
          </p>
        </div>
      </header>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-surface-elevated p-4">
        <Database size={18} className="mt-0.5 shrink-0 text-text-faint" />
        <p className="text-sm leading-relaxed text-text-muted">
          Nothing goes live automatically. We review everything by hand and check it against the sources before
          your series appears — so the data stays accurate. We’ll email you at the address you give below.
        </p>
      </div>

      <Suspense fallback={null}>
        <ContributeForm />
      </Suspense>
    </div>
  );
}
