import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

// The admin-gated shell under /admin. Since 2026-09-09 the designer is the
// whole admin area (the operator retired the console: "im confident i only
// want to keep the designer"); it draws its own top bar, workspaces and mode
// switch over the full viewport, so this layout is the gate and nothing else.
// requireAdmin() 404s non-admins here (defence in depth — the page gates
// itself too); robots noindex keeps the area out of search.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
