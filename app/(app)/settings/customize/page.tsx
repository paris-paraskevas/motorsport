import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { HomeCustomizePanel } from '@/components/HomeCustomizeBanner';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Customise',
  robots: { index: false, follow: false },
};

// Dedicated home-customisation surface (moved out of the Account hub). Hosts the
// live preview + per-block controls, plus a widget-discovery gallery advertising
// what's coming. URL: /settings/customize. Behaviour/persistence unchanged — the
// panel reuses the same useHomeLayout hook as the former inline banner.
export default function CustomizePage() {
  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16">
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <ArrowLeft size={13} /> Account
      </Link>
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand" />
        <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
          Customise<span className="text-brand">.</span>
        </h1>
      </header>
      <HomeCustomizePanel />
    </div>
  );
}
