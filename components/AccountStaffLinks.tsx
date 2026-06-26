'use client';
import Link from 'next/link';
import { ArrowUpRight, MessageSquare } from 'lucide-react';
import { useAuth, useUser } from '@clerk/nextjs';

// The staff-only Feedback row on /settings, resolved CLIENT-side via useUser so
// the Account page's server render never pays a currentUser() Clerk backend hop
// (which added ~100-500ms to /settings — a 0.99.0 regression). Renders nothing
// until Clerk loads and confirms an admin/moderator role (mirrors HeaderUtils).
export function AccountStaffLinks() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const role = user?.publicMetadata?.role;
  const isStaff = role === 'admin' || role === 'moderator';
  if (!isLoaded || !isSignedIn || !isStaff) return null;
  return (
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
  );
}
