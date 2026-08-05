import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageSquare, Newspaper, Sparkles, Upload } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-guard';
import { loadAllSeries } from '@/lib/series';
import { AdminPageHeader, TelemetryPanel } from '@/components/admin/AdminUI';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tools · Admin' };

// Tools route: the existing admin surfaces gathered as links, plus the per-series
// calendar-feed status (moved here from the public /about page — its audience is
// operators, not visitors). force-dynamic, so the feed check runs fresh per view.
export default async function AdminToolsPage() {
  await requireAdmin();
  const series = [...(await loadAllSeries())].sort((a, b) => a.meta.name.localeCompare(b.meta.name));
  const liveCount = series.filter(s => !s.stale).length;

  return (
    <div>
      <AdminPageHeader title="Tools" tagline="Existing admin surfaces, gathered in one place" />
      <div className="grid gap-2 sm:grid-cols-2">
        <ToolLink href="/settings/assistant" icon={Sparkles} label="Assistant insights" desc="What people ask the Race Engineer" />
        <ToolLink href="/studio" icon={Newspaper} label="Studio" desc="Write, review, schedule posts" />
        <ToolLink href="/social/threads" icon={MessageSquare} label="Threads moderation" desc="Approve community threads" />
        <ToolLink href="/feedback" icon={MessageSquare} label="Feedback board" desc="What users report" />
        <ToolLink href="/contribute" icon={Upload} label="Feeder intake" desc="Public series-data submit form" />
      </div>

      <TelemetryPanel
        title="Calendar feed status"
        meta={`${liveCount}/${series.length} live`}
        flush
        className="mt-6"
      >
        <ul className="divide-y divide-border">
          {series.map(s => (
            <li key={s.meta.slug} className="flex items-baseline gap-3 px-4 py-2">
              <span className="w-40 shrink-0 truncate text-sm text-text sm:w-48">{s.meta.name}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-faint">
                {s.meta.icsUrl.trim() !== '' ? s.meta.icsUrl : 'no feed configured'}
              </span>
              <span
                className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] ${
                  s.stale ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {s.stale ? 'fallback' : 'live'}
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-border px-4 py-2 text-[11px] leading-relaxed text-text-faint">
          Fetched live when this page loads. Fallback = the bundled calendar file served because the live fetch failed
          or no feed is configured. Session-time overrides and curated rounds apply on top of either.
        </p>
      </TelemetryPanel>
    </div>
  );
}

function ToolLink({
  href,
  icon: Icon,
  label,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-3 transition-colors duration-(--duration-fast) hover:border-brand"
    >
      <span aria-hidden className="shrink-0 text-text-muted">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text">{label}</span>
        <span className="block truncate text-xs text-text-faint">{desc}</span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-text-faint transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
