import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageSquare, Newspaper, Sparkles, Upload } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-guard';
import { AdminPageHeader } from '@/components/admin/AdminUI';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tools · Admin' };

// Tools route: the existing admin surfaces, gathered as links. Pure navigation —
// no data fetch; each destination owns its own gate.
export default async function AdminToolsPage() {
  await requireAdmin();

  return (
    <div>
      <AdminPageHeader title="Tools" tagline="Existing admin surfaces, gathered in one place" />
      <div className="grid gap-2 sm:grid-cols-2">
        <ToolLink href="/settings/assistant" icon={Sparkles} label="Assistant insights" desc="What people ask the Race Engineer" />
        <ToolLink href="/blog" icon={Newspaper} label="Blog queue" desc="Draft → approve → schedule" />
        <ToolLink href="/threads" icon={MessageSquare} label="Threads moderation" desc="Approve community threads" />
        <ToolLink href="/feedback" icon={MessageSquare} label="Feedback board" desc="What users report" />
        <ToolLink href="/contribute" icon={Upload} label="Feeder intake" desc="Public series-data submit form" />
      </div>
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
