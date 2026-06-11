'use client';
import { LogIn } from 'lucide-react';
import { SignInButton, UserButton, useUser } from '@clerk/nextjs';

// Identity strip at the top of /settings (the bottom bar calls it Account —
// PR 2d makes the page keep that promise). Signed in: avatar + name/email,
// with Clerk's UserButton carrying manage-account and sign-out. Signed out:
// why-sign-in line + CTA. Preferences below work either way (device-local).
export function AccountIdentity() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <div className="border-y border-border py-5 mb-6 h-20 animate-pulse bg-surface/40" />;
  }

  if (!isSignedIn) {
    return (
      <div className="border-y border-border py-5 md:py-6 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-text text-base font-semibold">You&apos;re browsing as a guest</h2>
          <p className="text-text-faint text-xs mt-1 leading-relaxed">
            Preferences below save to this device. Sign in to sync followed
            series and notification settings across devices.
          </p>
        </div>
        <SignInButton mode="modal">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-bold text-black bg-brand hover:bg-brand-deep px-4 py-2 transition-colors duration-(--duration-fast)"
          >
            <LogIn size={14} />
            Sign in
          </button>
        </SignInButton>
      </div>
    );
  }

  const email = user.primaryEmailAddress?.emailAddress;
  return (
    <div className="border-y border-border py-5 md:py-6 mb-6 flex items-center gap-4">
      <UserButton appearance={{ elements: { avatarBox: 'w-10 h-10' } }} />
      <div className="min-w-0">
        <h2 className="text-text text-base font-semibold truncate">
          {user.fullName || user.username || 'Signed in'}
        </h2>
        {email && (
          <p className="font-mono text-[11px] text-text-faint truncate mt-0.5">{email}</p>
        )}
        <p className="text-text-faint text-xs mt-1">
          Preferences sync to your account. Manage profile or sign out from the avatar.
        </p>
      </div>
    </div>
  );
}
