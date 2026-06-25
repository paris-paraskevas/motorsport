'use client';
import Link from 'next/link';
import { Coffee, LogIn, Mail, MessageSquare, Settings } from 'lucide-react';
import { SignInButton, UserButton, useAuth, useUser } from '@clerk/nextjs';
import type { SeriesMeta } from '@/lib/types';
import { openContactModal } from './ContactModal';
import { SettingsClient } from './SettingsClient';

const COFFEE_URL = process.env.NEXT_PUBLIC_COFFEE_URL || 'https://buymeacoffee.com/parisp';

export function HeaderUtils({
  className = '',
  seriesList,
}: {
  className?: string;
  seriesList: SeriesMeta[];
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
          className="hidden lg:inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text bg-surface hover:bg-surface-elevated border border-border rounded-full px-3 py-1.5 transition-colors duration-(--duration-fast)"
        >
          <Settings size={13} />
          <span>Account</span>
        </Link>
      )}
      {isLoaded && isSignedIn && (
        <UserButton
          appearance={{ elements: { avatarBox: 'w-8 h-8' } }}
        >
          <UserButton.MenuItems>
            <UserButton.Action
              label="Preferences"
              labelIcon={<Settings size={14} />}
              open="preferences"
            />
          </UserButton.MenuItems>
          <UserButton.UserProfilePage
            label="Preferences"
            url="preferences"
            labelIcon={<Settings size={14} />}
          >
            <div className="paddock-prefs">
              <SettingsClient seriesList={seriesList} />
            </div>
          </UserButton.UserProfilePage>
        </UserButton>
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
