import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireAdmin } from '@/lib/admin-guard';
import { PAGE_WIDE, SITE_URL } from '@/lib/site';
import { AdminNav } from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Shared, admin-gated shell for the /admin console: an "Account" escape hatch, the
// amber nav rail, and the page container. requireAdmin() 404s non-admins here
// (defence in depth — every route also gates itself); robots noindex keeps the
// console out of search. The rail sticks below the fixed h-14 header on lg+ and is
// a horizontally-scrollable strip on mobile.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className={PAGE_WIDE}>
      {/* Absolute apex, not a relative "/settings": on the admin-only dev.
          subdomain a relative link resolves to dev.paddock-tracker.com/settings,
          which 404s (proxy.ts serves only admin routes on dev.*). */}
      <Link
        href={`${SITE_URL}/settings`}
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted transition-colors duration-(--duration-fast) hover:text-text"
      >
        <ArrowLeft size={13} /> Account
      </Link>
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
