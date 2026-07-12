'use client';
import Link from 'next/link';
import { ArrowUpRight, LayoutDashboard, MessageSquare } from 'lucide-react';
import { useAuth, useUser } from '@clerk/nextjs';

// The staff-only rows on /settings, resolved CLIENT-side via useUser so the
// Account page's server render never pays a currentUser() Clerk backend hop
// (which added ~100-500ms to /settings — a 0.99.0 regression). Renders nothing
// until Clerk loads and confirms a staff role (mirrors HeaderUtils).
export function AccountStaffLinks() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const role = user?.publicMetadata?.role;
  const isStaff = role === 'admin' || role === 'moderator';
  const isAdmin = role === 'admin';
  if (!isLoaded || !isSignedIn || !isStaff) return null;
  return (
    <>
      <Link
        href="/feedback"
        className="group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface"
      >
        <MessageSquare size={18} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-text text-base font-semibold">Feedback</span>
          <span className="block text-text-faint text-xs">Triage bugs, ideas and comments (staff)</span>
        </span>
        <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
      </Link>
      {isAdmin && (
        // Cross-subdomain link to the admin surface — a full navigation (plain
        // <a>, not next/link) since dev.paddock-tracker.com is a different host,
        // itself admin-locked in proxy.ts. Admin-only (moderators don't get it).
        <a
          href="https://dev.paddock-tracker.com"
          className="group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          <LayoutDashboard size={18} className="shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-text text-base font-semibold">Admin</span>
            <span className="block text-text-faint text-xs">The admin dashboard on dev.paddock-tracker.com</span>
          </span>
          <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
        </a>
      )}
    </>
  );
}
