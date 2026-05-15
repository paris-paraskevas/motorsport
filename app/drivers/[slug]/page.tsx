import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { findDriverBySlug, loadAllDrivers } from '@/lib/people';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const drivers = await loadAllDrivers();
  return drivers.map(d => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const driver = await findDriverBySlug(slug);
  if (!driver) return { title: 'Driver not found · Paddock' };
  return {
    title: `${driver.name} · Paddock`,
    description: `${driver.name}, ${driver.team} (${driver.seriesName}).`,
  };
}

export default async function DriverPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const driver = await findDriverBySlug(slug);
  if (!driver) notFound();

  return (
    <div
      className="relative max-w-2xl lg:max-w-4xl mx-auto p-4 md:p-6 lg:p-8 pb-16"
      style={{ ['--series-color' as string]: driver.seriesColor } as React.CSSProperties}
    >
      <div
        className="absolute inset-x-0 top-0 h-72 -z-10 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${driver.seriesColor}1f 0%, transparent 70%)`,
        }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-px -z-10"
        style={{
          background: `linear-gradient(90deg, transparent, ${driver.seriesColor}, transparent)`,
        }}
      />

      <Link
        href={`/series/${driver.seriesSlug}?tab=drivers`}
        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
      >
        <ChevronLeft size={14} />
        Back to {driver.seriesName} drivers
      </Link>

      <header className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: driver.seriesColor,
              boxShadow: `0 0 12px ${driver.seriesColor}`,
            }}
          />
          <Link
            href={`/series/${driver.seriesSlug}`}
            className="text-[11px] uppercase tracking-[0.18em] font-semibold hover:underline underline-offset-4"
            style={{ color: driver.seriesColor }}
          >
            {driver.seriesName}
          </Link>
        </div>

        <h1 className="text-zinc-50 text-4xl md:text-5xl font-bold tracking-tight leading-tight">
          {driver.name}
        </h1>

        <div className="mt-4 flex items-baseline gap-3 flex-wrap">
          {driver.number != null && (
            <span className="text-2xl font-mono tabular-nums text-zinc-400">
              #{driver.number}
            </span>
          )}
          {driver.code && (
            <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-300 bg-zinc-900/70 border border-zinc-800 rounded-md px-2 py-1">
              {driver.code}
            </span>
          )}
        </div>
      </header>

      <section className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 p-5 md:p-6">
        <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-semibold mb-2">
          Team
        </div>
        <Link
          href={`/teams/${driver.teamSlug}`}
          className="group inline-flex items-center gap-3"
          style={
            driver.teamColor
              ? {
                  borderLeft: `3px solid ${driver.teamColor}`,
                  paddingLeft: '0.75rem',
                }
              : undefined
          }
        >
          <span className="text-zinc-100 text-xl font-semibold group-hover:text-white transition-colors">
            {driver.team}
          </span>
          <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
            View team →
          </span>
        </Link>
      </section>
    </div>
  );
}
