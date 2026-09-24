'use client';
import { LogIn, LogOut } from 'lucide-react';
import { AccountButton, SignInLink, SignOutButton, useAccount } from '@/lib/auth/client';

// Identity strip at the top of /settings (the bottom bar calls it Account —
// PR 2d makes the page keep that promise). Signed in: avatar + name/email,
// with the provider's account button carrying manage-account and sign-out. Signed out:
// why-sign-in line + CTA. Since 0.153.0 following / home-customise /
// notifications are account-only (guests hit sign-in walls on those pages),
// so the guest line sells the unlock instead of promising device-local saves.
export function AccountIdentity() {
  const { isLoaded, isSignedIn, account } = useAccount();

  if (!isLoaded) {
    return <div className="border-y border-border py-5 mb-6 h-20 animate-pulse bg-surface/40" />;
  }

  if (!isSignedIn) {
    return (
      <div className="border-y border-border py-5 md:py-6 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-19 font-semibold text-text">You&apos;re browsing as a guest</h2>
          <p className="text-text-faint text-xs mt-1 leading-relaxed">
            Following championships, customising your home and notifications
            are free account features — sign in to unlock them.
          </p>
        </div>
        <SignInLink>
          <button
            type="button"
            className="inline-flex items-center gap-2 bg-text px-4 py-2 font-mono text-11 font-semibold uppercase tracking-[0.12em] text-bg transition-colors duration-(--duration-fast) hover:bg-text-muted"
          >
            <LogIn size={14} />
            Sign in
          </button>
        </SignInLink>
      </div>
    );
  }

  const email = account?.email;
  return (
    <div className="border-y border-border py-5 md:py-6 mb-6 flex items-center gap-4">
      <AccountButton avatarClassName="w-10 h-10" />
      <div className="min-w-0">
        <h2 className="truncate font-serif text-19 font-semibold text-text">
          {account?.name || account?.username || 'Signed in'}
        </h2>
        {email && (
          <p className="font-mono text-11 text-text-faint truncate mt-0.5">{email}</p>
        )}
        <p className="text-text-faint text-xs mt-1">
          Preferences sync to your account. Manage profile or sign out from the avatar.
        </p>
      </div>
    </div>
  );
}

/** The Account page's Sign out row (R9), created here in the browser: the provider's sign-out piece is a Client Component
 *  whose single-child check refuses a child handed across from the page, a Server Component (React 19 hands it over as a
 *  lazy reference), and /settings answered 500 for every signed-in reader while the page held this markup itself. */
export function SignOutRow() {
  return (
    <SignOutButton>
      <button
        type="button"
        data-heatmap-id="account:sign-out"
        className="group flex w-full items-center gap-3 border-b border-border py-4 text-left transition-colors duration-(--duration-fast) hover:bg-surface"
      >
        <LogOut size={18} className="shrink-0 text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block text-text text-base font-semibold">Sign out</span>
          <span className="block text-text-faint text-xs">End this session on this device</span>
        </span>
      </button>
    </SignOutButton>
  );
}
