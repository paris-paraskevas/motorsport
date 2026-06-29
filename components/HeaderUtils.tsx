'use client';
import Link from 'next/link';
import { Coffee, LogIn, Mail, MessageSquare, Settings } from 'lucide-react';
import { SignInButton, useAuth, useUser } from '@clerk/nextjs';
import { openContactModal } from './ContactModal';
import { NotificationBell } from './NotificationBell';

const COFFEE_URL = process.env.NEXT_PUBLIC_COFFEE_URL || 'https://buymeacoffee.com/parisp';

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
      <button
        type="button"
        onClick={openContactModal}
        aria-label="Contact"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-3 py-1.5 transition-colors duration-(--duration-fast)"
      >
        <Mail size={13} />
        <span className="hidden sm:inline">Contact</span>
      </button>
      <a
        href={COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy me a coffee"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-black bg-brand hover:bg-brand-deep rounded-full px-3 py-1.5 transition-colors duration-(--duration-fast)"
      >
        <Coffee size={13} />
        <span className="hidden sm:inline">Buy me a coffee</span>
        <span className="sm:hidden">Coffee</span>
      </a>
      {/* Notification center — sent-push history, signed-in only, all viewports
          (NotificationBell self-gates on Clerk auth and renders nothing when
          signed out). */}
      {isLoaded && isSignedIn && <NotificationBell />}
      {/* Staff-only feedback board (admin + moderator); everyday users never see it. */}
      {isLoaded && isSignedIn && isStaff && (
        <Link
          href="/feedback"
          className="hidden lg:inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-3 py-1.5 transition-colors duration-(--duration-fast)"
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
          className="hidden lg:inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-elevated border border-border rounded-full pl-1 pr-3 py-1 transition-colors duration-(--duration-fast)"
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
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-3 py-1.5 transition-colors duration-(--duration-fast)"
          >
            <LogIn size={13} />
            <span className="hidden sm:inline">Sign in</span>
          </button>
        </SignInButton>
      )}
    </div>
  );
}
