'use client';
import Link from 'next/link';
import { ArrowUpRight, LayoutDashboard, MessageSquare, NotebookPen, PenLine } from 'lucide-react';
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
  // Authors are not "staff" for the rows below, but they own a studio + profile —
  // so this component's gate is the union, and each row keeps its own condition.
  // (Inline rather than lib/threads canAuthor: same ladder, kept local like the
  // isStaff line above so this client file adds no import weight.)
  const authors = role === 'contributor' || role === 'writer' || role === 'admin';
  if (!isLoaded || !isSignedIn) return null;
  return (
    <>
      {/* The recruiting doorway (operator, 2026-08-03): every signed-in reader
          who is NOT yet an author sees the invitation where their profile
          picture leads — the header Account pill lands here. */}
      {!authors && !isStaff && (
        <Link
          href="/write-for-us"
          className="group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          <PenLine size={18} className="shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-text text-base font-semibold">Become an author?</span>
            <span className="block text-text-faint text-xs">
              Show us your work, or send us a draft article. It costs nothing.
            </span>
          </span>
          <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
        </Link>
      )}
      {authors && (
        <Link
          href="/studio"
          className="group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          <NotebookPen size={18} className="shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-text text-base font-semibold">Studio</span>
            <span className="block text-text-faint text-xs">Write, submit and track your posts</span>
          </span>
          <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
        </Link>
      )}
      {authors && (
        <Link
          href="/settings/author"
          className="group flex items-center gap-3 border-b border-border py-4 transition-colors duration-(--duration-fast) hover:bg-surface"
        >
          <PenLine size={18} className="shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-text text-base font-semibold">Author profile</span>
            <span className="block text-text-faint text-xs">Your bio, links and which posts show</span>
          </span>
          <ArrowUpRight size={16} className="shrink-0 text-text-faint group-hover:text-text-muted" />
        </Link>
      )}
      {isStaff && (
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
      )}
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
