'use client';
import Link from 'next/link';
import { LogIn, MessageSquare, Settings } from 'lucide-react';
import { SignInButton, useAuth, useUser } from '@clerk/nextjs';
import { NotificationBell } from './NotificationBell';

// Header right cluster — account actions ONLY. Support affordances (Contact,
// Buy me a coffee) live in the Footer's Site column: they are destinations
// people seek out, not things the chrome should sell on every page.
export function HeaderUtils({
  className = '',
}: {
  className?: string;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  // Staff = admin or moderator (Clerk publicMetadata.role) — mirrors lib/threads
  // isStaff; gates the private feedback board link.
  const role = user?.publicMetadata?.role;
  const isStaff = role === 'admin' || role === 'moderator';

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Notification center — sent-push history, signed-in only, all viewports
          (NotificationBell self-gates on Clerk auth and renders nothing when
          signed out). */}
      {isLoaded && isSignedIn && <NotificationBell />}
      {/* Staff-only feedback board (admin + moderator); everyday users never see it. */}
      {isLoaded && isSignedIn && isStaff && (
        <Link
          href="/feedback"
          data-heatmap-id="chrome:feedback"
          className="hidden lg:inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 text-xs font-bold text-black bg-brand-fill hover:bg-brand-deep rounded-full px-3 py-1.5 transition-colors duration-(--duration-fast)"
        >
          <MessageSquare size={13} />
          <span>Feedback</span>
        </Link>
      )}
      {/* Discoverable account access on desktop — the Clerk avatar alone hides
          Paddock's own Account + Customize behind its "Preferences" submenu, so
          PC users couldn't find it (operator-reported). Mobile keeps the bottom
          bar + avatar. */}
      {isLoaded && isSignedIn && (
        <Link
          href="/settings"
          data-heatmap-id="chrome:account"
          className="hidden lg:inline-flex items-center justify-center gap-1.5 min-h-11 min-w-11 text-xs font-bold text-black bg-brand-fill hover:bg-brand-deep rounded-full pl-1 pr-3 py-1 transition-colors duration-(--duration-fast)"
        >
          {user?.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
            </>
          ) : (
            <Settings size={13} className="ml-1.5" />
          )}
          <span>Account</span>
        </Link>
      )}
      {isLoaded && !isSignedIn && (
        <SignInButton mode="modal">
          <button
            type="button"
            aria-label="Sign in"
            data-heatmap-id="chrome:sign-in"
            className="inline-flex items-center justify-center gap-1.5 h-9 min-w-9 text-xs font-bold text-black bg-brand-fill hover:bg-brand-deep px-2.5 transition-colors duration-(--duration-fast)"
          >
            <LogIn size={13} />
            <span className="hidden sm:inline">Sign in</span>
          </button>
        </SignInButton>
      )}
    </div>
  );
}
