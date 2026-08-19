import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { loadAllSeriesMeta } from '@/lib/series';
import { SettingsClient } from '@/components/SettingsClient';
import { PAGE_WIDE } from '@/lib/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Championships',
  robots: { index: false, follow: false },
};

export default async function AccountSeriesPage() {
  // NavSeriesMeta pick — SettingsClient is a client component; see the warning
  // on SeriesMeta (full meta would serialize icsUrl into the page payload).
  const seriesList = (await loadAllSeriesMeta()).map(({ slug, name, color, category }) => ({
    slug,
    name,
    color,
    category,
  }));
  return (
    <div className={`${PAGE_WIDE} mx-auto max-w-[880px]`}>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <ArrowLeft size={13} /> Account
      </Link>
      {/* Paper masthead (round-2 ③). */}
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-[38px] font-medium leading-none tracking-[-0.02em] text-text md:text-[46px]">
          Championships
        </h1>
        <p className="mt-2 font-serif text-[16px] leading-snug text-text-muted">
          Follow yours and the calendar and the wire narrow to them.
        </p>
      </header>
      <SettingsClient seriesList={seriesList} />
    </div>
  );
}
