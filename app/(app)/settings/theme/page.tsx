import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ThemePicker } from '@/components/theme/ThemePicker';
import { PAGE_READ } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Theme',
  robots: { index: false, follow: false },
};

// Appearance is device-local (localStorage), so unlike the sibling settings
// pages this one has no auth-dependent content — guests theme too.
export default function ThemePage() {
  return (
    <div className={PAGE_READ}>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <ArrowLeft size={13} /> Account
      </Link>
      <header className="mb-5 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1 shrink-0 bg-brand-fill" />
        <h1 className="font-display text-3xl md:text-4xl font-extrabold uppercase tracking-wide leading-none text-text">
          Theme<span className="text-brand">.</span>
        </h1>
      </header>
      <ThemePicker />
    </div>
  );
}
